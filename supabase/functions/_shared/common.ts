// أدوات مشتركة للدوال. الأسرار تُقرأ من Secrets فقط.
import { createClient } from 'npm:@supabase/supabase-js@2';

export const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

// مقارنة ثابتة الوقت لكلمة السر المشتركة بين الخوادم
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

export function checkCron(req: Request): boolean {
  const secret = Deno.env.get('CRON_SECRET') ?? '';
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  return secret.length >= 32 && safeEqual(got, secret);
}

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// اليوم بتوقيت دمشق
export function todayDamascus(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Damascus' }).format(new Date());
}
export function hourDamascus(): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Damascus', hour: '2-digit', hour12: false }).format(new Date()));
}
