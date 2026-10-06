'use client';
import { useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';
import { toast } from '../lib/ui-feedback';
import { fileTypeLabel,formatBytes } from '../lib/event-assets';
import NavIcon from './NavIcon';

// v0.8.0 — Peserta: virtual background Zoom & materi pelatihan.

async function requestUrl(id){
  const {data}=await getSupabaseBrowser().auth.getSession();
  const t=data.session?.access_token||'';
  const r=await fetch('/api/me/assets',{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({id})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.message||'File gagal disiapkan.');
  return j;
}

const COPY={
  virtual_background:{eyebrow:'Zoom Meeting',title:'Virtual Background',lead:'Gunakan latar resmi APTFI saat mengikuti sesi melalui Zoom.',empty:'Panitia belum mengunggah virtual background. Silakan cek kembali menjelang acara.'},
  material:{eyebrow:'Materi Pelatihan',title:'Kumpulan Materi',lead:'Materi dari pemateri dapat diunduh di sini. Materi baru akan muncul otomatis setelah diunggah panitia.',empty:'Belum ada materi. Materi diunggah panitia setelah setiap sesi.'}
};

export default function AssetsPanel({kind,data,loading,refresh}){
  const [busy,setBusy]=useState('');
  const c=COPY[kind]||COPY.material;
  if(loading&&!data)return <section className="participant-card"><div className="participant-loading compact"><div className="spinner"/><p>Memuat {c.title.toLowerCase()}...</p></div></section>;
  if(!data)return <section className="participant-card"><div className="empty-state compact"><h3>Belum dapat dimuat</h3><p>Silakan coba kembali beberapa saat lagi.</p><button className="btn btn-secondary" onClick={refresh}>Muat ulang</button></div></section>;
  if(data.locked)return <section className="participant-card pretest-participant locked"><div className="access-lock">🔒</div><h2>Menunggu verifikasi lengkap</h2><p>{c.title} tersedia untuk peserta dengan persyaratan <strong>Valid</strong> dan pembayaran <strong>Terverifikasi</strong>.</p></section>;

  const assets=data.assets||[];
  async function download(a){
    try{
      setBusy(a.id);
      const j=await requestUrl(a.id);
      if(j.isLink){window.open(j.url,'_blank','noopener');return}
      window.location.href=j.url;
      toast.success('Unduhan dimulai.');
    }catch(e){toast.error(e.message)}
    finally{setBusy('')}
  }
  function openLink(a){requestUrl(a.id).catch(()=>{})}

  return <div className="assets-participant">
    <section className="participant-card assets-head">
      <div className="participant-card-head"><div><div className="eyebrow brand-blue">{c.eyebrow}</div><h2>{c.title}</h2><p>{c.lead}</p></div><span className="status status-info">{assets.length} file</span></div>
    </section>

    {!assets.length&&<section className="participant-card"><div className="empty-state compact"><h3>Belum tersedia</h3><p>{c.empty}</p><button className="btn btn-secondary" onClick={refresh}>Periksa kembali</button></div></section>}

    {kind==='virtual_background'&&assets.length>0&&<>
      <div className="vb-grid participant">{assets.map(a=><article key={a.id} className="vb-card">
        <div className="vb-thumb">{a.preview_url?<img src={a.preview_url} alt={a.title} loading="lazy"/>:<NavIcon name="image" size={32}/>}</div>
        <div className="vb-body"><strong>{a.title}</strong><small>{fileTypeLabel(a)} · {formatBytes(a.file_size)}</small>
          <button type="button" className="btn btn-brand-primary btn-small" onClick={()=>download(a)} disabled={!!busy}><NavIcon name="download" size={15}/>{busy===a.id?'Menyiapkan...':'Unduh'}</button>
        </div>
      </article>)}</div>
      <section className="participant-card vb-howto">
        <h3>Cara memasang di Zoom</h3>
        <ol>
          <li><b>Laptop/PC:</b> buka aplikasi Zoom → klik foto profil → <i>Settings</i> → <i>Background &amp; Effects</i> → tombol <b>+</b> → <i>Add Image</i> → pilih file yang sudah diunduh.</li>
          <li><b>Saat rapat berlangsung:</b> klik tanda ^ di samping tombol <i>Stop Video</i> → <i>Choose Virtual Background</i>.</li>
          <li><b>HP:</b> saat rapat, ketuk <i>More</i> (⋯) → <i>Backgrounds &amp; Effects</i> → <b>+</b> → pilih gambar dari galeri.</li>
        </ol>
        <small>Jika gambar terlihat terbalik di layar Anda, itu normal (efek cermin). Peserta lain melihatnya dengan benar.</small>
      </section>
    </>}

    {kind==='material'&&assets.length>0&&<section className="participant-card"><div className="material-list">{assets.map(a=><article key={a.id} className="material-row">
      <span className="asset-type"><NavIcon name={a.is_link?'link':'file'} size={18}/><b>{fileTypeLabel(a)}</b></span>
      <div className="material-main"><strong>{a.title}</strong>{a.description&&<p>{a.description}</p>}{!a.is_link&&a.file_size>0&&<small>{formatBytes(a.file_size)}</small>}</div>
      {a.is_link&&a.link_url
        ?<a className="btn btn-secondary btn-small" href={a.link_url} target="_blank" rel="noreferrer" onClick={()=>openLink(a)}>Buka <NavIcon name="external" size={14}/></a>
        :<button type="button" className="btn btn-brand-primary btn-small" onClick={()=>download(a)} disabled={!!busy}><NavIcon name="download" size={15}/>{busy===a.id?'...':'Unduh'}</button>}
    </article>)}</div></section>}
  </div>;
}
