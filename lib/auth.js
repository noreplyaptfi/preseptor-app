import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabase-admin';

function bearer(request) {
  const value = request.headers.get('authorization') || '';
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : '';
}

export async function requireUser(request) {
  const token = bearer(request);
  if (!token) return { error: 'Sesi tidak ditemukan.', status: 401 };
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user?.email) return { error: 'Sesi tidak valid atau sudah berakhir.', status: 401 };
  return { user: data.user, token };
}

export async function requireAdmin(request, allowedRoles = []) {
  const auth = await requireUser(request);
  if (auth.error) return auth;
  const admin = getSupabaseAdmin();
  const email = auth.user.email.toLowerCase();
  const { data, error } = await admin.from('admin_users').select('*').eq('email', email).eq('active', true).maybeSingle();
  if (error || !data) return { error: 'Akun ini tidak memiliki akses panitia.', status: 403 };
  if (allowedRoles.length && !allowedRoles.includes(data.role)) return { error: 'Role akun tidak memiliki izin untuk tindakan ini.', status: 403 };
  return { ...auth, adminUser: data };
}
