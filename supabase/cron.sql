-- جدولة الدوال. يُشغَّل بعد رفع الدوال، من SQL Editor.
-- قبل التشغيل: من Database > Extensions فعّل pg_cron و pg_net.
-- ومن Project Settings > Vault أضف سرّين:
--   project_url  = رابط المشروع (https://xxxx.supabase.co)
--   cron_secret  = نفس قيمة CRON_SECRET في Edge Functions > Secrets
-- لا تكتب أي سر داخل هذا الملف.

select cron.schedule('imico-exchange-rate', '5 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/exchange-rate',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')));
$$);

-- كل ساعة بتوقيت UTC؛ الدالة نفسها تعرف ساعة دمشق وتقرر صباح الخير (8) ومساء الخير (18).
select cron.schedule('imico-daily-jobs', '0 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/daily-jobs',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')));
$$);

select cron.schedule('imico-push-send', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/push-send',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')));
$$);
