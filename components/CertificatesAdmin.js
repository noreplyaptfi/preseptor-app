'use client';
import { useEffect,useMemo,useState } from 'react';
import writeExcelFile from 'write-excel-file/browser';
import { getSupabaseBrowser } from '../lib/supabase-browser';
import { confirmDialog,toast } from '../lib/ui-feedback';
import { downloadWithAuth } from '../lib/download-client';
import { CERTIFICATE_FIELDS,parseSyllabus,formatHours } from '../lib/certificate';
import ActionDialog from './ActionDialog';
import NavIcon from './NavIcon';
import { RecipientsPanel,SignatureCard,NumberingDialog } from './CertificateExtrasAdmin';

// v0.8.0 — Admin sertifikat (Super Admin).
// v0.8.6 — + pemateri & moderator, tanda tangan & cap, halaman 2 (tabel materi), nomor awal & Siapkan nomor.

const CHECKS=[['requirements','Dok'],['payment','Bayar'],['day1','H1'],['day2','H2'],['pretest','Pre'],['evaluation','Eval'],['posttest','Post']];
const CHECK_TITLE={requirements:'Dokumen valid',payment:'Pembayaran terverifikasi',day1:'Hadir Hari 1',day2:'Hadir Hari 2',pretest:'Pretest selesai',evaluation:'Evaluasi selesai',posttest:'Posttest lulus'};
const STATUS_CLASS={ready:'status-ok',waiting_release:'status-info',incomplete:'status-pending',revoked:'status-bad'};

function fmt(v){if(!v)return '—';try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v))}catch{return v}}

async function token(){const {data}=await getSupabaseBrowser().auth.getSession();return data.session?.access_token||''}
async function api(url,opts={}){
  const t=await token();
  const r=await fetch(url,{...opts,headers:{...(opts.headers||{}),Authorization:`Bearer ${t}`,...(opts.body?{'Content-Type':'application/json'}:{})},cache:'no-store'});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.message||'Request gagal');
  return j;
}

export default function CertificatesAdmin(){
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [tab,setTab]=useState('participants'),[filter,setFilter]=useState('all'),[q,setQ]=useState(''),[busy,setBusy]=useState(false);
  const [dialog,setDialog]=useState(null),[numbering,setNumbering]=useState(false);

  async function load(){try{setLoading(true);setError('');setData(await api('/api/admin/certificates'))}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);

  async function run(fn,success){
    try{setBusy(true);await fn();if(success)toast.success(success);await load()}
    catch(e){toast.error(e.message)}
    finally{setBusy(false)}
  }

  const rows=useMemo(()=>{
    const s=q.trim().toLowerCase();
    return (data?.rows||[]).filter(r=>{
      if(filter==='eligible'&&!r.eligible)return false;
      if(filter==='not'&&(r.eligible||r.certificate?.issued_via==='manual'))return false;
      if(filter==='issued'&&!r.certificate)return false;
      if(filter==='test'&&!r.test)return false;
      if(filter!=='test'&&filter!=='all'&&r.test)return false;
      if(['rejected','withdrawn'].includes(r.lifecycle_status)&&filter!=='all')return false;
      return !s||[r.name,r.registration_code,r.email].some(v=>String(v||'').toLowerCase().includes(s));
    });
  },[data,filter,q]);

  async function toggleRelease(){
    const next=!data.released;
    const ok=await confirmDialog(next
      ?{title:'Rilis sertifikat ke peserta?',description:'Peserta yang sudah memenuhi 8 syarat dapat langsung mengunduh sertifikat dari dashboard. Pastikan pengaturan template sudah final.',confirmLabel:'Ya, rilis sekarang'}
      :{title:'Tarik rilis sertifikat?',description:'Peserta tidak dapat mengunduh sertifikat sampai dirilis kembali. Sertifikat yang terbit manual tetap bisa diunduh.',confirmLabel:'Tarik rilis',tone:'danger'});
    if(!ok)return;
    run(()=>api('/api/admin/certificates',{method:'PATCH',body:JSON.stringify({certificate_enabled:next})}),next?'Sertifikat dirilis ke peserta.':'Rilis sertifikat ditarik.');
  }

  async function download(r){
    try{setBusy(true);await downloadWithAuth(`/api/admin/certificates/pdf?registrationId=${encodeURIComponent(r.id)}`);toast.success('Sertifikat diunduh.');await load()}
    catch(e){toast.error(e.message)}
    finally{setBusy(false)}
  }
  async function preview(kind,lang='id',mode=''){
    try{setBusy(true);await downloadWithAuth(`/api/admin/certificates/pdf?preview=1&kind=${kind}&lang=${lang}${mode?`&mode=${mode}`:''}`,'contoh-sertifikat.pdf')}
    catch(e){toast.error(e.message)}
    finally{setBusy(false)}
  }
  async function assignNumbers(){
    try{
      setBusy(true);
      const j=await api('/api/admin/certificates',{method:'POST',body:JSON.stringify({action:'assign_numbers',renumber:!data.released})});
      toast.success(j.changed?`${j.changed} nomor disiapkan.`:'Semua sudah bernomor; tidak ada perubahan.');
      setNumbering(false);await load();
    }catch(e){toast.error(e.message)}
    finally{setBusy(false)}
  }
  async function restore(r){
    if(!await confirmDialog({title:'Pulihkan sertifikat?',description:`Sertifikat ${r.name} kembali berlaku dan dapat diunduh.`,confirmLabel:'Pulihkan'}))return;
    run(()=>api('/api/admin/certificates',{method:'POST',body:JSON.stringify({action:'restore',registrationId:r.id})}),'Sertifikat dipulihkan.');
  }
  function submitDialog(){
    const d=dialog;
    run(async()=>{await api('/api/admin/certificates',{method:'POST',body:JSON.stringify({action:d.type,registrationId:d.row.id,reason:d.reason})});setDialog(null)},d.type==='revoke'?'Sertifikat dicabut.':'Sertifikat diterbitkan manual.');
  }
  async function exportExcel(){
    try{
      setBusy(true);
      const x=await api('/api/admin/certificates?export=1');
      await writeExcelFile([x.columns.map(c=>({value:c.header,fontWeight:'bold'})),...x.rows.map(r=>r.map(v=>v??''))],{sheet:x.sheet,columns:x.columns.map(c=>({width:c.width}))}).toFile(x.filename);
    }catch(e){toast.error(`Export gagal: ${e.message}`)}
    finally{setBusy(false)}
  }

  if(loading&&!data)return <section className="panel"><div className="participant-loading compact"><div className="spinner"/><p>Memuat sertifikat...</p></div></section>;
  if(!data)return <div className="alert alert-error">{error||'Data sertifikat belum tersedia.'}</div>;

  const s=data.stats||{};
  return <div className="asm cert-admin">
    <section className={`panel asm-status ${data.released?'on':''}`}>
      <div className="asm-status-main">
        <span className="asm-dot" aria-hidden="true"/>
        <div><strong>{data.released?'Sertifikat sudah dirilis ke peserta':'Sertifikat belum dirilis'}</strong><p>{data.released?'Peserta yang memenuhi 8 syarat dapat mengunduh sertifikat dari menu Sertifikat.':'Peserta dapat melihat daftar syarat, tetapi belum bisa mengunduh. Akun TEST tetap bisa mengunduh (dengan watermark) untuk uji coba.'}</p></div>
        <button type="button" className={`btn btn-small ${data.released?'btn-secondary':'btn-brand-primary'}`} onClick={toggleRelease} disabled={busy}>{data.released?'Tarik rilis':'Rilis ke peserta'}</button>
      </div>
      <dl className="asm-facts">
        <div><dt>Template</dt><dd>2 halaman · tabel materi {formatHours(data.syllabus?.id?.total)} JEP</dd></div>
        <div><dt>Nomor pertama</dt><dd>{data.sampleNumber}</dd></div>
        <div><dt>Penandatangan</dt><dd>{data.config.signatory_name}{data.signature?.exists?' · TTD & cap ✓':' · tanpa TTD'}</dd></div>
        <div><dt>Syarat lulus</dt><dd>8 syarat · Posttest terbaik sesuai nilai lulus</dd></div>
      </dl>
    </section>

    <section className="asm-stats">
      <div><span>Peserta aktif</span><strong>{s.participants||0}</strong></div>
      <div><span>Memenuhi syarat</span><strong>{s.eligible||0}</strong></div>
      <div><span>Sudah bernomor</span><strong>{s.issued||0}</strong></div>
      <div><span>Sudah diunduh</span><strong>{s.downloaded||0}</strong></div>
      <div className="muted-stat"><span>Terbit manual</span><strong>{s.manual||0}</strong></div>
    </section>

    <nav className="asm-tabs" role="tablist">
      <button type="button" className={tab==='participants'?'active':''} onClick={()=>setTab('participants')}>Peserta</button>
      <button type="button" className={tab==='recipients'?'active':''} onClick={()=>setTab('recipients')}>Pemateri &amp; Moderator{data.recipients?` (${data.recipients.length})`:''}</button>
      <button type="button" className={tab==='settings'?'active':''} onClick={()=>setTab('settings')}>Pengaturan template</button>
    </nav>

    {tab==='participants'&&<section className="panel">
      <div className="asm-toolbar">
        <div><h2>Status sertifikat peserta</h2><p>Klik <b>Siapkan nomor</b> sebelum rilis agar nomor urut rapi: pemateri → moderator → peserta (abjad). Tanpa itu, nomor diberikan saat sertifikat pertama kali diunduh.</p></div>
        <div className="asm-toolbar-actions">
          <button className="btn btn-brand-primary btn-small" onClick={()=>setNumbering(true)} disabled={busy}>Siapkan nomor</button>
          <select className="ui-select compact-select" value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filter">
            <option value="all">Semua</option><option value="eligible">Memenuhi syarat</option><option value="not">Belum memenuhi</option><option value="issued">Sudah terbit</option><option value="test">Akun TEST</option>
          </select>
          <button className="btn btn-secondary btn-small" onClick={exportExcel} disabled={busy}>Export Excel</button>
        </div>
      </div>
      <div className="search-box asm-search-box"><span>⌕</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari nama, nomor pendaftaran, atau email..."/></div>
      <div className="asm-table-wrap"><table className="asm-table cert-table">
        <thead><tr><th>Peserta</th><th>Syarat</th><th className="num">Post</th><th>Status</th><th>Sertifikat</th><th/></tr></thead>
        <tbody>
          {!rows.length&&<tr><td colSpan={6} className="asm-empty">Tidak ada peserta pada filter ini.</td></tr>}
          {rows.map(r=><tr key={r.id} className={['rejected','withdrawn'].includes(r.lifecycle_status)?'row-muted':''}>
            <td><strong>{r.name} {r.test&&<span className="status status-info">TEST</span>}</strong><small>{r.registration_code} · {r.attendance_mode}</small></td>
            <td><div className="check-dots">{CHECKS.map(([k,l])=><span key={k} className={r.items[k]?'ok':'no'} title={`${CHECK_TITLE[k]}: ${r.items[k]?'terpenuhi':'belum'}`}>{l}</span>)}</div></td>
            <td className="num">{r.best??'—'}</td>
            <td><span className={`status ${STATUS_CLASS[r.status]||'status-pending'}`}>{r.statusLabel}</span>{r.certificate?.issued_via==='manual'&&<small title={r.certificate.override_reason||''}>Terbit manual</small>}</td>
            <td>{r.certificate?<><strong className="cert-no">{r.certificate.number}</strong><small>{r.certificate.revoked_at?`Dicabut · ${r.certificate.revoke_reason||''}`:`${r.certificate.download_count}× diunduh · ${fmt(r.certificate.issued_at)}`}</small></>:<small>Belum terbit</small>}</td>
            <td className="asm-row-action"><div className="cert-actions">
              {(r.eligible||r.certificate?.issued_via==='manual')&&!r.certificate?.revoked_at&&<button className="btn btn-secondary btn-small" onClick={()=>download(r)} disabled={busy}><NavIcon name="download" size={14}/> Unduh</button>}
              {!r.eligible&&r.certificate?.issued_via!=='manual'&&!['rejected','withdrawn'].includes(r.lifecycle_status)&&<button className="link-button" onClick={()=>setDialog({type:'issue_manual',row:r,reason:''})} disabled={busy}>Terbitkan manual</button>}
              {r.certificate&&!r.certificate.revoked_at&&<button className="link-button danger-link" onClick={()=>setDialog({type:'revoke',row:r,reason:''})} disabled={busy}>Cabut</button>}
              {r.certificate?.revoked_at&&<button className="link-button" onClick={()=>restore(r)} disabled={busy}>Pulihkan</button>}
            </div></td>
          </tr>)}
        </tbody>
      </table></div>
      <p className="cert-legend">Syarat: <b>Dok</b> dokumen valid · <b>Bayar</b> pembayaran terverifikasi · <b>H1/H2</b> hadir Hari 1/2 · <b>Pre</b> Pretest · <b>Eval</b> Evaluasi · <b>Post</b> Posttest lulus. Pendaftaran aktif menjadi syarat ke-8.</p>
    </section>}

    {tab==='recipients'&&<RecipientsPanel recipients={data.recipients??null} api={api} busy={busy} setBusy={setBusy} onChanged={load} onPreview={(kind,lang)=>preview(kind,lang)}/>}

    {tab==='settings'&&<CertificateSettings config={data.config} busy={busy} onPreview={preview} onSave={config=>run(()=>api('/api/admin/certificates',{method:'PATCH',body:JSON.stringify({config})}),'Pengaturan template disimpan.')} signature={<SignatureCard api={api} busy={busy} setBusy={setBusy} onChanged={load} signature={data.signature}/>}/>}

    <NumberingDialog open={numbering} data={data} busy={busy} onClose={()=>setNumbering(false)} onConfirm={assignNumbers}/>

    <ActionDialog
      open={!!dialog}
      title={dialog?.type==='revoke'?'Cabut sertifikat?':'Terbitkan sertifikat manual?'}
      description={dialog?.type==='revoke'?'Sertifikat tidak bisa diunduh lagi dan halaman verifikasi akan menampilkan status dicabut.':'Gunakan hanya untuk kasus khusus, misalnya kendala teknis presensi atau posttest yang sudah dikonfirmasi panitia. Alasan dicatat di log aktivitas.'}
      tone={dialog?.type==='revoke'?'danger':'default'}
      confirmLabel={dialog?.type==='revoke'?'Ya, cabut':'Terbitkan'}
      confirmDisabled={String(dialog?.reason||'').trim().length<5}
      busy={busy}
      onClose={()=>!busy&&setDialog(null)}
      onConfirm={submitDialog}>
      <div className="dialog-summary"><div><span>Peserta</span><strong>{dialog?.row?.name||'—'}</strong></div><div><span>No. pendaftaran</span><strong>{dialog?.row?.registration_code||'—'}</strong></div>{dialog?.type==='issue_manual'&&<div><span>Syarat belum terpenuhi</span><strong>{(dialog?.row?.missing||[]).join(', ')||'—'}</strong></div>}</div>
      <div className="field dialog-field"><label>Alasan *</label><textarea rows="3" value={dialog?.reason||''} onChange={e=>setDialog(v=>({...v,reason:e.target.value}))} placeholder={dialog?.type==='revoke'?'Contoh: Data nama salah, diterbitkan ulang setelah diperbaiki.':'Contoh: Peserta hadir Hari 2 tetapi presensi gagal karena gangguan sinyal; dikonfirmasi panitia.'}/></div>
    </ActionDialog>
  </div>;
}

const GROUPS=[
  ['umum','Teks halaman 1','Dipakai di sertifikat peserta, pemateri, dan moderator (bahasa Indonesia).'],
  ['halaman2','Halaman 2 · tabel materi','Dicetak di semua sertifikat. Satu materi per baris: Materi | 1,5. Apit judul dengan garis bawah (_judul_) agar tercetak miring. Total dihitung otomatis.'],
  ['inggris','Versi bahasa Inggris','Untuk pemateri/moderator yang sertifikatnya berbahasa Inggris. Nama penandatangan, tempat terbit, nomor, dan tanda tangan sama dengan versi Indonesia.']
];

function SyllabusPreview({text,lang}){
  const s=parseSyllabus(text);
  if(!s.rows.length)return <div className="alert alert-error compact-alert">Belum ada baris yang valid. Contoh: Pretes | 0,25</div>;
  return <table className="syllabus-preview"><thead><tr><th>{lang==='en'?'Topic':'Materi'}</th><th>{lang==='en'?'Duration (JEP)':'Durasi (JEP)'}</th></tr></thead>
    <tbody>{s.rows.map((r,i)=><tr key={i}><td>{r.italic?<i>{r.title}</i>:r.title}</td><td>{formatHours(r.hours,lang)}</td></tr>)}</tbody>
    <tfoot><tr><td>Total</td><td>{formatHours(s.total,lang)}</td></tr></tfoot></table>;
}

function CertificateSettings({config,busy,onSave,onPreview,signature}){
  const [v,setV]=useState(config);
  useEffect(()=>setV(config),[config]);
  const keys=CERTIFICATE_FIELDS.map(([k])=>k);
  const changed=keys.some(k=>String(v[k]??'')!==String(config[k]??''));
  const field=([key,label,max,opts={}])=><div className={`field ${opts.type==='textarea'?'span-2':''}`} key={key}><label>{label}</label>
    {opts.type==='textarea'
      ?<textarea rows={10} value={v[key]||''} maxLength={max} onChange={e=>setV(x=>({...x,[key]:e.target.value}))} className="syllabus-input"/>
      :<input type={opts.type==='number'?'number':'text'} min={opts.type==='number'?1:undefined} value={v[key]||''} maxLength={max} onChange={e=>setV(x=>({...x,[key]:e.target.value}))} placeholder={key==='note_text'?'Contoh: Kegiatan ini bernilai ... SKP':''}/>}
    {key==='number_format'&&<small>{'{NNN}'} diganti nomor urut 3 digit (gunakan {'{NNNN}'} untuk 4 digit). Akun TEST diberi awalan TEST-.</small>}
    {key==='number_start'&&<small>Nomor sertifikat pertama. Contoh: 339 → 339/X/SERTIF/APTFI/2026, berikutnya 340, dst.</small>}
    {opts.type==='textarea'&&<SyllabusPreview text={v[key]} lang={key.endsWith('_en')?'en':'id'}/>}
  </div>;
  return <form className="panel asm-settings" onSubmit={e=>{e.preventDefault();onSave(Object.fromEntries(keys.map(k=>[k,v[k]])))}}>
    <div className="asm-toolbar"><div><h2>Pengaturan template</h2><p>Teks di bawah langsung dipakai di sertifikat. Simpan dulu, lalu klik Contoh untuk melihat hasilnya.</p></div>
      <div className="asm-toolbar-actions">
        <button type="button" className="btn btn-secondary btn-small" onClick={()=>onPreview('participant','id','Offline')} disabled={busy}><NavIcon name="eye" size={14}/> Peserta Offline</button>
        <button type="button" className="btn btn-secondary btn-small" onClick={()=>onPreview('participant','id','Online')} disabled={busy}><NavIcon name="eye" size={14}/> Peserta Online</button>
        <button type="button" className="btn btn-secondary btn-small" onClick={()=>onPreview('speaker','id')} disabled={busy}><NavIcon name="eye" size={14}/> Pemateri</button>
        <button type="button" className="btn btn-secondary btn-small" onClick={()=>onPreview('moderator','id')} disabled={busy}><NavIcon name="eye" size={14}/> Moderator</button>
        <button type="button" className="btn btn-secondary btn-small" onClick={()=>onPreview('speaker','en')} disabled={busy}><NavIcon name="eye" size={14}/> Inggris</button>
      </div>
    </div>
    {signature}
    {GROUPS.map(([id,title,lead])=><fieldset className="cert-settings-group" key={id}>
      <legend>{title}</legend><p className="muted">{lead}</p>
      <div className="asm-settings-grid">{CERTIFICATE_FIELDS.filter(f=>(f[3]?.group||'umum')===id).map(field)}</div>
    </fieldset>)}
    <div className="asm-form-actions"><small className="muted">Simpan dulu, lalu klik Contoh untuk melihat hasilnya.</small><span className="asm-spacer"/><button type="button" className="btn btn-secondary" onClick={()=>setV(config)} disabled={busy||!changed}>Batalkan perubahan</button><button className="btn btn-brand-primary" disabled={busy||!changed}>Simpan pengaturan</button></div>
  </form>;
}
