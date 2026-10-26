'use strict';
/* Isloh yadrosi: baza, mantiq, Telegram bot, eslatmalar jadvali va podkastlar — hammasi desktop dastur ichida ishlaydi.
   Hech qanday veb-server yoki port ochilmaydi: interfeys bu modul bilan to'g'ridan-to'g'ri (IPC orqali) gaplashadi. */
const fs = require('fs');
const Prayer = require('./prayer');

function loadEnv(file) {
  const env = {};
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (e) { /* fayl yo'q — standart qiymatlar */ }
  return env;
}

function create({ dataDir, envFile, log = console.log, onEvent = () => {} }) {
  const env = loadEnv(envFile);
  const BOT_TOKEN = env.BOT_TOKEN || '';
  const BOT_USERNAME = env.BOT_USERNAME || 'islohuzbot';

  const db = require('./db').open(dataDir);
  const bus = { emit: (userId, ev) => onEvent({ userId, ...ev }) };
  const core = require('./core').create(db, bus);
  const analysis = require('./analysis').create(db, core);
  const { report } = require('./pdf');
  const feeds = require('./feeds').create(db, log);
  const bot = BOT_TOKEN ? require('./bot').create({ token: BOT_TOKEN, core, analysis, reportPdf: report, username: BOT_USERNAME, log }) : null;
  const scheduler = require('./scheduler').create({ db, core, bot, bus, log });
  const { ApiError } = core;

  /* ------------------------------------------------------------ amallar */
  const routes = [];
  const route = (method, pattern, fn, open = false) => routes.push({ method, rx: new RegExp('^' + pattern + '$'), fn, open });
  const int = v => parseInt(v, 10);

  route('GET', '/api/config', () => ({ bot_username: BOT_USERNAME, bot_ready: !!bot, cities: Prayer.CITIES.map(c => ({ id: c.id, name: c.name })) }), true);
  route('POST', '/api/auth/verify', ({ body }) => core.verifyCode(body.code, 'desktop'), true);
  route('POST', '/api/auth/logout', ({ token }) => { core.logout(token); return { ok: true }; });
  route('GET', '/api/me', ({ user }) => core.publicUser(user));
  route('PUT', '/api/me', ({ user, body }) => core.updateMe(user, body));
  route('GET', '/api/home', ({ user }) => core.home(user));
  route('POST', '/api/prayers', ({ user, body }) => core.prayerMark(user, body.date || core.activeDate(user), body.prayer));
  route('GET', '/api/plan', ({ user, q }) => core.planGet(user, q.get('date') || core.activeDate(user)));
  route('GET', '/api/plan/month', ({ user, q }) => core.planMonth(user, q.get('m')));
  route('POST', '/api/tasks', ({ user, body }) => core.taskCreate(user, body));
  route('PATCH', '/api/tasks/(\\d+)', ({ user, m, body }) => core.taskUpdate(user, int(m[1]), body));
  route('DELETE', '/api/tasks/(\\d+)', ({ user, m }) => core.taskDelete(user, int(m[1])));
  route('POST', '/api/tasks/(\\d+)/start', ({ user, m }) => core.taskStart(user, int(m[1])));
  route('POST', '/api/tasks/(\\d+)/finish', ({ user, m }) => core.taskFinish(user, int(m[1])));
  route('POST', '/api/tasks/(\\d+)/rate', ({ user, m, body }) => core.taskRate(user, int(m[1]), body.rating, body.note));
  route('POST', '/api/wake', ({ user, body }) => core.wake(user, body.date || core.activeDate(user)));
  route('POST', '/api/sleep', ({ user, body }) => core.sleep(user, body.date || core.activeDate(user)));
  route('GET', '/api/reminders', ({ user }) => core.reminders(user));
  route('POST', '/api/reminders', ({ user, body }) => core.reminderCreate(user, body));
  route('PATCH', '/api/reminders/(\\d+)', ({ user, m, body }) => core.reminderUpdate(user, int(m[1]), body));
  route('DELETE', '/api/reminders/(\\d+)', ({ user, m }) => core.reminderDelete(user, int(m[1])));
  route('DELETE', '/api/reminders', ({ user }) => core.remindersClear(user));
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

  /* Interfeysdan kelgan so'rov: { status, data } yoki { status, error } qaytaradi */
  async function handle(method, path, body, token) {
    try {
      const url = new URL(path, 'isloh://app');
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = url.pathname.match(r.rx);
        if (!m) continue;
        const user = r.open ? null : core.auth(token);
        if (!r.open && !user) return { status: 401, error: 'Kirish kerak' };
        const data = await r.fn({ user, m, body: body || {}, q: url.searchParams, token });
        return { status: 200, data: JSON.parse(JSON.stringify(data ?? { ok: true })) };
      }
      return { status: 404, error: 'Topilmadi' };
    } catch (e) {
      if (e instanceof ApiError) return { status: e.status, error: e.message };
      log('xato', method, path, e.stack || e.message);
      return { status: 500, error: 'Ichki xato' };
    }
  }

  let feedTimer = null;
  function start() {
    log(`Isloh ishga tushdi (ma'lumotlar: ${dataDir})`);
    if (bot) bot.start(); else log("BOT_TOKEN berilmagan — Telegram bot o'chiq.");
    scheduler.start();
    feeds.crawl(true).then(n => log(`Podkastlar yangilandi: +${n}`)).catch(e => log('feed', e.message));
    feedTimer = setInterval(() => feeds.crawl().catch(() => {}), 10 * 60e3);
  }
  function stop() {
    if (bot) bot.stop();
    scheduler.stop();
    clearInterval(feedTimer);
  }

  return { handle, start, stop, db, core, botReady: !!bot };
}

module.exports = { create, loadEnv };
