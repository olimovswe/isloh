'use strict';

/* ================================================================ yordamchilar */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n, l = 2) => String(n).padStart(l, '0');
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const MSHORT = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
const WD = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const HM = ['Muharram', 'Safar', 'Rabiul avval', 'Rabiul oxir', 'Jumodul avval', 'Jumodul oxir', 'Rajab', "Sha'bon", 'Ramazon', 'Shavvol', "Zulqa'da", 'Zulhijja'];
const BLOCKS = ['bomdod', 'peshin', 'asr', 'shom', 'xufton'];
const ALLP = ['bomdod', 'quyosh', 'peshin', 'asr', 'shom', 'xufton'];
const PN = { bomdod: 'Bomdod', quyosh: 'Quyosh', peshin: 'Peshin', asr: 'Asr', shom: 'Shom', xufton: 'Xufton' };
const AREAS = ['Din', 'Bilim', "Sog'liq", 'Kasb', 'Oila', 'Moliya', 'Shaxsiy rivojlanish'];
const GTYPE = { number: 'Raqamli', habit: 'Muntazam', project: 'Bosqichli' };
const PSTAT = { vaqtida: 'Vaqtida', kech: 'Kech o\'qildi', qazo: 'Qazo' };
const UNITS_INT = ['bet', 'sahifa', 'ta', 'dona', 'marta', "so'z", 'masala', 'dars', 'pora', 'kun'];

const pd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return iso(d); };
const fmtDay = s => { const d = pd(s); return `${WD[d.getDay()]}, ${d.getDate()}-${MONTHS[d.getMonth()]}`; };
const fmtDate = s => { const d = pd(s); return `${d.getDate()}-${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const at = (ds, hhmm) => { const d = pd(ds); const [h, m] = hhmm.split(':').map(Number); d.setHours(h, m, 0, 0); return d; };
const fnum = (x, dp = 1) => x == null || isNaN(x) ? '—' : String(Math.round(x * 10 ** dp) / 10 ** dp).replace('.', ',');
const grp = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const pct = x => x == null ? '—' : Math.round(x * 100) + '%';
const daysBetween = (a, b) => Math.round((pd(b) - pd(a)) / 864e5);
function niceNum(x, unit) {
  if (!(x > 0)) return 0;
  if (UNITS_INT.includes((unit || '').toLowerCase())) return Math.ceil(x - 1e-9);
  return x < 10 ? Math.round(x * 10) / 10 : Math.ceil(x - 1e-9);
}
function splitMs(ms) {
  ms = Math.max(0, ms);
  return { d: Math.floor(ms / 864e5), h: Math.floor(ms % 864e5 / 36e5), m: Math.floor(ms % 36e5 / 6e4), s: Math.floor(ms % 6e4 / 1e3), ms: Math.floor(ms % 1e3) };
}
function hijri(ds) {
  try {
    const d = pd(ds);
    d.setDate(d.getDate() + (S.settings?.hijri_offset ?? 0));
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(d);
    const g = t => parseInt(parts.find(p => p.type === t).value, 10);
    return `${g('day')} ${HM[g('month') - 1]} ${g('year')}`;
  } catch (e) { return ''; }
}

function cityOptions(cur, withCustom = true) {
  return Prayer.CITIES.map(c => `<option value="${c.id}" ${c.id === cur ? 'selected' : ''}>${esc(c.name)}</option>`).join('')
    + (withCustom ? `<option value="custom" ${cur === 'custom' ? 'selected' : ''}>Boshqa joy (koordinata)</option>` : '');
}
function cityName(pr) {
  if (pr.city === 'custom') return `${fnum(pr.lat, 2)}°, ${fnum(pr.lon, 2)}°`;
  const c = Prayer.CITIES.find(x => x.id === pr.city);
  return c ? c.name : 'Toshkent';
}

/* ================================================================ ikonkalar */
const P = {
  home: '<path d="M5 12H3l9-9 9 9h-2"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/><path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M3 12h1m8-9v1m8 8h1m-9 8v1M5.6 5.6l.7.7m12.1-.7-.7.7m0 11.4.7.7m-12.1-.7-.7.7"/>',
  calPlus: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M16 3v4M8 3v4M4 11h16M12 14v4M10 16h4"/>',
  target: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="9"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>',
  settings: '<path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h11M19 18h1"/><circle cx="14" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  star: '<path d="M12 17.75l-6.17 3.25 1.18-6.88-5-4.87 6.9-1L12 2l3.09 6.25 6.9 1-5 4.87 1.18 6.88z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>',
  edit: '<path d="M4 20h4L18.5 9.5a2.83 2.83 0 1 0-4-4L4 16v4"/><path d="M13.5 6.5l4 4"/>',
  right: '<path d="M5 12h14M13 18l6-6M13 6l6 6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevL: '<path d="M15 6l-6 6 6 6"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>',
  dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  undo: '<path d="M9 14l-4-4 4-4"/><path d="M5 10h11a4 4 0 1 1 0 8h-1"/>',
  flag: '<path d="M5 5v16M5 5a5 5 0 0 1 7 0 5 5 0 0 0 7 0v9a5 5 0 0 1-7 0 5 5 0 0 0-7 0"/>',
  upload: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 9l5-5 5 5M12 4v12"/>',
  download: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 11l5 5 5-5M12 4v12"/>',
  bell: '<path d="M10 5a2 2 0 1 1 4 0 7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2-3v-3a7 7 0 0 1 4-6"/><path d="M9 17v1a3 3 0 0 0 6 0v-1"/>',
  moon: '<path d="M12 3h.39a7.5 7.5 0 0 0 7.92 12.45A9 9 0 1 1 12 3z"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 15l-5-5-11 9"/>',
};
const ic = (n, cls = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="${cls}">${P[n]}</svg>`;

/* ================================================================ API, toast, modal */
/* Dastur mantig'i qurilmaning o'zida (core/backend.js) — internet ham, server ham kerak emas. */
async function api(method, path, body) {
  try { return await Backend.handle(method, path, body); }
  catch (e) { console.error(e); throw new Error(e.message || 'Xatolik yuz berdi'); }
}
const native = window.islohNative || null;
const isAndroid = () => S.platform === 'android';
/* Faylni saqlash: kompyuterda — "Saqlash" oynasi, telefonda — ulashish oynasi (Telegram, Drive, Fayllar…). */
async function saveFile(name, text) {
  if (native) return native.saveFile(name, text);
  const FS = isAndroid() && capPlugin('Filesystem'), SH = isAndroid() && capPlugin('Share');
  if (FS && SH) {
    const r = await FS.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
    await SH.share({ title: name, files: [r.uri] });
    return 'shared';
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  return 'downloaded';
}
let toastTimer;
function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('bad', bad);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), bad ? 4200 : 2400);
}
const fail = e => toast(e.message || String(e), true);

function modal(html, { wide = false, onClose } = {}) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal glass ${wide ? 'wide' : ''}">${html}</div>`;
  $('#modal-root').appendChild(bg);
  const el = bg.firstElementChild;
  let closed = false;
  const onKey = e => { if (e.key === 'Escape') close(); };
  function close() {
    if (closed) return;
    closed = true;
    bg.remove();
    document.removeEventListener('keydown', onKey);
    onClose && onClose();
  }
  document.addEventListener('keydown', onKey);
  bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
  setTimeout(() => { const f = $('[autofocus]', el); if (f) { f.focus(); f.select && f.select(); } }, 30);
  return { el, close };
}
function confirmBox(title, text, ok = 'Ha', danger = false) {
  return new Promise(res => {
    let val = false;
    const m = modal(`<h2>${esc(title)}</h2><p class="lead">${esc(text)}</p>
      <div class="foot"><button class="btn" data-x="no">Yo'q</button><button class="btn ${danger ? 'danger' : 'primary'}" data-x="ok" autofocus>${esc(ok)}</button></div>`,
      { onClose: () => res(val) });
    m.el.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; val = x.dataset.x === 'ok'; m.close(); });
  });
}
function askNumber(title, lead, def) {
  return new Promise(res => {
    let val = null;
    const m = modal(`<h2>${esc(title)}</h2><p class="lead">${esc(lead)}</p>
      <input type="number" id="an" min="0" step="any" value="${def ?? ''}" autofocus><div class="err" id="an-err"></div>
      <div class="foot"><button class="btn" data-x="c">Bekor</button><button class="btn primary" data-x="ok">Saqlash</button></div>`,
      { onClose: () => res(val) });
    const ok = () => {
      const v = parseFloat($('#an', m.el).value);
      if (!(v >= 0)) { $('#an-err', m.el).textContent = 'Raqam kiriting'; return; }
      val = v; m.close();
    };
    m.el.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; x.dataset.x === 'ok' ? ok() : m.close(); });
    $('#an', m.el).addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
  });
}
let POP = null;
function closePopover() { if (POP) { POP.el.remove(); document.removeEventListener('mousedown', POP.outside); POP = null; } }
function popover(anchor, items, onPick) {
  closePopover();
  const r = anchor.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'pop glass';
  el.style.left = Math.min(r.left, innerWidth - 220) + 'px';
  el.style.top = Math.min(r.bottom + 6, innerHeight - 200) + 'px';
  el.innerHTML = items.map((it, i) => `<button data-i="${i}"><i style="background:${it.color}"></i>${esc(it.label)}</button>`).join('');
  document.body.appendChild(el);
  const outside = e => { if (!el.contains(e.target)) closePopover(); };
  el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const it = items[+b.dataset.i]; closePopover(); onPick(it); });
  setTimeout(() => document.addEventListener('mousedown', outside), 0);
  POP = { el, outside };
}

/* ================================================================ holat va jonli yangilanish */
const S = { settings: null, active_day: null, main_goal: null, prayers: null, next_prayers: null };
let frameFns = [], secFns = [];
function loop() { if (frameFns.length) { const n = new Date(); for (const f of frameFns) f(n); } requestAnimationFrame(loop); }
setInterval(() => { if (secFns.length) { const n = new Date(); for (const f of secFns) f(n); } }, 1000);

async function loadState() {
  const s = await api('GET', '/api/state');
  Object.assign(S, s);
  applyLook();
}
async function applyLook() {
  const l = S.settings.look;
  document.documentElement.style.setProperty('--blur', l.blur + 'px');
  document.documentElement.style.setProperty('--dim', l.dim);
  document.body.classList.toggle('lite', !!l.lite);
  const url = await Store.wallpaperURL(l.wallpaper);
  $('#bg').style.backgroundImage = url ? `url("${url}")` : '';
  $$('.wall-prev').forEach(el => { el.style.backgroundImage = url ? `url("${url}")` : ''; });
}
setInterval(async () => {
  try {
    const prev = S.active_day;
    const s = await api('GET', '/api/state');
    Object.assign(S, s);
    if (prev !== S.active_day && !$('.modal-bg')) render();
  } catch (e) { /* server qayta ishga tushayotgan bo'lishi mumkin */ }
}, 60000);

/* ================================================================ marshrutlar */
const NAV = [['home', 'home', 'Bosh sahifa'], ['bugun', 'sun', 'Bugun'], ['ertaga', 'calPlus', 'Ertaga'],
  ['maqsadlar', 'target', 'Maqsadlar'], ['profil', 'user', 'Profil'], ['sozlamalar', 'settings', 'Sozlamalar']];
const VIEWS = { home: viewHome, bugun: viewToday, ertaga: viewPlan, maqsadlar: viewGoals, profil: viewProfile, sozlamalar: viewSettings };
const route = () => { const r = location.hash.replace(/^#\/?/, '').split('?')[0]; return VIEWS[r] ? r : 'home'; };
const hashParam = k => new URLSearchParams(location.hash.split('?')[1] || '').get(k);
const go = r => { if (location.hash === '#/' + r) render(); else location.hash = '#/' + r; };

function renderDock() {
  const r = route();
  $('#dock').innerHTML = NAV.map(([k, i, l], n) =>
    `<a href="#/${k}" class="${k === r ? 'on' : ''}" data-label="${l}  ·  Ctrl+${n + 1}" aria-label="${l}">${ic(i)}</a>`).join('');
}
let rendering = 0;
async function render(keepScroll = false) {
  const v = $('#view');
  const top = keepScroll ? v.scrollTop : 0;
  closePopover();
  frameFns = []; secFns = [];
  for (const k of ['onclick', 'onkeydown', 'onchange', 'oninput', 'ondragstart', 'ondragover', 'ondragleave', 'ondrop', 'ondragend']) v[k] = null;
  if (!S.settings.profile) { $('#dock').classList.add('hidden'); v.innerHTML = ''; return showOnboarding(); }
  $('#dock').classList.remove('hidden');
  renderDock();
  const my = ++rendering;
  try {
    await VIEWS[route()](v, () => my === rendering);
  } catch (e) { fail(e); }
  if (keepScroll) v.scrollTop = top;
}
const refresh = () => render(true);
window.addEventListener('hashchange', () => render());
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  if (/^[1-6]$/.test(e.key) && S.settings?.profile) { e.preventDefault(); go(NAV[+e.key - 1][0]); }
  if (e.key.toLowerCase() === 'n' && S.settings?.profile) {
    e.preventDefault();
    const r = route();
    if (r !== 'bugun' && r !== 'ertaga') { go('bugun'); setTimeout(focusAdd, 250); } else focusAdd();
  }
});
function focusAdd() {
  const el = $('.blk.now input[data-add]') || $('input[data-add]');
  if (el) el.focus();
}

/* ================================================================ BOSH SAHIFA */
function viewHome(v) {
  const g = S.main_goal;
  v.innerHTML = `<div class="home">
    <div class="date" id="h-date"></div>
    <div class="clock num"><span id="h-clock">00:00:00</span><span class="ms" id="h-ms">.000</span></div>
    <div class="cd glass"><div class="lbl">Yil tugashiga qolgan vaqt</div><div class="val num" id="h-year"></div></div>
    <div class="cd glass"><div class="lbl">Maqsadimga qolgan kun va vaqt</div>
      ${g ? `<div class="goal">${esc(g.title)} · ${fmtDate(g.end_date)}</div>` : `<div class="goal"><a href="#/maqsadlar">Asosiy maqsad hali qo'yilmagan — qo'yish</a></div>`}
      <div class="val num" id="h-goal">${g ? '' : '—'}</div></div>
  </div>`;
  const eDate = $('#h-date'), eClock = $('#h-clock'), eMs = $('#h-ms'), eYear = $('#h-year'), eGoal = $('#h-goal');
  const goalEnd = g ? (() => { const d = pd(g.end_date); d.setDate(d.getDate() + 1); return d; })() : null;
  let lastDate = '';
  frameFns.push(n => {
    const ds = `${WD[n.getDay()]}, ${n.getDate()}-${MONTHS[n.getMonth()]} ${n.getFullYear()}-yil`;
    if (ds !== lastDate) { eDate.textContent = ds; lastDate = ds; }
    eClock.textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
    eMs.textContent = '.' + pad(n.getMilliseconds(), 3);
    const y = splitMs(new Date(n.getFullYear() + 1, 0, 1) - n);
    eYear.textContent = `${y.d} kun  ${pad(y.h)}:${pad(y.m)}:${pad(y.s)}:${pad(y.ms, 3)}`;
    if (goalEnd) {
      const diff = goalEnd - n;
      if (diff >= 0) {
        const t = splitMs(diff);
        eGoal.textContent = `${t.d} kun  ${pad(t.h)}:${pad(t.m)}:${pad(t.s)}`;
        eGoal.classList.remove('over');
      } else {
        eGoal.textContent = `Muddat ${Math.floor(-diff / 864e5) + 1} kun oldin tugadi`;
        eGoal.classList.add('over');
      }
    }
  });
}

/* ================================================================ umumiy: kun bloklari */
function weight(t) { return t.top ? 3 : (t.goal_id ? 2 : 1); }
function dayScore(tasks) {
  if (!tasks.length) return null;
  const tw = tasks.reduce((a, t) => a + weight(t), 0);
  const dw = tasks.filter(t => t.status === 'done').reduce((a, t) => a + weight(t), 0);
  const p = tw ? dw / tw : 0;
  let lvl = p >= 0.999 ? 4 : p >= 0.8 ? 3 : p >= 0.4 ? 2 : 1;
  let capped = false;
  if (tasks.length < 3 && !tasks.some(t => t.goal_id) && lvl > 2) { lvl = 2; capped = true; }
  return { pct: p, level: lvl, capped };
}
const LVL = { 1: ['Qizil', 'red'], 2: ['Sariq', 'yellow'], 3: ['Yashil', 'green'], 4: ['To\'q yashil', 'green'] };

function currentBlock(D, now) {
  if (D.date !== S.active_day) return null;
  let cur = null;
  for (const b of BLOCKS) if (now >= at(D.date, D.prayers[b])) cur = b;
  return cur;
}
function nextPrayer(D, now) {
  for (const p of ALLP) { const t = at(D.date, D.prayers[p]); if (t > now) return { p, t }; }
  return { p: 'bomdod', t: at(addDays(D.date, 1), D.next_prayers.bomdod) };
}

function taskRow(t, o) {
  const st = t.status;
  const ro = !o.editable || st === 'moved' || st === 'cancelled';
  const chips = [];
  if (t.goal_title) chips.push(`<span class="chip blue">${ic('target')}${esc(t.goal_title)}</span>`.replace('<svg', '<svg style="width:12px;height:12px"'));
  if (t.time) chips.push(`<span class="chip">${esc(t.time)}</span>`);
  if (t.goal_type === 'number' && (t.amount || t.done_amount)) {
    chips.push(`<span class="chip">${st === 'done' ? fnum(t.done_amount) : fnum(t.amount)} ${esc(t.goal_unit || '')}</span>`);
  }
  if (st === 'moved') chips.push('<span class="chip yellow">ko\'chirildi</span>');
  if (st === 'cancelled') chips.push('<span class="chip red">bekor qilindi</span>');
  if (t.note) chips.push(`<span class="chip" title="${esc(t.note)}">izoh</span>`);
  const acts = [];
  if (!ro) {
    acts.push(`<button class="icon-btn" data-act="edit" title="Tahrirlash">${ic('edit')}</button>`);
    if (st === 'todo' && o.canMove) acts.push(`<button class="icon-btn" data-act="tomorrow" title="Ertaga ko'chirish">${ic('right')}</button>`);
    acts.push(`<button class="icon-btn" data-act="del" title="O'chirish">${ic('trash')}</button>`);
  }
  if (o.editable && st === 'cancelled') acts.push(`<button class="icon-btn" data-act="restore" title="Qaytarish">${ic('undo')}</button>`);
  const star = (!ro || t.top) ? `<button class="icon-btn starb ${t.top ? 'on' : ''}" data-act="top" title="Eng muhim" ${ro ? 'disabled' : ''}>${ic('star', t.top ? 'star-fill' : '')}</button>` : '';
  return `<div class="task ${st}" data-id="${t.id}" draggable="${o.dnd && st === 'todo' ? 'true' : 'false'}">
    <button class="cb ${st === 'done' ? 'on' : ''}" data-act="toggle" ${ro ? 'disabled' : ''} title="Bajarildi">${st === 'done' ? ic('check') : ''}</button>
    <div class="tt"><div class="title">${esc(t.title)}</div>${chips.length ? `<div class="meta">${chips.join('')}</div>` : ''}</div>
    ${star}<div class="acts">${acts.join('')}</div></div>`;
}

function blockCard(D, b, o) {
  const tasks = D.tasks.filter(t => t.block === b);
  const ps = D.prayer_log[b] || '';
  const isNow = o.now === b;
  const done = tasks.filter(t => t.status === 'done').length;
  const real = tasks.filter(t => t.status !== 'moved').length;
  return `<div class="blk glass ${isNow ? 'now' : ''}" data-block="${b}">
    <div class="blk-h">
      ${o.prayers ? `<button class="pstat ${ps}" data-act="pstat" data-p="${b}" title="${ps ? PSTAT[ps] : 'Namozni belgilash'}" ${D.prayer_editable ? '' : 'disabled'}>${ps === 'qazo' ? ic('x') : ps ? ic('check') : ''}</button>` : ''}
      <span class="name">${PN[b]}</span><span class="time num">${D.prayers[b]}</span>
      ${b === 'bomdod' ? `<span class="faint small">· Quyosh ${D.prayers.quyosh}</span>` : ''}
      ${isNow ? '<span class="badge-now">HOZIR</span>' : ''}
      <span class="grow"></span>
      ${real ? `<span class="faint small num">${done}/${real}</span>` : ''}
    </div>
    <div class="tasks">${tasks.map(t => taskRow(t, o)).join('')}</div>
    ${o.editable ? `<div class="add"><span class="plus">${ic('plus')}</span><input type="text" data-add="${b}" placeholder="${PN[b]}dan keyin qo'shish…" maxlength="300">
      <button class="icon-btn" data-act="addfull" data-block="${b}" title="Batafsil qo'shish (vaqt, maqsad, ★)">${ic('dots')}</button></div>` : ''}
  </div>`;
}

function taskModal(D, t, block, after) {
  const isNew = !t;
  t = t || { title: '', block, goal_id: null, time: '', amount: 0, top: 0, note: '' };
  const goals = D.goals || [];
  const m = modal(`<h2>${isNew ? 'Yangi ish' : 'Ishni tahrirlash'}</h2><p class="lead">${fmtDay(D.date)}</p>
    <label class="f"><span>Ish nomi</span><input type="text" id="tm-title" value="${esc(t.title)}" maxlength="300" autofocus></label>
    <div class="grid2">
      <label class="f"><span>Qaysi namozdan keyin</span><select id="tm-block">${BLOCKS.map(b => `<option value="${b}" ${b === t.block ? 'selected' : ''}>${PN[b]}dan keyin</option>`).join('')}</select></label>
      <label class="f"><span>Aniq vaqt (ixtiyoriy)</span><input type="time" id="tm-time" value="${esc(t.time || '')}"></label>
    </div>
    <label class="f"><span>Maqsadga bog'lash</span><select id="tm-goal"><option value="">— Maqsadsiz —</option>
      ${goals.map(g => `<option value="${g.id}" ${g.id === t.goal_id ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select></label>
    <label class="f" id="tm-aw"><span>Rejadagi miqdor (<b id="tm-unit"></b>)</span><input type="number" id="tm-amount" min="0" step="any" value="${t.amount || ''}"></label>
    <label class="row" style="margin-bottom:12px;cursor:pointer"><input type="checkbox" id="tm-top" ${t.top ? 'checked' : ''}> Eng muhim 3 ta ishdan biri ★</label>
    <label class="f"><span>Izoh</span><textarea id="tm-note" style="min-height:60px">${esc(t.note || '')}</textarea></label>
    <div class="err" id="tm-err"></div>
    <div class="foot"><button class="btn" data-x="c">Bekor</button><button class="btn primary" data-x="ok">Saqlash</button></div>`);
  const sync = () => {
    const g = goals.find(x => String(x.id) === $('#tm-goal', m.el).value);
    $('#tm-aw', m.el).classList.toggle('hidden', !(g && g.type === 'number'));
    $('#tm-unit', m.el).textContent = g ? g.unit : '';
  };
  sync();
  $('#tm-goal', m.el).addEventListener('change', sync);
  const save = async () => {
    const body = {
      title: $('#tm-title', m.el).value.trim(), block: $('#tm-block', m.el).value, time: $('#tm-time', m.el).value,
      goal_id: $('#tm-goal', m.el).value ? +$('#tm-goal', m.el).value : null, amount: parseFloat($('#tm-amount', m.el).value) || 0,
      top: $('#tm-top', m.el).checked, note: $('#tm-note', m.el).value,
    };
    if (!body.title) { $('#tm-err', m.el).textContent = 'Ish nomini yozing'; return; }
    try {
      if (isNew) await api('POST', '/api/tasks', { ...body, date: D.date });
      else await api('PATCH', `/api/tasks/${t.id}`, body);
      m.close(); after();
    } catch (e) { $('#tm-err', m.el).textContent = e.message; }
  };
  m.el.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; x.dataset.x === 'ok' ? save() : m.close(); });
  $('#tm-title', m.el).addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
}

/* ishlar bilan ishlash — Bugun va Ertaga uchun umumiy hodisalar */
function bindTaskEvents(v, D, o) {
  const task = el => D.tasks.find(t => t.id === +el.closest('.task').dataset.id);
  v.onkeydown = async e => {
    const inp = e.target.closest('input[data-add]');
    if (!inp || e.key !== 'Enter') return;
    const title = inp.value.trim();
    if (!title) return;
    inp.disabled = true;
    try {
      await api('POST', '/api/tasks', { date: D.date, block: inp.dataset.add, title });
      const b = inp.dataset.add;
      await refresh();
      const again = $(`input[data-add="${b}"]`);
      if (again) again.focus();
    } catch (err) { fail(err); inp.disabled = false; }
  };
  return async e => {
    const a = e.target.closest('[data-act]');
    if (!a) return false;
    const act = a.dataset.act;
    try {
      if (act === 'toggle') {
        const t = task(a);
        if (t.status === 'done') await api('PATCH', `/api/tasks/${t.id}`, { status: 'todo' });
        else if (t.goal_type === 'number') {
          const n = await askNumber(`Nechta ${t.goal_unit || ''} bajardingiz?`, `“${t.goal_title}” maqsadi progressiga qo'shiladi.`, t.amount || '');
          if (n == null) return true;
          await api('PATCH', `/api/tasks/${t.id}`, { status: 'done', done_amount: n });
        } else await api('PATCH', `/api/tasks/${t.id}`, { status: 'done' });
        refresh();
      } else if (act === 'top') {
        const t = task(a);
        await api('PATCH', `/api/tasks/${t.id}`, { top: !t.top });
        refresh();
      } else if (act === 'edit') {
        taskModal(D, task(a), null, refresh);
      } else if (act === 'addfull') {
        taskModal(D, null, a.dataset.block, refresh);
      } else if (act === 'tomorrow') {
        const t = task(a);
        await api('POST', `/api/tasks/${t.id}/move`, { to_date: addDays(D.date, 1) });
        toast('Ertaga ko\'chirildi');
        refresh();
      } else if (act === 'restore') {
        await api('POST', `/api/tasks/${task(a).id}/restore`);
        refresh();
      } else if (act === 'del') {
        const t = task(a);
        const fresh = t.created_at && (Date.now() - new Date(t.created_at).getTime() < 10 * 60e3);
        if (D.date <= S.active_day && !fresh) {
          const ok = await confirmBox('Ishni bekor qilish', 'Bu ish “bekor qilindi” deb belgilanadi va bugungi natijada bajarilmagan hisoblanadi. Davom etasizmi?', 'Bekor qilish', true);
          if (!ok) return true;
        }
        await api('DELETE', `/api/tasks/${t.id}`);
        refresh();
      } else if (act === 'pstat') {
        const p = a.dataset.p;
        if (D.date === S.active_day && new Date() < at(D.date, D.prayers[p])) { toast(`${PN[p]} vaqti hali kirmagan (${D.prayers[p]})`); return true; }
        popover(a, [
          { label: 'Vaqtida o\'qildi', v: 'vaqtida', color: 'var(--green)' },
          { label: 'Kech o\'qildi', v: 'kech', color: 'var(--yellow)' },
          { label: 'Qazo bo\'ldi', v: 'qazo', color: 'var(--red)' },
          { label: 'Belgini olib tashlash', v: '', color: 'rgba(255,255,255,.25)' },
        ], async it => {
          try { await api('POST', '/api/prayer-log', { date: D.date, prayer: p, status: it.v }); refresh(); } catch (err) { fail(err); }
        });
      } else return false;
    } catch (err) { fail(err); }
    return true;
  };
}

function bindDnD(v, D, extra) {
  v.ondragstart = e => {
    const el = e.target.closest('[draggable=true]');
    if (!el) return;
    const data = el.dataset.drag ? el.dataset.drag : JSON.stringify({ k: 'task', id: +el.dataset.id });
    e.dataTransfer.setData('text/plain', data);
    e.dataTransfer.effectAllowed = 'move';
  };
  v.ondragover = e => {
    const b = e.target.closest('.blk[data-block]');
    if (!b) return;
    e.preventDefault();
    $$('.blk.drop').forEach(x => x !== b && x.classList.remove('drop'));
    b.classList.add('drop');
  };
  v.ondragleave = e => { const b = e.target.closest('.blk'); if (b && !b.contains(e.relatedTarget)) b.classList.remove('drop'); };
  v.ondragend = () => $$('.blk.drop').forEach(x => x.classList.remove('drop'));
  v.ondrop = async e => {
    const b = e.target.closest('.blk[data-block]');
    if (!b) return;
    e.preventDefault();
    b.classList.remove('drop');
    let d;
    try { d = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (err) { return; }
    const block = b.dataset.block;
    try {
      if (d.k === 'task') {
        const t = D.tasks.find(x => x.id === d.id);
        if (!t || t.block === block) return;
        await api('PATCH', `/api/tasks/${d.id}`, { block });
      } else if (extra) await extra(d, block);
      refresh();
    } catch (err) { fail(err); }
  };
}

/* ================================================================ BUGUN */
async function viewToday(v, alive) {
  const [D, goals] = await Promise.all([api('GET', '/api/day'), api('GET', '/api/goals')]);
  if (!alive()) return;
  const now = new Date();
  const cur = currentBlock(D, now);
  const afterIsha = now >= at(D.date, D.prayers.xufton);
  const o = { editable: D.editable, prayers: true, now: cur, canMove: true, dnd: D.editable };
  const sc = dayScore(D.tasks);
  const real = D.tasks.filter(t => t.status !== 'moved');
  const doneN = real.filter(t => t.status === 'done').length;
  v.innerHTML = `<div class="page">
    <div class="head"><h1>Bugun</h1><span class="sub">${fmtDay(D.date)} · ${hijri(D.date)}</span><span class="grow"></span>
      <button class="btn ${afterIsha ? 'primary' : ''}" data-act="closeday">${ic('flag')} Kunni yakunlash</button></div>
    <div class="cols">
      <div>${BLOCKS.map(b => blockCard(D, b, o)).join('')}</div>
      <div>
        <div class="card glass next-p">
          <div class="muted small" id="np-l"></div>
          <div class="big num" id="np-c"></div>
          <div class="faint small" id="np-t"></div>
          <div style="margin-top:12px">${ALLP.map(p => `<div class="kv small"><span class="${p === cur ? '' : 'muted'}">${PN[p]}${p === cur ? ' · hozir' : ''}</span><span class="num">${D.prayers[p]}</span></div>`).join('')}</div>
        </div>
        <div class="card glass">
          <h3>Bugungi natija</h3>
          ${sc ? `<div class="row" style="margin-bottom:8px"><span class="num" style="font-size:26px;font-weight:600">${pct(sc.pct)}</span>
            <span class="chip ${LVL[sc.level][1]}">${LVL[sc.level][0]}</span></div>
            <div class="bar ${LVL[sc.level][1]}"><i style="width:${Math.round(sc.pct * 100)}%"></i></div>
            <div class="muted small" style="margin-top:8px">${doneN} / ${real.length} ish bajarildi</div>
            ${sc.capped ? '<div class="faint small" style="margin-top:6px">Rejada 3 tadan kam ish va maqsad ishi yo\'q — kun sariqdan yuqori chiqmaydi.</div>' : ''}`
            : '<div class="muted small">Bugun uchun hali ish yo\'q. Blok ostidagi qatorga yozib Enter bosing.</div>'}
        </div>
        ${goals.length ? `<div class="card glass"><h3>Maqsadlar</h3>${goals.map(g => {
          const p = g.progress;
          return `<div style="margin-bottom:12px"><div class="row small"><span class="grow">${g.is_main ? '★ ' : ''}${esc(g.title)}</span><span class="muted num">${pct(p.pct)}</span></div>
            <div class="bar ${p.state === 'behind' ? 'red' : 'green'}" style="margin-top:5px"><i style="width:${Math.min(100, p.pct * 100)}%"></i></div>
            <div class="faint small" style="margin-top:4px">${goalNeedText(g)}</div></div>`;
        }).join('')}</div>` : `<div class="card glass"><h3>Maqsadlar</h3><div class="muted small">Hali maqsad yo'q.</div><a class="btn sm" style="margin-top:10px" href="#/maqsadlar">${ic('plus')} Maqsad qo'yish</a></div>`}
        <div class="faint small" style="padding:0 6px">Maslahat: ishni blokdan blokka sudrab o'tkazish mumkin. Ctrl+N — tez qo'shish.</div>
      </div>
    </div></div>`;
  const handle = bindTaskEvents(v, D, o);
  v.onclick = async e => {
    if (await handle(e)) return;
    const a = e.target.closest('[data-act]');
    if (a && a.dataset.act === 'closeday') closeDayFlow(D);
  };
  bindDnD(v, D);
  const npl = $('#np-l'), npc = $('#np-c'), npt = $('#np-t');
  const tick = n => {
    const np = nextPrayer(D, n);
    npl.textContent = np.p === 'quyosh' ? 'Quyosh chiqishigacha (Bomdod tugashi)' : `${PN[np.p]} namozigacha`;
    const t = splitMs(np.t - n);
    npc.textContent = `${t.d * 24 + t.h}:${pad(t.m)}:${pad(t.s)}`;
    npt.textContent = `${pad(np.t.getHours())}:${pad(np.t.getMinutes())} da`;
    if (currentBlock(D, n) !== cur && D.date === S.active_day) refresh();
  };
  tick(now);
  secFns.push(tick);
}
function goalNeedText(g) {
  const p = g.progress;
  if (p.state === 'done') return 'Maqsadga erishildi!';
  if (p.state === 'over') return 'Muddat tugadi — yakunlang';
  if (p.state === 'future') return `${fmtDate(g.start_date)} dan boshlanadi`;
  if (g.type === 'number') return `Kuniga ${fnum(niceNum(p.per_day, g.unit))} ${esc(g.unit)} kerak · ${p.left_days} kun qoldi`;
  if (g.type === 'habit') return `${p.done}/${p.target} kun · ${p.left_days} kun qoldi`;
  return `${p.done}/${p.target} bosqich · ${p.left_days} kun qoldi`;
}

function closeDayFlow(D) {
  const tomorrow = addDays(D.date, 1);
  const real = D.tasks.filter(t => t.status !== 'moved');
  const doneN = real.filter(t => t.status === 'done').length;
  const m = modal(`<h2>Kunni yakunlash</h2><p class="lead">${fmtDay(D.date)} · ${doneN} / ${real.length} ish bajarildi</p>
    <div id="cd-list"></div>
    <label class="f" style="margin-top:14px"><span>Kun xulosasi — nima yaxshi bo'ldi, nimani o'zgartiraman?</span>
      <textarea id="cd-note" placeholder="Bugun…">${esc(D.day.note || '')}</textarea></label>
    <label class="row small" style="cursor:pointer"><input type="checkbox" id="cd-ex" ${D.day.excused ? 'checked' : ''}> Uzrli kun (kasallik, safar) — profilda kulrang bo'ladi, oyiga 3 tagacha</label>
    <div class="err" id="cd-err"></div>
    <div class="foot"><button class="btn" data-x="c">Yopish</button><button class="btn primary" data-x="ok">Saqlash va ertangi rejaga o'tish ${ic('right')}</button></div>`, { wide: true });
  const renderList = () => {
    const todo = D.tasks.filter(t => t.status === 'todo');
    $('#cd-list', m.el).innerHTML = todo.length ? `<div class="row" style="margin-bottom:6px"><b class="grow">Bajarilmagan ishlar (${todo.length})</b>
        <button class="btn sm" data-x="all">Hammasini ertaga</button></div>
      ${todo.map(t => `<div class="list-item" data-id="${t.id}"><span class="grow">${esc(t.title)} <span class="faint small">· ${PN[t.block]}</span></span>
        <button class="btn sm" data-x="mv">Ertaga ${ic('right')}</button><button class="btn sm danger" data-x="cn">Bekor</button></div>`).join('')}`
      : `<div class="muted">${real.length ? 'Barcha ishlar bajarildi yoki hal qilindi. Barakalla!' : 'Bugun ish rejalashtirilmagan edi.'}</div>`;
  };
  renderList();
  const one = async (id, how) => {
    const t = D.tasks.find(x => x.id === id);
    if (how === 'mv') { await api('POST', `/api/tasks/${id}/move`, { to_date: tomorrow }); t.status = 'moved'; }
    else { const r = await api('DELETE', `/api/tasks/${id}`); t.status = r.deleted ? 'deleted' : 'cancelled'; }
  };
  m.el.addEventListener('click', async e => {
    const x = e.target.closest('[data-x]');
    if (!x) return;
    try {
      if (x.dataset.x === 'c') { m.close(); refresh(); }
      else if (x.dataset.x === 'mv' || x.dataset.x === 'cn') { await one(+x.closest('[data-id]').dataset.id, x.dataset.x); renderList(); }
      else if (x.dataset.x === 'all') { for (const t of D.tasks.filter(t => t.status === 'todo')) await one(t.id, 'mv'); renderList(); }
      else if (x.dataset.x === 'ok') {
        await api('POST', '/api/day', { date: D.date, note: $('#cd-note', m.el).value });
        const ex = $('#cd-ex', m.el).checked;
        if (ex !== !!D.day.excused) await api('POST', '/api/day', { date: D.date, excused: ex });
        m.close();
        go('ertaga');
      }
    } catch (err) { $('#cd-err', m.el).textContent = err.message; }
  });
}

/* ================================================================ ERTAGA */
async function viewPlan(v, alive) {
  const tomorrow = addDays(S.active_day, 1);
  let date = hashParam('d') || tomorrow;
  if (date < tomorrow) date = tomorrow;
  const D = await api('GET', `/api/plan?date=${date}`);
  if (!alive()) return;
  const o = { editable: D.editable, prayers: false, now: null, canMove: false, dnd: true };
  const tops = D.tasks.filter(t => t.top && t.status !== 'moved').length;
  const isT = date === tomorrow;
  v.innerHTML = `<div class="page">
    <div class="head">
      <h1>${isT ? 'Ertaga' : 'Reja'}</h1><span class="sub">${fmtDay(date)} · ${hijri(date)}</span>
      <button class="icon-btn" data-act="prev" title="Oldingi kun" ${isT ? 'disabled style="opacity:.3"' : ''}>${ic('chevL')}</button>
      <button class="icon-btn" data-act="next" title="Keyingi kun">${ic('chevR')}</button>
      ${D.day.plan_closed ? `<span class="chip green">${ic('check').replace('<svg', '<svg style="width:12px;height:12px"')} Reja yopilgan</span>` : '<span class="chip yellow">Reja ochiq</span>'}
      <span class="grow"></span>
      <span class="chip">★ Eng muhim: ${tops}/3</span>
    </div>
    <div class="cols left">
      <div>
        ${isT ? `<div class="card glass"><div class="row"><h3 class="grow" style="margin:0">Bugundan qolganlar</h3>
            ${D.leftovers.length ? `<button class="btn sm" data-act="left-all">Hammasi ${ic('right')}</button>` : ''}</div>
          <div style="margin-top:8px">${D.leftovers.length ? D.leftovers.map((t, i) => `<div class="list-item" draggable="true" data-drag='${JSON.stringify({ k: 'left', id: t.id })}'>
            <span class="grow">${esc(t.title)}<div class="faint small">${PN[t.block]}${t.goal_title ? ' · ' + esc(t.goal_title) : ''}</div></span>
            <button class="icon-btn" data-act="left" data-id="${t.id}" title="Ertaga o'tkazish">${ic('right')}</button></div>`).join('')
            : '<div class="muted small">Bugundan qolgan ish yo\'q.</div>'}</div></div>` : ''}
        <div class="card glass"><h3>Maqsadlardan takliflar</h3>
          ${D.suggestions.length ? D.suggestions.map((s, i) => `<div class="list-item" draggable="true" data-drag='${esc(JSON.stringify({ k: 'sugg', i }))}'>
            <span class="grow">${esc(s.title)}<div class="faint small">${esc(s.goal_title)}</div></span>
            <button class="btn sm" data-act="sugg" data-i="${i}">${ic('plus')} ${PN[s.block]}</button></div>`).join('')
            : `<div class="muted small">${D.goals.length ? 'Barcha maqsadlar uchun ish rejaga qo\'shilgan.' : 'Maqsad qo\'ysangiz, kunlik me\'yorlar shu yerda taklif qilinadi.'}</div>`}
        </div>
        <div class="faint small" style="padding:0 6px">Ishlarni o'ngdagi bloklarga sudrab tashlang. Eng muhim 3 ta ishni ★ bilan belgilang — ular 3 baravar og'ir hisoblanadi.</div>
      </div>
      <div>
        ${BLOCKS.map(b => blockCard(D, b, o)).join('')}
        <div class="row" style="justify-content:flex-end;margin-top:6px">
          ${D.day.plan_closed ? `<button class="btn" data-act="reopen">Rejani qayta ochish</button>` : `<button class="btn primary" data-act="closeplan">${ic('check')} Rejani yopish</button>`}
        </div>
      </div>
    </div></div>`;
  const handle = bindTaskEvents(v, D, o);
  const addSugg = async (i, block) => {
    const s = D.suggestions[i];
    await api('POST', '/api/tasks', { date, block: block || s.block, title: s.title, goal_id: s.goal_id, amount: s.amount });
  };
  const moveLeft = async (id, block) => { await api('POST', `/api/tasks/${id}/move`, { to_date: date, block }); };
  v.onclick = async e => {
    if (await handle(e)) return;
    const a = e.target.closest('[data-act]');
    if (!a) return;
    try {
      const act = a.dataset.act;
      if (act === 'prev') location.hash = '#/ertaga?d=' + addDays(date, -1);
      else if (act === 'next') location.hash = '#/ertaga?d=' + addDays(date, 1);
      else if (act === 'left') { await moveLeft(+a.dataset.id); refresh(); }
      else if (act === 'left-all') { for (const t of D.leftovers) await moveLeft(t.id); toast(`${D.leftovers.length} ta ish o'tkazildi`); refresh(); }
      else if (act === 'sugg') { await addSugg(+a.dataset.i); refresh(); }
      else if (act === 'closeplan') {
        if (!D.tasks.filter(t => t.status !== 'moved').length) { toast('Avval kamida bitta ish qo\'shing', true); return; }
        if (!tops && !(await confirmBox('Eng muhim ishlar belgilanmagan', 'Eng muhim 3 ta ishni ★ bilan belgilash tavsiya qilinadi. Shunday yopilsinmi?', 'Ha, yopish'))) return;
        await api('POST', '/api/day', { date, plan_closed: true });
        toast('Reja yopildi. Ertaga omad!');
        refresh();
      } else if (act === 'reopen') { await api('POST', '/api/day', { date, plan_closed: false }); refresh(); }
    } catch (err) { fail(err); }
  };
  bindDnD(v, D, async (d, block) => {
    if (d.k === 'left') await moveLeft(d.id, block);
    else if (d.k === 'sugg') await addSugg(d.i, block);
  });
}

/* ================================================================ MAQSADLAR */
async function viewGoals(v, alive) {
  const all = await api('GET', '/api/goals?all=1');
  if (!alive()) return;
  const active = all.filter(g => g.status === 'active');
  const closed = all.filter(g => g.status !== 'active');
  v.innerHTML = `<div class="page">
    <div class="head"><h1>Maqsadlar</h1><span class="sub">${active.length}/3 faol</span><span class="grow"></span>
      <button class="btn primary" data-act="new">${ic('plus')} Yangi maqsad</button></div>
    ${active.length ? `<div class="goals">${active.map(goalCard).join('')}</div>` : `<div class="card glass empty">
      <h2>Birinchi maqsadingizni qo'ying</h2>
      <p class="muted" style="max-width:520px;margin:0 auto 16px">Maqsad — muddati bor natija. Dastur uni kunlik me'yorlarga bo'ladi, har kecha ertangi rejaga taklif qiladi va
      rejadan oldindamisiz yoki orqadamisiz — ko'rsatib turadi. Bir vaqtda ko'pi bilan 3 ta maqsad.</p>
      <button class="btn primary" data-act="new">${ic('plus')} Maqsad qo'yish</button></div>`}
    ${closed.length ? `<div class="card glass" style="margin-top:18px"><h3>Yakunlangan maqsadlar</h3>
      ${closed.map(g => `<div class="list-item"><span class="grow"><b>${esc(g.title)}</b>
        <span class="chip ${g.status === 'achieved' ? 'green' : 'red'}" style="margin-left:6px">${g.status === 'achieved' ? 'Erishildi' : 'Erishilmadi'}</span>
        <div class="faint small">${g.closed_at ? fmtDate(g.closed_at.slice(0, 10)) : ''}${g.close_note ? ' · ' + esc(g.close_note) : ''}</div></span>
        <button class="btn sm" data-act="reopen" data-id="${g.id}">Qayta faollashtirish</button>
        <button class="icon-btn" data-act="gdel" data-id="${g.id}" title="O'chirish">${ic('trash')}</button></div>`).join('')}</div>` : ''}
  </div>`;
  v.onclick = async e => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const id = +(a.dataset.id || a.closest('[data-gid]')?.dataset.gid || 0);
    const g = all.find(x => x.id === id);
    try {
      switch (a.dataset.act) {
        case 'new':
          if (active.length >= 3) { toast('Bir vaqtda ko\'pi bilan 3 ta faol maqsad. Avval bittasini yakunlang.', true); return; }
          goalForm(null, refresh); break;
        case 'edit': goalForm(g, refresh); break;
        case 'main': await api('PATCH', `/api/goals/${id}`, { is_main: true }); await loadState(); refresh(); break;
        case 'close': closeGoal(g); break;
        case 'gdel':
          if (await confirmBox('Maqsadni o\'chirish', `“${g.title}” va uning progress tarixi o'chadi. Unga bog'langan ishlar saqlanib qoladi.`, 'O\'chirish', true)) {
            await api('DELETE', `/api/goals/${id}`); await loadState(); refresh();
          }
          break;
        case 'reopen': await api('PATCH', `/api/goals/${id}`, { status: 'active' }); await loadState(); refresh(); break;
        case 'prog': {
          const inp = $(`input[data-prog="${id}"]`);
          const n = parseFloat(inp.value);
          if (!n) { toast('Miqdorni kiriting', true); return; }
          await api('POST', `/api/goals/${id}/progress`, { amount: n }); toast('Qo\'shildi'); refresh(); break;
        }
        case 'habit': await api('POST', `/api/goals/${id}/progress`, {}); toast('Bugun belgilandi'); refresh(); break;
        case 'ms': await api('PATCH', `/api/milestones/${a.dataset.mid}`, { done: !a.classList.contains('on') }); refresh(); break;
        case 'msdel': await api('DELETE', `/api/milestones/${a.dataset.mid}`); refresh(); break;
      }
    } catch (err) { fail(err); }
  };
  v.onkeydown = async e => {
    if (e.key !== 'Enter') return;
    const ms = e.target.closest('input[data-ms]');
    const pr = e.target.closest('input[data-prog]');
    try {
      if (ms && ms.value.trim()) { await api('POST', `/api/goals/${ms.dataset.ms}/milestones`, { title: ms.value.trim() }); await refresh(); const again = $(`input[data-ms="${ms.dataset.ms}"]`); again && again.focus(); }
      if (pr) $(`[data-act="prog"][data-id="${pr.dataset.prog}"]`).click();
    } catch (err) { fail(err); }
  };
}

function goalCard(g) {
  const p = g.progress;
  const stateChip = { ahead: ['Rejadan oldinda', 'green'], ontrack: ['Rejada', 'blue'], behind: ['Rejadan orqada', 'red'],
    done: ['Erishildi!', 'green'], over: ['Muddat tugadi', 'red'], future: ['Hali boshlanmagan', ''] }[p.state];
  const unit = g.type === 'number' ? g.unit : g.type === 'habit' ? 'kun' : 'bosqich';
  const exp = p.target ? Math.min(100, p.expected / p.target * 100) : 0;
  let diff = '';
  if (g.type !== 'project' && p.state === 'behind') diff = `Rejadan ${fnum(Math.abs(p.diff))} ${esc(unit)} orqadasiz`;
  else if (g.type !== 'project' && p.state === 'ahead') diff = `Rejadan ${fnum(p.diff)} ${esc(unit)} oldindasiz`;
  const need = g.type === 'number' ? `${fnum(niceNum(p.per_day, g.unit))} ${esc(g.unit)}` : g.type === 'habit' ? (g.daily_minutes ? `${g.daily_minutes} daq` : 'har kuni') : (p.target ? `${p.target - p.done} ta` : '—');
  let body = '';
  if (g.type === 'number') {
    body = `<div class="row"><input type="number" min="0" step="any" data-prog="${g.id}" placeholder="Masalan 10" style="max-width:150px">
      <span class="muted">${esc(g.unit)}</span><button class="btn sm" data-act="prog" data-id="${g.id}">${ic('plus')} Qo'shish</button></div>`;
  } else if (g.type === 'habit') {
    body = `<div class="row"><button class="btn sm" data-act="habit" data-id="${g.id}">${ic('check')} Bugun bajarildi</button>
      <span class="faint small">Yoki “Bugun” paneldagi bog'langan ishni belgilang</span></div>`;
  } else {
    body = `<div>${(p.milestones || []).map(m => `<div class="ms-item ${m.done ? 'done' : ''}">
        <button class="cb ${m.done ? 'on' : ''}" data-act="ms" data-mid="${m.id}">${m.done ? ic('check') : ''}</button>
        <span class="grow">${esc(m.title)}</span><button class="icon-btn" data-act="msdel" data-mid="${m.id}" title="O'chirish">${ic('x')}</button></div>`).join('')}
      <div class="add" style="margin-left:0"><span class="plus">${ic('plus')}</span><input type="text" data-ms="${g.id}" placeholder="Yangi bosqich… (Enter)"></div></div>`;
  }
  return `<div class="goal glass" data-gid="${g.id}">
    <div class="row" style="align-items:flex-start">
      <button class="icon-btn ${g.is_main ? 'on' : ''}" data-act="main" data-id="${g.id}" title="${g.is_main ? 'Asosiy maqsad (Bosh sahifada)' : 'Asosiy qilish'}">${ic('star', g.is_main ? 'star-fill' : '')}</button>
      <div class="grow"><div class="gt">${esc(g.title)}</div>
        <div class="chips" style="margin-top:6px"><span class="chip">${GTYPE[g.type]}</span>${g.area ? `<span class="chip">${esc(g.area)}</span>` : ''}
          ${stateChip ? `<span class="chip ${stateChip[1]}">${stateChip[0]}</span>` : ''}${g.is_main ? '<span class="chip">Bosh sahifada</span>' : ''}</div></div>
      <button class="icon-btn" data-act="edit" data-id="${g.id}" title="Tahrirlash">${ic('edit')}</button>
      <button class="icon-btn" data-act="close" data-id="${g.id}" title="Yakunlash">${ic('flag')}</button>
      <button class="icon-btn" data-act="gdel" data-id="${g.id}" title="O'chirish">${ic('trash')}</button>
    </div>
    ${g.why ? `<div class="why">“${esc(g.why)}”</div>` : ''}
    ${g.description ? `<div class="muted small">${esc(g.description)}</div>` : ''}
    <div><div class="row small" style="margin-bottom:6px"><span class="grow num"><b style="font-size:16px">${fnum(p.done)}</b> / ${fnum(p.target)} ${esc(unit)}</span>
      <span class="num muted">${pct(p.pct)}</span></div>
      <div class="bar ${p.state === 'behind' || p.state === 'over' ? 'red' : 'green'}"><i style="width:${Math.min(100, p.pct * 100)}%"></i>${p.state !== 'done' && exp > 0 ? `<b style="left:${exp}%" title="Shu kungacha bo'lishi kerak edi"></b>` : ''}</div>
      ${diff ? `<div class="small ${p.state === 'behind' ? '' : 'muted'}" style="margin-top:6px;color:${p.state === 'behind' ? '#ffb4ae' : ''}">${diff}</div>` : ''}</div>
    <div class="stats">
      <div class="stat"><div class="l">Kuniga kerak</div><div class="v num">${need}</div></div>
      <div class="stat"><div class="l">Qolgan kun</div><div class="v num">${p.left_days}</div></div>
      <div class="stat"><div class="l">Shu sur'atda yetasiz</div><div class="v num" style="font-size:14px;padding-top:2px">${p.state === 'done' ? 'Erishildi' : p.forecast ? fmtDate(p.forecast) : '—'}</div></div>
    </div>
    ${body}
    <div class="faint small">${fmtDate(g.start_date)} → ${fmtDate(g.end_date)} · ${p.total_days} kun${g.block ? ' · ' + PN[g.block] + 'dan keyin' : ''}</div>
  </div>`;
}

function goalForm(g, after) {
  const isNew = !g;
  const ad = S.active_day;
  g = g || { title: '', type: 'number', description: '', why: '', area: '', start_date: ad, end_date: addDays(ad, 89), target: '', unit: 'bet', daily_title: '', daily_minutes: '', block: '', milestones: [] };
  const areas = [...new Set([...(S.settings.profile?.areas || []), ...AREAS])];
  const m = modal(`<h2>${isNew ? 'Yangi maqsad' : 'Maqsadni tahrirlash'}</h2><p class="lead">Aniq, o'lchanadigan va muddati bor bo'lsin.</p>
    <label class="f"><span>Maqsad nomi</span><input type="text" id="g-title" value="${esc(g.title)}" placeholder="Masalan: IELTS 7.0 olish" maxlength="200" autofocus></label>
    ${isNew ? `<label class="f"><span>Turi</span><div class="seg" id="g-type">
      <button data-v="number">Raqamli</button><button data-v="habit">Muntazam (odat)</button><button data-v="project">Bosqichli</button></div>
      <div class="faint small" id="g-type-help" style="margin-top:6px"></div></label>` : `<input type="hidden" id="g-typev" value="${g.type}">`}
    <div id="g-number" class="grid2">
      <label class="f"><span>Qancha? (jami)</span><input type="number" id="g-target" min="1" step="any" value="${g.target || ''}" placeholder="300"></label>
      <label class="f"><span>Birligi</span><input type="text" id="g-unit" value="${esc(g.unit || '')}" list="g-units" placeholder="bet"><datalist id="g-units">
        ${['bet', 'pora', "so'z", 'dars', 'masala', 'soat', 'km', "so'm", 'ta'].map(u => `<option value="${u}">`).join('')}</datalist></label>
    </div>
    <div id="g-habit" class="grid2">
      <label class="f"><span>Har kungi ish nomi</span><input type="text" id="g-dtitle" value="${esc(g.daily_title || '')}" placeholder="Ingliz tili"></label>
      <label class="f"><span>Necha daqiqa?</span><input type="number" id="g-dmin" min="0" value="${g.daily_minutes || ''}" placeholder="60"></label>
    </div>
    ${isNew ? `<label class="f" id="g-project"><span>Bosqichlar (har birini yangi qatordan yozing)</span><textarea id="g-ms" placeholder="1. Dizayn&#10;2. Kod yozish&#10;3. Sinov"></textarea></label>` : ''}
    <div class="grid2">
      <label class="f"><span>Boshlanish</span><input type="date" id="g-start" value="${g.start_date}"></label>
      <label class="f"><span>Muddat (tugash sanasi)</span><input type="date" id="g-end" value="${g.end_date}"></label>
    </div>
    <div class="chips" style="margin:-4px 0 14px">${[30, 60, 90, 180, 365].map(n => `<span class="chip pick" data-days="${n}">${n} kun</span>`).join('')}</div>
    <div class="grid2">
      <label class="f"><span>Yo'nalish</span><select id="g-area"><option value="">—</option>${areas.map(a => `<option ${a === g.area ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></label>
      <label class="f"><span>Odatda qaysi blokda bajarasiz?</span><select id="g-block"><option value="">—</option>${BLOCKS.map(b => `<option value="${b}" ${b === g.block ? 'selected' : ''}>${PN[b]}dan keyin</option>`).join('')}</select></label>
    </div>
    <label class="f"><span>Nima uchun? — bu maqsad sizga nega muhim</span><textarea id="g-why" style="min-height:60px" placeholder="Chet elda o'qish uchun…">${esc(g.why || '')}</textarea></label>
    <label class="f"><span>Tavsif (ixtiyoriy)</span><textarea id="g-desc" style="min-height:60px">${esc(g.description || '')}</textarea></label>
    ${isNew ? `<label class="row small" style="cursor:pointer"><input type="checkbox" id="g-main"> Asosiy maqsad — Bosh sahifada vaqti ko'rinadi</label>` : ''}
    <div class="err" id="g-err"></div>
    <div class="foot"><button class="btn" data-x="c">Bekor</button><button class="btn primary" data-x="ok">Saqlash</button></div>`, { wide: true });
  let type = g.type;
  const HELP = { number: 'Raqam bilan o\'lchanadi: 300 bet, 1000 so\'z, 50 dars. Dastur kunlik me\'yorni o\'zi hisoblaydi.',
    habit: 'Har kuni takrorlanadi: “har kuni 1 soat ingliz tili, 90 kun”. Har kungi rejaga o\'zi taklif qilinadi.',
    project: 'Bosqichlarga bo\'linadi: “dasturni yaratish” → dizayn, kod, sinov. Har bosqichni belgilaysiz.' };
  const sync = () => {
    $$('#g-type button', m.el).forEach(b => b.classList.toggle('on', b.dataset.v === type));
    if ($('#g-type-help', m.el)) $('#g-type-help', m.el).textContent = HELP[type];
    $('#g-number', m.el).classList.toggle('hidden', type !== 'number');
    $('#g-habit', m.el).classList.toggle('hidden', type !== 'habit');
    if ($('#g-project', m.el)) $('#g-project', m.el).classList.toggle('hidden', type !== 'project');
  };
  sync();
  const save = async () => {
    const body = {
      title: $('#g-title', m.el).value.trim(), type, start_date: $('#g-start', m.el).value, end_date: $('#g-end', m.el).value,
      target: parseFloat($('#g-target', m.el).value) || 0, unit: $('#g-unit', m.el).value.trim(),
      daily_title: $('#g-dtitle', m.el).value.trim(), daily_minutes: parseInt($('#g-dmin', m.el).value, 10) || 0,
      area: $('#g-area', m.el).value, block: $('#g-block', m.el).value, why: $('#g-why', m.el).value.trim(), description: $('#g-desc', m.el).value.trim(),
    };
    const err = t => { $('#g-err', m.el).textContent = t; };
    if (!body.title) return err('Maqsad nomini yozing');
    if (!body.start_date || !body.end_date) return err('Sanalarni kiriting');
    if (body.end_date < body.start_date) return err('Tugash sanasi boshlanishdan keyin bo\'lsin');
    if (type === 'number' && !(body.target > 0)) return err('Jami miqdorni kiriting, masalan 300');
    if (type === 'number' && !body.unit) return err('Birligini yozing, masalan “bet”');
    if (isNew) {
      body.is_main = $('#g-main', m.el).checked;
      if (type === 'project') body.milestones = $('#g-ms', m.el).value.split('\n').map(s => s.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
      if (type === 'habit') body.target = 0;
    } else { delete body.type; if (type === 'habit') delete body.target; }
    try {
      if (isNew) await api('POST', '/api/goals', body); else await api('PATCH', `/api/goals/${g.id}`, body);
      await loadState();
      m.close(); after && after();
      toast(isNew ? 'Maqsad qo\'yildi. Omad!' : 'Saqlandi');
    } catch (e) { err(e.message); }
  };
  m.el.addEventListener('click', e => {
    const t = e.target.closest('#g-type button');
    if (t) { type = t.dataset.v; sync(); return; }
    const d = e.target.closest('[data-days]');
    if (d) { const s = $('#g-start', m.el).value || ad; $('#g-end', m.el).value = addDays(s, +d.dataset.days - 1); return; }
    const x = e.target.closest('[data-x]');
    if (x) x.dataset.x === 'ok' ? save() : m.close();
  });
}

function closeGoal(g) {
  let st = g.progress.state === 'done' ? 'achieved' : 'failed';
  const m = modal(`<h2>Maqsadni yakunlash</h2><p class="lead">${esc(g.title)}</p>
    <div class="seg" id="cg" style="margin-bottom:14px"><button data-v="achieved">Erishildi</button><button data-v="failed">Erishilmadi</button></div>
    <label class="f"><span>Xulosa — nimani o'rgandim, keyingi safar nimani boshqacha qilaman?</span><textarea id="cg-note" autofocus></textarea></label>
    <div class="err" id="cg-err"></div>
    <div class="foot"><button class="btn" data-x="c">Bekor</button><button class="btn primary" data-x="ok">Yakunlash</button></div>`);
  const sync = () => $$('#cg button', m.el).forEach(b => b.classList.toggle('on', b.dataset.v === st));
  sync();
  m.el.addEventListener('click', async e => {
    const b = e.target.closest('#cg button');
    if (b) { st = b.dataset.v; sync(); return; }
    const x = e.target.closest('[data-x]');
    if (!x) return;
    if (x.dataset.x === 'c') return m.close();
    try {
      await api('PATCH', `/api/goals/${g.id}`, { status: st, close_note: $('#cg-note', m.el).value });
      await loadState(); m.close(); refresh();
      toast(st === 'achieved' ? 'Tabriklaymiz! Maqsadga erishdingiz.' : 'Yakunlandi. Xulosa keyingi maqsad uchun saqlandi.');
    } catch (err) { $('#cg-err', m.el).textContent = err.message; }
  });
}

/* ================================================================ PROFIL */
function birthDate() {
  const p = S.settings.profile;
  const d = pd(p.birth_date);
  if (p.birth_time) { const [h, mi] = p.birth_time.split(':').map(Number); d.setHours(h, mi); }
  return d;
}
function nextBirthday(birth, now) {
  const mk = y => { let day = birth.getDate(); if (birth.getMonth() === 1 && day === 29 && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) day = 28; const d = new Date(y, birth.getMonth(), day, birth.getHours(), birth.getMinutes()); return d; };
  let nb = mk(now.getFullYear());
  if (nb <= now) nb = mk(now.getFullYear() + 1);
  return nb;
}

function heatGrid(cells, start, endDay, kind) {
  const all = [...cells];
  let last = pd(all[all.length - 1].date);
  while (last.getDay() !== 0) { last.setDate(last.getDate() + 1); all.push({ date: iso(last), future: true }); }
  const cols = Math.ceil(all.length / 7);
  let months = '', prevM = -1;
  for (let c = 0; c < cols; c++) {
    const d = pd(all[c * 7].date);
    const m = d.getMonth();
    months += `<span>${m !== prevM && d.getDate() <= 7 ? MSHORT[m] : ''}</span>`;
    prevM = m;
  }
  const cls = c => {
    if (c.future) return 'future';
    if (c.level == null) return 'nil';
    if (kind === 'p') return 'l' + c.level;
    if (c.excused) return 'ex';
    if (c.noplan && !c.live) return 'np';
    return 'l' + c.level + (c.live ? ' live' : '');
  };
  const tip = c => {
    if (c.future || c.level == null) return '';
    const d = fmtDate(c.date);
    if (kind === 'p') return `${d}: ${c.level === 4 ? '5/5 vaqtida' : c.level === 2 ? 'kech o\'qilgan bor' : c.level === 1 ? 'qazo bor' : `${c.n || 0}/5 belgilangan`}`;
    if (c.excused) return `${d}: uzrli kun`;
    if (c.noplan) return c.live ? `${d}: bugun — hali ish yo'q` : `${d}: reja tuzilmagan`;
    return `${d}: ${pct(c.pct)}${c.capped ? ' (sariq bilan cheklangan)' : ''}${c.live ? ' — davom etmoqda' : ''}`;
  };
  return `<div class="row heat-box" data-cols="${cols}" style="align-items:flex-start"><div class="heat-days"><span>Du</span><span></span><span>Ch</span><span></span><span>Ju</span><span></span><span>Ya</span></div>
    <div class="heat-wrap"><div class="heat-months" style="grid-template-columns:repeat(${cols},var(--cs))">${months}</div>
    <div class="heat">${all.map(c => `<i class="${cls(c)}" data-date="${c.future || c.level == null ? '' : c.date}" title="${tip(c)}"></i>`).join('')}</div></div></div>`;
}

function fitHeat() {
  for (const box of $$('.heat-box')) {
    const cols = +box.dataset.cols;
    const w = box.parentElement.clientWidth - 40;
    const cs = Math.max(10, Math.min(22, Math.floor(w / cols) - 3));
    box.style.setProperty('--cs', cs + 'px');
  }
}

async function viewProfile(v, alive) {
  const P = await api('GET', '/api/profile');
  if (!alive()) return;
  const prof = S.settings.profile;
  const st = P.stats;
  const look = S.settings.look;
  const birth = birthDate();
  const trend = st.last7 != null && st.prev7 != null ? Math.round((st.last7 - st.prev7) * 100) : null;
  v.innerHTML = `<div class="page">
    <div class="head"><h1>Profil</h1><span class="sub">natijalar va xulosalar</span></div>
    <div class="card glass"><div class="profile-top">
      <div class="avatar">${esc((prof.name || '?')[0].toUpperCase())}</div>
      <div><div style="font-size:22px;font-weight:600">${esc(prof.name)}</div><div class="muted small">${fmtDate(prof.birth_date)} da tug'ilgan${(prof.areas || []).length ? ' · ' + prof.areas.map(esc).join(', ') : ''}</div></div>
      <span class="grow"></span>
      <div><div class="muted small">Yoshingiz</div><div class="age-big num" id="p-age"></div></div>
      <div><div class="muted small">Yashalgan kunlar</div><div class="age-big num" id="p-lived"></div></div>
      <div><div class="muted small" id="p-nbl"></div><div class="age-big num" id="p-nb"></div></div>
    </div></div>
    <div class="stat-cards">
      <div class="stat-card glass"><div class="l">Ketma-ket yashil kunlar</div><div class="v num">${st.streak}</div><div class="s">eng uzuni: ${st.best} kun</div></div>
      <div class="stat-card glass"><div class="l">Oxirgi 7 kun</div><div class="v num">${pct(st.last7)}</div><div class="s">${trend == null ? 'oldingi hafta bilan solishtirish uchun ma\'lumot kam' : (trend >= 0 ? '+' : '') + trend + '% oldingi 7 kunga nisbatan'}</div></div>
      <div class="stat-card glass"><div class="l">Oxirgi 30 kun</div><div class="v num" style="font-size:18px;padding-top:6px">
        <span style="color:var(--green)">${st.counts30[3] + st.counts30[4]}</span> · <span style="color:var(--yellow)">${st.counts30[2]}</span> · <span style="color:var(--red)">${st.counts30[1]}</span></div><div class="s">yashil · sariq · qizil kunlar</div></div>
      <div class="stat-card glass"><div class="l">Namozlar vaqtida</div><div class="v num">${pct(st.prayer_on_time)}</div><div class="s">oxirgi 30 kun, belgilanganlardan</div></div>
    </div>
    <div class="card glass"><h3>Faollik <span class="muted">— oxirgi 12 oy · katakni bosib o'sha kunni ko'ring</span></h3>
      ${heatGrid(P.cells, P.start, P.active_day, 't')}
      <div class="legend"><span><i style="background:var(--green)"></i>100%</span><span><i style="background:var(--green-2)"></i>80–99%</span>
        <span><i style="background:var(--yellow)"></i>40–79%</span><span><i style="background:var(--red)"></i>0–39%</span>
        <span><i style="box-shadow:inset 0 0 0 2px var(--red)"></i>Reja tuzilmagan</span><span><i style="background:#8e8e93"></i>Uzrli</span>
        <span><i style="background:rgba(255,255,255,.13);outline:2px solid #fff;outline-offset:1px"></i>Bugun</span></div>
      <div class="faint small" style="margin-top:8px">Ball = bajarilgan ishlar og'irligi ÷ rejadagi ishlar og'irligi. Og'irlik: ★ eng muhim — 3, maqsad ishi — 2, oddiy — 1.
        Ko'chirilgan va bekor qilingan ishlar bajarilmagan hisoblanadi. Kun keyingi Bomdodda qulflanadi.</div>
    </div>
    <div class="card glass"><h3>Namozlar</h3>
      ${heatGrid(P.prayer_cells, P.start, P.active_day, 'p')}
      <div class="legend"><span><i style="background:var(--green)"></i>5/5 vaqtida</span><span><i style="background:var(--yellow)"></i>Kech o'qilgani bor</span>
        <span><i style="background:var(--red)"></i>Qazo bor</span><span><i style="background:rgba(255,255,255,.13)"></i>To'liq belgilanmagan</span></div>
    </div>
    <div class="cols">
      <div class="card glass"><h3>Tahlil va xulosalar</h3>
        ${P.insights.length ? P.insights.map(i => `<div class="insight"><span class="dot" style="background:${i.kind === 'good' ? 'var(--green)' : 'var(--yellow)'}"></span>
          <div><div>${esc(i.text)}</div><div class="tip">${esc(i.tip)}</div></div></div>`).join('')
          : '<div class="muted">Xulosalar bir necha kunlik ma\'lumotdan keyin paydo bo\'ladi. Har kuni reja tuzing va belgilang.</div>'}
      </div>
      <div class="card glass"><h3>Bosh sahifa foni</h3>
        <div class="wall-prev"></div>
        <div class="row wrap" style="margin-bottom:14px">
          <button class="btn sm" data-act="wall">${ic('image')} Rasm tanlash</button>
          ${look.wallpaper ? `<button class="btn sm" data-act="wall-del">${ic('trash')} Olib tashlash</button>` : ''}
          <input type="file" id="wall-file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden">
        </div>
        <label class="f"><span>Qorong'ilashtirish: <b id="dimv">${Math.round(look.dim * 100)}%</b></span><input type="range" id="dim" min="0" max="80" step="1" value="${Math.round(look.dim * 100)}"></label>
        <label class="f"><span>Xiralik (blur): <b id="blurv">${look.blur}px</b></span><input type="range" id="blur" min="0" max="60" step="1" value="${look.blur}"></label>
        <label class="row small" style="cursor:pointer"><input type="checkbox" id="lite" ${look.lite ? 'checked' : ''}> Yengil rejim — blursiz, eski kompyuterda tezroq</label>
      </div>
    </div>
    ${P.closed_goals.length ? `<div class="card glass"><h3>Yakunlangan maqsadlar</h3>${P.closed_goals.map(g => `<div class="list-item"><span class="chip ${g.status === 'achieved' ? 'green' : 'red'}">${g.status === 'achieved' ? 'Erishildi' : 'Erishilmadi'}</span>
      <span class="grow">${esc(g.title)}${g.close_note ? `<div class="faint small">${esc(g.close_note)}</div>` : ''}</span></div>`).join('')}</div>` : ''}
  </div>`;
  fitHeat();
  applyLook();
  $$('.heat-wrap').forEach(w => { w.scrollLeft = w.scrollWidth; });
  window.onresize = () => { if (route() === 'profil') fitHeat(); };
  const eAge = $('#p-age'), eLived = $('#p-lived'), eNb = $('#p-nb'), eNbl = $('#p-nbl');
  frameFns.push(n => {
    const ms = n - birth;
    eAge.textContent = (ms / 31556952000).toFixed(9).replace('.', ',');
    eLived.textContent = grp(Math.floor(ms / 864e5));
    const nb = nextBirthday(birth, n);
    const t = splitMs(nb - n);
    eNbl.textContent = `${nb.getFullYear() - birth.getFullYear()} yoshga to'lishingizga`;
    eNb.textContent = `${t.d} kun ${pad(t.h)}:${pad(t.m)}:${pad(t.s)}`;
  });
  const saveLook = async patch => {
    try { const s = await api('PUT', '/api/settings', { look: patch }); S.settings = s; applyLook(); } catch (e) { fail(e); }
  };
  v.oninput = e => {
    if (e.target.id === 'dim') { $('#dimv').textContent = e.target.value + '%'; document.documentElement.style.setProperty('--dim', e.target.value / 100); }
    if (e.target.id === 'blur') { $('#blurv').textContent = e.target.value + 'px'; document.documentElement.style.setProperty('--blur', e.target.value + 'px'); }
  };
  v.onchange = async e => {
    if (e.target.id === 'dim') saveLook({ dim: e.target.value / 100 });
    if (e.target.id === 'blur') saveLook({ blur: +e.target.value });
    if (e.target.id === 'lite') saveLook({ lite: e.target.checked });
    if (e.target.id === 'wall-file') {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 30 * 1024 * 1024) { toast('Rasm 30 MB dan katta bo\'lmasin', true); return; }
      try { S.settings = await Backend.setWallpaper(f); await applyLook(); toast('Fon rasmi o\'rnatildi'); refresh(); } catch (err) { fail(err); }
    }
  };
  v.onclick = async e => {
    const cell = e.target.closest('.heat i[data-date]');
    if (cell && cell.dataset.date) return dayArchive(cell.dataset.date);
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'wall') $('#wall-file').click();
    if (a.dataset.act === 'wall-del') { try { S.settings = await Backend.deleteWallpaper(); await applyLook(); refresh(); } catch (err) { fail(err); } }
  };
}

async function dayArchive(ds) {
  try {
    const A = await api('GET', `/api/day-archive?date=${ds}`);
    const sc = A.score;
    const lvl = sc.excused ? ['Uzrli kun', ''] : sc.noplan ? ['Reja tuzilmagan', 'red'] : LVL[sc.level];
    modal(`<h2>${fmtDay(ds)}</h2><p class="lead">${fmtDate(ds)} · ${hijri(ds)} ${lvl ? `<span class="chip ${lvl[1]}" style="margin-left:6px">${lvl[0]}${sc.pct != null ? ' · ' + pct(sc.pct) : ''}</span>` : ''}</p>
      <div class="chips" style="margin-bottom:14px">${BLOCKS.map(b => { const s = A.prayer_log[b]; return `<span class="chip ${s === 'vaqtida' ? 'green' : s === 'kech' ? 'yellow' : s === 'qazo' ? 'red' : ''}">${PN[b]} ${A.prayers[b]}${s ? ' · ' + PSTAT[s] : ''}</span>`; }).join('')}</div>
      ${BLOCKS.map(b => { const ts = A.tasks.filter(t => t.block === b); return ts.length ? `<div style="margin-bottom:10px"><b>${PN[b]}dan keyin</b>
        ${ts.map(t => `<div class="list-item"><span style="width:20px;color:${t.status === 'done' ? 'var(--green)' : 'var(--red)'}">${t.status === 'done' ? '✓' : t.status === 'moved' ? '→' : '✕'}</span>
          <span class="grow ${t.status === 'done' ? '' : 'muted'}">${esc(t.title)}${t.top ? ' ★' : ''}${t.goal_title ? `<span class="faint small"> · ${esc(t.goal_title)}</span>` : ''}</span>
          <span class="faint small">${t.status === 'done' ? 'bajarildi' : t.status === 'moved' ? 'ko\'chirildi' : t.status === 'cancelled' ? 'bekor' : 'bajarilmadi'}</span></div>`).join('')}</div>` : ''; }).join('') || '<div class="muted">Bu kun uchun ish yozilmagan.</div>'}
      ${A.day.note ? `<div class="card" style="background:rgba(0,0,0,.2);border-radius:14px;margin-top:10px"><div class="muted small">Kun xulosasi</div>${esc(A.day.note)}</div>` : ''}
      <div class="foot"><button class="btn" data-x="c">Yopish</button></div>`, { wide: true }).el.addEventListener('click', function (e) {
      if (e.target.closest('[data-x]')) this.closest('.modal-bg').remove();
    });
  } catch (e) { fail(e); }
}

/* ================================================================ SOZLAMALAR */
async function viewSettings(v, alive) {
  await loadState();
  if (!alive()) return;
  const s = S.settings, p = s.profile, pr = s.prayer, n = s.notify;
  const areas = [...new Set([...AREAS, ...(p.areas || [])])];
  v.innerHTML = `<div class="page" style="max-width:900px">
    <div class="head"><h1>Sozlamalar</h1></div>
    <div class="card glass"><h3>Profil</h3>
      <div class="grid2"><label class="f"><span>Ism</span><input type="text" id="s-name" value="${esc(p.name)}"></label>
        <div class="grid2"><label class="f"><span>Tug'ilgan sana</span><input type="date" id="s-bd" value="${p.birth_date}"></label>
        <label class="f"><span>Tug'ilgan soat (ixtiyoriy)</span><input type="time" id="s-bt" value="${p.birth_time || ''}"></label></div></div>
      <div class="grid2"><label class="f"><span>Odatda turish vaqti</span><input type="time" id="s-wake" value="${p.wake || ''}"></label>
        <label class="f"><span>Odatda uxlash vaqti</span><input type="time" id="s-sleep" value="${p.sleep || ''}"></label></div>
      <label class="f"><span>Asosiy yo'nalishlar</span><div class="chips" id="s-areas">${areas.map(a => `<span class="chip pick ${(p.areas || []).includes(a) ? 'on' : ''}">${esc(a)}</span>`).join('')}</div></label>
      <button class="btn primary sm" data-act="save-prof">Saqlash</button>
    </div>
    <div class="card glass"><h3>Namoz vaqtlari <span class="muted">— ${esc(cityName(pr))}</span></h3>
      <div class="ptable">${ALLP.map(k => `<div><div class="n">${PN[k]}</div><div class="t num">${S.prayers[k]}</div></div>`).join('')}</div>
      <div class="grid2"><label class="f"><span>Shahar</span><select id="s-city">${cityOptions(pr.city)}</select></label><span></span></div>
      <div class="grid3 ${pr.city === 'custom' ? '' : 'hidden'}" id="s-custom">
        <label class="f"><span>Kenglik (lat)</span><input type="number" id="s-lat" step="0.0001" value="${pr.lat}"></label>
        <label class="f"><span>Uzunlik (lon)</span><input type="number" id="s-lon" step="0.0001" value="${pr.lon}"></label>
        <label class="f"><span>Vaqt mintaqasi (UTC+)</span><input type="number" id="s-tz" step="0.5" value="${pr.tz}"></label></div>
      <div class="faint small" style="margin-bottom:14px">Vaqtlar internetsiz hisoblanadi va namozvaqti.uz (Toshkent) yillik jadvali bilan solishtirib sozlangan — Toshkentda farq odatda 0–1 daqiqa.
        Boshqa shaharlarda yoki masjidingiz jadvali boshqacha bo'lsa, har bir namozga ± daqiqa qo'shing.</div>
      <div class="grid3">${ALLP.map(k => `<label class="f"><span>${PN[k]}: ± daqiqa</span><input type="number" min="-30" max="30" step="1" data-off="${k}" value="${pr.offsets[k] || 0}"></label>`).join('')}</div>
      <div class="row wrap" style="margin-bottom:12px"><span class="muted small">Mazhab (Asr vaqti):</span>
        <div class="seg" id="s-asr"><button data-v="2" class="${pr.asr_factor === 2 ? 'on' : ''}">Hanafiy</button><button data-v="1" class="${pr.asr_factor === 1 ? 'on' : ''}">Shofi'iy / Molikiy / Hanbaliy</button></div></div>
      <details style="margin-bottom:12px"><summary class="muted small" style="cursor:pointer">Qo'shimcha: Quyosh burchaklari</summary>
        <div class="grid2" style="margin-top:10px"><label class="f"><span>Bomdod burchagi (°)</span><input type="number" id="s-fa" step="0.25" min="10" max="20" value="${pr.fajr_angle}"></label>
        <label class="f"><span>Xufton burchagi (°)</span><input type="number" id="s-ia" step="0.25" min="10" max="20" value="${pr.isha_angle}"></label></div></details>
      <button class="btn primary sm" data-act="save-prayer">Saqlash</button>
    </div>
    <div class="card glass"><h3>Eslatmalar <span class="muted">— dastur oynasi yopiq bo'lsa ham chiqadi</span></h3>
      <label class="row" style="margin-bottom:12px;cursor:pointer"><input type="checkbox" id="n-en" ${n.enabled ? 'checked' : ''}> Eslatmalar yoqilgan</label>
      <div class="grid2">
        <label class="f"><span>Namozdan necha daqiqa oldin (0 — o'chiq)</span><input type="number" id="n-before" min="0" max="120" value="${n.before}"></label>
        <label class="f"><span>Bomdod tugashidan (Quyoshdan) oldin, daqiqa (0 — o'chiq)</span><input type="number" id="n-sun" min="0" max="60" value="${n.sunrise_warn}"></label>
        <label class="f"><span>Ertangi reja eslatmasi: Xuftondan keyin, daqiqa</span><input type="number" id="n-eve-after" min="0" max="240" value="${n.evening_after}"></label>
      </div>
      <label class="row small" style="margin-bottom:8px;cursor:pointer"><input type="checkbox" id="n-at" ${n.at_time ? 'checked' : ''}> Namoz vaqti kirganda xabar berish</label>
      <label class="row small" style="margin-bottom:8px;cursor:pointer"><input type="checkbox" id="n-eve" ${n.evening ? 'checked' : ''}> Reja tuzilmagan bo'lsa kechqurun eslatish</label>
      <label class="row small" style="margin-bottom:8px;cursor:pointer"><input type="checkbox" id="n-tasks" ${n.tasks ? 'checked' : ''}> Aniq vaqtli ishlardan 5 daqiqa oldin eslatish</label>
      <label class="row small" style="margin-bottom:14px;cursor:pointer"><input type="checkbox" id="n-sound" ${n.sound ? 'checked' : ''}> Ovozli signal</label>
      <div class="row"><button class="btn primary sm" data-act="save-notify">Saqlash</button><button class="btn sm" data-act="test-notify">${ic('bell')} Sinab ko'rish</button></div>
    </div>
    <div class="card glass"><h3>Hijriy sana</h3>
      <div class="row wrap"><span class="muted small">Tuzatish (kun):</span><div class="seg" id="s-hij">${[-2, -1, 0, 1, 2].map(k => `<button data-v="${k}" class="${s.hijri_offset === k ? 'on' : ''}">${k > 0 ? '+' + k : k}</button>`).join('')}</div>
      <span class="muted">Bugun: <b id="hij-prev">${hijri(S.active_day)}</b></span></div>
    </div>
    ${native ? `<div class="card glass"><h3>Kompyuter</h3>
      <label class="row small" style="cursor:pointer"><input type="checkbox" id="s-auto"> Kompyuter yonganda Isloh fonda ochilsin (eslatmalar uchun kerak)</label>
      <div class="faint small" style="margin-top:8px">Oynani yopsangiz, dastur tizim panelida (tray) ishlashda davom etadi. To'liq chiqish: tray menyusi → “Chiqish”.</div></div>` : ''}
    <div class="card glass"><h3>Ma'lumotlar va zaxira</h3>
      <div class="muted small" style="margin-bottom:12px">${native ? `Hamma ma'lumot shu kompyuterda: <code>${esc(S.data_dir)}</code>. Har kuni avtomatik zaxira olinadi (oxirgi 30 kun saqlanadi).`
        : isAndroid() ? 'Hamma ma\'lumot telefonning o\'zida saqlanadi. Vaqti-vaqti bilan zaxira faylini saqlab qo\'ying — dasturni o\'chirsangiz, ma\'lumotlar ham o\'chadi.'
        : 'Hamma ma\'lumot shu brauzerning o\'zida saqlanadi.'}</div>
      <div class="row wrap"><button class="btn sm" data-act="export">${ic('download')} Zaxira faylini saqlash</button>
        <button class="btn sm" data-act="import">${ic('upload')} Zaxiradan tiklash</button>
        ${native ? '<button class="btn sm" data-act="open-data">Papkani ochish</button>' : ''}
        <input type="file" id="imp-file" accept="application/json,.json" class="hidden"></div>
      <div class="faint small" style="margin-top:8px">Zaxira fayli Isloh o'rnatilgan istalgan qurilmada ochiladi: Linux, Windows, macOS, Android. Eski “Vaqt” versiyasining zaxirasi ham mos keladi.</div>
    </div>
    <div class="card glass"><h3>Dastur haqida</h3>
      <div class="muted small">Isloh 1.0 — shaxsiy reja, maqsad va namoz vaqtlari. Internetsiz ishlaydi.<br>
      Klaviatura: <b>Ctrl+1…6</b> — bo'limlar, <b>Ctrl+N</b> — tez ish qo'shish, <b>Enter</b> — qo'shish, <b>Esc</b> — oynani yopish.</div>
    </div>
  </div>`;
  let asr = pr.asr_factor, hij = s.hijri_offset;
  if (native && $('#s-auto')) native.getAutostart().then(on => { $('#s-auto').checked = !!on; }).catch(() => {});
  v.onclick = async e => {
    const chip = e.target.closest('#s-areas .chip');
    if (chip) { chip.classList.toggle('on'); return; }
    const sa = e.target.closest('#s-asr button');
    if (sa) { asr = +sa.dataset.v; $$('#s-asr button').forEach(b => b.classList.toggle('on', b === sa)); return; }
    const sh = e.target.closest('#s-hij button');
    if (sh) {
      hij = +sh.dataset.v;
      $$('#s-hij button').forEach(b => b.classList.toggle('on', b === sh));
      try { S.settings = await api('PUT', '/api/settings', { hijri_offset: hij }); $('#hij-prev').textContent = hijri(S.active_day); } catch (err) { fail(err); }
      return;
    }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    try {
      switch (a.dataset.act) {
        case 'save-prof':
          S.settings = await api('PUT', '/api/settings', { profile: {
            name: $('#s-name').value, birth_date: $('#s-bd').value, birth_time: $('#s-bt').value, wake: $('#s-wake').value, sleep: $('#s-sleep').value,
            areas: $$('#s-areas .chip.on').map(c => c.textContent) } });
          toast('Saqlandi'); break;
        case 'save-prayer': {
          const offsets = {};
          $$('[data-off]').forEach(i => { offsets[i.dataset.off] = parseInt(i.value, 10) || 0; });
          const city = $('#s-city').value;
          const extra = city === 'custom' ? { lat: parseFloat($('#s-lat').value), lon: parseFloat($('#s-lon').value), tz: parseFloat($('#s-tz').value) } : {};
          await api('PUT', '/api/settings', { prayer: { city, ...extra, offsets, asr_factor: asr, fajr_angle: parseFloat($('#s-fa').value), isha_angle: parseFloat($('#s-ia').value) } });
          toast('Namoz vaqtlari yangilandi'); refresh(); break;
        }
        case 'save-notify':
          S.settings = await api('PUT', '/api/settings', { notify: {
            enabled: $('#n-en').checked, before: parseInt($('#n-before').value, 10) || 0, sunrise_warn: parseInt($('#n-sun').value, 10) || 0,
            evening_after: parseInt($('#n-eve-after').value, 10) || 0, at_time: $('#n-at').checked, evening: $('#n-eve').checked,
            tasks: $('#n-tasks').checked, sound: $('#n-sound').checked } });
          toast('Saqlandi'); break;
        case 'test-notify': await Backend.Notifier.test(); toast('Sinov eslatmasi yuborildi'); break;
        case 'open-data': native && native.openDataDir(); break;
        case 'export': {
          const data = await api('GET', '/api/export');
          const r = await saveFile(`isloh-zaxira-${iso(new Date())}.json`, JSON.stringify(data, null, 1));
          if (r === 'downloaded') toast('Zaxira fayli “Yuklanmalar” papkasiga saqlandi');
          else if (r && r !== 'shared' && r !== 'cancel') toast('Saqlandi: ' + r);
          break;
        }
        case 'import': $('#imp-file').click(); break;
      }
    } catch (err) { fail(err); }
  };
  v.onchange = async e => {
    if (e.target.id === 's-city') { $('#s-custom').classList.toggle('hidden', e.target.value !== 'custom'); return; }
    if (e.target.id === 's-auto') {
      try { await native.setAutostart(e.target.checked); toast(e.target.checked ? 'Kompyuter yonganda ochiladi' : 'Avtomatik ochilish o\'chirildi'); } catch (err) { fail(err); }
      return;
    }
    if (e.target.id !== 'imp-file') return;
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!(await confirmBox('Zaxiradan tiklash', 'Hozirgi barcha ma\'lumotlar shu fayldagilar bilan almashtiriladi (oldin avtomatik zaxira olinadi). Davom etasizmi?', 'Tiklash', true))) return;
      await api('POST', '/api/import', data);
      await loadState();
      toast('Ma\'lumotlar tiklandi');
      render();
    } catch (err) { fail(err.name === 'SyntaxError' ? new Error('Fayl o\'qilmadi — bu JSON zaxira fayli emas') : err); }
  };
}

/* ================================================================ TANISHUV (birinchi kirish) */
function showOnboarding() {
  const st = { step: 0, name: '', birth_date: '', birth_time: '', wake: '05:00', sleep: '23:00', areas: ['Din', 'Bilim', "Sog'liq"], city: 'toshkent' };
  const wrap = document.createElement('div');
  wrap.className = 'ob';
  document.body.appendChild(wrap);
  const N = 5;
  const draw = () => {
    frameFns = [];
    const steps = `<div class="steps">${Array.from({ length: N }, (_, i) => `<i class="${i <= st.step ? 'on' : ''}"></i>`).join('')}</div>`;
    let body = '';
    if (st.step === 0) body = `<h1>Assalomu alaykum!</h1><p class="muted">Keling, dasturni sizga moslaymiz. Bu bir daqiqa oladi.</p>
      <label class="f" style="margin-top:18px"><span>Ismingiz</span><input type="text" id="ob-name" value="${esc(st.name)}" placeholder="Muslimbek" autofocus></label>`;
    if (st.step === 1) body = `<h1>Tug'ilgan sanangiz</h1><p class="muted">Yoshingiz va keyingi tug'ilgan kuningiz shu sanadan hisoblanadi.</p>
      <div class="grid2" style="margin-top:18px"><label class="f"><span>Sana</span><input type="date" id="ob-bd" value="${st.birth_date}" autofocus></label>
      <label class="f"><span>Soat (ixtiyoriy)</span><input type="time" id="ob-bt" value="${st.birth_time}"></label></div>
      <div class="muted" id="ob-age" style="min-height:22px"></div>`;
    if (st.step === 2) body = `<h1>Namoz vaqtlari</h1><p class="muted">Hanafiy mazhabi. Vaqtlar internetsiz hisoblanadi; Toshkent uchun namozvaqti.uz bilan mos.</p>
      <label class="f" style="margin-top:16px"><span>Shahringiz</span><select id="ob-city">${cityOptions(st.city, false)}</select></label>
      <div class="ptable" id="ob-pt"></div>
      <p class="faint small">Kun Bomdoddan boshlanadi: yarim tundan keyin ham Bomdodgacha “Bugun” davom etadi. Kerak bo'lsa Sozlamalarda ± daqiqa tuzatasiz.</p>`;
    if (st.step === 3) body = `<h1>Kun tartibingiz</h1><p class="muted">Rejani tuzishda yordam beradi.</p>
      <div class="grid2" style="margin-top:18px"><label class="f"><span>Odatda turaman</span><input type="time" id="ob-wake" value="${st.wake}"></label>
      <label class="f"><span>Odatda uxlayman</span><input type="time" id="ob-sleep" value="${st.sleep}"></label></div>
      <label class="f"><span>Asosiy yo'nalishlaringiz (3–5 ta tanlang)</span><div class="chips" id="ob-areas">${AREAS.map(a => `<span class="chip pick ${st.areas.includes(a) ? 'on' : ''}">${esc(a)}</span>`).join('')}</div></label>`;
    if (st.step === 4) body = `<h1>Tayyor, ${esc(st.name)}!</h1><p class="muted">Dastur shunday ishlaydi:</p>
      <div style="margin:14px 0 6px">
        <div class="list-item"><b style="width:22px">1</b><span><b>Maqsadlar</b> — muddati bor maqsad qo'yasiz (ko'pi bilan 3 ta).</span></div>
        <div class="list-item"><b style="width:22px">2</b><span><b>Ertaga</b> — har kecha Xuftondan keyin ertangi ishlarni namoz bloklariga joylab, rejani yopasiz.</span></div>
        <div class="list-item"><b style="width:22px">3</b><span><b>Bugun</b> — ishlarni va namozlarni belgilaysiz, kechqurun kunni yakunlaysiz.</span></div>
        <div class="list-item"><b style="width:22px">4</b><span><b>Profil</b> — har kun yashil, sariq yoki qizil bo'ladi; dastur xulosalar beradi.</span></div>
      </div>`;
    wrap.innerHTML = `<div class="card glass">${steps}${body}<div class="err" id="ob-err"></div>
      <div class="foot" style="display:flex;gap:10px;margin-top:16px">${st.step ? '<button class="btn" data-x="back">Orqaga</button>' : ''}<span class="grow"></span>
      ${st.step < N - 1 ? '<button class="btn primary" data-x="next">Davom etish</button>' : '<button class="btn" data-x="home">Bosh sahifaga</button><button class="btn primary" data-x="goal">Birinchi maqsadni qo\'yish</button>'}</div></div>`;
    const f = $('[autofocus]', wrap);
    if (f) setTimeout(() => f.focus(), 30);
    if (st.step === 2) {
      const upd = () => {
        st.city = $('#ob-city', wrap).value;
        const t = Prayer.timesHHMM(S.active_day, { city: st.city });
        $('#ob-pt', wrap).innerHTML = ALLP.map(k => `<div><div class="n">${PN[k]}</div><div class="t num">${t[k]}</div></div>`).join('');
      };
      $('#ob-city', wrap).addEventListener('change', upd);
      upd();
    }
    if (st.step === 1) {
      const upd = () => {
        const v = $('#ob-bd', wrap).value;
        const el = $('#ob-age', wrap);
        if (!v) { el.textContent = ''; return; }
        const b = pd(v), now = new Date();
        if (b > now) { el.textContent = ''; return; }
        const nb = nextBirthday(b, now);
        el.textContent = `Siz ${Math.floor((now - b) / 31556952000)} yoshdasiz · ${nb.getFullYear() - b.getFullYear()} yoshga to'lishingizga ${Math.ceil((nb - now) / 864e5)} kun qoldi`;
      };
      $('#ob-bd', wrap).addEventListener('input', upd);
      upd();
    }
  };
  const collect = () => {
    const err = t => { $('#ob-err', wrap).textContent = t; return false; };
    if (st.step === 0) { st.name = $('#ob-name', wrap).value.trim(); if (!st.name) return err('Ismingizni yozing'); }
    if (st.step === 1) {
      st.birth_date = $('#ob-bd', wrap).value; st.birth_time = $('#ob-bt', wrap).value;
      if (!st.birth_date) return err('Tug\'ilgan sanani kiriting');
      if (pd(st.birth_date) > new Date() || pd(st.birth_date).getFullYear() < 1900) return err('Sana noto\'g\'ri');
    }
    if (st.step === 3) {
      st.wake = $('#ob-wake', wrap).value; st.sleep = $('#ob-sleep', wrap).value;
      st.areas = $$('#ob-areas .chip.on', wrap).map(c => c.textContent);
    }
    return true;
  };
  const finish = async target => {
    try {
      S.settings = await api('POST', '/api/onboard', st);
      await loadState();
      wrap.remove();
      location.hash = '#/' + target;
      await render();
      if (target === 'maqsadlar') goalForm(null, refresh);
    } catch (e) { $('#ob-err', wrap).textContent = e.message; }
  };
  wrap.addEventListener('click', e => {
    const chip = e.target.closest('#ob-areas .chip');
    if (chip) { chip.classList.toggle('on'); return; }
    const x = e.target.closest('[data-x]');
    if (!x) return;
    if (x.dataset.x === 'back') { collect(); st.step--; draw(); }
    if (x.dataset.x === 'next' && collect()) { st.step++; draw(); }
    if (x.dataset.x === 'home') finish('home');
    if (x.dataset.x === 'goal') finish('maqsadlar');
  });
  wrap.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { const b = $('[data-x="next"]', wrap); if (b) b.click(); } });
  draw();
}

/* ================================================================ ishga tushirish */
(async function boot() {
  requestAnimationFrame(loop);
  try { await loadState(); }
  catch (e) { document.body.innerHTML = `<div style="padding:40px;color:#fff;font-family:sans-serif">Ma'lumotlarni o'qib bo'lmadi: ${esc(e.message)}</div>`; return; }
  document.body.classList.toggle('touch', matchMedia('(hover: none)').matches);
  render();
  Backend.Notifier.start();
  if (native && native.onShow) native.onShow(() => render(true));
})();
