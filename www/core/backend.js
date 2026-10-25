'use strict';
/* Isloh — dastur mantig'i: maqsadlar, ishlar, kunlar, profil tahlili, eslatmalar.
   Hammasi qurilmaning o'zida ishlaydi; ma'lumotlar Store orqali saqlanadi. */
(function (root) {
  const P = root.Prayer, Store = root.Store;
  const BLOCKS = ['bomdod', 'peshin', 'asr', 'shom', 'xufton'];
  const NAMES = { bomdod: 'Bomdod', quyosh: 'Quyosh', peshin: 'Peshin', asr: 'Asr', shom: 'Shom', xufton: 'Xufton' };
  const MAX_ACTIVE_GOALS = 3, MAX_TOP = 3;
  const TABLES = ['kv', 'goals', 'milestones', 'tasks', 'goal_progress', 'prayer_log', 'days'];
  const DEF_PRAYER = { city: 'toshkent', lat: P.DEFAULTS.lat, lon: P.DEFAULTS.lon, tz: 5, offsets: { ...P.DEFAULTS.offsets },
    asr_factor: 2, fajr_angle: P.DEFAULTS.fajr_angle, isha_angle: P.DEFAULTS.isha_angle };
  const DEF_NOTIFY = { enabled: true, before: 10, at_time: true, sunrise_warn: 15, evening: true, evening_after: 30, tasks: true, sound: true };
  const DEF_LOOK = { blur: 28, dim: 0.25, lite: false, wallpaper: 0 };

  class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }

  /* ------------------------------------------------------------ baza */
  let DB = null;
  const empty = () => ({ kv: {}, goals: [], milestones: [], tasks: [], goal_progress: [], prayer_log: [], days: [], seq: {} });
  const nextId = t => { DB.seq[t] = Math.max(DB.seq[t] || 0, ...DB[t].map(r => r.id || 0)) + 1; return DB.seq[t]; };
  let saving = Promise.resolve();
  const persist = () => { saving = saving.then(() => Store.save(DB)).catch(e => console.error('save', e)); return saving; };

  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const pd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return iso(d); };
  const diffDays = (a, b) => Math.round((pd(b) - pd(a)) / 864e5);
  const nowIso = () => { const d = new Date(); return `${iso(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
  const todayIso = () => iso(new Date());

  function pdate(s, field = 'Sana') {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(pd(s))) throw new ApiError(400, `${field} noto'g'ri`);
    return s;
  }
  function cleanTime(v) {
    v = (v || '').trim();
    if (v && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new ApiError(400, "Vaqt SS:DD ko'rinishida bo'lsin, masalan 14:30");
    return v;
  }
  const str = (v, n) => String(v ?? '').trim().slice(0, n);

  /* ------------------------------------------------------------ sozlamalar va vaqt */
  function getSettings() {
    const pr = { ...DEF_PRAYER, ...(DB.kv.prayer || {}) };
    pr.offsets = { ...DEF_PRAYER.offsets, ...(pr.offsets || {}) };
    return {
      profile: DB.kv.profile || null,
      prayer: pr,
      notify: { ...DEF_NOTIFY, ...(DB.kv.notify || {}) },
      look: { ...DEF_LOOK, ...(DB.kv.look || {}) },
      hijri_offset: DB.kv.hijri_offset ?? 0,
    };
  }
  const ptCache = new Map();
  function ptimes(ds) {
    const pr = getSettings().prayer;
    const key = ds + JSON.stringify(pr);
    if (!ptCache.has(key)) { if (ptCache.size > 3000) ptCache.clear(); ptCache.set(key, P.timesFor(ds, pr)); }
    return ptCache.get(key);
  }
  const ptimesHHMM = ds => { const t = ptimes(ds), o = {}; for (const k in t) o[k] = `${pad(t[k].getHours())}:${pad(t[k].getMinutes())}`; return o; };
  /* Kun Bomdoddan boshlanadi: yarim tundan keyin, Bomdodgacha hali kechagi kun davom etadi. */
  function activeDay(now = new Date()) {
    const t = iso(now);
    return now >= ptimes(t).bomdod ? t : addDays(t, -1);
  }
  function requireEditable(ds) {
    if (ds < activeDay()) throw new ApiError(403, "Bu kun yopilgan — o'tgan kunni o'zgartirib bo'lmaydi");
  }

  /* ------------------------------------------------------------ ishlar */
  const goalById = id => DB.goals.find(g => g.id === id);
  function taskGet(id) {
    const t = DB.tasks.find(x => x.id === id);
    if (!t) throw new ApiError(404, 'Ish topilmadi');
    return t;
  }
  function taskView(t) {
    const g = t.goal_id ? goalById(t.goal_id) : null;
    return { ...t, goal_title: g ? g.title : null, goal_type: g ? g.type : null, goal_unit: g ? g.unit : null };
  }
  function checkTop(ds, exclude) {
    const n = DB.tasks.filter(t => t.date === ds && t.top && t.status !== 'moved' && t.id !== exclude).length;
    if (n >= MAX_TOP) throw new ApiError(400, 'Eng muhim ishlar 3 tadan oshmasin');
  }
  function checkGoal(id) {
    if (id === null || id === undefined || id === '' || id === 0) return null;
    if (!goalById(+id)) throw new ApiError(400, 'Maqsad topilmadi');
    return +id;
  }
  const nextSort = (ds, block) => Math.max(0, ...DB.tasks.filter(t => t.date === ds && t.block === block).map(t => t.sort || 0)) + 1;

  function taskCreate(b) {
    const ds = pdate(b.date);
    requireEditable(ds);
    if (!BLOCKS.includes(b.block)) throw new ApiError(400, "Blok noto'g'ri");
    const title = str(b.title, 300);
    if (!title) throw new ApiError(400, 'Ish nomini yozing');
    const top = b.top ? 1 : 0;
    if (top) checkTop(ds);
    const t = { id: nextId('tasks'), date: ds, block: b.block, title, goal_id: checkGoal(b.goal_id), top, time: cleanTime(b.time),
      amount: +b.amount || 0, status: 'todo', done_amount: 0, sort: nextSort(ds, b.block), created_at: nowIso(), done_at: null,
      moved_from: null, note: str(b.note, 500) };
    DB.tasks.push(t);
    return taskView(t);
  }
  function progressForTask(t, amount) {
    DB.goal_progress = DB.goal_progress.filter(p => p.task_id !== t.id);
    if (!t.goal_id) return;
    const g = goalById(t.goal_id);
    if (!g) return;
    if (g.type === 'number' && amount > 0) DB.goal_progress.push({ id: nextId('goal_progress'), goal_id: g.id, date: t.date, amount, task_id: t.id, created_at: nowIso() });
    else if (g.type === 'habit') DB.goal_progress.push({ id: nextId('goal_progress'), goal_id: g.id, date: t.date, amount: 1, task_id: t.id, created_at: nowIso() });
  }
  function taskUpdate(id, b) {
    const t = taskGet(id);
    requireEditable(t.date);
    if ('title' in b) { const v = str(b.title, 300); if (!v) throw new ApiError(400, 'Ish nomini yozing'); t.title = v; }
    if ('block' in b) { if (!BLOCKS.includes(b.block)) throw new ApiError(400, "Blok noto'g'ri"); t.block = b.block; }
    if ('goal_id' in b) t.goal_id = checkGoal(b.goal_id);
    if ('top' in b) { if (b.top && !t.top) checkTop(t.date, id); t.top = b.top ? 1 : 0; }
    if ('time' in b) t.time = cleanTime(b.time);
    if ('amount' in b) t.amount = +b.amount || 0;
    if ('note' in b) t.note = str(b.note, 500);
    if ('sort' in b) t.sort = +b.sort;
    if ('status' in b) {
      if (!['todo', 'done'].includes(b.status)) throw new ApiError(400, "Holat noto'g'ri");
      if (t.status === 'moved') throw new ApiError(400, "Bu ish boshqa kunga ko'chirilgan");
      t.status = b.status;
      if (b.status === 'done') { t.done_at = nowIso(); t.done_amount = +b.done_amount || t.amount || 0; }
      else { t.done_at = null; t.done_amount = 0; }
    }
    if ('status' in b || ('goal_id' in b && t.status === 'done')) {
      if (t.status === 'done') progressForTask(t, t.done_amount);
      else DB.goal_progress = DB.goal_progress.filter(p => p.task_id !== id);
    }
    return taskView(t);
  }
  function taskDelete(id) {
    const t = taskGet(id);
    requireEditable(t.date);
    const fresh = t.created_at && (Date.now() - new Date(t.created_at).getTime() < 10 * 60e3);
    DB.goal_progress = DB.goal_progress.filter(p => p.task_id !== id);
    if (t.date > activeDay() || fresh) {
      DB.tasks = DB.tasks.filter(x => x.id !== id);
      return { deleted: true };
    }
    t.status = 'cancelled';
    return { deleted: false, task: taskView(t) };
  }
  function taskMove(id, b) {
    const t = taskGet(id);
    requireEditable(t.date);
    const to = pdate(b.to_date, "Ko'chiriladigan sana");
    if (to < activeDay()) throw new ApiError(400, "O'tgan kunga ko'chirib bo'lmaydi");
    const block = b.block || t.block;
    if (!BLOCKS.includes(block)) throw new ApiError(400, "Blok noto'g'ri");
    const sort = nextSort(to, block);
    if (t.date > activeDay() || to === t.date) {
      if (t.date !== to) t.top = 0;
      Object.assign(t, { date: to, block, sort });
      return taskView(t);
    }
    if (t.status !== 'todo') throw new ApiError(400, "Faqat bajarilmagan ishni ko'chirish mumkin");
    t.status = 'moved';
    const n = { id: nextId('tasks'), date: to, block, title: t.title, goal_id: t.goal_id, top: 0, time: t.time, amount: t.amount,
      status: 'todo', done_amount: 0, sort, created_at: nowIso(), done_at: null, moved_from: id, note: t.note };
    DB.tasks.push(n);
    return taskView(n);
  }
  function taskRestore(id) {
    const t = taskGet(id);
    requireEditable(t.date);
    if (t.status !== 'cancelled') throw new ApiError(400, 'Bu ish bekor qilinmagan');
    t.status = 'todo';
    return taskView(t);
  }

  /* ------------------------------------------------------------ kun */
  function dayInfo(ds) { return DB.days.find(d => d.date === ds) || { date: ds, plan_closed: 0, excused: 0, note: '' }; }
  const tasksOf = ds => DB.tasks.filter(t => t.date === ds).sort((a, b) => (a.sort - b.sort) || (a.id - b.id));
  const logsOf = ds => Object.fromEntries(DB.prayer_log.filter(r => r.date === ds).map(r => [r.prayer, r.status]));
  function dayGet(ds) {
    const ad = activeDay();
    ds = ds ? pdate(ds) : ad;
    return { date: ds, active_day: ad, editable: ds >= ad, prayer_editable: ds >= addDays(ad, -1),
      prayers: ptimesHHMM(ds), next_prayers: ptimesHHMM(addDays(ds, 1)), tasks: tasksOf(ds).map(taskView),
      prayer_log: logsOf(ds), day: dayInfo(ds), goals: goalsBrief() };
  }
  function dayUpdate(b) {
    const ds = pdate(b.date);
    const cur = { ...dayInfo(ds) };
    if ('note' in b) { requireEditable(ds); cur.note = str(b.note, 2000); }
    if ('plan_closed' in b) { requireEditable(ds); cur.plan_closed = b.plan_closed ? 1 : 0; }
    if ('excused' in b) {
      requireEditable(ds);
      if (b.excused && !cur.excused) {
        const n = DB.days.filter(d => d.excused && d.date.slice(0, 7) === ds.slice(0, 7)).length;
        if (n >= 3) throw new ApiError(400, "Bir oyda ko'pi bilan 3 ta uzrli kun bo'ladi");
      }
      cur.excused = b.excused ? 1 : 0;
    }
    DB.days = DB.days.filter(d => d.date !== ds);
    DB.days.push(cur);
    return cur;
  }
  function prayerMark(b) {
    const ds = pdate(b.date), ad = activeDay();
    if (ds < addDays(ad, -1) || ds > ad) throw new ApiError(403, "Bu kunning namozlarini endi belgilab bo'lmaydi");
    if (!BLOCKS.includes(b.prayer)) throw new ApiError(400, "Namoz noto'g'ri");
    DB.prayer_log = DB.prayer_log.filter(r => !(r.date === ds && r.prayer === b.prayer));
    if (b.status) {
      if (!['vaqtida', 'kech', 'qazo'].includes(b.status)) throw new ApiError(400, "Holat noto'g'ri");
      DB.prayer_log.push({ date: ds, prayer: b.prayer, status: b.status });
    }
    return logsOf(ds);
  }

  /* ------------------------------------------------------------ maqsadlar */
  const goalsBrief = () => DB.goals.filter(g => g.status === 'active')
    .sort((a, b) => (b.is_main - a.is_main) || a.end_date.localeCompare(b.end_date))
    .map(g => ({ id: g.id, title: g.title, type: g.type, unit: g.unit, is_main: g.is_main }));
  function goalGet(id) { const g = goalById(id); if (!g) throw new ApiError(404, 'Maqsad topilmadi'); return g; }
  function goalCompute(g, today = activeDay()) {
    const s = g.start_date, e = g.end_date;
    const total = Math.max(1, diffDays(s, e) + 1);
    const elapsed = Math.min(total, Math.max(0, diffDays(s, today) + 1));
    const left = today >= s ? Math.max(0, diffDays(today, e) + 1) : total;
    const before = Math.max(0, elapsed - 1);
    const out = { total_days: total, elapsed, left_days: left };
    let done, target;
    const prog = DB.goal_progress.filter(p => p.goal_id === g.id);
    if (g.type === 'number') { done = prog.reduce((a, p) => a + p.amount, 0); target = g.target || 0; }
    else if (g.type === 'habit') { done = new Set(prog.map(p => p.date)).size; target = g.target || total; }
    else {
      const ms = DB.milestones.filter(m => m.goal_id === g.id).sort((a, b) => (a.sort - b.sort) || (a.id - b.id));
      out.milestones = ms.map(m => ({ ...m }));
      done = ms.filter(m => m.done).length; target = ms.length;
    }
    const expected = total ? target * before / total : 0;
    const remaining = Math.max(0, target - done);
    const per_day = left ? remaining / left : remaining;
    const pace = elapsed ? done / elapsed : 0;
    let forecast = null;
    if (remaining > 0 && pace > 0) forecast = addDays(today, Math.ceil(remaining / pace) - 1);
    let state;
    if (target && done >= target) state = 'done';
    else if (today > e) state = 'over';
    else if (today < s) state = 'future';
    else if (done + 1e-9 >= expected) state = done > expected + Math.max(1e-9, target * 0.02) ? 'ahead' : 'ontrack';
    else state = 'behind';
    const r2 = x => Math.round(x * 100) / 100;
    return Object.assign(out, { done: r2(done), target: r2(target), pct: target ? done / target : 0, expected: r2(expected),
      diff: r2(done - expected), per_day, pace, forecast, state });
  }
  function goalsList(all) {
    return DB.goals.filter(g => all || g.status === 'active')
      .sort((a, b) => ((b.status === 'active') - (a.status === 'active')) || (b.is_main - a.is_main) || a.end_date.localeCompare(b.end_date))
      .map(g => ({ ...g, progress: goalCompute(g) }));
  }
  function pickMain() {
    if (!DB.goals.some(g => g.status === 'active' && g.is_main)) {
      const g = DB.goals.filter(x => x.status === 'active').sort((a, b) => a.end_date.localeCompare(b.end_date))[0];
      if (g) g.is_main = 1;
    }
  }
  function goalFields(b, partial) {
    const f = {};
    if ('title' in b || !partial) { f.title = str(b.title, 200); if (!f.title) throw new ApiError(400, 'Maqsad nomini yozing'); }
    for (const [k, n] of [['description', 3000], ['why', 2000], ['area', 50], ['unit', 30], ['daily_title', 200]]) if (k in b) f[k] = str(b[k], n);
    if ('type' in b || !partial) {
      if (!['number', 'habit', 'project'].includes(b.type)) throw new ApiError(400, 'Maqsad turini tanlang');
      f.type = b.type;
    }
    if ('start_date' in b || !partial) f.start_date = pdate(b.start_date, 'Boshlanish sanasi');
    if ('end_date' in b || !partial) f.end_date = pdate(b.end_date, 'Tugash sanasi');
    if ('target' in b) f.target = +b.target || 0;
    if ('daily_minutes' in b) f.daily_minutes = parseInt(b.daily_minutes, 10) || 0;
    if ('block' in b) f.block = BLOCKS.includes(b.block) ? b.block : '';
    return f;
  }
  function goalCreate(b) {
    const n = DB.goals.filter(g => g.status === 'active').length;
    if (n >= MAX_ACTIVE_GOALS) throw new ApiError(400, "Bir vaqtda ko'pi bilan 3 ta faol maqsad bo'ladi. Avval bittasini yakunlang.");
    const f = goalFields(b, false);
    if (f.end_date < f.start_date) throw new ApiError(400, "Tugash sanasi boshlanishdan oldin bo'lmasin");
    if (f.type === 'number' && !f.target) throw new ApiError(400, 'Raqamli maqsad uchun miqdorni kiriting (masalan 300 bet)');
    const g = { id: nextId('goals'), description: '', why: '', area: '', target: 0, unit: '', daily_title: '', daily_minutes: 0, block: '',
      is_main: 0, status: 'active', close_note: '', created_at: nowIso(), closed_at: null, ...f };
    DB.goals.push(g);
    (b.milestones || []).forEach((m, i) => {
      m = str(m, 200);
      if (m) DB.milestones.push({ id: nextId('milestones'), goal_id: g.id, title: m, done: 0, done_at: null, sort: i });
    });
    if (b.is_main || n === 0) DB.goals.forEach(x => { x.is_main = x.id === g.id ? 1 : 0; });
    pickMain();
    return { ...g, progress: goalCompute(g) };
  }
  function goalUpdate(id, b) {
    const g = goalGet(id);
    const f = goalFields(b, true);
    const merged = { ...g, ...f };
    if (merged.end_date < merged.start_date) throw new ApiError(400, "Tugash sanasi boshlanishdan oldin bo'lmasin");
    Object.assign(g, f);
    if (b.is_main) {
      if (g.status !== 'active') throw new ApiError(400, "Faqat faol maqsad asosiy bo'la oladi");
      DB.goals.forEach(x => { if (x.status === 'active' || x.id === id) x.is_main = x.id === id ? 1 : 0; });
    }
    if ('status' in b) {
      if (!['active', 'achieved', 'failed'].includes(b.status)) throw new ApiError(400, "Holat noto'g'ri");
      if (b.status === 'active' && g.status !== 'active') {
        if (DB.goals.filter(x => x.status === 'active').length >= MAX_ACTIVE_GOALS) throw new ApiError(400, "Bir vaqtda ko'pi bilan 3 ta faol maqsad bo'ladi");
        g.status = 'active'; g.closed_at = null;
      } else if (b.status !== 'active') {
        Object.assign(g, { status: b.status, is_main: 0, closed_at: nowIso(), close_note: str(b.close_note, 2000) });
      }
      pickMain();
    }
    return { ...g, progress: goalCompute(g) };
  }
  function goalDelete(id) {
    goalGet(id);
    DB.goals = DB.goals.filter(g => g.id !== id);
    DB.milestones = DB.milestones.filter(m => m.goal_id !== id);
    DB.goal_progress = DB.goal_progress.filter(p => p.goal_id !== id);
    DB.tasks.forEach(t => { if (t.goal_id === id) t.goal_id = null; });
    pickMain();
    return { ok: true };
  }
  function goalAddProgress(id, b) {
    const g = goalGet(id);
    const ds = b.date ? pdate(b.date) : activeDay();
    if (g.type === 'number') {
      const amt = +b.amount || 0;
      if (!amt) throw new ApiError(400, 'Miqdorni kiriting');
      DB.goal_progress.push({ id: nextId('goal_progress'), goal_id: id, date: ds, amount: amt, task_id: null, created_at: nowIso() });
    } else if (g.type === 'habit') {
      DB.goal_progress.push({ id: nextId('goal_progress'), goal_id: id, date: ds, amount: 1, task_id: null, created_at: nowIso() });
    } else throw new ApiError(400, 'Bosqichli maqsadda bosqichlarni belgilang');
    return { ...g, progress: goalCompute(g) };
  }
  const goalsOne = id => { const g = goalGet(id); return { ...g, progress: goalCompute(g) }; };
  function milestoneAdd(gid, b) {
    goalGet(gid);
    const title = str(b.title, 200);
    if (!title) throw new ApiError(400, 'Bosqich nomini yozing');
    const s = Math.max(0, ...DB.milestones.filter(m => m.goal_id === gid).map(m => m.sort || 0)) + 1;
    DB.milestones.push({ id: nextId('milestones'), goal_id: gid, title, done: 0, done_at: null, sort: s });
    return goalsOne(gid);
  }
  function milestoneGet(id) { const m = DB.milestones.find(x => x.id === id); if (!m) throw new ApiError(404, 'Bosqich topilmadi'); return m; }
  function milestoneUpdate(id, b) {
    const m = milestoneGet(id);
    if ('done' in b) { m.done = b.done ? 1 : 0; m.done_at = b.done ? nowIso() : null; }
    if ('title' in b && str(b.title, 200)) m.title = str(b.title, 200);
    return goalsOne(m.goal_id);
  }
  function milestoneDelete(id) {
    const m = milestoneGet(id);
    DB.milestones = DB.milestones.filter(x => x.id !== id);
    return goalsOne(m.goal_id);
  }

  /* ------------------------------------------------------------ reja (ertaga) */
  const INT_UNITS = ['bet', 'sahifa', 'ta', 'dona', 'marta', "so'z", 'masala', 'dars', 'pora', 'kun'];
  function niceNum(x, unit) {
    if (!(x > 0)) return 0;
    if (INT_UNITS.includes(String(unit || '').toLowerCase())) return Math.ceil(x - 1e-9);
    return x < 10 ? Math.round(x * 10) / 10 : Math.ceil(x - 1e-9);
  }
  function planGet(ds) {
    const ad = activeDay();
    ds = ds ? pdate(ds) : addDays(ad, 1);
    const info = dayGet(ds);
    info.leftovers = ds > ad ? tasksOf(ad).filter(t => t.status === 'todo').map(taskView) : [];
    const planned = new Set([...info.tasks.filter(t => t.goal_id && t.status !== 'moved').map(t => t.goal_id),
      ...info.leftovers.filter(t => t.goal_id).map(t => t.goal_id)]);
    const sugg = [];
    for (const g of goalsList(false)) {
      if (!(g.start_date <= ds && ds <= g.end_date) || planned.has(g.id)) continue;
      const p = goalCompute(g, ds);
      const block = g.block || 'bomdod';
      if (g.type === 'habit') {
        let title = g.daily_title || g.title;
        if (g.daily_minutes) title += ` — ${g.daily_minutes} daqiqa`;
        sugg.push({ goal_id: g.id, goal_title: g.title, title, block, amount: 0 });
      } else if (g.type === 'number') {
        if (p.state === 'done') continue;
        const per = niceNum(p.per_day, g.unit);
        sugg.push({ goal_id: g.id, goal_title: g.title, title: `${g.title}: ${per} ${g.unit}`.trim(), block, amount: per });
      } else {
        const nxt = (p.milestones || []).find(m => !m.done);
        if (nxt) sugg.push({ goal_id: g.id, goal_title: g.title, title: `${g.title}: ${nxt.title}`, block, amount: 0 });
      }
    }
    info.suggestions = sugg;
    return info;
  }

  /* ------------------------------------------------------------ profil */
  const weight = t => t.top ? 3 : (t.goal_id ? 2 : 1);
  function dayScore(tasks, excused, live) {
    if (excused) return { level: -1, pct: null, excused: true };
    if (!tasks.length) return { level: live ? 0 : 1, pct: null, noplan: true };
    const tw = tasks.reduce((a, t) => a + weight(t), 0);
    const dw = tasks.filter(t => t.status === 'done').reduce((a, t) => a + weight(t), 0);
    const pct = tw ? dw / tw : 0;
    let lvl = pct >= 0.999 ? 4 : pct >= 0.8 ? 3 : pct >= 0.4 ? 2 : 1, capped = false;
    if (tasks.length < 3 && !tasks.some(t => t.goal_id) && lvl > 2) { lvl = 2; capped = true; }
    return { level: lvl, pct, capped };
  }
  function prayerLevel(logs) {
    const st = Object.values(logs);
    if (!st.length) return 0;
    if (st.includes('qazo')) return 1;
    if (st.length < 5) return 0;
    if (st.includes('kech')) return 2;
    return 4;
  }
  const UZ_DAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
  function profileGet() {
    const ad = activeDay();
    const prof = DB.kv.profile || {};
    const startTrack = (prof.created || ad).slice(0, 10);
    let first = addDays(ad, -370);
    first = addDays(first, -((pd(first).getDay() + 6) % 7)); // dushanbadan boshlansin
    const byDate = {};
    for (const t of DB.tasks) if (t.date >= first && t.date <= ad) (byDate[t.date] = byDate[t.date] || []).push(t);
    const days = Object.fromEntries(DB.days.map(d => [d.date, d]));
    const plogs = {};
    for (const r of DB.prayer_log) (plogs[r.date] = plogs[r.date] || {})[r.prayer] = r.status;
    const cells = [], pcells = [];
    for (let d = first; d <= ad; d = addDays(d, 1)) {
      if (d < startTrack) { cells.push({ date: d, level: null }); pcells.push({ date: d, level: null }); continue; }
      const sc = dayScore(byDate[d] || [], days[d] && days[d].excused, d === ad);
      cells.push({ ...sc, date: d, live: d === ad });
      pcells.push({ date: d, level: prayerLevel(plogs[d] || {}), n: Object.keys(plogs[d] || {}).length });
    }
    const tracked = cells.filter(c => c.level !== null);
    const closed = tracked.filter(c => !c.live);
    let cur = 0, best = 0;
    for (const c of closed) { if (c.excused) continue; if (c.level >= 3) { cur++; best = Math.max(best, cur); } else cur = 0; }
    const live = tracked.length && tracked[tracked.length - 1].live ? tracked[tracked.length - 1] : null;
    if (live && live.level >= 3) { cur++; best = Math.max(best, cur); }
    const avg = cs => { const v = cs.filter(c => !c.excused).map(c => c.pct ?? 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const last7 = avg(closed.slice(-7));
    const prev7 = closed.length > 7 ? avg(closed.slice(-14, -7)) : null;
    const counts30 = { 1: 0, 2: 0, 3: 0, 4: 0 };
    closed.slice(-30).forEach(c => { if (counts30[c.level] !== undefined) counts30[c.level]++; });

    const insights = [];
    const since30 = addDays(ad, -30);
    const moved = {};
    for (const t of DB.tasks) if (t.status === 'moved' && t.date >= since30) {
      const k = t.title.toLowerCase();
      moved[k] = moved[k] || { title: t.title, n: 0 };
      moved[k].n++;
    }
    Object.values(moved).filter(m => m.n >= 2).sort((a, b) => b.n - a.n).slice(0, 3).forEach(m => insights.push({
      kind: 'bad', text: `“${m.title}” oxirgi 30 kunda ${m.n} marta ertaga ko'chirildi.`,
      tip: "Uni kichikroq qismlarga bo'ling yoki eng muhim 3 ta ish qatoriga qo'ying." }));
    const bl = {};
    for (const t of DB.tasks) if (t.date >= since30 && t.date < ad && t.status !== 'moved') {
      bl[t.block] = bl[t.block] || { block: t.block, n: 0, d: 0 };
      bl[t.block].n++; if (t.status === 'done') bl[t.block].d++;
    }
    const weak = Object.values(bl).filter(b => b.n >= 5);
    if (weak.length) {
      const w = weak.reduce((a, b) => (b.d / b.n < a.d / a.n ? b : a));
      const rate = w.d / w.n;
      if (rate < 0.7) insights.push({ kind: 'bad', text: `${NAMES[w.block]}dan keyingi ishlarning ${Math.round((1 - rate) * 100)}% bajarilmayapti.`,
        tip: `${NAMES[w.block]} blokiga kamroq yoki yengilroq ish qo'ying.` });
      const s = weak.reduce((a, b) => (b.d / b.n > a.d / a.n ? b : a));
      if (s.d / s.n >= 0.8 && s !== w) insights.push({ kind: 'good',
        text: `Eng samarali vaqtingiz — ${NAMES[s.block]}dan keyin (${Math.round(s.d / s.n * 100)}% bajarilgan).`, tip: "Eng qiyin ishlarni shu blokka qo'ying." });
    }
    const wd = {};
    closed.slice(-56).forEach(c => { if (!c.excused) (wd[pd(c.date).getDay()] = wd[pd(c.date).getDay()] || []).push(c.pct || 0); });
    const wda = Object.entries(wd).filter(([, v]) => v.length >= 2).map(([k, v]) => [+k, v.reduce((a, b) => a + b, 0) / v.length]);
    if (wda.length >= 5) {
      const [k, v] = wda.reduce((a, b) => (b[1] < a[1] ? b : a));
      if (v < 0.6) insights.push({ kind: 'bad', text: `Haftaning eng zaif kuni — ${UZ_DAYS[k]} (${Math.round(v * 100)}%).`, tip: `${UZ_DAYS[k]} kunlari rejani yengilroq tuzing.` });
    }
    const noplan = closed.slice(-30).filter(c => c.noplan).length;
    if (noplan) insights.push({ kind: 'bad', text: `Oxirgi 30 kunda ${noplan} kun reja tuzilmagan.`, tip: "Har kuni Xuftondan keyin 5 daqiqa ajratib, Ertaga panelini to'ldiring." });
    const goals = goalsList(false);
    for (const g of goals) {
      const p = g.progress, u = g.unit || '';
      if (p.state === 'behind') insights.push({ kind: 'bad', text: `“${g.title}” rejadan orqada: ${Math.abs(p.diff)} ${u} kam.`.replace(/\s+\./, '.'),
        tip: `Muddatga yetish uchun endi kuniga ${niceNum(p.per_day, u || 'ta')} ${u}`.trim() + ' kerak.' });
      else if (p.state === 'ahead') insights.push({ kind: 'good', text: `“${g.title}” rejadan oldinda.`, tip: "Shu sur'atni saqlang." });
    }
    const pl = DB.prayer_log.filter(r => r.date >= since30);
    const onTime = pl.filter(r => r.status === 'vaqtida').length;
    const miss = {};
    pl.forEach(r => { if (r.status !== 'vaqtida') miss[r.prayer] = (miss[r.prayer] || 0) + 1; });
    const mk = Object.keys(miss).sort((a, b) => miss[b] - miss[a])[0];
    if (mk && miss[mk] >= 2) insights.push({ kind: 'bad', text: `${NAMES[mk]} namozi oxirgi 30 kunda ${miss[mk]} marta kech yoki qazo bo'ldi.`,
      tip: `${NAMES[mk]}dan oldingi eslatmani ertaroqqa qo'ying (Sozlamalar).` });
    if (cur >= 3) insights.unshift({ kind: 'good', text: `${cur} kun ketma-ket yashil — zo'r!`, tip: 'Zanjirni uzmang.' });
    return {
      active_day: ad, start: first, track_start: startTrack, cells, prayer_cells: pcells,
      stats: { streak: cur, best, last7, prev7, counts30, prayer_on_time: pl.length ? onTime / pl.length : null,
        tasks_done_30: DB.tasks.filter(t => t.status === 'done' && t.date >= since30).length },
      insights: insights.slice(0, 8), goals,
      closed_goals: DB.goals.filter(g => g.status !== 'active').sort((a, b) => String(b.closed_at).localeCompare(String(a.closed_at))).slice(0, 10),
    };
  }
  function dayArchive(ds) {
    ds = pdate(ds);
    const tasks = tasksOf(ds).sort((a, b) => a.block.localeCompare(b.block) || (a.sort - b.sort)).map(taskView);
    const di = dayInfo(ds);
    return { date: ds, tasks, prayer_log: logsOf(ds), day: di, score: dayScore(tasks, di.excused, ds === activeDay()), prayers: ptimesHHMM(ds) };
  }

  /* ------------------------------------------------------------ sozlamalar, tanishuv, eksport */
  function onboard(b) {
    const name = str(b.name, 80);
    if (!name) throw new ApiError(400, 'Ismingizni yozing');
    const bd = pdate(b.birth_date, "Tug'ilgan sana");
    if (bd > todayIso() || +bd.slice(0, 4) < 1900) throw new ApiError(400, "Tug'ilgan sana noto'g'ri");
    const prof = { ...(DB.kv.profile || {}), name, birth_date: bd, birth_time: cleanTime(b.birth_time),
      areas: (b.areas || []).filter(a => typeof a === 'string').slice(0, 8),
      wake: cleanTime(b.wake) || '05:00', sleep: cleanTime(b.sleep) || '23:00' };
    if (!prof.created) prof.created = activeDay();
    DB.kv.profile = prof;
    if (b.city) settingsUpdate({ prayer: { city: b.city } });
    return getSettings();
  }
  function settingsUpdate(b) {
    if (b.profile) {
      const prof = { ...(DB.kv.profile || {}) }, p = b.profile;
      if ('name' in p) { if (!str(p.name, 80)) throw new ApiError(400, 'Ismingizni yozing'); prof.name = str(p.name, 80); }
      if ('birth_date' in p) { const bd = pdate(p.birth_date, "Tug'ilgan sana"); if (bd > todayIso()) throw new ApiError(400, "Tug'ilgan sana noto'g'ri"); prof.birth_date = bd; }
      if ('birth_time' in p) prof.birth_time = cleanTime(p.birth_time);
      for (const k of ['wake', 'sleep']) if (k in p) prof[k] = cleanTime(p[k]);
      if ('areas' in p) prof.areas = (p.areas || []).filter(a => typeof a === 'string').slice(0, 8);
      DB.kv.profile = prof;
    }
    if (b.prayer) {
      const cur = getSettings().prayer, p = b.prayer;
      if (p.offsets) for (const [k, v] of Object.entries(p.offsets)) if (P.PRAYERS.includes(k)) cur.offsets[k] = Math.max(-30, Math.min(30, parseInt(v, 10) || 0));
      if ([1, 2].includes(p.asr_factor)) cur.asr_factor = p.asr_factor;
      for (const k of ['fajr_angle', 'isha_angle']) if (k in p) cur[k] = Math.max(10, Math.min(20, +p[k] || P.DEFAULTS[k]));
      if ('city' in p) {
        if (p.city !== 'custom' && !P.CITIES.some(c => c.id === p.city)) throw new ApiError(400, "Shahar noto'g'ri");
        cur.city = p.city;
      }
      if (cur.city === 'custom') {
        for (const [k, lo, hi] of [['lat', -66, 66], ['lon', -180, 180], ['tz', -12, 14]]) if (k in p) {
          const v = +p[k];
          if (isNaN(v) || v < lo || v > hi) throw new ApiError(400, `${k === 'lat' ? 'Kenglik' : k === 'lon' ? 'Uzunlik' : 'Vaqt mintaqasi'} noto'g'ri`);
          cur[k] = v;
        }
      }
      DB.kv.prayer = cur;
      ptCache.clear();
    }
    if (b.notify) {
      const cur = getSettings().notify;
      for (const [k, v] of Object.entries(b.notify)) if (k in DEF_NOTIFY) cur[k] = typeof DEF_NOTIFY[k] === 'boolean' ? !!v : Math.max(0, parseInt(v, 10) || 0);
      DB.kv.notify = cur;
    }
    if (b.look) {
      const cur = getSettings().look, l = b.look;
      if ('blur' in l) cur.blur = Math.max(0, Math.min(60, parseInt(l.blur, 10) || 0));
      if ('dim' in l) cur.dim = Math.max(0, Math.min(0.8, +l.dim || 0));
      if ('lite' in l) cur.lite = !!l.lite;
      if ('wallpaper' in l) cur.wallpaper = +l.wallpaper || 0;
      DB.kv.look = cur;
    }
    if ('hijri_offset' in b) DB.kv.hijri_offset = Math.max(-2, Math.min(2, parseInt(b.hijri_offset, 10) || 0));
    return getSettings();
  }

  /* Eksport formati eski (Python) versiyasi bilan mos: kv qiymatlari JSON matn ko'rinishida. */
  function exportAll() {
    const tables = {};
    for (const t of TABLES) tables[t] = t === 'kv' ? Object.entries(DB.kv).map(([key, v]) => ({ key, value: JSON.stringify(v) })) : DB[t].map(r => ({ ...r }));
    return { app: 'vaqt', name: 'Isloh', version: 1, exported_at: nowIso(), tables };
  }
  function importAll(b) {
    if (!b || b.app !== 'vaqt' || typeof b.tables !== 'object') throw new ApiError(400, 'Bu fayl Isloh (Vaqt) dasturining zaxira nusxasi emas');
    const n = empty();
    for (const r of b.tables.kv || []) { try { n.kv[r.key] = JSON.parse(r.value); } catch (e) { /* buzilgan qator */ } }
    for (const t of TABLES.slice(1)) n[t] = (b.tables[t] || []).map(r => ({ ...r }));
    for (const t of n.tasks) { t.top = t.top ? 1 : 0; t.amount = +t.amount || 0; t.done_amount = +t.done_amount || 0; t.note = t.note || ''; t.time = t.time || ''; }
    const wall = DB.kv.look && DB.kv.look.wallpaper;
    DB = n;
    if (DB.kv.look) DB.kv.look.wallpaper = wall || 0;
    ptCache.clear();
    return { ok: true };
  }

  /* ------------------------------------------------------------ marshrutlar */
  const R = [];
  const route = (m, p, fn, mutates = true) => R.push({ m, rx: new RegExp('^' + p + '$'), fn, mutates });
  route('GET', '/api/state', () => {
    const ad = activeDay();
    return { settings: getSettings(), active_day: ad, today: todayIso(), main_goal: DB.goals.find(g => g.status === 'active' && g.is_main) || null,
      goals_count: DB.goals.filter(g => g.status === 'active').length, data_dir: Store.dataDir, platform: Store.platform,
      prayers: ptimesHHMM(ad), next_prayers: ptimesHHMM(addDays(ad, 1)), cities: P.CITIES };
  }, false);
  route('POST', '/api/onboard', (m, q, b) => onboard(b));
  route('PUT', '/api/settings', (m, q, b) => settingsUpdate(b));
  route('GET', '/api/day', (m, q) => dayGet(q.get('date')), false);
  route('POST', '/api/day', (m, q, b) => dayUpdate(b));
  route('GET', '/api/day-archive', (m, q) => dayArchive(q.get('date') || ''), false);
  route('POST', '/api/prayer-log', (m, q, b) => prayerMark(b));
  route('POST', '/api/tasks', (m, q, b) => taskCreate(b));
  route('PATCH', '/api/tasks/(\\d+)', (m, q, b) => taskUpdate(+m[1], b));
  route('DELETE', '/api/tasks/(\\d+)', m => taskDelete(+m[1]));
  route('POST', '/api/tasks/(\\d+)/move', (m, q, b) => taskMove(+m[1], b));
  route('POST', '/api/tasks/(\\d+)/restore', m => taskRestore(+m[1]));
  route('GET', '/api/plan', (m, q) => planGet(q.get('date')), false);
  route('GET', '/api/goals', (m, q) => goalsList(q.get('all') === '1'), false);
  route('POST', '/api/goals', (m, q, b) => goalCreate(b));
  route('PATCH', '/api/goals/(\\d+)', (m, q, b) => goalUpdate(+m[1], b));
  route('DELETE', '/api/goals/(\\d+)', m => goalDelete(+m[1]));
  route('POST', '/api/goals/(\\d+)/progress', (m, q, b) => goalAddProgress(+m[1], b));
  route('POST', '/api/goals/(\\d+)/milestones', (m, q, b) => milestoneAdd(+m[1], b));
  route('PATCH', '/api/milestones/(\\d+)', (m, q, b) => milestoneUpdate(+m[1], b));
  route('DELETE', '/api/milestones/(\\d+)', m => milestoneDelete(+m[1]));
  route('GET', '/api/profile', () => profileGet(), false);
  route('GET', '/api/export', () => exportAll(), false);
  route('POST', '/api/import', (m, q, b) => importAll(b));

  let ready = null;
  async function init() {
    DB = (await Store.load()) || empty();
    for (const t of TABLES.slice(1)) DB[t] = DB[t] || [];
    DB.kv = DB.kv || {};
    DB.seq = DB.seq || {};
    dailyBackup();
  }
  let lastBackup = null;
  function dailyBackup() {
    const d = todayIso();
    if (lastBackup === d || !Store.isNative) return;
    lastBackup = d;
    Store.backup(exportAll(), d).catch(e => console.error('backup', e));
  }

  /* app.js shu funksiyani chaqiradi — xuddi serverga so'rov yuborgandek. */
  async function handle(method, path, body) {
    if (!ready) ready = init();
    await ready;
    const [p, qs] = path.split('?');
    const q = new URLSearchParams(qs || '');
    for (const r of R) {
      if (r.m !== method) continue;
      const m = p.match(r.rx);
      if (!m) continue;
      const res = r.fn(m, q, body || {});
      if (r.mutates) { await persist(); Notifier.reschedule(); }
      return JSON.parse(JSON.stringify(res));
    }
    throw new ApiError(404, 'Topilmadi');
  }
  async function setWallpaper(file) {
    await handle('GET', '/api/state');
    await Store.setWallpaper(file);
    DB.kv.look = { ...getSettings().look, wallpaper: Date.now() };
    await persist();
    return getSettings();
  }
  async function deleteWallpaper() {
    await handle('GET', '/api/state');
    await Store.deleteWallpaper();
    DB.kv.look = { ...getSettings().look, wallpaper: 0 };
    await persist();
    return getSettings();
  }

  /* ------------------------------------------------------------ eslatmalar */
  function upcomingEvents(fromDs, days) {
    const st = getSettings(), n = st.notify, ev = [];
    if (!n.enabled || !st.profile) return ev;
    for (let i = 0; i < days; i++) {
      const ds = addDays(fromDs, i), pt = ptimes(ds);
      for (const p of BLOCKS) {
        const t = pt[p], hm = `${pad(t.getHours())}:${pad(t.getMinutes())}`;
        if (n.before > 0) ev.push({ at: new Date(t - n.before * 60e3), key: `${ds}:${p}:pre`, title: `${NAMES[p]} ${n.before} daqiqadan keyin`, body: `${NAMES[p]} vaqti ${hm} da kiradi`, sound: false });
        if (n.at_time) ev.push({ at: t, key: `${ds}:${p}:at`, title: `${NAMES[p]} vaqti kirdi`, body: `${hm} — namozni o'z vaqtida o'qing`, sound: true });
      }
      if (n.sunrise_warn > 0) {
        const t = pt.quyosh;
        ev.push({ at: new Date(t - n.sunrise_warn * 60e3), key: `${ds}:quyosh:warn`, title: 'Bomdod vaqti tugayapti',
          body: `Quyosh ${pad(t.getHours())}:${pad(t.getMinutes())} da chiqadi — ${n.sunrise_warn} daqiqa qoldi`, sound: true });
      }
      if (n.evening && !dayInfo(addDays(ds, 1)).plan_closed) {
        ev.push({ at: new Date(+pt.xufton + n.evening_after * 60e3), key: `${ds}:evening`, title: 'Ertangi reja hali tuzilmagan',
          body: 'Kunni yakunlang va Ertaga panelida rejani yoping', sound: true });
      }
      if (n.tasks) {
        for (const t of DB.tasks) {
          if (t.date !== ds || t.status !== 'todo' || !t.time) continue;
          const [hh, mm] = t.time.split(':').map(Number);
          const when = pd(ds); when.setHours(hh, mm, 0, 0);
          if (hh < 4) when.setDate(when.getDate() + 1);
          ev.push({ at: new Date(when - 5 * 60e3), key: `${ds}:task:${t.id}:${t.time}`, title: `${t.time} — ${t.title}`, body: '5 daqiqadan keyin boshlanadi', sound: false });
        }
      }
    }
    return ev;
  }

  const Notifier = {
    sent: new Set(),
    started: false,
    get android() { return Store.platform === 'android'; },
    plugin() { return root.Capacitor && root.Capacitor.Plugins && root.Capacitor.Plugins.LocalNotifications; },
    async start() {
      if (this.started) return;
      this.started = true;
      if (!ready) ready = init();
      await ready;
      if (this.android) {
        const LN = this.plugin();
        if (!LN) return;
        try {
          const perm = await LN.checkPermissions();
          if (perm.display !== 'granted') await LN.requestPermissions();
          await LN.createChannel({ id: 'isloh', name: 'Namoz va reja eslatmalari', importance: 5, visibility: 1, vibration: true });
        } catch (e) { console.error(e); }
        this.reschedule();
        document.addEventListener('visibilitychange', () => { if (!document.hidden) this.reschedule(); });
        return;
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try { await Notification.requestPermission(); } catch (e) { /* e'tiborsiz */ }
      }
      const now = new Date();
      // ishga tushganda o'tib ketgan eslatmalarni qayta ko'rsatmaslik
      upcomingEvents(addDays(activeDay(now), -1), 3).forEach(e => { if (e.at <= now) this.sent.add(e.key); });
      setInterval(() => this.tick(), 15000);
    },
    tick() {
      const now = new Date();
      dailyBackup();
      for (const e of upcomingEvents(addDays(activeDay(now), -1), 3)) {
        if (this.sent.has(e.key)) continue;
        if (e.at <= now && now - e.at < 2 * 60e3) { this.sent.add(e.key); this.show(e); }
        else if (now - e.at >= 2 * 60e3) this.sent.add(e.key);
      }
    },
    show(e) {
      const st = getSettings();
      try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(e.title, { body: e.body, icon: 'icon.png', silent: true }); } catch (err) { console.error(err); }
      if (e.sound && st.notify.sound) { try { new Audio('chime.wav').play().catch(() => {}); } catch (err) { /* ovoz yo'q */ } }
    },
    timer: null,
    reschedule() {
      if (!this.android) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(async () => {
        const LN = this.plugin();
        if (!LN || !DB) return;
        try {
          const pending = await LN.getPending();
          if (pending.notifications.length) await LN.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
          const now = new Date();
          const list = upcomingEvents(activeDay(now), 3).filter(e => e.at > now).slice(0, 60);
          if (!list.length) return;
          await LN.schedule({ notifications: list.map((e, i) => ({ id: 1000 + i, title: e.title, body: e.body, channelId: 'isloh',
            smallIcon: 'ic_stat_isloh', schedule: { at: e.at, allowWhileIdle: true } })) });
        } catch (err) { console.error('notify', err); }
      }, 800);
    },
    test() {
      const e = { title: 'Isloh — sinov', body: 'Eslatmalar ishlayapti', sound: true };
      if (this.android) {
        const LN = this.plugin();
        return LN && LN.schedule({ notifications: [{ id: 999, title: e.title, body: e.body, channelId: 'isloh', smallIcon: 'ic_stat_isloh', schedule: { at: new Date(Date.now() + 1500) } }] });
      }
      this.show(e);
    },
  };

  root.Backend = { handle, setWallpaper, deleteWallpaper, Notifier, ApiError, NAMES };
})(window);
