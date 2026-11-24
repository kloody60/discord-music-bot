import fs from 'node:fs';
import path from 'node:path';
import { SOUNDS_DIR, LIB_DIR, safeName } from './library.js';

const CDN = 'https://cdn.discordapp.com/soundboard-sounds/';

/** أصوات سيرفر معين (Soundboard) */
export async function listGuildSounds(client, guildId) {
  const r = await client.rest.get(`/guilds/${guildId}/soundboard-sounds`);
  const items = Array.isArray(r) ? r : r.items || [];
  return items.map(s => ({
    id: s.sound_id, name: s.name, volume: s.volume,
    emoji: s.emoji_name || null, guildId, url: CDN + s.sound_id,
  }));
}

/** أصوات ديسكورد الافتراضية */
export async function listDefaultSounds(client) {
  const r = await client.rest.get('/soundboard-default-sounds');
  return (Array.isArray(r) ? r : r.items || []).map(s => ({
    id: s.sound_id, name: s.name, volume: s.volume,
    emoji: s.emoji_name || null, guildId: null, url: CDN + s.sound_id,
  }));
}

async function fetchSound(id) {
  const res = await fetch(CDN + id);
  if (!res.ok) throw new Error(`تعذر تحميل الصوت (${res.status})`);
  const type = res.headers.get('content-type') || '';
  const ext = type.includes('ogg') ? '.ogg' : type.includes('wav') ? '.wav' : '.mp3';
  return { buf: Buffer.from(await res.arrayBuffer()), ext };
}

/** يحفظ الصوت في downloads/discord-sounds ويضيفه للمكتبة (لتشغيله في الأغاني) */
export async function saveSound(sound, toLibrary = true) {
  const { buf, ext } = await fetchSound(sound.id);
  const file = `${safeName(sound.name)}-${sound.id.slice(-4)}${ext}`;
  fs.writeFileSync(path.join(SOUNDS_DIR, file), buf);
  if (toLibrary) fs.writeFileSync(path.join(LIB_DIR, file), buf);
  return file;
}

export { fetchSound };
