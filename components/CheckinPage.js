'use client';
import FeedbackBridge from './FeedbackBridge';
import { useEffect,useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';
import ActionDialog from './ActionDialog';

// v0.6.1
// - Dapat dipakai semua akun panitia (bukan hanya Super Admin).
// - Bila sesi habis / belum login, token QR dibawa ke halaman login lalu kembali ke peserta yang sama.
// - Pesan error lama dibersihkan setiap kali memeriksa QR baru.
// - Input manual menerima token maupun URL QR lengkap.

const CHANNEL_LABEL={offline_qr:'Scan QR',online_self:'Mandiri (Online)',manual:'Manual Super Admin'};

function fmtDateTime(v){
  if(!v)return '—';
  try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v))}catch{return v}
}
function fmtDate(v){
  if(!v)return '';
  try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeZone:'Asia/Jakarta'}).format(new Date(`${v}T00:00:00+07:00`))}catch{return v}
}

// Terima token polos atau URL QR lengkap (.../admin/checkin?token=...&dayId=...).
export function parseQrInput(raw){
  const value=String(raw||'').trim();
  if(!value)return {token:'',dayId:null};
  if(value.includes('token=')){
    try{
      const u=new URL(value,'https://placeholder.local');
      return {token:String(u.searchParams.get('token')||'').trim(),dayId:u.searchParams.get('dayId')};
    }catch{}
  }
  return {token:value,dayId:null};
}

function checkinPath(token,dayId){
  const q=new URLSearchParams();
  if(token)q.set('token',token);
  if(dayId)q.set('dayId',dayId);
  const s=q.toString();
  return `/admin/checkin${s?`?${s}`:''}`;
}

function goToLogin(token,dayId){
  location.href=`/admin/login?next=${encodeURIComponent(checkinPath(token,dayId))}`;
}

export default function CheckinPage(){
  const [tokenValue,setTokenValue]=useState('');
  const [dayId,setDayId]=useState('');
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [dialog,setDialog]=useState(false);
  const [forbidden,setForbidden]=useState(false);

  async function authToken(){
    const {data}=await getSupabaseBrowser().auth.getSession();
    return data.session?.access_token||'';
  }

  async function lookup(raw,dayOverride){
    const parsed=parseQrInput(raw);
    const tk=parsed.token;
    const dy=parsed.dayId!=null?parsed.dayId:(dayOverride!=null?dayOverride:dayId);
    setError('');setNotice('');setForbidden(false);setData(null);
    if(!tk){setError('Masukkan token atau URL QR peserta.');return}
    setTokenValue(tk);setDayId(dy||'');
    try{history.replaceState(null,'',checkinPath(tk,dy))}catch{}
    setLoading(true);
    try{
      const t=await authToken();
      if(!t){goToLogin(tk,dy);return}
      const r=await fetch(`/api/admin/checkin?token=${encodeURIComponent(tk)}${dy?`&dayId=${encodeURIComponent(dy)}`:''}`,{headers:{Authorization:`Bearer ${t}`},cache:'no-store'});
      const j=await r.json().catch(()=>({}));
      if(r.status===401){goToLogin(tk,dy);return}
      if(r.status===403){setForbidden(true);setError(j.message||'Akun ini tidak memiliki akses panitia.');return}
      if(!r.ok){setError(j.message||'QR tidak dapat diperiksa.');return}
      setData(j);
    }catch{
      setError('Koneksi bermasalah. Periksa internet lalu coba lagi.');
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{
    const q=new URLSearchParams(location.search);
    const tk=q.get('token')||'',dy=q.get('dayId')||'';
    setTokenValue(tk);setDayId(dy);
    if(tk)lookup(tk,dy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  async function confirmCheckin(){
    setBusy(true);setError('');setNotice('');
    try{
      const t=await authToken();
      if(!t){goToLogin(tokenValue,dayId);return}
      const r=await fetch('/api/admin/checkin',{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({token:tokenValue,dayId})});
      const j=await r.json().catch(()=>({}));
      if(r.status===401){goToLogin(tokenValue,dayId);return}
      if(!r.ok){setError(j.message||'Check-in gagal.');setDialog(false);return}
      setData(v=>({...v,registration:j.registration,canCheckIn:false,blockReason:null,blockMessage:null}));
      setNotice(j.already?'Presensi peserta ini sudah tercatat sebelumnya.':'Presensi berhasil dicatat.');
      setDialog(false);
    }catch{
      setError('Koneksi bermasalah. Presensi belum tentu tersimpan, silakan periksa ulang QR.');
      setDialog(false);
    }finally{
      setBusy(false);
    }
  }

  async function switchAccount(){
    try{await getSupabaseBrowser().auth.signOut()}catch{}
    goToLogin(tokenValue,dayId);
  }

  // Input manual dengan token polos memakai jadwal hari ini (dayId kosong),
  // bukan dayId dari QR sebelumnya. URL QR lengkap tetap membawa dayId-nya sendiri.
  function submitManual(e){
    e.preventDefault();
    lookup(tokenValue,'');
  }

  const reg=data?.registration;
  const checked=!!reg?.checkedInAt;
  const canCheckIn=!!data?.canCheckIn;
  const resultClass=checked?'checked':canCheckIn?'valid':'invalid';
  const dayLabel=reg?.day?`${reg.day.title}${reg.day.eventDate?` · ${fmtDate(reg.day.eventDate)}`:''}`:'—';

  return <main className="checkin-page"><div className="checkin-shell">
    <header className="checkin-header">
      <a href="/admin" className="checkin-brand"><img src="/aptfi-logo.png" alt="APTFI"/></a>
      <a className="btn btn-secondary btn-small" href="/admin">Dashboard Panitia</a>
    </header>

    <section className="checkin-intro">
      <div className="eyebrow">Hari-H · Peserta Offline</div>
      <h1>Validasi QR Presensi</h1>
      <p>Scan QR dari menu Kehadiran peserta menggunakan kamera HP. Status peserta diperiksa langsung ke database.</p>
    </section>

    <section className="panel checkin-manual">
      <form className="checkin-token-row" onSubmit={submitManual}>
        <input value={tokenValue} onChange={e=>setTokenValue(e.target.value)} placeholder="Token atau URL QR" aria-label="Token atau URL QR"/>
        <button type="submit" className="btn btn-brand-primary" disabled={loading||!tokenValue.trim()}>{loading?'Memeriksa...':'Periksa'}</button>
      </form>
    </section>

    {error&&<div className="alert alert-error">
      {error}
      {forbidden&&<div style={{marginTop:10}}><button type="button" className="btn btn-secondary btn-small" onClick={switchAccount}>Masuk dengan akun panitia</button></div>}
    </div>}
    <FeedbackBridge notice={notice} onNotice={()=>setNotice('')}/>

    {loading&&<section className="checkin-result neutral"><div className="spinner"/><h2>Memeriksa peserta...</h2></section>}

    {reg&&!loading&&<section className={`checkin-result ${resultClass}`}>
      <div className="checkin-symbol">{checked||canCheckIn?'✓':'!'}</div>
      <div className="eyebrow">{checked?'Sudah hadir':canCheckIn?'Siap check-in':'Tidak dapat check-in'}</div>
      <h2>{reg.fullName} {reg.testAccount&&<span className="status status-info">TEST</span>}</h2>
      <strong className="checkin-code">{reg.registrationCode}</strong>
      <div className="checkin-data">
        <div><span>Hari</span><strong>{dayLabel}</strong></div>
        <div><span>Mode</span><strong>{reg.attendanceMode||'—'}</strong></div>
        <div><span>Homebase</span><strong>{reg.university||'—'}</strong></div>
        <div><span>Status presensi</span><strong>{checked?'Hadir':'Belum hadir'}</strong></div>
      </div>
      {checked&&<div className="checkin-confirmed">
        <span>Waktu presensi</span>
        <strong>{fmtDateTime(reg.checkedInAt)}</strong>
        <small>{CHANNEL_LABEL[reg.checkinChannel]||'Presensi'}{reg.checkedInBy?` · oleh ${reg.checkedInBy}`:''}</small>
      </div>}
      {!checked&&data?.blockMessage&&<p className="checkin-warning">{data.blockMessage}</p>}
      {canCheckIn&&<button type="button" className="btn btn-brand-primary btn-checkin" onClick={()=>setDialog(true)} disabled={busy}>Konfirmasi Check-in</button>}
    </section>}

    <ActionDialog
      open={dialog}
      title="Konfirmasi Check-in"
      description={reg?`${reg.fullName} · ${dayLabel}`:''}
      confirmLabel="Ya, Check-in"
      busy={busy}
      onClose={()=>setDialog(false)}
      onConfirm={confirmCheckin}
    />
  </div></main>;
}
