import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = app.getPath('userData');
process.env.BOT_DATA_DIR = dataDir;
process.env.PORT ||= '3737';
process.env.HOST = '127.0.0.1';
fs.mkdirSync(path.join(dataDir, 'bin'), { recursive: true });

// ffmpeg المدمج: نضيفه لـ PATH عشان يلقاه البوت و yt-dlp حتى لو ما كان مثبت في النظام
const ffDir = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static')
  : path.join(here, '..', 'node_modules', 'ffmpeg-static');
if (fs.existsSync(ffDir)) process.env.PATH = ffDir + path.delimiter + process.env.PATH;

const cfgFile = path.join(dataDir, 'config.json');
const readCfg = () => { try { return JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch { return {}; } };
const writeCfg = c => fs.writeFileSync(cfgFile, JSON.stringify(c, null, 2));
const ytPath = () => path.join(dataDir, 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

let win, botStarted = false, botTag = null;

function showSetup() { win.loadFile(path.join(here, 'setup.html')); }
function showDashboard() { win.loadURL(`http://127.0.0.1:${process.env.PORT}/`); }

async function startBotWith(token) {
  const mod = await import(pathToFileURL(path.join(here, '..', 'src', 'index.js')).href);
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('انتهت مهلة الاتصال')), 30000));
  await Promise.race([mod.startBot(token), timeout]);
  botTag = await Promise.race([mod.ready, timeout]);
  botStarted = true;
}

ipcMain.handle('state', () => ({
  hasToken: !!readCfg().token, hasYtdlp: fs.existsSync(ytPath()),
  running: botStarted, tag: botTag, dataDir,
}));

ipcMain.handle('save-token', async (_e, token) => {
  token = String(token || '').trim();
  if (!token) return { error: 'اكتب التوكن' };
  if (/^https?:\/\//i.test(token))
    return { error: 'هذا رابط، مو توكن. التوكن تجيبه من صفحة Bot ← Reset Token' };
  if (token.length < 50 || /\s/.test(token))
    return { error: 'هذا ما يشبه التوكن (نص طويل بدون مسافات، فيه نقطتين)' };
  if (botStarted) { writeCfg({ ...readCfg(), token }); return { restart: true }; }
  try {
    await startBotWith(token);
    writeCfg({ ...readCfg(), token });
    showDashboard();
    return { ok: true };
  } catch (e) {
    return { error: /token/i.test(e.message) ? 'التوكن غير صحيح' : e.message };
  }
});

ipcMain.handle('open-dashboard', () => { if (botStarted) showDashboard(); return botStarted; });
ipcMain.handle('open-folder', () => shell.openPath(dataDir));

ipcMain.handle('download-ytdlp', async () => {
  try {
    const name = process.platform === 'win32' ? 'yt-dlp.exe' : process.platform === 'darwin' ? 'yt-dlp_macos' : 'yt-dlp';
    const res = await fetch(`https://github.com/yt-dlp/yt-dlp/releases/latest/download/${name}`, { redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const tmp = ytPath() + '.part';
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp, { mode: 0o755 }));
    fs.renameSync(tmp, ytPath());
    return { ok: true };
  } catch (e) { return { error: e.message }; }
});

app.whenReady().then(async () => {
  win = new BrowserWindow({
    width: 1100, height: 780, title: 'بوت الموسيقى', autoHideMenuBar: true,
    webPreferences: { preload: path.join(here, 'preload.cjs'), contextIsolation: true },
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'اللوحة', click: () => botStarted ? showDashboard() : showSetup() },
    { label: 'الإعدادات', click: showSetup },
    { label: 'مجلد البيانات', click: () => shell.openPath(dataDir) },
    { label: 'تحديث', role: 'reload' },
  ]));
  // أي رابط خارجي يفتح في المتصفح
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

  const token = readCfg().token;
  if (token) {
    showSetup();
    try { await startBotWith(token); showDashboard(); } catch { showSetup(); }
  } else showSetup();
});

app.on('window-all-closed', () => app.quit());
