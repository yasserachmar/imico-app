// إعدادات النظام. المفتاح المنشور (sb_publishable_*) هو الوحيد المسموح هنا. لا تضع أي مفتاح سري.
'use strict';

export const CONFIG = {
  // 'demo' = نسخة تجريبية ببيانات وهمية محفوظة في المتصفح وتعود لحالتها كل يوم.
  // 'live' = مربوط بـ Supabase.
  mode: 'live',
supabaseUrl: 'https://eoootauqudqklskyhktw.supabase.co',
supabaseKey: 'sb_publishable_BKxyHSL443Su9apUVIrnDQ_SCVFx4in',
vapidPublicKey: 'BC_Vs318HkBIMgt5L5QEUdou5XT_cewdqAcol-A8IfGMjMIpit6NUPdj5-pwfCl1AwEHphXgw2LKbiQTsma1lW8',
};
