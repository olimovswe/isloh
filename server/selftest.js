'use strict';
/* Server mantig'ini sinash: vaqtni sun'iy siljitib, butun bir kunni o'tkazamiz.
   Ishga tushirish: node server/selftest.js */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const realNow = Date.now;
let fake = null;
Date.now = () => (fake === null ? realNow() : fake);

const T = require('./time');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'isloh-test-'));
const db = require('./db').open(dir);
const events = [];
const bus = { emit: (uid, ev) => events.push(ev) };
const core = require('./core').create(db, bus);
const analysis = require('./analysis').create(db, core);
const { report } = require('./pdf');
const sent = [];
const bot = require('./bot').create({ token: 'x', core, analysis, reportPdf: report, publicUrl: 'https://isloh.example.uz', log: () => {},
  transport: async (method, p) => { sent.push({ method, ...p }); return { message_id: sent.length, chat: { id: p.chat_id } }; } });
const scheduler = require('./scheduler').create({ db, core, bot, bus, log: (...a) => console.log('  log:', ...a) });

let ok = 0;
const check = (name, fn) => { fn(); ok++; console.log('  ✓', name); };
const at = (ds, hhmm) => T.instant(ds, T.toMin(hhmm), 5);
(async () => {
  const D = '2026-10-26', D2 = '2026-10-27';
  fake = at(D, '00:30') - 86400e3; // 25-oktabr kechasi ro'yxatdan o'tadi

  // --- bot: /start va kontakt
  await bot.handle({ update_id: 1, message: { chat: { id: 555, type: 'private' }, from: { id: 555, first_name: 'Muslimbek', username: 'olimov' }, text: '/start' } });
  check('start xabari va kontakt tugmasi', () => {
    const m = sent.pop();
    assert(m.text.includes("Isloh</b>'ning rasmiy botiga xush kelibsiz") && m.text.includes('Welcome'));
    assert(m.reply_markup.keyboard[0][0].request_contact);
  });
  await bot.handle({ update_id: 2, message: { chat: { id: 555, type: 'private' }, from: { id: 555, first_name: 'Muslimbek', username: 'olimov' }, contact: { user_id: 999, phone_number: '998901234567' } } });
  check("begona kontakt rad etiladi", () => assert(sent.pop().text.includes("o'zingizning")));
  await bot.handle({ update_id: 3, message: { chat: { id: 555, type: 'private' }, from: { id: 555, first_name: 'Muslimbek', username: 'olimov' }, contact: { user_id: 555, phone_number: '998901234567' } } });
  const codeMsg = [...sent].reverse().find(m => m.text && m.text.includes('<code>'));
  const code = codeMsg.text.match(/<code>(\d{6})<\/code>/)[1];
  check('kontakt → hisob, 6 xonali kod va ilova menyusi', () => { assert(/^\d{6}$/.test(code)); assert(sent.some(m => m.reply_markup && m.reply_markup.remove_keyboard)); assert(sent.some(m => m.method === 'setChatMenuButton' && m.chat_id === 555)); });

  // --- ilova: kod bilan kirish
  let thrown = null;
  try { core.verifyCode('000000', '1.2.3.4'); } catch (e) { thrown = e; }
  check("noto'g'ri kod rad etiladi", () => assert(thrown && thrown.status === 400));
  const { token, user } = core.verifyCode(code, '1.2.3.4');
  check('kod → sessiya', () => { assert(token.length === 64); assert.equal(user.phone, '+998901234567'); assert.equal(core.auth(token).id, user.id); });
  thrown = null; try { core.verifyCode(code); } catch (e) { thrown = e; }
  check('kod faqat bir marta ishlaydi', () => assert(thrown));
  {
    const crypto = require('crypto'), BT = '123456:TEST-token-for-selftest-only-0000000';
    const fields = { auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'AAH', user: JSON.stringify({ id: 555, first_name: 'Muslimbek' }) };
    const dcs = Object.keys(fields).sort().map(k => `${k}=${fields[k]}`).join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(BT).digest();
    const hash = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
    const initData = new URLSearchParams({ ...fields, hash }).toString();
    check('Telegram Mini App: imzo bilan kodsiz kirish', () => assert.equal(core.authTelegram(initData, BT).user.phone, '+998901234567'));
    let bad = null; try { core.authTelegram(initData.replace('Muslimbek', 'Hacker'), BT); } catch (e) { bad = e; }
    check("Mini App: soxta imzo rad etiladi", () => assert(bad && bad.status === 401));
  }

  let u = core.auth(token);
  u = { ...u, ...core.updateMe(u, { name: 'Muslimbek', birth_date: '2003-05-14', wake: '04:00', sleep: '22:30', onboarded: true }) };
  u = core.userById(u.id);

  // --- reja tuzish (kechqurun, ertangi kun uchun)
  fake = at('2026-10-25', '21:40');
  const plan0 = core.planGet(u, D);
  check("ovqat shablonlari avtomatik qo'yiladi", () => assert.equal(plan0.items.filter(i => i.kind === 'meal').length, 2));
  check('namoz bloklari qulflangan', () => assert.equal(plan0.items.filter(i => i.kind === 'prayer').length, 5));
  const bomdod = plan0.items.find(i => i.prayer === 'bomdod');
  thrown = null;
  try { core.taskCreate(u, { date: D, title: 'Test', start: bomdod.start, end: T.fmtMin(T.toMin(bomdod.start) + 30) }); } catch (e) { thrown = e; }
  check("namoz vaqtiga ish qo'yib bo'lmaydi", () => assert(thrown && thrown.message.includes('Bomdod namozi')));
  thrown = null;
  try { core.taskCreate(u, { date: D, title: 'Test', start: '07:10', end: '07:40' }); } catch (e) { thrown = e; }
  check("ovqat vaqtiga ish qo'yib bo'lmaydi", () => assert(thrown && thrown.message.includes('Nonushta')));
  const tEng = core.taskCreate(u, { date: D, title: 'Ingliz tili', start: '05:50', end: '06:50', category: 'ilm', repeat: { type: 'daily' } });
  const tBook = core.taskCreate(u, { date: D, title: 'Kitob o\'qish', start: '08:00', end: '09:00', category: 'ilm' });
  const tAlgo = core.taskCreate(u, { date: D, title: 'Algoritmlar', start: '09:30', end: '11:00', category: 'ish' });
  check('takrorlanuvchi ish ertasiga ham chiqadi', () => assert(core.planGet(u, D2).items.some(i => i.title === 'Ingliz tili')));
  core.planReady(u, D, true);

  // --- ertalab: uyg'onish
  fake = at(D, '04:00') + 30e3;
  await scheduler.tick(fake);
  const wakeMsg = sent.find(m => m.text && m.text.includes('Xayrli tong'));
  check("04:00 da uyg'onish xabari", () => assert(wakeMsg && wakeMsg.reply_markup.inline_keyboard[0][0].callback_data === `wk:${D}`));
  fake = at(D, '04:12');
  await bot.handle({ update_id: 10, callback_query: { id: 'c1', from: { id: 555 }, data: `wk:${D}`, message: { chat: { id: 555 }, message_id: 1 } } });
  check("'Turdim' → 12 daqiqa kechikish", () => assert(sent.find(m => m.method === 'editMessageText' && m.text.includes('+12 daq'))));

  // --- namoz vaqti kirishi
  const wins = T.prayerWindows(u, D);
  fake = wins.bomdod[0] + 60e3;
  await scheduler.tick(fake);
  check('Bomdod vaqti kirdi xabari + O\'qidim tugmasi', () => assert(sent.find(m => m.text && m.text.includes('Bomdod</b> vaqti kirdi'))));

  // --- Ingliz tili: 5 daqiqa oldin xabar, 20 daqiqa kech boshlash
  sent.length = 0;
  fake = at(D, '05:45') + 10e3;
  await scheduler.tick(fake);
  const pre = sent.find(m => m.text && m.text.includes('Ingliz tili'));
  check('ishdan 5 daqiqa oldin xabar + Boshlash tugmasi', () => assert(pre && pre.reply_markup.inline_keyboard[0][0].callback_data === `ts:${tEng.id}`));
  fake = at(D, '06:10');
  await bot.handle({ update_id: 11, callback_query: { id: 'c2', from: { id: 555 }, data: `ts:${tEng.id}`, message: { chat: { id: 555 }, message_id: 2 } } });
  check('Boshlash 06:10 da → 20 daqiqa kech', () => assert.equal(core.taskRow(u, core.getTask(u, tEng.id)).late, 20));
  fake = wins.bomdod[1] + 30e3;
  await scheduler.tick(fake);
  check("belgilanmagan Bomdod quyosh chiqqanda avtomatik qazo", () => assert.equal(core.prayersOf(u, D).bomdod, 'qazo'));
  fake = at(D, '06:50') + 5e3;
  await scheduler.tick(fake);
  check('reja tugaganda Tugatish xabari', () => assert(sent.find(m => m.text && m.text.includes('vaqti tugadi'))));
  fake = at(D, '06:55');
  await bot.handle({ update_id: 12, callback_query: { id: 'c3', from: { id: 555 }, data: `tf:${tEng.id}`, message: { chat: { id: 555 }, message_id: 3 } } });
  const rateMsg = sent.filter(m => m.method === 'editMessageText').pop();
  check('Tugatish → davomiylik va baho tugmalari', () => assert(rateMsg.text.includes('45 daqiqa') && rateMsg.reply_markup.inline_keyboard[0].length === 5));
  await bot.handle({ update_id: 13, callback_query: { id: 'c4', from: { id: 555 }, data: `tr:${tEng.id}:4`, message: { chat: { id: 555 }, message_id: 3 } } });
  const m1 = analysis.taskMetrics(core.taskRow(u, core.getTask(u, tEng.id)), fake);
  check('ish balli: P=0.67 C=0.75 Q=0.8 → 74%', () => assert.equal(Math.round(m1.score * 100), 74));

  fake = wins.peshin[0] + 5 * 60e3;
  await bot.handle({ update_id: 14, callback_query: { id: 'c5', from: { id: 555 }, data: `pr:${D}:peshin`, message: { chat: { id: 555 }, message_id: 9 } } });
  check("Peshin 'O'qidim' → vaqtida", () => assert.equal(core.prayersOf(u, D).peshin, 'vaqtida'));

  // --- Kitob: o'z vaqtida, Algoritmlar: boshlanmaydi
  core.db = db;
  fake = at(D, '08:00'); core.taskStart(u, tBook.id);
  fake = at(D, '09:00'); core.taskFinish(u, tBook.id); core.taskRate(u, tBook.id, 5);
  fake = at(D, '11:31');
  await scheduler.tick(fake);
  check("boshlanmagan ish 30 daqiqadan keyin 'o'tkazildi'", () => assert.equal(core.getTask(u, tAlgo.id).status, 'missed'));
  for (const p of ['asr', 'shom', 'xufton']) { fake = wins[p][0] + 60e3; core.prayerMark(u, D, p); }

  // --- kechqurun: reja eslatmasi, PDF, uyqu
  sent.length = 0;
  fake = at(D, '21:30') + 10e3;
  await scheduler.tick(fake);
  check('21:30 da ertangi reja eslatmasi + ilova tugmasi', () => {
    const m = sent.find(x => x.text && x.text.includes('Ertangi kun rejasini'));
    assert(m && m.reply_markup.inline_keyboard[0][0].web_app.url === `https://isloh.example.uz/?p=${encodeURIComponent('reja?d=' + D2)}`);
  });
  fake = at(D, '22:25') + 10e3;
  await scheduler.tick(fake);
  const doc = sent.find(m => m.method === 'sendDocument');
  check('uxlashdan 5 daqiqa oldin PDF hisobot', () => assert(doc && doc.filename === `isloh-${D}.pdf` && doc.size > 3000));
  fake = at(D, '22:30') + 10e3;
  await scheduler.tick(fake);
  check('22:30 da uxlash xabari', () => assert(sent.find(m => m.text && m.text.includes('Uxlash vaqti'))));
  fake = at(D, '22:40');
  await bot.handle({ update_id: 20, callback_query: { id: 'c9', from: { id: 555 }, data: `sl:${D}`, message: { chat: { id: 555 }, message_id: 30 } } });
  sent.length = 0;
  fake = at(D2, '01:00');
  await scheduler.tick(fake);
  check("uyqu paytida bezovta qilinmaydi (Xufton qazo xabari ham yo'q)", () => assert.equal(sent.filter(m => m.method === 'sendMessage').length, 0));
  fake = at(D2, '04:00') + 20e3;
  await scheduler.tick(fake);
  check("ertalab uyg'otish xabari keladi", () => assert(sent.find(m => m.text && m.text.includes('Xayrli tong'))));
  fake = at(D2, '04:05'); core.wake(u, D2);

  // --- tahlil
  const a = analysis.dayAnalysis(u, D, at(D2, '04:10'));
  check('kun tahlili', () => {
    assert.equal(a.stats.planned, 3); assert.equal(a.stats.done, 2); assert.equal(a.stats.missed, 1);
    assert.equal(a.stats.prayers_ok, 4); assert.equal(a.prayers.bomdod.status, 'qazo');
    assert.equal(a.sleep.wake_late, 12); assert.equal(a.sleep.sleep_late, 10);
    assert(a.score > 0.3 && a.score < 0.8, 'ball ' + a.score);
  });
  console.log(`     kun balli: ${Math.round(a.score * 100)}% (${a.level_name}); xulosalar:`);
  for (const i of a.insights) console.log('       -', i.text);
  const a2 = analysis.dayAnalysis(u, D2, at(D2, '04:10'));
  check('kechagi uyqu davomiyligi', () => assert.equal(a2.sleep.hours.toFixed(2), ((at(D2, '04:05') - at(D, '22:40')) / 3600e3).toFixed(2)));
  const h = analysis.history(u, 'kitob');
  check("tarixda qidiruv ('kitob')", () => assert(h.items.some(i => i.date === D)));
  check("tarixda sana bo'yicha qidiruv (26.10)", () => assert.equal(analysis.history(u, '26.10').items[0].date, D));
  const prof = analysis.profile(u);
  check('profil faollik jadvali', () => assert(prof.cells.some(c => c.date === D && c.level >= 1)));

  // --- PDF
  const pdf = report(u, a, { date: D2, items: core.planGet(u, D2).items });
  fs.writeFileSync(path.join(dir, 'report.pdf'), pdf);
  check(`PDF yaratildi (${(pdf.length / 1024).toFixed(1)} KB)`, () => assert(pdf.slice(0, 8).toString() === '%PDF-1.4'));
  console.log(`\n${ok} ta tekshiruv o'tdi. PDF: ${path.join(dir, 'report.pdf')}`);
})().catch(e => { console.error('XATO:', e); process.exit(1); });
