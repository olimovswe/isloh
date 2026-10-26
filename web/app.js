'use strict';
/* Isloh — veb-ilova (PWA). Kompyuterda ham, telefonda ham ishlaydi. Server bilan /api orqali gaplashadi. */

/* ================================================================ yordamchilar */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n, l = 2) => String(n).padStart(l, '0');
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const MSHORT = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
const WD = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const WDS = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
const HM = ['Muharram', 'Safar', 'Rabiul avval', 'Rabiul oxir', 'Jumodul avval', 'Jumodul oxir', 'Rajab', "Sha'bon", 'Ramazon', 'Shavvol', "Zulqa'da", 'Zulhijja'];
const PN = { bomdod: 'Bomdod', quyosh: 'Quyosh', peshin: 'Peshin', asr: 'Asr', shom: 'Shom', xufton: 'Xufton' };
const BLOCKS = ['bomdod', 'peshin', 'asr', 'shom', 'xufton'];
const CATS = [['ilm', 'Ilm'], ['din', 'Din'], ['ish', 'Ish'], ['sport', "Sog'liq"], ['oila', 'Oila'], ['ovqat', 'Ovqat'], ['boshqa', 'Boshqa']];
const CATC = { ilm: '#7c6cf0', din: '#14a085', ish: '#3b82f6', sport: '#2fbf5b', oila: '#e86fa8', ovqat: '#e07a3f', boshqa: '#8b93a7' };
const LVL = { 0: ["Ma'lumot yo'q", 'var(--text-3)'], 1: ['Qizil', 'var(--red)'], 2: ['Sariq', 'var(--yellow)'], 3: ['Yashil', 'var(--green)'], 4: ["To'q yashil", 'var(--green)'] };
const STATUS = { planned: ['Rejada', ''], active: ['Davom etmoqda', 'blue'], done: ['Bajarildi', 'green'], missed: ["O'tkazildi", 'red'] };

const tz = () => (S.me ? S.me.tz : 5);
const tzDate = (ts = Date.now()) => new Date(ts + tz() * 3600e3);
const hhmm = ts => { const d = tzDate(ts); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
const pd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const addDays = (s, n) => { const d = pd(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fmtDay = s => { const d = pd(s); return `${WD[d.getUTCDay()]}, ${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}`; };
const fmtDate = s => { const d = pd(s); return `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmtMin = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
const pct = x => (x === null || x === undefined ? '—' : Math.round(x * 100) + '%');
const dur = ms => { ms = Math.max(0, ms); const h = Math.floor(ms / 3600e3), m = Math.floor(ms % 3600e3 / 60e3), s = Math.floor(ms % 60e3 / 1e3); return `${pad(h)}:${pad(m)}:${pad(s)}`; };
const mins = m => (m === null || m === undefined ? '—' : m >= 60 ? `${Math.floor(m / 60)} s ${m % 60} daq` : `${m} daq`);
function hijri(ds) {
  try {
    const p = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' }).formatToParts(pd(ds));
    const g = t => parseInt(p.find(x => x.type === t).value, 10);
    return `${g('day')} ${HM[g('month') - 1]} ${g('year')}`;
  } catch (e) { return ''; }
}
function normMin(t) {
  const w = toMin(S.me.wake); let sl = toMin(S.me.sleep); if (sl <= w) sl += 1440;
  let m = toMin(t); if (m < w && sl > 1440 && m + 1440 <= sl) m += 1440;
  return m;
}

/* ================================================================ ikonkalar */
const P = {
  home: '<path d="M5 12H3l9-9 9 9h-2"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/><path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"/>',
  plan: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M16 3v4M8 3v4M4 11h16M8 15h2M8 18h5"/>',
  history: '<path d="M12 8v4l3 2"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/>',
  book: '<path d="M3 19a9 9 0 0 1 9 0 9 9 0 0 1 9 0M3 6a9 9 0 0 1 9 0 9 9 0 0 1 9 0M3 6v13M12 6v13M21 6v13"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M5 12l5 5L20 7"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  play: '<path d="M7 4v16l13-8z"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  edit: '<path d="M4 20h4L18.5 9.5a2.83 2.83 0 1 0-4-4L4 16v4"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M3 12h1m8-9v1m8 8h1m-9 8v1M5.6 5.6l.7.7m12.1-.7-.7.7m0 11.4.7.7m-12.1-.7-.7.7"/>',
  moon: '<path d="M12 3h.39a7.5 7.5 0 0 0 7.92 12.45A9 9 0 1 1 12 3z"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="M21 21l-6-6"/>', back: '<path d="M15 6l-6 6 6 6"/>', next: '<path d="M9 6l6 6-6 6"/>',
  pdf: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M9 13h6M9 17h4"/>',
  tg: '<path d="M15 10l-4 4 6 6 4-16-18 7 4 2 2 6 3-4"/>', logout: '<path d="M14 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2M9 12h12l-3-3m0 6 3-3"/>',
  bell: '<path d="M10 5a2 2 0 1 1 4 0 7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2-3v-3a7 7 0 0 1 4-6"/><path d="M9 17v1a3 3 0 0 0 6 0v-1"/>',
  mosque: '<path d="M12 3c2 2 5 3 5 7H7c0-4 3-5 5-7zM5 21V12h14v9M9 21v-4a3 3 0 0 1 6 0v4M3 21h18"/>',
  target: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="9"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>', mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/>',
  dawn: '<path d="M3 19h18M7 19a5 5 0 0 1 10 0"/><path d="M12 4v6m-3-3 3-3 3 3"/>',
  sunrise: '<path d="M3 19h18M7 19a5 5 0 0 1 10 0M12 8V6M5 12l1.4 1.4M19 12l-1.4 1.4M2 16h1.5M20.5 16H22"/>',
  sunset: '<path d="M3 19h18M7 19a5 5 0 0 1 10 0"/><path d="M12 4v6m-3-3 3 3 3-3"/>',
  cloudSun: '<path d="M12 3v1.5M5.6 5.6l1 1M18.4 5.6l-1 1M3 12h1.5"/><path d="M8.2 12.5a4 4 0 0 1 7.3-2.6"/><path d="M8 20h9a3.5 3.5 0 0 0 0-7h-.3A5 5 0 0 0 7 14.6 2.8 2.8 0 0 0 8 20z"/>',
  repeat: '<path d="M4 12V9a3 3 0 0 1 3-3h13l-3-3m3 3-3 3M20 12v3a3 3 0 0 1-3 3H4l3 3m-3-3 3-3"/>',
};
const ic = (n, cls = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="${cls}">${P[n]}</svg>`;

/* ================================================================ holat, API, xabarlar */
const S = { token: localStorage.getItem('isloh_token') || '', me: null, config: null };
async function api(method, path, body) {
  const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token) { logoutLocal(); throw new Error('Qaytadan kiring'); }
  if (!r.ok) throw new Error(j.error || 'Xatolik yuz berdi');
  return j;
}
let toastT;
function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg; t.classList.toggle('bad', bad); t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), bad ? 4200 : 2600);
}
const fail = e => toast(e.message || String(e), true);
function modal(html, { wide = false, onClose } = {}) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal glass ${wide ? 'wide' : ''}">${html}</div>`;
  document.body.appendChild(bg);
  let closed = false;
  const onKey = e => { if (e.key === 'Escape') close(); };
  function close() { if (closed) return; closed = true; bg.classList.add('closing'); setTimeout(() => bg.remove(), 190); document.removeEventListener('keydown', onKey); onClose && onClose(); }
  document.addEventListener('keydown', onKey);
  bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
  setTimeout(() => { const f = $('[autofocus]', bg); if (f) f.focus(); }, 40);
  return { el: bg.firstElementChild, close };
}
function confirmBox(title, text, ok = 'Ha', danger = false) {
  return new Promise(res => {
    let v = false;
    const m = modal(`<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p><div class="foot"><button class="btn" data-x="n">Yo'q</button><button class="btn ${danger ? 'red' : 'primary'}" data-x="y">${esc(ok)}</button></div>`, { onClose: () => res(v) });
    m.el.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (x) { v = x.dataset.x === 'y'; m.close(); } });
  });
}
function applyTheme() { document.documentElement.dataset.theme = (S.me && S.me.theme) || localStorage.getItem('isloh_theme') || 'dark'; }

/* ================================================================ marshrutlar */
const NAV = [['home', 'home', 'Bosh sahifa'], ['reja', 'plan', 'Reja'], ['tarix', 'history', 'Tarix'], ['ilm', 'book', 'Ilm'], ['profil', 'user', 'Profil']];
const VIEWS = {};
const route = () => { const r = location.hash.replace(/^#\/?/, '').split('?')[0]; return VIEWS[r] ? r : 'home'; };
const param = k => new URLSearchParams(location.hash.split('?')[1] || '').get(k);
let frameFns = [], tickFns = [], renderId = 0;
function loop() { if (frameFns.length) { const n = Date.now(); for (const f of frameFns) f(n); } requestAnimationFrame(loop); }
setInterval(() => { if (tickFns.length) { const n = Date.now(); for (const f of tickFns) f(n); } }, 250);

async function render(keep = false) {
  const v = $('#view');
  if (!S.token || !S.me || !S.me.onboarded) return gate();
  $('#gate').innerHTML = '';
  const dock = $('#dock');
  dock.classList.remove('hidden');
  const r = route();
  if (!dock.dataset.ready) {
    dock.innerHTML = '<span class="ind"></span>' + NAV.map(([k, i, l]) => `<a href="#/${k}" data-k="${k}" aria-label="${l}">${ic(i)}<span>${l}</span></a>`).join('');
    dock.dataset.ready = '1';
  }
  $$('a', dock).forEach((a, n) => {
    a.classList.toggle('on', a.dataset.k === r);
    if (a.dataset.k === r) $('.ind', dock).style.transform = `translateY(${a.offsetTop - 10}px)`;
  });
  v.classList.toggle('still', keep);
  const top = keep ? v.scrollTop : 0;
  frameFns = []; tickFns = [];
  for (const k of ['onclick', 'onchange', 'oninput', 'onkeydown', 'onsubmit']) v[k] = null;
  const my = ++renderId;
  try { await VIEWS[r](v, () => my === renderId); } catch (e) { fail(e); }
  if (keep) v.scrollTop = top;
}
const refresh = () => render(true);
window.addEventListener('hashchange', () => render());

/* ================================================================ KIRISH: tanishuv, kod, profil */
const SLIDES = [
  ['target', 'linear-gradient(135deg,#7c6cf0,#14a085)', 'Isloh', 'Maqsad sari ongli hayot', "Maqsad qo'ying, uni kunlarga bo'lib rejalang va har kuni bir qadam yaqinlashing."],
  ['mosque', 'linear-gradient(135deg,#14a085,#0f6b5a)', '5 vaqt namoz — kun markazida', "Namoz vaqtlari, kirishidan oldin eslatma va o'qilgan/qazo namozlar hisobi. Vaqtida belgilanmasa, qazo bo'lib qoladi.", ''],
  ['plan', 'linear-gradient(135deg,#3b82f6,#7c6cf0)', 'Ongli kun', "Kechqurun ertangi kunni soatma-soat rejalang. Ish vaqti kelganda Telegram'dan xabar keladi: «Boshlash» va «Tugatish»ni bosasiz — kechikish va davomiylik o'zi hisoblanadi."],
  ['mic', 'linear-gradient(135deg,#e07a3f,#c4632f)', 'Dunyoqarash', "Eng yaxshi o'zbek podkastlari va kitoblar bir joyda — har kuni ilm bilan ham shug'ullaning."],
  ['chart', 'linear-gradient(135deg,#2fbf5b,#14a085)', 'Tahlil va tarix', "Har kecha uxlashdan oldin kuningiz tahlili PDF bo'lib keladi. Tarix bo'limida istalgan kunni ko'rib, xulosa chiqarasiz."],
];
let gateStep = localStorage.getItem('isloh_intro') ? 'login' : 'intro', slide = 0;
async function gate() {
  $('#dock').classList.add('hidden');
  $('#view').innerHTML = '';
  frameFns = []; tickFns = [];
  const g = $('#gate');
  if (S.token && S.me && !S.me.onboarded) return setupForm(g);
  if (gateStep === 'intro') {
    const [icn, bg, title, sub, text] = SLIDES[slide];
    g.innerHTML = `<div class="gate"><div class="card glass">
      <div class="ill" style="background:${bg}">${ic(icn)}</div>
      <h1>${esc(title)}</h1>${sub ? `<p><b>${esc(sub)}</b></p>` : ''}${text ? `<p>${esc(text)}</p>` : ''}
      <div class="dots">${SLIDES.map((_, i) => `<i class="${i === slide ? 'on' : ''}"></i>`).join('')}</div>
      <div class="row" style="justify-content:space-between">
        <button class="btn ghost" data-g="skip">O'tkazib yuborish</button>
        <button class="btn primary lg" data-g="next">${slide === SLIDES.length - 1 ? 'Boshlash' : 'Keyingi'} ${ic('next')}</button>
      </div></div></div>`;
    g.onclick = e => {
      const b = e.target.closest('[data-g]');
      if (!b) return;
      if (b.dataset.g === 'next' && slide < SLIDES.length - 1) { slide++; return gate(); }
      localStorage.setItem('isloh_intro', '1'); gateStep = 'login'; gate();
    };
    return;
  }
  const bot = (S.config && S.config.bot_username) || 'islohuzbot';
  g.innerHTML = `<div class="gate"><div class="card glass">
    <div class="ill" style="background:linear-gradient(135deg,#2aa1da,#1c7fbf)">${ic('tg')}</div>
    <h1>Kirish</h1><p>Telegram orqali — parol kerak emas.</p>
    <div class="steps">
      <div><b class="n">1</b><span><a href="https://t.me/${bot}" target="_blank" rel="noopener"><b>@${bot}</b></a> botini oching va <b>Start</b> ni bosing.</span></div>
      <div><b class="n">2</b><span>«Kontaktni yuborish» tugmasi orqali telefon raqamingizni yuboring.</span></div>
      <div><b class="n">3</b><span>Bot bergan <b>6 xonali kodni</b> shu yerga kiriting.</span></div>
    </div>
    <a class="btn primary lg" style="width:100%" href="https://t.me/${bot}" target="_blank" rel="noopener">${ic('tg')} Telegram'da ochish</a>
    <div class="code">${Array.from({ length: 6 }, (_, i) => `<input type="text" inputmode="numeric" maxlength="1" data-i="${i}" ${i === 0 ? 'autofocus' : ''}>`).join('')}</div>
    <div class="err" id="g-err"></div>
  </div></div>`;
  const boxes = $$('.code input', g);
  setTimeout(() => boxes[0].focus(), 50);
  const submit = async () => {
    const code = boxes.map(b => b.value).join('');
    if (code.length !== 6) return;
    boxes.forEach(b => { b.disabled = true; });
    try {
      const r = await api('POST', '/api/auth/verify', { code });
      S.token = r.token; S.me = r.user; localStorage.setItem('isloh_token', r.token);
      applyTheme(); startEvents();
      render();
    } catch (e) {
      $('#g-err').textContent = e.message;
      boxes.forEach(b => { b.disabled = false; b.value = ''; });
      boxes[0].focus();
    }
  };
  g.oninput = e => {
    const b = e.target.closest('.code input');
    if (!b) return;
    const v = b.value.replace(/\D/g, '');
    if (v.length > 1) { v.split('').slice(0, 6).forEach((c, k) => { if (boxes[k]) boxes[k].value = c; }); submit(); return; }
    b.value = v;
    if (v && b.dataset.i < 5) boxes[+b.dataset.i + 1].focus();
    $('#g-err').textContent = '';
    submit();
  };
  g.onkeydown = e => { const b = e.target.closest('.code input'); if (b && e.key === 'Backspace' && !b.value && b.dataset.i > 0) boxes[b.dataset.i - 1].focus(); };
  g.addEventListener('paste', e => {
    const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (t.length === 6) { e.preventDefault(); t.split('').forEach((c, k) => { boxes[k].value = c; }); submit(); }
  }, { once: true });
}
function setupForm(g) {
  const u = S.me, now = new Date(), y0 = now.getFullYear();
  const [by, bm, bd] = (u.birth_date || '2000-01-01').split('-').map(Number);
  g.innerHTML = `<div class="gate"><div class="card glass" style="text-align:left">
    <h1 style="text-align:center">Tanishaylik</h1><p style="text-align:center">Bu ma'lumotlar profilingizda saqlanadi, keyin o'zgartirish mumkin.</p>
    <label class="f" style="margin-top:16px"><span>Ismingiz</span><input type="text" id="s-name" value="${esc(u.name || u.tg_name)}" maxlength="60"></label>
    <label class="f"><span>Tug'ilgan sana</span><div class="dob">
      <select id="s-d">${Array.from({ length: 31 }, (_, i) => `<option ${i + 1 === bd ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
      <select id="s-m">${MONTHS.map((m, i) => `<option value="${i + 1}" ${i + 1 === bm ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <select id="s-y">${Array.from({ length: 80 }, (_, i) => y0 - 6 - i).map(y => `<option ${y === by ? 'selected' : ''}>${y}</option>`).join('')}</select></div></label>
    <div class="grid g2" style="gap:12px">
      <label class="f"><span>Odatda turaman</span><input type="time" id="s-wake" value="${u.wake}"></label>
      <label class="f"><span>Odatda uxlayman</span><input type="time" id="s-sleep" value="${u.sleep}"></label></div>
    <label class="f"><span>Shahar (namoz vaqtlari uchun)</span><select id="s-city">${S.config.cities.map(c => `<option value="${c.id}" ${c.id === u.city ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    <div class="err" id="s-err"></div>
    <button class="btn primary lg" style="width:100%;margin-top:6px" id="s-go">Davom etish ${ic('next')}</button></div></div>`;
  $('#s-go', g).onclick = async () => {
    const birth = `${$('#s-y', g).value}-${pad($('#s-m', g).value)}-${pad($('#s-d', g).value)}`;
    try {
      S.me = await api('PUT', '/api/me', { name: $('#s-name', g).value, birth_date: birth, wake: $('#s-wake', g).value, sleep: $('#s-sleep', g).value, city: $('#s-city', g).value, onboarded: true });
      location.hash = '#/home'; render();
    } catch (e) { $('#s-err', g).textContent = e.message; }
  };
}
function logoutLocal() {
  S.token = ''; S.me = null; localStorage.removeItem('isloh_token');
  if (ES) { ES.close(); ES = null; }
  gateStep = 'login'; render();
}

/* ================================================================ BOSH SAHIFA */
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
VIEWS.home = async (v, alive) => {
  const H = await api('GET', '/api/home');
  if (!alive()) return;
  const seq = [['bomdod', H.times.bomdod], ['quyosh', H.times.quyosh], ['peshin', H.times.peshin], ['asr', H.times.asr], ['shom', H.times.shom], ['xufton', H.times.xufton], ['ertaga', H.next_bomdod]];
  const ICON = { bomdod: 'dawn', quyosh: 'sunrise', peshin: 'sun', asr: 'cloudSun', shom: 'sunset', xufton: 'moon', ertaga: 'dawn' };
  const END = { bomdod: H.times.quyosh, peshin: H.times.asr, asr: H.times.shom, shom: H.times.xufton, xufton: H.next_bomdod };
  const label = k => (k === 'ertaga' ? 'Bomdod' : PN[k]);
  const sub = { quyosh: 'Bomdod vaqti tugashi', ertaga: 'ertaga' };
  const cur = H.current, nxt = H.next;
  const mark = k => (H.prayers[k] === 'vaqtida' ? `<span style="color:var(--green)">${ic('check')}</span>` : H.prayers[k] === 'qazo' ? `<span style="color:var(--red)">${ic('x')}</span>` : '');
  const appIc = (name, bg) => `<div class="app" style="background:${bg}">${ic(name)}</div>`;
  v.innerHTML = `<div class="home">
    <div class="wheel" id="wheel"><div class="track">${seq.map(([k, t], i) => `<div class="ln" data-i="${i}"><div class="pr ${k === 'quyosh' || k === 'ertaga' ? 'minor' : ''}">
      <span class="ic">${ic(ICON[k])}</span>
      <span class="n">${label(k)}${sub[k] ? `<small>${sub[k]}</small>` : ''}</span><span class="t num">${hhmm(t)}</span><span class="s">${mark(k)}</span>
    </div><div class="x"></div></div>`).join('')}</div></div>
    <div class="clockbox">
      <div class="date" id="h-date"></div>
      <div class="hij" id="h-hij"></div>
      <div class="clock num" id="h-clock">${'00:00:00'.split('').map(c => (c === ':' ? '<span class="col">:</span>' : '<span class="dg">0</span>')).join('')}</div>
      <div class="nano num" id="h-nano"></div>
      ${cur ? `<div class="nowcard glass">${appIc(cur.status === 'active' ? 'play' : 'target', CATC[cur.category] || '#888')}
          <div class="grow"><div class="faint small">${cur.status === 'active' ? 'Hozir bajarilmoqda' : 'Hozir rejada'} · ${cur.start}–${cur.end}</div><div class="ttl">${esc(cur.title)}</div>
          ${cur.status === 'active' ? '<div class="muted small num" id="h-run"></div>' : ''}</div>
          ${cur.status === 'active' ? `<button class="btn green" data-a="finish" data-id="${cur.id}">${ic('stop')} Tugatish</button>` : `<button class="btn primary" data-a="start" data-id="${cur.id}">${ic('play')} Boshlash</button>`}</div>`
        : nxt ? `<div class="nowcard glass">${appIc('plan', CATC[nxt.category] || '#888')}<div class="grow"><div class="faint small">Keyingi ish · <span id="h-nx" class="num"></span></div><div class="ttl">${nxt.start} ${esc(nxt.title)}</div></div></div>` : ''}
      <div id="h-ws"></div>
    </div></div>`;
  // uyg'onish / uxlash
  const ws = $('#h-ws');
  const f = { w: toMin(S.me.wake), s: toMin(S.me.sleep) };
  const nowMin = tzDate().getUTCHours() * 60 + tzDate().getUTCMinutes();
  if (!H.day.wake_at && nowMin >= f.w && nowMin < f.w + 240) ws.innerHTML = `<div class="nowcard glass">${appIc('sunrise', 'linear-gradient(135deg,#ff9f0a,#ff375f)')}<div class="grow"><div class="ttl">Xayrli tong!</div><div class="muted small">Turish vaqti: ${S.me.wake}</div></div><button class="btn primary" data-a="wake">Turdim</button></div>`;
  else if (!H.day.sleep_at && nowMin >= f.s - 10 && nowMin >= f.w) ws.innerHTML = `<div class="nowcard glass">${appIc('moon', 'linear-gradient(135deg,#5e5ce6,#bf5af2)')}<div class="grow"><div class="ttl">Uxlash vaqti</div><div class="muted small">Reja: ${S.me.sleep}</div></div><button class="btn primary" data-a="sleep">Uxladim</button></div>`;

  // soat: har bir raqam alohida, o'zgarganda yengil animatsiya
  const eDate = $('#h-date'), eHij = $('#h-hij'), eNano = $('#h-nano'), digits = $$('#h-clock .dg'), rows = $$('#wheel .pr'), extra = $$('#wheel .x'), lines = $$('#wheel .ln'), track = $('#wheel .track'), wheelEl = $('#wheel');
  let lastShift = null;
  let lastDate = '', lastClock = '', n0 = 0;
  frameFns.push(now => {
    const d = tzDate(now);
    const ds = `${WD[d.getUTCDay()]}, ${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    if (ds !== lastDate) { eDate.textContent = ds; eHij.textContent = hijri(d.toISOString().slice(0, 10)); lastDate = ds; }
    const c = `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
    if (c !== lastClock) {
      for (let k = 0; k < 6; k++) {
        if (c[k] !== lastClock[k]) {
          const el = digits[k];
          el.textContent = c[k];
          if (lastClock) { el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); }
        }
      }
      lastClock = c;
    }
    // millisekund aniq; mikro va nanosekund raqamlari harakatni ko'rsatish uchun (brauzer bunday aniqlikni bermaydi)
    const hi = performance.now();
    n0 = (n0 + 7919) % 1000;
    eNano.innerHTML = `${pad(now % 1000, 3)} <b>${pad(Math.floor(hi * 1000) % 1000, 3)} ${pad((Math.floor(hi * 1e6) + n0) % 1000, 3)}</b>`;
  });

  // namozlar: hozirgisi katta va yorqin, keyingisi vaqt yaqinlashgan sari kattalashadi
  tickFns.push(now => {
    let i = -1;
    for (let k = 0; k < seq.length; k++) if (seq[k][1] <= now) i = k;
    const w = seq.map(() => 0);
    if (i < 0) w[0] = 1;
    else if (i >= seq.length - 1) w[seq.length - 1] = 1;
    else if (seq[i][0] === 'quyosh') {
      // quyosh chiqqach namoz yo'q payt — diqqat Peshinga, vaqti yaqinlashgan sari kattalashadi
      w[2] = 0.6 + 0.4 * smooth(0, 1, (now - seq[1][1]) / (seq[2][1] - seq[1][1]));
    } else {
      const p = (now - seq[i][1]) / (seq[i + 1][1] - seq[i][1]);
      const wn = seq[i + 1][0] === 'quyosh' ? 0 : smooth(0.6, 1, p);
      w[i] = 1 - wn; w[i + 1] = Math.max(w[i + 1], wn);
    }
    let fi = 0;
    rows.forEach((r, k) => {
      if (w[k] > w[fi]) fi = k;
      const past = k < i && w[k] < 0.5;
      // lyrics uslubi: hozirgisi katta va aniq, qolganlari kichik, xira va biroz xiralashgan
      r.style.transform = `scale(${(0.8 + 0.3 * w[k]).toFixed(3)})`;
      r.style.opacity = ((past ? 0.26 : 0.4) + 0.6 * w[k]).toFixed(3);
      r.style.filter = `blur(${((1 - w[k]) * 1.3).toFixed(2)}px)`;
      r.classList.toggle('focus', w[k] >= 0.5);
      const x = extra[k], key = seq[k][0];
      if (w[k] < 0.5) { x.style.display = 'none'; return; }
      x.style.display = 'block';
      let p;
      if (k === i && END[key]) {
        const st = H.prayers[key];
        p = (now - seq[k][1]) / (END[key] - seq[k][1]);
        x.innerHTML = st ? (st === 'vaqtida' ? `<span style="color:var(--green)">✓ O'z vaqtida o'qildi — Alloh qabul qilsin</span>` : `<span style="color:var(--red)">Qazo bo'lgan</span>`)
          : `<div class="row"><span class="num">Tugashiga ${dur(END[key] - now)}</span><button class="btn sm green" data-a="pray" data-p="${key}">O'qidim</button></div>`;
        if (st) p = 1;
      } else {
        const prev = k > 0 ? seq[k - 1][1] : seq[k][1] - 6 * 3600e3;
        p = (now - prev) / (seq[k][1] - prev);
        x.innerHTML = `<span class="num">Kirishiga ${dur(seq[k][1] - now)}</span>`;
      }
      // karaoke: nomi vaqt o'tgan sari to'lib boradi
      r.style.setProperty('--p', `${(Math.max(0, Math.min(1, p)) * 100).toFixed(2)}%`);
    });
    // ro'yxat silliq suriladi: hozirgi namoz doim markazda
    const ln = lines[fi];
    const shift = Math.round(wheelEl.clientHeight / 2 - (ln.offsetTop + ln.offsetHeight / 2));
    if (shift !== lastShift) { track.style.transform = `translateY(${shift}px)`; lastShift = shift; }
    const run = $('#h-run');
    if (run && cur && cur.actual_start) run.textContent = `Boshlandi ${hhmm(cur.actual_start)}${cur.late ? ` (+${cur.late} daq)` : ''} · ${dur(now - cur.actual_start)}`;
    const nx = $('#h-nx');
    if (nx && nxt) nx.textContent = dur(nxt.planned_start - now) + ' qoldi';
    if (i >= 0 && i < seq.length - 1 && now >= seq[i + 1][1] && now - seq[i + 1][1] < 300) refresh();
  });
  v.onclick = async e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    try {
      const a = b.dataset.a;
      if (a === 'pray') { await api('POST', '/api/prayers', { date: H.date, prayer: b.dataset.p }); toast('Alloh qabul qilsin!'); }
      if (a === 'start') { const t = await api('POST', `/api/tasks/${b.dataset.id}/start`); toast(t.late ? `Boshlandi — ${t.late} daqiqa kech` : "Boshlandi — o'z vaqtida"); }
      if (a === 'finish') { const t = await api('POST', `/api/tasks/${b.dataset.id}/finish`); rateModal(t); }
      if (a === 'wake') { await api('POST', '/api/wake', {}); toast("Kuningiz barakali o'tsin!"); }
      if (a === 'sleep') { await api('POST', '/api/sleep', {}); toast('Yaxshi dam oling!'); }
      refresh();
    } catch (err) { fail(err); refresh(); }
  };
};

function rateModal(t, after) {
  let r = t.rating || 0;
  const m = modal(`<h2>${esc(t.title)}</h2><p class="muted">${t.actual_min ?? '—'} daqiqa (reja ${t.planned_min})${t.late ? ` · ${t.late} daqiqa kech boshlandi` : ''}</p>
    <p style="margin:16px 0 6px"><b>Qanchalik yaxshi o'tdi?</b></p>
    <div class="stars" id="rs">${[1, 2, 3, 4, 5].map(n => `<button data-n="${n}">★</button>`).join('')}</div>
    <label class="f" style="margin-top:12px"><span>Izoh (ixtiyoriy)</span><textarea id="rn" placeholder="Nima yaxshi bo'ldi, nima xalaqit berdi?"></textarea></label>
    <div class="err" id="re"></div>
    <div class="foot"><button class="btn" data-x="c">Keyinroq</button><button class="btn primary" data-x="ok">Saqlash</button></div>`);
  const paint = () => $$('#rs button', m.el).forEach(b => b.classList.toggle('on', +b.dataset.n <= r));
  paint();
  m.el.addEventListener('click', async e => {
    const s = e.target.closest('#rs button');
    if (s) { r = +s.dataset.n; paint(); return; }
    const x = e.target.closest('[data-x]');
    if (!x) return;
    if (x.dataset.x === 'c') return m.close();
    if (!r) { $('#re', m.el).textContent = 'Baho tanlang (1–5)'; return; }
    try { await api('POST', `/api/tasks/${t.id}/rate`, { rating: r, note: $('#rn', m.el).value }); m.close(); toast('Rahmat!'); (after || refresh)(); } catch (err) { $('#re', m.el).textContent = err.message; }
  });
}

/* ================================================================ REJA */
VIEWS.reja = async (v, alive) => {
  const today = (await api('GET', '/api/home')).date;
  const ds = param('d') || today;
  const plan = await api('GET', `/api/plan?date=${ds}`);
  if (!alive()) return;
  const isToday = ds === plan.today, isFuture = ds > plan.today, isPast = ds < plan.today;
  const tomorrow = addDays(plan.today, 1);
  const f = { w: toMin(plan.wake) }; let sl = toMin(plan.sleep); if (sl <= f.w) sl += 1440; f.s = sl;
  const rows = [];
  const nowM = (() => { const d = tzDate(); let m = d.getUTCHours() * 60 + d.getUTCMinutes(); if (m < f.w && f.s > 1440) m += 1440; return m; })();
  rows.push({ s: f.w - 0.5, html: `<div class="it marker"><span class="tm num">${plan.wake}</span><span class="bar" style="background:var(--yellow)"></span><span class="ti"><b>🌅 Uyg'onish</b>${plan.day.wake_at ? ` <span class="chip green">${hhmm(plan.day.wake_at)} da turdingiz</span>` : ''}</span></div>` });
  for (const it of plan.items) {
    if (it.kind === 'prayer') {
      const st = plan.prayers[it.prayer];
      rows.push({ s: it.s, html: `<div class="it prayer"><span class="tm num">${it.start}–${it.end}</span><span class="bar" style="background:var(--teal)"></span>
        <span class="ti"><b>${it.title}</b> <span class="faint small">${ic('lock').replace('<svg', '<svg width="12" height="12"')} faqat namoz</span></span>
        ${st ? `<span class="chip ${st === 'vaqtida' ? 'green' : 'red'}">${st === 'vaqtida' ? "O'qildi" : 'Qazo'}</span>` : isToday && nowM >= it.s ? `<button class="btn sm green" data-a="pray" data-p="${it.prayer}">O'qidim</button>` : ''}</div>` });
      continue;
    }
    const conflict = plan.conflicts.includes(it.id);
    const st = STATUS[it.status] || STATUS.planned;
    let acts = '';
    if (it.kind === 'task' && isToday) {
      if (it.status === 'planned') acts = `<button class="btn sm primary" data-a="start" data-id="${it.id}">${ic('play')} Boshlash</button>`;
      if (it.status === 'active') acts = `<button class="btn sm green" data-a="finish" data-id="${it.id}">${ic('stop')} Tugatish</button>`;
      if (it.status === 'done') acts = it.rating ? `<span class="chip">${'★'.repeat(it.rating)}</span>` : `<button class="btn sm" data-a="rate" data-id="${it.id}">Baholash</button>`;
    }
    if (it.status === 'planned' && !isPast) acts += `<button class="ibtn" data-a="edit" data-id="${it.id}" title="Tahrirlash">${ic('edit')}</button><button class="ibtn" data-a="del" data-id="${it.id}" title="O'chirish">${ic('trash')}</button>`;
    const info = it.actual_start ? `<div class="faint small num">Haqiqatda: ${hhmm(it.actual_start)}–${it.actual_end ? hhmm(it.actual_end) : '…'}${it.late ? ` · <span style="color:${it.late > 20 ? 'var(--red)' : 'var(--yellow)'}">+${it.late} daq kech</span>` : " · o'z vaqtida"}</div>` : '';
    rows.push({ s: it.s, html: `<div class="it ${it.kind} ${it.status === 'active' ? 'active' : ''} ${conflict ? 'conflict' : ''}"><span class="tm num">${it.start}–${it.end}</span>
      <span class="bar" style="background:${CATC[it.category] || '#888'}"></span>
      <span class="ti"><b>${esc(it.title)}</b> ${it.template ? `<span class="faint">${ic('repeat').replace('<svg', '<svg width="12" height="12"')}</span>` : ''}
        ${it.kind === 'task' && it.status !== 'planned' ? `<span class="chip ${st[1]}">${st[0]}</span>` : ''}${conflict ? ' <span class="chip red">namoz vaqtiga to\'g\'ri keldi</span>' : ''}${info}</span>${acts}</div>` });
  }
  if (!isPast) for (const g of plan.free) rows.push({ s: normMin(g.start) - 0.2, html: `<div class="gap" data-a="gap" data-s="${g.start}" data-e="${g.end}">${ic('plus').replace('<svg', '<svg width="14" height="14"')} Bo'sh vaqt ${g.start}–${g.end} (${mins(g.min)}) — ish qo'shish</div>` });
  rows.push({ s: f.s + 1, html: `<div class="it marker"><span class="tm num">${plan.sleep}</span><span class="bar" style="background:var(--purple)"></span><span class="ti"><b>🌙 Uxlash</b>${plan.day.sleep_at ? ` <span class="chip green">${hhmm(plan.day.sleep_at)} da</span>` : ''}</span></div>` });
  rows.sort((a, b) => a.s - b.s);
  const tasksN = plan.items.filter(i => i.kind === 'task').length;
  v.innerHTML = `<div class="page">
    <div class="head"><h1>Reja</h1>
      <div class="seg"><button data-d="${plan.today}" class="${isToday ? 'on' : ''}">Bugun</button><button data-d="${tomorrow}" class="${ds === tomorrow ? 'on' : ''}">Ertaga</button></div>
      <input type="date" id="pd" value="${ds}" style="width:160px">
      <span class="muted">${fmtDay(ds)} · ${hijri(ds)}</span><span class="grow"></span>
      ${isFuture ? (plan.day.plan_ready ? `<span class="chip green">${ic('check').replace('<svg', '<svg width="12" height="12"')} Reja tasdiqlangan</span>` : `<button class="btn primary" data-a="ready">${ic('check')} Rejani tasdiqlash</button>`) : ''}
    </div>
    <div class="cols"><div>
      ${isPast ? '<div class="card glass muted small">Bu o\'tgan kun — faqat ko\'rish mumkin. Batafsil tahlil «Tarix» bo\'limida.</div>' : ''}
      <div class="tl">${rows.map(r => r.html).join('')}</div>
      ${!tasksN && !isPast ? '<div class="empty">Hali ish qo\'shilmagan. O\'ngdagi oynadan yoki bo\'sh vaqt qatorini bosib qo\'shing.</div>' : ''}
    </div><div>
      ${isPast ? '' : `<div class="card glass" id="addcard"><h3>Ish qo'shish</h3>
        <label class="f"><span>Nima qilasiz?</span><input type="text" id="a-title" maxlength="120" placeholder="Masalan: Ingliz tili — so'z yodlash"></label>
        <div class="grid g2" style="gap:10px"><label class="f"><span>Boshlanishi</span><input type="time" id="a-s"></label><label class="f"><span>Tugashi</span><input type="time" id="a-e"></label></div>
        <label class="f"><span>Yo'nalish</span><div class="chips" id="a-cat">${CATS.map(([k, n], i) => `<span class="chip pick ${i === 0 ? 'on' : ''}" data-c="${k}"><span class="dot" style="background:${CATC[k]}"></span>${n}</span>`).join('')}</div></label>
        <label class="f"><span>Takrorlash</span><div class="seg" id="a-rep"><button data-r="once" class="on">Bir marta</button><button data-r="daily">Har kuni</button><button data-r="weekdays">Ish kunlari</button><button data-r="days">Kunlarni tanlash</button></div></label>
        <div class="chips hidden" id="a-days" style="margin:-4px 0 12px">${[1, 2, 3, 4, 5, 6, 0].map(d => `<span class="chip pick" data-w="${d}">${WDS[d]}</span>`).join('')}</div>
        <div class="err" id="a-err"></div>
        <button class="btn primary" style="width:100%" data-a="add">${ic('plus')} Qo'shish</button>
        <div class="faint small" style="margin-top:10px">Namoz vaqtlari qulflangan — u paytda faqat namoz. Ish uyg'onish (${plan.wake}) va uxlash (${plan.sleep}) oralig'ida bo'ladi.</div>
      </div>`}
      <div class="card glass"><h3>${ic('repeat').replace('<svg', '<svg width="15" height="15" style="vertical-align:-2px"')} Takrorlanadigan ishlar</h3>
        ${plan.templates.length ? plan.templates.map(t => `<div class="row" style="padding:7px 0;border-bottom:1px solid var(--line)">
          <span class="dot" style="background:${CATC[t.category] || '#888'}"></span>
          <span class="grow ${t.active ? '' : 'faint'}"><b>${esc(t.title)}</b><div class="faint small">${t.start}–${t.end} · ${t.days === 127 ? 'har kuni' : t.days_list.map(d => WDS[d]).join(', ')}</div></span>
          <button class="btn sm" data-a="tpl-toggle" data-id="${t.id}" data-on="${t.active}">${t.active ? "O'chirish" : 'Yoqish'}</button>
          <button class="ibtn" data-a="tpl-del" data-id="${t.id}" title="Butunlay o'chirish">${ic('trash')}</button></div>`).join('') : '<div class="muted small">Yo\'q. Ish qo\'shayotganda «Har kuni» ni tanlang.</div>'}
      </div>
    </div></div></div>`;
  let cat = 'ilm', rep = 'once';
  const go = d => { location.hash = `#/reja?d=${d}`; };
  v.onchange = e => { if (e.target.id === 'pd' && e.target.value) go(e.target.value); };
  v.onkeydown = e => { if (e.key === 'Enter' && e.target.id === 'a-title') $('[data-a="add"]').click(); };
  v.onclick = async e => {
    const d = e.target.closest('.seg [data-d]'); if (d) return go(d.dataset.d);
    const c = e.target.closest('#a-cat .chip'); if (c) { cat = c.dataset.c; $$('#a-cat .chip').forEach(x => x.classList.toggle('on', x === c)); return; }
    const r = e.target.closest('#a-rep button'); if (r) { rep = r.dataset.r; $$('#a-rep button').forEach(x => x.classList.toggle('on', x === r)); $('#a-days').classList.toggle('hidden', rep !== 'days'); return; }
    const w = e.target.closest('#a-days .chip'); if (w) { w.classList.toggle('on'); return; }
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a, id = b.dataset.id;
    try {
      if (a === 'gap') {
        $('#a-s').value = b.dataset.s;
        $('#a-e').value = fmtMin(Math.min(normMin(b.dataset.e), normMin(b.dataset.s) + 60));
        $('#a-title').focus(); $('#addcard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      if (a === 'add') {
        const body = { date: ds, title: $('#a-title').value, start: $('#a-s').value, end: $('#a-e').value, category: cat,
          repeat: { type: rep, days: $$('#a-days .chip.on').map(x => +x.dataset.w) } };
        if (!body.title.trim()) { $('#a-err').textContent = 'Ish nomini yozing'; return; }
        if (!body.start || !body.end) { $('#a-err').textContent = 'Vaqtni kiriting'; return; }
        try { await api('POST', '/api/tasks', body); toast("Qo'shildi"); refresh(); } catch (err) { $('#a-err').textContent = err.message; }
        return;
      }
      if (a === 'pray') { await api('POST', '/api/prayers', { date: ds, prayer: b.dataset.p }); toast('Alloh qabul qilsin!'); }
      if (a === 'start') { const t = await api('POST', `/api/tasks/${id}/start`); toast(t.late ? `Boshlandi — ${t.late} daqiqa kech` : "Boshlandi — o'z vaqtida"); }
      if (a === 'finish') { const t = await api('POST', `/api/tasks/${id}/finish`); rateModal(t); }
      if (a === 'rate') { const t = plan.items.find(x => x.id === +id); return rateModal(t); }
      if (a === 'del') { if (!(await confirmBox("Ishni o'chirish", 'Bu ish shu kundan o\'chiriladi.', "O'chirish", true))) return; await api('DELETE', `/api/tasks/${id}`); }
      if (a === 'edit') return editTask(plan.items.find(x => x.id === +id));
      if (a === 'ready') { await api('POST', '/api/plan/ready', { date: ds, ready: true }); toast('Reja tasdiqlandi. Ertaga omad!'); }
      if (a === 'tpl-toggle') await api('PATCH', `/api/templates/${id}`, { active: b.dataset.on !== '1' });
      if (a === 'tpl-del') { if (!(await confirmBox("Takrorlanuvchi ishni o'chirish", "Kelgusi kunlardan ham olib tashlanadi. Bugungi va o'tgan kunlar saqlanadi.", "O'chirish", true))) return; await api('DELETE', `/api/templates/${id}`); }
      refresh();
    } catch (err) { fail(err); }
  };
};
function editTask(t) {
  const m = modal(`<h2>Ishni tahrirlash</h2>
    <label class="f"><span>Nomi</span><input type="text" id="e-t" value="${esc(t.title)}" maxlength="120"></label>
    <div class="grid g2" style="gap:10px"><label class="f"><span>Boshlanishi</span><input type="time" id="e-s" value="${t.start}"></label><label class="f"><span>Tugashi</span><input type="time" id="e-e" value="${t.end}"></label></div>
    <div class="err" id="e-err"></div><div class="foot"><button class="btn" data-x="c">Bekor</button><button class="btn primary" data-x="ok">Saqlash</button></div>`);
  m.el.addEventListener('click', async e => {
    const x = e.target.closest('[data-x]'); if (!x) return;
    if (x.dataset.x === 'c') return m.close();
    try { await api('PATCH', `/api/tasks/${t.id}`, { title: $('#e-t', m.el).value, start: $('#e-s', m.el).value, end: $('#e-e', m.el).value }); m.close(); refresh(); } catch (err) { $('#e-err', m.el).textContent = err.message; }
  });
}

/* ================================================================ TARIX */
const ring = (score, level, size) => {
  const c = LVL[level] ? LVL[level][1] : 'var(--text-3)', p = score === null ? 0 : Math.round(score * 100);
  return `<div class="ring num" style="${size ? `width:${size}px;height:${size}px;font-size:${Math.round(size / 4.2)}px;margin:6px auto 10px;` : ''}background:conic-gradient(${c} ${p * 3.6}deg, var(--glass-3) 0)"><span style="position:absolute;inset:5px;border-radius:50%;background:var(--solid)"></span><span style="position:relative">${score === null ? '—' : p + '%'}</span></div>`;
};
const pdots = pr => `<span class="pdots">${BLOCKS.map(p => `<i title="${PN[p]}" style="background:${pr[p] === 'vaqtida' ? 'var(--green)' : pr[p] === 'qazo' ? 'var(--red)' : 'var(--line-2)'}"></i>`).join('')}</span>`;
function barChart(tr) {
  const W = 1000, H = 170, pl = 34, pb = 22, pt = 10, n = tr.length, bw = (W - pl) / n, ch = H - pb - pt;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%">`;
  for (const y of [0, 50, 100]) { const yy = pt + ch * (1 - y / 100); s += `<line x1="${pl}" x2="${W}" y1="${yy}" y2="${yy}" stroke="var(--line)"/><text x="0" y="${yy + 3}">${y}%</text>`; }
  tr.forEach((d, i) => {
    const x = pl + i * bw + 2, h = d.score === null ? 2 : Math.max(2, ch * d.score);
    const c = d.score === null ? 'var(--glass-3)' : LVL[d.level][1];
    s += `<rect x="${x}" y="${H - pb - h}" width="${Math.max(2, bw - 4)}" height="${h}" rx="3" fill="${c}"><title>${fmtDate(d.date)}: ${pct(d.score)}</title></rect>`;
    if (i % 5 === 0 || i === n - 1) s += `<text x="${x + bw / 2 - 8}" y="${H - 6}">${+d.date.slice(8)}.${d.date.slice(5, 7)}</text>`;
  });
  return s + '</svg>';
}
VIEWS.tarix = async (v, alive) => {
  const d = param('d');
  if (d) return dayDetail(v, d, alive);
  const q = param('q') || '';
  const [tr, hist] = await Promise.all([api('GET', '/api/trends?n=30'), api('GET', `/api/history?q=${encodeURIComponent(q)}`)]);
  if (!alive()) return;
  const closed = tr.filter(x => x.score !== null);
  const avg = closed.length ? closed.reduce((a, x) => a + x.score, 0) / closed.length : null;
  const sl = tr.filter(x => x.sleep_hours);
  const pr = closed.filter(x => x.prayers !== null);
  let items = hist.items, offset = hist.items.length;
  const card = it => `<div class="daycard glass" data-d="${it.date}">${ring(it.score, it.level)}
      <div style="min-width:0"><div class="row"><b>${fmtDay(it.date)}</b>${it.is_today ? '<span class="chip blue">bugun</span>' : ''}<span class="chip" style="color:${LVL[it.level][1]}">${LVL[it.level][0]}</span></div>
        <div class="muted small" style="margin-top:4px">Ishlar ${it.stats.done}/${it.stats.planned}${it.stats.late_avg ? ` · kechikish ${it.stats.late_avg} daq` : ''}${it.stats.rating_avg ? ` · baho ${it.stats.rating_avg.toFixed(1)}` : ''}${it.sleep.hours ? ` · uyqu ${it.sleep.hours.toFixed(1)} s` : ''}</div>
        <div class="faint small" style="margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.top.map(t => `${t.status === 'done' ? '✓' : t.status === 'missed' ? '✕' : '·'} ${esc(t.title)}`).join('   ')}</div></div>
      <div style="text-align:right">${pdots(it.prayers)}<div class="faint small" style="margin-top:6px">${it.stats.prayers_ok}/5 namoz</div></div></div>`;
  v.innerHTML = `<div class="page">
    <div class="head"><h1>Tarix</h1><span class="muted">har bir kun tahlili</span></div>
    <div class="grid g4" style="margin-bottom:14px">
      <div class="metric glass"><div class="l">O'rtacha ball (30 kun)</div><div class="v num">${pct(avg)}</div><div class="s">${closed.filter(x => x.level >= 3).length} yashil · ${closed.filter(x => x.level === 2).length} sariq · ${closed.filter(x => x.level === 1).length} qizil</div></div>
      <div class="metric glass"><div class="l">Bajarilgan ishlar</div><div class="v num">${closed.reduce((a, x) => a + (x.done || 0), 0)} / ${closed.reduce((a, x) => a + (x.planned || 0), 0)}</div><div class="s">oxirgi 30 kun</div></div>
      <div class="metric glass"><div class="l">Namozlar vaqtida</div><div class="v num">${(() => { const c = pr.reduce((a, x) => a + (x.prayers_counted || 0), 0); return c ? pct(pr.reduce((a, x) => a + x.prayers, 0) / c) : '—'; })()}</div><div class="s">${pr.reduce((a, x) => a + ((x.prayers_counted || 0) - x.prayers), 0)} ta qazo</div></div>
      <div class="metric glass"><div class="l">O'rtacha uyqu</div><div class="v num">${sl.length ? (sl.reduce((a, x) => a + x.sleep_hours, 0) / sl.length).toFixed(1) + ' s' : '—'}</div><div class="s">${sl.length} kecha</div></div>
    </div>
    <div class="card glass"><h3>Kun ballari — oxirgi 30 kun</h3>${barChart(tr)}</div>
    <div class="card glass" style="padding:10px 12px"><div class="row">${ic('search').replace('<svg', '<svg width="18" height="18" style="color:var(--text-3)"')}
      <input type="search" id="hq" value="${esc(q)}" placeholder="Qidirish: sana (26.10), oy (oktabr) yoki ish nomi (kitob)" style="border:none;background:transparent"></div></div>
    <div class="muted small" style="margin:0 4px 8px">${hist.total} kun topildi</div>
    <div id="hl">${items.map(card).join('') || '<div class="empty">Hech narsa topilmadi.</div>'}</div>
    ${hist.total > offset ? '<div style="text-align:center"><button class="btn" id="more">Yana ko\'rsatish</button></div>' : ''}
  </div>`;
  let qt;
  v.oninput = e => { if (e.target.id !== 'hq') return; clearTimeout(qt); qt = setTimeout(() => { history.replaceState(null, '', `#/tarix${e.target.value ? '?q=' + encodeURIComponent(e.target.value) : ''}`); render(true).then(() => { const i = $('#hq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 350); };
  v.onclick = async e => {
    const c = e.target.closest('.daycard'); if (c) { location.hash = `#/tarix?d=${c.dataset.d}`; return; }
    if (e.target.id === 'more') {
      const h = await api('GET', `/api/history?q=${encodeURIComponent(q)}&offset=${offset}`);
      offset += h.items.length;
      $('#hl').insertAdjacentHTML('beforeend', h.items.map(card).join(''));
      if (offset >= h.total) e.target.remove();
    }
  };
};
function gantt(a) {
  const tasks = a.tasks, W = 820, rowH = 30, pl = 150, top = 22, H = top + Math.max(1, tasks.length) * rowH + 24;
  const w0 = toMin(a.sleep.wake_plan); let s0 = toMin(a.sleep.sleep_plan); if (s0 <= w0) s0 += 1440;
  const span = Math.max(60, s0 - w0);
  const base = Date.UTC(...a.date.split('-').map((x, i) => (i === 1 ? x - 1 : +x))) - tz() * 3600e3;
  const X = m => pl + Math.max(0, Math.min(1, (m - w0) / span)) * (W - pl - 10);
  const mm = ts => (ts - base) / 60e3;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%">`;
  for (let m = Math.ceil(w0 / 60) * 60; m <= s0; m += span > 900 ? 120 : 60) s += `<line x1="${X(m)}" x2="${X(m)}" y1="${top - 6}" y2="${H - 20}" stroke="var(--line)"/><text x="${X(m) - 13}" y="12">${fmtMin(m)}</text>`;
  for (const p of BLOCKS) {
    const ps = toMin(a.prayers[p].start);
    if (ps < w0 || ps > s0) continue;
    s += `<rect x="${X(ps)}" y="${top}" width="${Math.max(2, X(ps + (S.me.prayer_mins || 20)) - X(ps))}" height="${H - top - 22}" fill="rgba(20,160,133,.18)"/><text x="${X(ps)}" y="${H - 6}" style="fill:var(--teal)">${PN[p]}</text>`;
  }
  tasks.forEach((t, i) => {
    const y = top + i * rowH;
    s += `<text x="0" y="${y + 19}" style="fill:var(--text);font-size:12px">${esc(t.title.length > 22 ? t.title.slice(0, 21) + '…' : t.title)}</text>`;
    s += `<rect x="${X(mm(t.planned_start))}" y="${y + 6}" width="${Math.max(3, X(mm(t.planned_end)) - X(mm(t.planned_start)))}" height="18" rx="5" fill="var(--glass-3)"/>`;
    if (t.actual_start) {
      const c = (t.late || 0) <= 5 ? 'var(--green)' : (t.late || 0) <= 20 ? 'var(--yellow)' : 'var(--red)';
      s += `<rect x="${X(mm(t.actual_start))}" y="${y + 11}" width="${Math.max(3, X(mm(t.actual_end || Date.now())) - X(mm(t.actual_start)))}" height="8" rx="4" fill="${c}"/>`;
    } else if (t.status === 'missed') s += `<text x="${X(mm(t.planned_end)) + 6}" y="${y + 19}" style="fill:var(--red)">o'tkazildi</text>`;
  });
  return s + '</svg>';
}
async function dayDetail(v, ds, alive) {
  const a = await api('GET', `/api/day/${ds}`);
  if (!alive()) return;
  const s = a.stats, sl = a.sleep;
  const late = x => (x === null ? '' : x > 0 ? ` <span style="color:${x > 20 ? 'var(--red)' : 'var(--yellow)'}">(+${x} daq)</span>` : x < 0 ? ` <span class="faint">(${-x} daq erta)</span>` : ' <span style="color:var(--green)">(o\'z vaqtida)</span>');
  v.innerHTML = `<div class="page">
    <div class="head"><button class="ibtn" data-a="back">${ic('back')}</button><h1>${fmtDay(ds)}</h1><span class="muted">${fmtDate(ds)} · ${hijri(ds)}</span><span class="grow"></span>
      <button class="btn" data-a="pdf">${ic('pdf')} PDF hisobot</button></div>
    <div class="grid" style="grid-template-columns:200px minmax(0,1fr);margin-bottom:14px">
      <div class="card glass" style="text-align:center;margin:0">${ring(a.score, a.level, 110)}
        <div class="chip" style="color:${LVL[a.level][1]}">${a.level_name}</div><div class="faint small" style="margin-top:8px">ishlar ${pct(a.components.tasks)} · namoz ${pct(a.components.prayers)} · uyqu ${pct(a.components.sleep)}</div></div>
      <div class="grid g3" style="margin:0">
        <div class="metric glass"><div class="l">Ishlar</div><div class="v num">${s.done} / ${s.planned}</div><div class="s">${s.missed ? s.missed + " tasi o'tkazildi" : 'bajarildi'}</div></div>
        <div class="metric glass"><div class="l">O'rtacha kechikish</div><div class="v num">${s.late_avg === null ? '—' : s.late_avg + ' daq'}</div><div class="s">${s.late_count} ta ish kech boshlandi</div></div>
        <div class="metric glass"><div class="l">Namozlar</div><div class="v num">${s.prayers_ok} / 5</div><div class="s">${pdots(Object.fromEntries(BLOCKS.map(p => [p, a.prayers[p].status])))}</div></div>
        <div class="metric glass"><div class="l">O'rtacha baho</div><div class="v num">${s.rating_avg ? s.rating_avg.toFixed(1) + ' / 5' : '—'}</div><div class="s">o'z bahongiz</div></div>
        <div class="metric glass"><div class="l">Sarflangan vaqt</div><div class="v num">${mins(s.actual_min)}</div><div class="s">rejada ${mins(s.planned_min)}</div></div>
        <div class="metric glass"><div class="l">Uyqu</div><div class="v num">${sl.hours ? sl.hours.toFixed(1) + ' s' : '—'}</div><div class="s">turish ${sl.wake_actual || '—'} · uxlash ${sl.sleep_actual || '—'}</div></div>
      </div></div>
    <div class="card glass"><h3>Kun jadvali <span class="muted small" style="font-weight:400">— kulrang: reja, rangli: haqiqatda</span></h3>${a.tasks.length ? gantt(a) : '<div class="muted">Bu kun uchun ish rejalashtirilmagan.</div>'}</div>
    ${a.tasks.length ? `<div class="card glass" style="overflow-x:auto"><h3>Ishlar tafsiloti</h3><table class="tbl"><tr><th>Ish</th><th>Reja</th><th>Haqiqatda</th><th>Kechikish</th><th>Davomiyligi</th><th>Baho</th><th>Ball</th><th>Holat</th></tr>
      ${a.tasks.map(t => `<tr><td><b>${esc(t.title)}</b>${t.note ? `<div class="faint small">${esc(t.note)}</div>` : ''}</td><td class="num">${t.start}–${t.end}</td>
        <td class="num">${t.actual_start ? `${hhmm(t.actual_start)}–${t.actual_end ? hhmm(t.actual_end) : '…'}` : '—'}</td>
        <td class="num" style="color:${t.late > 20 ? 'var(--red)' : t.late > 5 ? 'var(--yellow)' : ''}">${t.late === null ? '—' : t.late > 0 ? '+' + t.late + ' daq' : "o'z vaqtida"}</td>
        <td class="num">${t.actual_min ?? '—'} / ${t.planned_min} daq</td><td>${t.rating ? '★'.repeat(t.rating) : '—'}</td><td class="num">${t.score === null ? '—' : pct(t.score)}</td>
        <td><span class="chip ${(STATUS[t.status] || STATUS.planned)[1]}">${(STATUS[t.status] || STATUS.planned)[0]}</span></td></tr>`).join('')}</table></div>` : ''}
    <div class="grid g2">
      <div class="card glass"><h3>Namozlar</h3>${BLOCKS.map(p => { const x = a.prayers[p]; return `<div class="row" style="padding:6px 0"><span class="dot" style="background:${x.status === 'vaqtida' ? 'var(--green)' : x.status === 'qazo' ? 'var(--red)' : 'var(--line-2)'}"></span><b class="grow">${PN[p]}</b><span class="muted num">${x.start}–${x.end}</span><span style="width:110px;text-align:right">${x.status === 'vaqtida' ? "O'z vaqtida" : x.status === 'qazo' ? 'Qazo' : '—'}</span></div>`; }).join('')}</div>
      <div class="card glass"><h3>Uyqu va uyg'onish</h3>
        <div style="padding:6px 0">🌅 Turish: reja <b>${sl.wake_plan}</b> · haqiqatda <b>${sl.wake_actual || '—'}</b>${late(sl.wake_late)}</div>
        <div style="padding:6px 0">🌙 Uxlash: reja <b>${sl.sleep_plan}</b> · haqiqatda <b>${sl.sleep_actual || '—'}</b>${late(sl.sleep_late)}</div>
        <div style="padding:6px 0">😴 Kechagi uyqu: <b>${sl.hours ? sl.hours.toFixed(1) + ' soat' : '—'}</b></div></div>
    </div>
    <div class="card glass"><h3>Xulosalar</h3>${a.insights.length ? a.insights.map(i => `<div class="ins"><span class="dot" style="margin-top:5px;background:${i.kind === 'good' ? 'var(--green)' : 'var(--yellow)'}"></span><span>${esc(i.text)}</span></div>`).join('') : '<div class="muted">Kun davom etmoqda — xulosalar ishlar bajarilgach chiqadi.</div>'}</div>
  </div>`;
  v.onclick = async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'back') { location.hash = '#/tarix'; return; }
    if (b.dataset.a === 'pdf') {
      try {
        const r = await fetch(`/api/report/${ds}.pdf`, { headers: { Authorization: 'Bearer ' + S.token } });
        if (!r.ok) throw new Error('PDF tayyorlanmadi');
        const url = URL.createObjectURL(await r.blob());
        const link = document.createElement('a'); link.href = url; link.download = `isloh-${ds}.pdf`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch (err) { fail(err); }
    }
  };
}

/* ================================================================ ILM: podkastlar va kitoblar */
VIEWS.ilm = async (v, alive) => {
  const tab = param('t') || 'podkast';
  const head = `<div class="head"><h1>Ilm</h1><div class="seg"><button data-t="podkast" class="${tab === 'podkast' ? 'on' : ''}">${ic('mic').replace('<svg', '<svg width="15" height="15" style="vertical-align:-3px"')} Podkastlar</button><button data-t="kitob" class="${tab === 'kitob' ? 'on' : ''}">${ic('book').replace('<svg', '<svg width="15" height="15" style="vertical-align:-3px"')} Kitoblar</button></div></div>`;
  if (tab === 'kitob') return books(v, head, alive);
  const ch = param('c') || '';
  const F = await api('GET', `/api/feed${ch ? '?channel=' + ch : ''}`);
  if (!alive()) return;
  const vcard = x => `<div class="vcard glass" data-v="${x.id}"><div class="th" style="background-image:url('https://i.ytimg.com/vi/${x.id}/mqdefault.jpg')">${x.watched_at ? '<span class="chip green w">ko\'rilgan</span>' : ''}</div>
    <div class="meta"><b>${esc(x.title)}</b><div class="faint small" style="margin-top:4px">${esc(x.channel_title)} · ${fmtDate(new Date(x.published).toISOString().slice(0, 10))}</div></div></div>`;
  v.innerHTML = `<div class="page">${head}
    <div class="card glass"><div class="row wrap">
      <div class="chips grow"><span class="chip pick ${!ch ? 'on' : ''}" data-c="">Hammasi</span>${F.channels.map(c => `<span class="chip pick ${ch === c.channel_id ? 'on' : ''}" data-c="${c.channel_id}">${esc(c.title || 'Kanal')} <span class="faint">${c.videos}</span></span>`).join('')}</div>
      <div class="row" style="min-width:300px"><input type="text" id="chu" placeholder="YouTube kanal havolasi yoki @nomi"><button class="btn" data-a="addch">${ic('plus')} Kanal</button></div></div>
      <div class="faint small" style="margin-top:8px">Yangi videolar kanallardan avtomatik yig'iladi (har 30 daqiqada).</div></div>
    ${F.items.length ? `<div class="vgrid">${F.items.map(vcard).join('')}</div>` : '<div class="empty">Hozircha video yo\'q. Internetga ulanganda kanallardan yuklanadi.</div>'}
    ${F.items.length >= 24 ? '<div style="text-align:center;margin-top:16px"><button class="btn" id="more">Yana</button></div>' : ''}</div>`;
  let items = F.items;
  v.onkeydown = e => { if (e.key === 'Enter' && e.target.id === 'chu') $('[data-a="addch"]').click(); };
  v.onclick = async e => {
    const t = e.target.closest('[data-t]'); if (t) { location.hash = `#/ilm?t=${t.dataset.t}`; return; }
    const c = e.target.closest('[data-c]'); if (c) { location.hash = `#/ilm${c.dataset.c ? '?c=' + c.dataset.c : ''}`; return; }
    const card = e.target.closest('.vcard');
    if (card) {
      const x = items.find(i => i.id === card.dataset.v);
      modal(`<h2 style="margin-bottom:10px">${esc(x.title)}</h2><iframe class="player" src="https://www.youtube-nocookie.com/embed/${x.id}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
        <div class="muted small" style="margin-top:10px">${esc(x.channel_title)} · ${fmtDate(new Date(x.published).toISOString().slice(0, 10))}</div>
        ${x.description ? `<p class="small muted" style="white-space:pre-wrap;max-height:140px;overflow:auto">${esc(x.description)}</p>` : ''}`, { wide: true });
      api('POST', `/api/videos/${x.id}/watched`).catch(() => {});
      return;
    }
    if (e.target.id === 'more') {
      const last = items[items.length - 1];
      const M = await api('GET', `/api/feed?before=${last.published}${ch ? '&channel=' + ch : ''}`);
      items = items.concat(M.items);
      $('.vgrid').insertAdjacentHTML('beforeend', M.items.map(vcard).join(''));
      if (M.items.length < 24) e.target.remove();
      return;
    }
    const b = e.target.closest('[data-a="addch"]');
    if (b) {
      const url = $('#chu').value.trim();
      if (!url) return;
      b.disabled = true;
      try { const r = await api('POST', '/api/channels', { url }); toast(`«${r.title}» qo'shildi`); refresh(); } catch (err) { fail(err); b.disabled = false; }
    }
  };
};
async function books(v, head, alive) {
  const B = await api('GET', '/api/books');
  if (!alive()) return;
  v.innerHTML = `<div class="page">${head}<div class="cols"><div class="card glass"><h3>Kitoblarim</h3>
    ${B.length ? B.map(b => { const p = b.pages ? Math.min(1, b.current / b.pages) : 0; return `<div class="book"><div><b>${esc(b.title)}</b> ${b.finished_at ? '<span class="chip green">o\'qildi</span>' : ''}<div class="faint small">${esc(b.author || '')}${b.pages ? ` · ${b.current} / ${b.pages} bet` : ''}</div><div class="pbar"><i style="width:${Math.round(p * 100)}%"></i></div></div>
      <div class="row">${b.finished_at ? '' : `<button class="btn sm" data-a="pg" data-id="${b.id}" data-v="${b.current + 10}">+10 bet</button><button class="btn sm" data-a="set" data-id="${b.id}">Sahifa</button>`}<button class="ibtn" data-a="bdel" data-id="${b.id}">${ic('trash')}</button></div></div>`; }).join('') : '<div class="muted">Hali kitob qo\'shilmagan.</div>'}
    </div><div class="card glass"><h3>Kitob qo'shish</h3>
      <label class="f"><span>Nomi</span><input type="text" id="b-t" placeholder="Masalan: Atom odatlar"></label>
      <label class="f"><span>Muallif</span><input type="text" id="b-a"></label>
      <label class="f"><span>Jami bet</span><input type="number" id="b-p" min="1" placeholder="320"></label>
      <button class="btn primary" style="width:100%" data-a="badd">${ic('plus')} Qo'shish</button>
      <div class="faint small" style="margin-top:10px">Kitob o'qishni «Reja» bo'limida har kungi ish sifatida ham qo'ying — vaqti tahlilga kiradi.</div></div></div></div>`;
  v.onclick = async e => {
    const t = e.target.closest('[data-t]'); if (t) { location.hash = `#/ilm?t=${t.dataset.t}`; return; }
    const b = e.target.closest('[data-a]'); if (!b) return;
    try {
      if (b.dataset.a === 'badd') { await api('POST', '/api/books', { title: $('#b-t').value, author: $('#b-a').value, pages: $('#b-p').value }); toast("Qo'shildi"); }
      if (b.dataset.a === 'pg') await api('PATCH', `/api/books/${b.dataset.id}`, { current: +b.dataset.v });
      if (b.dataset.a === 'set') { const n = prompt('Hozir nechanchi betdasiz?'); if (n === null) return; await api('PATCH', `/api/books/${b.dataset.id}`, { current: +n }); }
      if (b.dataset.a === 'bdel') { if (!(await confirmBox("Kitobni o'chirish", "Ro'yxatdan olib tashlansinmi?", "O'chirish", true))) return; await api('DELETE', `/api/books/${b.dataset.id}`); }
      refresh();
    } catch (err) { fail(err); }
  };
}

/* ================================================================ PROFIL (sozlamalar shu yerda) */
function heat(cells, kind) {
  const all = [...cells];
  let last = all[all.length - 1].date;
  while (pd(last).getUTCDay() !== 0) { last = addDays(last, 1); all.push({ date: last, future: true }); }
  const cols = Math.ceil(all.length / 7);
  let months = '', prev = -1;
  for (let c = 0; c < cols; c++) { const d = pd(all[c * 7].date), m = d.getUTCMonth(); months += `<span>${m !== prev && d.getUTCDate() <= 7 ? MSHORT[m] : ''}</span>`; prev = m; }
  const cls = c => (c.future ? 'nil' : c.level === null || c.level === undefined ? 'nil' : 'l' + c.level + (c.live ? ' live' : ''));
  const tip = c => (c.future || c.level == null ? '' : kind === 'p' ? `${fmtDate(c.date)}: ${c.ok ?? 0}/5 namoz vaqtida` : `${fmtDate(c.date)}: ${pct(c.score)}`);
  return `<div class="heat-box" data-cols="${cols}"><div class="heat-days"><span>Du</span><span></span><span>Ch</span><span></span><span>Ju</span><span></span><span>Ya</span></div>
    <div class="heat-wrap"><div class="heat-months" style="grid-template-columns:repeat(${cols},var(--cs))">${months}</div>
    <div class="heat">${all.map(c => `<i class="${cls(c)}" ${c.future || c.level == null ? '' : `data-d="${c.date}"`} title="${tip(c)}"></i>`).join('')}</div></div></div>`;
}
function fitHeat() {
  for (const b of $$('.heat-box')) { const w = b.parentElement.clientWidth - 30; b.style.setProperty('--cs', Math.max(9, Math.min(18, Math.floor(w / +b.dataset.cols) - 3)) + 'px'); }
  $$('.heat-wrap').forEach(w => { w.scrollLeft = w.scrollWidth; });
}
VIEWS.profil = async (v, alive) => {
  const [me, P] = await Promise.all([api('GET', '/api/me'), api('GET', '/api/profile')]);
  if (!alive()) return;
  S.me = me;
  const st = P.stats;
  const age = me.birth_date ? Math.floor((Date.now() - Date.parse(me.birth_date)) / 31556952000) : null;
  v.innerHTML = `<div class="page">
    <div class="head"><h1>Profil</h1></div>
    <div class="card glass"><div class="row wrap" style="gap:18px">
      <div class="avatar">${esc(((me.name || '').match(/\p{L}|\p{N}/u) || ['?'])[0].toUpperCase())}</div>
      <div class="grow"><div style="font-size:21px;font-weight:650">${esc(me.name)}</div>
        <div class="muted">${me.username ? '@' + esc(me.username) + ' · ' : ''}${esc(me.phone || '')}${age !== null ? ` · ${age} yosh` : ''}</div>
        <div class="faint small">${me.tg_name ? 'Telegram: ' + esc(me.tg_name) : ''}${me.birth_date ? ` · tug'ilgan: ${fmtDate(me.birth_date)}` : ''}</div></div>
      <div class="row"><div class="metric" style="text-align:center"><div class="v num">${st.streak}</div><div class="l">kun ketma-ket yashil</div></div>
        <div class="metric" style="text-align:center"><div class="v num">${pct(st.avg30)}</div><div class="l">o'rtacha (30 kun)</div></div></div>
    </div></div>
    <div class="card glass"><h3>Faollik <span class="muted small" style="font-weight:400">— har kun: yashil — bajarildi, sariq — kam, qizil — bajarilmadi</span></h3>
      ${heat(P.cells, 't')}
      <div class="legend"><span><i style="background:var(--green)"></i>95%+</span><span><i style="background:var(--green-2)"></i>80–94%</span><span><i style="background:var(--yellow)"></i>50–79%</span><span><i style="background:var(--red)"></i>&lt;50% yoki rejasiz</span>
        <span class="faint">· 30 kun: ${st.green30} yashil, ${st.yellow30} sariq, ${st.red30} qizil · eng uzun zanjir ${st.best} kun</span></div></div>
    <div class="card glass"><h3>Namozlar <span class="muted small" style="font-weight:400">— faqat namozlar hisobi</span></h3>
      ${heat(P.prayer_cells, 'p')}
      <div class="legend"><span><i style="background:var(--green)"></i>5/5 vaqtida</span><span><i style="background:var(--yellow)"></i>3–4</span><span><i style="background:var(--red)"></i>2 va kam</span>
        <span class="faint">· 30 kun: ${pct(st.prayers30)} vaqtida, ${st.qazo30} ta qazo</span></div></div>
    <div class="card glass" id="settings"><h3>Sozlamalar</h3>
      <div class="grid g3" style="gap:12px">
        <label class="f"><span>Ism</span><input type="text" id="p-name" value="${esc(me.name)}"></label>
        <label class="f"><span>Tug'ilgan sana</span><input type="date" id="p-bd" value="${me.birth_date || ''}"></label>
        <label class="f"><span>Shahar</span><select id="p-city">${S.config.cities.map(c => `<option value="${c.id}" ${c.id === me.city ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <label class="f"><span>Turish vaqti</span><input type="time" id="p-wake" value="${me.wake}"></label>
        <label class="f"><span>Uxlash vaqti</span><input type="time" id="p-sleep" value="${me.sleep}"></label>
        <label class="f"><span>Ertangi reja eslatmasi</span><input type="time" id="p-plan" value="${me.plan_remind}"></label>
      </div>
      <label class="f"><span>Namozdan oldin eslatish</span><div class="seg" id="p-nl">${[0, 4, 10, 15, 20].map(n => `<button data-v="${n}" class="${me.notify_lead === n ? 'on' : ''}">${n ? n + ' daq' : "O'chiq"}</button>`).join('')}</div></label>
      <label class="f"><span>Ishdan oldin eslatish</span><div class="seg" id="p-tl">${[0, 5, 10, 15].map(n => `<button data-v="${n}" class="${me.task_lead === n ? 'on' : ''}">${n ? n + ' daq' : 'Vaqtida'}</button>`).join('')}</div></label>
      <label class="f"><span>Namoz uchun ajratiladigan vaqt</span><div class="seg" id="p-pm">${[15, 20, 25, 30].map(n => `<button data-v="${n}" class="${me.prayer_mins === n ? 'on' : ''}">${n} daq</button>`).join('')}</div></label>
      <label class="f"><span>Mavzu</span><div class="seg" id="p-th"><button data-v="dark" class="${me.theme === 'dark' ? 'on' : ''}">${ic('moon').replace('<svg', '<svg width="14" height="14" style="vertical-align:-2px"')} Qorong'i</button><button data-v="light" class="${me.theme === 'light' ? 'on' : ''}">${ic('sun').replace('<svg', '<svg width="14" height="14" style="vertical-align:-2px"')} Yorug'</button></div></label>
      <div class="err" id="p-err"></div>
      <div class="row wrap"><button class="btn primary" data-a="save">Saqlash</button>
        <span class="grow"></span><button class="btn" data-a="logout">${ic('logout')} Chiqish</button></div>
      <div class="faint small" style="margin-top:10px">Barcha eslatmalar va hisobotlar Telegram bot (@${esc(S.config.bot_username)}) orqali keladi.</div>
    </div></div>`;
  fitHeat();
  window.onresize = () => { if (route() === 'profil') fitHeat(); };
  const pick = id => { const b = $(`#${id} button.on`); return b ? b.dataset.v : null; };
  v.onclick = async e => {
    const sb = e.target.closest('.seg button'); if (sb) { $$('button', sb.parentElement).forEach(x => x.classList.toggle('on', x === sb)); if (sb.parentElement.id === 'p-th') { document.documentElement.dataset.theme = sb.dataset.v; } return; }
    const cell = e.target.closest('.heat i[data-d]'); if (cell) { location.hash = `#/tarix?d=${cell.dataset.d}`; return; }
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'save') {
      try {
        S.me = await api('PUT', '/api/me', { name: $('#p-name').value, birth_date: $('#p-bd').value, city: $('#p-city').value, wake: $('#p-wake').value, sleep: $('#p-sleep').value,
          plan_remind: $('#p-plan').value, notify_lead: +pick('p-nl'), task_lead: +pick('p-tl'), prayer_mins: +pick('p-pm'), theme: pick('p-th') });
        localStorage.setItem('isloh_theme', S.me.theme); applyTheme(); toast('Saqlandi'); refresh();
      } catch (err) { $('#p-err').textContent = err.message; }
    }
    if (b.dataset.a === 'logout') { if (await confirmBox('Chiqish', "Bu qurilmadagi sessiya tugaydi. Ma'lumotlaringiz saqlanib qoladi.", 'Chiqish')) { api('POST', '/api/auth/logout').catch(() => {}); logoutLocal(); } }
  };
};

/* ================================================================ jonli yangilanish
   Botda tugma bosilganda (Boshlash, O'qidim...) ilova o'zi yangilanadi. Xabarlarning hammasi botdan keladi. */
let ES = null, refreshT;
function startEvents() {
  if (ES || !S.token) return;
  ES = new EventSource(`/api/events?token=${encodeURIComponent(S.token)}`);
  ES.onmessage = e => {
    let ev; try { ev = JSON.parse(e.data); } catch (err) { return; }
    if (ev.type === 'refresh') {
      clearTimeout(refreshT);
      refreshT = setTimeout(() => { if (!$('.modal-bg') && !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) refresh(); }, 400);
    }
  };
  ES.onerror = () => { ES.close(); ES = null; setTimeout(startEvents, 5000); };
}

/* ================================================================ ishga tushirish */
(async function boot() {
  applyTheme();
  requestAnimationFrame(loop);
  try { S.config = await api('GET', '/api/config'); } catch (e) { $('#gate').innerHTML = '<div class="gate"><div class="card glass"><h1>Server bilan aloqa yo\'q</h1><p>Isloh serveri ishga tushirilganini tekshiring.</p></div></div>'; return; }
  if (S.token) { try { S.me = await api('GET', '/api/me'); startEvents(); } catch (e) { S.token = ''; } }
  applyTheme();
  render();
})();
