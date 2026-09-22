import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { clean, validEmail } from '../../../../lib/validation';
import { createPasswordSetupToken } from '../../../../lib/password-tokens';
import { checkAndRecordAuthEmail } from '../../../../lib/auth-rate-limit';
import { sendEmail } from '../../../../lib/email';
import { passwordLinkEmail } from '../../../../lib/email-template';

export const runtime = 'nodejs';

function clientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = clean(body.email, 190).toLowerCase();
  const audience = body.audience === 'admin' ? 'admin' : 'participant';
  const intent = body.intent === 'activate' ? 'activate' : 'reset';
  if (!validEmail(email)) return NextResponse.json({ message: 'Masukkan alamat email yang valid.' }, { status: 422 });

  const ip = clientIp(request);
  const limit = await checkAndRecordAuthEmail({ email, audience, requestType: intent, ip });
  if (!limit.ok) return NextResponse.json({ message: limit.message, retryAfter: limit.retryAfter }, { status: 429 });

  const db = getSupabaseAdmin();
  let allowed = false;
  let name = '';
  if (audience === 'admin') {
    const { data } = await db.from('admin_users').select('email,display_name,active').eq('email', email).eq('active', true).maybeSingle();
    allowed = !!data;
    name = data?.display_name || '';
  } else {
    const { data } = await db.from('registrations').select('full_name,email').ilike('email', email).order('created_at', { ascending: false }).limit(1).maybeSingle();
    allowed = !!data;
    name = data?.full_name || '';
  }

  if (!allowed) return NextResponse.json({ ok: true, message: 'Jika email terdaftar, tautan akses akan dikirim beberapa saat lagi.' });

  try {
    const origin = new URL(request.url).origin;
    const next = audience === 'admin' ? '/admin' : '/dashboard';
    const { url } = await createPasswordSetupToken({ email, audience, purpose: intent, next, origin, ipAddress: ip });
    const action = intent === 'activate' ? 'Aktifkan akun dan atur password' : 'Atur ulang password';
    const mail = await sendEmail({ to: email, subject: `${action} - APTFI`, html: passwordLinkEmail({ name, action, url, audience }) });
    if (!mail.ok) throw new Error(mail.error || 'Gagal mengirim email.');
  } catch (error) {
    console.error('request-link:', error);
    return NextResponse.json({ message: 'Email belum dapat dikirim. Silakan coba beberapa saat lagi.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, message: 'Jika email terdaftar, tautan akses akan dikirim beberapa saat lagi.' });
}
