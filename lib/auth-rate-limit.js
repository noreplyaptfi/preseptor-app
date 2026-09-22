import { getSupabaseAdmin } from './supabase-admin';

export async function checkAndRecordAuthEmail({ email, audience, requestType, ip = '' }) {
  const db = getSupabaseAdmin();
  const normalized = String(email || '').trim().toLowerCase();
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const thirtySecondsAgo = new Date(now - 30 * 1000).toISOString();

  const { count: recentCount } = await db
    .from('auth_email_requests')
    .select('id', { count: 'exact', head: true })
    .eq('email', normalized)
    .gte('created_at', hourAgo);

  const { count: burstCount } = await db
    .from('auth_email_requests')
    .select('id', { count: 'exact', head: true })
    .eq('email', normalized)
    .gte('created_at', thirtySecondsAgo);

  if ((burstCount || 0) >= 1) return { ok: false, retryAfter: 30, message: 'Tunggu sekitar 30 detik sebelum meminta email baru.' };
  if ((recentCount || 0) >= 10) return { ok: false, retryAfter: 3600, message: 'Terlalu banyak permintaan email. Silakan coba lagi nanti.' };

  await db.from('auth_email_requests').insert({
    email: normalized,
    audience,
    request_type: requestType,
    ip_address: String(ip || '').slice(0, 120) || null
  });

  return { ok: true };
}
