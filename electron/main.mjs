import { app, BrowserWindow, ipcMain, Menu, shell, dialog } from 'electron';
import updaterPkg from 'electron-updater';
const { autoUpdater } = updaterPkg;
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

function showSetup(err) { win.loadFile(path.join(here, 'setup.html'), { query: err ? { err } : {} }); }
function showLoading(m) { win.loadFile(path.join(here, 'loading.html'), { query: { m } }); }
function showDashboard() { win.loadURL(`http://127.0.0.1:${process.env.PORT}/`); }

const errText = e => /invalid token|TokenInvalid/i.test(e.message)
  ? 'التوكن غير صحيح. ولّد توكن جديد من Reset Token وانسخه كامل'
  : /disallowed intents/i.test(e.message) ? 'ديسكورد رفض الاتصال (Intents): ' + e.message : e.message;

// ---- yt-dlp: ينزل تلقائي، ويتحدث تلقائي كل أسبوع
async function downloadYtdlp() {
  const name = process.platform === 'win32' ? 'yt-dlp.exe' : process.platform === 'darwin' ? 'yt-dlp_macos' : 'yt-dlp';
  const res = await fetch(`https://github.com/yt-dlp/yt-dlp/releases/latest/download/${name}`, { redirect: 'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const tmp = ytPath() + '.part';
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp, { mode: 0o755 }));
  fs.renameSync(tmp, ytPath());
}
let ytJob = null;
const runYtdlpJob = () => (ytJob ??= downloadYtdlp()
  .then(() => ({ ok: true }), e => ({ error: e.message }))
  .finally(() => { ytJob = null; }));
const ytAge = () => { try { return Date.now() - fs.statSync(ytPath()).mtimeMs; } catch { return Infinity; } };

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
    return { error: errText(e) };
  }
});

// ---- التحديث الداخلي (من GitHub Releases)
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
let updateReady = null;
autoUpdater.on('update-downloaded', async info => {
  updateReady = info.version;
  const r = await dialog.showMessageBox(win, {
    type: 'info', title: 'تحديث جاهز', buttons: ['إعادة التشغيل الآن', 'لاحقا'], defaultId: 0, cancelId: 1,
    message: `نزلت النسخة ${info.version}`, detail: 'أعد تشغيل البرنامج لتطبيق التحديث. (وإذا اخترت لاحقا، يتطبق لما تقفل البرنامج.)',
  });
  if (r.response === 0) autoUpdater.quitAndInstall();
});
autoUpdater.on('error', e => console.error('updater:', e.message));
const checkUpdates = () => app.isPackaged ? autoUpdater.checkForUpdates().catch(() => null) : Promise.resolve(null);

ipcMain.handle('version', () => ({ version: app.getVersion(), packaged: app.isPackaged, updateReady }));
ipcMain.handle('check-update', async () => {
  if (!app.isPackaged) return { dev: true };
  const r = await checkUpdates();
  if (!r) return { error: 'تعذر الاتصال بخادم التحديثات' };
  const latest = r.updateInfo.version;
  return { latest, current: app.getVersion(), newer: latest !== app.getVersion() };
});

ipcMain.handle('open-dashboard', () => { if (botStarted) showDashboard(); return botStarted; });
ipcMain.handle('open-folder', () => shell.openPath(dataDir));

ipcMain.handle('download-ytdlp', () => runYtdlpJob());

app.whenReady().then(async () => {
  win = new BrowserWindow({
    width: 1180, height: 800, minWidth: 900, minHeight: 600, title: 'بوت الموسيقى', autoHideMenuBar: true,
    backgroundColor: '#07090d',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#07090d', symbolColor: '#8a92a6', height: 40 },
    icon: path.join(here, '..', 'build', 'icon.png'),
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

  showLoading('جاري تجهيز البرنامج...');
  // أول مرة: ينزّل أداة التحميل لحاله. بعدها يحدّثها بالخلفية كل أسبوع.
  if (!fs.existsSync(ytPath())) {
    showLoading('جاري تنزيل أداة التحميل (مرة وحدة بس)...');
    await runYtdlpJob();
  } else if (ytAge() > 7 * 864e5) runYtdlpJob();

  // التوكن محفوظ؟ يشغّل البوت ويفتح اللوحة على طول
  const token = readCfg().token;
  if (token) {
    showLoading('جاري تشغيل البوت...');
    try { await startBotWith(token); showDashboard(); } catch (e) { showSetup(errText(e)); }
  } else showSetup();

  // يشيّك على التحديثات عند الفتح، وكل 6 ساعات
  setTimeout(checkUpdates, 8000);
  setInterval(checkUpdates, 6 * 3600 * 1000);
});

app.on('window-all-closed', () => app.quit());
