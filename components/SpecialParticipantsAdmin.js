'use client';
import { useEffect,useMemo,useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';

function fmt(value){if(!value)return '—';try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(value))}catch{return value}}
function statusBadge(value){const good=['valid','verified'].includes(value),bad=value==='rejected';return <span className={`status ${good?'status-ok':bad?'status-bad':'status-pending'}`}>{good?'Valid':bad?'Ditolak':'Belum lengkap'}</span>}
function parsePaste(text){
  return String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map((line,i)=>{
    const cols=line.split('\t');
    if(cols.length<4)return {row:i+1,error:'Harus 4 kolom: Nama, Email, WhatsApp, Mode'};
    return {row:i+1,full_name:cols[0]?.trim(),email:cols[1]?.trim(),whatsapp:cols[2]?.trim(),attendance_mode:cols[3]?.trim()};
  });
}

export default function SpecialParticipantsAdmin({onChanged}){
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(''),[paste,setPaste]=useState(''),[results,setResults]=useState([]),[resending,setResending]=useState('');
  async function token(){const {data}=await getSupabaseBrowser().auth.getSession();return data.session?.access_token||''}
  async function api(url,opts={}){const t=await token();const r=await fetch(url,{...opts,headers:{...(opts.headers||{}),Authorization:`Bearer ${t}`}});const j=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(j.message||'Request gagal'),{payload:j});return j}
  async function load(){try{setLoading(true);setError('');const p=await api('/api/admin/special-participants');setRows(p.participants||[])}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);

  async function create(items,form){try{setBusy(true);setError('');setNotice('');setResults([]);const j=await api('/api/admin/special-participants',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({participants:items})});setResults(j.results||[]);setNotice(`${j.created||0} peserta khusus berhasil dibuat${j.failed?`, ${j.failed} gagal`:''}. Slot kuota langsung terpakai.`);if(form)form.reset();if(items.length>1&&j.created)setPaste('');await load();onChanged?.()}catch(e){setError(e.message);if(e.payload?.results)setResults(e.payload.results)}finally{setBusy(false)}}
  async function manualSubmit(e){e.preventDefault();const form=e.currentTarget;const data=Object.fromEntries(new FormData(form));await create([data],form)}
  const parsed=useMemo(()=>parsePaste(paste),[paste]);
  async function importPaste(){const invalid=parsed.find(x=>x.error);if(invalid){setError(`Baris ${invalid.row}: ${invalid.error}`);return}if(!parsed.length){setError('Tempel data dari Excel/Google Sheets terlebih dahulu.');return}await create(parsed,null)}
  async function resend(row){try{setResending(row.id);setError('');const j=await api('/api/admin/special-participants',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'resend',registration_id:row.id})});setNotice(j.warning||'Petunjuk akun dikirim ulang ke peserta.')}catch(e){setError(e.message)}finally{setResending('')}}

  return <section className="special-participant-layout">
    <div className="panel special-participant-intro"><div><div className="eyebrow brand-blue">Pendaftaran Terbatas</div><h2>Peserta Khusus</h2><p>Tambahkan peserta yang memang diberi slot khusus tanpa membuka kembali form publik. Peserta langsung berstatus aktif dan memakai kuota mode yang dipilih.</p></div><div className="special-safe-note"><strong>Form publik tetap tertutup</strong><span>Peserta menerima email petunjuk akun, membuat password melalui Lupa Password, lalu memilih Homebase dan melengkapi profil serta dokumen dari Dashboard Peserta.</span></div></div>
    {error&&<div className="alert alert-error">{error}</div>}{notice&&<div className="alert alert-success">{notice}</div>}
    <div className="special-participant-grid">
      <form className="panel" onSubmit={manualSubmit}>
        <div className="panel-head"><div><h2>Tambah satu peserta</h2><p>Untuk kasus tambahan individual.</p></div></div>
        <div className="field"><label>Nama lengkap *</label><input name="full_name" required minLength="3" placeholder="Nama peserta"/></div>
        <div className="special-two-col"><div className="field"><label>Email *</label><input name="email" type="email" required placeholder="nama@email.com"/></div><div className="field"><label>WhatsApp *</label><input name="whatsapp" required placeholder="08... atau +62..."/></div></div>
        <div className="field"><label>Mode *</label><select name="attendance_mode" defaultValue="Online"><option value="Online">Online</option><option value="Offline">Offline</option></select></div>
        <button className="btn btn-brand-primary" disabled={busy}>{busy?'Memproses...':'Buat peserta & kirim petunjuk akun'}</button>
      </form>
      <div className="panel">
        <div className="panel-head"><div><h2>Import dari Excel / Google Sheets</h2><p>Copy 4 kolom tanpa header, lalu paste di bawah. Homebase akan dilengkapi sendiri oleh peserta dari Profil Saya.</p></div></div>
        <div className="special-import-format"><strong>Urutan kolom</strong><span>Nama → Email → WhatsApp → Mode</span><small>Mode wajib <b>Online</b> atau <b>Offline</b>. Homebase tidak diimport agar peserta memilih sendiri dari Data Homebase. Maksimal 100 peserta sekali proses.</small></div>
        <div className="field"><label>Paste data</label><textarea className="special-paste" rows="9" value={paste} onChange={e=>{setPaste(e.target.value);setError('')}} placeholder={'Ahmad Fauzan\tahmad@email.com\t08123456789\tOnline\nSiti Rahma\tsiti@email.com\t08123456780\tOffline'}/></div>
        <div className="special-import-actions"><span>{parsed.length} baris terbaca</span><button type="button" className="btn btn-brand-primary" disabled={busy||!parsed.length} onClick={importPaste}>{busy?'Memproses...':`Import ${parsed.length||''} peserta`}</button></div>
      </div>
    </div>
    {!!results.length&&<div className="panel special-results"><div className="panel-head"><div><h2>Hasil proses terakhir</h2><p>Baris yang gagal tidak membuat akun dan tidak mengambil kuota.</p></div></div><div className="special-result-list">{results.map((r,i)=><div key={`${r.row}-${i}`} className={`special-result-row ${r.ok?'ok':'bad'}`}><div><strong>Baris {r.row} · {r.name||r.email||'—'}</strong><small>{r.email} · {r.mode}</small></div><div>{r.ok?<><span className="status status-ok">Berhasil</span><small>{r.registration_code}{r.emailSent===false?' · email belum terkirim':''}</small></>:<><span className="status status-bad">Gagal</span><small>{r.message}</small></>}</div></div>)}</div></div>}
    <div className="panel special-list-panel"><div className="panel-head"><div><h2>Peserta khusus yang sudah dibuat</h2><p>{rows.length} peserta · semuanya tetap dikelola dari menu Pendaftar.</p></div><button type="button" className="btn btn-secondary btn-small" onClick={load} disabled={loading}>Refresh</button></div>{loading?<div className="empty-state">Memuat peserta khusus...</div>:!rows.length?<div className="empty-state">Belum ada peserta khusus.</div>:<div className="table-wrap"><table className="special-table"><thead><tr><th>Peserta</th><th>Mode</th><th>Homebase</th><th>Status</th><th>Dibuat</th><th>Aksi</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><strong>{r.full_name}</strong><small>{r.registration_code}<br/>{r.email} · {r.whatsapp}</small></td><td><span className="mode-pill">{r.attendance_mode}</span></td><td>{r.university||<span className="special-missing-value">Belum dilengkapi</span>}</td><td><div className="special-status-stack"><span>Dokumen {statusBadge(r.requirements_status)}</span><span>Bayar {statusBadge(r.payment_status)}</span></div></td><td><small>{fmt(r.special_enrollment_at||r.created_at)}<br/>{r.special_enrollment_by||'—'}</small></td><td><button type="button" className="btn btn-secondary btn-small" onClick={()=>resend(r)} disabled={resending===r.id}>{resending===r.id?'Mengirim...':'Kirim ulang petunjuk'}</button></td></tr>)}</tbody></table></div>}</div>
  </section>
}
