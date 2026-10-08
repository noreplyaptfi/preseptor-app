'use client';
import { useEffect,useMemo,useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';
import { confirmDialog,toast } from '../lib/ui-feedback';
import { AUDIENCE_LABEL,DOC_KIND,DOC_GROUP_SUGGESTIONS,DOC_BULK_MAX,DOC_NO_GROUP as NO_GROUP,groupDocs,linkSource,linkIcon as sourceIcon,parseLinkLines,validLink } from '../lib/event-assets';
import NavIcon from './NavIcon';

// v0.8.4 — Admin: dokumentasi kegiatan (khusus tautan). Bisa tambah banyak tautan sekaligus,
// dikelompokkan (Hari 1 / Hari 2 / Umum / bebas), diatur tampil/sembunyi, urutan, dan sasaran peserta.

async function token(){const {data}=await getSupabaseBrowser().auth.getSession();return data.session?.access_token||''}
async function api(url,opts={}){
  const t=await token();
  const r=await fetch(url,{...opts,headers:{...(opts.headers||{}),Authorization:`Bearer ${t}`,...(opts.body?{'Content-Type':'application/json'}:{})},cache:'no-store'});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.message||'Request gagal');
  return j;
}
function fmt(v){if(!v)return '';try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v))}catch{return v}}

export default function DocumentationAdmin(){
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [busy,setBusy]=useState(false),[editing,setEditing]=useState(null),[q,setQ]=useState(''),[groupFilter,setGroupFilter]=useState('');

  async function load(){try{setLoading(true);setError('');setData(await api('/api/admin/assets'))}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);
  async function run(fn,success){
    try{setBusy(true);await fn();if(success)toast.success(success);await load()}
    catch(e){toast.error(e.message)}
    finally{setBusy(false)}
  }

  const docs=useMemo(()=>(data?.assets||[]).filter(a=>a.kind===DOC_KIND),[data]);
  const groups=useMemo(()=>groupDocs(docs).map(g=>g.group),[docs]);
  const suggestions=useMemo(()=>[...new Set([...DOC_GROUP_SUGGESTIONS,...docs.map(a=>a.group_label).filter(Boolean)])],[docs]);
  const filtered=useMemo(()=>{
    const s=q.trim().toLowerCase();
    return docs.filter(a=>(!groupFilter||(a.group_label||NO_GROUP)===groupFilter)&&(!s||`${a.title} ${a.description||''} ${a.link_url||''}`.toLowerCase().includes(s)));
  },[docs,q,groupFilter]);
  const grouped=useMemo(()=>groupDocs(filtered),[filtered]);
  const shown=docs.filter(a=>a.published).length;
  const opens=docs.reduce((s,a)=>s+Number(a.download_count||0),0);

  async function remove(a){
    if(!await confirmDialog({title:'Hapus tautan dokumentasi?',description:`"${a.title}" akan dihapus dari daftar dokumentasi peserta. File di Google Drive/YouTube tidak ikut terhapus.`,confirmLabel:'Hapus',tone:'danger'}))return;
    run(()=>api('/api/admin/assets',{method:'DELETE',body:JSON.stringify({id:a.id})}),'Tautan dihapus.');
  }
  async function setGroupPublished(group,items,published){
    const targets=items.filter(a=>a.published!==published);
    if(!targets.length)return;
    if(!await confirmDialog({title:`${published?'Tampilkan':'Sembunyikan'} ${targets.length} tautan?`,description:`Semua tautan di kelompok "${group}" akan ${published?'ditampilkan ke':'disembunyikan dari'} peserta.`,confirmLabel:published?'Tampilkan':'Sembunyikan'}))return;
    run(async()=>{for(const a of targets)await api('/api/admin/assets',{method:'PATCH',body:JSON.stringify({id:a.id,published})})},published?'Kelompok ditampilkan.':'Kelompok disembunyikan.');
  }
  const togglePublish=a=>run(()=>api('/api/admin/assets',{method:'PATCH',body:JSON.stringify({id:a.id,published:!a.published})}),a.published?'Disembunyikan dari peserta.':'Ditampilkan ke peserta.');
  const move=(a,direction)=>run(()=>api('/api/admin/assets',{method:'POST',body:JSON.stringify({action:'move',id:a.id,direction})}));
  const saveEdit=(a,v)=>run(async()=>{await api('/api/admin/assets',{method:'PATCH',body:JSON.stringify({id:a.id,...v})});setEditing(null)},'Perubahan disimpan.');

  if(loading&&!data)return <section className="panel"><div className="participant-loading compact"><div className="spinner"/><p>Memuat dokumentasi...</p></div></section>;
  if(!data)return <div className="alert alert-error">{error||'Data belum tersedia.'}</div>;

  return <div className="asm docs-admin">
    <section className="panel asm-status on">
      <div className="asm-status-main">
        <span className="asm-dot" aria-hidden="true"/>
        <div><strong>Dokumentasi kegiatan (tautan)</strong><p>Simpan foto & video di Google Drive, Google Photos, atau YouTube, lalu tempel tautannya di sini. Pastikan akses tautan sudah <b>“Siapa saja yang memiliki link”</b>. Hanya peserta terverifikasi (dan akun TEST) yang melihat menu Dokumentasi.</p></div>
      </div>
    </section>

    <section className="asm-stats">
      <div><span>Total tautan</span><strong>{docs.length}</strong></div>
      <div><span>Kelompok</span><strong>{groups.length}</strong></div>
      <div><span>Tampil ke peserta</span><strong>{shown}</strong></div>
      <div><span>Total dibuka</span><strong>{opens}</strong></div>
    </section>

    <AddLinksCard busy={busy} setBusy={setBusy} suggestions={suggestions} onDone={load}/>

    <section className="panel">
      <div className="asm-toolbar"><div><h2>Daftar dokumentasi</h2><p>Urutan dan kelompok di bawah ini sama dengan yang dilihat peserta.</p></div></div>
      {docs.length>0&&<div className="docs-filters">
        <div className="search-box"><span>⌕</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari judul, keterangan, atau tautan..."/></div>
        <select className="ui-select" value={groupFilter} onChange={e=>setGroupFilter(e.target.value)}><option value="">Semua kelompok</option>{groups.map(g=><option key={g} value={g}>{g}</option>)}</select>
      </div>}
      {!docs.length&&<div className="asm-empty-box"><strong>Belum ada dokumentasi</strong><p>Tempel tautan pertama melalui formulir di atas.</p></div>}
      {docs.length>0&&!filtered.length&&<div className="asm-empty-box"><strong>Tidak ada yang cocok</strong><p>Ubah kata kunci atau filter kelompok.</p></div>}
      {grouped.map(({group,items})=><div key={group} className="docs-group">
        <div className="docs-group-head">
          <h3>{group} <span>{items.length}</span></h3>
          <div className="docs-group-actions">
            <button type="button" className="link-button" disabled={busy||items.every(a=>a.published)} onClick={()=>setGroupPublished(group,items,true)}>Tampilkan semua</button>
            <button type="button" className="link-button" disabled={busy||items.every(a=>!a.published)} onClick={()=>setGroupPublished(group,items,false)}>Sembunyikan semua</button>
          </div>
        </div>
        <div className="asset-list">{items.map((a,i)=>{
          const src=linkSource(a.link_url);
          return editing===a.id?<DocEditForm key={a.id} asset={a} busy={busy} suggestions={suggestions} onCancel={()=>setEditing(null)} onSave={v=>saveEdit(a,v)}/>:<article key={a.id} className={`asset-row ${a.published?'':'hidden-asset'}`}>
            <span className={`asset-type doc-src doc-${src.key}`}><NavIcon name={sourceIcon(src.key)} size={18}/><b>{src.label.replace('Folder ','')}</b></span>
            <div className="asset-main">
              <strong>{a.title}{!a.published&&<span className="status status-pending">Disembunyikan</span>}</strong>
              {a.description&&<p>{a.description}</p>}
              <small>{AUDIENCE_LABEL[a.audience]} · <a href={a.link_url} target="_blank" rel="noreferrer">{String(a.link_url||'').replace(/^https?:\/\//,'').slice(0,52)}{String(a.link_url||'').length>60?'…':''}</a> · {a.download_count||0}× dibuka · {fmt(a.created_at)}</small>
            </div>
            <div className="asset-actions">
              <label className="mini-switch" title={a.published?'Tampil ke peserta':'Disembunyikan'}><input type="checkbox" checked={!!a.published} onChange={()=>togglePublish(a)} disabled={busy}/><span>{a.published?'Tampil':'Sembunyi'}</span></label>
              <button type="button" className="asset-icon-btn" onClick={()=>move(a,'up')} disabled={busy||i===0||!!q||!!groupFilter} aria-label="Naikkan"><NavIcon name="arrow-up" size={16}/></button>
              <button type="button" className="asset-icon-btn" onClick={()=>move(a,'down')} disabled={busy||i===items.length-1||!!q||!!groupFilter} aria-label="Turunkan"><NavIcon name="arrow-down" size={16}/></button>
              <button type="button" className="link-button" onClick={()=>setEditing(a.id)} disabled={busy}>Edit</button>
              <button type="button" className="asset-icon-btn danger" onClick={()=>remove(a)} disabled={busy} aria-label="Hapus"><NavIcon name="trash" size={16}/></button>
            </div>
          </article>;
        })}</div>
      </div>)}
    </section>
  </div>;
}

function GroupField({value,onChange,suggestions,id}){
  return <div className="field"><label htmlFor={id}>Kelompok</label>
    <input id={id} list={`${id}-list`} value={value} onChange={e=>onChange(e.target.value)} maxLength={80} placeholder="Contoh: Hari 1"/>
    <datalist id={`${id}-list`}>{suggestions.map(s=><option key={s} value={s}/>)}</datalist>
    <div className="docs-chips">{suggestions.slice(0,6).map(s=><button type="button" key={s} className={value===s?'active':''} onClick={()=>onChange(s)}>{s}</button>)}</div>
  </div>;
}

function DocEditForm({asset,busy,suggestions,onCancel,onSave}){
  const [v,setV]=useState({title:asset.title,description:asset.description||'',audience:asset.audience,link_url:asset.link_url||'',group_label:asset.group_label||''});
  return <form className="asm-qform" onSubmit={e=>{e.preventDefault();onSave(v)}}>
    <div className="asm-two">
      <div className="field"><label>Judul</label><input value={v.title} onChange={e=>setV(x=>({...x,title:e.target.value}))} required maxLength={160}/></div>
      <div className="field"><label>Tautan</label><input type="url" value={v.link_url} onChange={e=>setV(x=>({...x,link_url:e.target.value}))} required/></div>
    </div>
    <div className="field"><label>Keterangan (opsional)</label><input value={v.description} onChange={e=>setV(x=>({...x,description:e.target.value}))} maxLength={500}/></div>
    <div className="asm-two">
      <GroupField id={`edit-${asset.id}`} value={v.group_label} onChange={g=>setV(x=>({...x,group_label:g}))} suggestions={suggestions}/>
      <div className="field"><label>Untuk</label><select value={v.audience} onChange={e=>setV(x=>({...x,audience:e.target.value}))}>{Object.entries(AUDIENCE_LABEL).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></div>
    </div>
    <div className="asm-form-actions"><span className="asm-spacer"/><button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Batal</button><button className="btn btn-brand-primary" disabled={busy}>Simpan</button></div>
  </form>;
}

function AddLinksCard({busy,setBusy,suggestions,onDone}){
  const [mode,setMode]=useState('bulk');
  const [common,setCommon]=useState({group_label:'',audience:'all',published:true});
  const [text,setText]=useState('');
  const [one,setOne]=useState({title:'',link_url:'',description:''});
  const parsed=useMemo(()=>parseLinkLines(text,{group:common.group_label.trim()}),[text,common.group_label]);
  const valid=parsed.filter(r=>!r.error),invalid=parsed.filter(r=>r.error);

  async function submit(e){
    e.preventDefault();
    try{
      setBusy(true);
      if(mode==='bulk'){
        if(!valid.length){toast.error('Belum ada tautan yang valid.');return}
        if(invalid.length&&!await confirmDialog({title:`Simpan ${valid.length} tautan saja?`,description:`${invalid.length} baris tidak berisi tautan yang valid dan akan dilewati.`,confirmLabel:`Simpan ${valid.length} tautan`}))return;
        if(valid.length>DOC_BULK_MAX){toast.error(`Maksimal ${DOC_BULK_MAX} tautan sekali simpan. Bagi menjadi beberapa kali.`);return}
        const j=await api('/api/admin/assets',{method:'POST',body:JSON.stringify({action:'create_links',kind:DOC_KIND,...common,items:valid.map(r=>({title:r.title,link_url:r.link_url}))})});
        toast.success(`${j.created} tautan dokumentasi ditambahkan.`);
        setText('');
      }else{
        if(!validLink(one.link_url)){toast.error('Tautan harus diawali https://');return}
        await api('/api/admin/assets',{method:'POST',body:JSON.stringify({action:'create_link',kind:DOC_KIND,...common,...one})});
        toast.success('Tautan dokumentasi ditambahkan.');
        setOne({title:'',link_url:'',description:''});
      }
      await onDone();
    }catch(err){toast.error(err.message)}
    finally{setBusy(false)}
  }

  return <form className="panel asset-upload docs-add" onSubmit={submit}>
    <div className="asm-toolbar"><div><h2>Tambah dokumentasi</h2><p>Khusus tautan. Tempel banyak tautan sekaligus, satu tautan per baris.</p></div>
      <div className="asm-tabs compact" role="tablist"><button type="button" className={mode==='bulk'?'active':''} onClick={()=>setMode('bulk')}>Banyak sekaligus</button><button type="button" className={mode==='one'?'active':''} onClick={()=>setMode('one')}>Satu tautan</button></div>
    </div>
    <div className="docs-add-grid">
      <div className="docs-add-main">
        {mode==='bulk'?<>
          <div className="field"><label>Daftar tautan</label>
            <textarea rows={8} value={text} onChange={e=>setText(e.target.value)} placeholder={'Satu baris satu tautan. Contoh:\nFoto Registrasi Peserta | https://drive.google.com/drive/folders/...\nFoto Sesi Topik 1 | https://photos.app.goo.gl/...\nRekaman Zoom Hari 1 | https://youtu.be/...\nhttps://drive.google.com/drive/folders/...'}/>
            <small>Format: <b>Judul | tautan</b>. Pemisah boleh tab (salin 2 kolom dari Excel), tanda “-”, atau “:”. Baris tanpa judul akan diberi judul otomatis.</small>
          </div>
          {parsed.length>0&&<div className="docs-preview">
            <div className="docs-preview-head"><strong>Pratinjau: {valid.length} tautan siap disimpan</strong>{invalid.length>0&&<span className="status status-bad">{invalid.length} baris dilewati</span>}</div>
            <ol>{parsed.slice(0,50).map(r=><li key={r.line} className={r.error?'bad':''}>
              <span className="docs-preview-title">{r.error?r.raw:r.title}</span>
              <small>{r.error||linkSource(r.link_url).label}</small>
            </li>)}</ol>
            {parsed.length>50&&<small className="docs-preview-more">+{parsed.length-50} baris lainnya</small>}
          </div>}
        </>:<>
          <div className="asm-two">
            <div className="field"><label>Judul</label><input value={one.title} onChange={e=>setOne(x=>({...x,title:e.target.value}))} placeholder="Contoh: Foto Sesi Pembukaan" required maxLength={160}/></div>
            <div className="field"><label>Tautan</label><input type="url" value={one.link_url} onChange={e=>setOne(x=>({...x,link_url:e.target.value}))} placeholder="https://drive.google.com/..." required/></div>
          </div>
          <div className="field"><label>Keterangan (opsional)</label><input value={one.description} onChange={e=>setOne(x=>({...x,description:e.target.value}))} maxLength={500} placeholder="Contoh: 120 foto · fotografer panitia"/></div>
        </>}
      </div>
      <div className="docs-add-side">
        <GroupField id="docs-group" value={common.group_label} onChange={g=>setCommon(x=>({...x,group_label:g}))} suggestions={suggestions}/>
        <div className="field"><label>Untuk</label><select value={common.audience} onChange={e=>setCommon(x=>({...x,audience:e.target.value}))}>{Object.entries(AUDIENCE_LABEL).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></div>
        <label className="switch-line asset-upload-publish"><input type="checkbox" checked={common.published} onChange={e=>setCommon(x=>({...x,published:e.target.checked}))}/><span>Langsung tampil ke peserta</span></label>
      </div>
    </div>
    <div className="asm-form-actions">
      <span className="asm-spacer"/>
      {(mode==='bulk'?text:one.title||one.link_url)&&<button type="button" className="btn btn-secondary" onClick={()=>mode==='bulk'?setText(''):setOne({title:'',link_url:'',description:''})} disabled={busy}>Kosongkan</button>}
      <button className="btn btn-brand-primary" disabled={busy||(mode==='bulk'&&!valid.length)}>{busy?'Menyimpan...':mode==='bulk'?`Simpan ${valid.length||''} tautan`.replace('  ',' '):'Simpan tautan'}</button>
    </div>
  </form>;
}
