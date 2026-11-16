// Service Worker: ارفع رقم النسخة في كل تحديث، وإلا يبقى المستخدم على النسخة القديمة.
'use strict';
const CACHE = 'imico-shell-v2';
const SHELL = [
  './', 'index.html', 'offline.html', 'manifest.webmanifest', 'css/app.css?v=2', 'js/app.js?v=2', 'fonts/Cairo-Regular.ttf', 'fonts/Cairo-Bold.ttf',
  'js/util.js', 'js/icons.js', 'js/perms.js', 'js/config.js', 'js/api.js', 'js/ui.js', 'js/views.js',
  'js/store-demo.js', 'js/store-supabase.js', 'assets/logo.svg', 'assets/mri-line.svg',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // طلبات Supabase لا تُخزَّن
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('index.html').then((r) => r || caches.match('offline.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});

// إشعارات Web Push (VAPID)
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { data = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(data.title || 'إيميكو', {
    body: data.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', lang: 'ar', dir: 'rtl', data: { url: data.url || './#/notifications' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate(e.notification.data.url); return c.focus(); } }
    return self.clients.openWindow(e.notification.data.url);
  }));
});
