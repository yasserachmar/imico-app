-- =====================================================================
-- نظام إيميكو: قاعدة البيانات + RLS + دوال العمليات الحساسة
-- يُشغَّل مرة واحدة من Supabase > SQL Editor.
-- ملاحظة: هذا الملف خاص. لا يُرفع على ريبو عام.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- الجداول ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  title text not null default '',
  email text not null,
  template text not null default 'basic' check (template in ('manager','coordinator','senior','engineer','sales','accountant','basic')),
  city text not null default '',
  active boolean not null default true,
  custom boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists user_perms (
  user_id uuid not null references profiles(id) on delete cascade,
  perm text not null check (perm in ('tasks.view_team','tasks.assign','tasks.edit','expenses.add','expenses.usd','expenses.approve','expenses.pay','expenses.view_all','rate.set','files.upload','devices.view','visits.write','tickets.close','contracts.edit','clients.view','clients.export','quotes.cost','finance.view','users.manage','perms.edit','activity.view','notify.broadcast')),
  expires_on date,
  primary key (user_id, perm)
);

create table if not exists centers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  city text not null default '',
  phone text not null default ''
);

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references centers(id),
  type text not null check (type in ('MRI','CT','حاقن','DR','ماموغرافي','أخرى')),
  brand text not null default 'ANKE',
  model text not null,
  serial text not null unique,
  installed_on date,
  warranty_end date,
  helium boolean not null default false,
  health int not null default 100 check (health between 0 and 100)
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'مشروع',
  title text not null check (char_length(title) between 3 and 140),
  center_id uuid references centers(id),
  owner_id uuid not null references profiles(id),
  due_on date,
  status text not null default 'active' check (status in ('active','done','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 140),
  assignee_id uuid not null references profiles(id),
  freq text not null check (freq in ('daily','weekly','monthly','once')),
  due_on date not null default current_date,
  time_of_day text check (time_of_day ~ '^[0-2][0-9]:[0-5][0-9]$'),
  done boolean not null default false,
  urgent boolean not null default false,
  note text not null default '',
  created_by uuid references profiles(id),
  next_created boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists tasks_assignee_due on tasks(assignee_id, due_on);

create table if not exists rates (
  day date primary key,
  buy numeric(14,2),
  sell numeric(14,2),
  approved numeric(14,2) check (approved is null or approved > 0),
  approved_by uuid references profiles(id),
  approved_at timestamptz
);

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  title text not null check (char_length(title) between 3 and 100),
  from_on date not null,
  to_on date not null check (to_on >= from_on),
  project_id uuid references projects(id),
  advance numeric(14,0) not null default 0 check (advance >= 0),
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected','returned','paid')),
  decision_note text not null default '',
  decided_by uuid references profiles(id),
  paid_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  kind text not null check (kind in ('مواصلات','طعام','فندق','قطع ومواد','غير ذلك')),
  note text not null default '' check (char_length(note) <= 120),
  syp numeric(14,0) not null check (syp > 0),
  cur text not null check (cur in ('SYP','USD')),
  orig numeric(14,2) not null check (orig > 0),
  rate numeric(14,2),
  spent_on date not null default current_date,
  receipt_path text
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  url text not null default './#/notifications',
  read boolean not null default false,
  pushed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notif_user on notifications(user_id, created_at desc);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table if not exists activity_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid references profiles(id),
  what text not null
);

-- ---------- دوال مساعدة ----------
create or replace function has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_perms up join profiles pr on pr.id = up.user_id
    where up.user_id = auth.uid() and up.perm = p and pr.active
      and (up.expires_on is null or up.expires_on >= current_date)
  );
$$;

create or replace function is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select active from profiles where id = auth.uid()), false);
$$;

create or replace function fail(msg text) returns void language plpgsql as $$
begin raise exception 'ERR: %', msg using errcode = 'P0001'; end; $$;

create or replace function log_act(msg text) returns void
language sql security definer set search_path = public as $$
  insert into activity_log(actor, what) values (auth.uid(), msg);
$$;

create or replace function notify_user(uid uuid, msg text, link text default './#/notifications') returns void
language sql security definer set search_path = public as $$
  insert into notifications(user_id, text, url) values (uid, msg, link);
$$;

create or replace function effective_rate() returns numeric
language sql stable security definer set search_path = public as $$
  select approved from rates where approved is not null order by day desc limit 1;
$$;

-- ---------- RLS ----------
alter table profiles enable row level security;
alter table user_perms enable row level security;
alter table centers enable row level security;
alter table devices enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table rates enable row level security;
alter table trips enable row level security;
alter table trip_items enable row level security;
alter table notifications enable row level security;
alter table push_subscriptions enable row level security;
alter table activity_log enable row level security;

revoke all on all tables in schema public from anon;

-- القراءة فقط عبر السياسات. كل الكتابة الحساسة عبر الدوال أدناه (security definer).
create policy profiles_read on profiles for select to authenticated using (is_active());
create policy perms_read on user_perms for select to authenticated using (user_id = auth.uid() or has_perm('perms.edit') or has_perm('users.manage'));
create policy centers_read on centers for select to authenticated using (is_active());
create policy centers_write on centers for all to authenticated using (has_perm('contracts.edit') or has_perm('clients.view')) with check (has_perm('contracts.edit'));
create policy devices_read on devices for select to authenticated using (has_perm('devices.view'));
create policy devices_write on devices for all to authenticated using (has_perm('contracts.edit')) with check (has_perm('contracts.edit'));
create policy projects_read on projects for select to authenticated using (
  has_perm('tasks.view_team') or owner_id = auth.uid() or exists (select 1 from tasks t where t.project_id = projects.id and t.assignee_id = auth.uid()));
create policy tasks_read on tasks for select to authenticated using (has_perm('tasks.view_team') or assignee_id = auth.uid());
create policy rates_read on rates for select to authenticated using (is_active());
create policy trips_read on trips for select to authenticated using (
  user_id = auth.uid() or has_perm('expenses.view_all') or has_perm('expenses.approve') or has_perm('expenses.pay'));
create policy items_read on trip_items for select to authenticated using (exists (select 1 from trips t where t.id = trip_items.trip_id));
create policy notif_read on notifications for select to authenticated using (user_id = auth.uid());
create policy push_own on push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy activity_read on activity_log for select to authenticated using (has_perm('activity.view'));

grant select on all tables in schema public to authenticated;
grant insert, delete on push_subscriptions to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ---------- العمليات (RPC) ----------
create or replace function toggle_task(p_task uuid) returns tasks
language plpgsql security definer set search_path = public as $$
declare t tasks;
begin
  select * into t from tasks where id = p_task;
  if not found then perform fail('المهمة غير موجودة.'); end if;
  if t.assignee_id <> auth.uid() and not has_perm('tasks.edit') and not has_perm('tasks.assign') then perform fail('لا يمكنك تعديل مهمة غيرك.'); end if;
  update tasks set done = not done where id = p_task returning * into t;
  return t;
end; $$;

create or replace function create_task(p_project uuid, p_title text, p_assignee uuid, p_freq text, p_due date) returns tasks
language plpgsql security definer set search_path = public as $$
declare t tasks;
begin
  if not is_active() then perform fail('الحساب غير مفعّل.'); end if;
  if p_assignee <> auth.uid() and not has_perm('tasks.assign') then perform fail('ليس لديك صلاحية إسناد مهام لغيرك.'); end if;
  if char_length(trim(coalesce(p_title,''))) not between 3 and 140 then perform fail('اكتب عنوان المهمة (من 3 إلى 140 حرفاً).'); end if;
  insert into tasks(project_id, title, assignee_id, freq, due_on, created_by)
    values (p_project, trim(p_title), p_assignee, p_freq, coalesce(p_due, current_date), auth.uid()) returning * into t;
  if p_assignee <> auth.uid() then perform notify_user(p_assignee, 'مهمة جديدة: ' || t.title, './#/tasks'); end if;
  perform log_act('أنشأ مهمة: ' || t.title);
  return t;
end; $$;

create or replace function create_project(p_type text, p_title text, p_center uuid, p_owner uuid, p_due date) returns projects
language plpgsql security definer set search_path = public as $$
declare p projects;
begin
  if not has_perm('tasks.assign') then perform fail('ليس لديك صلاحية إنشاء مشاريع.'); end if;
  if char_length(trim(coalesce(p_title,''))) not between 3 and 140 then perform fail('اكتب اسم المشروع (من 3 إلى 140 حرفاً).'); end if;
  insert into projects(type, title, center_id, owner_id, due_on)
    values (coalesce(nullif(p_type,''),'مشروع'), trim(p_title), p_center, coalesce(p_owner, auth.uid()), coalesce(p_due, current_date + 30)) returning * into p;
  perform log_act('أنشأ مشروعاً: ' || p.title);
  return p;
end; $$;

create or replace function rate_status() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'today', (select row_to_json(r) from (select day as date, buy, sell, approved from rates where day = current_date) r),
    'effective', effective_rate(),
    'stale', not exists (select 1 from rates where day = current_date and approved is not null));
$$;

create or replace function approve_rate(p_value numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_perm('rate.set') then perform fail('ليس لديك صلاحية تحديد سعر الصرف.'); end if;
  if p_value is null or p_value <= 1 or p_value >= 1000000 then perform fail('اكتب سعر صرف صحيحاً.'); end if;
  insert into rates(day, approved, approved_by, approved_at) values (current_date, p_value, auth.uid(), now())
    on conflict (day) do update set approved = excluded.approved, approved_by = excluded.approved_by, approved_at = excluded.approved_at;
  perform log_act('اعتمد سعر الصرف ' || p_value);
end; $$;

create or replace function create_trip(p_title text, p_from date, p_to date, p_project uuid) returns trips
language plpgsql security definer set search_path = public as $$
declare t trips;
begin
  if not has_perm('expenses.add') then perform fail('ليس لديك صلاحية إضافة مصاريف.'); end if;
  if char_length(trim(coalesce(p_title,''))) not between 3 and 100 then perform fail('اكتب وجهة الرحلة.'); end if;
  if p_to < p_from then perform fail('تاريخ النهاية قبل تاريخ البداية.'); end if;
  insert into trips(user_id, title, from_on, to_on, project_id) values (auth.uid(), trim(p_title), p_from, p_to, p_project) returning * into t;
  return t;
end; $$;

-- المبلغ بالليرة يُحسب هنا من السعر المعتمد. لا يُقبل أي مبلغ محسوب من المتصفح.
create or replace function add_trip_item(p_trip uuid, p_kind text, p_note text, p_amount numeric, p_cur text, p_receipt text) returns trip_items
language plpgsql security definer set search_path = public as $$
declare t trips; r numeric; it trip_items;
begin
  select * into t from trips where id = p_trip;
  if not found or t.user_id <> auth.uid() then perform fail('لا يمكنك تعديل هذه الرحلة.'); end if;
  if t.status not in ('draft','returned') then perform fail('أُرسلت الرحلة، ولا يمكن تعديلها.'); end if;
  if not has_perm('expenses.add') then perform fail('ليس لديك صلاحية إضافة مصاريف.'); end if;
  if p_amount is null or p_amount <= 0 or p_amount >= 100000000 then perform fail('اكتب المبلغ.'); end if;
  if p_kind = 'غير ذلك' and char_length(trim(coalesce(p_note,''))) = 0 then perform fail('اكتب ملاحظة توضّح نوع المصروف.'); end if;
  if p_receipt is not null and p_receipt !~ ('^' || auth.uid()::text || '/[a-zA-Z0-9_-]+\.(jpg|png|webp|pdf)$') then perform fail('مسار الوصل غير صالح.'); end if;
  if p_cur = 'USD' then
    if not has_perm('expenses.usd') then perform fail('ليس لديك صلاحية الإدخال بالدولار.'); end if;
    r := effective_rate();
    if r is null then perform fail('لا يوجد سعر صرف معتمد بعد. أدخل المبلغ بالليرة أو تواصل مع المنسقة.'); end if;
    insert into trip_items(trip_id, kind, note, syp, cur, orig, rate, receipt_path)
      values (p_trip, p_kind, left(coalesce(p_note,''),120), round(p_amount * r), 'USD', p_amount, r, p_receipt) returning * into it;
  elsif p_cur = 'SYP' then
    insert into trip_items(trip_id, kind, note, syp, cur, orig, rate, receipt_path)
      values (p_trip, p_kind, left(coalesce(p_note,''),120), round(p_amount), 'SYP', p_amount, null, p_receipt) returning * into it;
  else perform fail('عملة غير معروفة.'); end if;
  return it;
end; $$;

create or replace function remove_trip_item(p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from trip_items i using trips t
   where i.id = p_item and t.id = i.trip_id and t.user_id = auth.uid() and t.status in ('draft','returned');
  if not found then perform fail('لا يمكن حذف هذا البند.'); end if;
end; $$;

create or replace function submit_trip(p_trip uuid) returns json
language plpgsql security definer set search_path = public as $$
declare t trips; total numeric; who text; u record;
begin
  select * into t from trips where id = p_trip;
  if not found or t.user_id <> auth.uid() then perform fail('لا يمكنك إرسال رحلة غيرك.'); end if;
  if t.status not in ('draft','returned') then perform fail('الرحلة مرسلة مسبقاً.'); end if;
  select coalesce(sum(syp),0) into total from trip_items where trip_id = p_trip;
  if total = 0 then perform fail('أضف مصروفاً واحداً على الأقل قبل الإرسال.'); end if;
  update trips set status = 'submitted', decision_note = '' where id = p_trip;
  select name into who from profiles where id = auth.uid();
  for u in select up.user_id from user_perms up join profiles p on p.id = up.user_id where up.perm = 'expenses.approve' and p.active loop
    perform notify_user(u.user_id, 'طلب مصاريف جديد: ' || who || ' · ' || t.title || ' · ' || to_char(total, 'FM999,999,999') || ' ل.س', './#/approvals');
  end loop;
  perform log_act('أرسل ' || t.title || ' للموافقة');
  return json_build_object('ok', true);
end; $$;

create or replace function decide_trip(p_trip uuid, p_decision text, p_note text) returns json
language plpgsql security definer set search_path = public as $$
declare t trips; st text; msg text; u record;
begin
  if not has_perm('expenses.approve') then perform fail('ليس لديك صلاحية الموافقة على المصاريف.'); end if;
  select * into t from trips where id = p_trip for update;
  if not found or t.status <> 'submitted' then perform fail('هذا الطلب ليس بانتظار الموافقة.'); end if;
  st := case p_decision when 'approve' then 'approved' when 'reject' then 'rejected' when 'return' then 'returned' end;
  if st is null then perform fail('قرار غير معروف.'); end if;
  if p_decision <> 'approve' and char_length(trim(coalesce(p_note,''))) = 0 then perform fail('اكتب السبب.'); end if;
  update trips set status = st, decision_note = left(coalesce(p_note,''),200), decided_by = auth.uid() where id = p_trip;
  msg := case p_decision when 'approve' then 'تمت الموافقة على مصاريف ' when 'reject' then 'رُفض طلب مصاريف ' else 'أُعيد للتعديل طلب مصاريف ' end || t.title || '.';
  if p_decision <> 'approve' then msg := msg || ' السبب: ' || p_note; end if;
  perform notify_user(t.user_id, msg, './#/expenses/' || t.id);
  if p_decision = 'approve' then
    for u in select up.user_id from user_perms up join profiles p on p.id = up.user_id where up.perm = 'expenses.pay' and p.active loop
      perform notify_user(u.user_id, 'مصاريف بانتظار الدفع: ' || t.title, './#/approvals');
    end loop;
  end if;
  perform log_act(msg);
  return json_build_object('ok', true);
end; $$;

create or replace function pay_trip(p_trip uuid) returns json
language plpgsql security definer set search_path = public as $$
declare t trips;
begin
  if not has_perm('expenses.pay') then perform fail('ليس لديك صلاحية دفع المصاريف.'); end if;
  select * into t from trips where id = p_trip for update;
  if not found or t.status <> 'approved' then perform fail('لا يمكن دفع طلب غير موافق عليه.'); end if;
  update trips set status = 'paid', paid_by = auth.uid() where id = p_trip;
  perform notify_user(t.user_id, 'دُفعت مصاريف ' || t.title || '.', './#/expenses/' || t.id);
  perform log_act('سجّل دفع ' || t.title);
  return json_build_object('ok', true);
end; $$;

create or replace function set_perms(p_user uuid, p_template text, p_perms text[]) returns json
language plpgsql security definer set search_path = public as $$
declare base text[]; nm text;
begin
  if not has_perm('perms.edit') then perform fail('ليس لديك صلاحية تعديل الصلاحيات.'); end if;
  if p_user = auth.uid() and not ('perms.edit' = any(p_perms)) then perform fail('لا يمكنك سحب صلاحية تعديل الصلاحيات من نفسك.'); end if;
  base := case p_template
    when 'manager' then array['tasks.view_team','tasks.assign','tasks.edit','expenses.add','expenses.usd','expenses.approve','expenses.pay','expenses.view_all','rate.set','files.upload','devices.view','visits.write','tickets.close','contracts.edit','clients.view','clients.export','quotes.cost','finance.view','users.manage','perms.edit','activity.view','notify.broadcast']
    when 'coordinator' then array['tasks.view_team','tasks.assign','expenses.approve','expenses.view_all','rate.set','files.upload','devices.view','clients.view','activity.view']
    when 'senior' then array['expenses.add','files.upload','devices.view','expenses.usd','tasks.view_team','tasks.assign','visits.write','tickets.close']
    when 'engineer' then array['expenses.add','files.upload','devices.view','expenses.usd','visits.write']
    when 'sales' then array['expenses.add','files.upload','devices.view','clients.view']
    when 'accountant' then array['expenses.pay','expenses.view_all','finance.view','files.upload']
    when 'basic' then array[]::text[] end;
  if base is null then perform fail('قالب غير معروف.'); end if;
  delete from user_perms where user_id = p_user;
  insert into user_perms(user_id, perm) select p_user, x from unnest(p_perms) x;
  update profiles set template = p_template, custom = not (base @> p_perms and p_perms @> base) where id = p_user returning name into nm;
  perform log_act('عدّل صلاحيات ' || nm);
  return json_build_object('ok', true);
end; $$;

create or replace function set_active(p_user uuid, p_active boolean) returns json
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if not has_perm('users.manage') then perform fail('ليس لديك صلاحية إدارة المستخدمين.'); end if;
  if p_user = auth.uid() then perform fail('لا يمكنك إيقاف حسابك.'); end if;
  update profiles set active = p_active where id = p_user returning name into nm;
  perform log_act(case when p_active then 'فعّل حساب ' else 'أوقف حساب ' end || nm);
  return json_build_object('ok', true);
end; $$;

create or replace function mark_all_read() returns void
language sql security definer set search_path = public as $$
  update notifications set read = true where user_id = auth.uid() and not read;
$$;

-- لا يُسمح لـ anon بتنفيذ أي دالة
revoke execute on all functions in schema public from anon, public;
grant execute on function toggle_task, create_task, create_project, rate_status, approve_rate, create_trip, add_trip_item,
  remove_trip_item, submit_trip, decide_trip, pay_trip, set_perms, set_active, mark_all_read, has_perm, is_active to authenticated;

-- ---------- تخزين الوصولات (خاص) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;
create policy receipts_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text and has_perm('files.upload'));
create policy receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = auth.uid()::text or has_perm('expenses.approve') or has_perm('expenses.pay')));
