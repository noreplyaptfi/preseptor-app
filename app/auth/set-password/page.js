'use client';
import { useMemo, useState } from 'react';
import { getSupabaseBrowser } from '../../../lib/supabase-browser';

export default function SetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [show, setShow] = useState(false);

  const token = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('token') || '';
  }, []);

  async function submit(e) {
    e.preventDefault();
    setMessage(null);
    if (!token) {
      setMessage({ ok: false, text: 'Tautan aktivasi/reset tidak valid. Minta tautan baru dari halaman login.' });
      return;
    }
    if (password.length < 8) {
      setMessage({ ok: false, text: 'Password minimal 8 karakter.' });
      return;
    }
    if (password !== confirm) {
      setMessage({ ok: false, text: 'Konfirmasi password tidak sama.' });
      return;
    }

    setBusy(true);
    try {
      const response = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirm })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Password belum dapat disimpan.');

      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({ email: payload.email, password });
      if (error) throw new Error(`Password sudah disimpan, tetapi sesi login belum dapat dibuat: ${error.message}`);

      setMessage({ ok: true, text: 'Password berhasil disimpan. Anda sudah masuk. Mengarahkan ke dashboard...' });
      setTimeout(() => {
        location.href = payload.next?.startsWith('/') ? payload.next : '/dashboard';
      }, 700);
    } catch (error) {
      setMessage({ ok: false, text: error.message });
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page auth-password-page"><section className="auth-form-panel full"><div className="auth-card"><img className="auth-set-logo" src="/aptfi-logo.png" alt="APTFI"/><div className="eyebrow brand-blue">Keamanan akun</div><h2>Atur password baru</h2><p className="muted">Gunakan minimal 8 karakter. Tautan hanya dapat dipakai satu kali dan berlaku 30 menit.</p>{!token&&<div className="alert alert-warning">Tautan tidak lengkap. Kembali ke halaman login dan minta aktivasi/reset password baru.</div>}{message&&<div className={`alert ${message.ok?'alert-success':'alert-error'}`}>{message.text}</div>}<form onSubmit={submit} className="auth-form"><div className="field"><label>Password baru</label><div className="password-wrap"><input type={show?'text':'password'} minLength="8" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/><button type="button" className="password-toggle" onClick={()=>setShow(v=>!v)}>{show?'Sembunyikan':'Lihat'}</button></div></div><div className="field"><label>Ulangi password</label><input type={show?'text':'password'} minLength="8" required value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password"/></div><button className="btn btn-brand-primary btn-block" disabled={!token||busy}>{busy?'Menyimpan...':'Simpan password & masuk'}</button></form></div></section></main>;
}
