// عناصر واجهة مشتركة: رسائل، نوافذ تأكيد، بطاقات، أزرار.
'use strict';
import { h, clear } from './util.js';
import { icon } from './icons.js';

export function toast(msg, kind = 'ok') {
  let box = document.getElementById('toasts');
  if (!box) { box = h('div', { id: 'toasts', class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
  const t = h('div', { class: 'toast ' + kind }, msg);
  box.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 600); }, 3800);
}

export function errorMessage(e) {
  return (e && e.userMessage) || 'حدث خطأ غير متوقع. حاول مجدداً.';
}

export async function run(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
  catch (e) { console.warn(e); toast(errorMessage(e), 'err'); return undefined; }
}

export function modal(title, body, actions) {
  const dlg = h('dialog', { class: 'modal', 'aria-label': title },
    h('form', { method: 'dialog', class: 'modal-box' },
      h('div', { class: 'modal-head' }, h('h2', null, title),
        h('button', { class: 'icon-btn', value: 'cancel', 'aria-label': 'إغلاق' }, icon('x', 20))),
      h('div', { class: 'modal-body' }, body),
      actions ? h('div', { class: 'modal-actions' }, actions) : null));
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
  return dlg;
}

export function confirmBox(title, text, okLabel = 'تأكيد', danger = false) {
  return new Promise((resolve) => {
    let ok = false;
    const dlg = modal(title, h('p', null, text), [
      h('button', { class: 'btn ghost', value: 'cancel' }, 'إلغاء'),
      h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), value: 'ok', onclick: () => { ok = true; } }, okLabel),
    ]);
    dlg.addEventListener('close', () => resolve(ok));
  });
}

export function promptBox(title, label, okLabel = 'إرسال') {
  return new Promise((resolve) => {
    const input = h('textarea', { rows: 3, maxlength: 200, required: true, id: 'prompt-input' });
    let val = null;
    const dlg = modal(title, h('label', { class: 'field' }, h('span', null, label), input), [
      h('button', { class: 'btn ghost', value: 'cancel', formnovalidate: true }, 'إلغاء'),
      h('button', { class: 'btn primary', value: 'ok', onclick: () => { val = input.value.trim(); } }, okLabel),
    ]);
    dlg.addEventListener('close', () => resolve(val || null));
  });
}

export function pageHead(title, sub, action) {
  return h('div', { class: 'page-head' },
    h('div', { class: 'page-title' }, h('h1', null, title), sub ? h('p', { class: 'muted' }, sub) : null),
    action || null);
}

export function empty(text) {
  return h('div', { class: 'empty' }, h('img', { src: 'assets/mri-line.svg', alt: '', width: 160, height: 92 }), h('p', null, text));
}

export function pill(text, kind = '') { return h('span', { class: 'pill ' + kind }, text); }

export function card(...children) { return h('section', { class: 'card' }, ...children); }

export function setView(root, ...nodes) { clear(root); root.append(...nodes.flat(Infinity).filter((n) => n !== null && n !== undefined && n !== false)); root.focus({ preventScroll: true }); }
