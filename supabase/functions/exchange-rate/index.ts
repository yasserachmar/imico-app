// تجلب سعر الدولار من «الليرة اليوم» كل ساعة، وتحفظه كسعر مقترح. لا تعتمده: الاعتماد للمنسقة فقط.
// Verify JWT: OFF. الحماية بـ CRON_SECRET.
// Secrets: SPTODAY_API_KEY, SPTODAY_URL (رابط نقطة الأسعار من توثيق الليرة اليوم), CRON_SECRET
import { admin, checkCron, json, todayDamascus, hourDamascus } from '../_shared/common.ts';

// يبحث في الرد عن سعر الدولار لدمشق (شراء ومبيع). شكل الرد يُطابق مع توثيق الليرة اليوم عند الربط.
function pickUsd(data: unknown): { buy: number; sell: number } | null {
  const seen = new Set<unknown>();
  let found: { buy: number; sell: number } | null = null;
  const walk = (v: any) => {
    if (!v || typeof v !== 'object' || seen.has(v) || found) return;
    seen.add(v);
    const code = String(v.code ?? v.currency ?? v.symbol ?? v.name ?? '').toUpperCase();
    const buy = Number(v.buy ?? v.bid ?? v.buy_price);
    const sell = Number(v.sell ?? v.ask ?? v.sell_price);
    const city = String(v.city ?? v.location ?? 'damascus').toLowerCase();
    if (code.includes('USD') && buy > 0 && sell > 0 && (city.includes('dam') || city.includes('دمشق'))) { found = { buy, sell }; return; }
    for (const k of Object.keys(v)) walk(v[k]);
  };
  walk(data);
  return found;
}

Deno.serve(async (req) => {
  if (!checkCron(req)) return json({ error: 'unauthorized' }, 401);
  const key = Deno.env.get('SPTODAY_API_KEY'); const url = Deno.env.get('SPTODAY_URL');
  if (!key || !url) return json({ error: 'missing SPTODAY_API_KEY or SPTODAY_URL' }, 500);
  const db = admin(); const day = todayDamascus();
  let rate: { buy: number; sell: number } | null = null;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}`, 'X-API-Key': key, Accept: 'application/json' } });
    if (!res.ok) throw new Error('sptoday status ' + res.status);
    rate = pickUsd(await res.json());
  } catch (e) {
    console.error('exchange-rate fetch failed', e);
  }
  if (rate) {
    // لا نلمس approved
    const { error } = await db.from('rates').upsert({ day, buy: rate.buy, sell: rate.sell }, { onConflict: 'day', ignoreDuplicates: false }).select();
    if (error) console.error(error);
  }
  // إشعار الصباح للمنسقة إذا لم يُعتمد سعر اليوم
  if (hourDamascus() === 8) {
    const { data: r } = await db.from('rates').select('approved').eq('day', day).maybeSingle();
    if (!r || r.approved === null) {
      const { data: setters } = await db.from('user_perms').select('user_id').eq('perm', 'rate.set');
      for (const s of setters ?? []) {
        await db.from('notifications').insert({ user_id: s.user_id, text: rate ? 'سعر صرف اليوم بانتظار الاعتماد.' : 'تعذّر جلب السعر من الليرة اليوم. أدخل سعر اليوم يدوياً.', url: './#/settings' });
      }
    }
  }
  return json({ ok: true, fetched: !!rate });
});
