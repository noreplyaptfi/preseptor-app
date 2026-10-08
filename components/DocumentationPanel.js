'use client';
import { useMemo,useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';
import { groupDocs,linkSource,linkIcon } from '../lib/event-assets';
import NavIcon from './NavIcon';

// v0.8.4 — Peserta: dokumentasi kegiatan (tautan foto/video), dikelompokkan dan bisa dicari.

// Mencatat jumlah dibuka (tidak menghalangi tautan terbuka).
async function ping(id){
  try{
    const {data}=await getSupabaseBrowser().auth.getSession();
    const t=data.session?.access_token||'';
    await fetch('/api/me/assets',{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({id}),keepalive:true});
  }catch{}
}

export default function DocumentationPanel({data,loading,refresh}){
  const [q,setQ]=useState('');
  const assets=data?.assets||[];
  const filtered=useMemo(()=>{
    const s=q.trim().toLowerCase();
    return s?assets.filter(a=>`${a.title} ${a.description||''} ${a.group_label||''}`.toLowerCase().includes(s)):assets;
  },[assets,q]);
  const groups=useMemo(()=>groupDocs(filtered),[filtered]);

  if(loading&&!data)return <section className="participant-card"><div className="participant-loading compact"><div className="spinner"/><p>Memuat dokumentasi...</p></div></section>;
  if(!data)return <section className="participant-card"><div className="empty-state compact"><h3>Belum dapat dimuat</h3><p>Silakan coba kembali beberapa saat lagi.</p><button className="btn btn-secondary" onClick={refresh}>Muat ulang</button></div></section>;
  if(data.locked)return <section className="participant-card pretest-participant locked"><div className="access-lock">🔒</div><h2>Menunggu verifikasi lengkap</h2><p>Dokumentasi tersedia untuk peserta dengan persyaratan <strong>Valid</strong> dan pembayaran <strong>Terverifikasi</strong>.</p></section>;

  return <div className="docs-participant">
    <section className="participant-card assets-head">
      <div className="participant-card-head"><div><div className="eyebrow brand-blue">Dokumentasi Kegiatan</div><h2>Foto & Video Pelatihan</h2><p>Kumpulan dokumentasi dari panitia. Tautan dibuka di Google Drive, Google Photos, atau YouTube.</p></div><span className="status status-info">{assets.length} tautan</span></div>
      {assets.length>6&&<div className="search-box docs-search"><span>⌕</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari dokumentasi..." aria-label="Cari dokumentasi"/></div>}
    </section>

    {!assets.length&&<section className="participant-card"><div className="empty-state compact"><h3>Belum tersedia</h3><p>Dokumentasi akan diunggah panitia setelah kegiatan. Silakan cek kembali nanti.</p><button className="btn btn-secondary" onClick={refresh}>Periksa kembali</button></div></section>}
    {assets.length>0&&!filtered.length&&<section className="participant-card"><div className="empty-state compact"><h3>Tidak ditemukan</h3><p>Coba kata kunci lain.</p></div></section>}

    {groups.map(({group,items})=><section key={group} className="participant-card docs-group-card">
      <h3 className="docs-group-title">{group}<span>{items.length}</span></h3>
      <div className="docs-grid">{items.map(a=>{
        const src=linkSource(a.link_url);
        return <a key={a.id} className={`docs-card doc-${src.key}`} href={a.link_url||'#'} target="_blank" rel="noreferrer" onClick={()=>ping(a.id)}>
          <span className="docs-card-icon"><NavIcon name={linkIcon(src.key)} size={20}/></span>
          <span className="docs-card-body"><strong>{a.title}</strong>{a.description&&<small>{a.description}</small>}<em>{src.label}</em></span>
          <span className="docs-card-open">Buka <NavIcon name="external" size={14}/></span>
        </a>;
      })}</div>
    </section>)}
  </div>;
}
