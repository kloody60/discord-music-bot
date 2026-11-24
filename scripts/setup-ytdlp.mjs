// ينزّل yt-dlp.exe الرسمي من GitHub إلى مجلد bin
import { createWriteStream, mkdirSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const isWin = process.platform === 'win32';
const name = isWin ? 'yt-dlp.exe' : process.platform === 'darwin' ? 'yt-dlp_macos' : 'yt-dlp';
const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${name}`;
mkdirSync('bin', { recursive: true });
const out = `bin/${isWin ? 'yt-dlp.exe' : 'yt-dlp'}`;
console.log('Downloading', url);
const res = await fetch(url, { redirect: 'follow' });
if (!res.ok) throw new Error('HTTP ' + res.status);
await pipeline(Readable.fromWeb(res.body), createWriteStream(out, { mode: 0o755 }));
console.log('Saved to', out);
