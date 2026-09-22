'use client';
import { useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';

function humanizeAuthError(message = '') {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email atau password tidak sesuai.';
  if (m.includes('email not confirmed')) return 'Akun belum aktif. Gunakan tombol Aktivasi akun terlebih dahulu.';
  if (m.includes('too many requests')) return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
  return message || 'Login gagal. Silakan coba kembali.';
}

export default function AuthLogin({ audience = 'participant' }) {
  const admin = audience === 'admin';
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState(null);
  const [showPassword,setShowPassword]=useState(false);

  async function login(e){
    e.preventDefault();
    setBusy(true); setMessage(null);
    const supabase=getSupabaseBrowser();
    const { error }=await supabase.auth.signInWithPassword({ email:email.trim(), password });
    if(error){setMessage({ok:false,text:humanizeAuthError(error.message)});setBusy(false);return;}
    if(admin){const next=new URLSearchParams(location.search).get('next')||'';location.href=next.startsWith('/admin')?next:'/admin'}else location.href='/dashboard';
  }

  async function requestLink(intent){
    const target=email.trim();
    if(!target){setMessage({ok:false,text:'Masukkan email terlebih dahulu.'});return;}
    setBusy(true); setMessage(null);
    try{
      const r=await fetch('/api/auth/request-link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:target,audience,intent})});
      const j=await r.json();
      if(!r.ok)throw new Error(j.message||'Permintaan gagal.');
      setMessage({ok:true,text:j.message||'Silakan cek email Anda.'});
    }catch(e){setMessage({ok:false,text:e.message});}
    finally{setBusy(false);}
  }

  return <main className={`auth-page ${admin?'auth-admin':''}`}>
    <section className="auth-brand-panel">
      <div className="auth-brand-inner">
        <img className="auth-logo" src="/aptfi-logo.png" alt="Asosiasi Pendidikan Tinggi Farmasi Indonesia"/>
        <div className="eyebrow light">Pelatihan Preseptor · 2026</div>
        <h1>{admin?'Panel kerja panitia':'Pantau pendaftaran Anda'}</h1>
        <p>{admin?'Verifikasi dokumen, pembayaran, dan status peserta dari satu dashboard yang terpusat.':'Masuk untuk memantau status dokumen, pembayaran, dan menindaklanjuti perbaikan jika diperlukan.'}</p>
        <div className="auth-feature-list">
          <div><span>✓</span><p><strong>Akses aman</strong><small>Email dan password dikelola oleh Supabase Auth.</small></p></div>
          <div><span>✓</span><p><strong>Notifikasi APTFI</strong><small>Aktivasi dan reset password dikirim melalui email resmi APTFI.</small></p></div>
          <div><span>✓</span><p><strong>Dokumen privat</strong><small>File hanya dapat dibuka melalui tautan sementara.</small></p></div>
        </div>
      </div>
    </section>
    <section className="auth-form-panel">
      <div className="auth-card">
        <a className="auth-back" href="/">← Kembali ke beranda</a>
        <div className="eyebrow brand-blue">{admin?'Dashboard Panitia':'Dashboard Peserta'}</div>
        <h2>Masuk ke akun</h2>
        <p className="muted">Gunakan email yang terdaftar dan password akun Anda.</p>
        {message&&<div className={`alert ${message.ok?'alert-success':'alert-error'}`}>{message.text}</div>}
        <form onSubmit={login} className="auth-form">
          <div className="field"><label>Email</label><input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={admin?'admin@aptfi.or.id':'nama@email.com'}/></div>
          <div className="field"><label>Password</label><div className="password-wrap"><input type={showPassword?'text':'password'} required minLength="8" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimal 8 karakter"/><button type="button" className="password-toggle" onClick={()=>setShowPassword(v=>!v)}>{showPassword?'Sembunyikan':'Lihat'}</button></div></div>
          <button className="btn btn-brand-primary btn-block" disabled={busy}>{busy?'Memproses...':'Masuk'}</button>
        </form>
        <div className="auth-actions">
          <button className="link-button" disabled={busy} onClick={()=>requestLink('reset')}>Lupa password?</button>
          <button className="link-button" disabled={busy} onClick={()=>requestLink('activate')}>{admin?'Aktivasi akun panitia':'Belum punya password? Aktivasi akun'}</button>
        </div>
        <div className="auth-help"><strong>Catatan</strong><p>Peserta menggunakan email yang sama dengan email pendaftaran. Tautan aktivasi/reset bersifat pribadi dan berlaku terbatas.</p></div>
      </div>
    </section>
  </main>
}
