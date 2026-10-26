'use strict';
/* Isloh — desktop dastur oynasi. Dastur yadrosi bilan window.isloh (IPC) orqali gaplashadi. */

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
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  repeat: '<path d="M4 12V9a3 3 0 0 1 3-3h13l-3-3m3 3-3 3M20 12v3a3 3 0 0 1-3 3H4l3 3m-3-3 3-3"/>',
};
const ic = (n, cls = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="${cls}">${P[n]}</svg>`;

/* ================================================================ holat, API, xabarlar */
const S = { token: localStorage.getItem('isloh_token') || '', me: null, config: null };
/* Desktop dastur yadrosi bilan aloqa (IPC) — internet, server yoki port kerak emas */
async function api(method, path, body) {
  const r = await window.isloh.api(method, path, body, S.token);
  if (r.status === 401 && S.token) { logoutLocal(); throw new Error('Qaytadan kiring'); }
  if (r.status !== 200) throw new Error(r.error || 'Xatolik yuz berdi');
  return r.data;
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
const NAV = [['home', 'home', 'Bosh sahifa'], ['bugun', 'plan', 'Bugun'], ['eslatma', 'bell', 'Eslatmalar'], ['ilm', 'book', 'Ilm'], ['profil', 'user', 'Profil']];
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
  ['bell', 'linear-gradient(135deg,#ff9f0a,#ff375f)', 'Eslatmalar', "Nimani eslatishni yozing va vaqtini tanlang — o'sha vaqtda Telegram bot xabar beradi. Har kecha esa kuningiz tahlili PDF bo'lib keladi."],
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
    // millisekund aniq; mikro va nanosekund raqamlari harakatni ko'rsatish uchun (tizim soati bunday aniqlikni bermaydi)
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

/* ================================================================ BUGUN: istalgan kun rejasi */
const AFTER = { bomdod: 'Bomdoddan keyin', peshin: 'Peshindan keyin', asr: 'Asrdan keyin', shom: 'Shomdan keyin', xufton: 'Xuftondan keyin' };
const PICON = { bomdod: 'dawn', quyosh: 'sunrise', peshin: 'sun', asr: 'cloudSun', shom: 'sunset', xufton: 'moon' };
const DURS = [15, 30, 45, 60, 90, 120];
let PL = null, calMonth = null, calFor = null;

function dayTitle(ds, today) {
  const n = Math.round((pd(ds) - pd(today)) / 864e5);
  return { 0: 'Bugun', 1: 'Ertaga', 2: 'Indinga', [-1]: 'Kecha' }[n] || WD[pd(ds).getUTCDay()];
}
const dayMin = ts => { const d = tzDate(ts); return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60; };
const hm = m => (m < 60 ? `${m} daq` : m % 60 ? `${Math.floor(m / 60)} s ${m % 60} daq` : `${m / 60} soat`);

/* Hozirgi va keyingi namoz (bugungi vaqtlar bo'yicha) */
function prayerNow(H, now = Date.now()) {
  const cur = BLOCKS.find(p => H.windows[p] && now >= H.windows[p][0] && now < H.windows[p][1]) || null;
  const seq = BLOCKS.map(p => [p, H.times[p]]).concat([['bomdod', H.next_bomdod]]);
  const nx = seq.find(([, t]) => t > now) || seq[seq.length - 1];
  return { cur, next: nx[0], nextAt: nx[1] };
}

/* Namoz halqasi: 24 soat, tepada peshin, pastda yarim tun */
function dial(H) {
  const C = 160, R = 96;
  const ang = m => ((m - 720) / 1440) * 2 * Math.PI;
  const pt = (m, r) => [C + r * Math.sin(ang(m)), C - r * Math.cos(ang(m))];
  const arc = (m1, m2, r = R) => {
    const d = (((m2 - m1) % 1440) + 1440) % 1440 || 0.01;
    const [x1, y1] = pt(m1, r), [x2, y2] = pt(m1 + d, r);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 ${d > 720 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };
  const m = Object.fromEntries(Object.entries(H.times).map(([k, t]) => [k, dayMin(t)]));
  const marks = ['bomdod', 'quyosh', 'peshin', 'asr', 'shom', 'xufton'].map(k => {
    const [x, y] = pt(m[k], R), [ix, iy] = pt(m[k], R + 22), sx = Math.sin(ang(m[k])), cy = Math.cos(ang(m[k]));
    // yozuv ikonkaning tashqi tomonida: chapda o'ngga, o'ngda chapga tekislanadi
    const side = sx < -0.4 ? 'end' : sx > 0.4 ? 'start' : 'middle';
    const lx = side === 'middle' ? ix : ix + (side === 'end' ? -12 : 12), ly = side === 'middle' ? iy - cy * 16 : iy;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" class="d-tick"/>
      <svg x="${(ix - 8).toFixed(1)}" y="${(iy - 8).toFixed(1)}" width="16" height="16" viewBox="0 0 24 24" class="d-ic ${k}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${P[PICON[k]]}</svg>
      <text x="${lx.toFixed(1)}" y="${(ly + 3.5).toFixed(1)}" class="d-lb" text-anchor="${side}">${PN[k]}</text>`;
  }).join('');
  return `<div class="dialw"><svg viewBox="0 0 320 320" class="dial">
      <circle cx="${C}" cy="${C}" r="${R}" class="d-base"/>
      <path d="${arc(m.bomdod, m.shom)}" class="d-day"/>
      <path d="${arc(m.shom, m.bomdod)}" class="d-night"/>
      <path id="d-prog" class="d-prog"/>
      ${marks}
      <g id="d-now"><circle r="13" class="d-sun"/><svg x="-8" y="-8" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" class="d-sic" id="d-sic"></svg></g>
    </svg>
    <div class="dial-c"><div class="d-k" id="d-k"></div><div class="d-v num" id="d-v"></div><div class="d-a num" id="d-a"></div></div></div>`;
}
function dialTick(H, now) {
  const C = 160, R = 96, nowM = dayMin(now), pn = prayerNow(H, now);
  const ang = x => ((x - 720) / 1440) * 2 * Math.PI;
  const pt = x => [C + R * Math.sin(ang(x)), C - R * Math.cos(ang(x))];
  const [nx, ny] = pt(nowM);
  const g = $('#d-now'); if (!g) return;
  g.setAttribute('transform', `translate(${nx.toFixed(1)} ${ny.toFixed(1)})`);
  const day = now >= H.times.quyosh && now < H.times.shom;
  g.classList.toggle('night', !day);
  $('#d-sic').innerHTML = P[day ? 'sun' : 'moon'];
  const from = pn.cur ? dayMin(H.windows[pn.cur][0]) : dayMin(H.times.quyosh);
  const d = (((nowM - from) % 1440) + 1440) % 1440;
  const [x1, y1] = pt(from), [x2, y2] = pt(from + Math.max(d, 0.01));
  $('#d-prog').setAttribute('d', `M${x1.toFixed(1)} ${y1.toFixed(1)}A${R} ${R} 0 ${d > 720 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`);
  const left = Math.max(0, pn.nextAt - now), h = Math.floor(left / 3600e3), mi = Math.floor(left % 3600e3 / 60e3), s = Math.floor(left % 60e3 / 1e3);
  $('#d-k').textContent = `Keyingi · ${PN[pn.next]}`;
  $('#d-v').textContent = h ? `${h} s ${pad(mi)} daq` : `${mi}:${pad(s)}`;
  $('#d-a').textContent = `${hhmm(pn.nextAt)} da`;
  const hn = $('#d-cur'); if (hn) hn.textContent = pn.cur ? PN[pn.cur] : 'Quyosh chiqqan';
}

/* Oy kalendari: istalgan kunni tanlab, oldindan rejalash */
function calendar(ym, ds, today, marks) {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)), lead = (first.getUTCDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(y, m - 1, 1 - lead + i)), s = d.toISOString().slice(0, 10);
    if (i >= 35 && s.slice(0, 7) !== ym) break;
    const cls = [s.slice(0, 7) !== ym ? 'out' : '', s < today ? 'past' : '', s === today ? 'today' : '', s === ds ? 'sel' : '', marks[s] ? 'has' : ''].join(' ');
    cells.push(`<button class="${cls}" data-d="${s}">${d.getUTCDate()}</button>`);
  }
  const mn = MONTHS[m - 1];
  return `<div class="cal-h"><button class="ibtn" data-cm="-1" title="Oldingi oy">${ic('back')}</button><b>${mn[0].toUpperCase() + mn.slice(1)} ${y}</b><button class="ibtn" data-cm="1" title="Keyingi oy">${ic('next')}</button></div>
    <div class="cal-g">${['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'].map(w => `<span class="wd">${w}</span>`).join('')}${cells.join('')}</div>
    ${ds !== today ? `<button class="btn ghost sm cal-back" data-d="${today}">${ic('back')} Bugunga qaytish</button>` : ''}`;
}

VIEWS.bugun = async (v, alive) => {
  const H = await api('GET', '/api/home');
  const today = H.date, ds = param('d') || today;
  if (calFor !== ds) { calMonth = ds.slice(0, 7); calFor = ds; }
  const [plan, marks] = await Promise.all([api('GET', `/api/plan?date=${ds}`), api('GET', `/api/plan/month?m=${calMonth}`)]);
  if (!alive()) return;
  const isToday = ds === today, isPast = ds < today;
  const nowM = normMin(hhmm(Date.now()));
  const pn = prayerNow(H);
  const city = ((S.config && S.config.cities) || []).find(c => c.id === S.me.city);
  PL = { ds, plan, isToday, isPast, nowM };

  const prayers = plan.items.filter(i => i.kind === 'prayer'), tasks = plan.items.filter(i => i.kind === 'task' || i.kind === 'meal');
  const prayerRow = it => {
    const st = plan.prayers[it.prayer], can = isToday && !st && nowM >= it.s;
    const now = isToday && pn.cur === it.prayer && !st;
    return `<div class="pl-row pr ${now ? 'now' : ''}">
      <button class="pl-chk ${st === 'vaqtida' ? 'ok' : st === 'qazo' ? 'qazo' : ''}" data-a="pray" data-p="${it.prayer}" ${can ? `title="O'qidim"` : 'disabled'}>${st === 'vaqtida' ? ic('check') : st === 'qazo' ? ic('x') : ''}</button>
      <span class="pl-ic">${ic(PICON[it.prayer])}</span><b class="pl-name">${PN[it.prayer]}</b><span class="pl-time num">${it.start}</span><span class="grow"></span>
      ${now ? '<span class="pl-now"><i></i>HOZIR</span>' : st === 'qazo' ? '<span class="chip red">Qazo</span>' : st === 'vaqtida' ? `<span class="chip green">O'qildi</span>` : ''}</div>`;
  };
  const taskRow = t => {
    const tick = isToday && (t.status === 'planned' || t.status === 'active');
    const st = { active: '<span class="chip blue">Davom etmoqda</span>', missed: `<span class="chip red">O'tkazildi</span>` }[t.status] || '';
    const real = t.actual_start ? ` · haqiqatda ${hhmm(t.actual_start)}${t.late ? ` (+${t.late} daq)` : ''}` : '';
    return `<div class="pl-row tk ${t.status}" data-a="open" data-id="${t.id}">
      <button class="pl-box ${t.status}" data-a="tick" data-id="${t.id}" ${tick ? `title="${t.status === 'planned' ? 'Boshlash' : 'Tugatish'}"` : 'disabled'}>${t.status === 'done' ? ic('check') : t.status === 'missed' ? ic('x') : ''}</button>
      <div class="grow pl-tt"><b>${esc(t.title)}</b><div class="pl-meta num"><i style="background:${CATC[t.category] || '#888'}"></i>${t.start} · ${hm(t.planned_min)} · ${esc(t.category_name)}${real}</div></div>
      ${st}${t.rating ? `<span class="pl-stars">${'★'.repeat(t.rating)}</span>` : t.status === 'done' && isToday ? `<button class="btn sm" data-a="rate" data-id="${t.id}">Baholash</button>` : ''}</div>`;
  };
  let rows = tasks.filter(t => t.s < prayers[0].s).map(taskRow).join('');
  prayers.forEach((p, i) => {
    const end = i + 1 < prayers.length ? prayers[i + 1].s : Infinity;
    rows += prayerRow(p) + tasks.filter(t => t.s >= p.s && t.s < end).map(taskRow).join('');
    if (!isPast) rows += `<button class="pl-add" data-a="add" data-after="${p.prayer}">${ic('plus')} ${AFTER[p.prayer]} qo'shish</button>`;
  });
  const d = pd(ds);
  v.innerHTML = `<div class="pl">
    <div class="pl-head"><div><div class="pl-eye">${hijri(ds)}${city ? ' · ' + esc(city.name) : ''}</div>
      <h1>${dayTitle(ds, today)} <span>${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}${dayTitle(ds, today) === WD[d.getUTCDay()] ? '' : ', ' + WD[d.getUTCDay()]}</span></h1></div>
      <span class="grow"></span>
      ${isPast ? `<span class="chip">O'tgan kun — faqat ko'rish</span>` : `<button class="btn primary" data-a="add">${ic('plus')} Qo'shish <kbd>Ctrl K</kbd></button>`}</div>
    <div class="pl-cols">
      <div class="pl-list">${rows}${!tasks.length && !isPast ? `<div class="pl-hint">${ic('bell')} Ishlaringizni namozlar orasiga qo'shing — vaqti kelganda @${esc((S.config && S.config.bot_username) || 'islohuzbot')} xabar beradi.</div>` : ''}</div>
      <div class="pl-side">
        <div class="card glass nowc"><div class="nowc-h"><span class="muted">Hozir</span><b id="d-cur"></b></div>${dial(H)}</div>
        <div class="card glass cal">${calendar(calMonth, ds, today, marks)}</div>
      </div>
    </div></div>`;
  dialTick(H, Date.now());
  let lastSec = 0;
  tickFns.push(now => {
    const s = Math.floor(now / 1000);
    if (s === lastSec) return;
    lastSec = s;
    dialTick(H, now);
    const p = prayerNow(H, now);
    if (p.cur !== pn.cur) refresh(); // namoz vaqti kirdi yoki tugadi
  });
  v.onclick = async e => {
    const cm = e.target.closest('[data-cm]');
    if (cm) {
      const [y, m] = calMonth.split('-').map(Number), n = new Date(Date.UTC(y, m - 1 + +cm.dataset.cm, 1));
      calMonth = n.toISOString().slice(0, 7);
      const mk = await api('GET', `/api/plan/month?m=${calMonth}`);
      if (alive()) $('.cal', v).innerHTML = calendar(calMonth, ds, today, mk);
      return;
    }
    const day = e.target.closest('[data-d]');
    if (day) { location.hash = day.dataset.d === today ? '#/bugun' : `#/bugun?d=${day.dataset.d}`; return; }
    const b = e.target.closest('[data-a]');
    if (!b || b.disabled) return;
    const a = b.dataset.a, id = +b.dataset.id, t = tasks.find(x => x.id === id);
    try {
      if (a === 'add') return quickAdd(PL, b.dataset.after);
      if (a === 'pray') { await api('POST', '/api/prayers', { date: ds, prayer: b.dataset.p }); toast('Alloh qabul qilsin!'); }
      if (a === 'tick' && t.status === 'planned') { const r = await api('POST', `/api/tasks/${id}/start`); toast(r.late ? `Boshlandi — ${r.late} daqiqa kech` : "Boshlandi — o'z vaqtida"); }
      if (a === 'tick' && t.status === 'active') { const r = await api('POST', `/api/tasks/${id}/finish`); refresh(); return rateModal(r); }
      if (a === 'rate') return rateModal(t);
      if (a === 'open') { if (t.status === 'planned' && !isPast) return taskSheet(PL, t); return; }
      refresh();
    } catch (err) { fail(err); refresh(); }
  };
};

document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k' || $('.modal-bg')) return;
  if (route() === 'bugun' && PL && !PL.isPast) { e.preventDefault(); quickAdd(PL); }
  if (route() === 'eslatma' && $('#r-text')) { e.preventDefault(); $('#r-text').focus(); }
});

/* Matndan vaqt, davomiylik, namoz va yo'nalishni ajratib olish: "Ingliz tili 19:00 45daq", "kitob shomdan keyin 1 soat #ilm" */
function parseQuick(text) {
  let s = ` ${text} `, after = null, start = null, dur = null, cat = null;
  s = s.replace(/\s(bomdod|peshin|asr|shom|xufton)(?:dan|din)?\s+keyin(?=\s)/i, (m, p) => { after = p.toLowerCase(); return ' '; });
  s = s.replace(/\s([01]?\d|2[0-3])[:.]([0-5]\d)(?=\s)/, (m, h, mm) => { start = `${pad(h)}:${mm}`; return ' '; });
  s = s.replace(/\s(\d+(?:[.,]5)?)\s*(soat|s|h)(?=\s)/i, (m, n) => { dur = Math.round(parseFloat(n.replace(',', '.')) * 60); return ' '; });
  s = s.replace(/\s(\d{1,3})\s*(daqiqa|daq|min|m)(?=\s)/i, (m, n) => { dur = (dur || 0) + +n; return ' '; });
  s = s.replace(/\s#([\p{L}']+)(?=\s)/u, (m, c) => {
    const k = CATS.find(([key, name]) => key === c.toLowerCase() || name.toLowerCase() === c.toLowerCase());
    if (!k) return m;
    cat = k[0]; return ' ';
  });
  return { title: s.replace(/\s+/g, ' ').trim(), after, start, dur, cat };
}
/* Bo'sh joy: berilgan daqiqadan boshlab, namoz va boshqa ishlarga tegmaydigan birinchi oraliq */
function freeAt(plan, from, len, skip) {
  let s = Math.ceil(from / 5) * 5;
  for (let g = 0; g < 60; g++) {
    const hit = plan.items.find(i => i.id !== skip && s < i.e && s + len > i.s);
    if (!hit) break;
    s = Math.ceil(hit.e / 5) * 5;
  }
  return s;
}
function quickAdd(ctx, preAfter) {
  const { plan, ds, isToday, nowM } = ctx;
  const slotEnd = p => (plan.items.find(i => i.kind === 'prayer' && i.prayer === p) || {}).e;
  let cat = 'ilm';
  const m = modal(`<div class="qa"><div class="qa-k"><span>TEZKOR QO'SHISH</span><span>${dayTitle(ds, plan.today)} · ${fmtDay(ds).split(', ')[1]}</span></div>
      <input type="text" id="qa-in" maxlength="160" autocomplete="off" placeholder="Nima qilasiz? Masalan: Ingliz tili 19:00 45daq" autofocus>
      <div class="chips qa-chips" id="qa-ch"></div>
      <div class="chips qa-cat" id="qa-cat">${CATS.map(([k, n]) => `<span class="chip pick sm ${k === cat ? 'on' : ''}" data-c="${k}"><span class="dot" style="background:${CATC[k]}"></span>${n}</span>`).join('')}</div>
      <div class="err" id="qa-err"></div>
      <div class="foot"><button class="btn" data-x="more">Batafsil</button><button class="btn primary" data-x="ok">Saqlash <kbd>↵</kbd></button></div></div>`);
  const inp = $('#qa-in', m.el);
  const calc = () => {
    const q = parseQuick(inp.value), after = q.after || preAfter || null, len = q.dur || 30;
    let s;
    if (q.start) s = normMin(q.start);
    else s = freeAt(plan, after ? slotEnd(after) : isToday ? Math.max(nowM + 5, toMin(plan.wake)) : slotEnd('bomdod'), len);
    if (q.cat) cat = q.cat;
    return { ...q, after, len, s, start: fmtMin(s), end: fmtMin(s + len) };
  };
  const paint = () => {
    const q = calc();
    $('#qa-ch', m.el).innerHTML = `${q.after ? `<span class="chip blue">${ic(PICON[q.after])} ${AFTER[q.after]}</span>` : ''}<span class="chip">${ic('clock')} ${q.start}–${q.end}</span><span class="chip">${hm(q.len)}</span>`;
    $$('#qa-cat .chip', m.el).forEach(c => c.classList.toggle('on', c.dataset.c === cat));
    $('#qa-err', m.el).textContent = '';
  };
  paint();
  inp.addEventListener('input', paint);
  const save = async () => {
    const q = calc();
    if (!q.title) { $('#qa-err', m.el).textContent = 'Ish nomini yozing'; inp.focus(); return; }
    try {
      await api('POST', '/api/tasks', { date: ds, title: q.title, start: q.start, end: q.end, category: cat });
      m.close(); toast(`Qo'shildi: ${q.start}`); refresh();
    } catch (err) { $('#qa-err', m.el).textContent = err.message; }
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
  m.el.addEventListener('click', e => {
    const c = e.target.closest('[data-c]'); if (c) { cat = c.dataset.c; paint(); inp.focus(); return; }
    const x = e.target.closest('[data-x]'); if (!x) return;
    if (x.dataset.x === 'ok') return save();
    const q = calc();
    m.close();
    taskSheet(ctx, null, { title: q.title, start: q.start, end: q.end, category: cat });
  });
}
/* Batafsil: yangi ish yoki mavjud ishni tahrirlash */
function taskSheet(ctx, t, pre = {}) {
  const v0 = t || pre;
  let cat = v0.category || 'ilm';
  const lead = S.me.task_lead ?? 5;
  const m = modal(`<h2>${t ? 'Ishni tahrirlash' : 'Yangi ish'}</h2><p class="muted small" style="margin:0 0 14px">${dayTitle(ctx.ds, ctx.plan.today)}, ${fmtDate(ctx.ds)}</p>
    <label class="f"><span>Nomi</span><input type="text" id="e-t" value="${esc(v0.title || '')}" maxlength="120" placeholder="Masalan: Ingliz tili — so'z yodlash" autofocus></label>
    <div class="grid g2" style="gap:10px"><label class="f"><span>Boshlanishi</span><input type="time" id="e-s" value="${v0.start || ''}"></label><label class="f"><span>Tugashi</span><input type="time" id="e-e" value="${v0.end || ''}"></label></div>
    <div class="chips" id="e-d" style="margin:-2px 0 14px">${DURS.map(n => `<span class="chip pick sm" data-n="${n}">${hm(n)}</span>`).join('')}</div>
    <label class="f"><span>Yo'nalish</span><div class="chips" id="e-c">${CATS.map(([k, n]) => `<span class="chip pick sm ${k === cat ? 'on' : ''}" data-c="${k}"><span class="dot" style="background:${CATC[k]}"></span>${n}</span>`).join('')}</div></label>
    <div class="pl-note">${ic('bell')} Boshlanishidan ${lead ? lead + ' daqiqa oldin' : 'vaqtida'} Telegram bot xabar beradi: «Boshlash» va «Tugatish».</div>
    <div class="err" id="e-err"></div>
    <div class="foot">${t ? `<button class="btn red" data-x="del" style="margin-right:auto">${ic('trash')} O'chirish</button>` : ''}<button class="btn" data-x="c">Bekor</button><button class="btn primary" data-x="ok">Saqlash</button></div>`);
  const el = m.el, sIn = $('#e-s', el), eIn = $('#e-e', el);
  const durNow = () => (sIn.value && eIn.value ? normMin(eIn.value) - normMin(sIn.value) : 0);
  const paint = () => $$('#e-d .chip', el).forEach(c => c.classList.toggle('on', +c.dataset.n === durNow()));
  let dur = durNow() || 30;
  sIn.addEventListener('change', () => { if (sIn.value) eIn.value = fmtMin(normMin(sIn.value) + dur); paint(); });
  eIn.addEventListener('change', () => { dur = durNow() || dur; paint(); });
  paint();
  const save = async () => {
    const body = { title: $('#e-t', el).value, start: sIn.value, end: eIn.value, category: cat };
    if (!body.title.trim()) { $('#e-err', el).textContent = 'Ish nomini yozing'; return; }
    if (!body.start || !body.end) { $('#e-err', el).textContent = 'Vaqtni kiriting'; return; }
    try {
      if (t) await api('PATCH', `/api/tasks/${t.id}`, body);
      else await api('POST', '/api/tasks', { ...body, date: ctx.ds });
      m.close(); toast(t ? 'Saqlandi' : `Qo'shildi: ${body.start}`); refresh();
    } catch (err) { $('#e-err', el).textContent = err.message; }
  };
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'e-t') save(); });
  el.addEventListener('click', async e => {
    const d = e.target.closest('#e-d [data-n]');
    if (d) { dur = +d.dataset.n; if (!sIn.value) sIn.value = fmtMin(freeAt(ctx.plan, ctx.isToday ? ctx.nowM + 5 : toMin(ctx.plan.wake), dur, t && t.id)); eIn.value = fmtMin(normMin(sIn.value) + dur); paint(); return; }
    const c = e.target.closest('#e-c [data-c]');
    if (c) { cat = c.dataset.c; $$('#e-c .chip', el).forEach(x => x.classList.toggle('on', x === c)); return; }
    const x = e.target.closest('[data-x]'); if (!x) return;
    if (x.dataset.x === 'c') return m.close();
    if (x.dataset.x === 'ok') return save();
    if (x.dataset.x === 'del') {
      m.close();
      if (!(await confirmBox("Ishni o'chirish", `«${t.title}» bu kundan o'chiriladi.`, "O'chirish", true))) return;
      try { await api('DELETE', `/api/tasks/${t.id}`); toast("O'chirildi"); refresh(); } catch (err) { fail(err); }
    }
  });
}

/* ================================================================ ESLATMALAR: matn va vaqt — o'sha vaqtda Telegram bot xabar beradi */
const localToday = () => tzDate().toISOString().slice(0, 10);
const nowHM = (add = 0) => { const d = tzDate(Date.now() + add * 60e3); return { date: d.toISOString().slice(0, 10), time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` }; };
function leftText(ms) {
  if (ms <= 0) return 'hozir';
  const m = Math.ceil(ms / 60e3);
  if (m < 60) return `${m} daqiqadan keyin`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 24) return `${h} soat${r ? ` ${r} daqiqa` : ''}dan keyin`;
  return `${Math.round(h / 24)} kundan keyin`;
}
const remDay = (ds, today) => { const t = dayTitle(ds, today), d = pd(ds); return ['Bugun', 'Ertaga', 'Indinga', 'Kecha'].includes(t) ? t : `${t}, ${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}`; };

VIEWS.eslatma = async (v, alive) => {
  const R = await api('GET', '/api/reminders');
  if (!alive()) return;
  const today = localToday(), tomorrow = addDays(today, 1);
  const bot = esc((S.config && S.config.bot_username) || 'islohuzbot');
  const groups = [];
  for (const r of R.upcoming) { const g = groups[groups.length - 1]; if (g && g.date === r.date) g.items.push(r); else groups.push({ date: r.date, items: [r] }); }
  const row = r => `<div class="pl-row rm" data-a="edit" data-id="${r.id}">
      <button class="pl-chk" data-a="done" data-id="${r.id}" title="Bajarildi — eslatish shart emas"></button>
      <div class="grow pl-tt"><b>${esc(r.text)}</b><div class="pl-meta num">${ic('bell')} ${r.time} · <span class="rm-left" data-at="${r.at}">${leftText(r.at - Date.now())}</span></div></div>
      <button class="ibtn" data-a="del" data-id="${r.id}" title="O'chirish">${ic('trash')}</button></div>`;
  const prow = r => `<div class="rm-p" data-a="edit" data-id="${r.id}"><span class="rm-pi ${r.done_at && !r.sent_at ? 'done' : ''}">${ic('check')}</span>
      <div class="grow"><div class="rm-pt">${esc(r.text)}</div><div class="faint small num">${r.sent_at ? `Yuborildi · ${remDay(r.date, today)} ${r.time}` : `Bajarildi · ${remDay(r.date, today)} ${r.time} edi`}</div></div>
      <button class="ibtn" data-a="del" data-id="${r.id}" title="O'chirish">${ic('trash')}</button></div>`;
  v.innerHTML = `<div class="pl">
    <div class="pl-head"><div><div class="pl-eye">Vaqti kelganda @${bot} xabar beradi</div><h1>Eslatmalar</h1></div></div>
    <div class="pl-cols"><div>
      <div class="card glass rm-add">
        <div class="rm-in"><span></span><input type="text" id="r-text" maxlength="300" autocomplete="off" placeholder="Nimani eslatay? Masalan: Onamga qo'ng'iroq qilish 18:30"></div>
        <div class="rm-when">
          <div class="seg" id="r-day"><button data-d="${today}" class="on">Bugun</button><button data-d="${tomorrow}">Ertaga</button></div>
          <input type="date" id="r-date" value="${today}" min="${today}"><input type="time" id="r-time">
          <span class="grow"></span><button class="btn primary" data-a="add">${ic('plus')} Qo'shish</button></div>
        <div class="chips rm-quick">${[['15', '15 daqiqadan keyin'], ['60', '1 soatdan keyin'], ['t21', 'Bugun 21:00'], ['m08', 'Ertaga 08:00']].map(([k, n]) => `<span class="chip pick sm" data-q="${k}">${n}</span>`).join('')}</div>
        <div class="err" id="r-err"></div>
      </div>
      ${groups.length ? groups.map(g => `<div class="rm-sec">${remDay(g.date, today)} <span>${g.items.length}</span></div>${g.items.map(row).join('')}`).join('')
        : `<div class="pl-hint" style="padding-top:26px">${ic('bell')} Hozircha eslatma yo'q. Yozing va vaqtini tanlang — o'sha vaqtda Telegram'ga xabar keladi.</div>`}
    </div><div class="pl-side">
      <div class="card glass rm-past"><div class="row" style="margin-bottom:8px"><h3 class="grow" style="margin:0">Yuborilganlar</h3>${R.past.length ? '<button class="btn ghost sm" data-a="clear">Tozalash</button>' : ''}</div>
        ${R.past.length ? R.past.map(prow).join('') : '<div class="muted small">Hali yo\'q.</div>'}</div>
    </div></div></div>`;

  const tIn = $('#r-text'), dIn = $('#r-date'), hIn = $('#r-time'), err = $('#r-err');
  const syncDay = () => $$('#r-day button').forEach(b => b.classList.toggle('on', b.dataset.d === dIn.value));
  // matndagi vaqt (18:30) o'zi vaqt maydoniga o'tadi
  const timeRx = /(^|\s)([01]?\d|2[0-3])[:.]([0-5]\d)(?=\s|$)/;
  tIn.addEventListener('input', () => { const m = tIn.value.match(timeRx); if (m) hIn.value = `${pad(m[2])}:${m[3]}`; err.textContent = ''; });
  dIn.addEventListener('change', syncDay);
  if (!v.classList.contains('still')) setTimeout(() => tIn.focus(), 60);
  tickFns.push(now => {
    for (const el of $$('.rm-left', v)) {
      const ms = +el.dataset.at - now;
      el.textContent = leftText(ms);
      el.classList.toggle('soon', ms < 10 * 60e3);
    }
  });
  const add = async () => {
    const text = tIn.value.replace(timeRx, ' ').replace(/\s+/g, ' ').trim();
    if (!text) { err.textContent = 'Nimani eslatishni yozing'; tIn.focus(); return; }
    if (!hIn.value) { err.textContent = 'Vaqtni tanlang'; hIn.focus(); return; }
    try {
      const r = await api('POST', '/api/reminders', { text, date: dIn.value, time: hIn.value });
      toast(`Eslatma: ${remDay(r.date, today)} ${r.time}`); refresh();
    } catch (e) { err.textContent = e.message; }
  };
  v.onkeydown = e => { if (e.key === 'Enter' && (e.target === tIn || e.target === hIn)) { e.preventDefault(); add(); } };
  v.onclick = async e => {
    const d = e.target.closest('#r-day [data-d]'); if (d) { dIn.value = d.dataset.d; syncDay(); return; }
    const q = e.target.closest('[data-q]');
    if (q) {
      const k = q.dataset.q, x = k === 't21' ? { date: today, time: '21:00' } : k === 'm08' ? { date: tomorrow, time: '08:00' } : nowHM(+k);
      dIn.value = x.date; hIn.value = x.time; syncDay(); err.textContent = ''; tIn.focus(); return;
    }
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a, id = +b.dataset.id, r = R.upcoming.concat(R.past).find(x => x.id === id);
    try {
      if (a === 'add') return add();
      if (a === 'done') { e.stopPropagation(); await api('PATCH', `/api/reminders/${id}`, { done: true }); toast('Bajarildi'); }
      if (a === 'del') { e.stopPropagation(); await api('DELETE', `/api/reminders/${id}`); toast("O'chirildi"); }
      if (a === 'clear') { if (!(await confirmBox('Tozalash', "Yuborilgan va bajarilgan eslatmalar o'chiriladi.", 'Tozalash', true))) return; await api('DELETE', '/api/reminders'); }
      if (a === 'edit') return remSheet(r, today);
      refresh();
    } catch (err2) { fail(err2); }
  };
};
/* Eslatmani tahrirlash yoki qaytadan eslatish */
function remSheet(r, today) {
  const sent = !!(r.sent_at || r.done_at);
  const m = modal(`<h2>${sent ? 'Qayta eslatish' : 'Eslatmani tahrirlash'}</h2>
    <label class="f" style="margin-top:12px"><span>Nimani eslatay?</span><input type="text" id="m-text" maxlength="300" value="${esc(r.text)}" autofocus></label>
    <div class="grid g2" style="gap:10px"><label class="f"><span>Kun</span><input type="date" id="m-date" min="${today}" value="${sent ? today : r.date}"></label>
      <label class="f"><span>Vaqt</span><input type="time" id="m-time" value="${sent ? '' : r.time}"></label></div>
    <div class="err" id="m-err"></div>
    <div class="foot"><button class="btn red" data-x="del" style="margin-right:auto">${ic('trash')} O'chirish</button><button class="btn" data-x="c">Bekor</button><button class="btn primary" data-x="ok">${sent ? 'Qayta eslatish' : 'Saqlash'}</button></div>`);
  const save = async () => {
    const body = { text: $('#m-text', m.el).value, date: $('#m-date', m.el).value, time: $('#m-time', m.el).value };
    if (!body.time) { $('#m-err', m.el).textContent = 'Vaqtni tanlang'; return; }
    if (!sent && body.date === r.date && body.time === r.time) { delete body.date; delete body.time; }
    try { await api('PATCH', `/api/reminders/${r.id}`, body); m.close(); toast('Saqlandi'); refresh(); } catch (e) { $('#m-err', m.el).textContent = e.message; }
  };
  m.el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') save(); });
  m.el.addEventListener('click', async e => {
    const x = e.target.closest('[data-x]'); if (!x) return;
    if (x.dataset.x === 'c') return m.close();
    if (x.dataset.x === 'ok') return save();
    if (x.dataset.x === 'del') { try { await api('DELETE', `/api/reminders/${r.id}`); m.close(); toast("O'chirildi"); refresh(); } catch (err) { fail(err); } }
  });
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
      <div class="faint small" style="margin-top:8px">Yangi videolar kanallardan avtomatik yig'iladi (har 10 daqiqada).</div></div>
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
    const cell = e.target.closest('.heat i[data-d]'); if (cell) { location.hash = `#/bugun?d=${cell.dataset.d}`; return; }
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
let evBound = false, refreshT;
function startEvents() {
  if (evBound) return;
  evBound = true;
  window.isloh.onEvent(ev => {
    if (ev.type !== 'refresh' || !S.me || ev.userId !== S.me.id) return;
    clearTimeout(refreshT);
    refreshT = setTimeout(() => { if (!$('.modal-bg') && !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) refresh(); }, 400);
  });
}

/* ================================================================ ishga tushirish */
(async function boot() {
  applyTheme();
  requestAnimationFrame(loop);
  try { S.config = await api('GET', '/api/config'); } catch (e) { $('#gate').innerHTML = '<div class="gate"><div class="card glass"><h1>Isloh ishga tushmadi</h1><p>Dasturni yopib, qayta oching.</p></div></div>'; return; }
  if (S.token) { try { S.me = await api('GET', '/api/me'); startEvents(); } catch (e) { S.token = ''; } }
  applyTheme();
  render();
})();
