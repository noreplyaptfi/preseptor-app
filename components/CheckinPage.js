'use client';
import FeedbackBridge from './FeedbackBridge';
import { useEffect,useRef,useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';
import { createQrScanner,createFeedback,cameraSupported,cameraErrorMessage } from '../lib/qr-scanner';
import ActionDialog from './ActionDialog';
import NavIcon from './NavIcon';

// v0.6.1
// - Dapat dipakai semua akun panitia (bukan hanya Super Admin).
// - Bila sesi habis / belum login, token QR dibawa ke halaman login lalu kembali ke peserta yang sama.
// - Pesan error lama dibersihkan setiap kali memeriksa QR baru.
// - Input manual menerima token maupun URL QR lengkap.
// v0.8.2
// - Scanner kamera di dalam halaman: buka kamera sekali, pindai peserta berurutan.
// - Mode "Langsung catat": presensi tersimpan otomatis setelah QR valid terbaca (bisa dimatikan).
// - Riwayat scan di perangkat ini, bunyi/getar sebagai umpan balik.
// - Alur lama (aplikasi kamera HP membuka tautan QR) dan input manual tetap berfungsi.

const CHANNEL_LABEL={offline_qr:'Scan QR',online_self:'Mandiri (Online)',manual:'Manual Super Admin'};
const AUTO_KEY='aptfi-checkin-auto';
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAME_QR_COOLDOWN_MS=8000;
const RESUME_AFTER_OK_MS=1800;
const CAM_LABEL={ok:'Hadir tercatat',already:'Sudah tercatat sebelumnya',blocked:'Tidak dapat check-in',error:'Gagal diperiksa',invalid:'Bukan QR presensi APTFI',pending:'Menunggu konfirmasi'};

function fmtDateTime(v){
  if(!v)return '—';
  try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v))}catch{return v}
}
function fmtTime(v){
  try{return new Intl.DateTimeFormat('id-ID',{timeStyle:'short',timeZone:'Asia/Jakarta'}).format(v?new Date(v):new Date())}catch{return ''}
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

// QR dari kamera harus berupa QR presensi APTFI (URL berisi token=) atau token UUID polos.
// Mencegah QR lain (mis. QR Zoom, QR pembayaran) terkirim ke server.
export function isAttendanceQr(raw){
  const value=String(raw||'').trim();
  if(!value)return false;
  if(value.includes('token='))return !!parseQrInput(value).token;
  return UUID_RE.test(value);
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

function readAuto(){
  try{return localStorage.getItem(AUTO_KEY)!=='0'}catch{return true}
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
  const [camOn,setCamOn]=useState(false);
  const [camState,setCamState]=useState('idle');
  const [camError,setCamError]=useState('');
  const [autoMode,setAutoMode]=useState(true);
  const [scanLog,setScanLog]=useState([]);
  const [fromCamera,setFromCamera]=useState(false);
  const [camResult,setCamResult]=useState(null);
  const videoRef=useRef(null);
  const scannerRef=useRef(null);
  const feedbackRef=useRef(null);
  const lastScanRef=useRef({value:'',at:0});
  const resumeTimerRef=useRef(null);
  const autoRef=useRef(true);
  const processingRef=useRef(false);
  const camWantedRef=useRef(false);
  const handleScanRef=useRef(null);

  async function authToken(){
    const {data}=await getSupabaseBrowser().auth.getSession();
    return data.session?.access_token||'';
  }

  // Memeriksa peserta. Mengembalikan data hasil pemeriksaan atau null.
  async function lookup(raw,dayOverride,{camera=false}={}){
    const parsed=parseQrInput(raw);
    const tk=parsed.token;
    const dy=parsed.dayId!=null?parsed.dayId:(dayOverride!=null?dayOverride:dayId);
    setError('');setNotice('');setForbidden(false);setData(null);setFromCamera(camera);
    if(!tk){setError('Masukkan token atau URL QR peserta.');return null}
    setTokenValue(camera?'':tk);setDayId(dy||'');
    if(!camera){try{history.replaceState(null,'',checkinPath(tk,dy))}catch{}}
    setLoading(true);
    try{
      const t=await authToken();
      if(!t){goToLogin(tk,dy);return null}
      const r=await fetch(`/api/admin/checkin?token=${encodeURIComponent(tk)}${dy?`&dayId=${encodeURIComponent(dy)}`:''}`,{headers:{Authorization:`Bearer ${t}`},cache:'no-store'});
      const j=await r.json().catch(()=>({}));
      if(r.status===401){goToLogin(camera?'':tk,camera?'':dy);return null}
      if(r.status===403){setForbidden(true);setError(j.message||'Akun ini tidak memiliki akses panitia.');return null}
      if(!r.ok){setError(j.message||'QR tidak dapat diperiksa.');return null}
      setData({...j,_token:tk,_dayId:dy||''});
      return {...j,_token:tk,_dayId:dy||''};
    }catch{
      setError('Koneksi bermasalah. Periksa internet lalu coba lagi.');
      return null;
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{
    setAutoMode(readAuto());autoRef.current=readAuto();
    const q=new URLSearchParams(location.search);
    const tk=q.get('token')||'',dy=q.get('dayId')||'';
    setTokenValue(tk);setDayId(dy);
    if(tk)lookup(tk,dy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Simpan presensi. Mengembalikan respons server (ok/already) atau null bila gagal.
  async function saveCheckin(tk,dy,{quiet=false}={}){
    setBusy(true);setError('');setNotice('');
    try{
      const t=await authToken();
      if(!t){goToLogin(tk,dy);return null}
      const r=await fetch('/api/admin/checkin',{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({token:tk,dayId:dy})});
      const j=await r.json().catch(()=>({}));
      if(r.status===401){goToLogin(tk,dy);return null}
      if(!r.ok){setError(j.message||'Check-in gagal.');return null}
      setData(v=>({...v,registration:j.registration,canCheckIn:false,blockReason:null,blockMessage:null}));
      if(!quiet)setNotice(j.already?'Presensi peserta ini sudah tercatat sebelumnya.':'Presensi berhasil dicatat.');
      return j;
    }catch{
      setError('Koneksi bermasalah. Presensi belum tentu tersimpan, silakan periksa ulang QR.');
      return null;
    }finally{
      setBusy(false);
    }
  }

  function pushHistory(entry){
    const item={...entry,at:Date.now(),id:`${Date.now()}-${Math.random()}`};
    setScanLog(h=>[item,...h].slice(0,12));
    setCamResult(item);
  }

  function historyEntry(reg,status,message){
    return {name:reg?.fullName||'QR tidak dikenali',code:reg?.registrationCode||'',day:reg?.day?.title||'',test:!!reg?.testAccount,status,message:message||''};
  }

  async function confirmCheckin(){
    const tk=data?._token||tokenValue,dy=data?._dayId??dayId;
    const j=await saveCheckin(tk,dy,{quiet:fromCamera});
    setDialog(false);
    if(j&&fromCamera){
      feedbackRef.current?.play(j.already?'warn':'ok');
      pushHistory(historyEntry(j.registration,j.already?'already':'ok'));
      scheduleResume(RESUME_AFTER_OK_MS);
    }else if(!j&&fromCamera){
      feedbackRef.current?.play('err');
      pushHistory(historyEntry(data?.registration,'error','Gagal menyimpan'));
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

  // ---------- Kamera ----------
  function clearResumeTimer(){clearTimeout(resumeTimerRef.current);resumeTimerRef.current=null}
  // Setelah hasil sukses/sudah tercatat: lanjut memindai otomatis, kartu hasil tetap terlihat
  // sampai QR berikutnya terbaca.
  function scheduleResume(ms){
    clearResumeTimer();
    resumeTimerRef.current=setTimeout(()=>{processingRef.current=false;scannerRef.current?.resume()},ms);
  }
  function scanNext(){
    clearResumeTimer();
    processingRef.current=false;
    setData(null);setError('');setForbidden(false);setCamResult(null);
    scannerRef.current?.resume();
  }

  async function handleScan(text){
    if(processingRef.current)return;
    const now=Date.now();
    if(lastScanRef.current.value===text&&now-lastScanRef.current.at<SAME_QR_COOLDOWN_MS)return;
    lastScanRef.current={value:text,at:now};
    if(!isAttendanceQr(text)){
      feedbackRef.current?.play('err');
      setData(null);
      setCamResult({status:'invalid',name:'QR tidak dikenali',message:'Bukan QR presensi APTFI'});
      setError('QR ini bukan QR presensi APTFI. Minta peserta membuka menu Kehadiran di dashboard (bukan QR Zoom atau QR lain).');
      return;
    }
    processingRef.current=true;
    setCamResult(null);
    scannerRef.current?.pause();
    clearResumeTimer();
    const res=await lookup(text,'',{camera:true});
    if(!res){
      feedbackRef.current?.play('err');
      pushHistory(historyEntry(null,'error','QR tidak dapat diperiksa'));
      return; // tunggu panitia menekan "Scan berikutnya"
    }
    const reg=res.registration;
    if(reg?.checkedInAt){
      feedbackRef.current?.play('warn');
      pushHistory(historyEntry(reg,'already'));
      scheduleResume(RESUME_AFTER_OK_MS+600);
      return;
    }
    if(res.canCheckIn){
      if(autoRef.current){
        const j=await saveCheckin(res._token,res._dayId,{quiet:true});
        if(j){
          feedbackRef.current?.play(j.already?'warn':'ok');
          pushHistory(historyEntry(j.registration,j.already?'already':'ok'));
          scheduleResume(RESUME_AFTER_OK_MS);
        }else{
          feedbackRef.current?.play('err');
          pushHistory(historyEntry(reg,'error','Gagal menyimpan'));
        }
      }else{
        feedbackRef.current?.play('warn');
        setCamResult({status:'pending',name:reg?.fullName||'',code:reg?.registrationCode||'',day:reg?.day?.title||'',message:'Konfirmasi check-in di bawah'});
        setDialog(true);
      }
      return;
    }
    feedbackRef.current?.play('err');
    pushHistory(historyEntry(reg,'blocked',res.blockMessage||'Tidak dapat check-in'));
  }

  handleScanRef.current=handleScan;

  async function startCamera(){
    setCamError('');
    if(!cameraSupported()){setCamError(cameraErrorMessage({name:'NotSupportedError'}));return}
    if(!feedbackRef.current)feedbackRef.current=createFeedback();
    feedbackRef.current.unlock();
    camWantedRef.current=true;
    setCamOn(true);
    setData(null);setError('');setNotice('');
    // Tunggu frame kamera tampil dulu (Safari iOS tidak memutar video yang tersembunyi).
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    try{
      if(!scannerRef.current)scannerRef.current=createQrScanner(videoRef.current,{onResult:t=>handleScanRef.current?.(t),onStateChange:s=>setCamState(s.state)});
      processingRef.current=false;
      await scannerRef.current.start();
    }catch(e){
      camWantedRef.current=false;
      setCamOn(false);
      setCamState('idle');
      setCamError(e?.message==='unsupported'?cameraErrorMessage({name:'NotSupportedError'}):cameraErrorMessage(e));
    }
  }

  function stopCamera(){
    camWantedRef.current=false;
    clearResumeTimer();
    scannerRef.current?.stop();
    processingRef.current=false;
    setCamOn(false);
    setCamState('idle');
    setCamResult(null);
  }

  async function switchCamera(){
    try{await scannerRef.current?.switchCamera()}catch(e){setCamError(cameraErrorMessage(e))}
  }

  function toggleAuto(e){
    const v=e.target.checked;
    setAutoMode(v);autoRef.current=v;
    try{localStorage.setItem(AUTO_KEY,v?'1':'0')}catch{}
  }

  // Matikan kamera saat halaman disembunyikan (hemat baterai); nyalakan lagi saat kembali.
  useEffect(()=>{
    function onVisibility(){
      const s=scannerRef.current;
      if(!s)return;
      if(document.visibilityState==='hidden'){if(s.running){clearResumeTimer();s.stop()}}
      else if(camWantedRef.current&&!s.running){processingRef.current=false;s.start().catch(err=>{camWantedRef.current=false;setCamOn(false);setCamError(cameraErrorMessage(err))})}
    }
    document.addEventListener('visibilitychange',onVisibility);
    return()=>{document.removeEventListener('visibilitychange',onVisibility);clearResumeTimer();scannerRef.current?.stop()};
  },[]);

  const reg=data?.registration;
  const checked=!!reg?.checkedInAt;
  const canCheckIn=!!data?.canCheckIn;
  const resultClass=checked?'checked':canCheckIn?'valid':'invalid';
  const dayLabel=reg?.day?`${reg.day.title}${reg.day.eventDate?` · ${fmtDate(reg.day.eventDate)}`:''}`:'—';
  const paused=camOn&&(camState==='paused'||loading||busy);
  const camLabel=!camOn?'':camState==='starting'?'Membuka kamera...':loading||busy?'Memeriksa peserta...':camState==='paused'?'Dijeda · tekan Scan berikutnya':'Arahkan kamera ke QR peserta';
  const showNext=camOn&&fromCamera&&camState==='paused'&&(reg||error)&&!loading&&!busy;

  return <main className="checkin-page"><div className="checkin-shell">
    <header className="checkin-header">
      <a href="/admin" className="checkin-brand"><img src="/aptfi-logo.png" alt="APTFI"/></a>
      <a className="btn btn-secondary btn-small" href="/admin">Dashboard Panitia</a>
    </header>

    <section className="checkin-intro">
      <div className="eyebrow">Hari-H · Peserta Offline</div>
      <h1>Validasi QR Presensi</h1>
      <p>Buka kamera di halaman ini, lalu pindai QR dari menu <b>Kehadiran</b> peserta satu per satu. Status peserta diperiksa langsung ke database.</p>
    </section>

    <section className={`panel checkin-camera ${camOn?'on':''}`}>
      <div className="cam-frame" hidden={!camOn}>
        <video ref={videoRef} className="cam-video" playsInline muted autoPlay/>
        <div className={`cam-overlay ${paused?'paused':''}`} aria-hidden="true"><span className="cam-box"/></div>
        {camResult&&!loading&&!busy
          ?<div className={`cam-result cam-${camResult.status}`} role="status" aria-live="polite">
            <span className="cam-result-icon" aria-hidden="true">{camResult.status==='ok'?'✓':camResult.status==='already'?'✓':camResult.status==='pending'?'?':'!'}</span>
            <div><strong>{camResult.name}</strong><small>{CAM_LABEL[camResult.status]}{camResult.day?` · ${camResult.day}`:''}</small></div>
          </div>
          :<div className={`cam-status ${paused?'paused':''}`}>{camLabel}</div>}
      </div>
      {!camOn&&<div className="cam-start">
        <span className="cam-start-icon"><NavIcon name="qr" size={30}/></span>
        <div><strong>Scanner kamera</strong><p>Pindai QR peserta langsung dari halaman ini tanpa berpindah aplikasi. Izinkan akses kamera saat diminta browser.</p></div>
        <button type="button" className="btn btn-brand-primary" onClick={startCamera}>Buka kamera</button>
      </div>}
      {camError&&<div className="alert alert-error cam-error">{camError}</div>}
      <div className="cam-controls">
        <label className="switch-line cam-auto"><input type="checkbox" checked={autoMode} onChange={toggleAuto}/><span>Langsung catat presensi setelah QR valid terbaca</span></label>
        {camOn&&<div className="cam-buttons">
          <button type="button" className="btn btn-secondary btn-small" onClick={switchCamera}><NavIcon name="refresh" size={14}/>Ganti kamera</button>
          <button type="button" className="btn btn-secondary btn-small" onClick={stopCamera}>Tutup kamera</button>
        </div>}
      </div>
    </section>

    {error&&<div className="alert alert-error">
      {error}
      {forbidden&&<div style={{marginTop:10}}><button type="button" className="btn btn-secondary btn-small" onClick={switchAccount}>Masuk dengan akun panitia</button></div>}
      {showNext&&!reg&&<div style={{marginTop:10}}><button type="button" className="btn btn-brand-primary btn-small" onClick={scanNext}>Scan berikutnya</button></div>}
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
      <div className="checkin-result-actions">
        {canCheckIn&&<button type="button" className="btn btn-brand-primary btn-checkin" onClick={()=>setDialog(true)} disabled={busy}>Konfirmasi Check-in</button>}
        {showNext&&<button type="button" className={`btn ${canCheckIn?'btn-secondary':'btn-brand-primary'} btn-checkin`} onClick={scanNext}>Scan berikutnya</button>}
      </div>
    </section>}

    {scanLog.length>0&&<section className="panel checkin-history">
      <div className="checkin-history-head"><strong>Riwayat scan di perangkat ini</strong><button type="button" className="btn btn-secondary btn-small" onClick={()=>setScanLog([])}>Bersihkan</button></div>
      <ul>{scanLog.map(h=><li key={h.id} className={`hist-${h.status}`}>
        <span className="hist-dot" aria-hidden="true"/>
        <div><strong>{h.name}{h.test?' · TEST':''}</strong><small>{[h.code,h.day,h.message].filter(Boolean).join(' · ')}</small></div>
        <em>{h.status==='ok'?'Hadir':h.status==='already'?'Sudah tercatat':h.status==='blocked'?'Ditolak':'Gagal'}<small>{fmtTime(h.at)}</small></em>
      </li>)}</ul>
    </section>}

    <section className="panel checkin-manual">
      <div className="checkin-manual-head"><strong>Input manual</strong><small>Tempel token atau URL QR bila kamera bermasalah.</small></div>
      <form className="checkin-token-row" onSubmit={submitManual}>
        <input value={tokenValue} onChange={e=>setTokenValue(e.target.value)} placeholder="Token atau URL QR" aria-label="Token atau URL QR"/>
        <button type="submit" className="btn btn-brand-primary" disabled={loading||!tokenValue.trim()}>{loading?'Memeriksa...':'Periksa'}</button>
      </form>
    </section>

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
