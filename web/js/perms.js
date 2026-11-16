// الصلاحيات: المفاتيح، المجموعات، والقوالب. نفس المفاتيح موجودة في قاعدة البيانات (supabase/schema.sql).
'use strict';

export const PERM_GROUPS = [
  { title: 'المهام', items: [
    ['tasks.view_team', 'مشاهدة مهام الفريق', 'كل مهام الموظفين، لا مهامه فقط.'],
    ['tasks.assign', 'إسناد مهام لغيره', 'إنشاء مشاريع ومهام وتذكيرات للآخرين.'],
    ['tasks.edit', 'تعديل وحذف المهام', 'تعديل أي مهمة أو إلغاؤها.'],
  ]},
  { title: 'المصاريف', items: [
    ['expenses.add', 'إضافة مصاريف', 'رحلات العمل والمصاريف الميدانية.'],
    ['expenses.usd', 'الإدخال بالدولار', 'يُحوَّل إلى الليرة بسعر اليوم.'],
    ['expenses.approve', 'الموافقة على المصاريف', 'قبول الطلبات أو رفضها أو إعادتها.'],
    ['expenses.pay', 'دفع المصاريف', 'تسجيل دفع المصاريف الموافق عليها.'],
    ['expenses.view_all', 'مشاهدة مصاريف الكل', 'كل رحلات ومصاريف الموظفين.'],
    ['rate.set', 'تحديد سعر الصرف', 'اعتماد سعر الدولار اليومي.'],
  ]},
  { title: 'الملفات والصيانة', items: [
    ['files.upload', 'رفع ملفات وصور', 'صور الوصولات والزيارات والمواد.'],
    ['devices.view', 'مشاهدة الأجهزة', 'الأجهزة المركّبة وتاريخها.'],
    ['visits.write', 'كتابة تقرير زيارة', 'تقرير الصيانة مع التوقيع.'],
    ['tickets.close', 'إغلاق بلاغ عطل', 'إنهاء البلاغ بعد الإصلاح.'],
    ['contracts.edit', 'تعديل عقود الصيانة', 'إضافة العقود وتعديلها.'],
  ]},
  { title: 'العملاء والمبيعات', items: [
    ['clients.view', 'مشاهدة العملاء', 'بيانات المراكز وأرقام التواصل.'],
    ['clients.export', 'تصدير قائمة العملاء', 'تنزيل البيانات خارج النظام.'],
    ['quotes.cost', 'رؤية سعر التكلفة والربح', 'معلومة حساسة جداً.'],
  ]},
  { title: 'الإدارة', items: [
    ['finance.view', 'المالية والرواتب', 'الرواتب والمبيعات والدفعات.'],
    ['users.manage', 'إدارة المستخدمين', 'إنشاء الحسابات وإيقافها.'],
    ['perms.edit', 'تعديل الصلاحيات', 'تغيير صلاحيات الموظفين.'],
    ['activity.view', 'سجل النشاط', 'من فعل ماذا ومتى.'],
    ['notify.broadcast', 'إشعار عام', 'إرسال إشعار لكل الشركة.'],
  ]},
];

export const ALL_PERMS = PERM_GROUPS.flatMap((g) => g.items.map((i) => i[0]));

const base = ['expenses.add', 'files.upload', 'devices.view'];
export const TEMPLATES = {
  manager: { label: 'مدير', perms: ALL_PERMS.slice() },
  coordinator: { label: 'منسقة', perms: ['tasks.view_team', 'tasks.assign', 'expenses.approve', 'expenses.view_all', 'rate.set', 'files.upload', 'devices.view', 'clients.view', 'activity.view'] },
  senior: { label: 'مهندس أول', perms: [...base, 'expenses.usd', 'tasks.view_team', 'tasks.assign', 'visits.write', 'tickets.close'] },
  engineer: { label: 'مهندس', perms: [...base, 'expenses.usd', 'visits.write'] },
  sales: { label: 'مبيعات', perms: [...base, 'clients.view'] },
  accountant: { label: 'محاسب', perms: ['expenses.pay', 'expenses.view_all', 'finance.view', 'files.upload'] },
  basic: { label: 'مهام فقط', perms: [] },
};

export function can(user, key) {
  if (!user || !user.active) return false;
  const p = user.perms && user.perms[key];
  if (!p) return false;
  if (p.expires && p.expires < new Date().toISOString().slice(0, 10)) return false;
  return true;
}
