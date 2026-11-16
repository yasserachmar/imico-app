// إعدادات النظام. المفتاح المنشور (sb_publishable_*) هو الوحيد المسموح هنا. لا تضع أي مفتاح سري.
'use strict';

export const CONFIG = {
  // 'demo' = نسخة تجريبية ببيانات وهمية محفوظة في المتصفح وتعود لحالتها كل يوم.
  // 'live' = مربوط بـ Supabase.
  mode: 'demo',
  supabaseUrl: '',          // مثال: https://xxxx.supabase.co
  supabaseKey: '',          // sb_publishable_... فقط
  vapidPublicKey: '',       // المفتاح العام للإشعارات (ليس سرياً)
  appVersion: '1',
};
