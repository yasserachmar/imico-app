// النسخة التجريبية: بيانات وهمية واقعية بتواريخ نسبية لليوم، محفوظة في المتصفح، وتعود لحالتها كل يوم.
'use strict';
import { todayISO, addDays, uid, firstName } from './util.js';
import { TEMPLATES } from './perms.js';

const KEY = 'imico-demo-v1';

function permsFrom(template, extra = {}) {
  const p = {};
  for (const k of TEMPLATES[template].perms) p[k] = { on: true };
  return Object.assign(p, extra);
}

function seed() {
  const t = todayISO();
  const users = [
    { id: 'u_anas', name: 'أنس شربجي', title: 'المدير العام', email: 'anas@demo.imico', template: 'manager', city: 'دمشق' },
    { id: 'u_maram', name: 'م. مرام الحصان', title: 'مسؤولة المكتب الرئيسي', email: 'maram@demo.imico', template: 'coordinator', city: 'دمشق' },
    { id: 'u_hamdi', name: 'م. حمدي الدرة', title: 'مشرف قسم الصيانة', email: 'hamdi@demo.imico', template: 'senior', city: 'دمشق' },
    { id: 'u_ibrahim', name: 'م. إبراهيم كلاس', title: 'مهندس صيانة ميدانية ومعدات', email: 'ibrahim@demo.imico', template: 'engineer', city: 'حلب' },
    { id: 'u_raouf', name: 'م. عبد الرؤوف محمد', title: 'مسؤول مبيعات فنية وتقنية', email: 'raouf@demo.imico', template: 'sales', city: 'دمشق' },
    { id: 'u_ghiath', name: 'أ. غياث سماقية', title: 'مبيعات', email: 'ghiath@demo.imico', template: 'sales', city: 'حمص' },
    { id: 'u_fares', name: 'فارس عجمي', title: 'أخصائي عيادات وفنيين', email: 'fares@demo.imico', template: 'engineer', city: 'دمشق' },
    { id: 'u_asef', name: 'م. آصف سلامة', title: 'محاسب / موظف إداري', email: 'asef@demo.imico', template: 'accountant', city: 'دمشق' },
    { id: 'u_laila', name: 'ليلى', title: 'الخدمات المساندة', email: 'laila@demo.imico', template: 'basic', city: 'دمشق' },
  ].map((u) => ({ ...u, active: true, perms: permsFrom(u.template), custom: false }));
  // مثال على صلاحية معدّلة يدوياً: فارس بدون إضافة مصاريف
  const fares = users.find((u) => u.id === 'u_fares');
  delete fares.perms['expenses.add']; fares.custom = true;

  const centers = [
    { id: 'c1', name: 'مركز الشهباء للأشعة', city: 'حلب', phone: '+963 21 000 0000' },
    { id: 'c2', name: 'مركز النور للتصوير الطبي', city: 'حمص', phone: '+963 31 000 0000' },
    { id: 'c3', name: 'مركز الشام التشخيصي', city: 'دمشق', phone: '+963 11 000 0000' },
    { id: 'c4', name: 'عيادة الأمل', city: 'طرطوس', phone: '+963 43 000 0000' },
  ];
  const devices = [
    { id: 'd1', center: 'c1', type: 'MRI', model: 'SuperMark 1.5T', serial: 'SM15-0001', brand: 'ANKE', installed: addDays(t, -540), warrantyEnd: addDays(t, 190), helium: true, health: 86 },
    { id: 'd2', center: 'c1', type: 'حاقن', model: 'ASA-300', serial: 'ASA3-0042', brand: 'ANKE', installed: addDays(t, -540), warrantyEnd: addDays(t, 190), helium: false, health: 92 },
    { id: 'd3', center: 'c2', type: 'CT', model: 'ANATOM 64 Fit', serial: 'AN64-0107', brand: 'ANKE', installed: addDays(t, -300), warrantyEnd: addDays(t, 430), helium: false, health: 78 },
    { id: 'd4', center: 'c3', type: 'MRI', model: 'OPENMARK 5000', serial: 'OM5K-0019', brand: 'ANKE', installed: addDays(t, -900), warrantyEnd: addDays(t, -170), helium: false, health: 64 },
    { id: 'd5', center: 'c4', type: 'DR', model: 'ANARAY D660', serial: 'AD66-0003', brand: 'ANKE', installed: addDays(t, -120), warrantyEnd: addDays(t, 610), helium: false, health: 95 },
  ];

  const projects = [
    { id: 'p1', type: 'مشروع تركيب', title: 'تركيب جهاز CT من ANKE', center: 'c2', owner: 'u_hamdi', due: addDays(t, 29), status: 'active' },
    { id: 'p2', type: 'عقد صيانة', title: 'عقد صيانة سنوي لجهاز MRI', center: 'c1', owner: 'u_ibrahim', due: addDays(t, 270), status: 'active' },
    { id: 'p3', type: 'صفقة مبيعات', title: 'عرض سعر جهاز MRI', center: 'c3', owner: 'u_raouf', due: addDays(t, 14), status: 'active' },
    { id: 'p4', type: 'مؤتمر', title: 'المشاركة بمعرض طبي', center: null, owner: 'u_maram', due: addDays(t, 24), status: 'active' },
  ];
  const T = (id, project, title, assignee, freq, due, extra = {}) => ({ id, project, title, assignee, freq, due, done: false, note: '', ...extra });
  const tasks = [
    T('t1', 'p1', 'تقرير يومي عن سير العمل بالموقع', 'u_hamdi', 'daily', t, { done: true }),
    T('t2', 'p1', 'متابعة العزل وتجهيز غرفة الجهاز', 'u_ibrahim', 'weekly', addDays(t, 3)),
    T('t3', 'p1', 'التأكد من الكهرباء والتكييف', 'u_ibrahim', 'weekly', addDays(t, 3)),
    T('t4', 'p1', 'استلام الجهاز بعد التخليص الجمركي', 'u_asef', 'once', addDays(t, 9), { done: true }),
    T('t5', 'p1', 'التركيب والمعايرة', 'u_hamdi', 'once', addDays(t, 19)),
    T('t6', 'p1', 'تدريب فنيي المركز على الجهاز', 'u_fares', 'once', addDays(t, 26)),
    T('t7', 'p2', 'زيارة صيانة دورية لجهاز MRI', 'u_ibrahim', 'monthly', t, { time: '09:00', done: true }),
    T('t8', 'p2', 'فحص الحاقن ASA-300', 'u_ibrahim', 'monthly', t, { time: '12:30' }),
    T('t9', 'p2', 'رفع تقرير الزيارة للمركز', 'u_ibrahim', 'monthly', addDays(t, 1)),
    T('t10', 'p3', 'زيارة المشفى وعرض الجهاز', 'u_raouf', 'once', addDays(t, 2)),
    T('t11', 'p3', 'متابعة هاتفية مع الإدارة', 'u_ghiath', 'weekly', t),
    T('t12', 'p3', 'إرسال عرض السعر النهائي', 'u_raouf', 'once', addDays(t, 9)),
    T('t13', 'p4', 'حجز الجناح وتأكيد المساحة', 'u_maram', 'once', addDays(t, 4)),
    T('t14', 'p4', 'تجهيز الكتالوجات والمطبوعات', 'u_ghiath', 'weekly', addDays(t, 1)),
    T('t15', 'p4', 'تصوير المعرض ورفع الصور للجاليري', 'u_fares', 'once', addDays(t, 24)),
    T('t16', null, 'بلاغ عطل: توقف طاولة CT', 'u_ibrahim', 'once', t, { time: '15:00', urgent: true }),
    T('t17', null, 'ترتيب الأرشيف وطلب مستلزمات المكتب', 'u_laila', 'weekly', t),
    T('t18', 'p2', 'زيارة صيانة سابقة لم تُنجز', 'u_ibrahim', 'monthly', addDays(t, -3)),
  ];

  const trips = [
    { id: 'tr1', user: 'u_ibrahim', title: 'رحلة حلب: صيانة دورية', from: addDays(t, -1), to: addDays(t, 1), project: 'p2', advance: 8000, status: 'draft', decisionNote: '',
      items: [
        { id: uid('it'), kind: 'مواصلات', note: 'دمشق إلى حلب، بولمان', syp: 900, cur: 'SYP', orig: 900, rate: null, date: addDays(t, -1), receipt: false },
        { id: uid('it'), kind: 'فندق', note: 'ليلة واحدة', syp: 5990, cur: 'USD', orig: 40, rate: 149.75, date: addDays(t, -1), receipt: true },
      ] },
    { id: 'tr2', user: 'u_hamdi', title: 'رحلة حمص: تركيب CT', from: addDays(t, -6), to: addDays(t, -4), project: 'p1', advance: 5000, status: 'submitted', decisionNote: '',
      items: [
        { id: uid('it'), kind: 'مواصلات', note: 'ذهاب وعودة', syp: 1400, cur: 'SYP', orig: 1400, rate: null, date: addDays(t, -6), receipt: true },
        { id: uid('it'), kind: 'طعام', note: 'ثلاثة أيام', syp: 1650, cur: 'SYP', orig: 1650, rate: null, date: addDays(t, -5), receipt: false },
        { id: uid('it'), kind: 'قطع ومواد', note: 'كابلات وتمديدات', syp: 1300, cur: 'SYP', orig: 1300, rate: null, date: addDays(t, -5), receipt: true },
      ] },
    { id: 'tr3', user: 'u_ghiath', title: 'زيارة عميل: درعا', from: addDays(t, -3), to: addDays(t, -3), project: 'p3', advance: 0, status: 'submitted', decisionNote: '',
      items: [
        { id: uid('it'), kind: 'مواصلات', note: 'سيارة أجرة', syp: 1200, cur: 'SYP', orig: 1200, rate: null, date: addDays(t, -3), receipt: false },
      ] },
  ];

  const rates = [
    { date: addDays(t, -1), buy: 148.5, sell: 149.25, approved: 149.25, by: 'u_maram', at: addDays(t, -1) + 'T09:05' },
    { date: t, buy: 149.0, sell: 149.75, approved: null, by: null, at: null },
  ];

  const notifications = [
    { id: uid('n'), to: 'u_ibrahim', text: 'مهمة جديدة: فحص الحاقن ASA-300 · حلب · اليوم 12:30', at: t + 'T08:01', read: false },
    { id: uid('n'), to: 'u_ibrahim', text: 'صباح الخير يا إبراهيم، لديك اليوم 4 مهام، أولها 9:00.', at: t + 'T08:00', read: false },
    { id: uid('n'), to: 'u_maram', text: 'سعر صرف اليوم بانتظار الاعتماد.', at: t + 'T08:00', read: false },
    { id: uid('n'), to: 'u_maram', text: 'طلب مصاريف جديد: م. حمدي الدرة · رحلة حمص · 4,350 ل.س', at: addDays(t, -4) + 'T18:20', read: false },
    { id: uid('n'), to: 'u_anas', text: 'اليوم: 18 مهمة، صيانة متأخرة واحدة، طلبا مصاريف بانتظار المنسقة.', at: t + 'T08:00', read: false },
  ];

  const activity = [
    { at: addDays(t, -1) + 'T09:05', who: 'u_maram', what: 'اعتمدت سعر الصرف 149.25' },
    { at: addDays(t, -4) + 'T18:20', who: 'u_hamdi', what: 'أرسل رحلة حمص للموافقة' },
    { at: addDays(t, -6) + 'T10:00', who: 'u_anas', what: 'عدّل صلاحيات فارس عجمي: إيقاف إضافة المصاريف' },
  ];

  return { day: t, users, centers, devices, projects, tasks, trips, rates, notifications, activity, session: null };
}

let db = null;

function load() {
  if (db) return db;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.day === todayISO()) { db = parsed; return db; }
    }
  } catch (e) { /* تخزين غير متاح: نعمل بالذاكرة فقط */ }
  db = seed();
  save();
  return db;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ }
}

function err(msg) { const e = new Error(msg); e.userMessage = msg; return e; }

function me() { const d = load(); return d.users.find((u) => u.id === d.session) || null; }

function has(u, k) { return !!(u && u.active && u.perms[k]); }

function log(what) { const d = load(); d.activity.unshift({ at: new Date().toISOString().slice(0, 16), who: d.session, what }); }

function notify(to, text) {
  const d = load();
  d.notifications.unshift({ id: uid('n'), to, text, at: new Date().toISOString().slice(0, 16), read: false });
}

function rateToday() {
  const d = load();
  const r = d.rates.find((x) => x.date === todayISO());
  const approved = d.rates.filter((x) => x.approved).sort((a, b) => b.date.localeCompare(a.date))[0];
  return { today: r, effective: r && r.approved ? r.approved : approved ? approved.approved : null, stale: !(r && r.approved) };
}

export const demoStore = {
  mode: 'demo',
  async demoUsers() { return load().users.map((u) => ({ id: u.id, name: u.name, title: u.title, template: u.template })); },
  async signInDemo(id) { const d = load(); if (!d.users.find((u) => u.id === id)) throw err('الحساب غير موجود.'); d.session = id; save(); return me(); },
  async signIn() { throw err('في النسخة التجريبية اختر حساباً من القائمة.'); },
  async signOut() { const d = load(); d.session = null; save(); },
  async me() { return me(); },
  async users() { return load().users; },
  async user(id) { return load().users.find((u) => u.id === id); },
  async centers() { return load().centers; },
  async devices() { const u = me(); if (!has(u, 'devices.view')) throw err('ليس لديك صلاحية مشاهدة الأجهزة.'); return load().devices; },

  async projects() {
    const d = load(); const u = me();
    if (has(u, 'tasks.view_team')) return d.projects;
    const mine = new Set(d.tasks.filter((t) => t.assignee === u.id).map((t) => t.project));
    return d.projects.filter((p) => p.owner === u.id || mine.has(p.id));
  },
  async tasks(filter = {}) {
    const d = load(); const u = me();
    let list = d.tasks;
    if (!has(u, 'tasks.view_team')) list = list.filter((t) => t.assignee === u.id);
    if (filter.assignee) list = list.filter((t) => t.assignee === filter.assignee);
    if (filter.project) list = list.filter((t) => t.project === filter.project);
    return list;
  },
  async toggleTask(id) {
    const d = load(); const u = me(); const t = d.tasks.find((x) => x.id === id);
    if (!t) throw err('المهمة غير موجودة.');
    if (t.assignee !== u.id && !has(u, 'tasks.edit') && !has(u, 'tasks.assign')) throw err('لا يمكنك تعديل مهمة غيرك.');
    t.done = !t.done; save(); return t;
  },
  async createTask(data) {
    const u = me(); if (!has(u, 'tasks.assign') && data.assignee !== u.id) throw err('ليس لديك صلاحية إسناد مهام لغيرك.');
    const title = String(data.title || '').trim();
    if (title.length < 3 || title.length > 140) throw err('اكتب عنوان المهمة (من 3 إلى 140 حرفاً).');
    if (!['daily', 'weekly', 'monthly', 'once'].includes(data.freq)) throw err('اختر تكرار المهمة.');
    const d = load();
    const t = { id: uid('t'), project: data.project || null, title, assignee: data.assignee, freq: data.freq, due: data.due || todayISO(), done: false, note: '' };
    d.tasks.push(t);
    if (t.assignee !== u.id) notify(t.assignee, `مهمة جديدة: ${t.title}`);
    log(`أنشأ مهمة: ${t.title}`); save(); return t;
  },
  async createProject(data) {
    const u = me(); if (!has(u, 'tasks.assign')) throw err('ليس لديك صلاحية إنشاء مشاريع.');
    const title = String(data.title || '').trim();
    if (title.length < 3 || title.length > 140) throw err('اكتب اسم المشروع (من 3 إلى 140 حرفاً).');
    const d = load();
    const p = { id: uid('p'), type: data.type || 'مشروع', title, center: data.center || null, owner: data.owner || u.id, due: data.due || addDays(todayISO(), 30), status: 'active' };
    d.projects.unshift(p); log(`أنشأ مشروعاً: ${p.title}`); save(); return p;
  },

  async rate() { return rateToday(); },
  async approveRate(value) {
    const u = me(); if (!has(u, 'rate.set')) throw err('ليس لديك صلاحية تحديد سعر الصرف.');
    const v = Number(value);
    if (!(v > 1 && v < 1000000)) throw err('اكتب سعر صرف صحيحاً.');
    const d = load(); const r = d.rates.find((x) => x.date === todayISO());
    r.approved = v; r.by = u.id; r.at = new Date().toISOString().slice(0, 16);
    log(`اعتمدت سعر الصرف ${v}`); save(); return rateToday();
  },

  async trips(scope = 'mine') {
    const d = load(); const u = me();
    if (scope === 'all') {
      if (!has(u, 'expenses.view_all') && !has(u, 'expenses.approve') && !has(u, 'expenses.pay')) throw err('ليس لديك صلاحية مشاهدة مصاريف الآخرين.');
      return d.trips;
    }
    return d.trips.filter((t) => t.user === u.id);
  },
  async trip(id) {
    const d = load(); const u = me(); const t = d.trips.find((x) => x.id === id);
    if (!t) throw err('الرحلة غير موجودة.');
    if (t.user !== u.id && !has(u, 'expenses.view_all') && !has(u, 'expenses.approve') && !has(u, 'expenses.pay')) throw err('لا يمكنك مشاهدة هذه الرحلة.');
    return t;
  },
  async createTrip(data) {
    const u = me(); if (!has(u, 'expenses.add')) throw err('ليس لديك صلاحية إضافة مصاريف.');
    const title = String(data.title || '').trim();
    if (title.length < 3 || title.length > 100) throw err('اكتب وجهة الرحلة.');
    const d = load();
    const t = { id: uid('tr'), user: u.id, title, from: data.from || todayISO(), to: data.to || todayISO(), project: data.project || null, advance: 0, status: 'draft', decisionNote: '', items: [] };
    d.trips.unshift(t); save(); return t;
  },
  // الحساب هنا يحاكي ما يفعله الخادم: المبلغ بالليرة يُحسب من السعر المعتمد، لا من المتصفح.
  async addItem(tripId, item) {
    const u = me(); const t = await this.trip(tripId);
    if (t.user !== u.id) throw err('لا يمكنك تعديل رحلة غيرك.');
    if (!['draft', 'returned'].includes(t.status)) throw err('أُرسلت الرحلة، ولا يمكن تعديلها.');
    if (!has(u, 'expenses.add')) throw err('ليس لديك صلاحية إضافة مصاريف.');
    const kinds = ['مواصلات', 'طعام', 'فندق', 'قطع ومواد', 'غير ذلك'];
    if (!kinds.includes(item.kind)) throw err('اختر نوع المصروف.');
    const amount = Number(item.amount);
    if (!(amount > 0 && amount < 100000000)) throw err('اكتب المبلغ.');
    if (item.kind === 'غير ذلك' && !String(item.note || '').trim()) throw err('اكتب ملاحظة توضّح نوع المصروف.');
    let syp = amount, rate = null;
    if (item.cur === 'USD') {
      if (!has(u, 'expenses.usd')) throw err('ليس لديك صلاحية الإدخال بالدولار.');
      rate = rateToday().effective;
      if (!rate) throw err('لا يوجد سعر صرف معتمد بعد. أدخل المبلغ بالليرة أو تواصل مع المنسقة.');
      syp = Math.round(amount * rate);
    }
    const it = { id: uid('it'), kind: item.kind, note: String(item.note || '').slice(0, 120), syp, cur: item.cur === 'USD' ? 'USD' : 'SYP', orig: amount, rate, date: todayISO(), receipt: !!item.receipt };
    t.items.push(it); save(); return it;
  },
  async removeItem(tripId, itemId) {
    const u = me(); const t = await this.trip(tripId);
    if (t.user !== u.id || !['draft', 'returned'].includes(t.status)) throw err('لا يمكن حذف هذا البند.');
    t.items = t.items.filter((i) => i.id !== itemId); save();
  },
  async submitTrip(id) {
    const u = me(); const t = await this.trip(id);
    if (t.user !== u.id) throw err('لا يمكنك إرسال رحلة غيرك.');
    if (!t.items.length) throw err('أضف مصروفاً واحداً على الأقل قبل الإرسال.');
    t.status = 'submitted';
    const total = t.items.reduce((a, b) => a + b.syp, 0);
    const d = load();
    d.users.filter((x) => has(x, 'expenses.approve')).forEach((x) => notify(x.id, `طلب مصاريف جديد: ${u.name} · ${t.title} · ${total.toLocaleString('en-US')} ل.س`));
    log(`أرسل ${t.title} للموافقة`); save(); return t;
  },
  async decideTrip(id, decision, note = '') {
    const u = me(); if (!has(u, 'expenses.approve')) throw err('ليس لديك صلاحية الموافقة على المصاريف.');
    const t = await this.trip(id);
    if (t.status !== 'submitted') throw err('هذا الطلب ليس بانتظار الموافقة.');
    const map = { approve: 'approved', reject: 'rejected', return: 'returned' };
    if (!map[decision]) throw err('قرار غير معروف.');
    if (decision !== 'approve' && !String(note).trim()) throw err('اكتب السبب.');
    t.status = map[decision]; t.decisionNote = String(note).slice(0, 200);
    const words = { approve: 'تمت الموافقة على', reject: 'رُفض طلب', return: 'أُعيد للتعديل طلب' };
    notify(t.user, `${words[decision]} مصاريف ${t.title}.${note ? ' السبب: ' + note : ''}`);
    if (decision === 'approve') load().users.filter((x) => has(x, 'expenses.pay')).forEach((x) => notify(x.id, `مصاريف بانتظار الدفع: ${t.title}`));
    log(`${words[decision]} ${t.title}`); save(); return t;
  },
  async payTrip(id) {
    const u = me(); if (!has(u, 'expenses.pay')) throw err('ليس لديك صلاحية دفع المصاريف.');
    const t = await this.trip(id);
    if (t.status !== 'approved') throw err('لا يمكن دفع طلب غير موافق عليه.');
    t.status = 'paid'; notify(t.user, `دُفعت مصاريف ${t.title}.`); log(`سجّل دفع ${t.title}`); save(); return t;
  },

  async setPerms(userId, template, perms) {
    const u = me(); if (!has(u, 'perms.edit')) throw err('ليس لديك صلاحية تعديل الصلاحيات.');
    const d = load(); const target = d.users.find((x) => x.id === userId);
    if (!target) throw err('الموظف غير موجود.');
    if (target.id === u.id && !perms['perms.edit']) throw err('لا يمكنك سحب صلاحية تعديل الصلاحيات من نفسك.');
    target.template = template; target.perms = {};
    for (const [k, v] of Object.entries(perms)) if (v) target.perms[k] = { on: true };
    const base = TEMPLATES[template].perms;
    target.custom = base.length !== Object.keys(target.perms).length || base.some((k) => !target.perms[k]);
    log(`عدّل صلاحيات ${target.name}`); save(); return target;
  },
  async setActive(userId, active) {
    const u = me(); if (!has(u, 'users.manage')) throw err('ليس لديك صلاحية إدارة المستخدمين.');
    const d = load(); const target = d.users.find((x) => x.id === userId);
    if (target.id === u.id) throw err('لا يمكنك إيقاف حسابك.');
    target.active = !!active; log(`${active ? 'فعّل' : 'أوقف'} حساب ${target.name}`); save(); return target;
  },

  async notifications() { const d = load(); return d.notifications.filter((n) => n.to === d.session); },
  async markAllRead() { const d = load(); d.notifications.forEach((n) => { if (n.to === d.session) n.read = true; }); save(); },
  async activity() { const u = me(); if (!has(u, 'activity.view')) throw err('ليس لديك صلاحية مشاهدة سجل النشاط.'); return load().activity; },
  async resetDemo() { db = seed(); save(); },
  name: (u) => firstName(u && u.name),
};
