import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { queues, getQueue, emptyState, events } from './music.js';
import { search, downloadToLibrary } from './ytdlp.js';
import {
  LIB_DIR, listLibrary, saveToLibrary, removeFromLibrary, safeName,
} from './library.js';
import { listGuildSounds, listDefaultSounds, saveSound, fetchSound } from './soundboard.js';

export function startWeb(client) {
  const app = express();
  const password = process.env.DASHBOARD_PASSWORD || '';
  const tokens = new Set();

  const cookie = req => Object.fromEntries((req.headers.cookie || '').split(/;\s*/)
    .filter(Boolean).map(c => c.split('=').map(decodeURIComponent)));
  const authed = req => !password || tokens.has(cookie(req).sid);

  app.use(express.json());
  app.post('/login', (req, res) => {
    if (req.body?.password !== password) return res.status(401).json({ error: 'كلمة السر غلط' });
    const sid = crypto.randomBytes(24).toString('hex');
    tokens.add(sid);
    res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`);
    res.json({ ok: true });
  });
  app.get('/api/auth', (req, res) => res.json({ ok: authed(req), needPassword: !!password }));

  app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')));
  app.use('/api', (req, res, next) => authed(req) ? next() : res.status(401).json({ error: 'unauthorized' }));

  const wrap = fn => async (req, res) => {
    try { res.json((await fn(req, res)) ?? { ok: true }); }
    catch (e) { res.status(400).json({ error: e.message }); }
  };
  const guildOf = req => {
    const g = client.guilds.cache.get(req.params.gid);
    if (!g) throw new Error('السيرفر غير موجود');
    return g;
  };
  const stateOf = g => queues.get(g.id)?.state() ?? emptyState(g.id);

  // ---- السيرفرات والقنوات
  app.get('/api/guilds', (req, res) => res.json(client.guilds.cache.map(g => ({
    id: g.id, name: g.name, icon: g.iconURL({ size: 64 }),
    voice: g.channels.cache.filter(c => c.isVoiceBased())
      .map(c => ({ id: c.id, name: c.name, members: c.members.size })),
  }))));
  app.get('/api/guilds/:gid/state', wrap(req => stateOf(guildOf(req))));

  // ---- بث الحالة (SSE)
  app.get('/api/events', (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders();
    const send = e => {
      const g = client.guilds.cache.get(e.detail);
      if (g) res.write(`data: ${JSON.stringify(stateOf(g))}\n\n`);
    };
    events.addEventListener('change', send);
    const ka = setInterval(() => res.write(': ka\n\n'), 20000);
    req.on('close', () => { events.removeEventListener('change', send); clearInterval(ka); });
  });

  // ---- التحكم
  const q = req => getQueue(guildOf(req));
  app.post('/api/guilds/:gid/join', wrap(async req => { await q(req).join(req.body.channelId); }));
  app.post('/api/guilds/:gid/play', wrap(async req => {
    const queue = q(req);
    if (req.body.channelId) await queue.join(req.body.channelId);
    if (!queue.channelId) throw new Error('اختر قناة صوتية أولاً');
    const items = await queue.add(req.body.query, 'لوحة التحكم');
    return { added: items.length, first: items[0]?.title };
  }));
  app.post('/api/guilds/:gid/play-file', wrap(async req => {
    const queue = q(req);
    if (req.body.channelId) await queue.join(req.body.channelId);
    if (!queue.channelId) throw new Error('اختر قناة صوتية أولاً');
    queue.addFile(req.body.file, 'المكتبة');
  }));
  // يسحب صوت (أو عدة أصوات) من ديسكورد ويشغلها بالبوت مباشرة
  app.post('/api/guilds/:gid/play-sounds', wrap(async req => {
    const queue = q(req);
    if (req.body.channelId) await queue.join(req.body.channelId);
    if (!queue.channelId) throw new Error('اختر قناة صوتية أولاً');
    let n = 0;
    for (const s of req.body.sounds || []) {
      queue.addFile(await saveSound(s, true), 'أصوات ديسكورد');
      n++;
    }
    return { added: n };
  }));
  for (const act of ['skip', 'pause', 'resume', 'stop', 'shuffle', 'destroy'])
    app.post(`/api/guilds/:gid/${act}`, wrap(req => { q(req)[act](); }));
  app.post('/api/guilds/:gid/volume', wrap(req => q(req).setVolume(Number(req.body.volume))));
  app.post('/api/guilds/:gid/loop', wrap(req => q(req).setLoop(req.body.mode)));
  app.post('/api/guilds/:gid/remove', wrap(req => q(req).remove(Number(req.body.index))));

  app.get('/api/search', wrap(req => search(String(req.query.q || ''))));

  // ---- المكتبة (أصواتك الخاصة)
  app.get('/api/library', (req, res) => res.json(listLibrary()));
  app.use('/library-files', (req, res, next) => authed(req) ? next() : res.sendStatus(401),
    express.static(LIB_DIR));
  app.post('/api/library/upload', express.raw({ type: () => true, limit: '200mb' }), wrap(req => {
    const name = String(req.query.name || 'audio.mp3');
    return { file: saveToLibrary(name, req.body) };
  }));
  app.post('/api/library/import', wrap(async req => {
    const file = await downloadToLibrary(req.body.url, LIB_DIR, req.body.name?.trim() || undefined);
    return { file };
  }));
  app.post('/api/library/delete', wrap(req => removeFromLibrary(req.body.file)));

  // ---- أصوات ديسكورد (Soundboard)
  app.get('/api/guilds/:gid/sounds', wrap(req => listGuildSounds(client, guildOf(req).id)));
  app.get('/api/default-sounds', wrap(() => listDefaultSounds(client)));
  app.get('/api/sound/:id', async (req, res) => {
    try {
      const { buf, ext } = await fetchSound(req.params.id.replace(/\D/g, ''));
      const name = safeName(String(req.query.name || req.params.id)) + ext;
      res.set('Content-Type', ext === '.ogg' ? 'audio/ogg' : ext === '.wav' ? 'audio/wav' : 'audio/mpeg');
      if (req.query.dl) res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
      res.send(buf);
    } catch (e) { res.status(404).json({ error: e.message }); }
  });
  app.post('/api/sounds/save', wrap(async req => {
    const saved = [];
    for (const s of req.body.sounds) saved.push(await saveSound(s, true));
    return { saved };
  }));

  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '127.0.0.1';
  app.listen(port, host, () => console.log(`لوحة التحكم: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`));
}
