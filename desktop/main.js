'use strict';
/* Isloh — desktop dastur.
   Oyna interfeysni dastur ichidan (isloh://app) ochadi; veb-server ham, port ham yo'q.
   Oyna yopilsa dastur trayda ishlashda davom etadi: Telegram bot, eslatmalar va PDF hisobotlar to'xtamaydi. */
const { app, BrowserWindow, Tray, Menu, ipcMain, protocol, shell, session, nativeImage } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOME = os.homedir();
const DATA_DIR = process.env.ISLOH_DATA || path.join(process.env.XDG_DATA_HOME || path.join(HOME, '.local/share'), 'isloh/data');
const ENV_FILE = process.env.ISLOH_ENV || path.join(process.env.XDG_CONFIG_HOME || path.join(HOME, '.config'), 'isloh/.env');
const UI = path.join(__dirname, '..', 'ui');
const ICON = path.join(UI, 'icons', 'icon-512.png');
const HIDDEN = process.argv.includes('--hidden');

app.setName('Isloh');
app.commandLine.appendSwitch('lang', 'en-GB'); // vaqt maydonlari 24 soatlik (20:00, 8:00 PM emas)
if (!app.requestSingleInstanceLock()) { app.quit(); return; }

/* --------------------------------------------------------------- jurnal */
const LOG_FILE = path.join(path.dirname(DATA_DIR), 'isloh.log');
fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
try { if (fs.statSync(LOG_FILE).size > 2e6) fs.renameSync(LOG_FILE, LOG_FILE + '.1'); } catch (e) { /* hali yo'q */ }
function log(...a) {
  const line = `${new Date().toISOString()} ${a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')}\n`;
  fs.appendFile(LOG_FILE, line, () => {});
  if (!app.isPackaged) process.stdout.write(line);
}

/* --------------------------------------------------------------- yadro */
let win = null, tray = null, quitting = false;
const isloh = require('../core/app').create({
  dataDir: DATA_DIR,
  envFile: ENV_FILE,
  log,
  onEvent: ev => { if (win && !win.isDestroyed()) win.webContents.send('isloh:event', ev); },
});

ipcMain.handle('isloh:api', (_e, method, p, body, token) => isloh.handle(String(method), String(p), body, token));

/* --------------------------------------------------------------- interfeys fayllari */
protocol.registerSchemesAsPrivileged([{ scheme: 'isloh', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://i.ytimg.com; frame-src https://www.youtube-nocookie.com; connect-src 'none'";

function serveUi(req) {
  const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(UI, rel);
  if (!file.startsWith(UI + path.sep)) return new Response('', { status: 403 });
  try {
    const body = fs.readFileSync(file);
    return new Response(body, { headers: { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Content-Security-Policy': CSP, 'Cache-Control': 'no-store' } });
  } catch (e) {
    return new Response('', { status: 404 });
  }
}

/* --------------------------------------------------------------- oyna */
function showWindow() {
  if (!win || win.isDestroyed()) {
    win = new BrowserWindow({
      width: 1320, height: 860, minWidth: 1000, minHeight: 660,
      title: 'Isloh', icon: ICON, backgroundColor: '#06080f', show: false, autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false, spellcheck: false },
    });
    win.removeMenu();
    win.loadURL('isloh://app/index.html');
    win.once('ready-to-show', () => win.show());
    win.on('close', e => { if (!quitting) { e.preventDefault(); win.hide(); } });
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https:\/\//.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (e, url) => {
      if (!url.startsWith('isloh://app/')) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); }
    });
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function quit() { quitting = true; app.quit(); }

app.on('second-instance', () => showWindow());
app.on('window-all-closed', () => { /* trayda ishlashda davom etadi */ });
app.on('before-quit', () => { quitting = true; isloh.stop(); });

app.whenReady().then(() => {
  protocol.handle('isloh', serveUi);
  // YouTube pleyeri ilovani tanishi uchun (ichki manzil http emas, shuning uchun ilova nomi beriladi)
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['https://www.youtube-nocookie.com/*'] }, (d, cb) => {
    d.requestHeaders.Referer = 'https://uz.olimovswe.isloh/';
    cb({ requestHeaders: d.requestHeaders });
  });
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'fullscreen'));

  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 22, height: 22 }));
  tray.setToolTip('Isloh');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Isloh ni ochish', click: showWindow },
    { type: 'separator' },
    { label: 'Chiqish', click: quit },
  ]));
  tray.on('click', showWindow);

  isloh.start();
  if (!HIDDEN) showWindow();

  // Bot tokeni o'zgarsa (set-token.sh) dastur o'zi qayta ishga tushadi
  fs.watchFile(ENV_FILE, { interval: 3000 }, (cur, prev) => {
    if (cur.mtimeMs === prev.mtimeMs) return;
    log('Sozlamalar o\'zgardi — qayta ishga tushirilmoqda');
    const visible = !!(win && !win.isDestroyed() && win.isVisible());
    app.relaunch({ args: process.argv.slice(1).filter(a => a !== '--hidden').concat(visible ? [] : ['--hidden']) });
    quitting = true;
    isloh.stop();
    app.exit(0);
  });
});
