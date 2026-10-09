'use client';
import { useEffect,useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';
import { normalizeNik,nikError,formatNik } from '../lib/nik';
import { toast } from '../lib/ui-feedback';
import ActionDialog from './ActionDialog';
import NavIcon from './NavIcon';

// v0.8.5 — Kartu NIK di Profil Saya.
// Peserta SKP: wajib diisi. Peserta lain: opsional (tanpa pengingat).

function dt(v){if(!v)return '';try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v))}catch{return ''}}
async function token(){const {data}=await getSupabaseBrowser().auth.getSession();return data.session?.access_token||''}
async function api(url,opts={}){
  const t=await token();
  const r=await fetch(url,{...opts,headers:{...(opts.headers||{}),Authorization:`Bearer ${t}`,...(opts.body?{'Content-Type':'application/json'}:{})},cache:'no-store'});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.message||'Permintaan gagal.');
  return j;
}

export default function NikCard({registration,onSaved,id='nik'}){
  const reg=registration||{};
  const summary=reg.nik;
  const skp=!!reg.skp_eligible;
  const filled=!!summary?.filled;
  const test=!!reg.is_test_account||reg.lifecycle_status==='test';
  const locked=!test&&reg.lifecycle_status!=='active';
  const [editing,setEditing]=useState(false),[nik,setNik]=useState(''),[confirmNik,setConfirmNik]=useState(''),[consent,setConsent]=useState(false);
  const [touched,setTouched]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[dialog,setDialog]=useState(false);
  const [revealed,setRevealed]=useState('');

  useEffect(()=>{setRevealed('')},[summary?.updated_at]);
  if(!summary)return null; // migration 023 belum dijalankan

  const digits=normalizeNik(nik);
  const formatError=touched?nikError(digits):'';
  const confirmError=touched&&confirmNik&&normalizeNik(confirmNik)!==digits?'Belum sama dengan NIK di atas.':'';
  const showForm=!locked&&(!filled||editing);

  function reset(){setNik('');setConfirmNik('');setConsent(false);setTouched(false);setError('')}
  function submit(e){
    e.preventDefault();setTouched(true);setError('');
    const err=nikError(digits);
    if(err){setError(err);return}
    if(normalizeNik(confirmNik)!==digits){setError('Ulangi NIK belum sama dengan NIK yang diisi.');return}
    if(!consent){setError('Centang pernyataan persetujuan terlebih dahulu.');return}
    setDialog(true);
  }
  async function save(){
    try{
      setBusy(true);setError('');
      await api('/api/me/nik',{method:'POST',body:JSON.stringify({nik:digits,nik_confirm:normalizeNik(confirmNik),consent})});
      toast.success(filled?'NIK berhasil diperbarui.':'NIK berhasil disimpan.');
      setDialog(false);setEditing(false);reset();
      await onSaved?.();
    }catch(e){setDialog(false);setError(e.message)}finally{setBusy(false)}
  }
  async function toggleReveal(){
    if(revealed){setRevealed('');return}
    try{const j=await api('/api/me/nik');setRevealed(j.nik||'')}catch(e){toast.error(e.message)}
  }

  const chip=skp?(filled?<span className="status status-ok">Sudah diisi</span>:<span className="status status-bad">Wajib diisi</span>):<span className="status status-info">Opsional</span>;
  const lead=skp
    ?'Anda termasuk peserta yang diusulkan untuk SKP. NIK wajib diisi agar panitia dapat mendaftarkan SKP Anda ke Kemenkes.'
    :'Pengisian NIK tidak diwajibkan untuk Anda. Boleh dikosongkan.';

  return <section className={`participant-card nik-card ${skp&&!filled?'nik-card-required':''}`} id={id}>
    <div className="participant-card-head"><div><div className="eyebrow brand-blue">Data Identitas{skp?' · SKP':''}</div><h2>NIK (Nomor Induk Kependudukan)</h2><p>{lead}</p></div>{chip}</div>

    {filled&&!editing&&<div className="nik-current">
      <div className="nik-current-value"><small>NIK tersimpan</small><strong className="nik-mono">{revealed?formatNik(revealed):summary.masked}</strong>{summary.updated_at&&<span>Diperbarui {dt(summary.updated_at)}{summary.source==='admin'?' · diisi panitia':''}</span>}</div>
      <div className="nik-current-actions">
        <button type="button" className="btn btn-secondary btn-small" onClick={toggleReveal}><NavIcon name="eye" size={14}/>{revealed?'Sembunyikan':'Tampilkan'}</button>
        {!locked&&<button type="button" className="btn btn-secondary btn-small" onClick={()=>{reset();setEditing(true)}}><NavIcon name="edit" size={14}/>Ubah NIK</button>}
      </div>
    </div>}

    {locked&&!filled&&<div className="read-only-box">NIK tidak dapat diisi karena status pendaftaran Anda tidak aktif.</div>}

    {showForm&&<form className="nik-form" onSubmit={submit} noValidate>
      <div className="nik-form-grid">
        <div className="field"><label htmlFor="nik-input">NIK sesuai KTP{skp?' *':' (opsional)'}</label><input id="nik-input" className="nik-mono" inputMode="numeric" autoComplete="off" maxLength={24} value={nik} onChange={e=>setNik(e.target.value)} onBlur={()=>digits&&setTouched(true)} placeholder="16 digit angka" aria-invalid={!!formatError}/><small className={formatError?'danger-text':''}>{formatError||`${digits.length}/16 digit`}</small></div>
        <div className="field"><label htmlFor="nik-confirm">Ulangi NIK{skp?' *':''}</label><input id="nik-confirm" className="nik-mono" inputMode="numeric" autoComplete="off" maxLength={24} value={confirmNik} onChange={e=>setConfirmNik(e.target.value)} onPaste={e=>e.preventDefault()} placeholder="Ketik ulang NIK" aria-invalid={!!confirmError}/><small className={confirmError?'danger-text':''}>{confirmError||'Ketik ulang (tidak bisa ditempel) untuk menghindari salah ketik.'}</small></div>
      </div>
      <label className="agreement nik-consent"><input className="ui-checkbox" type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{skp?'Saya menyatakan NIK di atas benar sesuai KTP, dan setuju NIK digunakan panitia APTFI hanya untuk administrasi pelatihan ini, termasuk pendaftaran SKP ke Kemenkes.':'Saya menyatakan NIK di atas benar sesuai KTP, dan setuju NIK digunakan panitia APTFI hanya untuk administrasi pelatihan ini.'}</span></label>
      {error&&<div className="alert alert-error compact-alert">{error}</div>}
      <div className="nik-form-actions">
        {filled&&<button type="button" className="btn btn-secondary" onClick={()=>{reset();setEditing(false)}} disabled={busy}>Batal</button>}
        <button className="btn btn-brand-primary" disabled={busy}>{busy?'Menyimpan...':filled?'Simpan NIK baru':'Simpan NIK'}</button>
      </div>
      <p className="nik-privacy"><NavIcon name="shield" size={14}/>NIK tidak ditampilkan ke peserta lain dan tidak tercetak di sertifikat.</p>
    </form>}

    <ActionDialog open={dialog} title="Simpan NIK ini?" description="Pastikan setiap digit sama persis dengan KTP Anda." confirmLabel="Ya, simpan" busy={busy} onClose={()=>!busy&&setDialog(false)} onConfirm={save}>
      <div className="dialog-summary"><div><span>NIK</span><strong className="nik-mono">{formatNik(digits)}</strong></div></div>
    </ActionDialog>
  </section>;
}
