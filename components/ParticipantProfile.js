'use client';
import FeedbackBridge from './FeedbackBridge';

import { useEffect,useMemo,useRef,useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';
import UniversityCombobox from './UniversityCombobox';
import ActionDialog from './ActionDialog';

const requestLabel={email_change:'Perubahan email',attendance_mode_change:'Perubahan mode',withdrawal:'Pengunduran diri'};
const statusLabel={pending:'Menunggu review',approved:'Disetujui',rejected:'Ditolak',cancelled:'Dibatalkan',requested:'Diajukan',under_review:'Sedang direview',ready:'Siap diproses',processing:'Sedang diproses',refunded:'Sudah direfund'};
function money(v){return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v||0))}
function dt(v){if(!v)return '—';return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v))}
function badgeClass(v){return ['approved','refunded'].includes(v)?'status-ok':['rejected','cancelled'].includes(v)?'status-bad':'status-pending'}
function maskAccount(v){const s=String(v||'').replace(/\s+/g,'');if(!s)return '—';return s.length<=4?s:`•••• ${s.slice(-4)}`}

export default function ParticipantProfile({initialRegistration,onChanged}){
  const [data,setData]=useState(null);
  const [universities,setUniversities]=useState([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [refundToggle,setRefundToggle]=useState(false);
  const [profileType,setProfileType]=useState('');
  const [dialog,setDialog]=useState(null);
  const withdrawalFormRef=useRef(null);
  const refundFormRef=useRef(null);

  async function token(){const {data}=await getSupabaseBrowser().auth.getSession();return data.session?.access_token||''}
  async function api(url,opts={}){const t=await token();const r=await fetch(url,{...opts,headers:{...(opts.headers||{}),Authorization:`Bearer ${t}`}});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||'Request gagal.');return j}
  async function load(){try{setError('');const [p,u]=await Promise.all([api('/api/me/profile'),fetch('/api/universities').then(r=>r.ok?r.json():{universities:[]})]);setData(p);setProfileType(p.registration?.participant_type||'');setUniversities(u.universities||[])}catch(e){setError(e.message)}}
  useEffect(()=>{load()},[]);

  const reg=data?.registration||initialRegistration||{};
  const options=data?.options||{};
  const practice=options.practice_type||[];
  const participantTypes=options.participant_type||[];
  const pending=(data?.requests||[]).filter(x=>x.status==='pending');
  const refund=data?.refund||null;
  const profileLocked=reg.lifecycle_status!=='active';
  const registrationRejected=reg.lifecycle_status==='rejected';
  const registrationInactive=['withdrawn','rejected'].includes(reg.lifecycle_status);
  const participantRule=participantTypes.find(x=>x.value===profileType);
  const requiresPractice=!!participantRule?.meta?.requires_practice;
  const requiresTeaching=!!participantRule?.meta?.requires_teaching;
  const preview=useMemo(()=>{const prefix=reg.title_prefix||'',core=reg.name_core||reg.full_name||'',suffix=reg.title_suffix||'';return `${[prefix,core].filter(Boolean).join(' ')}${suffix?`, ${suffix}`:''}`.replace(/\s+/g,' ').trim()},[reg]);

  async function saveProfile(e){
    e.preventDefault();
    const body=Object.fromEntries(new FormData(e.currentTarget));
    try{
      setBusy(true);setError('');setNotice('');
      const j=await api('/api/me/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      setNotice(j.reviewReset?.length?'Profil tersimpan. Data profesional yang berubah dikembalikan ke status Menunggu Verifikasi.':'Profil berhasil diperbarui.');
      await load();await onChanged?.();
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  async function submitRequest(action,body,form){
    try{
      setBusy(true);setError('');setNotice('');
      await api('/api/me/self-service',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,action})});
      setNotice(action==='withdrawal'?'Pengajuan pengunduran diri berhasil dikirim ke panitia.':action==='refund'?'Pengajuan refund berhasil dikirim ke panitia.':'Pengajuan berhasil dikirim ke panitia.');
      form?.reset();
      setRefundToggle(false);
      setDialog(null);
      await load();await onChanged?.();
    }catch(err){setError(err.message)}finally{setBusy(false)}
  }

  async function requestAction(e,action){
    e.preventDefault();
    const form=e.currentTarget;
    const body=Object.fromEntries(new FormData(form));
    await submitRequest(action,body,form);
  }

  function prepareWithdrawal(e){
    e.preventDefault();
    const form=e.currentTarget;
    const body=Object.fromEntries(new FormData(form));
    body.request_refund=refundToggle;
    setDialog({type:'withdrawal',body});
  }

  function prepareRefund(e){
    e.preventDefault();
    const form=e.currentTarget;
    const body=Object.fromEntries(new FormData(form));
    setDialog({type:'refund',body});
  }

  async function cancelRequest(id){
    try{
      setBusy(true);setError('');setNotice('');
      await api('/api/me/self-service',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
      setNotice('Pengajuan dibatalkan.');
      setDialog(null);
      await load();await onChanged?.();
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  if(!data)return <section className="participant-card"><div className="participant-loading compact"><div className="spinner"/><p>{error||'Memuat profil...'}</p></div></section>;

  return <div className="profile-self-service">
    <FeedbackBridge notice={notice} error={error} onNotice={()=>setNotice('')}/>

    {profileLocked&&<div className="participant-card profile-withdrawn-banner"><div><div className="eyebrow">Status Pendaftaran</div><h2>{registrationRejected?'Pendaftaran ditolak':reg.lifecycle_status==='withdrawn'?'Mengundurkan diri':'Pengunduran diri menunggu review'}</h2><p>{registrationRejected?`Pendaftaran Anda dinyatakan tidak memenuhi persyaratan.${reg.rejected_reason?` Alasan: ${reg.rejected_reason}`:''} ${reg.payment_status==='verified'?'Karena pembayaran sudah terverifikasi, Anda masih dapat mengajukan refund di bawah.':''}`:reg.lifecycle_status==='withdrawn'?'Profil tidak dapat diedit lagi. Riwayat pendaftaran dan refund tetap dapat dipantau dari halaman ini.':'Profil dikunci sementara sampai panitia memproses pengajuan. Anda masih dapat membatalkan pengajuan yang berstatus Menunggu.'}</p></div></div>}

    <form className="participant-card profile-form-card" onSubmit={saveProfile}>
      <div className="participant-card-head"><div><div className="eyebrow brand-blue">Profil Saya</div><h2>Data peserta</h2><p>Perbarui data pribadi dan profesional. Perubahan STRA/profesi akan diverifikasi ulang.</p></div></div>
      <div className="certificate-name-preview"><small>Preview nama</small><strong>{preview||'—'}</strong><span>Nama dan gelar ini akan tercetak di sertifikat.</span></div>

      <div className="profile-section-title">Nama & kontak</div>
      <div className="profile-grid profile-name-grid">
        <div className="field profile-title-prefix"><label>Gelar depan</label><input name="title_prefix" defaultValue={reg.title_prefix||''} placeholder="Contoh: apt." disabled={busy||profileLocked}/></div>
        <div className="field profile-name-core"><label>Nama utama</label><input name="name_core" required defaultValue={reg.name_core||reg.full_name||''} disabled={busy||profileLocked}/><small>Untuk data lama, rapikan gelar yang masih menyatu di nama bila diperlukan.</small></div>
        <div className="field profile-title-suffix"><label>Gelar belakang</label><input name="title_suffix" defaultValue={reg.title_suffix||''} placeholder="S.Farm., M.Farm." disabled={busy||profileLocked}/></div>
        <div className="field profile-whatsapp"><label>WhatsApp</label><input name="whatsapp" required defaultValue={reg.whatsapp||''} disabled={busy||profileLocked}/></div>
        <div className="field profile-homebase"><label>Homebase</label><UniversityCombobox name="university" universities={universities} required defaultValue={reg.university||''} disabled={busy||profileLocked}/></div>
      </div>

      <div className="profile-section-title">Data profesional</div>
      <div className="profile-grid profile-professional-grid">
        <div className="field"><label>Nomor STRA</label><input name="stra_number" required defaultValue={reg.stra_number||''} disabled={busy||profileLocked}/><small>Jika berubah, STRA kembali menunggu verifikasi.</small></div>
        <div className="field"><label>Kategori peserta</label><select name="participant_type" value={profileType} onChange={e=>setProfileType(e.target.value)} disabled={busy||profileLocked}><option value="">Pilih kategori</option>{participantTypes.filter(x=>x.active||x.value===reg.participant_type).map(x=><option key={x.id} value={x.value}>{x.label}</option>)}</select></div>
        {requiresPractice&&<>
          <div className="field"><label>Jenis tempat praktik</label><select name="practice_type" defaultValue={reg.practice_type||''} disabled={busy||profileLocked}><option value="">Pilih</option>{practice.filter(x=>x.active||x.value===reg.practice_type).map(x=><option key={x.id} value={x.value}>{x.label}{x.min_years?` · min ${Number(x.min_years)} th`:''}</option>)}</select></div>
          <div className="field"><label>Nama tempat praktik</label><input name="practice_name" defaultValue={reg.practice_name||''} disabled={busy||profileLocked}/></div>
          <div className="field"><label>Lama praktik</label><input name="practice_years" type="number" min="0" step="0.5" defaultValue={reg.practice_years||0} disabled={busy||profileLocked}/></div>
        </>}
        {requiresTeaching&&<div className="field"><label>Lama mengajar</label><input name="teaching_years" type="number" min="0" step="0.5" defaultValue={reg.teaching_years||0} disabled={busy||profileLocked}/></div>}
      </div>
      {!profileLocked&&<div className="profile-actions"><button className="btn btn-brand-primary" disabled={busy}>{busy?'Menyimpan...':'Simpan Profil'}</button></div>}
    </form>

    <section className="participant-card self-service-card">
      <div className="participant-card-head"><div><div className="eyebrow brand-blue">Perubahan Terbatas</div><h2>Ajukan perubahan</h2><p>Email dan mode kehadiran perlu persetujuan panitia.</p></div></div>
      <div className="self-service-two-col">
        <form onSubmit={e=>requestAction(e,'email_change')} className="request-box"><h3>Ubah email login</h3><p>Email saat ini: <strong>{reg.email}</strong></p><div className="field"><label>Email baru</label><input type="email" name="new_email" required disabled={busy||profileLocked}/></div><div className="field"><label>Alasan</label><textarea name="reason" rows="2"/></div><button className="btn btn-secondary" disabled={busy||profileLocked||pending.some(x=>x.request_type==='email_change')}>Ajukan perubahan email</button></form>
        <form onSubmit={e=>requestAction(e,'attendance_mode_change')} className="request-box"><h3>Ubah mode kehadiran</h3><p>Saat ini: <strong>{reg.attendance_mode}</strong></p><div className="field"><label>Mode tujuan</label><select name="new_mode" defaultValue={reg.attendance_mode==='Online'?'Offline':'Online'} disabled={busy||profileLocked}><option>Online</option><option>Offline</option></select></div><div className="field"><label>Alasan *</label><textarea name="reason" rows="2" required/></div><button className="btn btn-secondary" disabled={busy||profileLocked||pending.some(x=>x.request_type==='attendance_mode_change')}>Ajukan perubahan mode</button></form>
      </div>
    </section>

    {!registrationInactive&&<section className="participant-card danger-zone-card">
      <div className="participant-card-head"><div><div className="eyebrow danger-text">Pengaturan Pendaftaran</div><h2>Ajukan pengunduran diri</h2><p>Pengajuan tidak langsung membatalkan pendaftaran. Panitia akan melakukan review terlebih dahulu.</p></div></div>
      <form ref={withdrawalFormRef} onSubmit={prepareWithdrawal} className="withdrawal-form">
        <div className="field"><label>Alasan pengunduran diri *</label><textarea name="reason" rows="3" required placeholder="Jelaskan alasan secara singkat."/></div>
        {reg.payment_status==='verified'&&<>
          <label className="agreement refund-toggle refund-choice-card"><input className="ui-checkbox" type="checkbox" checked={refundToggle} onChange={e=>setRefundToggle(e.target.checked)}/><span>Sekaligus ajukan refund pembayaran</span></label>
          {refundToggle&&<div className="refund-bank-grid">
            <div className="field"><label>Bank *</label><input name="bank_name" required={refundToggle} placeholder="BCA / BNI / BRI / Mandiri / lainnya"/></div>
            <div className="field"><label>Nomor rekening *</label><input name="account_number" required={refundToggle} inputMode="numeric"/></div>
            <div className="field account-holder-field"><label>Nama pemilik rekening *</label><input name="account_holder" required={refundToggle}/></div>
            <div className="refund-estimate"><small>Estimasi nilai pengajuan</small><strong>{money(reg.amount_due||1000000)}</strong><span>Nilai final ditetapkan panitia.</span></div>
          </div>}
        </>}
        <button className="btn btn-danger" disabled={busy||pending.some(x=>x.request_type==='withdrawal')}>{pending.some(x=>x.request_type==='withdrawal')?'Menunggu review panitia':'Ajukan Pengunduran Diri'}</button>
      </form>
    </section>}

    {registrationInactive&&reg.payment_status==='verified'&&!refund&&<section className="participant-card">
      <div className="participant-card-head"><div><div className="eyebrow brand-blue">Refund</div><h2>Ajukan refund</h2><p>{registrationRejected?'Pendaftaran Anda telah ditolak panitia dan pembayaran sebelumnya terverifikasi.':'Pendaftaran Anda telah berstatus mengundurkan diri dan pembayaran sebelumnya terverifikasi.'}</p></div></div>
      <form ref={refundFormRef} onSubmit={prepareRefund}>
        <div className="refund-bank-grid">
          <div className="field"><label>Bank *</label><input name="bank_name" required/></div>
          <div className="field"><label>Nomor rekening *</label><input name="account_number" required/></div>
          <div className="field account-holder-field"><label>Nama pemilik *</label><input name="account_holder" required/></div>
          <div className="field refund-note-field"><label>Catatan</label><input name="reason"/></div>
        </div>
        <button className="btn btn-brand-primary" disabled={busy}>Ajukan Refund</button>
      </form>
    </section>}

    {(data.requests?.length>0||refund)&&<section className="participant-card request-history-card">
      <div className="participant-card-head"><div><div className="eyebrow brand-blue">Riwayat</div><h2>Pengajuan & refund</h2></div></div>
      <div className="request-history-list">
        {(data.requests||[]).map(r=><article key={r.id}><div><strong>{requestLabel[r.request_type]||r.request_type}</strong><small>{dt(r.created_at)}{r.reason?` · ${r.reason}`:''}</small>{r.admin_note&&<p>Catatan panitia: {r.admin_note}</p>}</div><div className="request-history-actions"><span className={`status ${badgeClass(r.status)}`}>{statusLabel[r.status]||r.status}</span>{r.status==='pending'&&<button className="btn btn-danger btn-small request-cancel-button" type="button" onClick={()=>setDialog({type:'cancel-request',request:r})} disabled={busy}>Batalkan</button>}</div></article>)}
        {refund&&<article className="refund-history-row"><div><strong>Refund · {refund.bank_name} · {refund.account_number_masked||'rekening tersimpan'}</strong><small>Diajukan {dt(refund.requested_at)} · {money(refund.approved_amount||refund.requested_amount)}</small>{refund.admin_note&&<p>Catatan panitia: {refund.admin_note}</p>}{refund.transfer_reference&&<p>Referensi: {refund.transfer_reference}</p>}</div><span className={`status ${badgeClass(refund.status)}`}>{statusLabel[refund.status]||refund.status}</span></article>}
      </div>
    </section>}

    <ActionDialog
      open={dialog?.type==='withdrawal'}
      title="Konfirmasi pengunduran diri"
      description="Pengajuan ini akan dikirim ke panitia untuk direview. Pendaftaran belum langsung dibatalkan sampai panitia menyetujuinya."
      tone="danger"
      confirmLabel="Ya, lanjutkan pengajuan"
      busy={busy}
      onClose={()=>!busy&&setDialog(null)}
      onConfirm={()=>submitRequest('withdrawal',dialog?.body||{},withdrawalFormRef.current)}
    >
      <div className="dialog-summary">
        <div><span>Refund</span><strong>{dialog?.body?.request_refund?'Ya, diajukan':'Tidak'}</strong></div>
        {dialog?.body?.request_refund&&<><div><span>Bank</span><strong>{dialog.body.bank_name||'—'}</strong></div><div><span>Nomor rekening</span><strong>{maskAccount(dialog.body.account_number)}</strong></div><div><span>Pemilik rekening</span><strong>{dialog.body.account_holder||'—'}</strong></div></>}
      </div>
    </ActionDialog>

    <ActionDialog
      open={dialog?.type==='refund'}
      title="Konfirmasi pengajuan refund"
      description="Pastikan data rekening tujuan sudah benar sebelum pengajuan dikirim ke panitia."
      tone="default"
      confirmLabel="Ya, ajukan refund"
      busy={busy}
      onClose={()=>!busy&&setDialog(null)}
      onConfirm={()=>submitRequest('refund',dialog?.body||{},refundFormRef.current)}
    >
      <div className="dialog-summary"><div><span>Bank</span><strong>{dialog?.body?.bank_name||'—'}</strong></div><div><span>Nomor rekening</span><strong>{maskAccount(dialog?.body?.account_number)}</strong></div><div><span>Pemilik rekening</span><strong>{dialog?.body?.account_holder||'—'}</strong></div></div>
    </ActionDialog>

    <ActionDialog
      open={dialog?.type==='cancel-request'}
      title="Batalkan pengajuan?"
      description="Pengajuan yang masih menunggu review akan dibatalkan dan tidak akan diproses panitia."
      tone="danger"
      confirmLabel="Ya, batalkan"
      busy={busy}
      onClose={()=>!busy&&setDialog(null)}
      onConfirm={()=>cancelRequest(dialog?.request?.id)}
    />
  </div>;
}
