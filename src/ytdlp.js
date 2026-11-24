import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const isWin = process.platform === 'win32';

export function ytdlpPath() {
  if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH;
  const local = path.resolve(process.env.BOT_DATA_DIR || '.', 'bin', isWin ? 'yt-dlp.exe' : 'yt-dlp');
  return existsSync(local) ? local : 'yt-dlp';
}

function baseArgs() {
  const a = ['--no-warnings', '--ignore-config'];
  if (process.env.COOKIES_FILE) a.push('--cookies', process.env.COOKIES_FILE);
  return a;
}

export function isUrl(s) {
  return /^https?:\/\//i.test(s.trim());
}

function run(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ytdlpPath(), [...baseArgs(), ...args], { windowsHide: true });
    let out = '', err = '';
    p.stdout.on('data', d => (out += d));
    p.stderr.on('data', d => (err += d));
    p.on('error', e => reject(new Error(e.code === 'ENOENT'
      ? 'yt-dlp غير موجود. شغّل: npm run setup' : e.message)));
    p.on('close', code => code === 0 ? resolve(out)
      : reject(new Error(err.trim().split('\n').pop() || 'yt-dlp failed')));
  });
}

function norm(e, fallbackUrl) {
  const url = e.webpage_url || (e.url && /^https?:/.test(e.url) ? e.url : null)
    || (e.id && (e.ie_key || e.extractor_key || '').toLowerCase().includes('youtube')
      ? `https://www.youtube.com/watch?v=${e.id}` : null) || fallbackUrl;
  return {
    kind: 'url',
    title: e.title || url,
    url,
    duration: e.duration || 0,
    thumbnail: e.thumbnail || e.thumbnails?.at(-1)?.url || null,
  };
}

/** يحل أي رابط (يوتيوب/تيك توك/انستغرام/ساوندكلاود/رابط مباشر...) أو نص بحث إلى قائمة مقاطع */
export async function resolve(query) {
  query = query.trim();
  const target = isUrl(query) ? query : `ytsearch1:${query}`;
  const out = await run(['-J', '--flat-playlist', '--playlist-end', '100', target]);
  const j = JSON.parse(out);
  if (j.entries) {
    const items = j.entries.filter(Boolean).map(e => norm(e, target));
    if (!items.length) throw new Error('ما لقيت نتائج');
    return items;
  }
  return [norm(j, target)];
}

export async function search(query, n = 6) {
  const out = await run(['-J', '--flat-playlist', `ytsearch${n}:${query}`]);
  return (JSON.parse(out).entries || []).filter(Boolean).map(e => norm(e));
}

/** يبدأ تيار صوت من أي رابط. يرجّع العملية — stdout هو الصوت */
export function streamAudio(url) {
  const p = spawn(ytdlpPath(), [
    ...baseArgs(), '-f', 'bestaudio/best', '--no-playlist', '--quiet', '-o', '-', url,
  ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stderr.on('data', () => {});
  p.on('error', () => {});
  return p;
}

/** يحمّل الصوت من الرابط ويحوله mp3 داخل المكتبة */
export function downloadToLibrary(url, dir, name) {
  const safe = (name || '%(title).80B').replace(/[\\/:*?"<>|]/g, '_');
  return run([
    '--no-playlist', '-x', '--audio-format', 'mp3', '--audio-quality', '0',
    '-o', path.join(dir, `${safe}.%(ext)s`), '--print', 'after_move:filepath', url,
  ]).then(o => path.basename(o.trim().split('\n').pop()));
}
