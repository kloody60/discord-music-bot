// تشغيل: npx electron scripts/render-icon.cjs  → يولّد build/icon.png و build/icon.ico من build/icon.svg
const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', 'build');
const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL('about:blank');
  const dataUrl = await win.webContents.executeJavaScript(`(async () => {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(${JSON.stringify(svg)});
    await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = 1024;
    c.getContext('2d').drawImage(img, 0, 0, 1024, 1024);
    return c.toDataURL('image/png');
  })()`);
  const big = nativeImage.createFromDataURL(dataUrl);
  fs.writeFileSync(path.join(dir, 'icon.png'), big.toPNG());

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = sizes.map(s => big.resize({ width: s, height: s, quality: 'best' }).toPNG());
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length;
  const entries = sizes.map((s, i) => {
    const e = Buffer.alloc(16);
    e[0] = s === 256 ? 0 : s; e[1] = s === 256 ? 0 : s;
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    return e;
  });
  fs.writeFileSync(path.join(dir, 'icon.ico'), Buffer.concat([head, ...entries, ...pngs]));
  console.log('icon done', fs.statSync(path.join(dir, 'icon.ico')).size);
  app.quit();
});
