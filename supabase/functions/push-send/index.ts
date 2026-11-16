// ترسل إشعارات Web Push لكل إشعار جديد لم يُرسل بعد. تُستدعى كل دقيقة من الجدولة.
// Verify JWT: OFF. الحماية بـ CRON_SECRET.
// Secrets: VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT (mailto:...), CRON_SECRET
import webpush from 'npm:web-push@3';
import { admin, checkCron, json } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (!checkCron(req)) return json({ error: 'unauthorized' }, 401);
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC')!, Deno.env.get('VAPID_PRIVATE')!);
  const db = admin();
  const { data: pending, error } = await db.from('notifications').select('id,user_id,text,url').eq('pushed', false).order('created_at').limit(200);
  if (error) return json({ error: error.message }, 500);
  const report: { id: string; sent: number; failed: string[] }[] = [];
  for (const n of pending ?? []) {
    const { data: subs } = await db.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id', n.user_id);
    const r = { id: n.id, sent: 0, failed: [] as string[] };
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: 'إيميكو', body: n.text, url: n.url }), { TTL: 3600 });
        r.sent++;
      } catch (e: any) {
        // 404/410: الاشتراك انتهى، نحذفه. غير ذلك: نسجّل السبب الحقيقي.
        if (e.statusCode === 404 || e.statusCode === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
        r.failed.push(`${e.statusCode ?? ''} ${e.body ?? e.message}`);
      }
    }
    await db.from('notifications').update({ pushed: true }).eq('id', n.id);
    report.push(r);
  }
  return json({ ok: true, report });
});
