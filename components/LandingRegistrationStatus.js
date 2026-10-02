'use client';

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
    ...(failed
      ? {tone:'neutral',label:'Lihat formulir',detail:'Status pendaftaran dapat dilihat pada halaman formulir.'}
      : modePresentation(mode,settings?.modeAvailability?.[mode]))
  })),[failed,settings]);

  useEffect(()=>{
    if(!settings||failed)return;
    const registrationAvailable=!!(settings?.availability?.Online||settings?.availability?.Offline);
    const links=[...document.querySelectorAll('a[href="/daftar"], a[data-registration-cta="1"]')];
    for(const link of links){
      if(!link.dataset.registrationOriginalHref)link.dataset.registrationOriginalHref=link.getAttribute('href')||'/daftar';
      link.dataset.registrationCta='1';
      if(!registrationAvailable){
        link.removeAttribute('href');
        link.setAttribute('aria-disabled','true');
        link.setAttribute('tabindex','-1');
        link.classList.add('registration-cta-disabled');
        link.title='Pendaftaran Online dan Offline sedang tidak tersedia.';
      }else{
        link.setAttribute('href',link.dataset.registrationOriginalHref||'/daftar');
        link.removeAttribute('aria-disabled');
        link.removeAttribute('tabindex');
        link.classList.remove('registration-cta-disabled');
        link.removeAttribute('title');
      }
    }
  },[settings,failed]);

  return (
    <aside className="landing-info-card landing-registration-card">
      <div className="landing-registration-heading landing-registration-heading-compact">
        <small>Status pendaftaran</small>
        <strong>Online & Offline</strong>
        <span>Status otomatis mengikuti jadwal dan kuota yang diatur panitia.</span>
      </div>

      <div className="landing-mode-list landing-mode-list-compact" aria-live="polite">
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
    </aside>
  );
}
