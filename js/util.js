// أدوات عامة: بناء العناصر بأمان (بدون innerHTML لبيانات المستخدم)، تنسيق الأرقام والتواريخ.
'use strict';

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// رقم أو نص لاتيني معزول داخل نص عربي
export function bdi(value) {
  return h('bdi', { dir: 'ltr' }, String(value));
}

export function fmt(n) {
  return Math.round(Number(n) || 0).toLocaleString('en-US');
}

export function money(n) {
  return h('span', { class: 'money' }, bdi(fmt(n)), ' ل.س');
}

export const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
export const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function todayISO(d = new Date()) {
  const z = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return todayISO(d);
}

export function dateLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function relDay(iso) {
  const t = todayISO();
  if (iso === t) return 'اليوم';
  if (iso === addDays(t, 1)) return 'غداً';
  if (iso === addDays(t, -1)) return 'أمس';
  return shortDate(iso);
}

export function greeting(name) {
  const hr = new Date().getHours();
  return (hr < 12 ? 'صباح الخير، ' : 'مساء الخير، ') + name;
}

export function firstName(full) {
  return String(full || '').replace(/^(م\.|أ\.|د\.)\s*/, '').split(' ')[0];
}

export function initial(full) {
  return firstName(full).charAt(0) || '؟';
}

export function uid(prefix = 'id') {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return prefix + '_' + Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

// تحويل أي رقم عربي أو فارسي لأرقام إنجليزية، وإزالة الفواصل
export function parseAmount(s) {
  const map = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9, '٫': '.' };
  const clean = String(s || '').replace(/[٠-٩٫]/g, (c) => map[c]).replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return NaN;
  return Number(clean);
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}
