'use strict';
/* Eslatmalar va avtomatik holatlar jadvali — har 20 soniyada tekshiriladi.
   Har bir hodisa bir marta yuboriladi ("sent" jadvali), server qayta ishga tushsa ham takrorlanmaydi.
   Holatlar (qazo, o'tkazib yuborilgan ish) server o'chiq bo'lgan bo'lsa ham keyin to'g'ri qo'yiladi,
   lekin 15 daqiqadan eski xabarlar endi yuborilmaydi. */
const T = require('./time');
const { esc } = require('./bot');

const FRESH = 15 * 60e3;

function create({ db, core, bot, bus, log = console.log }) {
  const isSent = (uid, key) => !!db.get('SELECT 1 FROM sent WHERE user_id=? AND key=?', uid, key);
  const markSent = (uid, key) => db.run('INSERT OR IGNORE INTO sent (user_id,key,at) VALUES (?,?,?)', uid, key, Date.now());

  /* Uxlagandan keyin uyg'onguncha bezovta qilinmaydi */
  function quiet(u, ts) {
    const ad = core.activeDate(u, ts);
    for (const ds of [T.addDays(ad, -1), ad]) {
      const d = core.dayRow(u, ds);
      if (d.sleep_at && ts >= d.sleep_at) {
        const next = T.addDays(ds, 1), nd = core.dayRow(u, next);
        const until = nd.wake_at || T.instant(next, T.frame(u).wake, u.tz);
        if (ts < until) return true;
      }
    }
    return false;
  }

  async function deliver(u, msg) {
    const plain = msg.text.replace(/<[^>]+>/g, '');
    const [title, ...rest] = plain.split('\n');
    bus.emit(u.id, { type: 'notify', title, body: rest.join(' ').trim(), sound: !!msg.sound });
    if (bot && u.tg_id > 0) await bot.send(u.tg_id, msg.text, msg.rows);
  }

  function eventsFor(u, now) {
    const ev = [];
    const today = core.activeDate(u, now);
    const lead = u.notify_lead;
    // --- namozlar (kecha va bugun)
    for (const ds of [T.addDays(today, -1), today]) {
      const wins = T.prayerWindows(u, ds), marked = core.prayersOf(u, ds);
      for (const p of T.BLOCKS) {
        if (marked[p]) continue;
        const [s, e] = wins[p], P = T.PN[p];
        const btn = [[{ text: "✅ O'qidim", callback_data: `pr:${ds}:${p}` }]];
        if (lead > 0) ev.push({ key: `p:${ds}:${p}:pre`, at: s - lead * 60e3, msg: { text: `🕌 <b>${P}</b> namoziga ${lead} daqiqa qoldi\n🕐 Vaqti: ${T.hhmmAt(s, u.tz)}` } });
        ev.push({ key: `p:${ds}:${p}:at`, at: s, allowQuiet: p === 'bomdod', msg: { text: `🕌 <b>${P}</b> vaqti kirdi — ${T.hhmmAt(s, u.tz)}\nVaqt tugashi: ${T.hhmmAt(e, u.tz)}`, rows: btn, sound: true } });
        if (e - s > 45 * 60e3) ev.push({ key: `p:${ds}:${p}:warn`, at: e - 15 * 60e3, msg: { text: `⚠️ <b>${P}</b> vaqti tugashiga 15 daqiqa qoldi!\nO'qigan bo'lsangiz, belgilang.`, rows: btn, sound: true } });
        ev.push({ key: `p:${ds}:${p}:qazo`, at: e, act: () => core.prayerAutoQazo(u, ds, p), msg: { text: `❗ <b>${P}</b> namozi belgilanmadi — qazo deb hisoblandi.` } });
      }
    }
    // --- ishlar
    for (const ds of [T.addDays(today, -1), today]) {
      for (const t of core.tasksOf(u, ds)) {
        if (t.kind !== 'task') continue;
        if (t.status === 'planned') {
          if (ds === today) ev.push({ key: `t:${t.id}:pre`, at: t.planned_start - (u.task_lead || 0) * 60e3,
            msg: { text: `⏰ ${u.task_lead ? `${u.task_lead} daqiqadan keyin` : 'Hozir'}: <b>${esc(t.title)}</b>\n🕐 ${t.start}–${t.end}\n\nBoshlaganingizda tugmani bosing — vaqt shundan hisoblanadi.`, rows: [[{ text: '▶️ Boshlash', callback_data: `ts:${t.id}` }]], sound: true } });
          ev.push({ key: `t:${t.id}:miss`, at: t.planned_end + 30 * 60e3,
            act: () => db.run("UPDATE tasks SET status='missed' WHERE id=? AND status='planned'", t.id),
            msg: { text: `⏭ «${esc(t.title)}» boshlanmadi — o'tkazib yuborilgan deb belgilandi.` } });
        }
        if (t.status === 'active') ev.push({ key: `t:${t.id}:end`, at: t.planned_end,
          msg: { text: `⏹ <b>${esc(t.title)}</b> vaqti tugadi (${t.end}).\nTugatgan bo'lsangiz, tugmani bosing.`, rows: [[{ text: '⏹ Tugatish', callback_data: `tf:${t.id}` }]], sound: true } });
      }
    }
    // --- uyg'onish, reja, hisobot, uyqu
    const f = T.frame(u), day = core.dayRow(u, today);
    const wakeAt = T.instant(today, f.wake, u.tz), sleepAt = T.instant(today, f.sleep, u.tz);
    if (!day.wake_at) {
      const btn = [[{ text: '✅ Turdim', callback_data: `wk:${today}` }]];
      ev.push({ key: `w:${today}`, at: wakeAt, allowQuiet: true, msg: { text: `🌅 <b>Xayrli tong, ${esc(u.name)}!</b>\nTurish vaqti — ${u.wake}.\nTurganingizda tugmani bosing.`, rows: btn, sound: true } });
      ev.push({ key: `w:${today}:r`, at: wakeAt + 10 * 60e3, allowQuiet: true, msg: { text: `⏰ ${u.wake} dan 10 daqiqa o'tdi. Turdingizmi?`, rows: btn, sound: true } });
    }
    const tomorrow = T.addDays(today, 1);
    let remind = T.toMin(u.plan_remind);
    if (remind < f.wake) remind += 1440;
    if (!core.dayRow(u, tomorrow).plan_ready) {
      ev.push({ key: `plan:${today}`, at: T.instant(today, remind, u.tz),
        msg: { text: `📝 <b>Ertangi kun rejasini tuzish vaqti</b>\n${T.fmtDay(tomorrow)}\n\nUyg'onish ${u.wake}. Namoz vaqtlari avtomatik qo'yilgan — bo'sh vaqtlarga ishlaringizni joylang.`,
          rows: [bot ? bot.appRow('📝 Rejani tuzish', `/#/reja?d=${tomorrow}`) : null], sound: true } });
    }
    ev.push({ key: `pdf:${today}`, at: sleepAt - 5 * 60e3, pdf: today });
    if (!day.sleep_at) ev.push({ key: `s:${today}`, at: sleepAt, msg: { text: `🌙 <b>Uxlash vaqti</b> — ${u.sleep}\nYotganingizda tugmani bosing. Ertalab ${u.wake} gacha bezovta qilmayman.`, rows: [[{ text: '😴 Uxladim', callback_data: `sl:${today}` }]], sound: true } });
    return ev;
  }

  async function tickUser(u, now) {
    for (const e of eventsFor(u, now)) {
      if (now < e.at || isSent(u.id, e.key)) continue;
      if (e.at < (u.created_at || 0)) continue; // ro'yxatdan o'tishdan oldingi hodisalar
      markSent(u.id, e.key);
      if (e.act) e.act();
      if (now - e.at > FRESH) continue;
      if (quiet(u, now) && !e.allowQuiet) continue;
      try {
        if (e.pdf) { if (bot && u.tg_id > 0) await bot.sendDailyPdf(u, e.pdf); bus.emit(u.id, { type: 'notify', title: 'Kunlik hisobot tayyor', body: 'Tarix bo\'limida ko\'ring' }); }
        else if (e.msg) await deliver(u, e.msg);
      } catch (err) { log('notify', u.id, e.key, err.message); }
    }
  }

  let timer = null, busy = false;
  async function tick(now = Date.now()) {
    if (busy) return;
    busy = true;
    try {
      for (const u of db.all('SELECT * FROM users WHERE onboarded=1')) {
        try { await tickUser(u, now); } catch (e) { log('tick', u.id, e.message); }
      }
    } finally { busy = false; }
  }
  return { start: () => { tick(); timer = setInterval(tick, 20e3); }, stop: () => clearInterval(timer), tick, eventsFor, quiet };
}

module.exports = { create };
