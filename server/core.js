'use strict';
/* Isloh — asosiy mantiq: foydalanuvchilar, kirish kodlari, kun rejasi, ishlar, namozlar, uyqu.
   API ham, Telegram bot ham shu funksiyalarni chaqiradi — natija ikkala joyda bir xil bo'ladi. */
const crypto = require('crypto');
const T = require('./time');

class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
const CATS = { ilm: 'Ilm', din: 'Din', ish: 'Ish', sport: "Sog'liq", oila: 'Oila', ovqat: 'Ovqat', boshqa: 'Boshqa' };
const DEFAULT_TEMPLATES = [
  { title: 'Nonushta', start: '07:00', end: '07:30', category: 'ovqat', kind: 'meal' },
  { title: 'Kechki ovqat', start: '19:30', end: '20:00', category: 'ovqat', kind: 'meal' },
];
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

function create(db, bus = { emit() {} }) {
  const now = () => Date.now();

  /* ------------------------------------------------------------ foydalanuvchi */
  const userById = id => db.get('SELECT * FROM users WHERE id=?', id);
  const userByTg = tgId => db.get('SELECT * FROM users WHERE tg_id=?', tgId);
  function publicUser(u) {
    return { id: u.id, name: u.name, tg_name: u.tg_name, username: u.username, phone: u.phone, birth_date: u.birth_date,
      wake: u.wake, sleep: u.sleep, city: u.city, tz: u.tz, notify_lead: u.notify_lead, task_lead: u.task_lead,
      plan_remind: u.plan_remind, prayer_mins: u.prayer_mins, theme: u.theme, onboarded: !!u.onboarded };
  }
  function normPhone(p) {
    p = String(p || '').replace(/[^\d]/g, '');
    return p ? '+' + p : '';
  }
  /* Telegram kontakt orqali ro'yxatdan o'tish yoki mavjud hisobni topish */
  function registerContact(c) {
    const phone = normPhone(c.phone);
    if (!phone) throw new ApiError(400, "Telefon raqam topilmadi");
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
    let u = userByTg(c.tg_id) || db.get('SELECT * FROM users WHERE phone=?', phone);
    if (u) {
      db.run('UPDATE users SET tg_id=?, phone=?, username=?, tg_name=? WHERE id=?', c.tg_id, phone, c.username || '', name, u.id);
    } else {
      const r = db.run('INSERT INTO users (tg_id, phone, username, tg_name, name, created_at) VALUES (?,?,?,?,?,?)',
        c.tg_id, phone, c.username || '', name, c.first_name || name, now());
      for (const t of DEFAULT_TEMPLATES) {
        db.run('INSERT INTO templates (user_id,title,start,end,category,kind,days,active,created_at) VALUES (?,?,?,?,?,?,127,1,?)',
          r.lastInsertRowid, t.title, t.start, t.end, t.category, t.kind, now());
      }
    }
    return userByTg(c.tg_id);
  }

  /* ------------------------------------------------------------ kirish kodlari va sessiyalar */
  function newCode(userId) {
    db.run('DELETE FROM login_codes WHERE user_id=? OR expires_at<?', userId, now());
    let code;
    do { code = String(crypto.randomInt(0, 1e6)).padStart(6, '0'); } while (db.get('SELECT 1 FROM login_codes WHERE code=?', code));
    db.run('INSERT INTO login_codes (code,user_id,expires_at) VALUES (?,?,?)', code, userId, now() + 3 * 60e3);
    return code;
  }
  const fails = new Map();
  function verifyCode(code, ip = '') {
    const f = fails.get(ip) || { n: 0, t: now() };
    if (now() - f.t > 10 * 60e3) { f.n = 0; f.t = now(); }
    if (f.n >= 10) throw new ApiError(429, "Juda ko'p urinish. 10 daqiqadan keyin qayta urinib ko'ring.");
    code = String(code || '').replace(/\D/g, '');
    const row = code.length === 6 ? db.get('SELECT * FROM login_codes WHERE code=? AND expires_at>?', code, now()) : null;
    if (!row) { f.n++; fails.set(ip, f); throw new ApiError(400, "Kod noto'g'ri yoki muddati o'tgan. Botdan yangi kod oling."); }
    db.run('DELETE FROM login_codes WHERE code=?', code);
    return createSession(row.user_id);
  }
  function createSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    db.run('INSERT INTO sessions (token_hash,user_id,created_at,last_seen) VALUES (?,?,?,?)', sha(token), userId, now(), now());
    return { token, user: publicUser(userById(userId)) };
  }
  /* Telegram ichida ochilgan ilova (Mini App): Telegram imzolagan ma'lumot orqali kodsiz kirish */
  function authTelegram(initData, botToken) {
    if (!botToken) throw new ApiError(400, 'Bot ulanmagan');
    const p = new URLSearchParams(String(initData || ''));
    const hash = p.get('hash');
    if (!hash) throw new ApiError(400, "Telegram ma'lumoti yo'q");
    p.delete('hash');
    const check = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calc = crypto.createHmac('sha256', secret).update(check).digest('hex');
    if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) throw new ApiError(401, "Telegram imzosi noto'g'ri");
    if (Date.now() / 1000 - (+p.get('auth_date') || 0) > 86400) throw new ApiError(401, "Telegram ma'lumoti eskirgan — ilovani botdan qayta oching");
    let tgUser;
    try { tgUser = JSON.parse(p.get('user') || '{}'); } catch (e) { tgUser = {}; }
    const u = tgUser.id && userByTg(tgUser.id);
    if (!u) throw new ApiError(404, "Avval botda /start bosib, kontaktingizni yuboring");
    return createSession(u.id);
  }
  function auth(token) {
    if (!token) return null;
    const s = db.get('SELECT * FROM sessions WHERE token_hash=?', sha(token));
    if (!s) return null;
    if (now() - (s.last_seen || 0) > 3600e3) db.run('UPDATE sessions SET last_seen=? WHERE token_hash=?', now(), s.token_hash);
    return userById(s.user_id);
  }
  const registeredChats = () => db.all('SELECT tg_id FROM users WHERE tg_id > 0').map(r => r.tg_id);
  const logout = token => db.run('DELETE FROM sessions WHERE token_hash=?', sha(token || ''));

  function updateMe(u, b) {
    const f = {};
    if ('name' in b) { f.name = str(b.name, 60); if (!f.name) throw new ApiError(400, 'Ismingizni yozing'); }
    if ('birth_date' in b) {
      if (!T.validDate(b.birth_date) || b.birth_date > T.tzNow(u.tz).date || b.birth_date < '1900-01-01') throw new ApiError(400, "Tug'ilgan sana noto'g'ri");
      f.birth_date = b.birth_date;
    }
    for (const k of ['wake', 'sleep', 'plan_remind']) if (k in b) {
      if (!T.validTime(b[k])) throw new ApiError(400, "Vaqt SS:DD ko'rinishida bo'lsin");
      f[k] = b[k];
    }
    if ('city' in b) f.city = str(b.city, 30) || 'toshkent';
    const ints = { notify_lead: [0, 60], task_lead: [0, 30], prayer_mins: [5, 60] };
    for (const [k, [lo, hi]] of Object.entries(ints)) if (k in b) f[k] = Math.max(lo, Math.min(hi, parseInt(b[k], 10) || 0));
    if ('theme' in b) f.theme = b.theme === 'light' ? 'light' : 'dark';
    if ('onboarded' in b) f.onboarded = b.onboarded ? 1 : 0;
    const merged = { ...u, ...f };
    if (T.toMin(merged.wake) === T.toMin(merged.sleep)) throw new ApiError(400, "Uyg'onish va uxlash vaqti bir xil bo'lmasin");
    const keys = Object.keys(f);
    if (keys.length) db.run(`UPDATE users SET ${keys.map(k => k + '=?').join(',')} WHERE id=?`, ...keys.map(k => f[k]), u.id);
    bus.emit(u.id, { type: 'refresh' });
    return publicUser(userById(u.id));
  }

  /* ------------------------------------------------------------ joriy kun */
  /* Yarim tundan keyin ham (uyqugacha) kechagi kun davom etadi */
  function activeDate(u, t = now()) {
    const { date, min } = T.tzNow(u.tz, t);
    const f = T.frame(u);
    const cutoff = f.sleep > 1440 ? Math.min(f.sleep - 1440 + 90, f.wake - 30) : Math.min(180, f.wake - 30);
    return min < Math.max(0, cutoff) ? T.addDays(date, -1) : date;
  }

  /* ------------------------------------------------------------ namoz bloklari */
  function prayerSlots(u, ds) {
    const t = T.prayerTimes(u, ds), base = T.instant(ds, 0, u.tz);
    return T.BLOCKS.map(p => {
      const s = Math.round((t[p] - base) / 60e3), e = s + (u.prayer_mins || 20);
      return { kind: 'prayer', prayer: p, title: `${T.PN[p]} namozi`, start: T.fmtMin(s), end: T.fmtMin(e), s, e, locked: true };
    });
  }
  const span = (u, t) => { const s = T.norm(u, t.start); let e = T.norm(u, t.end); if (e <= s) e += 1440; return { s, e }; };

  function conflictOf(u, ds, s, e, excludeId) {
    for (const p of prayerSlots(u, ds)) if (s < p.e && e > p.s) return `${p.title} vaqti (${p.start}–${p.end}) bilan to'qnashdi. Namoz vaqtida boshqa ish qo'yib bo'lmaydi.`;
    for (const t of db.all('SELECT * FROM tasks WHERE user_id=? AND date=? AND id!=?', u.id, ds, excludeId || 0)) {
      const x = span(u, t);
      if (s < x.e && e > x.s) return `“${t.title}” (${t.start}–${t.end}) bilan ustma-ust tushdi`;
    }
    return null;
  }
  function validate(u, ds, start, end, excludeId) {
    if (!T.validTime(start) || !T.validTime(end)) throw new ApiError(400, "Vaqtni SS:DD ko'rinishida kiriting, masalan 05:30");
    const s = T.norm(u, start), e = T.norm(u, end);
    if (e <= s) throw new ApiError(400, "Tugash vaqti boshlanishdan keyin bo'lsin");
    if (e - s < 5) throw new ApiError(400, "Ish kamida 5 daqiqa bo'lsin");
    const f = T.frame(u);
    if (s < f.wake || e > f.sleep) throw new ApiError(400, `Ish uyg'onish (${u.wake}) va uxlash (${u.sleep}) oralig'ida bo'lsin`);
    const c = conflictOf(u, ds, s, e, excludeId);
    if (c) throw new ApiError(409, c);
    return { s, e };
  }

  /* Takrorlanuvchi ishlarni (shablonlarni) shu kunga qo'yish. Ovqat vaqti namozga to'g'ri kelsa, namozdan keyinga suriladi. */
  function materialize(u, ds) {
    if (ds < activeDate(u)) return;
    const wd = T.weekday(ds);
    const tpls = db.all('SELECT * FROM templates WHERE user_id=? AND active=1 ORDER BY start', u.id);
    for (const t of tpls) {
      if (!(t.days & (1 << wd))) continue;
      if (db.get('SELECT 1 FROM tasks WHERE user_id=? AND date=? AND template_id=?', u.id, ds, t.id)) continue;
      if (db.get('SELECT 1 FROM skipped_tpl WHERE user_id=? AND date=? AND template_id=?', u.id, ds, t.id)) continue;
      let { s, e } = span(u, t);
      if (T.instant(ds, s, u.tz) < (t.created_at || 0)) continue; // shablon yaratilishidan oldingi vaqtga qo'yilmaydi
      if (t.kind === 'meal') {
        for (const p of prayerSlots(u, ds)) if (s < p.e && e > p.s) { const d = e - s; s = p.e; e = s + d; }
      }
      db.run(`INSERT OR IGNORE INTO tasks (user_id,date,title,start,end,category,kind,template_id,status,created_at)
              VALUES (?,?,?,?,?,?,?,?, 'planned', ?)`, u.id, ds, t.title, T.fmtMin(s), T.fmtMin(e), t.category, t.kind, t.id, now());
    }
  }

  function taskRow(u, t) {
    const { s, e } = span(u, t);
    const ps = T.instant(t.date, s, u.tz), pe = T.instant(t.date, e, u.tz);
    const late = t.actual_start ? Math.max(0, Math.round((t.actual_start - ps) / 60e3)) : null;
    const dur = t.actual_start ? Math.round(((t.actual_end || now()) - t.actual_start) / 60e3) : null;
    return { ...t, s, e, planned_start: ps, planned_end: pe, planned_min: e - s, late, actual_min: dur,
      category_name: CATS[t.category] || 'Boshqa', template: !!t.template_id };
  }
  const tasksOf = (u, ds) => db.all('SELECT * FROM tasks WHERE user_id=? AND date=?', u.id, ds).map(t => taskRow(u, t)).sort((a, b) => a.s - b.s);

  function dayRow(u, ds) {
    return db.get('SELECT * FROM days WHERE user_id=? AND date=?', u.id, ds) || { user_id: u.id, date: ds, plan_ready: 0, wake_at: null, sleep_at: null, note: '' };
  }
  function setDay(u, ds, f) {
    const cur = { ...dayRow(u, ds), ...f };
    db.run(`INSERT INTO days (user_id,date,plan_ready,wake_at,sleep_at,note) VALUES (?,?,?,?,?,?)
            ON CONFLICT(user_id,date) DO UPDATE SET plan_ready=excluded.plan_ready, wake_at=excluded.wake_at, sleep_at=excluded.sleep_at, note=excluded.note`,
    u.id, ds, cur.plan_ready, cur.wake_at, cur.sleep_at, cur.note);
    return cur;
  }

  function planGet(u, ds) {
    if (!T.validDate(ds)) throw new ApiError(400, "Sana noto'g'ri");
    materialize(u, ds);
    const tasks = tasksOf(u, ds);
    const slots = prayerSlots(u, ds);
    const f = T.frame(u);
    const items = [...slots, ...tasks].sort((a, b) => a.s - b.s);
    // bo'sh vaqtlar (uyg'onishdan uxlashgacha)
    const busy = items.map(i => [Math.max(i.s, f.wake), Math.min(i.e, f.sleep)]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
    const free = [];
    let cur = f.wake;
    for (const [a, b] of busy) { if (a - cur >= 15) free.push({ start: T.fmtMin(cur), end: T.fmtMin(a), min: a - cur }); cur = Math.max(cur, b); }
    if (f.sleep - cur >= 15) free.push({ start: T.fmtMin(cur), end: T.fmtMin(f.sleep), min: f.sleep - cur });
    const conflicts = tasks.filter(t => slots.some(p => t.s < p.e && t.e > p.s)).map(t => t.id);
    return { date: ds, today: activeDate(u), wake: u.wake, sleep: u.sleep, items, free, conflicts,
      day: dayRow(u, ds), prayers: prayersOf(u, ds), templates: templatesList(u) };
  }

  function daysMask(rep) {
    if (!rep || rep.type === 'once') return 0;
    if (rep.type === 'daily') return 127;
    if (rep.type === 'weekdays') return 0b0111110;
    const m = (rep.days || []).reduce((a, d) => a | (1 << (d % 7)), 0);
    if (!m) throw new ApiError(400, 'Takrorlanadigan kunlarni tanlang');
    return m;
  }
  function taskCreate(u, b) {
    const ds = b.date;
    if (!T.validDate(ds)) throw new ApiError(400, "Sana noto'g'ri");
    if (ds < activeDate(u)) throw new ApiError(403, "O'tgan kunga ish qo'shib bo'lmaydi");
    const title = str(b.title, 120);
    if (!title) throw new ApiError(400, 'Ish nomini yozing');
    const category = CATS[b.category] ? b.category : 'boshqa';
    const kind = category === 'ovqat' ? 'meal' : 'task';
    validate(u, ds, b.start, b.end);
    const mask = daysMask(b.repeat);
    let tplId = null;
    if (mask) {
      tplId = db.run('INSERT INTO templates (user_id,title,start,end,category,kind,days,active,created_at) VALUES (?,?,?,?,?,?,?,1,?)',
        u.id, title, b.start, b.end, category, kind, mask, now()).lastInsertRowid;
    }
    const id = db.run(`INSERT INTO tasks (user_id,date,title,start,end,category,kind,template_id,status,note,created_at)
      VALUES (?,?,?,?,?,?,?,?, 'planned', ?, ?)`, u.id, ds, title, b.start, b.end, category, kind, tplId, str(b.note, 500), now()).lastInsertRowid;
    bus.emit(u.id, { type: 'refresh' });
    return taskRow(u, getTask(u, id));
  }
  function getTask(u, id) {
    const t = db.get('SELECT * FROM tasks WHERE id=? AND user_id=?', id, u.id);
    if (!t) throw new ApiError(404, 'Ish topilmadi');
    return t;
  }
  function taskUpdate(u, id, b) {
    const t = getTask(u, id);
    const f = {};
    if ('title' in b) { f.title = str(b.title, 120); if (!f.title) throw new ApiError(400, 'Ish nomini yozing'); }
    if ('category' in b) f.category = CATS[b.category] ? b.category : 'boshqa';
    if ('note' in b) f.note = str(b.note, 500);
    if ('start' in b || 'end' in b) {
      if (t.status !== 'planned') throw new ApiError(400, "Boshlangan ishning vaqtini o'zgartirib bo'lmaydi");
      if (t.date < activeDate(u)) throw new ApiError(403, "O'tgan kunni o'zgartirib bo'lmaydi");
      f.start = b.start ?? t.start; f.end = b.end ?? t.end;
      validate(u, t.date, f.start, f.end, id);
    }
    const keys = Object.keys(f);
    if (keys.length) db.run(`UPDATE tasks SET ${keys.map(k => k + '=?').join(',')} WHERE id=?`, ...keys.map(k => f[k]), id);
    bus.emit(u.id, { type: 'refresh' });
    return taskRow(u, getTask(u, id));
  }
  function taskDelete(u, id) {
    const t = getTask(u, id);
    if (t.date < activeDate(u)) throw new ApiError(403, "O'tgan kun tarixini o'chirib bo'lmaydi");
    if (t.status !== 'planned') throw new ApiError(400, "Boshlangan yoki tugagan ishni o'chirib bo'lmaydi");
    if (t.template_id) db.run('INSERT OR IGNORE INTO skipped_tpl (user_id,date,template_id) VALUES (?,?,?)', u.id, t.date, t.template_id);
    db.run('DELETE FROM tasks WHERE id=?', id);
    bus.emit(u.id, { type: 'refresh' });
    return { ok: true };
  }
  function taskStart(u, id) {
    const t = getTask(u, id);
    if (t.status === 'active') return taskRow(u, t);
    if (t.status !== 'planned') throw new ApiError(400, t.status === 'done' ? 'Bu ish allaqachon tugagan' : "Bu ish o'tkazib yuborilgan");
    if (t.date !== activeDate(u)) throw new ApiError(400, "Faqat bugungi ishni boshlash mumkin");
    for (const a of db.all("SELECT * FROM tasks WHERE user_id=? AND status='active' AND id!=?", u.id, id)) {
      db.run("UPDATE tasks SET status='done', actual_end=? WHERE id=?", now(), a.id); // oldingi ish avtomatik tugaydi
    }
    db.run("UPDATE tasks SET status='active', actual_start=? WHERE id=?", now(), id);
    bus.emit(u.id, { type: 'refresh' });
    return taskRow(u, getTask(u, id));
  }
  function taskFinish(u, id) {
    const t = getTask(u, id);
    if (t.status === 'done') return taskRow(u, t);
    if (t.status !== 'active') throw new ApiError(400, 'Avval ishni boshlang');
    db.run("UPDATE tasks SET status='done', actual_end=? WHERE id=?", now(), id);
    bus.emit(u.id, { type: 'refresh' });
    return taskRow(u, getTask(u, id));
  }
  function taskRate(u, id, rating, note) {
    const t = getTask(u, id);
    if (t.status !== 'done') throw new ApiError(400, 'Avval ishni tugating');
    const r = Math.max(1, Math.min(5, parseInt(rating, 10) || 0));
    db.run('UPDATE tasks SET rating=?, note=CASE WHEN ?<>\'\' THEN ? ELSE note END WHERE id=?', r, str(note, 500), str(note, 500), id);
    bus.emit(u.id, { type: 'refresh' });
    return taskRow(u, getTask(u, id));
  }
  function planReady(u, ds, ready) {
    if (!T.validDate(ds)) throw new ApiError(400, "Sana noto'g'ri");
    setDay(u, ds, { plan_ready: ready ? 1 : 0 });
    bus.emit(u.id, { type: 'refresh' });
    return dayRow(u, ds);
  }

  /* ------------------------------------------------------------ shablonlar */
  function templatesList(u) {
    return db.all('SELECT * FROM templates WHERE user_id=? ORDER BY active DESC, start', u.id)
      .map(t => ({ ...t, category_name: CATS[t.category] || 'Boshqa', days_list: [0, 1, 2, 3, 4, 5, 6].filter(d => t.days & (1 << d)) }));
  }
  function templateUpdate(u, id, b) {
    const t = db.get('SELECT * FROM templates WHERE id=? AND user_id=?', id, u.id);
    if (!t) throw new ApiError(404, 'Topilmadi');
    const f = {};
    if ('active' in b) f.active = b.active ? 1 : 0;
    if ('title' in b) { f.title = str(b.title, 120); if (!f.title) throw new ApiError(400, 'Nomini yozing'); }
    if ('start' in b || 'end' in b) {
      f.start = b.start ?? t.start; f.end = b.end ?? t.end;
      if (!T.validTime(f.start) || !T.validTime(f.end)) throw new ApiError(400, "Vaqt noto'g'ri");
    }
    if ('days' in b) f.days = daysMask({ type: 'days', days: b.days });
    const keys = Object.keys(f);
    if (keys.length) db.run(`UPDATE templates SET ${keys.map(k => k + '=?').join(',')} WHERE id=?`, ...keys.map(k => f[k]), id);
    // hali boshlanmagan kelajakdagi nusxalarni yangilash
    const today = activeDate(u);
    if (f.active === 0) db.run("DELETE FROM tasks WHERE user_id=? AND template_id=? AND status='planned' AND date>?", u.id, id, today);
    if (f.start || f.title) db.run("DELETE FROM tasks WHERE user_id=? AND template_id=? AND status='planned' AND date>?", u.id, id, today);
    bus.emit(u.id, { type: 'refresh' });
    return templatesList(u);
  }
  function templateDelete(u, id) {
    db.run("DELETE FROM tasks WHERE user_id=? AND template_id=? AND status='planned' AND date>?", u.id, id, activeDate(u));
    db.run('DELETE FROM templates WHERE id=? AND user_id=?', id, u.id);
    bus.emit(u.id, { type: 'refresh' });
    return templatesList(u);
  }

  /* ------------------------------------------------------------ namozlar */
  function prayersOf(u, ds) {
    return Object.fromEntries(db.all('SELECT prayer,status,marked_at FROM prayers WHERE user_id=? AND date=?', u.id, ds).map(r => [r.prayer, r.status]));
  }
  function prayerMark(u, ds, p) {
    if (!T.BLOCKS.includes(p)) throw new ApiError(400, "Namoz noto'g'ri");
    const w = T.prayerWindows(u, ds)[p];
    const cur = db.get('SELECT * FROM prayers WHERE user_id=? AND date=? AND prayer=?', u.id, ds, p);
    if (cur) return { prayer: p, status: cur.status, already: true };
    if (now() < w[0]) throw new ApiError(400, `${T.PN[p]} vaqti hali kirmagan (${T.hhmmAt(w[0], u.tz)})`);
    if (now() >= w[1]) {
      db.run("INSERT OR IGNORE INTO prayers (user_id,date,prayer,status,marked_at) VALUES (?,?,?, 'qazo', ?)", u.id, ds, p, now());
      throw new ApiError(400, `${T.PN[p]} vaqti o'tib ketgan — qazo deb belgilandi`);
    }
    db.run("INSERT INTO prayers (user_id,date,prayer,status,marked_at) VALUES (?,?,?, 'vaqtida', ?)", u.id, ds, p, now());
    bus.emit(u.id, { type: 'refresh' });
    return { prayer: p, status: 'vaqtida' };
  }
  function prayerAutoQazo(u, ds, p) {
    const r = db.run("INSERT OR IGNORE INTO prayers (user_id,date,prayer,status,marked_at) VALUES (?,?,?, 'qazo', ?)", u.id, ds, p, now());
    if (r.changes) bus.emit(u.id, { type: 'refresh' });
    return r.changes > 0;
  }

  /* ------------------------------------------------------------ uyg'onish va uxlash */
  function wake(u, ds = activeDate(u)) {
    const d = dayRow(u, ds);
    if (!d.wake_at) setDay(u, ds, { wake_at: now() });
    bus.emit(u.id, { type: 'refresh' });
    return dayRow(u, ds);
  }
  function sleep(u, ds = activeDate(u)) {
    const d = dayRow(u, ds);
    if (!d.sleep_at) {
      // tugatilmagan ishlar avtomatik yopiladi
      for (const a of db.all("SELECT * FROM tasks WHERE user_id=? AND date=? AND status='active'", u.id, ds)) db.run("UPDATE tasks SET status='done', actual_end=? WHERE id=?", now(), a.id);
      setDay(u, ds, { sleep_at: now() });
    }
    bus.emit(u.id, { type: 'refresh' });
    return dayRow(u, ds);
  }

  /* ------------------------------------------------------------ bosh sahifa */
  function home(u) {
    const ds = activeDate(u);
    materialize(u, ds);
    const tasks = tasksOf(u, ds).filter(t => t.kind === 'task');
    const n = now();
    const current = tasks.find(t => t.status === 'active') || tasks.find(t => t.status === 'planned' && t.planned_start <= n && n < t.planned_end) || null;
    const next = tasks.find(t => t.status === 'planned' && t.planned_start > n) || null;
    const wins = T.prayerWindows(u, ds), tw = T.prayerWindows(u, T.addDays(ds, 1));
    const times = T.prayerTimes(u, ds);
    return { date: ds, user: publicUser(u), prayers: prayersOf(u, ds), times, windows: wins, next_bomdod: tw.bomdod[0], current, next, day: dayRow(u, ds) };
  }

  return { ApiError, CATS, userById, userByTg, publicUser, registerContact, newCode, verifyCode, createSession, authTelegram, registeredChats, auth, logout, updateMe,
    activeDate, prayerSlots, planGet, taskCreate, taskUpdate, taskDelete, taskStart, taskFinish, taskRate, getTask, taskRow, tasksOf,
    planReady, templatesList, templateUpdate, templateDelete, prayersOf, prayerMark, prayerAutoQazo, wake, sleep, dayRow, setDay,
    materialize, home, span };
}

module.exports = { create, ApiError, CATS };
