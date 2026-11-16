-- أول حساب مدير. الخطوات:
-- 1) Authentication > Users > Add user > Create new user: إيميل المدير وكلمة سر قوية (يكتبها صاحبها).
-- 2) انسخ الـ UID من جدول المستخدمين وضعه مكان USER_UID أدناه، ثم شغّل الملف.
-- بعدها المدير ينشئ باقي الحسابات ويعطيها الصلاحيات من داخل النظام.

insert into profiles(id, name, title, email, template, city)
values ('82264d3e-443b-4e19-bb79-8f148579601e', 'أنس شربجي', 'المدير العام', 'yachmar2@gmail.com', 'manager', 'دمشق');

insert into user_perms(user_id, perm)
select '82264d3e-443b-4e19-bb79-8f148579601e', unnest(array['tasks.view_team','tasks.assign','tasks.edit','expenses.add','expenses.usd','expenses.approve','expenses.pay','expenses.view_all','rate.set','files.upload','devices.view','visits.write','tickets.close','contracts.edit','clients.view','clients.export','quotes.cost','finance.view','users.manage','perms.edit','activity.view','notify.broadcast']);
