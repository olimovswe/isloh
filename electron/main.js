'use strict';
/* Isloh — kompyuter (Linux, Windows, macOS) uchun qobiq.
   Interfeys va mantiq www/ papkasida; bu fayl oyna, tray, avtomatik ishga tushish va fayllarni boshqaradi. */
const { app, BrowserWindow, Tray, Menu, ipcMain, protocol, net, nativeImage, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Ubuntu 24+ da AppImage sandbox cheklovi bilan ochilmasligi mumkin — faqat AppImage uchun o'chiramiz.
if (process.env.APPIMAGE) app.commandLine.appendSwitch('no-sandbox');

const APP_ID = 'uz.isloh.app';
// Sinov uchun: alohida ma'lumotlar papkasi va avtomatik ishga tushirishsiz
if (process.env.ISLOH_DATA_DIR) app.setPath('userData', process.env.ISLOH_DATA_DIR);
const NO_AUTOSTART = !!process.env.ISLOH_NO_AUTOSTART;
const WWW = path.join(__dirname, '..', 'www');
const DATA = app.getPath('userData');
const DATA_FILE = path.join(DATA, 'isloh-data.json');
const BACKUPS = path.join(DATA, 'backups');
const PREFS = path.join(DATA, 'prefs.json');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
}
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

let win = null, tray = null, quitting = false;
const startHidden = process.argv.includes('--hidden') || (process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin);

function readJSON(file, def) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return def; } }
function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}
function findWallpaper() {
  try { const f = fs.readdirSync(DATA).find(x => x.startsWith('wallpaper.')); return f ? path.join(DATA, f) : null; } catch (e) { return null; }
}

/* ------------------------------------------------------------ avtomatik ishga tushish */
const LINUX_AUTOSTART = path.join(app.getPath('home'), '.config', 'autostart', 'isloh.desktop');
function getAutostart() {
  if (process.platform === 'linux') return fs.existsSync(LINUX_AUTOSTART);
  return app.getLoginItemSettings().openAtLogin;
}
function setAutostart(on) {
  if (process.platform === 'linux') {
    if (on) {
      const exe = process.env.APPIMAGE || process.execPath;
      atomicWrite(LINUX_AUTOSTART, `[Desktop Entry]\nType=Application\nName=Isloh\nComment=Reja, maqsad va namoz vaqtlari\nExec="${exe}" --hidden\nIcon=isloh\nX-GNOME-Autostart-enabled=true\nTerminal=false\n`);
    } else if (fs.existsSync(LINUX_AUTOSTART)) fs.unlinkSync(LINUX_AUTOSTART);
  } else {
    app.setLoginItemSettings({ openAtLogin: !!on, openAsHidden: true, args: ['--hidden'] });
  }
  return getAutostart();
}

/* ------------------------------------------------------------ oyna va tray */
function iconPath() { return path.join(WWW, 'icon.png'); }
function showWindow() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  win.webContents.send('shown');
}
function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 380, minHeight: 560, title: 'Isloh', backgroundColor: '#0e1320',
    show: false, icon: iconPath(), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  if (process.platform !== 'darwin') win.removeMenu();
  win.loadURL('app://isloh/index.html');
  win.once('ready-to-show', () => { if (!startHidden) win.show(); });
  win.on('close', e => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://isloh/')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
}
function createTray() {
  try {
    let img = nativeImage.createFromPath(iconPath());
    img = img.resize({ width: process.platform === 'darwin' ? 18 : 22, height: process.platform === 'darwin' ? 18 : 22 });
    tray = new Tray(img);
    tray.setToolTip('Isloh');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Isloh'ni ochish", click: showWindow },
      { type: 'separator' },
      { label: 'Chiqish', click: () => { quitting = true; app.quit(); } },
    ]));
    tray.on('click', showWindow);
  } catch (e) { console.error('tray', e); }
}
function macMenu() {
  if (process.platform !== 'darwin') return;
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Isloh', submenu: [{ role: 'about', label: 'Isloh haqida' }, { type: 'separator' }, { role: 'hide', label: 'Yashirish' },
      { label: 'Chiqish', accelerator: 'Cmd+Q', click: () => { quitting = true; app.quit(); } }] },
    { role: 'editMenu', label: 'Tahrirlash' },
    { role: 'windowMenu', label: 'Oyna' },
  ]));
}

/* ------------------------------------------------------------ IPC: ma'lumotlar */
ipcMain.on('data-dir', e => { e.returnValue = DATA; });
ipcMain.handle('load', () => {
  try { return fs.readFileSync(DATA_FILE, 'utf8'); } catch (e) { return null; }
});
ipcMain.handle('save', (e, s) => { atomicWrite(DATA_FILE, s); return true; });
ipcMain.handle('backup', (e, s, day) => {
  fs.mkdirSync(BACKUPS, { recursive: true });
  const f = path.join(BACKUPS, `isloh-${String(day).replace(/[^0-9-]/g, '')}.json`);
  if (!fs.existsSync(f)) atomicWrite(f, s);
  const files = fs.readdirSync(BACKUPS).filter(x => /^isloh-\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort();
  for (const old of files.slice(0, -30)) fs.unlinkSync(path.join(BACKUPS, old));
  return f;
});
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };
ipcMain.handle('wall-save', (e, buf, mime) => {
  const ext = EXT[mime];
  if (!ext) throw new Error('Faqat JPG, PNG, WEBP yoki GIF rasm');
  const old = findWallpaper();
  if (old) fs.unlinkSync(old);
  fs.writeFileSync(path.join(DATA, 'wallpaper.' + ext), Buffer.from(buf));
  return true;
});
ipcMain.handle('wall-del', () => { const old = findWallpaper(); if (old) fs.unlinkSync(old); return true; });
ipcMain.handle('save-file', async (e, name, text) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('downloads'), name), filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return 'cancel';
  fs.writeFileSync(r.filePath, text);
  return r.filePath;
});
ipcMain.handle('autostart-get', () => getAutostart());
ipcMain.handle('autostart-set', (e, on) => setAutostart(on));
ipcMain.handle('open-data', () => shell.openPath(DATA));

/* ------------------------------------------------------------ ishga tushirish */
app.whenReady().then(() => {
  fs.mkdirSync(DATA, { recursive: true });
  protocol.handle('app', req => {
    const u = new URL(req.url);
    if (u.pathname === '/wallpaper') {
      const f = findWallpaper();
      return f ? net.fetch(pathToFileURL(f).toString()) : new Response('', { status: 404 });
    }
    const p = path.normalize(path.join(WWW, decodeURIComponent(u.pathname)));
    if (!p.startsWith(WWW)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(p).toString());
  });
  // Birinchi ishga tushishda avtomatik ochilishni yoqamiz (namoz eslatmalari uchun)
  const prefs = readJSON(PREFS, {});
  if (!prefs.autostartInit && !NO_AUTOSTART) {
    try { setAutostart(true); } catch (e) { console.error(e); }
    atomicWrite(PREFS, JSON.stringify({ ...prefs, autostartInit: true }));
  }
  macMenu();
  createWindow();
  createTray();
  app.on('activate', showWindow);
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', e => { /* tray'da ishlashda davom etadi */ });
