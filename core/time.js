'use strict';
/* Vaqt yordamchilari. Har bir foydalanuvchining vaqt mintaqasi (O'zbekiston: UTC+5) hisobga olinadi,
   shuning uchun kompyuter soat mintaqasidan qat'i nazar vaqtlar to'g'ri chiqadi. */
const Prayer = require('./prayer');

const pad = n => String(n).padStart(2, '0');
const BLOCKS = ['bomdod', 'peshin', 'asr', 'shom', 'xufton'];
const PN = { bomdod: 'Bomdod', quyosh: 'Quyosh', peshin: 'Peshin', asr: 'Asr', shom: 'Shom', xufton: 'Xufton' };
const WD = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

/* Foydalanuvchi mintaqasidagi hozirgi sana va daqiqa */
function tzNow(tz, now = Date.now()) {
  const d = new Date(now + tz * 3600e3);
  return { date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
function addDays(ds, n) {
  const [y, m, d] = ds.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
const weekday = ds => { const [y, m, d] = ds.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const validDate = ds => typeof ds === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ds) && !isNaN(Date.parse(ds + 'T00:00:00Z'));
const validTime = s => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const toMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const fmtMin = min => { min = ((Math.round(min) % 1440) + 1440) % 1440; return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`; };
/* Sana + sutka boshidan daqiqalar → aniq lahza (ms) */
function instant(ds, min, tz) {
  const [y, m, d] = ds.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 0, 0) + min * 60e3 - tz * 3600e3;
}
const hhmmAt = (ts, tz) => { const d = new Date(ts + tz * 3600e3); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
const fmtDay = ds => { const [y, m, d] = ds.split('-').map(Number); return `${WD[weekday(ds)]}, ${d}-${MONTHS[m - 1]} ${y}`; };

/* Kun ramkasi: uyg'onishdan uxlashgacha. Uxlash yarim tundan keyin bo'lsa, keyingi sutkaga o'tadi. */
function frame(user) {
  const wake = toMin(user.wake);
  let sleep = toMin(user.sleep);
  if (sleep <= wake) sleep += 1440;
  return { wake, sleep };
}
/* "HH:MM" ni kun ramkasidagi daqiqaga aylantirish (yarim tundan keyingi vaqtlar +1440) */
function norm(user, hhmm) {
  const f = frame(user);
  let m = toMin(hhmm);
  if (m < f.wake && f.sleep > 1440 && m + 1440 <= f.sleep) m += 1440;
  return m;
}

/* Namoz vaqtlari (aniq lahzalar) */
function prayerTimes(user, ds) {
  const t = Prayer.timesFor(ds, { city: user.city || 'toshkent', tz: user.tz ?? 5 });
  const o = {};
  for (const k of Object.keys(t)) o[k] = t[k].getTime();
  return o;
}
/* Har bir namozning vaqti: boshlanishi va tugashi (keyingi vaqt kirguncha) */
function prayerWindows(user, ds) {
  const t = prayerTimes(user, ds), n = prayerTimes(user, addDays(ds, 1));
  return {
    bomdod: [t.bomdod, t.quyosh], peshin: [t.peshin, t.asr], asr: [t.asr, t.shom],
    shom: [t.shom, t.xufton], xufton: [t.xufton, n.bomdod],
  };
}

module.exports = { pad, BLOCKS, PN, WD, MONTHS, tzNow, addDays, weekday, validDate, validTime, toMin, fmtMin, instant, hhmmAt, fmtDay, frame, norm, prayerTimes, prayerWindows };
