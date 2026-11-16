// الهيكل العام: تسجيل الدخول، القائمة، التنقل بين الشاشات.
'use strict';
import { h, clear } from './util.js';
import { icon } from './icons.js';
import { api } from './api.js';
import { can, TEMPLATES } from './perms.js';
import { toast, errorMessage } from './ui.js';
import * as V from './views.js';

const NAV = [
  { href: '#/home', label: 'الرئيسية', icon: 'home', view: V.home, mobile: true },
  { href: '#/tasks', label: 'مهامي', icon: 'task', view: V.myTasks, mobile: true },
  { href: '#/projects', label: 'المشاريع والمهام', short: 'المشاريع', icon: 'folder', view: V.projectsView, mobile: true },
  { href: '#/expenses', label: 'مصاريفي', icon: 'receipt', view: V.expenses, mobile: true },
  { href: '#/approvals', label: 'طلبات المصاريف', short: 'الطلبات', icon: 'money', view: V.approvals, need: (u) => can(u, 'expenses.approve') || can(u, 'expenses.pay') || can(u, 'expenses.view_all') },
  { href: '#/team', label: 'الفريق والصلاحيات', short: 'الفريق', icon: 'users', view: V.team, need: (u) => can(u, 'tasks.view_team') || can(u, 'perms.edit') },
  { href: '#/devices', label: 'الأجهزة', icon: 'device', view: V.devices, need: (u) => can(u, 'devices.view') },
  { href: '#/notifications', label: 'الإشعارات', icon: 'bell', view: V.notifications },
  { href: '#/settings', label: 'الإعدادات', icon: 'settings', view: V.settings },
];

let me = null;
const app = document.getElementById('app');

function allowed(item) { return !item.need || item.need(me); }

function parseHash() {
  const raw = (location.hash || '#/home').slice(2);
  const [path, qs] = raw.split('?');
  const parts = path.split('/').map(decodeURIComponent);
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  return { route: parts[0] || 'home', params: parts.slice(1), query };
}

function layout() {
  const items = NAV.filter(allowed);
  const side = h('nav', { class: 'side', 'aria-label': 'القائمة الرئيسية' },
    h('a', { href: '#/home', class: 'brand', 'aria-label': 'إيميكو، الرئيسية' }, h('img', { src: 'assets/logo.svg', alt: 'IMICO', width: 150, height: 60 })),
    h('div', { class: 'side-links' }, items.map((i) => h('a', { href: i.href, class: 'side-link', dataset: { r: i.href } }, icon(i.icon, 20), h('span', null, i.label)))),
    h('div', { class: 'side-me' }, h('span', { class: 'avatar' }, (me.name.replace(/^(م\.|أ\.)\s*/, '') || '؟').charAt(0)),
      h('div', { class: 'grow' }, h('span', { class: 'strong small' }, me.name), h('span', { class: 'muted small' }, me.title)),
      h('button', { class: 'icon-btn', 'aria-label': 'تسجيل الخروج', onclick: logout }, icon('logout', 20))));
  const top = h('header', { class: 'top' },
    h('a', { href: '#/home', 'aria-label': 'إيميكو، الرئيسية' }, h('img', { src: 'assets/logo.svg', alt: 'IMICO', width: 90, height: 36 })),
    h('a', { href: '#/notifications', class: 'icon-btn', 'aria-label': 'الإشعارات' }, icon('bell', 22), h('span', { class: 'dot', id: 'notif-dot', hidden: true })));
  const mobileItems = items.filter((i) => i.mobile).slice(0, 4);
  const bottom = h('nav', { class: 'bottom', 'aria-label': 'التنقل السريع' },
    mobileItems.map((i) => h('a', { href: i.href, dataset: { r: i.href } }, icon(i.icon, 22), h('span', null, i.short || i.label))),
    h('a', { href: '#/more', dataset: { r: '#/more' } }, icon('menu', 22), h('span', null, 'المزيد')));
  const main = h('main', { id: 'view', class: 'view', tabindex: '-1' });
  const band = api.mode === 'demo' ? h('div', { class: 'demo-band', role: 'note' }, 'نسخة تجريبية ببيانات وهمية. تعود لحالتها كل يوم.') : null;
  clear(app).append(h('div', { class: 'shell' }, side, h('div', { class: 'body' }, band || '', top, main, bottom)));
}

function moreView(root) {
  const items = NAV.filter(allowed);
  clear(root).append(h('div', { class: 'page-head' }, h('h1', null, 'المزيد')),
    h('div', { class: 'list' }, items.map((i) => h('a', { class: 'list-row', href: i.href }, icon(i.icon, 22), h('span', { class: 'grow strong' }, i.label), icon('back', 18))),
      h('button', { class: 'list-row', onclick: logout }, icon('logout', 22), h('span', { class: 'grow strong' }, 'تسجيل الخروج'))));
}

async function render() {
  if (!me) return loginView();
  const { route, params, query } = parseHash();
  if (route === 'login') { location.hash = '#/home'; return; }
  if (!document.getElementById('view')) layout();
  const root = document.getElementById('view');
  document.querySelectorAll('[data-r]').forEach((a) => a.classList.toggle('on', a.dataset.r === '#/' + route));
  const ctx = { me, params, query, refresh: render };
  if (route === 'more') { moreView(root); return; }
  const item = NAV.find((i) => i.href === '#/' + route);
  if (!item || !allowed(item)) { location.hash = '#/home'; return; }
  try { await item.view(root, ctx); }
  catch (e) { console.warn(e); clear(root).append(h('div', { class: 'empty' }, h('p', null, errorMessage(e)))); }
  updateDot();
  window.scrollTo({ top: 0 });
}

async function updateDot() {
  try { const n = await api.notifications(); const d = document.getElementById('notif-dot'); if (d) d.hidden = !n.some((x) => !x.read); } catch (e) { /* ignore */ }
}

async function logout() {
  await api.signOut(); me = null; location.hash = '#/login'; render();
}

async function loginView() {
  clear(app);
  const box = h('div', { class: 'login-box' }, h('img', { src: 'assets/logo.svg', alt: 'IMICO', width: 200, height: 80, class: 'login-logo' }),
    h('h1', null, 'تسجيل الدخول'), h('p', { class: 'muted' }, 'نظام إيميكو لإدارة العمل'));
  if (api.mode === 'demo') {
    box.append(h('p', { class: 'note' }, 'نسخة تجريبية: اختر حساباً لتجربة النظام بصلاحياته.'));
    const users = await api.demoUsers();
    box.append(h('div', { class: 'demo-users' }, users.map((u) => h('button', { class: 'demo-user', onclick: async () => {
      try { me = await api.signInDemo(u.id); location.hash = '#/home'; render(); } catch (e) { toast(errorMessage(e), 'err'); }
    } }, h('span', { class: 'strong' }, u.name), h('span', { class: 'small muted' }, `${u.title} · ${TEMPLATES[u.template].label}`)))));
  } else {
    const email = h('input', { type: 'email', required: true, autocomplete: 'username', dir: 'ltr', id: 'email' });
    const pass = h('input', { type: 'password', required: true, autocomplete: 'current-password', dir: 'ltr', id: 'password', minlength: 10 });
    const msg = h('p', { class: 'form-err', role: 'alert' });
    const form = h('form', { class: 'form' },
      h('label', { class: 'field' }, h('span', null, 'الإيميل'), email),
      h('label', { class: 'field' }, h('span', null, 'كلمة السر'), pass),
      // فخ للروبوتات: حقل مخفي لا يملؤه الإنسان
      h('input', { class: 'hp', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' }),
      msg, h('button', { class: 'btn primary block', type: 'submit' }, 'دخول'),
      h('a', { href: '#/forgot', class: 'small' }, 'نسيت كلمة السر؟'));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); msg.textContent = '';
      if (form.querySelector('.hp').value) return;
      try { me = await api.signIn(email.value.trim(), pass.value); if (!me) throw Object.assign(new Error(), { userMessage: 'الحساب غير مفعّل. تواصل مع المدير.' }); location.hash = '#/home'; render(); }
      catch (err) { msg.textContent = errorMessage(err); }
    });
    box.append(form);
  }
  app.append(h('div', { class: 'login' }, box, h('img', { src: 'assets/mri-line.svg', alt: '', class: 'login-mri', width: 520, height: 300 })));
}

window.addEventListener('hashchange', render);

(async function start() {
  try { me = await api.me(); } catch (e) { me = null; }
  if (me && !me.active) me = null;
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
