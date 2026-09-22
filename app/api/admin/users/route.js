import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { clean, validEmail } from '../../../../lib/validation';
import { createPasswordSetupToken } from '../../../../lib/password-tokens';
import { sendEmail } from '../../../../lib/email';
import { passwordLinkEmail } from '../../../../lib/email-template';

const ROLES = ['super_admin','event_admin','document_verifier','payment_verifier','viewer'];

export async function GET(request) {
  const auth = await requireAdmin(request, ['super_admin']);
  if (auth.error) return NextResponse.json({ message: auth.error }, { status: auth.status });
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('admin_users').select('*').order('created_at', { ascending: true });
  if (error) return NextResponse.json({ message: 'Gagal membaca daftar panitia.' }, { status: 500 });
  return NextResponse.json({ users: data || [] });
}

export async function POST(request) {
  const auth = await requireAdmin(request, ['super_admin']);
  if (auth.error) return NextResponse.json({ message: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => ({}));
  const email = clean(body.email, 190).toLowerCase();
  const displayName = clean(body.display_name, 160);
  const role = ROLES.includes(body.role) ? body.role : 'viewer';
  if (!validEmail(email)) return NextResponse.json({ message: 'Email panitia tidak valid.' }, { status: 422 });

  const db = getSupabaseAdmin();
  const { error } = await db.from('admin_users').upsert({
    email,
    display_name: displayName || null,
    role,
    active: true,
    updated_at: new Date().toISOString()
  }, { onConflict: 'email' });
  if (error) return NextResponse.json({ message: 'Gagal menyimpan akun panitia.' }, { status: 500 });

  try {
    const origin = new URL(request.url).origin;
    const { url } = await createPasswordSetupToken({ email, audience: 'admin', purpose: 'invite', next: '/admin', origin });
    const mail = await sendEmail({
      to: email,
      subject: 'Akses Dashboard Panitia APTFI',
      html: passwordLinkEmail({ name: displayName, action: 'Aktifkan akun panitia dan atur password', url, audience: 'admin' })
    });
    if (!mail.ok) throw new Error(mail.error || 'Gagal mengirim undangan.');
  } catch (mailError) {
    console.error('admin invite:', mailError);
    return NextResponse.json({ ok: true, warning: 'Akun panitia tersimpan, tetapi email undangan gagal dikirim.' });
  }

  return NextResponse.json({ ok: true, message: 'Akun panitia tersimpan dan undangan dikirim.' });
}

export async function PATCH(request) {
  const auth = await requireAdmin(request, ['super_admin']);
  if (auth.error) return NextResponse.json({ message: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => ({}));
  const email = clean(body.email, 190).toLowerCase();
  const role = ROLES.includes(body.role) ? body.role : null;
  if (!validEmail(email)) return NextResponse.json({ message: 'Email tidak valid.' }, { status: 422 });
  const patch = { updated_at: new Date().toISOString() };
  if (role) patch.role = role;
  if (typeof body.active === 'boolean') patch.active = body.active;
  if (typeof body.display_name === 'string') patch.display_name = clean(body.display_name, 160) || null;
  const db = getSupabaseAdmin();
  const { error } = await db.from('admin_users').update(patch).eq('email', email);
  if (error) return NextResponse.json({ message: 'Gagal memperbarui akun panitia.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
