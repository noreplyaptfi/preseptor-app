'use client';
import { useEffect,useMemo,useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';
import { confirmDialog,toast } from '../lib/ui-feedback';
import { ASSET_BUCKET,ASSET_KINDS,AUDIENCE_LABEL,validateAssetFile,guessMime,fileTypeLabel,formatBytes } from '../lib/event-assets';
import NavIcon from './NavIcon';

// v0.8.0 — Admin: unggah & kelola virtual background Zoom dan materi pelatihan.

function fmt(v){if(!v)return '';try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v))}catch{return v}}
function titleFromFile(name){return String(name||'').replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().slice(0,160)}

async function token(){const {data}=await getSupabaseBrowser().auth.getSession();return data.session?.access_token||''}
async function api(url,opts={}){
  const t=await token();
  const r=await fetch(url,{...opts,headers:{...(opts.headers||{}),Authorization:`Bearer ${t}`,...(opts.body?{'Content-Type':'application/json'}:{})},cache:'no-store'});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.message||'Request gagal');
  return j;
}

export default function EventAssetsAdmin(){
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [tab,setTab]=useState('virtual_background'),[busy,setBusy]=useState(false),[editing,setEditing]=useState(null);

  async function load(){try{setLoading(true);setError('');setData(await api('/api/admin/assets'))}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);

  async function run(fn,success){
    try{setBusy(true);await fn();if(success)toast.success(success);await load()}
    catch(e){toast.error(e.message)}
    finally{setBusy(false)}
  }

  const all=data?.assets||[];
  const list=useMemo(()=>all.filter(a=>a.kind===tab),[all,tab]);
  const count=k=>all.filter(a=>a.kind===k).length;
  const downloads=all.filter(a=>ASSET_KINDS[a.kind]).reduce((s,a)=>s+Number(a.download_count||0),0);

  async function remove(a){
    if(!await confirmDialog({title:`Hapus ${a.kind==='material'?'materi':'virtual background'}?`,description:`"${a.title}" akan dihapus permanen dan tidak bisa lagi diunduh peserta.`,confirmLabel:'Hapus',tone:'danger'}))return;
    run(()=>api('/api/admin/assets',{method:'DELETE',body:JSON.stringify({id:a.id})}),'Aset dihapus.');
  }
  const togglePublish=a=>run(()=>api('/api/admin/assets',{method:'PATCH',body:JSON.stringify({id:a.id,published:!a.published})}),a.published?'Disembunyikan dari peserta.':'Ditampilkan ke peserta.');
  const move=(a,direction)=>run(()=>api('/api/admin/assets',{method:'POST',body:JSON.stringify({action:'move',id:a.id,direction})}));
  const saveEdit=(a,v)=>run(async()=>{await api('/api/admin/assets',{method:'PATCH',body:JSON.stringify({id:a.id,...v})});setEditing(null)},'Perubahan disimpan.');

  if(loading&&!data)return <section className="panel"><div className="participant-loading compact"><div className="spinner"/><p>Memuat materi & background...</p></div></section>;
  if(!data)return <div className="alert alert-error">{error||'Data belum tersedia.'}</div>;

  const k=ASSET_KINDS[tab];
  return <div className="asm assets-admin">
    <section className="panel asm-status on">
      <div className="asm-status-main">
        <span className="asm-dot" aria-hidden="true"/>
        <div><strong>Materi & Virtual Background</strong><p>File disimpan privat. Hanya peserta yang sudah terverifikasi (dan akun TEST) yang dapat melihat dan mengunduh. Gunakan pengaturan sasaran untuk membedakan peserta Online dan Offline.</p></div>
      </div>
    </section>

    <section className="asm-stats">
      <div><span>Virtual background</span><strong>{count('virtual_background')}</strong></div>
      <div><span>Materi</span><strong>{count('material')}</strong></div>
      <div><span>Total unduhan</span><strong>{downloads}</strong></div>
    </section>

    <nav className="asm-tabs" role="tablist">
      {Object.entries(ASSET_KINDS).map(([id,v])=><button key={id} type="button" role="tab" aria-selected={tab===id} className={tab===id?'active':''} onClick={()=>{setTab(id);setEditing(null)}}>{v.label} ({count(id)})</button>)}
    </nav>

    <UploadCard key={tab} kind={tab} busy={busy} setBusy={setBusy} onDone={load}/>

    <section className="panel">
      <div className="asm-toolbar"><div><h2>{k.label} terunggah</h2><p>{tab==='virtual_background'?'Peserta melihat pratinjau dan dapat mengunduh dalam ukuran asli.':'Urutan di bawah ini sama dengan urutan yang dilihat peserta.'}</p></div></div>
      {!list.length&&<div className="asm-empty-box"><strong>Belum ada {k.noun}</strong><p>Unggah file pertama melalui formulir di atas.</p></div>}
      {tab==='virtual_background'?<div className="vb-grid">{list.map((a,i)=><article key={a.id} className={`vb-card ${a.published?'':'hidden-asset'}`}>
        <div className="vb-thumb">{a.preview_url?<img src={a.preview_url} alt={a.title}/>:<NavIcon name="image" size={32}/>}{!a.published&&<span className="vb-hidden-badge">Disembunyikan</span>}</div>
        {editing===a.id?<AssetEditForm asset={a} busy={busy} onCancel={()=>setEditing(null)} onSave={v=>saveEdit(a,v)}/>:<div className="vb-body">
          <strong>{a.title}</strong>
          <small>{AUDIENCE_LABEL[a.audience]} · {formatBytes(a.file_size)} · {a.download_count||0}× diunduh</small>
          <AssetActions a={a} i={i} n={list.length} busy={busy} onEdit={()=>setEditing(a.id)} onToggle={()=>togglePublish(a)} onMove={d=>move(a,d)} onDelete={()=>remove(a)}/>
        </div>}
      </article>)}</div>:
      <div className="asset-list">{list.map((a,i)=>editing===a.id?<AssetEditForm key={a.id} asset={a} busy={busy} onCancel={()=>setEditing(null)} onSave={v=>saveEdit(a,v)}/>:<article key={a.id} className={`asset-row ${a.published?'':'hidden-asset'}`}>
        <span className="asset-type"><NavIcon name={a.storage_path?'file':'link'} size={18}/><b>{fileTypeLabel(a)}</b></span>
        <div className="asset-main">
          <strong>{a.title}{!a.published&&<span className="status status-pending">Disembunyikan</span>}</strong>
          {a.description&&<p>{a.description}</p>}
          <small>{AUDIENCE_LABEL[a.audience]}{Number(a.file_size)>0?` · ${formatBytes(a.file_size)}`:''}{a.link_url&&!a.storage_path?` · ${a.link_url.replace(/^https?:\/\//,'').slice(0,48)}`:''} · {a.download_count||0}× dibuka · {fmt(a.created_at)}</small>
        </div>
        <AssetActions a={a} i={i} n={list.length} busy={busy} onEdit={()=>setEditing(a.id)} onToggle={()=>togglePublish(a)} onMove={d=>move(a,d)} onDelete={()=>remove(a)}/>
      </article>)}</div>}
    </section>
  </div>;
}

function AssetActions({a,i,n,busy,onEdit,onToggle,onMove,onDelete}){
  return <div className="asset-actions">
    <label className="mini-switch" title={a.published?'Tampil ke peserta':'Disembunyikan'}><input type="checkbox" checked={!!a.published} onChange={onToggle} disabled={busy}/><span>{a.published?'Tampil':'Sembunyi'}</span></label>
    <button type="button" className="asset-icon-btn" onClick={()=>onMove('up')} disabled={busy||i===0} aria-label="Naikkan"><NavIcon name="arrow-up" size={16}/></button>
    <button type="button" className="asset-icon-btn" onClick={()=>onMove('down')} disabled={busy||i===n-1} aria-label="Turunkan"><NavIcon name="arrow-down" size={16}/></button>
    <button type="button" className="link-button" onClick={onEdit} disabled={busy}>Edit</button>
    <button type="button" className="asset-icon-btn danger" onClick={onDelete} disabled={busy} aria-label="Hapus"><NavIcon name="trash" size={16}/></button>
  </div>;
}

function AssetEditForm({asset,busy,onCancel,onSave}){
  const [v,setV]=useState({title:asset.title,description:asset.description||'',audience:asset.audience,link_url:asset.link_url||''});
  const isLink=!asset.storage_path;
  return <form className="asm-qform" onSubmit={e=>{e.preventDefault();onSave(isLink?v:{title:v.title,description:v.description,audience:v.audience})}}>
    <div className="asm-two">
      <div className="field"><label>Judul</label><input value={v.title} onChange={e=>setV(x=>({...x,title:e.target.value}))} required/></div>
      <div className="field"><label>Untuk</label><select value={v.audience} onChange={e=>setV(x=>({...x,audience:e.target.value}))}>{Object.entries(AUDIENCE_LABEL).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></div>
    </div>
    {asset.kind==='material'&&<div className="field"><label>Keterangan (opsional)</label><input value={v.description} onChange={e=>setV(x=>({...x,description:e.target.value}))} placeholder="Contoh: Topik 3 — Dr. apt. Iis Wahyuningsih"/></div>}
    {isLink&&<div className="field"><label>Tautan</label><input type="url" value={v.link_url} onChange={e=>setV(x=>({...x,link_url:e.target.value}))} required/></div>}
    <div className="asm-form-actions"><span className="asm-spacer"/><button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Batal</button><button className="btn btn-brand-primary" disabled={busy}>Simpan</button></div>
  </form>;
}

function UploadCard({kind,busy,setBusy,onDone}){
  const k=ASSET_KINDS[kind];
  const [mode,setMode]=useState('file');
  const [file,setFile]=useState(null),[preview,setPreview]=useState(''),[dims,setDims]=useState(null);
  const [v,setV]=useState({title:'',description:'',audience:'all',published:true,link_url:''});
  const [stage,setStage]=useState('');
  const [drag,setDrag]=useState(false);

  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);

  function pick(f){
    if(!f)return;
    const err=validateAssetFile(kind,{name:f.name,type:f.type,size:f.size});
    if(err){toast.error(err);return}
    if(preview)URL.revokeObjectURL(preview);
    setFile(f);setDims(null);
    setV(x=>({...x,title:x.title||titleFromFile(f.name)}));
    if(String(guessMime(f.name,f.type)).startsWith('image/')){
      const url=URL.createObjectURL(f);setPreview(url);
      const img=new Image();img.onload=()=>setDims({w:img.naturalWidth,h:img.naturalHeight});img.src=url;
    }else setPreview('');
  }
  function reset(){setFile(null);setPreview('');setDims(null);setStage('');setV({title:'',description:'',audience:'all',published:true,link_url:''})}

  async function submit(e){
    e.preventDefault();
    try{
      setBusy(true);
      if(mode==='link'){
        setStage('Menyimpan tautan...');
        await api('/api/admin/assets',{method:'POST',body:JSON.stringify({action:'create_link',kind,...v})});
      }else{
        if(!file){toast.error('Pilih file terlebih dahulu.');return}
        const type=guessMime(file.name,file.type);
        setStage('Menyiapkan upload...');
        const prep=await api('/api/admin/assets',{method:'POST',body:JSON.stringify({action:'prepare',kind,file:{name:file.name,type,size:file.size}})});
        setStage(`Mengunggah ${formatBytes(file.size)}... jangan tutup halaman ini.`);
        const {error}=await getSupabaseBrowser().storage.from(ASSET_BUCKET).uploadToSignedUrl(prep.path,prep.token,file,{contentType:type,cacheControl:'3600'});
        if(error)throw new Error('Upload gagal. Periksa koneksi internet lalu coba lagi.');
        setStage('Memverifikasi file...');
        await api('/api/admin/assets',{method:'POST',body:JSON.stringify({action:'create',kind,path:prep.path,original_name:file.name,mime_type:type,file_size:file.size,...v})});
      }
      toast.success(`${k.label} berhasil ditambahkan.`);
      reset();
      await onDone();
    }catch(err){toast.error(err.message);setStage('')}
    finally{setBusy(false)}
  }

  const ratio=dims?dims.w/dims.h:null;
  const vbWarn=kind==='virtual_background'&&dims&&(Math.abs(ratio-16/9)>0.04||dims.w<1280)?`Ukuran gambar ${dims.w} × ${dims.h} px. Zoom paling pas dengan rasio 16:9 dan lebar minimal 1280 px (disarankan 1920 × 1080).`:'';

  return <form className="panel asset-upload" onSubmit={submit}>
    <div className="asm-toolbar"><div><h2>Tambah {k.noun}</h2><p>{k.hint}</p></div>
      {kind==='material'&&<div className="asm-tabs compact" role="tablist"><button type="button" className={mode==='file'?'active':''} onClick={()=>setMode('file')}>Unggah file</button><button type="button" className={mode==='link'?'active':''} onClick={()=>setMode('link')}>Tautan</button></div>}
    </div>
    <div className="asset-upload-grid">
      {mode==='file'?<label className={`asset-dropzone ${drag?'drag':''} ${file?'has-file':''}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);pick(e.dataTransfer.files?.[0])}}>
        <input type="file" accept={k.accept} onChange={e=>{pick(e.target.files?.[0]);e.target.value=''}} disabled={busy}/>
        {preview?<img src={preview} alt="Pratinjau"/>:<span className="asset-dropzone-icon"><NavIcon name={file?'file':'upload'} size={26}/></span>}
        <strong>{file?file.name:'Klik atau seret file ke sini'}</strong>
        <small>{file?`${formatBytes(file.size)}${dims?` · ${dims.w} × ${dims.h} px`:''}`:k.hint}</small>
      </label>:<div className="field link-field"><label>Tautan materi</label><input type="url" value={v.link_url} onChange={e=>setV(x=>({...x,link_url:e.target.value}))} placeholder="https://drive.google.com/..." required/><small>Pastikan akses tautan sudah dibuka untuk siapa pun yang memiliki link.</small></div>}
      <div className="asset-upload-fields">
        <div className="field"><label>Judul</label><input value={v.title} onChange={e=>setV(x=>({...x,title:e.target.value}))} placeholder={kind==='material'?'Contoh: Pedagogik dalam Pendidikan Profesi Apoteker':'Contoh: Background Peserta Online'} required/></div>
        {kind==='material'&&<div className="field"><label>Keterangan (opsional)</label><input value={v.description} onChange={e=>setV(x=>({...x,description:e.target.value}))} placeholder="Contoh: Topik 1 — Prof. Dr. apt. Yandi Syukri, M.Si."/></div>}
        <div className="asm-two">
          <div className="field"><label>Untuk</label><select value={v.audience} onChange={e=>setV(x=>({...x,audience:e.target.value}))}>{Object.entries(AUDIENCE_LABEL).map(([key,l])=><option key={key} value={key}>{l}</option>)}</select></div>
          <label className="switch-line asset-upload-publish"><input type="checkbox" checked={v.published} onChange={e=>setV(x=>({...x,published:e.target.checked}))}/><span>Langsung tampil ke peserta</span></label>
        </div>
      </div>
    </div>
    {vbWarn&&<div className="alert alert-warning">{vbWarn}</div>}
    <div className="asm-form-actions">
      {stage&&<span className="asset-upload-stage"><span className="spinner small"/>{stage}</span>}
      <span className="asm-spacer"/>
      {(file||v.title||v.link_url)&&<button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>Batal</button>}
      <button className="btn btn-brand-primary" disabled={busy||(mode==='file'&&!file)}>{busy?'Memproses...':mode==='link'?'Simpan tautan':`Unggah ${k.noun}`}</button>
    </div>
  </form>;
}
