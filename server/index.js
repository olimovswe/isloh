#!/usr/bin/env node
'use strict';
/* Isloh serveri: API + veb-ilova + Telegram bot + eslatmalar + podkast yig'uvchi.
   Ishga tushirish:  node server/index.js   (sozlamalar .env faylida) */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// .env faylini o'qish
try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (e) { /* .env bo'lmasa — standart qiymatlar */ }

const PORT = +process.env.PORT || 8080;
const HOST = process.env.HOST || '127.0.0.1';
const DATA = path.resolve(ROOT, process.env.DATA_DIR || 'data');
const WEB = path.join(ROOT, 'web');
const PUBLIC_URL = process.env.PUBLIC_URL || `http://${HOST}:${PORT}`;
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const BOT_USERNAME = process.env.BOT_USERNAME || 'islohuzbot';
const DEV_LOGIN = process.env.DEV_LOGIN === '1';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const T = require('./time');
const Prayer = require('./prayer');
const db = require('./db').open(DATA);

/* ------------------------------------------------------------ jonli hodisalar (SSE) */
const clients = new Map(); // userId -> Set(res)
const bus = {
  emit(userId, ev) {
    const set = clients.get(userId);
    if (!set) return;
    const data = `data: ${JSON.stringify(ev)}\n\n`;
    for (const res of set) { try { res.write(data); } catch (e) { /* uzilgan */ } }
  },
};

const core = require('./core').create(db, bus);
const analysis = require('./analysis').create(db, core);
const { report } = require('./pdf');
const feeds = require('./feeds').create(db, log);
const bot = BOT_TOKEN ? require('./bot').create({ token: BOT_TOKEN, core, analysis, reportPdf: report, publicUrl: PUBLIC_URL, username: BOT_USERNAME, log }) : null;
const scheduler = require('./scheduler').create({ db, core, bot, bus, log });
const { ApiError } = core;

/* ------------------------------------------------------------ marshrutlar */
const routes = [];
const route = (method, pattern, fn, open = false) => routes.push({ method, rx: new RegExp('^' + pattern + '$'), fn, open });
const int = v => parseInt(v, 10);

route('GET', '/api/config', () => ({ bot_username: BOT_USERNAME, bot_ready: !!bot, dev_login: DEV_LOGIN, cities: Prayer.CITIES.map(c => ({ id: c.id, name: c.name })) }), true);
route('POST', '/api/auth/verify', ({ body, ip }) => core.verifyCode(body.code, ip), true);
route('POST', '/api/auth/dev', ({ body, ip }) => {
  if (!DEV_LOGIN || !/^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(ip)) throw new ApiError(404, 'Topilmadi');
  const phone = '+' + String(body.phone || '998900000000').replace(/\D/g, '');
  const u = core.registerContact({ tg_id: -Math.abs(int(phone.slice(-9)) || 1), phone, username: '', first_name: body.name || 'Sinov' });
  return { code: core.newCode(u.id) };
}, true);
route('POST', '/api/auth/logout', ({ token }) => { core.logout(token); return { ok: true }; });
route('GET', '/api/me', ({ user }) => core.publicUser(user));
route('PUT', '/api/me', ({ user, body }) => core.updateMe(user, body));
route('GET', '/api/home', ({ user }) => core.home(user));
route('POST', '/api/prayers', ({ user, body }) => core.prayerMark(user, body.date || core.activeDate(user), body.prayer));
route('GET', '/api/plan', ({ user, q }) => core.planGet(user, q.get('date') || core.activeDate(user)));
route('POST', '/api/plan/ready', ({ user, body }) => core.planReady(user, body.date, body.ready !== false));
route('POST', '/api/tasks', ({ user, body }) => core.taskCreate(user, body));
route('PATCH', '/api/tasks/(\\d+)', ({ user, m, body }) => core.taskUpdate(user, int(m[1]), body));
route('DELETE', '/api/tasks/(\\d+)', ({ user, m }) => core.taskDelete(user, int(m[1])));
route('POST', '/api/tasks/(\\d+)/start', ({ user, m }) => core.taskStart(user, int(m[1])));
route('POST', '/api/tasks/(\\d+)/finish', ({ user, m }) => core.taskFinish(user, int(m[1])));
route('POST', '/api/tasks/(\\d+)/rate', ({ user, m, body }) => core.taskRate(user, int(m[1]), body.rating, body.note));
route('PATCH', '/api/templates/(\\d+)', ({ user, m, body }) => core.templateUpdate(user, int(m[1]), body));
route('DELETE', '/api/templates/(\\d+)', ({ user, m }) => core.templateDelete(user, int(m[1])));
route('POST', '/api/wake', ({ user, body }) => core.wake(user, body.date || core.activeDate(user)));
route('POST', '/api/sleep', ({ user, body }) => core.sleep(user, body.date || core.activeDate(user)));
route('GET', '/api/history', ({ user, q }) => analysis.history(user, q.get('q') || '', 20, int(q.get('offset')) || 0));
route('GET', '/api/day/(\\d{4}-\\d{2}-\\d{2})', ({ user, m }) => analysis.dayAnalysis(user, m[1]));
route('GET', '/api/trends', ({ user, q }) => analysis.trends(user, Math.min(90, int(q.get('n')) || 30)));
route('GET', '/api/profile', ({ user }) => analysis.profile(user));
route('GET', '/api/feed', ({ user, q }) => feeds.feed(user, { channel: q.get('channel'), before: q.get('before'), q: q.get('q') }));
route('POST', '/api/channels', async ({ user, body }) => {
  try { return await feeds.addChannel(user, body.url, body.category); } catch (e) { throw new ApiError(400, e.message); }
});
route('POST', '/api/videos/([\\w-]+)/watched', ({ user, m }) => { feeds.watched(user, m[1]); return { ok: true }; });
route('GET', '/api/books', ({ user }) => db.all('SELECT * FROM books WHERE user_id=? ORDER BY finished_at IS NOT NULL, created_at DESC', user.id));
route('POST', '/api/books', ({ user, body }) => {
  const title = String(body.title || '').trim().slice(0, 150);
  if (!title) throw new ApiError(400, 'Kitob nomini yozing');
  const id = db.run('INSERT INTO books (user_id,title,author,pages,current,created_at) VALUES (?,?,?,?,0,?)', user.id, title, String(body.author || '').slice(0, 100), Math.max(0, int(body.pages) || 0), Date.now()).lastInsertRowid;
  return db.get('SELECT * FROM books WHERE id=?', id);
});
route('PATCH', '/api/books/(\\d+)', ({ user, m, body }) => {
  const b = db.get('SELECT * FROM books WHERE id=? AND user_id=?', int(m[1]), user.id);
  if (!b) throw new ApiError(404, 'Topilmadi');
  const current = 'current' in body ? Math.max(0, Math.min(b.pages || 1e6, int(body.current) || 0)) : b.current;
  const finished = b.pages && current >= b.pages ? (b.finished_at || Date.now()) : null;
  db.run('UPDATE books SET current=?, finished_at=? WHERE id=?', current, finished, b.id);
  return db.get('SELECT * FROM books WHERE id=?', b.id);
});
route('DELETE', '/api/books/(\\d+)', ({ user, m }) => { db.run('DELETE FROM books WHERE id=? AND user_id=?', int(m[1]), user.id); return { ok: true }; });

/* ------------------------------------------------------------ HTTP */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wav': 'audio/wav', '.ico': 'image/x-icon' };

function send(res, status, body, type = 'application/json; charset=utf-8', extra = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': buf.length, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...extra });
  res.end(buf);
}
const tokenOf = req => (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

function serveStatic(req, res, pathname) {
  let p = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  const fp = path.normalize(path.join(WEB, p));
  if (!fp.startsWith(WEB) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) return send(res, 404, { error: 'Topilmadi' });
  const ext = path.extname(fp);
  const cache = ext === '.html' || p === '/sw.js' ? 'no-cache' : 'public, max-age=3600';
  send(res, 200, fs.readFileSync(fp), MIME[ext] || 'application/octet-stream', { 'Cache-Control': cache });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const ip = req.socket.remoteAddress || '';
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);
  try {
    // jonli hodisalar oqimi
    if (url.pathname === '/api/events') {
      const user = core.auth(url.searchParams.get('token'));
      if (!user) return send(res, 401, { error: 'Kirish kerak' });
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write('data: {"type":"hello"}\n\n');
      if (!clients.has(user.id)) clients.set(user.id, new Set());
      clients.get(user.id).add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 25e3);
      req.on('close', () => { clearInterval(ping); clients.get(user.id).delete(res); });
      return;
    }
    // PDF hisobot
    const pm = url.pathname.match(/^\/api\/report\/(\d{4}-\d{2}-\d{2})\.pdf$/);
    if (pm) {
      const user = core.auth(tokenOf(req) || url.searchParams.get('token'));
      if (!user) return send(res, 401, { error: 'Kirish kerak' });
      const a = analysis.dayAnalysis(user, pm[1]);
      const tm = T.addDays(pm[1], 1);
      const buf = report(user, a, { date: tm, items: core.planGet(user, tm).items });
      return send(res, 200, buf, 'application/pdf', { 'Content-Disposition': `inline; filename="isloh-${pm[1]}.pdf"` });
    }
    let body = {};
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      let size = 0;
      for await (const c of req) { size += c.length; if (size > 1e6) return send(res, 413, { error: 'Juda katta' }); chunks.push(c); }
      if (chunks.length) body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    }
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = url.pathname.match(r.rx);
      if (!m) continue;
      const token = tokenOf(req);
      const user = r.open ? null : core.auth(token);
      if (!r.open && !user) return send(res, 401, { error: 'Kirish kerak' });
      const out = await r.fn({ user, m, body, q: url.searchParams, ip, token });
      return send(res, 200, out ?? { ok: true });
    }
    send(res, 404, { error: 'Topilmadi' });
  } catch (e) {
    if (e instanceof ApiError) return send(res, e.status, { error: e.message });
    if (e instanceof SyntaxError) return send(res, 400, { error: "So'rov noto'g'ri" });
    log('xato', req.method, url.pathname, e.stack || e.message);
    send(res, 500, { error: 'Ichki xato' });
  }
});

server.listen(PORT, HOST, () => {
  log(`Isloh ishga tushdi: http://${HOST}:${PORT}  (ma'lumotlar: ${DATA})`);
  if (!bot) log("BOT_TOKEN berilmagan — Telegram bot o'chiq. .env faylini to'ldiring (README).");
  else bot.start();
  scheduler.start();
  feeds.crawl(true).then(n => log(`Podkastlar yangilandi: +${n}`)).catch(e => log('feed', e.message));
  setInterval(() => feeds.crawl().catch(() => {}), 10 * 60e3);
});

module.exports = { server, core, analysis, db };
