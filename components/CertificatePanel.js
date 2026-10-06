'use client';
import { useState } from 'react';
import { toast } from '../lib/ui-feedback';
import { downloadWithAuth } from '../lib/download-client';
import NavIcon from './NavIcon';

// v0.8.0 — Sertifikat peserta: 8 syarat, status rilis, unduh PDF, dan tautan verifikasi.

function fmtDate(v){if(!v)return '';try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v))}catch{return v}}

const HERO={
  ready:{icon:'award',title:'Sertifikat siap diunduh',text:'Selamat! Anda telah memenuhi seluruh syarat Pelatihan Preseptor APTFI.'},
  waiting_release:{icon:'award',title:'Syarat sudah lengkap',text:'Sertifikat dapat diunduh setelah dirilis panitia. Halaman ini akan berubah otomatis begitu sertifikat dirilis.'},
  incomplete:{icon:'award',title:'Belum memenuhi syarat',text:'Selesaikan semua syarat di bawah ini. Sertifikat dirilis panitia setelah acara selesai.'},
  revoked:{icon:'award',title:'Sertifikat dicabut',text:'Sertifikat Anda telah dicabut panitia. Hubungi panitia untuk informasi lebih lanjut.'}
};

export default function CertificatePanel({data,loading,refresh,onOpen}){
  const [busy,setBusy]=useState(false);
  if(loading&&!data)return <section className="participant-card"><div className="participant-loading compact"><div className="spinner"/><p>Memuat sertifikat...</p></div></section>;
  if(!data)return <section className="participant-card"><div className="empty-state compact"><h3>Status sertifikat belum tersedia</h3><p>Silakan coba kembali beberapa saat lagi.</p><button className="btn btn-secondary" onClick={refresh}>Muat ulang</button></div></section>;

  const hero=HERO[data.status]||HERO.incomplete;
  const done=data.items.filter(i=>i.ok).length;
  const cert=data.certificate;

  async function download(){
    try{setBusy(true);await downloadWithAuth('/api/me/certificate/pdf','sertifikat-preseptor-2026.pdf');toast.success('Sertifikat berhasil diunduh.');await refresh()}
    catch(e){toast.error(e.message)}
    finally{setBusy(false)}
  }

  return <div className="cert-participant">
    <section className={`participant-card cert-hero status-${data.status}`}>
      <div className="cert-hero-icon"><NavIcon name={hero.icon} size={30}/></div>
      <div className="cert-hero-text">
        <div className="eyebrow brand-blue">Sertifikat{data.testAccount&&<span className="status status-info">TEST</span>}</div>
        <h2>{hero.title}</h2>
        <p>{hero.text}</p>
      </div>
      <div className="cert-progress" aria-label={`${done} dari ${data.items.length} syarat terpenuhi`}>
        <strong>{done}<small>/{data.items.length}</small></strong><span>syarat</span>
      </div>
    </section>

    {data.testAccount&&<div className="alert alert-info">Akun uji dapat mengunduh sertifikat tanpa menunggu rilis panitia. Sertifikat diberi watermark <b>DUMMY / TEST — TIDAK BERLAKU</b>.</div>}

    {data.status==='ready'&&<section className="participant-card cert-download">
      <div className="cert-name">
        <span>Nama pada sertifikat</span>
        <strong>{data.name}</strong>
        <small>Salah nama atau gelar? Perbaiki di <button type="button" className="link-button" onClick={()=>onOpen?.('profile')}>Profil Saya</button>, lalu unduh ulang.</small>
      </div>
      <button type="button" className="btn btn-brand-primary cert-download-btn" onClick={download} disabled={busy}><NavIcon name="download" size={18}/>{busy?'Menyiapkan PDF...':cert?'Unduh ulang sertifikat (PDF)':'Unduh sertifikat (PDF)'}</button>
      {cert&&<dl className="cert-meta">
        <div><dt>Nomor sertifikat</dt><dd>{cert.number}</dd></div>
        <div><dt>Diterbitkan</dt><dd>{fmtDate(cert.issued_at)} WIB</dd></div>
        {cert.verify_url&&<div><dt>Verifikasi</dt><dd><a href={cert.verify_url} target="_blank" rel="noreferrer">Buka halaman verifikasi ↗</a></dd></div>}
      </dl>}
    </section>}

    <section className="participant-card">
      <div className="participant-card-head"><div><div className="eyebrow brand-blue">Syarat sertifikat</div><h2>{done===data.items.length?'Semua syarat terpenuhi':`${data.items.length-done} syarat belum terpenuhi`}</h2><p>Status diperbarui otomatis dari presensi dan hasil assessment Anda.</p></div></div>
      <ol className="cert-checklist">{data.items.map(item=><li key={item.key} className={item.ok?'ok':'no'}>
        <span className="cert-check" aria-hidden="true">{item.ok?'✓':''}</span>
        <div><strong>{item.label}</strong>{item.detail&&<small>{item.detail}</small>}</div>
        {!item.ok&&item.tab&&onOpen&&data.status!=='revoked'&&<button type="button" className="btn btn-secondary btn-small" onClick={()=>onOpen(item.tab)}>Buka</button>}
      </li>)}</ol>
    </section>
  </div>;
}
