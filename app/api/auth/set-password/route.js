import { NextResponse } from 'next/server';
import { consumePasswordSetupToken } from '../../../../lib/password-tokens';

export const runtime = 'nodejs';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || '');
  const password = String(body.password || '');
  const confirm = String(body.confirm || '');

  if (!token || token.length < 20) {
    return NextResponse.json({ message: 'Tautan aktivasi/reset tidak valid.' }, { status: 422 });
  }
  if (password.length < 8) {
    return NextResponse.json({ message: 'Password minimal 8 karakter.' }, { status: 422 });
  }
  if (password !== confirm) {
    return NextResponse.json({ message: 'Konfirmasi password tidak sama.' }, { status: 422 });
  }

  try {
    const result = await consumePasswordSetupToken({ token, password });
    return NextResponse.json({ ok: true, email: result.email, next: result.next });
  } catch (error) {
    console.error('set-password:', error);
    return NextResponse.json(
      { message: error?.message || 'Password belum dapat disimpan.' },
      { status: Number(error?.status) || 500 }
    );
  }
}
