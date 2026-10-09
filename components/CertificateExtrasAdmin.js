'use client';
import { useEffect,useState } from 'react';
import { confirmDialog,toast } from '../lib/ui-feedback';
import { downloadWithAuth } from '../lib/download-client';
import ActionDialog from './ActionDialog';
import NavIcon from './NavIcon';

// v0.8.6 — Bagian tambahan menu Sertifikat:
//   RecipientsPanel   pemateri & moderator (tambah, ubah, urutkan, unduh, cabut)
//   SignatureCard     unggah gambar tanda tangan & cap (dirapikan otomatis di browser)
//   NumberingDialog   siapkan nomor sekaligus: pemateri → moderator → peserta (abjad)

const ROLE_LABEL={speaker:'Pemateri',moderator:'Moderator'};
const MODE_LABEL={'':'Tanpa keterangan',Offline:'Luring (Padang)',Online:'Daring (Zoom)'};
function fmt(v){if(!v)return '—';try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v))}catch{return v}}
const EMPTY={id:null,role:'speaker',name:'',language:'id',topic:'',attendance_mode:''};

export function RecipientsPanel({recipients,api,busy,setBusy,onChanged,onPreview}){
  const [form,setForm]=useState(null),[revoke,setRevoke]=useState(null);
  if(recipients===null)return <section className="panel"><div className="alert alert-warning">Fitur pemateri &amp; moderator belum aktif. Jalankan migration <b>024_certificate_recipients.sql</b> terlebih dahulu.</div></section>;
  const post=body=>api('/api/admin/certificates/recipients',{method:'POST',body:JSON.stringify(body)});
  async function run(fn,ok){try{setBusy(true);await fn();if(ok)toast.success(ok);await onChanged()}catch(e){toast.error(e.message)}finally{setBusy(false)}}
  async function save(){
    const f=form;
    await run(async()=>{await post(f.id?{action:'update',id:f.id,name:f.name,language:f.language,topic:f.topic,attendance_mode:f.attendance_mode}:{action:'create',...f});setForm(null)},f.id?'Data penerima diperbarui.':'Penerima ditambahkan.');
  }
  async function remove(r){
    if(!await confirmDialog({title:'Hapus penerima?',description:`${r.name} dihapus dari daftar ${ROLE_LABEL[r.role].toLowerCase()}.`,confirmLabel:'Hapus',tone:'danger'}))return;
    run(()=>post({action:'delete',id:r.id}),'Penerima dihapus.');
  }
  async function restore(r){
    if(!await confirmDialog({title:'Pulihkan sertifikat?',description:`Sertifikat ${r.name} kembali berlaku.`,confirmLabel:'Pulihkan'}))return;
    run(()=>post({action:'restore',id:r.id}),'Sertifikat dipulihkan.');
  }
  async function download(r){
    try{setBusy(true);await downloadWithAuth(`/api/admin/certificates/pdf?recipientId=${encodeURIComponent(r.id)}`);toast.success('Sertifikat diunduh.');await onChanged()}
    catch(e){toast.error(e.message)}finally{setBusy(false)}
  }

  const groups=['speaker','moderator'].map(role=>({role,rows:recipients.filter(r=>r.role===role)}));
  return <section className="panel recipients-panel">
    <div className="asm-toolbar">
      <div><h2>Pemateri &amp; moderator</h2><p>Sertifikat 2 halaman (halaman 2 berisi tabel materi). Nomor mengikuti urutan nomor yang sama dengan peserta: pemateri dulu, lalu moderator. Bahasa Inggris untuk penerima luar negeri.</p></div>
      <div className="asm-toolbar-actions">
        <button type="button" className="btn btn-secondary btn-small" onClick={()=>onPreview('speaker','id')} disabled={busy}><NavIcon name="eye" size={14}/> Contoh</button>
        <button type="button" className="btn btn-secondary btn-small" onClick={()=>onPreview('speaker','en')} disabled={busy}><NavIcon name="eye" size={14}/> Contoh (Inggris)</button>
        <button type="button" className="btn btn-brand-primary btn-small" onClick={()=>setForm({...EMPTY})} disabled={busy}>Tambah penerima</button>
      </div>
    </div>
    {groups.map(g=><div key={g.role} className="recipient-group">
      <h3>{ROLE_LABEL[g.role]} <span>{g.rows.length}</span></h3>
      {!g.rows.length?<p className="muted recipient-empty">Belum ada {ROLE_LABEL[g.role].toLowerCase()}.</p>:<div className="asm-table-wrap"><table className="asm-table recipient-table">
        <thead><tr><th className="num">#</th><th>Nama</th><th>Materi / sesi</th><th>Sertifikat</th><th/></tr></thead>
        <tbody>{g.rows.map((r,i)=><tr key={r.id} className={r.certificate?.revoked_at?'row-muted':''}>
          <td className="num"><div className="recipient-move"><button type="button" aria-label="Naik" onClick={()=>run(()=>post({action:'move',id:r.id,dir:'up'}))} disabled={busy||i===0}>▲</button><button type="button" aria-label="Turun" onClick={()=>run(()=>post({action:'move',id:r.id,dir:'down'}))} disabled={busy||i===g.rows.length-1}>▼</button></div></td>
          <td><strong>{r.name}</strong><small>{r.language==='en'?<span className="status status-info">Inggris</span>:'Indonesia'}{r.attendance_mode?` · ${MODE_LABEL[r.attendance_mode]}`:''}</small></td>
          <td>{r.topic?<span>{r.topic}</span>:<small>—</small>}</td>
          <td>{r.certificate?<><strong className="cert-no">{r.certificate.number}</strong><small>{r.certificate.revoked_at?`Dicabut · ${r.certificate.revoke_reason||''}`:`${r.certificate.download_count}× diunduh`}</small></>:<small>Belum bernomor</small>}</td>
          <td className="asm-row-action"><div className="cert-actions">
            {!r.certificate?.revoked_at&&<button className="btn btn-secondary btn-small" onClick={()=>download(r)} disabled={busy}><NavIcon name="download" size={14}/> Unduh</button>}
            <button className="link-button" onClick={()=>setForm({id:r.id,role:r.role,name:r.name,language:r.language,topic:r.topic||'',attendance_mode:r.attendance_mode||''})} disabled={busy}>Ubah</button>
            {!r.certificate&&<button className="link-button danger-link" onClick={()=>remove(r)} disabled={busy}>Hapus</button>}
            {r.certificate&&!r.certificate.revoked_at&&<button className="link-button danger-link" onClick={()=>setRevoke({row:r,reason:''})} disabled={busy}>Cabut</button>}
            {r.certificate?.revoked_at&&<button className="link-button" onClick={()=>restore(r)} disabled={busy}>Pulihkan</button>}
          </div></td>
        </tr>)}</tbody>
      </table></div>}
    </div>)}
    <p className="cert-legend">Unduh pertama memberi nomor bila penerima belum bernomor. Untuk urutan resmi (pemateri → moderator → peserta), pakai <b>Siapkan nomor</b> di tab Peserta sebelum mengunduh.</p>

    <ActionDialog open={!!form} title={form?.id?'Ubah penerima':'Tambah penerima'} description="Tulis nama lengkap beserta gelar persis seperti yang akan tercetak." confirmLabel={form?.id?'Simpan':'Tambah'} confirmDisabled={String(form?.name||'').trim().length<3} busy={busy} onClose={()=>!busy&&setForm(null)} onConfirm={save}>
      {form&&<div className="recipient-form">
        {!form.id&&<div className="field dialog-field"><label>Peran</label><select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}><option value="speaker">Pemateri</option><option value="moderator">Moderator</option></select></div>}
        <div className="field dialog-field"><label>Nama lengkap &amp; gelar *</label><input value={form.name} maxLength={160} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Contoh: Prof. Dr. apt. Nama, M.Si."/></div>
        <div className="field dialog-field"><label>Bahasa sertifikat</label><select value={form.language} onChange={e=>setForm(f=>({...f,language:e.target.value}))}><option value="id">Indonesia</option><option value="en">Inggris</option></select></div>
        <div className="field dialog-field"><label>{form.role==='moderator'?'Sesi (opsional)':'Materi (opsional)'}</label><input value={form.topic} maxLength={200} onChange={e=>setForm(f=>({...f,topic:e.target.value}))} placeholder="Kosongkan bila tidak perlu dicetak"/><small>Bila diisi, tercetak di bawah nama kegiatan: {form.role==='moderator'?'“pada sesi …”':'“dengan materi …”'}.</small></div>
        <div className="field dialog-field"><label>Keterangan pelaksanaan</label><select value={form.attendance_mode} onChange={e=>setForm(f=>({...f,attendance_mode:e.target.value}))}>{Object.entries(MODE_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
      </div>}
    </ActionDialog>

    <ActionDialog open={!!revoke} title="Cabut sertifikat?" description="Sertifikat tidak bisa diunduh lagi dan halaman verifikasi menampilkan status dicabut. Nomor tetap tercatat." tone="danger" confirmLabel="Ya, cabut" confirmDisabled={String(revoke?.reason||'').trim().length<5} busy={busy} onClose={()=>!busy&&setRevoke(null)} onConfirm={()=>run(async()=>{await post({action:'revoke',id:revoke.row.id,reason:revoke.reason});setRevoke(null)},'Sertifikat dicabut.')}>
      <div className="dialog-summary"><div><span>Penerima</span><strong>{revoke?.row?.name||'—'}</strong></div></div>
      <div className="field dialog-field"><label>Alasan *</label><textarea rows="3" value={revoke?.reason||''} onChange={e=>setRevoke(v=>({...v,reason:e.target.value}))}/></div>
    </ActionDialog>
  </section>;
}

// Rapikan gambar di browser: buang latar putih (bila tidak transparan), potong tepi kosong, perkecil ke lebar maks. 1400 px.
async function prepareSignature(file){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('Gambar tidak bisa dibaca.'));i.src=url});
    const cv=document.createElement('canvas');cv.width=img.naturalWidth;cv.height=img.naturalHeight;
    const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
    const d=ctx.getImageData(0,0,cv.width,cv.height),px=d.data;
    let transparent=false;
    for(let i=3;i<px.length;i+=4){if(px[i]<250){transparent=true;break}}
    if(!transparent){
      for(let i=0;i<px.length;i+=4){
        const m=Math.min(px[i],px[i+1],px[i+2]);
        if(m>=235)px[i+3]=0;else if(m>200)px[i+3]=Math.round(255*(235-m)/35);
      }
      ctx.putImageData(d,0,0);
    }
    let x0=cv.width,y0=cv.height,x1=-1,y1=-1;
    for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){if(px[(y*cv.width+x)*4+3]>8){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
    if(x1<0)throw new Error('Gambar kosong.');
    const pad=12;x0=Math.max(0,x0-pad);y0=Math.max(0,y0-pad);x1=Math.min(cv.width-1,x1+pad);y1=Math.min(cv.height-1,y1+pad);
    const w=x1-x0+1,h=y1-y0+1,scale=Math.min(1,1400/w);
    const out=document.createElement('canvas');out.width=Math.round(w*scale);out.height=Math.round(h*scale);
    const octx=out.getContext('2d');octx.imageSmoothingQuality='high';
    octx.drawImage(cv,x0,y0,w,h,0,0,out.width,out.height);
    return {dataUrl:out.toDataURL('image/png'),width:out.width,height:out.height,removedBackground:!transparent};
  }finally{URL.revokeObjectURL(url)}
}

export function SignatureCard({api,busy,setBusy,onChanged,signature}){
  const [info,setInfo]=useState(null),[pending,setPending]=useState(null);
  async function load(){try{setInfo(await api('/api/admin/certificates/signature'))}catch(e){setInfo({exists:false,error:e.message})}}
  useEffect(()=>{load()},[signature?.updated_at,signature?.exists]);
  async function pick(e){
    const file=e.target.files?.[0];e.target.value='';
    if(!file)return;
    if(!/^image\/(png|jpeg)$/.test(file.type)){toast.error('Pilih gambar PNG atau JPG.');return}
    try{setPending(await prepareSignature(file))}catch(err){toast.error(err.message)}
  }
  async function upload(){
    try{setBusy(true);await api('/api/admin/certificates/signature',{method:'POST',body:JSON.stringify({png:pending.dataUrl})});toast.success('Tanda tangan & cap disimpan.');setPending(null);await onChanged()}
    catch(e){toast.error(e.message)}finally{setBusy(false)}
  }
  async function remove(){
    if(!await confirmDialog({title:'Hapus tanda tangan & cap?',description:'Sertifikat akan dicetak tanpa gambar tanda tangan & cap.',confirmLabel:'Hapus',tone:'danger'}))return;
    try{setBusy(true);await api('/api/admin/certificates/signature',{method:'DELETE'});toast.success('Tanda tangan & cap dihapus.');await onChanged()}
    catch(e){toast.error(e.message)}finally{setBusy(false)}
  }
  const showing=pending?.dataUrl||info?.url;
  return <section className="signature-card">
    <div className="signature-preview">{showing?<img src={showing} alt="Tanda tangan & cap"/>:<span>Belum ada gambar</span>}</div>
    <div className="signature-body">
      <h3>Tanda tangan &amp; cap</h3>
      <p>{pending?`Pratinjau hasil rapikan (${pending.width}×${pending.height}px${pending.removedBackground?', latar putih dihapus':''}). Klik Simpan untuk memakai gambar ini.`:info?.exists?`Dipakai di semua sertifikat. Diperbarui ${fmt(info.updated_at)}.`:'Unggah PNG transparan (atau JPG berlatar putih). Tepi kosong dipotong otomatis. Gambar disimpan privat, tidak bisa diakses publik.'}</p>
      <div className="signature-actions">
        {pending?<>
          <button type="button" className="btn btn-brand-primary btn-small" onClick={upload} disabled={busy}>Simpan gambar</button>
          <button type="button" className="btn btn-secondary btn-small" onClick={()=>setPending(null)} disabled={busy}>Batal</button>
        </>:<>
          <label className={`btn btn-secondary btn-small ${busy?'disabled':''}`}><NavIcon name="upload" size={14}/>{info?.exists?'Ganti gambar':'Unggah gambar'}<input type="file" accept="image/png,image/jpeg" onChange={pick} disabled={busy} hidden/></label>
          {info?.exists&&<button type="button" className="link-button danger-link" onClick={remove} disabled={busy}>Hapus</button>}
        </>}
      </div>
    </div>
  </section>;
}

export function NumberingDialog({open,data,busy,onClose,onConfirm}){
  if(!open||!data)return null;
  const start=Number.parseInt(data.config?.number_start,10)||1;
  const rec=data.recipients||[];
  const sp=rec.filter(r=>r.role==='speaker').length,mo=rec.filter(r=>r.role==='moderator').length;
  const pa=data.numbered?.readyParticipants||0;
  const range=(a,n)=>n?(n===1?`${a}`:`${a}–${a+n-1}`):'—';
  const released=!!data.released;
  return <ActionDialog open title={released?'Beri nomor yang belum punya':'Siapkan nomor sertifikat'}
    description={released
      ?'Sertifikat sudah dirilis, jadi nomor yang sudah ada tidak diubah. Penerima yang belum bernomor diberi nomor lanjutan.'
      :'Semua nomor resmi disusun berurutan: pemateri → moderator → peserta yang memenuhi syarat (abjad nama, tanpa gelar). Bisa diulang sebelum rilis; PDF yang sudah diunduh sebelumnya memakai nomor lama.'}
    confirmLabel={released?'Beri nomor':'Susun nomor'} busy={busy} onClose={()=>!busy&&onClose()} onConfirm={onConfirm}>
    {!released&&<div className="dialog-summary">
      <div><span>Pemateri ({sp})</span><strong>{range(start,sp)}</strong></div>
      <div><span>Moderator ({mo})</span><strong>{range(start+sp,mo)}</strong></div>
      <div><span>Peserta memenuhi syarat ({pa})</span><strong>{range(start+sp+mo,pa)}</strong></div>
    </div>}
    <p className="muted numbering-note">Format: <b>{data.sampleNumber}</b>. Akun TEST tidak ikut. Peserta yang baru memenuhi syarat setelah ini mendapat nomor berikutnya saat mengunduh.</p>
  </ActionDialog>;
}
