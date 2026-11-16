// تُستدعى كل ساعة: تحية الصباح (8) والمساء (18)، ملخص المدير، التأخير، وتوليد المهام المتكررة.
// Verify JWT: OFF. الحماية بـ CRON_SECRET.
import { admin, checkCron, json, todayDamascus, hourDamascus } from '../_shared/common.ts';

const first = (name: string) => name.replace(/^(م\.|أ\.)\s*/, '').split(' ')[0];
function addDays(iso: string, n: number) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function addMonths(iso: string, n: number) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); }

Deno.serve(async (req) => {
  if (!checkCron(req)) return json({ error: 'unauthorized' }, 401);
  const db = admin(); const today = todayDamascus(); const hour = hourDamascus();
  const out: Record<string, number> = { recurring: 0, greetings: 0 };

  // 1) المهام المتكررة: لكل مهمة متكررة فات موعدها أو أُنجزت، نولّد موعدها التالي مرة واحدة.
  const { data: due } = await db.from('tasks').select('*').neq('freq', 'once').eq('next_created', false).or(`due_on.lt.${today},done.eq.true`);
  for (const t of due ?? []) {
    let next = t.due_on;
    const step = (d: string) => t.freq === 'daily' ? addDays(d, 1) : t.freq === 'weekly' ? addDays(d, 7) : addMonths(d, 1);
    do { next = step(next); } while (next < today);
    await db.from('tasks').insert({ project_id: t.project_id, title: t.title, assignee_id: t.assignee_id, freq: t.freq, due_on: next, time_of_day: t.time_of_day, note: t.note, created_by: t.created_by });
    await db.from('tasks').update({ next_created: true }).eq('id', t.id);
    out.recurring++;
  }

  if (hour === 8 || hour === 18) {
    const { data: people } = await db.from('profiles').select('id,name,template').eq('active', true);
    const { data: todays } = await db.from('tasks').select('assignee_id,done,time_of_day,due_on').lte('due_on', today);
    for (const p of people ?? []) {
      const mine = (todays ?? []).filter((t) => t.assignee_id === p.id && (t.due_on === today || !t.done));
      const done = mine.filter((t) => t.done).length;
      const firstTime = mine.filter((t) => !t.done && t.time_of_day).map((t) => t.time_of_day).sort()[0];
      const text = hour === 8
        ? `صباح الخير يا ${first(p.name)}، لديك اليوم ${mine.length} ${mine.length === 1 ? 'مهمة' : 'مهام'}${firstTime ? `، أولها ${firstTime}` : ''}.`
        : `مساء الخير يا ${first(p.name)}، أنجزت ${done} من ${mine.length} ${mine.length === 1 ? 'مهمة' : 'مهام'} اليوم.`;
      await db.from('notifications').insert({ user_id: p.id, text, url: './#/tasks' });
      out.greetings++;
    }
    if (hour === 8) {
      const late = (todays ?? []).filter((t) => !t.done && t.due_on < today).length;
      const total = (todays ?? []).filter((t) => t.due_on === today).length;
      const { count: pending } = await db.from('trips').select('id', { count: 'exact', head: true }).eq('status', 'submitted');
      const { data: managers } = await db.from('user_perms').select('user_id').eq('perm', 'users.manage');
      for (const m of managers ?? []) await db.from('notifications').insert({ user_id: m.user_id, text: `اليوم: ${total} مهمة، ${late} متأخرة، ${pending ?? 0} طلبات مصاريف بانتظار الموافقة.`, url: './#/home' });
    }
  }
  return json({ ok: true, ...out });
});
