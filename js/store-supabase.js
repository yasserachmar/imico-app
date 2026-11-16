// الربط مع Supabase بدون مكتبات: Auth + PostgREST + RPC.
// كل العمليات الحساسة (المبالغ، سعر الصرف، الموافقات، الصلاحيات) تتم داخل دوال قاعدة البيانات (RPC) وتحميها RLS.
'use strict';
import { CONFIG } from './config.js';
import { firstName } from './util.js';

const SKEY = 'imico-session';
let session = null;

function friendly(status, body) {
  const msg = (body && (body.message || body.error_description || body.msg)) || '';
  // رسائل الخطأ القادمة من دوالنا تبدأ بـ "ERR:" ونصها عربي جاهز للعرض
  if (msg.startsWith('ERR:')) return msg.slice(4).trim();
  if (status === 400 && /invalid login/i.test(msg)) return 'الإيميل أو كلمة السر غير صحيحة.';
  if (status === 401 || status === 403) return 'انتهت الجلسة أو ليس لديك صلاحية. سجّل الدخول من جديد.';
  if (status === 429) return 'محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.';
  if (status >= 500) return 'حدث خطأ في الخادم. حاول بعد قليل.';
  return 'تعذّر تنفيذ العملية. تحقق من البيانات وحاول مجدداً.';
}

async function call(path, opts = {}) {
  let res;
  try {
    res = await fetch(CONFIG.supabaseUrl + path, {
      ...opts,
      headers: {
        apikey: CONFIG.supabaseKey,
        'Content-Type': 'application/json',
        ...(session ? { Authorization: 'Bearer ' + session.access_token } : {}),
        ...(opts.headers || {}),
      },
    });
  } catch (e) {
    const err = new Error('لا يوجد اتصال بالإنترنت أو الخادم غير متاح.'); err.userMessage = err.message; throw err;
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401 && session && path.startsWith('/rest/') && !opts._retried) {
      if (await refresh()) return call(path, { ...opts, _retried: true });
    }
    const err = new Error(friendly(res.status, body)); err.userMessage = err.message; err.status = res.status; throw err;
  }
  return body;
}

function saveSession(s) {
  session = s;
  try {
    if (s) localStorage.setItem(SKEY, JSON.stringify({ refresh_token: s.refresh_token }));
    else localStorage.removeItem(SKEY);
  } catch (e) { /* ignore */ }
}

async function refresh() {
  let rt = session && session.refresh_token;
  if (!rt) { try { rt = JSON.parse(localStorage.getItem(SKEY) || 'null')?.refresh_token; } catch (e) { rt = null; } }
  if (!rt) return false;
  try {
    const s = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: rt }) });
    saveSession(s); return true;
  } catch (e) { saveSession(null); return false; }
}

const rpc = (fn, args = {}) => call('/rest/v1/rpc/' + fn, { method: 'POST', body: JSON.stringify(args) });
const sel = (q) => call('/rest/v1/' + q, { headers: { Accept: 'application/json' } });

const mapUser = (r) => ({ id: r.id, name: r.name, title: r.title, email: r.email, template: r.template, city: r.city, active: r.active, custom: r.custom,
  perms: Object.fromEntries((r.perms || []).map((p) => [p.perm, { on: true, expires: p.expires_on }])) });
const mapTask = (r) => ({ id: r.id, project: r.project_id, title: r.title, assignee: r.assignee_id, freq: r.freq, due: r.due_on, time: r.time_of_day, done: r.done, urgent: r.urgent, note: r.note });
const mapProject = (r) => ({ id: r.id, type: r.type, title: r.title, center: r.center_id, owner: r.owner_id, due: r.due_on, status: r.status });
const mapItem = (r) => ({ id: r.id, kind: r.kind, note: r.note, syp: Number(r.syp), cur: r.cur, orig: Number(r.orig), rate: r.rate === null ? null : Number(r.rate), date: r.spent_on, receipt: !!r.receipt_path });
const mapTrip = (r) => ({ id: r.id, user: r.user_id, title: r.title, from: r.from_on, to: r.to_on, project: r.project_id, advance: Number(r.advance), status: r.status, decisionNote: r.decision_note || '', items: (r.trip_items || []).map(mapItem) });
const PROFILE_SEL = 'profiles?select=id,name,title,email,template,city,active,custom,perms:user_perms(perm,expires_on)';

export const liveStore = {
  mode: 'live',
  async demoUsers() { return []; },
  async signInDemo() { throw new Error('غير متاح'); },
  async signIn(email, password) {
    const s = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
    saveSession(s); return this.me();
  },
  async signOut() { try { await call('/auth/v1/logout', { method: 'POST' }); } catch (e) { /* ignore */ } saveSession(null); },
  async me() {
    if (!session && !(await refresh())) return null;
    const rows = await sel(PROFILE_SEL + '&id=eq.' + encodeURIComponent(session.user.id));
    return rows[0] ? mapUser(rows[0]) : null;
  },
  async users() { return (await sel(PROFILE_SEL + '&order=name')).map(mapUser); },
  async user(id) { return (await sel(PROFILE_SEL + '&id=eq.' + encodeURIComponent(id))).map(mapUser)[0]; },
  async centers() { return sel('centers?select=*&order=name'); },
  async devices() {
    return (await sel('devices?select=*&order=installed_on.desc')).map((r) => ({ id: r.id, center: r.center_id, type: r.type, model: r.model, serial: r.serial, brand: r.brand, installed: r.installed_on, warrantyEnd: r.warranty_end, helium: r.helium, health: r.health }));
  },
  async projects() { return (await sel('projects?select=*&order=due_on')).map(mapProject); },
  async tasks(f = {}) {
    let q = 'tasks?select=*&order=due_on';
    if (f.assignee) q += '&assignee_id=eq.' + encodeURIComponent(f.assignee);
    if (f.project) q += '&project_id=eq.' + encodeURIComponent(f.project);
    return (await sel(q)).map(mapTask);
  },
  async toggleTask(id) { return mapTask(await rpc('toggle_task', { p_task: id })); },
  async createTask(d) { return mapTask(await rpc('create_task', { p_project: d.project || null, p_title: d.title, p_assignee: d.assignee, p_freq: d.freq, p_due: d.due })); },
  async createProject(d) { return mapProject(await rpc('create_project', { p_type: d.type, p_title: d.title, p_center: d.center || null, p_owner: d.owner || null, p_due: d.due || null })); },
  async rate() { const r = await rpc('rate_status'); return { today: r.today, effective: r.effective === null ? null : Number(r.effective), stale: r.stale }; },
  async approveRate(v) { await rpc('approve_rate', { p_value: Number(v) }); return this.rate(); },
  async trips(scope = 'mine') {
    let q = 'trips?select=*,trip_items(*)&order=from_on.desc';
    if (scope === 'mine') q += '&user_id=eq.' + encodeURIComponent(session.user.id);
    return (await sel(q)).map(mapTrip);
  },
  async trip(id) { const r = await sel('trips?select=*,trip_items(*)&id=eq.' + encodeURIComponent(id)); if (!r[0]) { const e = new Error('الرحلة غير موجودة.'); e.userMessage = e.message; throw e; } return mapTrip(r[0]); },
  async createTrip(d) { return mapTrip(await rpc('create_trip', { p_title: d.title, p_from: d.from, p_to: d.to, p_project: d.project || null })); },
  async addItem(tripId, it) { return mapItem(await rpc('add_trip_item', { p_trip: tripId, p_kind: it.kind, p_note: it.note || '', p_amount: Number(it.amount), p_cur: it.cur, p_receipt: it.receiptPath || null })); },
  async removeItem(tripId, itemId) { await rpc('remove_trip_item', { p_item: itemId }); },
  async submitTrip(id) { return rpc('submit_trip', { p_trip: id }); },
  async decideTrip(id, decision, note = '') { return rpc('decide_trip', { p_trip: id, p_decision: decision, p_note: note }); },
  async payTrip(id) { return rpc('pay_trip', { p_trip: id }); },
  async setPerms(userId, template, perms) { return rpc('set_perms', { p_user: userId, p_template: template, p_perms: Object.keys(perms).filter((k) => perms[k]) }); },
  async setActive(userId, active) { return rpc('set_active', { p_user: userId, p_active: !!active }); },
  async notifications() { return (await sel('notifications?select=*&order=created_at.desc&limit=100')).map((n) => ({ id: n.id, text: n.text, at: n.created_at.slice(0, 16), read: n.read })); },
  async markAllRead() { return rpc('mark_all_read'); },
  async activity() { return (await sel('activity_log?select=*&order=at.desc&limit=200')).map((a) => ({ at: a.at.slice(0, 16), who: a.actor, what: a.what })); },
  async resetDemo() {},
  name: (u) => firstName(u && u.name),
};
