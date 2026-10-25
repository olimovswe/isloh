'use strict';
/* Namoz vaqtlarini internetsiz hisoblash (astronomik formula, PrayTimes algoritmi asosida).
   Standart sozlamalar namozvaqti.uz dagi Toshkent 2026 yillik jadvaliga moslab kalibrlangan:
   o'rtacha xato ~0.2 daqiqa, eng katta farq 1-3 daqiqa. */
(function (root) {
  const PRAYERS = ['bomdod', 'quyosh', 'peshin', 'asr', 'shom', 'xufton'];
  // namozvaqti.uz (Toshkent, 2026) bilan solishtirib topilgan doimiy tuzatishlar, daqiqada
  const CALIB = { bomdod: 0.4, quyosh: -0.1, peshin: 4.7, asr: 0.0, shom: 1.7, xufton: -3.4 };

  const CITIES = [
    { id: 'toshkent', name: 'Toshkent', lat: 41.2995, lon: 69.2401 },
    { id: 'nurafshon', name: 'Nurafshon', lat: 41.0400, lon: 69.3600 },
    { id: 'andijon', name: 'Andijon', lat: 40.7821, lon: 72.3442 },
    { id: 'buxoro', name: 'Buxoro', lat: 39.7681, lon: 64.4556 },
    { id: 'fargona', name: "Farg'ona", lat: 40.3842, lon: 71.7843 },
    { id: 'qoqon', name: "Qo'qon", lat: 40.5286, lon: 70.9425 },
    { id: 'guliston', name: 'Guliston', lat: 40.4897, lon: 68.7842 },
    { id: 'jizzax', name: 'Jizzax', lat: 40.1158, lon: 67.8422 },
    { id: 'namangan', name: 'Namangan', lat: 40.9983, lon: 71.6726 },
    { id: 'navoiy', name: 'Navoiy', lat: 40.0844, lon: 65.3792 },
    { id: 'nukus', name: 'Nukus', lat: 42.4600, lon: 59.6000 },
    { id: 'qarshi', name: 'Qarshi', lat: 38.8606, lon: 65.7891 },
    { id: 'samarqand', name: 'Samarqand', lat: 39.6542, lon: 66.9597 },
    { id: 'termiz', name: 'Termiz', lat: 37.2242, lon: 67.2783 },
    { id: 'urganch', name: 'Urganch', lat: 41.5500, lon: 60.6333 },
  ];

  const DEFAULTS = {
    city: 'toshkent', lat: 41.2995, lon: 69.2401, tz: 5,
    fajr_angle: 15.5, isha_angle: 15.5, asr_factor: 2, // Hanafiy = 2, Shofi'iy = 1
    offsets: { bomdod: 0, quyosh: 0, peshin: 0, asr: 0, shom: 0, xufton: 0 },
  };

  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const sin = d => Math.sin(rad(d)), cos = d => Math.cos(rad(d)), tan = d => Math.tan(rad(d));
  const asin = x => deg(Math.asin(x)), acos = x => deg(Math.acos(Math.max(-1, Math.min(1, x))));
  const atan2 = (y, x) => deg(Math.atan2(y, x)), acot = x => deg(Math.atan(1 / x));
  const fix = (a, b) => a - b * Math.floor(a / b);

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }
  function sun(jd) {
    const D = jd - 2451545.0;
    const g = fix(357.529 + 0.98560028 * D, 360);
    const q = fix(280.459 + 0.98564736 * D, 360);
    const L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
    const e = 23.439 - 0.00000036 * D;
    const ra = fix(atan2(cos(e) * sin(L), cos(L)) / 15, 24);
    return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - ra };
  }
  function rawTimes(y, m, d, p) {
    const lat = p.lat, lon = p.lon;
    const jd = julian(y, m, d) - lon / (15 * 24);
    const noon = t => fix(12 - sun(jd + t).eqt, 24);
    const angleTime = (angle, t, before) => {
      const decl = sun(jd + t).decl;
      const h = acos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15;
      return before ? noon(t) - h : noon(t) + h;
    };
    const asrTime = (factor, t) => {
      const decl = sun(jd + t).decl;
      return angleTime(-acot(factor + tan(Math.abs(lat - decl))), t, false);
    };
    let t = { bomdod: 5, quyosh: 6, peshin: 12, asr: 13, shom: 18, xufton: 18 };
    for (let i = 0; i < 2; i++) {
      const f = {};
      for (const k in t) f[k] = t[k] / 24;
      t = {
        bomdod: angleTime(p.fajr_angle, f.bomdod, true),
        quyosh: angleTime(0.833, f.quyosh, true),
        peshin: noon(f.peshin),
        asr: asrTime(p.asr_factor, f.asr),
        shom: angleTime(0.833, f.shom, false),
        xufton: angleTime(p.isha_angle, f.xufton, false),
      };
    }
    const shift = p.tz - lon / 15;
    for (const k in t) t[k] += shift;
    return t;
  }

  function merged(params) {
    const p = { ...DEFAULTS, ...(params || {}) };
    p.offsets = { ...DEFAULTS.offsets, ...((params && params.offsets) || {}) };
    if (p.city && p.city !== 'custom') {
      const c = CITIES.find(x => x.id === p.city);
      if (c) { p.lat = c.lat; p.lon = c.lon; p.tz = 5; }
    }
    return p;
  }

  /* 'YYYY-MM-DD' sana uchun {bomdod: Date, ...}. Date — aniq lahza; joy vaqt mintaqasi (tz) hisobga olingan. */
  function timesFor(ds, params) {
    const p = merged(params);
    const [y, m, d] = ds.split('-').map(Number);
    const raw = rawTimes(y, m, d, p);
    const out = {};
    for (const k of PRAYERS) {
      const minutes = Math.round(raw[k] * 60 + CALIB[k] + (+p.offsets[k] || 0));
      out[k] = new Date(Date.UTC(y, m - 1, d, 0, minutes) - p.tz * 3600e3);
    }
    return out;
  }
  const pad = n => String(n).padStart(2, '0');
  function timesHHMM(ds, params) {
    const t = timesFor(ds, params), out = {};
    for (const k of PRAYERS) out[k] = `${pad(t[k].getHours())}:${pad(t[k].getMinutes())}`;
    return out;
  }

  const api = { PRAYERS, CALIB, CITIES, DEFAULTS, merged, timesFor, timesHHMM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Prayer = api;
})(typeof window !== 'undefined' ? window : globalThis);
