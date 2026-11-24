import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = path.resolve(process.env.BOT_DATA_DIR || '.');
export const LIB_DIR = path.join(DATA_DIR, 'library');
export const SOUNDS_DIR = path.join(DATA_DIR, 'downloads', 'discord-sounds');
fs.mkdirSync(LIB_DIR, { recursive: true });
fs.mkdirSync(SOUNDS_DIR, { recursive: true });

const EXT = /\.(mp3|ogg|oga|opus|wav|m4a|aac|flac|webm|mp4|mkv|mov|mpeg)$/i;

export function safeName(n) {
  return path.basename(n).replace(/[\\/:*?"<>|]/g, '_').slice(0, 150);
}

export function listLibrary() {
  return fs.readdirSync(LIB_DIR).filter(f => EXT.test(f)).map(f => {
    const st = fs.statSync(path.join(LIB_DIR, f));
    return { file: f, title: f.replace(EXT, ''), size: st.size, mtime: st.mtimeMs };
  }).sort((a, b) => b.mtime - a.mtime);
}

export function libraryPath(file) {
  const p = path.join(LIB_DIR, safeName(file));
  if (!fs.existsSync(p)) throw new Error('الملف غير موجود');
  return p;
}

export function saveToLibrary(name, buffer) {
  name = safeName(name);
  if (!EXT.test(name)) throw new Error('صيغة غير مدعومة');
  let final = name, i = 1;
  while (fs.existsSync(path.join(LIB_DIR, final)))
    final = name.replace(EXT, m => ` (${i++})${m}`);
  fs.writeFileSync(path.join(LIB_DIR, final), buffer);
  return final;
}

export function removeFromLibrary(file) {
  fs.unlinkSync(libraryPath(file));
}
