'use strict';
/* Kun tahlili algoritmi.

   Har bir ish uchun 3 ko'rsatkich (0..1):
     P — o'z vaqtida boshlash:  1 - kechikish / rejadagi davomiylik
     C — bajarilish:            haqiqiy davomiylik / rejadagi davomiylik (1 dan oshmaydi)
     Q — sifat (o'z bahosi):    baho / 5 (baho berilmasa 0.6)
   Ish balli = 0.3·P + 0.4·C + 0.3·Q. Boshlanmagan (o'tkazib yuborilgan) ish = 0.

   Kun balli = 0.60 · ishlar (davomiylik bo'yicha o'rtacha)
             + 0.25 · namozlar (vaqtida o'qilganlar ulushi)
             + 0.15 · uyqu intizomi (uyg'onish va uxlash kechikishi, 60 daqiqada 0 ga tushadi)
   Rang: ≥80% yashil, 50–79% sariq, <50% yoki reja yo'q — qizil. */
const T = require('./time');

const clamp = x => Math.max(0, Math.min(1, x));
const LEVEL_NAMES = { 0: "Ma'lumot yo'q", 1: 'Qizil', 2: 'Sariq', 3: 'Yashil', 4: "To'q yashil" };

function create(db, core) {
  function taskMetrics(t, nowTs) {
    const due = t.planned_end <= nowTs || t.status !== 'planned';
    let status = t.status;
    if (status === 'planned' && t.planned_end + 30 * 60e3 <= nowTs) status = 'missed';
    const m = { id: t.id, title: t.title, category: t.category, category_name: t.category_name, start: t.start, end: t.end,
      planned_min: t.planned_min, status, late: t.late, actual_min: t.actual_min, rating: t.rating, note: t.note,
      actual_start: t.actual_start, actual_end: t.actual_end, planned_start: t.planned_start, planned_end: t.planned_end, due };
    if (status === 'missed') Object.assign(m, { P: 0, C: 0, Q: 0, score: 0 });
    else if (t.actual_start) {
      const P = clamp(1 - (t.late || 0) / Math.max(1, t.planned_min));
      const C = clamp((t.actual_min || 0) / Math.max(1, t.planned_min));
      const Q = t.rating ? t.rating / 5 : 0.6;
      Object.assign(m, { P, C, Q, score: 0.3 * P + 0.4 * C + 0.3 * Q });
    } else m.score = null;
    return m;
  }

  /* Sof hisob: ma'lumotlar oldindan yuklangan bo'ladi (profil uchun yuzlab kunni tez hisoblash) */
  function analyze(u, ds, tasks, prayers, day, prevDay, nowTs, today) {
    const isPast = ds < today, isFuture = ds > today;
    const work = tasks.filter(t => t.kind === 'task').map(t => taskMetrics(t, isPast ? Infinity : nowTs));
    const meals = tasks.filter(t => t.kind !== 'task');
    const due = work.filter(m => m.status === 'missed' || m.score !== null);
    const sumW = due.reduce((a, m) => a + m.planned_min, 0);
    let tasksScore = sumW ? due.reduce((a, m) => a + (m.score || 0) * m.planned_min, 0) / sumW : null;
    if (isPast && !work.length) tasksScore = 0; // reja tuzilmagan kun

    // namozlar
    const wins = T.prayerWindows(u, ds);
    const pr = {};
    let pCount = 0, pOk = 0;
    for (const p of T.BLOCKS) {
      let st = prayers[p] || null;
      const ended = (isPast ? Infinity : nowTs) >= wins[p][1];
      if (!st && ended && !isFuture && wins[p][1] > (u.created_at || 0)) st = 'qazo'; // ro'yxatdan oldingi namozlar hisoblanmaydi
      pr[p] = { status: st, start: T.hhmmAt(wins[p][0], u.tz), end: T.hhmmAt(wins[p][1], u.tz) };
      if (st) { pCount++; if (st === 'vaqtida') pOk++; }
    }
    const prayerScore = pCount ? pOk / pCount : null;

    // uyqu
    const f = T.frame(u);
    const wakePlan = T.instant(ds, f.wake, u.tz), sleepPlan = T.instant(ds, f.sleep, u.tz);
    const wakeLate = day.wake_at ? Math.round((day.wake_at - wakePlan) / 60e3) : null;
    const sleepLate = day.sleep_at ? Math.round((day.sleep_at - sleepPlan) / 60e3) : null;
    const sleepHours = prevDay && prevDay.sleep_at && day.wake_at && day.wake_at > prevDay.sleep_at ? (day.wake_at - prevDay.sleep_at) / 3600e3 : null;
    const parts = [];
    if (wakeLate !== null) parts.push(clamp(1 - Math.max(0, wakeLate) / 60));
    else if (isPast || nowTs > wakePlan + 3600e3) parts.push(0);
    if (sleepLate !== null) parts.push(clamp(1 - Math.max(0, sleepLate) / 60));
    else if (isPast) parts.push(0);
    const sleepScore = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;

    const comps = [[tasksScore, 0.6], [prayerScore, 0.25], [sleepScore, 0.15]].filter(([v]) => v !== null);
    const wsum = comps.reduce((a, [, w]) => a + w, 0);
    const score = wsum ? comps.reduce((a, [v, w]) => a + v * w, 0) / wsum : null;
    const level = score === null ? 0 : score >= 0.95 ? 4 : score >= 0.8 ? 3 : score >= 0.5 ? 2 : 1;

    const done = work.filter(m => m.status === 'done');
    const started = work.filter(m => m.actual_start);
    const lateOnes = started.filter(m => m.late > 5);
    const rated = done.filter(m => m.rating);
    const stats = {
      planned: work.length, done: done.length, missed: work.filter(m => m.status === 'missed').length,
      active: work.filter(m => m.status === 'active').length,
      planned_min: work.reduce((a, m) => a + m.planned_min, 0),
      actual_min: started.reduce((a, m) => a + (m.actual_min || 0), 0),
      late_count: lateOnes.length,
      late_avg: started.length ? Math.round(started.reduce((a, m) => a + (m.late || 0), 0) / started.length) : null,
      rating_avg: rated.length ? rated.reduce((a, m) => a + m.rating, 0) / rated.length : null,
      prayers_ok: pOk, prayers_counted: pCount,
    };

    // xulosalar
    const ins = [];
    if (isPast && !work.length) ins.push({ kind: 'bad', text: 'Bu kun uchun reja tuzilmagan.' });
    if (stats.missed) ins.push({ kind: 'bad', text: `${stats.missed} ta ish umuman boshlanmadi: ${work.filter(m => m.status === 'missed').map(m => m.title).slice(0, 3).join(', ')}.` });
    if (lateOnes.length) {
      const worst = lateOnes.reduce((a, b) => (b.late > a.late ? b : a));
      ins.push({ kind: 'bad', text: `${lateOnes.length} ta ish kech boshlandi. Eng ko'p — “${worst.title}”: ${worst.late} daqiqa.` });
    } else if (started.length) ins.push({ kind: 'good', text: "Barcha ishlar o'z vaqtida boshlandi." });
    const diff = stats.actual_min - due.reduce((a, m) => a + m.planned_min, 0);
    if (started.length && Math.abs(diff) >= 15) ins.push({ kind: diff < 0 ? 'bad' : 'good', text: diff < 0 ? `Rejadagidan ${-diff} daqiqa kam ishladingiz.` : `Rejadagidan ${diff} daqiqa ko'p ishladingiz.` });
    const best = rated.length ? rated.reduce((a, b) => (b.rating > a.rating ? b : a)) : null;
    if (best && best.rating >= 4) ins.push({ kind: 'good', text: `Eng yaxshi o'tgan ish: “${best.title}” (${best.rating}/5).` });
    const worstR = rated.length ? rated.reduce((a, b) => (b.rating < a.rating ? b : a)) : null;
    if (worstR && worstR.rating <= 2) ins.push({ kind: 'bad', text: `“${worstR.title}” yomon o'tdi (${worstR.rating}/5) — sababini o'ylab ko'ring.` });
    const qazo = T.BLOCKS.filter(p => pr[p].status === 'qazo');
    if (qazo.length) ins.push({ kind: 'bad', text: `Qazo bo'lgan namozlar: ${qazo.map(p => T.PN[p]).join(', ')}.` });
    else if (pCount === 5) ins.push({ kind: 'good', text: "Besh vaqt namozning hammasi o'z vaqtida o'qildi." });
    if (wakeLate !== null && wakeLate > 10) ins.push({ kind: 'bad', text: `${wakeLate} daqiqa kech turdingiz (reja: ${u.wake}).` });
    if (wakeLate !== null && wakeLate <= 5) ins.push({ kind: 'good', text: `O'z vaqtida turdingiz (${T.hhmmAt(day.wake_at, u.tz)}).` });
    if (sleepLate !== null && sleepLate > 15) ins.push({ kind: 'bad', text: `${sleepLate} daqiqa kech uxladingiz (reja: ${u.sleep}).` });
    if (sleepHours !== null && sleepHours < 6) ins.push({ kind: 'bad', text: `Uyqu ${sleepHours.toFixed(1)} soat — kam. 7 soat atrofida uxlashga harakat qiling.` });

    return {
      date: ds, title: T.fmtDay(ds), is_past: isPast, is_today: ds === today, score, level, level_name: LEVEL_NAMES[level],
      components: { tasks: tasksScore, prayers: prayerScore, sleep: sleepScore },
      tasks: work, meals: meals.map(m => ({ title: m.title, start: m.start, end: m.end })), prayers: pr, stats,
      sleep: { wake_plan: u.wake, sleep_plan: u.sleep, wake_at: day.wake_at, sleep_at: day.sleep_at,
        wake_actual: day.wake_at ? T.hhmmAt(day.wake_at, u.tz) : null, sleep_actual: day.sleep_at ? T.hhmmAt(day.sleep_at, u.tz) : null,
        wake_late: wakeLate, sleep_late: sleepLate, hours: sleepHours },
      note: day.note || '', insights: ins,
    };
  }

  function dayAnalysis(u, ds, nowTs = Date.now()) {
    const today = core.activeDate(u, nowTs);
    if (ds >= today) core.materialize(u, ds);
    return analyze(u, ds, core.tasksOf(u, ds), core.prayersOf(u, ds), core.dayRow(u, ds), core.dayRow(u, T.addDays(ds, -1)), nowTs, today);
  }

  /* Bir nechta kunni bitta so'rovda yuklab hisoblash */
  function bulk(u, from, to, nowTs = Date.now()) {
    const today = core.activeDate(u, nowTs);
    const tasks = {}, prayers = {}, days = {};
    for (const t of db.all('SELECT * FROM tasks WHERE user_id=? AND date>=? AND date<=?', u.id, from, to)) (tasks[t.date] = tasks[t.date] || []).push(core.taskRow(u, t));
    for (const p of db.all('SELECT * FROM prayers WHERE user_id=? AND date>=? AND date<=?', u.id, from, to)) (prayers[p.date] = prayers[p.date] || {})[p.prayer] = p.status;
    for (const d of db.all('SELECT * FROM days WHERE user_id=? AND date>=? AND date<=?', u.id, T.addDays(from, -1), to)) days[d.date] = d;
    const empty = ds => ({ date: ds, plan_ready: 0, wake_at: null, sleep_at: null, note: '' });
    const start = core.activeDate(u, u.created_at || nowTs);
    const out = [];
    for (let ds = from; ds <= to; ds = T.addDays(ds, 1)) {
      if (ds < start || ds > today) { out.push({ date: ds, level: null, score: null }); continue; }
      const list = (tasks[ds] || []).sort((a, b) => a.s - b.s);
      out.push(analyze(u, ds, list, prayers[ds] || {}, days[ds] || empty(ds), days[T.addDays(ds, -1)] || null, nowTs, today));
    }
    return out;
  }

  const MONTH_RX = T.MONTHS.map((m, i) => [m, i + 1]);
  function history(u, q = '', limit = 20, offset = 0) {
    const today = core.activeDate(u);
    const start = core.activeDate(u, u.created_at || Date.now());
    let dates = [];
    q = String(q || '').trim().toLowerCase();
    const all = [];
    for (let ds = today; ds >= start; ds = T.addDays(ds, -1)) all.push(ds);
    if (!q) dates = all;
    else {
      let m;
      if ((m = q.match(/^(\d{4})-(\d{2})-(\d{2})$/))) dates = all.filter(d => d === q);
      else if ((m = q.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/))) {
        const dd = m[1].padStart(2, '0'), mm = m[2].padStart(2, '0'), yy = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : null;
        dates = all.filter(d => d.slice(8) === dd && d.slice(5, 7) === mm && (!yy || d.slice(0, 4) === yy));
      } else {
        const mon = MONTH_RX.find(([name]) => q.startsWith(name.slice(0, 3)) && name.startsWith(q.split(' ')[0]));
        const like = `%${q}%`;
        const hits = new Set(db.all('SELECT DISTINCT date FROM tasks WHERE user_id=? AND (lower(title) LIKE ? OR lower(note) LIKE ?)', u.id, like, like).map(r => r.date));
        for (const r of db.all('SELECT date FROM days WHERE user_id=? AND lower(note) LIKE ?', u.id, like)) hits.add(r.date);
        dates = all.filter(d => hits.has(d) || (mon && +d.slice(5, 7) === mon[1]) || T.fmtDay(d).toLowerCase().includes(q));
      }
    }
    const page = dates.slice(offset, offset + limit);
    const items = page.map(ds => {
      const a = dayAnalysis(u, ds);
      return { date: ds, title: a.title, is_today: a.is_today, score: a.score, level: a.level, level_name: a.level_name, stats: a.stats,
        prayers: Object.fromEntries(T.BLOCKS.map(p => [p, a.prayers[p].status])), sleep: a.sleep, top: a.tasks.slice(0, 4).map(t => ({ title: t.title, status: t.status })) };
    });
    return { total: dates.length, offset, items };
  }

  function trends(u, n = 30) {
    const today = core.activeDate(u);
    return bulk(u, T.addDays(today, -(n - 1)), today).map(a => ({
      date: a.date, score: a.score, level: a.level,
      done: a.stats ? a.stats.done : null, planned: a.stats ? a.stats.planned : null,
      late_avg: a.stats ? a.stats.late_avg : null, prayers: a.stats ? a.stats.prayers_ok : null, prayers_counted: a.stats ? a.stats.prayers_counted : null,
      sleep_hours: a.sleep ? a.sleep.hours : null, actual_min: a.stats ? a.stats.actual_min : null,
    }));
  }

  function profile(u) {
    const today = core.activeDate(u);
    let from = T.addDays(today, -370);
    from = T.addDays(from, -((T.weekday(from) + 6) % 7)); // dushanbadan
    const list = bulk(u, from, today);
    const cells = list.map(a => ({ date: a.date, level: a.level, score: a.score, live: a.date === today }));
    const pcells = list.map(a => {
      if (a.level === null || !a.prayers) return { date: a.date, level: null };
      const ok = a.stats.prayers_ok, cnt = a.stats.prayers_counted;
      return { date: a.date, level: cnt === 0 ? 0 : ok === 5 ? 4 : ok >= 3 ? 2 : 1, ok, cnt };
    });
    const closed = list.filter(a => a.level !== null && a.date < today);
    let streak = 0, best = 0;
    for (const a of closed) { if (a.level >= 3) { streak++; best = Math.max(best, streak); } else streak = 0; }
    const last30 = closed.slice(-30);
    const sum = (arr, f) => arr.reduce((x, a) => x + (f(a) || 0), 0);
    const pc = sum(last30, a => a.stats.prayers_counted), po = sum(last30, a => a.stats.prayers_ok);
    const sl = last30.filter(a => a.sleep.hours);
    return {
      today, start: from, cells, prayer_cells: pcells,
      stats: {
        streak, best, days: closed.length,
        avg30: last30.length ? sum(last30, a => a.score) / last30.length : null,
        green30: last30.filter(a => a.level >= 3).length, yellow30: last30.filter(a => a.level === 2).length, red30: last30.filter(a => a.level === 1).length,
        prayers30: pc ? po / pc : null, qazo30: pc - po,
        sleep_avg: sl.length ? sum(sl, a => a.sleep.hours) / sl.length : null,
        done30: sum(last30, a => a.stats.done), hours30: sum(last30, a => a.stats.actual_min) / 60,
      },
    };
  }

  return { dayAnalysis, history, trends, profile, bulk, taskMetrics, LEVEL_NAMES };
}

module.exports = { create, LEVEL_NAMES };
