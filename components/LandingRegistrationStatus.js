'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const MODE_ORDER=['Online','Offline'];

function formatDateTime(value){
  if(!value)return null;
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return null;
  const parts=new Intl.DateTimeFormat('id-ID',{
    day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',
    hour12:false,timeZone:'Asia/Jakarta'
  }).formatToParts(date);
  const pick=type=>parts.find(part=>part.type===type)?.value||'';
  return `${pick('day')} ${pick('month')} ${pick('year')} · ${pick('hour')}.${pick('minute')} WIB`;
}

function modePresentation(mode,state){
  if(!state)return {tone:'neutral',label:'Memuat',detail:'Memeriksa status pendaftaran…'};
  const closes=formatDateTime(state.closes_at);
  const opens=formatDateTime(state.opens_at);

  if(state.selectable){
    return {
      tone:'open',
      label:'Dibuka',
      detail:closes?`Sampai ${closes}`:'Pendaftaran sedang dibuka.'
    };
  }

  if(state.reason==='quota_full'||state.reason==='total_quota_full'){
    return {tone:'full',label:'Kuota penuh',detail:state.reason==='total_quota_full'?'Kuota pendaftaran keseluruhan sudah penuh.':`Kuota ${mode} sudah penuh.`};
  }
  if(state.reason==='not_open'){
    return {tone:'scheduled',label:'Belum dibuka',detail:opens?`Dibuka ${opens}`:`Pendaftaran ${mode} belum dibuka.`};
  }
  if(state.reason==='maintenance'){
    return {tone:'scheduled',label:'Pemeliharaan',detail:state.message||'Pendaftaran sedang dalam pemeliharaan.'};
  }
  return {tone:'closed',label:'Ditutup',detail:closes?`Ditutup sejak ${closes}`:(state.message||`Pendaftaran ${mode} sudah ditutup.`)};
}

export default function LandingRegistrationStatus(){
  const [settings,setSettings]=useState(null);
  const [failed,setFailed]=useState(false);

  useEffect(()=>{
    let active=true;
    fetch('/api/public/settings',{cache:'no-store'})
      .then(async response=>{
        const body=await response.json().catch(()=>null);
        if(!response.ok)throw new Error(body?.message||'Gagal membaca status pendaftaran.');
        if(active)setSettings(body);
      })
      .catch(()=>{if(active)setFailed(true)});
    return()=>{active=false};
  },[]);

  const rows=useMemo(()=>MODE_ORDER.map(mode=>({
    mode,
    ...modePresentation(mode,settings?.modeAvailability?.[mode])
  })),[settings]);

  const overall=useMemo(()=>{
    if(failed)return {tone:'neutral',text:'Status pendaftaran dapat dilihat pada halaman formulir.'};
    if(!settings)return null;
    const states=MODE_ORDER.map(mode=>settings?.modeAvailability?.[mode]).filter(Boolean);
    const selectable=states.filter(item=>item.selectable).length;
    if(selectable===2)return null;
    if(selectable===1)return {tone:'info',text:'Satu mode pendaftaran masih tersedia. Periksa status Online dan Offline di bawah.'};
    const allFull=states.length===2&&states.every(item=>item.reason==='quota_full'||item.reason==='total_quota_full');
    if(allFull)return {tone:'full',text:'Kuota pendaftaran saat ini sudah penuh.'};
    return {tone:'closed',text:'Pendaftaran Online dan Offline saat ini tidak tersedia.'};
  },[failed,settings]);

  return (
    <aside className="landing-info-card landing-registration-card">
      <span className="info-ribbon">Pendaftaran</span>

      <div className="landing-registration-heading">
        <small>Status pendaftaran</small>
        <strong>Online & Offline</strong>
        <span>Status berikut otomatis mengikuti jadwal dan kuota yang diatur panitia.</span>
      </div>

      <div className="landing-mode-list" aria-live="polite">
        {rows.map(row=>(
          <div className="landing-mode-row" key={row.mode}>
            <div className="landing-mode-row-head">
              <strong>{row.mode}</strong>
              <span className={`landing-mode-badge is-${row.tone}`}>{row.label}</span>
            </div>
            <p>{row.detail}</p>
          </div>
        ))}
      </div>

      {overall&&<div className={`landing-registration-alert is-${overall.tone}`}>{overall.text}</div>}

      <div className="landing-info-block landing-payment-block">
        <small>Biaya pendaftaran</small>
        <strong>Rp1.000.000</strong>
        <span>BNI 6666512055 · a.n APTFI</span>
      </div>

      <div className="landing-info-block">
        <small>Syarat utama</small>
        <ul>
          <li>Memiliki STRA</li>
          <li>Pengalaman praktik/mengajar sesuai ketentuan</li>
        </ul>
      </div>
      <Link className="text-link landing-requirement-link" href="/panduan">Lihat persyaratan lengkap →</Link>
    </aside>
  );
}
