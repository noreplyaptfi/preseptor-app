'use client';
import { useEffect,useMemo,useState } from 'react';
import { confirmDialog,toast } from '../lib/ui-feedback';
import { nikError,normalizeNik,formatNik,nikFilled,extractRegistrationCodes } from '../lib/nik';
import { isActiveRegistration } from '../lib/registration-lifecycle';
import ActionDialog from './ActionDialog';
import NavIcon from './NavIcon';

// v0.8.5 — Peserta SKP & NIK di dashboard panitia.
//   SkpOverviewPanel  ringkasan di halaman Ringkasan
//   SkpChips          penanda SKP / NIK di tabel pendaftar
//   SkpDetailSection  bagian "SKP & NIK" di popup detail peserta
//   SkpBulkDialog     tandai / batalkan SKP banyak peserta via Nomor Pendaftaran

function fmt(v){if(!v)return '—';try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v))}catch{return '—'}}

export function skpReady(rows){return (rows||[]).some(r=>Object.prototype.hasOwnProperty.call(r,'skp_eligible'))}

export function SkpOverviewPanel({rows,onShow,onRemind,canRemind}){
  const active=(rows||[]).filter(r=>isActiveRegistration(r.lifecycle_status)&&!r.is_test_account);
  const skp=active.filter(r=>r.skp_eligible);
  const filled=skp.filter(nikFilled).length;
  const missing=skp.length-filled;
  const pct=skp.length?Math.round(filled/skp.length*100):0;
  return <section className="panel skp-overview">
    <div className="panel-head"><div><h2>Peserta SKP &amp; NIK</h2><p>Peserta SKP wajib mengisi NIK dan mendapat pengingat di dashboard. Peserta lain tidak mendapat pengingat.</p></div></div>
    <div className="skp-overview-grid">
      <button type="button" onClick={()=>onShow('skp')}><span>Peserta SKP</span><strong>{skp.length}</strong><small>dari {active.length} peserta aktif</small></button>
      <button type="button" className="ok" onClick={()=>onShow('skp_filled')}><span>NIK sudah diisi</span><strong>{filled}</strong><small>{pct}% peserta SKP</small></button>
      <button type="button" className={missing?'warn':''} onClick={()=>onShow('skp_missing')}><span>NIK belum diisi</span><strong>{missing}</strong><small>Lihat daftar →</small></button>
      <button type="button" onClick={()=>onShow('non_skp')}><span>Non-SKP</span><strong>{active.length-skp.length}</strong><small>NIK opsional</small></button>
    </div>
    {skp.length>0&&<div className="skp-progress" aria-label={`${pct}% NIK terisi`}><span style={{width:`${pct}%`}}/></div>}
    {canRemind&&missing>0&&<div className="skp-overview-actions"><button type="button" className="btn btn-secondary btn-small" onClick={onRemind}><NavIcon name="megaphone" size={14}/>Kirim pengingat ke {missing} peserta</button></div>}
  </section>;
}

export function SkpChips({row}){
  if(!row?.skp_eligible)return null;
  return <span className="skp-chips"><span className="skp-chip" title="Peserta SKP">SKP</span>{nikFilled(row)?<span className="nik-chip ok" title={`NIK ${row.nik_masked||''}`}>NIK ✓</span>:<span className="nik-chip missing">NIK belum</span>}</span>;
}

export function SkpDetailSection({row,canManage,api,onChanged}){
  const [busy,setBusy]=useState(false),[full,setFull]=useState(''),[editing,setEditing]=useState(false),[value,setValue]=useState(''),[error,setError]=useState('');
  useEffect(()=>{setFull('');setEditing(false);setValue('');setError('')},[row?.id,row?.nik_updated_at]);
  const skp=!!row.skp_eligible,filled=nikFilled(row);

  async function reveal(){
    if(full){setFull('');return}
    try{const j=await api(`/api/admin/skp?registrationId=${row.id}`);setFull(j.nik||'')}catch(e){toast.error(e.message)}
  }
  async function toggleSkp(){
    const ok=await confirmDialog(skp
      ?{title:'Keluarkan dari daftar SKP?',description:`${row.full_name} tidak lagi diminta mengisi NIK dan pengingat di dashboardnya hilang. NIK yang sudah diisi tetap tersimpan.`,confirmLabel:'Ya, keluarkan',tone:'danger'}
      :{title:'Tandai sebagai peserta SKP?',description:`${row.full_name} akan diminta mengisi NIK (pengingat tampil di dashboard peserta).`,confirmLabel:'Ya, tandai SKP'});
    if(!ok)return;
    try{setBusy(true);await api('/api/admin/skp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'set_flag',registrationId:row.id,eligible:!skp})});toast.success(skp?'Peserta dikeluarkan dari daftar SKP.':'Peserta ditandai SKP.');await onChanged?.()}
    catch(e){toast.error(e.message)}finally{setBusy(false)}
  }
  async function saveNik(e){
    e.preventDefault();
    const nik=normalizeNik(value),err=nikError(nik);
    if(err){setError(err);return}
    const ok=await confirmDialog({title:filled?'Ganti NIK peserta?':'Simpan NIK peserta?',description:`NIK ${formatNik(nik)} akan disimpan untuk ${row.full_name}. Pastikan sesuai KTP peserta.`,confirmLabel:'Ya, simpan'});
    if(!ok)return;
    try{setBusy(true);setError('');await api('/api/admin/skp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'set_nik',registrationId:row.id,nik})});toast.success('NIK tersimpan.');setEditing(false);setValue('');await onChanged?.()}
    catch(e2){setError(e2.message)}finally{setBusy(false)}
  }
  async function clearNik(){
    const ok=await confirmDialog({title:'Hapus NIK peserta?',description:`NIK ${row.full_name} akan dihapus.${skp?' Peserta SKP akan kembali mendapat pengingat untuk mengisi NIK.':''}`,confirmLabel:'Ya, hapus',tone:'danger'});
    if(!ok)return;
    try{setBusy(true);await api('/api/admin/skp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'clear_nik',registrationId:row.id})});toast.success('NIK dihapus.');await onChanged?.()}
    catch(e){toast.error(e.message)}finally{setBusy(false)}
  }

  return <section className="skp-detail">
    <div className="skp-detail-head"><h3>SKP &amp; NIK</h3>{canManage&&<button type="button" className={`btn btn-small ${skp?'btn-secondary':'btn-brand-primary'}`} onClick={toggleSkp} disabled={busy}>{skp?'Keluarkan dari SKP':'Tandai SKP'}</button>}</div>
    <div className="participant-detail-grid">
      <div className="participant-detail-item"><span>Status SKP</span>{skp?<strong><span className="skp-chip">SKP</span> Diusulkan SKP</strong>:<strong>Non-SKP</strong>}</div>
      <div className="participant-detail-item"><span>NIK{skp?' (wajib)':' (opsional)'}</span>
        {filled?<strong className="nik-mono">{full?formatNik(full):row.nik_masked}</strong>:<strong className={skp?'danger-text':''}>Belum diisi</strong>}
        {filled&&<small className="muted">Diperbarui {fmt(row.nik_updated_at)}{row.nik_source==='admin'?' · oleh panitia':' · oleh peserta'}</small>}
      </div>
    </div>
    {canManage&&!editing&&<div className="skp-detail-actions">
      {filled&&<button type="button" className="btn btn-secondary btn-small" onClick={reveal} disabled={busy}><NavIcon name="eye" size={14}/>{full?'Sembunyikan NIK':'Tampilkan NIK'}</button>}
      <button type="button" className="btn btn-secondary btn-small" onClick={()=>{setEditing(true);setError('')}} disabled={busy}><NavIcon name="edit" size={14}/>{filled?'Ubah NIK':'Isi NIK'}</button>
      {filled&&<button type="button" className="btn btn-danger btn-small" onClick={clearNik} disabled={busy}>Hapus NIK</button>}
    </div>}
    {canManage&&editing&&<form className="skp-nik-form" onSubmit={saveNik} noValidate>
      <div className="field"><label>NIK peserta (16 digit)</label><input className="nik-mono" inputMode="numeric" autoComplete="off" maxLength={24} value={value} onChange={e=>{setValue(e.target.value);setError('')}} placeholder="Sesuai KTP peserta" autoFocus/><small>{normalizeNik(value).length}/16 digit · tercatat di audit log sebagai diisi panitia</small></div>
      {error&&<div className="alert alert-error compact-alert">{error}</div>}
      <div className="skp-detail-actions"><button type="button" className="btn btn-secondary btn-small" onClick={()=>{setEditing(false);setValue('');setError('')}} disabled={busy}>Batal</button><button className="btn btn-brand-primary btn-small" disabled={busy}>{busy?'Menyimpan...':'Simpan NIK'}</button></div>
    </form>}
    {!canManage&&<p className="muted skp-readonly-note">Hanya Super Admin dan Admin Event yang dapat melihat NIK lengkap atau mengubah status SKP.</p>}
  </section>;
}

export function SkpBulkDialog({open,onClose,api,onDone}){
  const [text,setText]=useState(''),[eligible,setEligible]=useState(true),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const codes=useMemo(()=>extractRegistrationCodes(text),[text]);
  useEffect(()=>{if(!open){setText('');setEligible(true);setPreview(null);setError('')}},[open]);
  useEffect(()=>{setPreview(null)},[text,eligible]);
  if(!open)return null;
  const post=body=>api('/api/admin/skp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  async function check(){
    try{setBusy(true);setError('');setPreview(await post({action:'bulk',codes,eligible,dryRun:true}))}catch(e){setError(e.message)}finally{setBusy(false)}
  }
  async function apply(){
    try{setBusy(true);setError('');const j=await post({action:'bulk',codes,eligible});toast.success(`${j.updated} peserta ${eligible?'ditandai SKP':'dikeluarkan dari SKP'}.${j.notFound?.length?` ${j.notFound.length} nomor tidak ditemukan.`:''}`);await onDone?.();onClose()}
    catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <ActionDialog open title="Tandai SKP sekaligus" description="Tempel Nomor Pendaftaran (boleh satu per baris, dipisah koma, atau salinan kolom dari Excel). Nomor dikenali otomatis." confirmLabel={preview?(preview.toChange?`Proses ${preview.toChange} peserta`:'Tidak ada perubahan'):'Periksa dulu'} confirmDisabled={!codes.length||(preview&&!preview.toChange)} busy={busy} onClose={()=>!busy&&onClose()} onConfirm={preview?apply:check}>
    <div className="skp-bulk">
      <div className="segmented skp-bulk-mode" role="radiogroup" aria-label="Aksi">
        <button type="button" role="radio" aria-checked={eligible} className={eligible?'active':''} onClick={()=>setEligible(true)}>Tandai SKP</button>
        <button type="button" role="radio" aria-checked={!eligible} className={!eligible?'active':''} onClick={()=>setEligible(false)}>Keluarkan dari SKP</button>
      </div>
      <div className="field dialog-field"><label>Nomor Pendaftaran</label><textarea rows="6" value={text} onChange={e=>setText(e.target.value)} placeholder={'APT-PRS-20260918-J5HLVY\nAPT-PRS-20260926-01062\n…'}/><small>{codes.length} nomor dikenali</small></div>
      {preview&&<div className="dialog-summary">
        <div><span>Ditemukan</span><strong>{preview.found} dari {preview.total}</strong></div>
        <div><span>{eligible?'Akan ditandai SKP':'Akan dikeluarkan dari SKP'}</span><strong>{preview.toChange}</strong></div>
        <div><span>Sudah sesuai (dilewati)</span><strong>{preview.unchanged}</strong></div>
        {preview.inactive>0&&<div><span>Ditolak / mengundurkan diri</span><strong>{preview.inactive}</strong></div>}
        {preview.notFound?.length>0&&<div><span>Tidak ditemukan</span><strong className="skp-notfound">{preview.notFound.join(', ')}</strong></div>}
      </div>}
      {error&&<div className="alert alert-error compact-alert">{error}</div>}
    </div>
  </ActionDialog>;
}
