'use client';

import { useEffect,useMemo,useRef,useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';
import ActionDialog from './ActionDialog';

const labels={email_change:'Perubahan email',attendance_mode_change:'Perubahan mode',withdrawal:'Pengunduran diri'};
const statuses={pending:'Menunggu',approved:'Disetujui',rejected:'Ditolak',cancelled:'Dibatalkan'};
function dt(v){return v?new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v)):'—'}
function maskAccount(v){const s=String(v||'').replace(/\s+/g,'');return s.length>4?`•••• ${s.slice(-4)}`:s||'—'}

export default function SelfServiceRequestsAdmin({participants=[],onChanged}){
  const [rows,setRows]=useState([]);
  const [filter,setFilter]=useState('pending');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [createRefund,setCreateRefund]=useState(false);
  const [reviewDialog,setReviewDialog]=useState(null);
  const [createDialog,setCreateDialog]=useState(null);
  const createFormRef=useRef(null);

  async function token(){const {data}=await getSupabaseBrowser().auth.getSession();return data.session?.access_token||''}
  async function api(url,opts={}){const t=await token();const r=await fetch(url,{...opts,headers:{...(opts.headers||{}),Authorization:`Bearer ${t}`}});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||'Request gagal.');return j}
  async function load(){try{const j=await api('/api/admin/self-service');setRows(j.requests||[])}catch(e){setError(e.message)}}
  useEffect(()=>{load()},[]);

  const shown=useMemo(()=>rows.filter(x=>filter==='all'||x.status===filter),[rows,filter]);

  async function submitDecision(){
    const row=reviewDialog?.row,decision=reviewDialog?.decision,note=reviewDialog?.note||'';
    if(!row||!decision)return;
    if(decision==='reject'&&!note.trim())return;
    try{
      setBusy(true);setError('');setNotice('');
      await api('/api/admin/self-service',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:row.id,decision,note})});
      setNotice(decision==='approve'?'Pengajuan disetujui.':'Pengajuan ditolak.');
      setReviewDialog(null);
      await load();
      await onChanged?.();
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  function prepareWithdrawal(e){
    e.preventDefault();
    const body=Object.fromEntries(new FormData(e.currentTarget));
    body.type='withdrawal';
    body.request_refund=createRefund;
    setCreateDialog(body);
  }

  async function submitWithdrawal(){
    if(!createDialog)return;
    try{
      setBusy(true);setError('');setNotice('');
      await api('/api/admin/self-service',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(createDialog)});
      setNotice('Pengajuan pengunduran diri atas nama peserta berhasil dibuat.');
      createFormRef.current?.reset();
      setCreateRefund(false);
      setCreateDialog(null);
      await load();
      await onChanged?.();
    }catch(err){setError(err.message)}finally{setBusy(false)}
  }

  const createParticipant=participants.find(p=>p.id===createDialog?.registrationId);

  return <div className="request-admin-layout">
    {error&&<div className="alert alert-error request-admin-feedback">{error}</div>}
    {notice&&<div className="alert alert-success request-admin-feedback">{notice}</div>}

    <section className="panel request-admin-list">
      <div className="panel-head"><div><h2>Permintaan Peserta</h2><p>Review perubahan email, mode kehadiran, dan pengunduran diri.</p></div><select className="ui-select compact-select" value={filter} onChange={e=>setFilter(e.target.value)}><option value="pending">Menunggu review</option><option value="approved">Disetujui</option><option value="rejected">Ditolak</option><option value="cancelled">Dibatalkan</option><option value="all">Semua</option></select></div>
      {!shown.length?<div className="empty-state compact"><h3>Tidak ada pengajuan</h3><p>Pengajuan peserta akan tampil di sini.</p></div>:<div className="request-admin-rows">{shown.map(r=><article key={r.id} className="request-admin-row">
        <div className="request-admin-main">
          <div className="request-admin-title"><strong>{r.registration?.full_name||'Peserta'}</strong><span>{r.registration?.registration_code}</span></div>
          <h3>{labels[r.request_type]||r.request_type}</h3>
          <p>{r.reason||'Tanpa alasan tambahan.'}</p>
          <div className="request-payload">{r.request_type==='email_change'&&<>Email baru: <strong>{r.payload?.new_email}</strong></>}{r.request_type==='attendance_mode_change'&&<>Mode: <strong>{r.registration?.attendance_mode} → {r.payload?.new_mode}</strong></>}{r.request_type==='withdrawal'&&<>Refund: <strong>{r.payload?.request_refund?'Diajukan':'Tidak diajukan'}</strong></>}</div>
          <small>{dt(r.created_at)} · diajukan oleh {r.requested_by_type==='admin'?'admin':'peserta'}</small>
          {r.admin_note&&<div className="admin-note compact"><strong>Catatan review</strong><p>{r.admin_note}</p></div>}
        </div>
        <div className="request-admin-actions"><span className={`status ${r.status==='approved'?'status-ok':r.status==='rejected'?'status-bad':'status-pending'}`}>{statuses[r.status]||r.status}</span>{r.status==='pending'&&<><button className="btn btn-brand-primary btn-small" disabled={busy} onClick={()=>setReviewDialog({row:r,decision:'approve',note:''})}>Setujui</button><button className="btn btn-danger btn-small" disabled={busy} onClick={()=>setReviewDialog({row:r,decision:'reject',note:''})}>Tolak</button></>}</div>
      </article>)}</div>}
    </section>

    <form ref={createFormRef} className="panel request-admin-create" onSubmit={prepareWithdrawal}>
      <div className="panel-head"><div><h2>Ajukan atas nama peserta</h2><p>Dipakai jika peserta menghubungi panitia untuk pengunduran diri.</p></div></div>
      <div className="field"><label>Peserta</label><select name="registrationId" required defaultValue=""><option value="" disabled>Pilih peserta</option>{participants.filter(p=>p.lifecycle_status!=='withdrawn').map(p=><option key={p.id} value={p.id}>{p.registration_code} · {p.full_name}</option>)}</select></div>
      <div className="field"><label>Alasan *</label><textarea name="reason" rows="3" required/></div>
      <label className="agreement refund-toggle refund-choice-card"><input className="ui-checkbox" type="checkbox" checked={createRefund} onChange={e=>setCreateRefund(e.target.checked)}/><span>Sekaligus ajukan refund</span></label>
      {createRefund&&<div className="refund-bank-grid request-refund-grid"><div className="field"><label>Bank</label><input name="bank_name" required/></div><div className="field"><label>No. rekening</label><input name="account_number" required/></div><div className="field account-holder-field"><label>Pemilik rekening</label><input name="account_holder" required/></div></div>}
      <button className="btn btn-brand-primary request-create-submit" disabled={busy}>Buat Pengajuan</button>
    </form>

    <ActionDialog
      open={!!reviewDialog}
      title={reviewDialog?.decision==='reject'?'Tolak pengajuan?':'Setujui pengajuan?'}
      description={reviewDialog?.decision==='reject'?'Masukkan alasan yang jelas. Catatan ini akan tersimpan sebagai bagian dari riwayat pengajuan.':'Pastikan data pengajuan sudah diperiksa sebelum disetujui.'}
      tone={reviewDialog?.decision==='reject'?'danger':'success'}
      confirmLabel={reviewDialog?.decision==='reject'?'Ya, tolak pengajuan':'Ya, setujui'}
      busy={busy}
      confirmDisabled={reviewDialog?.decision==='reject'&&!reviewDialog?.note?.trim()}
      onClose={()=>!busy&&setReviewDialog(null)}
      onConfirm={submitDecision}
    >
      <div className="dialog-request-summary"><strong>{reviewDialog?.row?.registration?.full_name||'Peserta'}</strong><span>{labels[reviewDialog?.row?.request_type]||reviewDialog?.row?.request_type}</span>{reviewDialog?.row?.reason&&<p>{reviewDialog.row.reason}</p>}</div>
      <div className="field dialog-field"><label>{reviewDialog?.decision==='reject'?'Alasan penolakan *':'Catatan panitia (opsional)'}</label><textarea rows="4" value={reviewDialog?.note||''} onChange={e=>setReviewDialog(v=>({...v,note:e.target.value}))} placeholder={reviewDialog?.decision==='reject'?'Contoh: data belum sesuai atau permintaan belum dapat diproses.':'Tambahkan catatan bila diperlukan.'}/></div>
    </ActionDialog>

    <ActionDialog
      open={!!createDialog}
      title="Konfirmasi pengunduran diri peserta"
      description="Aksi ini membuat pengajuan atas nama peserta. Panitia tetap perlu memprosesnya melalui daftar permintaan."
      tone="danger"
      confirmLabel="Ya, buat pengajuan"
      busy={busy}
      onClose={()=>!busy&&setCreateDialog(null)}
      onConfirm={submitWithdrawal}
    >
      <div className="dialog-summary"><div><span>Peserta</span><strong>{createParticipant?.full_name||'—'}</strong></div><div><span>Nomor registrasi</span><strong>{createParticipant?.registration_code||'—'}</strong></div><div><span>Refund</span><strong>{createDialog?.request_refund?'Ya, diajukan':'Tidak'}</strong></div>{createDialog?.request_refund&&<><div><span>Bank</span><strong>{createDialog.bank_name||'—'}</strong></div><div><span>No. rekening</span><strong>{maskAccount(createDialog.account_number)}</strong></div><div><span>Pemilik</span><strong>{createDialog.account_holder||'—'}</strong></div></>}</div>
    </ActionDialog>
  </div>;
}
