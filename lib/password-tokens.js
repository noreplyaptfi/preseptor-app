import crypto from 'node:crypto';
import { getSupabaseAdmin } from './supabase-admin';
import { siteUrl } from './auth-links';

const TOKEN_TTL_MINUTES = 30;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function findAuthUserByEmail(email) {
  const db = getSupabaseAdmin();
  const wanted = String(email || '').toLowerCase();
  const perPage = 1000;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find((u) => String(u.email || '').toLowerCase() === wanted);
    if (found) return found;
    if (users.length < perPage) break;
  }
  return null;
}

async function ensureAuthUser(email) {
  const db = getSupabaseAdmin();
  let user = await findAuthUserByEmail(email);
  if (user) return user;

  const temporaryPassword = crypto.randomBytes(48).toString('base64url');
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true
  });
  if (error) {
    user = await findAuthUserByEmail(email);
    if (user) return user;
    throw error;
  }
  if (!data?.user) throw new Error('Gagal membuat akun autentikasi.');
  return data.user;
}

export async function createPasswordSetupToken({
  email,
  audience = 'participant',
  purpose = 'activate',
  next = '/dashboard',
  origin = '',
  ipAddress = ''
}) {
  const db = getSupabaseAdmin();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = await ensureAuthUser(normalizedEmail);
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MINUTES * 60 * 1000);

  await db
    .from('auth_password_tokens')
    .update({ used_at: now.toISOString() })
    .eq('email', normalizedEmail)
    .eq('audience', audience)
    .is('used_at', null);

  const { error } = await db.from('auth_password_tokens').insert({
    token_hash: tokenHash,
    email: normalizedEmail,
    user_id: user.id,
    audience,
    purpose,
    next_path: next.startsWith('/') ? next : '/dashboard',
    ip_address: ipAddress || null,
    expires_at: expiresAt.toISOString()
  });
  if (error) throw error;

  const url = `${siteUrl(origin)}/auth/set-password?token=${encodeURIComponent(rawToken)}`;
  return { url, user, expiresAt };
}

export async function consumePasswordSetupToken({ token, password }) {
  const db = getSupabaseAdmin();
  const tokenHash = hashToken(String(token || ''));
  const now = new Date().toISOString();

  const { data: row, error } = await db
    .from('auth_password_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .is('used_at', null)
    .gt('expires_at', now)
    .maybeSingle();

  if (error) throw error;
  if (!row) {
    const err = new Error('Tautan aktivasi/reset tidak valid atau sudah kedaluwarsa.');
    err.status = 410;
    throw err;
  }

  if (row.audience === 'admin') {
    const { data: admin } = await db
      .from('admin_users')
      .select('email,active')
      .eq('email', row.email)
      .eq('active', true)
      .maybeSingle();
    if (!admin) {
      const err = new Error('Akses panitia sudah tidak aktif.');
      err.status = 403;
      throw err;
    }
  } else {
    const { data: registration } = await db
      .from('registrations')
      .select('id')
      .ilike('email', row.email)
      .limit(1)
      .maybeSingle();
    if (!registration) {
      const err = new Error('Pendaftaran tidak ditemukan.');
      err.status = 403;
      throw err;
    }
  }

  const { error: updateError } = await db.auth.admin.updateUserById(row.user_id, { password, email_confirm: true });
  if (updateError) throw updateError;

  const { error: consumeError } = await db
    .from('auth_password_tokens')
    .update({ used_at: now })
    .eq('id', row.id)
    .is('used_at', null);
  if (consumeError) throw consumeError;

  return {
    email: row.email,
    audience: row.audience,
    purpose: row.purpose,
    next: row.next_path || (row.audience === 'admin' ? '/admin' : '/dashboard')
  };
}
