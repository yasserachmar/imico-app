// شاشات النظام. كل النصوص تُضاف عبر h() (textContent) فلا مجال لحقن HTML.
'use strict';
import { h, append, bdi, fmt, money, todayISO, addDays, relDay, dateLabel, greeting, firstName, initial, parseAmount, clear } from './util.js';
import { icon } from './icons.js';
import { api } from './api.js';
import { can, PERM_GROUPS, TEMPLATES } from './perms.js';
import { toast, run, modal, confirmBox, promptBox, pageHead, empty, pill, card, setView, errorMessage } from './ui.js';

export const FREQ = { daily: ['يومي', ''], weekly: ['أسبوعي', 'b'], monthly: ['شهري', 'y'], once: ['مرة واحدة', 'g'] };
export const TRIP_STATUS = { draft: ['مسودة', 'g'], submitted: ['بانتظار الموافقة', 'y'], approved: ['موافق عليه', ''], rejected: ['مرفوض', 'o'], returned: ['بحاجة تعديل', 'o'], paid: ['مدفوع', 'b'] };
const KINDS = ['مواصلات', 'طعام', 'فندق', 'قطع ومواد', 'غير ذلك'];

const userMap = async () => Object.fromEntries((await api.users()).map((u) => [u.id, u]));
const total = (t) => t.items.reduce((a, b) => a + b.syp, 0);

function avatar(name) { return h('span', { class: 'avatar', 'aria-hidden': 'true' }, initial(name)); }

function taskRow(t, ctx, users, projects) {
  const box = h('button', { class: 'check' + (t.done ? ' on' : ''), 'aria-pressed': String(!!t.done), 'aria-label': t.done ? 'إلغاء إنجاز المهمة' : 'تحديد المهمة كمنجزة' }, icon('check', 18));
  box.addEventListener('click', async () => {
    const r = await run(() => api.toggleTask(t.id));
    if (r) { t.done = r.done; box.classList.toggle('on', r.done); box.setAttribute('aria-pressed', String(r.done)); row.classList.toggle('done', r.done); }
  });
  const proj = t.project && projects[t.project];
  const late = !t.done && t.due < todayISO();
  const row = h('div', { class: 'task' + (t.done ? ' done' : '') },
    box,
    h('div', { class: 'task-main' },
      proj ? h('span', { class: 'task-proj' }, proj.title) : null,
      h('span', { class: 'task-title' }, t.title),
      h('div', { class: 'task-meta' },
        pill(FREQ[t.freq][0], FREQ[t.freq][1]),
        pill(t.time ? `${relDay(t.due)} ` : relDay(t.due), late ? 'o' : 'g'),
        t.time ? bdi(t.time) : null,
        t.urgent && !t.done ? pill('عاجل', 'o') : null,
        late ? pill('متأخرة', 'o') : null,
        users && users[t.assignee] && t.assignee !== ctx.me.id ? h('span', { class: 'muted small' }, users[t.assignee].name) : null)));
  return row;
}

/* ------------------------------ الرئيسية ------------------------------ */
export async function home(root, ctx) {
  const me = ctx.me; const t = todayISO();
  const [tasks, projectsArr, users] = await Promise.all([api.tasks(), api.projects(), userMap()]);
  const projects = Object.fromEntries(projectsArr.map((p) => [p.id, p]));
  const mine = tasks.filter((x) => x.assignee === me.id);
  const today = mine.filter((x) => x.due === t || (!x.done && x.due < t));
  const stats = [];
  stats.push(['مهامي اليوم', fmt(today.length), `أُنجز منها ${fmt(today.filter((x) => x.done).length)}.`, '#/tasks']);
  if (can(me, 'tasks.view_team')) {
    const late = tasks.filter((x) => !x.done && x.due < t).length;
    stats.push(['مهام متأخرة للفريق', fmt(late), late ? 'تحتاج متابعة.' : 'لا يوجد تأخير.', '#/projects', late ? 'warn' : '']);
  }
  if (can(me, 'expenses.approve')) {
    const n = (await api.trips('all')).filter((x) => x.status === 'submitted').length;
    stats.push(['طلبات مصاريف', fmt(n), 'بانتظار موافقتك.', '#/approvals']);
  }
  if (can(me, 'expenses.pay')) {
    const n = (await api.trips('all')).filter((x) => x.status === 'approved').length;
    stats.push(['مصاريف للدفع', fmt(n), 'موافق عليها وبانتظار الدفع.', '#/approvals']);
  }
  if (can(me, 'devices.view')) {
    const soon = (await api.devices()).filter((d) => d.warrantyEnd >= t && d.warrantyEnd <= addDays(t, 200)).length;
    stats.push(['كفالات تنتهي قريباً', fmt(soon), 'خلال 200 يوم.', '#/devices']);
  }
  if (can(me, 'expenses.add')) {
    const open = (await api.trips('mine')).filter((x) => ['draft', 'returned'].includes(x.status)).length;
    stats.push(['رحلات مفتوحة', fmt(open), 'لم تُرسل بعد.', '#/expenses']);
  }

  const statGrid = h('div', { class: 'stats' }, stats.slice(0, 4).map(([l, v, s, href, k]) =>
    h('a', { class: 'stat ' + (k || ''), href }, h('span', { class: 'stat-l' }, l), h('span', { class: 'stat-v' }, bdi(v)), h('span', { class: 'stat-s' }, s))));

  const todayList = card(h('div', { class: 'card-head' }, h('h2', null, 'مهامي اليوم'), h('a', { href: '#/tasks' }, 'كل مهامي')),
    today.length ? h('div', { class: 'tasks' }, today.slice(0, 6).map((x) => taskRow(x, ctx, users, projects))) : empty('لا توجد مهام لك اليوم.'));

  let teamCard = null;
  if (can(me, 'tasks.view_team')) {
    const rows = Object.values(users).filter((u) => u.active && u.id !== me.id).map((u) => {
      const ut = tasks.filter((x) => x.assignee === u.id && x.due === t);
      const done = ut.filter((x) => x.done).length;
      const pct = ut.length ? Math.round(done / ut.length * 100) : 0;
      return h('a', { class: 'team-row', href: '#/team/' + encodeURIComponent(u.id) }, avatar(u.name),
        h('div', { class: 'team-main' }, h('span', { class: 'strong' }, u.name), h('span', { class: 'muted small' }, u.title)),
        h('div', { class: 'team-prog' }, h('span', { class: 'small muted' }, bdi(`${done}/${ut.length}`)), h('span', { class: 'bar' }, h('span', { style: { width: pct + '%' } }))));
    });
    teamCard = card(h('div', { class: 'card-head' }, h('h2', null, 'الفريق اليوم'), h('a', { href: '#/team' }, 'عرض الكل')), h('div', { class: 'team-list' }, rows));
  }

  setView(root,
    h('div', { class: 'hello' }, h('h1', null, greeting(firstName(me.name))), h('p', { class: 'muted' }, dateLabel(t))),
    statGrid,
    h('div', { class: 'two-col' }, todayList, teamCard));
}

/* ------------------------------ مهامي ------------------------------ */
export async function myTasks(root, ctx) {
  const me = ctx.me; const t = todayISO();
  const [tasks, projectsArr] = await Promise.all([api.tasks({ assignee: me.id }), api.projects()]);
  const projects = Object.fromEntries(projectsArr.map((p) => [p.id, p]));
  const tabs = [['today', 'اليوم'], ['upcoming', 'القادمة'], ['late', 'المتأخرة'], ['done', 'المنجزة']];
  let cur = ctx.query.tab || 'today';
  const list = h('div', { class: 'tasks' });
  const bar = h('div', { class: 'seg', role: 'tablist' });
  function render() {
    clear(bar); clear(list);
    for (const [k, l] of tabs) bar.append(h('button', { role: 'tab', 'aria-selected': String(k === cur), class: k === cur ? 'on' : '', onclick: () => { cur = k; render(); } }, l));
    const f = { today: (x) => x.due === t, upcoming: (x) => x.due > t && !x.done, late: (x) => x.due < t && !x.done, done: (x) => x.done }[cur];
    const items = tasks.filter(f).sort((a, b) => (a.due + (a.time || '')).localeCompare(b.due + (b.time || '')));
    if (!items.length) list.append(empty('لا توجد مهام هنا.'));
    else items.forEach((x) => list.append(taskRow(x, ctx, null, projects)));
  }
  render();
  setView(root, pageHead('مهامي', 'مهامك مرتبة حسب الموعد، وفوق كل مهمة مشروعها.'), bar, list);
}

/* ------------------------------ المشاريع ------------------------------ */
export async function projectsView(root, ctx) {
  const me = ctx.me;
  const [projects, tasks, users, centers] = await Promise.all([api.projects(), api.tasks(), userMap(), api.centers()]);
  const centerName = Object.fromEntries(centers.map((c) => [c.id, `${c.name}، ${c.city}`]));
  let sel = ctx.params[0] || (projects[0] && projects[0].id);
  let filter = 'all';
  const listEl = h('div', { class: 'proj-list' });
  const detail = h('section', { class: 'card proj-detail' });
  const projMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  function renderList() {
    clear(listEl);
    if (!projects.length) { listEl.append(empty('لا توجد مشاريع بعد.')); return; }
    for (const p of projects) {
      const pt = tasks.filter((x) => x.project === p.id);
      const pct = pt.length ? Math.round(pt.filter((x) => x.done).length / pt.length * 100) : 0;
      listEl.append(h('a', { class: 'proj-card' + (p.id === sel ? ' on' : ''), href: '#/projects/' + encodeURIComponent(p.id), 'aria-current': p.id === sel ? 'true' : null },
        h('span', { class: 'row-between' }, pill(p.type, 'g'), h('span', { class: 'small muted' }, bdi(pct + '%'))),
        h('span', { class: 'strong' }, p.title),
        h('span', { class: 'small muted' }, p.center ? centerName[p.center] || '' : '—'),
        h('span', { class: 'bar' }, h('span', { style: { width: pct + '%' } }))));
    }
  }
  function renderDetail() {
    clear(detail);
    const p = projMap[sel];
    if (!p) { detail.append(empty('اختر مشروعاً لعرض مهامه.')); return; }
    const pt = tasks.filter((x) => x.project === p.id);
    const chips = h('div', { class: 'chips', role: 'tablist' });
    for (const [k, l] of [['all', 'الكل'], ['daily', 'يومي'], ['weekly', 'أسبوعي'], ['monthly', 'شهري'], ['once', 'مرة واحدة']])
      chips.append(h('button', { role: 'tab', 'aria-selected': String(filter === k), class: 'chip' + (filter === k ? ' on' : ''), onclick: () => { filter = k; renderDetail(); } }, l));
    const shown = pt.filter((x) => filter === 'all' || x.freq === filter);
    append(detail, [
      h('div', { class: 'row-between wrap' },
        h('div', null, h('span', { class: 'kicker' }, p.type), h('h2', null, p.title), h('p', { class: 'muted' }, p.center ? centerName[p.center] : '')),
        h('dl', { class: 'facts' },
          h('div', null, h('dt', null, 'المسؤول'), h('dd', null, users[p.owner] ? users[p.owner].name : '—')),
          h('div', null, h('dt', null, 'التسليم'), h('dd', null, dateLabel(p.due))),
          h('div', null, h('dt', null, 'الإنجاز'), h('dd', null, bdi(`${pt.filter((x) => x.done).length}/${pt.length}`))))),
      chips,
      shown.length ? h('div', { class: 'tasks' }, shown.map((x) => taskRow(x, ctx, users, projMap))) : empty('لا توجد مهام بهذا التكرار.'),
      can(me, 'tasks.assign') ? h('button', { class: 'btn ghost add-row', onclick: () => newTaskDialog(ctx, users, p.id) }, icon('plus', 18), 'إضافة مهمة فرعية') : null]);
  }
  renderList(); renderDetail();
  const action = can(me, 'tasks.assign') ? h('button', { class: 'btn primary', onclick: () => newProjectDialog(ctx, users, centers) }, icon('plus', 18), 'مشروع جديد') : null;
  setView(root, pageHead('المشاريع والمهام', 'كل مشروع رئيسي وتحته مهامه اليومية والأسبوعية.', action), h('div', { class: 'proj-wrap' }, listEl, detail));
}

function field(label, input, hint) { return h('label', { class: 'field' }, h('span', null, label), input, hint ? h('small', { class: 'muted' }, hint) : null); }

function newProjectDialog(ctx, users, centers) {
  const title = h('input', { required: true, minlength: 3, maxlength: 140, autocomplete: 'off' });
  const type = h('select', null, ['مشروع تركيب', 'عقد صيانة', 'صفقة مبيعات', 'مؤتمر', 'مشروع إداري'].map((x) => h('option', null, x)));
  const center = h('select', null, h('option', { value: '' }, 'بدون مركز'), centers.map((c) => h('option', { value: c.id }, `${c.name}، ${c.city}`)));
  const owner = h('select', null, Object.values(users).filter((u) => u.active).map((u) => h('option', { value: u.id }, u.name)));
  const due = h('input', { type: 'date', value: addDays(todayISO(), 30), dir: 'ltr' });
  const dlg = modal('مشروع جديد', h('div', { class: 'form' }, field('اسم المشروع', title), field('النوع', type), field('المركز', center), field('المسؤول', owner), field('موعد التسليم', due)), [
    h('button', { class: 'btn ghost', value: 'cancel', formnovalidate: true }, 'إلغاء'),
    h('button', { class: 'btn primary', value: 'ok', onclick: async (e) => {
      e.preventDefault();
      const p = await run(() => api.createProject({ title: title.value, type: type.value, center: center.value, owner: owner.value, due: due.value }), 'أُنشئ المشروع.');
      if (p) { dlg.close(); location.hash = '#/projects/' + encodeURIComponent(p.id); }
    } }, 'إنشاء')]);
}

function newTaskDialog(ctx, users, projectId) {
  const title = h('input', { required: true, minlength: 3, maxlength: 140, autocomplete: 'off' });
  const assignee = h('select', null, Object.values(users).filter((u) => u.active).map((u) => h('option', { value: u.id }, u.name)));
  const freq = h('select', null, Object.entries(FREQ).map(([k, v]) => h('option', { value: k }, v[0])));
  const due = h('input', { type: 'date', value: todayISO(), dir: 'ltr' });
  const dlg = modal('مهمة فرعية جديدة', h('div', { class: 'form' }, field('المهمة', title), field('المكلّف', assignee), field('التكرار', freq), field('الموعد', due)), [
    h('button', { class: 'btn ghost', value: 'cancel', formnovalidate: true }, 'إلغاء'),
    h('button', { class: 'btn primary', value: 'ok', onclick: async (e) => {
      e.preventDefault();
      const t = await run(() => api.createTask({ project: projectId, title: title.value, assignee: assignee.value, freq: freq.value, due: due.value }), 'أُضيفت المهمة، ووصل إشعار للمكلّف.');
      if (t) { dlg.close(); ctx.refresh(); }
    } }, 'إضافة')]);
}

/* ------------------------------ مصاريفي ------------------------------ */
export async function expenses(root, ctx) {
  const me = ctx.me;
  if (ctx.params[0]) return tripView(root, ctx, ctx.params[0]);
  const trips = await api.trips('mine');
  const action = can(me, 'expenses.add') ? h('button', { class: 'btn primary', onclick: () => newTripDialog() }, icon('plus', 18), 'رحلة عمل جديدة') : null;
  const list = trips.length ? h('div', { class: 'list' }, trips.map((t) => h('a', { class: 'list-row', href: '#/expenses/' + encodeURIComponent(t.id) },
    h('div', { class: 'grow' }, h('span', { class: 'strong' }, t.title), h('span', { class: 'small muted' }, `${relDay(t.from)} - ${relDay(t.to)}`)),
    h('div', { class: 'end' }, money(total(t)), pill(...TRIP_STATUS[t.status]))))) : empty('لا توجد رحلات بعد.');
  setView(root, pageHead('مصاريفي', can(me, 'expenses.add') ? 'افتح رحلة عمل، وأضف مصاريفها أولاً بأول، ثم أرسلها مرة واحدة.' : 'ليس لديك صلاحية إضافة مصاريف. تواصل مع المدير إن احتجتها.', action), list);
}

function newTripDialog() {
  const title = h('input', { required: true, minlength: 3, maxlength: 100, placeholder: 'مثال: رحلة حلب، صيانة دورية' });
  const from = h('input', { type: 'date', value: todayISO(), dir: 'ltr' });
  const to = h('input', { type: 'date', value: todayISO(), dir: 'ltr' });
  const dlg = modal('رحلة عمل جديدة', h('div', { class: 'form' }, field('الوجهة والغرض', title), h('div', { class: 'grid2' }, field('من', from), field('إلى', to))), [
    h('button', { class: 'btn ghost', value: 'cancel', formnovalidate: true }, 'إلغاء'),
    h('button', { class: 'btn primary', value: 'ok', onclick: async (e) => {
      e.preventDefault();
      if (to.value < from.value) { toast('تاريخ النهاية قبل تاريخ البداية.', 'err'); return; }
      const t = await run(() => api.createTrip({ title: title.value, from: from.value, to: to.value }));
      if (t) { dlg.close(); location.hash = '#/expenses/' + encodeURIComponent(t.id); }
    } }, 'فتح الرحلة')]);
}

async function tripView(root, ctx, id) {
  const me = ctx.me;
  let trip;
  try { trip = await api.trip(id); } catch (e) { setView(root, pageHead('رحلة عمل'), empty(errorMessage(e))); return; }
  const editable = trip.user === me.id && ['draft', 'returned'].includes(trip.status);
  const rate = editable && can(me, 'expenses.usd') ? await api.rate() : null;

  const t = total(trip); const bal = trip.advance - t;
  const sums = h('div', { class: 'stats three' },
    h('div', { class: 'stat' }, h('span', { class: 'stat-l' }, 'السلفة'), h('span', { class: 'stat-v' }, money(trip.advance))),
    h('div', { class: 'stat' }, h('span', { class: 'stat-l' }, 'المصروف'), h('span', { class: 'stat-v' }, money(t))),
    h('div', { class: 'stat ' + (bal >= 0 ? 'soft' : 'warn') }, h('span', { class: 'stat-l' }, bal >= 0 ? 'متبقٍّ معك' : 'مستحق لك'), h('span', { class: 'stat-v' }, money(Math.abs(bal)))));

  let form = null;
  if (editable) {
    let kind = 'طعام', cur = 'SYP';
    const kinds = h('div', { class: 'chips' });
    const amount = h('input', { inputmode: 'decimal', dir: 'ltr', placeholder: '0', autocomplete: 'off', 'aria-label': 'المبلغ' });
    const note = h('input', { maxlength: 120, placeholder: 'ملاحظة (إلزامية لـ «غير ذلك»)', 'aria-label': 'ملاحظة' });
    const conv = h('p', { class: 'note', hidden: true });
    const seg = h('div', { class: 'seg small', role: 'group', 'aria-label': 'العملة' });
    let receipt = false;
    const receiptBtn = h('button', { type: 'button', class: 'btn ghost dashed' }, icon('camera', 18), 'صورة الوصل');
    const fileIn = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,application/pdf', capture: 'environment', hidden: true });
    receiptBtn.addEventListener('click', () => fileIn.click());
    fileIn.addEventListener('change', () => {
      const f = fileIn.files[0];
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) { toast('حجم الملف أكبر من 5MB.', 'err'); fileIn.value = ''; return; }
      if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type)) { toast('المسموح: صورة أو PDF فقط.', 'err'); fileIn.value = ''; return; }
      receipt = true; receiptBtn.classList.add('on'); clear(receiptBtn).append(icon('check', 18), 'أُرفق الوصل');
    });
    function renderKinds() { clear(kinds); KINDS.forEach((k) => kinds.append(h('button', { type: 'button', class: 'chip' + (k === kind ? ' on' : ''), 'aria-pressed': String(k === kind), onclick: () => { kind = k; renderKinds(); } }, k))); }
    function renderSeg() {
      clear(seg);
      [['SYP', 'ل.س'], ['USD', '$']].forEach(([k, l]) => seg.append(h('button', { type: 'button', class: k === cur ? 'on' : '', 'aria-pressed': String(k === cur), onclick: () => { cur = k; renderSeg(); updateConv(); } }, l)));
    }
    function updateConv() {
      const n = parseAmount(amount.value);
      if (cur === 'USD' && rate) {
        conv.hidden = false; clear(conv);
        if (!rate.effective) conv.append('لا يوجد سعر صرف معتمد بعد.');
        else conv.append('يعادل ', bdi(fmt((n || 0) * rate.effective)), ' ل.س على سعر صرف اليوم ', bdi(rate.effective), '.');
      } else conv.hidden = true;
    }
    amount.addEventListener('input', updateConv);
    renderKinds(); renderSeg();
    const addBtn = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      const n = parseAmount(amount.value);
      if (!(n > 0)) { toast('اكتب المبلغ بالأرقام.', 'err'); amount.focus(); return; }
      const it = await run(() => api.addItem(trip.id, { kind, amount: n, cur, note: note.value, receipt }), 'أُضيف المصروف.');
      if (it) ctx.refresh();
    } }, 'إضافة');
    form = card(h('h2', null, 'إضافة مصروف'), kinds,
      h('div', { class: 'amount-row' }, amount, can(me, 'expenses.usd') ? seg : null),
      conv, note, h('div', { class: 'grid2' }, receiptBtn, addBtn), fileIn);
  }

  const items = trip.items.length ? h('div', { class: 'list' }, trip.items.map((i) => h('div', { class: 'list-row' },
    h('div', { class: 'grow' }, h('span', { class: 'strong' }, i.kind), h('span', { class: 'small muted' }, [i.note, relDay(i.date)].filter(Boolean).join(' · '))),
    h('div', { class: 'end col' }, money(i.syp), i.cur === 'USD' ? h('span', { class: 'small muted' }, bdi(`$${i.orig} × ${i.rate}`)) : null,
      i.receipt ? h('span', { class: 'small ok' }, 'مع وصل') : null),
    editable ? h('button', { class: 'icon-btn', 'aria-label': 'حذف البند', onclick: async () => { if (await confirmBox('حذف البند', `سيُحذف بند ${i.kind} من الرحلة.`, 'حذف', true)) { await run(() => api.removeItem(trip.id, i.id)); ctx.refresh(); } } }, icon('x', 18)) : null))) : empty('لا توجد مصاريف في هذه الرحلة بعد.');

  const footer = editable ? h('div', { class: 'sticky-foot' }, h('button', { class: 'btn dark block', onclick: async () => {
    if (await confirmBox('إرسال الرحلة', 'بعد الإرسال لا يمكن التعديل إلا إذا أعادتها المنسقة.', 'إرسال')) { const r = await run(() => api.submitTrip(trip.id), 'أُرسلت للمنسقة.'); if (r) ctx.refresh(); }
  } }, 'إرسال الرحلة للمنسقة')) : null;

  setView(root,
    h('div', { class: 'page-head' }, h('a', { class: 'icon-btn', href: '#/expenses', 'aria-label': 'رجوع' }, icon('back', 20)),
      h('div', { class: 'page-title grow' }, h('h1', null, trip.title), h('p', { class: 'muted' }, `${dateLabel(trip.from)} - ${dateLabel(trip.to)}`)), pill(...TRIP_STATUS[trip.status])),
    trip.decisionNote ? h('p', { class: 'note warn' }, 'ملاحظة المنسقة: ', trip.decisionNote) : null,
    sums, form, h('h2', { class: 'section-t' }, 'مصاريف الرحلة'), items, footer);
}

/* ------------------------------ الموافقات ------------------------------ */
export async function approvals(root, ctx) {
  const me = ctx.me;
  const [trips, users] = await Promise.all([api.trips('all'), userMap()]);
  const tabs = [];
  if (can(me, 'expenses.approve')) tabs.push(['submitted', 'بانتظار الموافقة']);
  if (can(me, 'expenses.pay')) tabs.push(['approved', 'بانتظار الدفع']);
  tabs.push(['all', 'الكل']);
  let cur = tabs[0][0];
  const bar = h('div', { class: 'seg', role: 'tablist' }); const list = h('div', { class: 'cards' });
  function render() {
    clear(bar); clear(list);
    tabs.forEach(([k, l]) => bar.append(h('button', { role: 'tab', 'aria-selected': String(k === cur), class: k === cur ? 'on' : '', onclick: () => { cur = k; render(); } }, l)));
    const shown = trips.filter((t) => cur === 'all' ? t.status !== 'draft' : t.status === cur);
    if (!shown.length) { list.append(empty('لا توجد طلبات هنا.')); return; }
    for (const t of shown) {
      const usd = t.items.filter((i) => i.cur === 'USD');
      const acts = [];
      if (t.status === 'submitted' && can(me, 'expenses.approve')) {
        acts.push(h('button', { class: 'btn primary', onclick: async () => { const r = await run(() => api.decideTrip(t.id, 'approve'), 'تمت الموافقة.'); if (r) ctx.refresh(); } }, 'قبول'));
        acts.push(h('button', { class: 'btn ghost', onclick: async () => { const why = await promptBox('إعادة للتعديل', 'ما الذي يجب تعديله؟', 'إعادة'); if (why) { const r = await run(() => api.decideTrip(t.id, 'return', why), 'أُعيدت للموظف.'); if (r) ctx.refresh(); } } }, 'تعديل'));
        acts.push(h('button', { class: 'btn ghost danger-t', onclick: async () => { const why = await promptBox('رفض الطلب', 'سبب الرفض', 'رفض'); if (why) { const r = await run(() => api.decideTrip(t.id, 'reject', why), 'رُفض الطلب.'); if (r) ctx.refresh(); } } }, 'رفض'));
      }
      if (t.status === 'approved' && can(me, 'expenses.pay')) acts.push(h('button', { class: 'btn primary', onclick: async () => { if (await confirmBox('تسجيل الدفع', `دفع ${fmt(total(t))} ل.س لـ ${users[t.user] ? users[t.user].name : ''}.`, 'تم الدفع')) { const r = await run(() => api.payTrip(t.id), 'سُجّل الدفع.'); if (r) ctx.refresh(); } } }, 'تسجيل الدفع'));
      list.append(card(
        h('div', { class: 'row-between' }, h('div', null, h('span', { class: 'strong' }, users[t.user] ? users[t.user].name : ''), h('p', { class: 'small muted' }, t.title)), pill(...TRIP_STATUS[t.status])),
        h('dl', { class: 'facts three' },
          h('div', null, h('dt', null, 'المجموع'), h('dd', null, money(total(t)))),
          h('div', null, h('dt', null, 'البنود'), h('dd', null, bdi(t.items.length))),
          h('div', null, h('dt', null, 'الوصولات'), h('dd', null, bdi(t.items.filter((i) => i.receipt).length)))),
        usd.length ? h('p', { class: 'note' }, 'بنود بالدولار: ', usd.map((i, n) => [n ? '، ' : '', bdi(`$${i.orig} × ${i.rate} = ${fmt(i.syp)}`), ' ل.س'])) : null,
        h('details', null, h('summary', null, 'تفاصيل البنود'), h('div', { class: 'list' }, t.items.map((i) => h('div', { class: 'list-row' }, h('span', { class: 'grow' }, `${i.kind}${i.note ? ' · ' + i.note : ''}`), money(i.syp))))),
        acts.length ? h('div', { class: 'actions' }, acts) : null));
    }
  }
  render();
  setView(root, pageHead('طلبات المصاريف', 'راجع الرحلات المرسلة، ووافق أو أعدها مع السبب.'), bar, list);
}

/* ------------------------------ الفريق والصلاحيات ------------------------------ */
export async function team(root, ctx) {
  if (ctx.params[0]) return person(root, ctx, ctx.params[0]);
  const [users, tasks] = await Promise.all([api.users(), api.tasks()]);
  const t = todayISO();
  setView(root, pageHead('الفريق', 'الموظفون ومهامهم اليوم.'),
    h('div', { class: 'list' }, users.map((u) => {
      const ut = tasks.filter((x) => x.assignee === u.id && x.due === t);
      return h('a', { class: 'list-row', href: '#/team/' + encodeURIComponent(u.id) }, avatar(u.name),
        h('div', { class: 'grow' }, h('span', { class: 'strong' }, u.name), h('span', { class: 'small muted' }, u.title)),
        h('div', { class: 'end' }, u.active ? null : pill('موقوف', 'o'), u.custom ? pill('معدّل يدوياً', 'y') : pill(TEMPLATES[u.template] ? TEMPLATES[u.template].label : u.template, 'g'), h('span', { class: 'small muted' }, bdi(`${ut.filter((x) => x.done).length}/${ut.length}`))));
    })));
}

async function person(root, ctx, id) {
  const me = ctx.me;
  const u = await api.user(id);
  if (!u) { setView(root, empty('الموظف غير موجود.')); return; }
  const editable = can(me, 'perms.edit');
  let template = u.template;
  const state = Object.fromEntries(PERM_GROUPS.flatMap((g) => g.items.map((i) => [i[0], !!u.perms[i[0]]])));
  const tplWrap = h('div', { class: 'chips' });
  const groups = h('div', { class: 'perm-groups' });
  const customBadge = pill('معدّل يدوياً', 'y');
  function isCustom() { const base = new Set(TEMPLATES[template].perms); return Object.entries(state).some(([k, v]) => v !== base.has(k)); }
  function render() {
    clear(tplWrap); clear(groups);
    customBadge.hidden = !isCustom();
    Object.entries(TEMPLATES).forEach(([k, v]) => tplWrap.append(h('button', { type: 'button', class: 'chip' + (k === template && !isCustom() ? ' on' : ''), disabled: !editable, onclick: () => { template = k; Object.keys(state).forEach((p) => { state[p] = v.perms.includes(p); }); render(); } }, v.label)));
    PERM_GROUPS.forEach((g) => groups.append(card(h('h2', { class: 'small-h' }, g.title), g.items.map(([key, label, hint]) =>
      h('div', { class: 'perm-row' }, h('div', { class: 'grow' }, h('span', { class: 'strong' }, label), h('span', { class: 'small muted' }, hint)),
        h('button', { type: 'button', role: 'switch', 'aria-checked': String(state[key]), 'aria-label': label, class: 'switch' + (state[key] ? ' on' : ''), disabled: !editable, onclick: () => { state[key] = !state[key]; render(); } }, h('span', null)))))));
  }
  render();
  const save = editable ? h('div', { class: 'sticky-foot' }, h('button', { class: 'btn primary block', onclick: async () => { const r = await run(() => api.setPerms(u.id, template, state), 'حُفظت الصلاحيات.'); if (r) ctx.refresh(); } }, 'حفظ الصلاحيات')) : null;
  const activeBtn = can(me, 'users.manage') && u.id !== me.id ? h('button', { class: 'btn ghost ' + (u.active ? 'danger-t' : ''), onclick: async () => {
    if (await confirmBox(u.active ? 'إيقاف الحساب' : 'تفعيل الحساب', u.active ? `سيخرج ${u.name} من كل الأجهزة فوراً، وتبقى مهامه وتقاريره محفوظة.` : `سيتمكن ${u.name} من الدخول مجدداً.`, u.active ? 'إيقاف' : 'تفعيل', u.active)) {
      const r = await run(() => api.setActive(u.id, !u.active), 'تم.'); if (r) ctx.refresh();
    } } }, u.active ? 'إيقاف الحساب' : 'تفعيل الحساب') : null;
  setView(root,
    h('div', { class: 'page-head' }, h('a', { class: 'icon-btn', href: '#/team', 'aria-label': 'رجوع' }, icon('back', 20)), avatar(u.name),
      h('div', { class: 'page-title grow' }, h('h1', null, u.name), h('p', { class: 'muted' }, u.title)), activeBtn),
    card(h('div', { class: 'row-between' }, h('h2', { class: 'small-h' }, 'قالب الصلاحيات'), customBadge), tplWrap,
      editable ? null : h('p', { class: 'small muted' }, 'لا تملك صلاحية تعديل الصلاحيات.')),
    groups, save);
}

/* ------------------------------ الأجهزة ------------------------------ */
export async function devices(root) {
  const [list, centers] = await Promise.all([api.devices(), api.centers()]);
  const cn = Object.fromEntries(centers.map((c) => [c.id, c]));
  const t = todayISO();
  setView(root, pageHead('الأجهزة المركّبة', 'كل جهاز عند كل مركز، مع الكفالة ومؤشر الصحة.'),
    h('div', { class: 'cards grid-auto' }, list.map((d) => card(
      h('div', { class: 'row-between' }, pill(d.type, 'b'), h('span', { class: 'health ' + (d.health < 70 ? 'low' : '') }, bdi(d.health), h('small', null, ' / 100'))),
      h('h2', null, h('bdi', { dir: 'ltr' }, `${d.brand} ${d.model}`)),
      h('p', { class: 'muted' }, cn[d.center] ? `${cn[d.center].name}، ${cn[d.center].city}` : ''),
      h('dl', { class: 'facts' },
        h('div', null, h('dt', null, 'الرقم التسلسلي'), h('dd', null, bdi(d.serial))),
        h('div', null, h('dt', null, 'التركيب'), h('dd', null, dateLabel(d.installed))),
        h('div', null, h('dt', null, 'الكفالة'), h('dd', null, d.warrantyEnd < t ? pill('منتهية', 'o') : dateLabel(d.warrantyEnd)))),
      d.helium ? h('p', { class: 'small muted' }, 'يحتاج متابعة مستوى الهيليوم بكل زيارة.') : null))));
}

/* ------------------------------ الإشعارات ------------------------------ */
export async function notifications(root, ctx) {
  const list = await api.notifications();
  const action = list.some((n) => !n.read) ? h('button', { class: 'btn ghost', onclick: async () => { await run(() => api.markAllRead()); ctx.refresh(); } }, 'تعليم الكل كمقروء') : null;
  setView(root, pageHead('الإشعارات', null, action),
    list.length ? h('div', { class: 'list' }, list.map((n) => h('div', { class: 'list-row' + (n.read ? '' : ' unread') }, icon('bell', 20),
      h('div', { class: 'grow' }, h('span', null, n.text), h('span', { class: 'small muted' }, relDay(n.at.slice(0, 10)), ' ', bdi(n.at.slice(11, 16))))))) : empty('لا توجد إشعارات.'));
}

/* ------------------------------ الإعدادات ------------------------------ */
export async function settings(root, ctx) {
  const me = ctx.me;
  const blocks = [];
  if (can(me, 'rate.set')) {
    const r = await api.rate();
    const input = h('input', { inputmode: 'decimal', dir: 'ltr', value: String((r.today && (r.today.approved || r.today.sell)) || ''), 'aria-label': 'السعر المعتمد' });
    blocks.push(card(h('div', { class: 'row-between' }, h('h2', null, 'سعر صرف اليوم'), pill(r.stale ? 'بانتظار الاعتماد' : 'معتمد', r.stale ? 'y' : '')),
      r.today ? h('dl', { class: 'facts' },
        h('div', null, h('dt', null, 'الليرة اليوم: شراء'), h('dd', null, bdi(r.today.buy))),
        h('div', null, h('dt', null, 'الليرة اليوم: مبيع'), h('dd', null, bdi(r.today.sell)))) : h('p', { class: 'muted' }, 'تعذّر جلب السعر من الليرة اليوم. أدخل السعر يدوياً.'),
      field('السعر المعتمد للنظام (ل.س لكل دولار)', input),
      h('button', { class: 'btn primary', onclick: async () => { const v = parseAmount(input.value); if (!(v > 0)) { toast('اكتب سعراً صحيحاً.', 'err'); return; } const ok = await run(() => api.approveRate(v), 'اعتُمد السعر.'); if (ok) ctx.refresh(); } }, 'اعتماد السعر'),
      h('p', { class: 'small muted' }, 'يظهر هذا السعر فقط عند إضافة مصروف بالدولار، ولا يظهر في الواجهة الرئيسية.')));
  }
  const pushStatus = h('p', { class: 'small muted' }, 'Notification' in window ? (Notification.permission === 'granted' ? 'الإشعارات مفعّلة على هذا الجهاز.' : 'الإشعارات غير مفعّلة على هذا الجهاز.') : 'هذا المتصفح لا يدعم الإشعارات. ثبّت التطبيق أولاً.');
  blocks.push(card(h('h2', null, 'الإشعارات'), pushStatus, h('div', { class: 'actions' },
    h('button', { class: 'btn primary', onclick: async () => {
      if (!('Notification' in window)) { toast('هذا المتصفح لا يدعم الإشعارات. على آيفون ثبّت التطبيق من «إضافة إلى الشاشة الرئيسية» أولاً.', 'err'); return; }
      const p = await Notification.requestPermission();
      toast(p === 'granted' ? 'فُعّلت الإشعارات.' : 'رُفض الإذن. فعّله من إعدادات المتصفح.', p === 'granted' ? 'ok' : 'err'); ctx.refresh();
    } }, 'تفعيل الإشعارات'),
    h('button', { class: 'btn ghost', onclick: async () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') { toast('فعّل الإشعارات أولاً.', 'err'); return; }
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) reg.showNotification('إشعار تجريبي من إيميكو', { body: 'الإشعارات تعمل على هذا الجهاز.', icon: 'icons/icon-192.png', lang: 'ar', dir: 'rtl' });
      else new Notification('إشعار تجريبي من إيميكو', { body: 'الإشعارات تعمل على هذا الجهاز.' });
    } }, 'إرسال إشعار تجريبي'))));
  if (can(me, 'activity.view')) {
    const [acts, users] = await Promise.all([api.activity(), userMap()]);
    blocks.push(card(h('h2', null, 'سجل النشاط'), h('div', { class: 'list' }, acts.slice(0, 30).map((a) => h('div', { class: 'list-row' },
      h('div', { class: 'grow' }, h('span', null, (users[a.who] ? users[a.who].name + ': ' : '') + a.what), h('span', { class: 'small muted' }, relDay(a.at.slice(0, 10)), ' ', bdi(a.at.slice(11, 16)))))))));
  }
  if (api.mode === 'demo') blocks.push(card(h('h2', null, 'النسخة التجريبية'), h('p', { class: 'muted' }, 'البيانات وهمية، وتعود لحالتها كل يوم تلقائياً.'),
    h('button', { class: 'btn ghost', onclick: async () => { if (await confirmBox('إعادة البيانات', 'ستعود كل بيانات النسخة التجريبية لحالتها الأصلية.', 'إعادة')) { await api.resetDemo(); location.hash = '#/login'; location.reload(); } } }, 'إعادة البيانات الآن')));
  setView(root, pageHead('الإعدادات'), blocks);
}
