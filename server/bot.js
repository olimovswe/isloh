'use strict';
/* Telegram bot (@islohuzbot): ro'yxatdan o'tish, kirish kodi, eslatmalar va tugmalar.
   Bot API to'g'ridan-to'g'ri fetch orqali ishlatiladi — tashqi kutubxona kerak emas. */
const T = require('./time');

const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function create({ token, core, analysis, reportPdf, publicUrl, username = 'islohuzbot', log = console.log, transport }) {
  const API = `https://api.telegram.org/bot${token}/`;
  let running = false, offset = 0;

  async function call(method, payload) {
    if (transport) return transport(method, payload);
    const r = await fetch(API + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (!j.ok) throw new Error(`${method}: ${j.description}`);
    return j.result;
  }
  async function sendDocument(chatId, buf, filename, caption, markup) {
    if (transport) return transport('sendDocument', { chat_id: chatId, filename, size: buf.length, caption, reply_markup: markup });
    const fd = new FormData();
    fd.append('chat_id', String(chatId));
    fd.append('document', new Blob([buf], { type: 'application/pdf' }), filename);
    if (caption) { fd.append('caption', caption); fd.append('parse_mode', 'HTML'); }
    if (markup) fd.append('reply_markup', JSON.stringify(markup));
    const r = await fetch(API + 'sendDocument', { method: 'POST', body: fd });
    const j = await r.json();
    if (!j.ok) throw new Error(`sendDocument: ${j.description}`);
    return j.result;
  }
  const httpsApp = () => publicUrl && /^https:\/\//.test(publicUrl) && !/localhost|127\.0\.0\.1/.test(publicUrl);
  /* Ilovani ochish tugmasi — faqat ilova ochiq https manzilda bo'lsa (Telegram talabi) */
  function appRow(text, path = '/') {
    return httpsApp() ? [{ text, url: publicUrl.replace(/\/$/, '') + path }] : null;
  }
  const kb = rows => ({ inline_keyboard: rows.filter(Boolean) });

  async function send(chatId, text, rows) {
    return call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(rows && rows.filter(Boolean).length ? { reply_markup: kb(rows) } : {}) });
  }
  async function edit(msg, text, rows) {
    try {
      return await call('editMessageText', { chat_id: msg.chat.id, message_id: msg.message_id, text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: kb(rows || []) });
    } catch (e) { if (!/not modified/.test(e.message)) throw e; }
  }

  /* ------------------------------------------------------------ ro'yxatdan o'tish */
  async function codeMessage(chatId, u, msgToEdit) {
    const code = core.newCode(u.id);
    const text = `🔑 <b>Ilovaga kirish kodi:</b>\n\n<code>${code}</code>\n\nKodni Isloh ilovasidagi «Kirish» oynasiga kiriting.\nKod <b>3 daqiqa</b> amal qiladi.\n\n<i>Kodni hech kimga bermang.</i>`;
    const rows = [[{ text: '🔄 Yangi kod', callback_data: 'code' }], appRow('📲 Ilovani ochish', '/#/kirish')];
    return msgToEdit ? edit(msgToEdit, text, rows) : send(chatId, text, rows);
  }
  async function onStart(msg) {
    const from = msg.from;
    const u = core.userByTg(from.id);
    if (u) {
      await send(msg.chat.id, `Assalomu alaykum, <b>${esc(u.name || from.first_name)}</b>! 👋\n\nIsloh botiga qaytganingizdan xursandmiz.`);
      return codeMessage(msg.chat.id, u);
    }
    const nm = esc(from.first_name || from.username || '');
    const text = `Salom ${nm}\n<b>Isloh</b>'ning rasmiy botiga xush kelibsiz\n\n⬇️ Kontaktingizni yuboring (tugmani bosib)\n\n🇺🇸\nHi ${nm} 👋\nWelcome to <b>Isloh</b>'s official bot\n\n⬇️ Send your contact (by clicking button)`;
    return call('sendMessage', { chat_id: msg.chat.id, text, parse_mode: 'HTML',
      reply_markup: { keyboard: [[{ text: '📱 Kontaktni yuborish / Send contact', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } });
  }
  async function onContact(msg) {
    const c = msg.contact;
    if (!c || c.user_id !== msg.from.id) {
      return send(msg.chat.id, "Iltimos, <b>o'zingizning</b> kontaktingizni pastdagi tugma orqali yuboring.");
    }
    const u = core.registerContact({ tg_id: msg.from.id, phone: c.phone_number, username: msg.from.username, first_name: msg.from.first_name, last_name: msg.from.last_name });
    await call('sendMessage', { chat_id: msg.chat.id, parse_mode: 'HTML', text: `✅ Raqamingiz tasdiqlandi: <b>${esc(u.phone)}</b>`, reply_markup: { remove_keyboard: true } });
    return codeMessage(msg.chat.id, u);
  }

  /* ------------------------------------------------------------ buyruqlar */
  async function todayText(u) {
    const ds = core.activeDate(u);
    const plan = core.planGet(u, ds);
    const icon = { done: '✅', active: '▶️', missed: '⏭', planned: '▫️' };
    const lines = plan.items.map(it => it.kind === 'prayer'
      ? `🕌 ${it.start} ${it.title}${plan.prayers[it.prayer] ? (plan.prayers[it.prayer] === 'vaqtida' ? ' ✅' : ' ❗qazo') : ''}`
      : `${it.kind === 'meal' ? '🍽' : icon[it.status] || '▫️'} ${it.start}–${it.end} ${esc(it.title)}`);
    return `📅 <b>${T.fmtDay(ds)}</b>\n\n${lines.join('\n') || 'Reja hali tuzilmagan.'}`;
  }
  async function onCommand(msg, cmd) {
    const u = core.userByTg(msg.from.id);
    if (cmd === 'start') return onStart(msg);
    if (!u) return onStart(msg);
    if (cmd === 'kod' || cmd === 'login') return codeMessage(msg.chat.id, u);
    if (cmd === 'bugun') return send(msg.chat.id, await todayText(u), [appRow('📲 Ilovada ochish', '/#/reja')]);
    if (cmd === 'hisobot') return sendDailyPdf(u, core.activeDate(u));
    return send(msg.chat.id, "Buyruqlar:\n/bugun — bugungi reja\n/hisobot — bugungi tahlil (PDF)\n/kod — ilovaga kirish kodi");
  }

  /* ------------------------------------------------------------ tugmalar */
  const hhmm = (u, ts) => T.hhmmAt(ts, u.tz);
  async function onCallback(cb) {
    const u = core.userByTg(cb.from.id);
    const msg = cb.message;
    const answer = (text, alert) => call('answerCallbackQuery', { callback_query_id: cb.id, ...(text ? { text, show_alert: !!alert } : {}) }).catch(() => {});
    if (!u) return answer("Avval ro'yxatdan o'ting: /start", true);
    const [act, a1, a2] = String(cb.data || '').split(':');
    try {
      if (act === 'code') { await codeMessage(msg.chat.id, u, msg); return answer('Yangi kod yuborildi'); }
      if (act === 'ts') {
        const t = core.taskStart(u, +a1);
        const late = t.late > 0 ? ` (<b>${t.late} daqiqa kech</b>)` : " (o'z vaqtida 👍)";
        await edit(msg, `▶️ <b>${esc(t.title)}</b> boshlandi — ${hhmm(u, t.actual_start)}${late}\n🕐 Reja: ${t.start}–${t.end}`, [[{ text: '⏹ Tugatish', callback_data: `tf:${t.id}` }]]);
        return answer('Boshlandi');
      }
      if (act === 'tf') {
        const t = core.taskFinish(u, +a1);
        await edit(msg, `✅ <b>${esc(t.title)}</b> tugadi — ${hhmm(u, t.actual_end)}\n⏱ Davomiyligi: ${t.actual_min} daqiqa (reja ${t.planned_min} daqiqa)\n\n<b>Qanchalik yaxshi o'tdi?</b>`,
          [[1, 2, 3, 4, 5].map(n => ({ text: `${n} ⭐`, callback_data: `tr:${t.id}:${n}` }))]);
        return answer('Tugadi');
      }
      if (act === 'tr') {
        const t = core.taskRate(u, +a1, +a2);
        const m = analysis.taskMetrics(t, Date.now());
        await edit(msg, `✅ <b>${esc(t.title)}</b>\n⏱ ${t.actual_min}/${t.planned_min} daqiqa · ${t.late > 0 ? `+${t.late} daq kech` : "o'z vaqtida"} · ${'⭐'.repeat(t.rating)}\n📊 Ish balli: <b>${Math.round(m.score * 100)}%</b>`);
        return answer('Rahmat!');
      }
      if (act === 'pr') {
        const r = core.prayerMark(u, a1, a2);
        await edit(msg, r.status === 'vaqtida' ? `✅ <b>${T.PN[a2]}</b> namozi o'z vaqtida o'qildi.\nAlloh qabul qilsin! 🤲` : `❗ ${T.PN[a2]} namozi qazo bo'lgan.`);
        return answer(r.status === 'vaqtida' ? 'Qabul qilsin!' : 'Qazo');
      }
      if (act === 'wk') {
        const d = core.wake(u, a1);
        const plan = T.instant(a1, T.frame(u).wake, u.tz);
        const late = Math.round((d.wake_at - plan) / 60e3);
        await edit(msg, `🌅 Turdingiz: <b>${hhmm(u, d.wake_at)}</b> (reja ${u.wake}${late > 0 ? `, +${late} daq` : ''}).\nKuningiz barakali o'tsin!`);
        return answer('Xayrli tong!');
      }
      if (act === 'sl') {
        core.sleep(u, a1);
        await edit(msg, `🌙 Yaxshi dam oling!\nErtalab <b>${u.wake}</b> da uyg'otaman — shu paytgacha bezovta qilmayman.`);
        return answer('Xayrli tun!');
      }
      return answer();
    } catch (e) {
      return answer(e.message, true);
    }
  }

  async function handle(update) {
    try {
      if (update.callback_query) return await onCallback(update.callback_query);
      const msg = update.message;
      if (!msg || msg.chat.type !== 'private') return;
      if (msg.contact) return await onContact(msg);
      const m = (msg.text || '').match(/^\/(\w+)/);
      if (m) return await onCommand(msg, m[1].toLowerCase());
      if (!core.userByTg(msg.from.id)) return await onStart(msg);
      return await onCommand(msg, 'help');
    } catch (e) { log('bot', e.message); }
  }

  /* ------------------------------------------------------------ PDF hisobot */
  async function sendDailyPdf(u, ds) {
    if (!(u.tg_id > 0)) return;
    const a = analysis.dayAnalysis(u, ds);
    const tm = T.addDays(ds, 1);
    const plan = core.planGet(u, tm);
    const buf = reportPdf(u, a, { date: tm, items: plan.items });
    const caption = `📊 <b>${a.title}</b>\nKun balli: <b>${a.score === null ? '—' : Math.round(a.score * 100) + '%'}</b> (${a.level_name})\n` +
      `Ishlar: ${a.stats.done}/${a.stats.planned} · Namoz: ${a.stats.prayers_ok}/5${a.stats.late_avg ? ` · Kechikish: ${a.stats.late_avg} daq` : ''}`;
    return sendDocument(u.tg_id, buf, `isloh-${ds}.pdf`, caption, kb([appRow('📲 Ilovada ko\'rish', `/#/tarix?d=${ds}`)]));
  }

  async function poll() {
    running = true;
    try {
      await call('setMyCommands', { commands: [{ command: 'bugun', description: 'Bugungi reja' }, { command: 'hisobot', description: 'Bugungi tahlil (PDF)' }, { command: 'kod', description: 'Ilovaga kirish kodi' }] });
      const me = await call('getMe', {});
      log(`Telegram bot ulandi: @${me.username}`);
    } catch (e) { log('bot ulanmadi:', e.message); }
    while (running) {
      try {
        const ups = await call('getUpdates', { offset, timeout: 25, allowed_updates: ['message', 'callback_query'] });
        for (const up of ups) { offset = up.update_id + 1; await handle(up); }
      } catch (e) {
        log('getUpdates', e.message);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  return { start: () => { if (!running) poll(); }, stop: () => { running = false; }, handle, send, sendDailyPdf, appRow, kb };
}

module.exports = { create, esc };
