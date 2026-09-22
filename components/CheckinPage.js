'use client';
import { useEffect,useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';

function fmt(value){if(!value)return '—';try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(value))}catch{return value}}

export default function CheckinPage(){
  const [tokenValue,setTokenValue]=useState(''),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
  async function authToken(){const {data}=await getSupabaseBrowser().auth.getSession();return data.session?.access_token||''}
  async function lookup(raw){const qr=String(raw||'').trim();if(!qr)return;setLoading(true);setError('');setData(null);const t=await authToken();if(!t){const next=`/admin/checkin?token=${encodeURIComponent(qr)}`;location.href=`/admin/login?next=${encodeURIComponent(next)}`;return}const r=await fetch(`/api/admin/checkin?token=${encodeURIComponent(qr)}`,{headers:{Authorization:`Bearer ${t}`}});const j=await r.json().catch(()=>({}));if(!r.ok){setError(j.message||'QR tidak dapat dibaca.');setLoading(false);return}setData(j);setLoading(false)}
  useEffect(()=>{const q=new URLSearchParams(location.search).get('token')||'';setTokenValue(q);if(q)lookup(q)},[]);
  async function checkin(){if(!data?.registration||!tokenValue)return;setBusy(true);setError('');const t=await authToken();const r=await fetch('/api/admin/checkin',{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({token:tokenValue})});const j=await r.json().catch(()=>({}));if(!r.ok){setError(j.message||'Check-in gagal.');setBusy(false);return}setData(prev=>({...prev,registration:j.registration}));setBusy(false)}
  const reg=data?.registration;
  const valid=!!reg?.valid;
  const checked=!!reg?.checkedInAt;
  return <main className="checkin-page"><div className="checkin-shell">
    <header className="checkin-header"><a href="/admin" className="checkin-brand"><img src="/aptfi-logo.png" alt="APTFI"/></a><a className="btn btn-secondary btn-small" href="/admin">Dashboard Panitia</a></header>
    <section className="checkin-intro"><div className="eyebrow brand-blue">Check-in Peserta Offline</div><h1>Validasi QR di lokasi</h1><p>Scan QR dari Dashboard Peserta menggunakan kamera ponsel panitia. Halaman ini memeriksa status peserta langsung ke database, bukan hanya membaca teks QR.</p></section>
    <section className="checkin-manual panel"><div className="field"><label>Token QR</label><div className="checkin-token-row"><input value={tokenValue} onChange={e=>setTokenValue(e.target.value)} placeholder="Token akan terisi otomatis setelah QR discan"/><button className="btn btn-brand-primary" onClick={()=>lookup(tokenValue)} disabled={!tokenValue||loading}>{loading?'Memeriksa...':'Periksa'}</button></div></div></section>
    {error&&<div className="alert alert-error">{error}</div>}
    {loading&&<section className="checkin-result neutral"><div className="spinner"/><h2>Memeriksa peserta...</h2></section>}
    {reg&&!loading&&<section className={`checkin-result ${valid?(checked?'checked':'valid'):'invalid'}`}>
      <div className="checkin-symbol">{valid?(checked?'✓':'✓'):'!'}</div>
      <div className="eyebrow">{valid?(checked?'Sudah Check-in':'Peserta Valid'):'Tidak dapat Check-in'}</div>
      <h2>{reg.fullName}</h2>
      <strong className="checkin-code">{reg.registrationCode}</strong>
      <div className="checkin-data"><div><span>Homebase</span><strong>{reg.university||'—'}</strong></div><div><span>Mode</span><strong>{reg.attendanceMode}</strong></div><div><span>Persyaratan</span><strong>{reg.requirementsStatus==='valid'?'Valid':reg.requirementsStatus}</strong></div><div><span>Pembayaran</span><strong>{reg.paymentStatus==='verified'?'Terverifikasi':reg.paymentStatus}</strong></div></div>
      {checked&&<div className="checkin-confirmed"><span>Waktu check-in</span><strong>{fmt(reg.checkedInAt)}</strong><small>oleh {reg.checkedInBy||'panitia'}</small></div>}
      {!valid&&<p className="checkin-warning">Peserta harus berstatus Offline dengan persyaratan valid dan pembayaran terverifikasi.</p>}
      {valid&&!checked&&data?.canCheckIn&&<button className="btn btn-brand-primary btn-checkin" onClick={()=>{if(confirm(`Konfirmasi check-in untuk ${reg.fullName}?`))checkin()}} disabled={busy}>{busy?'Menyimpan...':'Konfirmasi Check-in'}</button>}
      {valid&&!checked&&!data?.canCheckIn&&<div className="read-only-box">Akun ini dapat memeriksa QR tetapi tidak memiliki izin melakukan check-in.</div>}
    </section>}
  </div></main>
}
