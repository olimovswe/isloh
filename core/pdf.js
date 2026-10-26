'use strict';
/* Kunlik hisobot PDF — tashqi kutubxonasiz, kichik PDF yozuvchi (Helvetica shriftlari, A4).
   Fayl odatda 10–30 KB bo'ladi va bazada saqlanmaydi: so'ralganda yaratiladi. */
const zlib = require('zlib');
const T = require('./time');

/* Helvetica va Helvetica-Bold harf kengliklari (AFM, 1/1000 em), belgilar 32..126 */
const W_REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const W_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
/* WinAnsi qo'shimcha belgilar: kod, oddiy kenglik, qalin kenglik */
const EXTRA = { '‘': [0x91, 222, 278], 'ʻ': [0x91, 222, 278], '’': [0x92, 222, 278], 'ʼ': [0x92, 222, 278], '“': [0x93, 333, 500], '”': [0x94, 333, 500],
  '•': [0x95, 350, 350], '–': [0x96, 556, 556], '—': [0x97, 1000, 1000], '…': [0x85, 1000, 1000], '·': [0xB7, 278, 278], '°': [0xB0, 400, 400], '×': [0xD7, 584, 584] };

function charInfo(ch, bold) {
  const c = ch.charCodeAt(0);
  if (c >= 32 && c <= 126) return [c, (bold ? W_BOLD : W_REG)[c - 32]];
  const e = EXTRA[ch];
  if (e) return [e[0], bold ? e[2] : e[1]];
  if (c >= 0xA0 && c <= 0xFF) return [c, 556];
  return [63, 556]; // '?'
}

class PDF {
  constructor() { this.W = 595.28; this.H = 841.89; this.pages = []; this.addPage(); }
  addPage() { this.cur = []; this.pages.push(this.cur); }
  static rgb(hex) { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map(v => v.toFixed(3)).join(' '); }
  op(s) { this.cur.push(s); }
  Y(y) { return (this.H - y).toFixed(2); }
  rect(x, y, w, h, fill, stroke, lw = 0.8) {
    if (fill) this.op(`${PDF.rgb(fill)} rg ${x.toFixed(2)} ${this.Y(y + h)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
    if (stroke) this.op(`${lw} w ${PDF.rgb(stroke)} RG ${x.toFixed(2)} ${this.Y(y + h)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
  }
  rrect(x, y, w, h, r, fill, stroke, lw = 0.8) {
    r = Math.min(r, w / 2, h / 2);
    const k = 0.5523 * r, X = v => v.toFixed(2), Y = v => this.Y(v);
    const p = [`${X(x + r)} ${Y(y)} m`, `${X(x + w - r)} ${Y(y)} l`, `${X(x + w - r + k)} ${Y(y)} ${X(x + w)} ${Y(y + r - k)} ${X(x + w)} ${Y(y + r)} c`,
      `${X(x + w)} ${Y(y + h - r)} l`, `${X(x + w)} ${Y(y + h - r + k)} ${X(x + w - r + k)} ${Y(y + h)} ${X(x + w - r)} ${Y(y + h)} c`,
      `${X(x + r)} ${Y(y + h)} l`, `${X(x + r - k)} ${Y(y + h)} ${X(x)} ${Y(y + h - r + k)} ${X(x)} ${Y(y + h - r)} c`,
      `${X(x)} ${Y(y + r)} l`, `${X(x)} ${Y(y + r - k)} ${X(x + r - k)} ${Y(y)} ${X(x + r)} ${Y(y)} c`, 'h'].join(' ');
    if (fill && stroke) this.op(`${lw} w ${PDF.rgb(fill)} rg ${PDF.rgb(stroke)} RG ${p} B`);
    else if (fill) this.op(`${PDF.rgb(fill)} rg ${p} f`);
    else if (stroke) this.op(`${lw} w ${PDF.rgb(stroke)} RG ${p} S`);
  }
  circle(cx, cy, r, fill) {
    this.rrect(cx - r, cy - r, 2 * r, 2 * r, r, fill);
  }
  line(x1, y1, x2, y2, color = '#cccccc', lw = 0.6, dash) {
    this.op(`${lw} w ${PDF.rgb(color)} RG ${dash ? `[${dash}] 0 d ` : ''}${x1.toFixed(2)} ${this.Y(y1)} m ${x2.toFixed(2)} ${this.Y(y2)} l S${dash ? ' [] 0 d' : ''}`);
  }
  width(s, size, bold) { let w = 0; for (const ch of String(s)) w += charInfo(ch, bold)[1]; return w * size / 1000; }
  fit(s, size, bold, maxW) {
    s = String(s);
    if (this.width(s, size, bold) <= maxW) return s;
    while (s.length > 1 && this.width(s + '…', size, bold) > maxW) s = s.slice(0, -1);
    return s + '…';
  }
  wrap(s, size, bold, maxW) {
    const words = String(s).split(/\s+/), lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (this.width(t, size, bold) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  }
  text(s, x, y, o = {}) {
    const size = o.size || 10, bold = !!o.bold;
    s = String(s ?? '');
    if (o.maxW) s = this.fit(s, size, bold, o.maxW);
    const w = this.width(s, size, bold);
    if (o.align === 'right') x -= w; else if (o.align === 'center') x -= w / 2;
    let enc = '';
    for (const ch of s) {
      const c = charInfo(ch, bold)[0];
      const b = String.fromCharCode(c);
      enc += b === '(' || b === ')' || b === '\\' ? '\\' + b : c < 32 || c > 126 ? '\\' + c.toString(8).padStart(3, '0') : b;
    }
    this.op(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${PDF.rgb(o.color || '#1b2030')} rg ${x.toFixed(2)} ${this.Y(y)} Td (${enc}) Tj ET`);
    return w;
  }
  build() {
    const objs = [];
    const add = s => { objs.push(s); return objs.length; };
    add('<< /Type /Catalog /Pages 2 0 R >>');
    add('PAGES');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids = [];
    for (const ops of this.pages) {
      const data = zlib.deflateSync(Buffer.from(ops.join('\n'), 'latin1'));
      const cid = add({ stream: data });
      kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.W} ${this.H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${cid} 0 R >>`));
    }
    objs[1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
    const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
    let off = chunks[0].length;
    const offsets = [];
    objs.forEach((o, i) => {
      offsets.push(off);
      let b;
      if (typeof o === 'object' && o.stream) {
        b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< /Length ${o.stream.length} /Filter /FlateDecode >>\nstream\n`, 'latin1'), o.stream, Buffer.from('\nendstream\nendobj\n', 'latin1')]);
      } else b = Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1');
      chunks.push(b); off += b.length;
    });
    let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    for (const o of offsets) xref += `${String(o).padStart(10, '0')} 00000 n \n`;
    xref += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${off}\n%%EOF\n`;
    chunks.push(Buffer.from(xref, 'latin1'));
    return Buffer.concat(chunks);
  }
}

/* ------------------------------------------------------------ hisobot ko'rinishi */
const C = { ink: '#1b2030', mute: '#6b7280', faint: '#9ca3af', line: '#e5e7eb', bg: '#f6f7fb', dark: '#0e1320',
  green: '#22a447', green2: '#30d158', yellow: '#e0a800', red: '#e5484d', blue: '#2f6fed', teal: '#1a7f6b', purple: '#5b4fd0' };
const LVLC = { 0: C.faint, 1: C.red, 2: C.yellow, 3: C.green, 4: C.green };
const pct = x => (x === null || x === undefined ? '—' : Math.round(x * 100) + '%');
const hm = min => { if (min === null || min === undefined) return '—'; const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h} s ${m} d` : `${m} daq`; };
const STATUS = { done: ['Bajarildi', C.green], active: ['Davom etmoqda', C.blue], missed: ["O'tkazildi", C.red], planned: ['Rejada', C.faint] };

function report(user, a, tomorrow) {
  const pdf = new PDF();
  const M = 36, R = pdf.W - M, CW = R - M;
  let y = 0;
  const footer = () => {
    pdf.line(M, pdf.H - 34, R, pdf.H - 34, C.line, 0.6);
    pdf.text('Isloh — maqsad sari ongli hayot  ·  t.me/islohuzbot', M, pdf.H - 20, { size: 8, color: C.faint });
    pdf.text(`${pdf.pages.length}-sahifa`, R, pdf.H - 20, { size: 8, color: C.faint, align: 'right' });
  };
  const need = h => {
    if (y + h > pdf.H - 50) {
      footer(); pdf.addPage(); y = 36;
      pdf.text(`Isloh  ·  ${a.title}`, M, y, { size: 9, bold: true, color: C.mute }); y += 18;
    }
  };
  const section = (title, sub) => {
    need(40);
    pdf.text(title, M, y + 12, { size: 13, bold: true });
    if (sub) pdf.text(sub, M + pdf.width(title, 13, true) + 8, y + 12, { size: 9, color: C.mute });
    y += 24;
  };

  // --- sarlavha
  pdf.rect(0, 0, pdf.W, 92, C.dark);
  pdf.rect(0, 88, pdf.W, 4, C.teal);
  pdf.text('ISLOH', M, 42, { size: 24, bold: true, color: '#ffffff' });
  pdf.text('Kunlik hisobot', M, 62, { size: 11, color: '#aab4c8' });
  pdf.text(a.title, R, 40, { size: 14, bold: true, color: '#ffffff', align: 'right' });
  pdf.text(`${user.name || user.tg_name || ''}${user.username ? '  ·  @' + user.username : ''}`, R, 58, { size: 10, color: '#aab4c8', align: 'right' });
  pdf.text(`Tayyorlandi: ${T.hhmmAt(Date.now(), user.tz)}`, R, 74, { size: 9, color: '#7f8aa3', align: 'right' });
  y = 112;

  // --- kun balli va asosiy ko'rsatkichlar
  const lc = LVLC[a.level] || C.faint;
  pdf.rrect(M, y, 170, 132, 10, C.bg);
  pdf.text('KUN BALLI', M + 16, y + 24, { size: 9, bold: true, color: C.mute });
  pdf.text(pct(a.score), M + 16, y + 72, { size: 40, bold: true, color: lc });
  pdf.rrect(M + 16, y + 86, pdf.width(a.level_name, 9, true) + 18, 18, 9, lc);
  pdf.text(a.level_name, M + 25, y + 99, { size: 9, bold: true, color: '#ffffff' });
  pdf.rrect(M + 16, y + 114, 138, 6, 3, '#e3e6ee');
  if (a.score) pdf.rrect(M + 16, y + 114, Math.max(6, 138 * a.score), 6, 3, lc);

  const s = a.stats;
  const cards = [
    ['Ishlar', `${s.done} / ${s.planned}`, s.missed ? `${s.missed} tasi o'tkazildi` : 'bajarildi'],
    ["O'rtacha kechikish", s.late_avg === null ? '—' : `${s.late_avg} daq`, `${s.late_count} ta ish kech boshlandi`],
    ['Namozlar', `${s.prayers_ok} / 5`, "o'z vaqtida o'qildi"],
    ["O'rtacha baho", s.rating_avg ? `${s.rating_avg.toFixed(1)} / 5` : '—', "ishlar qanchalik yaxshi o'tdi"],
    ['Sarflangan vaqt', hm(s.actual_min), `rejada: ${hm(s.planned_min)}`],
    ['Uyqu', a.sleep.hours ? `${a.sleep.hours.toFixed(1)} soat` : '—', `turish ${a.sleep.wake_actual || '—'}, reja ${a.sleep.wake_plan}`],
  ];
  const cx0 = M + 182, cw = (R - cx0 - 16) / 3, ch = 60;
  cards.forEach((c, i) => {
    const x = cx0 + (i % 3) * (cw + 8), yy = y + Math.floor(i / 3) * (ch + 12);
    pdf.rrect(x, yy, cw, ch, 8, '#ffffff', C.line);
    pdf.text(c[0], x + 10, yy + 16, { size: 8, bold: true, color: C.mute, maxW: cw - 20 });
    pdf.text(c[1], x + 10, yy + 38, { size: 16, bold: true, maxW: cw - 20 });
    pdf.text(c[2], x + 10, yy + 52, { size: 7.5, color: C.faint, maxW: cw - 20 });
  });
  y += 150;

  // --- kun jadvali (reja va haqiqat)
  const f = T.frame(user);
  const tasks = a.tasks;
  section('Kun jadvali', 'kulrang — reja, rangli — haqiqatda bajarilgan vaqt');
  const gx = M + 120, gw = R - gx, span = Math.max(60, f.sleep - f.wake);
  const X = min => gx + Math.max(0, Math.min(1, (min - f.wake) / span)) * gw;
  const base = T.instant(a.date, 0, user.tz);
  const toMin = ts => (ts - base) / 60e3;
  const rows = Math.max(1, tasks.length);
  need(30 + rows * 22);
  const gy = y;
  // soat belgilari
  for (let m = Math.ceil(f.wake / 60) * 60; m <= f.sleep; m += 60) {
    if ((m - f.wake) % (span > 900 ? 120 : 60) && span > 900) continue;
    pdf.line(X(m), gy + 12, X(m), gy + 16 + rows * 22, C.line, 0.4);
    pdf.text(T.fmtMin(m), X(m), gy + 8, { size: 7, color: C.faint, align: 'center' });
  }
  // namoz va ovqat oraliqlari
  for (const p of T.BLOCKS) {
    const pr = a.prayers[p];
    const ps = T.toMin(pr.start); let pe = ps + (user.prayer_mins || 20);
    if (ps < f.wake || ps > f.sleep) continue;
    pdf.rect(X(ps), gy + 14, Math.max(1.5, X(pe) - X(ps)), rows * 22, '#dff3ee');
    pdf.text(T.PN[p], X(ps) + 1, gy + 20 + rows * 22, { size: 6.5, color: C.teal });
  }
  tasks.forEach((t, i) => {
    const ry = gy + 16 + i * 22;
    pdf.text(t.title, M, ry + 13, { size: 8.5, maxW: 112 });
    const ps = toMin(t.planned_start), pe = toMin(t.planned_end);
    pdf.rrect(X(ps), ry + 4, Math.max(3, X(pe) - X(ps)), 12, 3, '#e3e6ee');
    if (t.actual_start) {
      const as = toMin(t.actual_start), ae = toMin(t.actual_end || Date.now());
      const col = (t.late || 0) <= 5 ? C.green : (t.late || 0) <= 20 ? C.yellow : C.red;
      pdf.rrect(X(as), ry + 7, Math.max(3, X(ae) - X(as)), 6, 3, col);
    } else if (t.status === 'missed') {
      pdf.text("o'tkazildi", X(pe) + 4, ry + 13, { size: 7, color: C.red });
    }
  });
  if (!tasks.length) pdf.text('Bu kun uchun ish rejalashtirilmagan.', gx, gy + 32, { size: 9, color: C.mute });
  y = gy + 28 + rows * 22;

  // --- ishlar jadvali
  if (tasks.length) {
    section('Ishlar tafsiloti');
    const cols = [['Ish', 0, 150], ['Reja', 150, 70], ['Haqiqatda', 220, 70], ['Kechikish', 290, 55], ['Davomiyligi', 345, 62], ['Baho', 407, 42], ['Holat', 449, 74]];
    need(22);
    pdf.rect(M, y, CW, 18, C.bg);
    cols.forEach(([n, x]) => pdf.text(n, M + 6 + x, y + 12, { size: 7.5, bold: true, color: C.mute }));
    y += 18;
    tasks.forEach((t, i) => {
      need(20);
      if (i % 2) pdf.rect(M, y, CW, 20, '#fafbfd');
      const st = STATUS[t.status] || STATUS.planned;
      const act = t.actual_start ? `${T.hhmmAt(t.actual_start, user.tz)}–${t.actual_end ? T.hhmmAt(t.actual_end, user.tz) : '...'}` : '—';
      const vals = [t.title, `${t.start}–${t.end}`, act, t.late === null ? '—' : t.late > 0 ? `+${t.late} daq` : "o'z vaqtida",
        `${t.actual_min === null ? '—' : t.actual_min} / ${t.planned_min} daq`, t.rating ? `${t.rating}/5` : '—', st[0]];
      cols.forEach(([, x, w], k) => {
        const color = k === 3 && t.late > 5 ? (t.late > 20 ? C.red : C.yellow) : k === 6 ? st[1] : C.ink;
        if (k === 6) pdf.circle(M + 6 + x + 3, y + 10, 3, st[1]);
        pdf.text(vals[k], M + 6 + x + (k === 6 ? 10 : 0), y + 13.5, { size: 8, color, bold: k === 6, maxW: w - 8 });
      });
      y += 20;
    });
    y += 8;
  }

  // --- namozlar
  section('Namozlar');
  need(56);
  const pw = (CW - 4 * 8) / 5;
  T.BLOCKS.forEach((p, i) => {
    const pr = a.prayers[p], x = M + i * (pw + 8);
    const col = pr.status === 'vaqtida' ? C.green : pr.status === 'qazo' ? C.red : C.faint;
    pdf.rrect(x, y, pw, 48, 8, '#ffffff', C.line);
    pdf.rect(x, y + 6, 3, 36, col);
    pdf.text(T.PN[p], x + 12, y + 18, { size: 10, bold: true });
    pdf.text(pr.start, x + pw - 10, y + 18, { size: 9, color: C.mute, align: 'right' });
    pdf.text(pr.status === 'vaqtida' ? "O'z vaqtida" : pr.status === 'qazo' ? 'Qazo' : 'Belgilanmagan', x + 12, y + 36, { size: 9, bold: true, color: col });
  });
  y += 62;

  // --- uyqu
  section("Uyqu va uyg'onish");
  need(40);
  const sl = a.sleep;
  const lateTxt = v => (v === null ? '' : v > 0 ? `  (+${v} daq kech)` : v < 0 ? `  (${-v} daq erta)` : "  (o'z vaqtida)");
  pdf.text(`Turish:  reja ${sl.wake_plan}  ·  haqiqatda ${sl.wake_actual || '—'}${lateTxt(sl.wake_late)}`, M, y + 10, { size: 9.5 });
  pdf.text(`Uxlash:  reja ${sl.sleep_plan}  ·  haqiqatda ${sl.sleep_actual || '—'}${lateTxt(sl.sleep_late)}`, M, y + 26, { size: 9.5 });
  if (sl.hours) pdf.text(`Kechagi uyqu: ${sl.hours.toFixed(1)} soat`, R, y + 10, { size: 9.5, bold: true, align: 'right' });
  y += 40;

  // --- xulosalar
  if (a.insights.length) {
    section('Xulosalar');
    for (const ins of a.insights) {
      const lines = pdf.wrap(ins.text, 9.5, false, CW - 16);
      need(lines.length * 14 + 4);
      pdf.circle(M + 4, y + 7, 3, ins.kind === 'good' ? C.green : C.yellow);
      lines.forEach((l, i) => pdf.text(l, M + 14, y + 10 + i * 14, { size: 9.5 }));
      y += lines.length * 14 + 4;
    }
    y += 6;
  }

  // --- ertangi reja
  if (tomorrow) {
    section('Ertangi reja', T.fmtDay(tomorrow.date));
    const list = tomorrow.items;
    if (!list.length) { need(18); pdf.text("Ertangi kun uchun hali reja tuzilmagan.", M, y + 10, { size: 9.5, color: C.red }); y += 20; }
    const colW = CW / 2 - 6;
    const half = Math.ceil(list.length / 2);
    need(Math.min(half, 30) * 17 + 6);
    const top = y;
    list.forEach((it, i) => {
      const col = i < half ? 0 : 1, row = col ? i - half : i;
      const x = M + col * (colW + 12), yy = top + row * 17;
      if (yy > pdf.H - 60) return;
      const c = it.kind === 'prayer' ? C.teal : it.kind === 'meal' ? '#c4632f' : C.purple;
      pdf.rect(x, yy + 3, 3, 11, c);
      pdf.text(`${it.start}–${it.end}`, x + 8, yy + 12, { size: 8.5, color: C.mute });
      pdf.text(it.title, x + 72, yy + 12, { size: 8.5, bold: it.kind === 'task', maxW: colW - 76 });
    });
    y = top + half * 17 + 6;
  }
  footer();
  return pdf.build();
}

module.exports = { PDF, report };
