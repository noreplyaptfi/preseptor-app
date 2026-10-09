'use client';
import { useEffect,useState } from 'react';
import NavIcon from './NavIcon';
import BrandMark from './BrandMark';
import { needsNik } from '../lib/nik';

// v0.7.3 — Navigasi peserta: sidebar berkelompok dengan penanda status (desktop & drawer HP),
// topbar HP, dan tombol bawah (Status · Hadir · Tes · Info · Menu).
// v0.8.0 — + Virtual Background, Materi, Sertifikat, Panduan.
// v0.8.4 — + Dokumentasi.
// v0.8.5 — Penanda Profil Saya bila peserta SKP belum mengisi NIK.

export const TAB_LABELS={registration:'Status Pendaftaran',profile:'Profil Saya',attendance:'Kehadiran',access:'Akses Acara',pretest:'Pretest',evaluation:'Evaluasi',posttest:'Posttest',announcements:'Pengumuman',backgrounds:'Virtual Background',materials:'Materi',documentation:'Dokumentasi',certificate:'Sertifikat',guide:'Panduan'};
const TESTS=[['pretest','Pretest','edit'],['evaluation','Evaluasi','star'],['posttest','Posttest','check']];
const MONTHS=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function dayRange(days){
  const list=(days||[]).map(d=>d.event_date).filter(Boolean).sort();
  if(!list.length)return 'Hari-H';
  const first=list[0],last=list[list.length-1];
  const d1=Number(first.slice(8,10)),d2=Number(last.slice(8,10)),m=MONTHS[Number(last.slice(5,7))-1]||'';
  return d1!==d2?`Hari-H · ${d1}–${d2} ${m}`:`Hari-H · ${d2} ${m}`;
}

// Penanda status per menu: done (✓), todo (•), lock (🔒) atau null.
export function navMarkers(data,summary){
  const out={};
  if(data){
    const inactive=['withdrawn','rejected'].includes(data.lifecycle_status);
    const verified=data.requirements_status==='valid'&&data.payment_status==='verified';
    const needs=['incomplete','rejected'].includes(data.requirements_status)||data.payment_status==='rejected'||(data.payment_status==='pending'&&!data.documents?.payment_proof);
    out.registration=inactive?null:(verified||data.is_test_account)?{type:'done',hint:'Terverifikasi'}:needs?{type:'todo',hint:'Perlu dilengkapi'}:{type:'wait',hint:'Menunggu verifikasi'};
    if(needsNik(data))out.profile={type:'todo',hint:'NIK wajib diisi (SKP)'};
  }
  const att=summary?.attendance;
  if(att?.enabled&&att.days?.length){
    const openToday=att.days.some(d=>d.state==='open'&&!d.checked);
    const all=att.days.every(d=>d.checked);
    out.attendance=openToday?{type:'todo',hint:'Presensi dibuka'}:all?{type:'done',hint:'Hadir semua hari'}:null;
  }
  for(const [kind] of TESTS){
    const s=summary?.assessments?.[kind];
    if(!s)continue;
    if(kind==='posttest'){
      if(s.passed)out[kind]={type:'done',hint:'Lulus'};
      else if(s.canStart)out[kind]={type:'todo',hint:s.done?'Belum lulus · bisa diulang':'Dibuka'};
      else if(s.done)out[kind]={type:'wait',hint:'Belum lulus'};
      else if(['inactive','upcoming','not_configured'].includes(s.state)||!s.attendanceOk)out[kind]={type:'lock',hint:!s.attendanceOk?'Presensi dulu':'Belum dibuka'};
      continue;
    }
    if(s.done)out[kind]={type:'done',hint:'Selesai'};
    else if(s.canStart)out[kind]={type:'todo',hint:'Dibuka'};
    else if(['inactive','upcoming','not_configured'].includes(s.state)||!s.attendanceOk)out[kind]={type:'lock',hint:!s.attendanceOk?'Presensi dulu':'Belum dibuka'};
  }
  const cert=summary?.certificate;
  if(cert){
    if(cert.status==='ready')out.certificate=cert.downloaded?{type:'done',hint:'Sudah diunduh'}:{type:'todo',hint:'Siap diunduh'};
    else if(cert.status==='waiting_release')out.certificate={type:'wait',hint:'Menunggu rilis panitia'};
    else if(cert.status==='incomplete')out.certificate={type:'lock',hint:'Syarat belum lengkap'};
  }
  return out;
}

function Marker({m}){
  if(!m)return null;
  if(m.type==='done')return <span className="nav-mark done" title={m.hint} aria-label={m.hint}>✓</span>;
  if(m.type==='todo')return <span className="nav-mark todo" title={m.hint} aria-label={m.hint}/>;
  if(m.type==='lock')return <span className="nav-mark lock" title={m.hint} aria-label={m.hint}>🔒</span>;
  return <span className="nav-mark wait" title={m.hint} aria-label={m.hint}/>;
}

export function ParticipantSidebar({tab,select,data,summary,markers,unreadCount,collapsed,toggleCollapsed,open,close,logout}){
  const count=n=>n>0?<span className="nav-count">{n}</span>:null;
  const Item=({id,icon,label,extra})=><button type="button" className={`nav-item ${tab===id?'active':''}`} onClick={()=>select(id)} data-tip={label} aria-current={tab===id?'page':undefined}>
    <NavIcon name={icon}/><span className="nav-text">{label}</span>{extra}<Marker m={markers[id]}/>
  </button>;
  const name=String(data?.full_name||'Peserta');
  return <>
    {open&&<button type="button" className="nav-backdrop" onClick={close} aria-label="Tutup menu"/>}
    <aside className={`app-sidebar part-side ${open?'open':''}`} aria-label="Menu peserta">
      <div className="side-brand">
        <BrandMark title="APTFI" subtitle="Pelatihan Preseptor 2026"/>
        <button type="button" className="side-close" onClick={close} aria-label="Tutup menu"><NavIcon name="close"/></button>
      </div>
      <nav className="side-nav">
        <Item id="registration" icon="home" label="Status Pendaftaran"/>
        <Item id="profile" icon="user" label="Profil Saya"/>
        <div className="nav-section">{dayRange(summary?.attendance?.days)}</div>
        <Item id="attendance" icon="calendar-check" label="Kehadiran"/>
        <Item id="access" icon="play" label="Akses Acara"/>
        <Item id="backgrounds" icon="image" label="Virtual Background" extra={count(summary?.assets?.virtual_background)}/>
        <Item id="materials" icon="folder" label="Materi" extra={count(summary?.assets?.material)}/>
        <Item id="documentation" icon="camera" label="Dokumentasi" extra={count(summary?.assets?.documentation)}/>
        <div className="nav-section">Assessment</div>
        {TESTS.map(([id,label,icon])=><Item key={id} id={id} icon={icon} label={label}/>)}
        <div className="nav-section">Penyelesaian</div>
        <Item id="certificate" icon="award" label="Sertifikat"/>
        <div className="nav-section">Info</div>
        <Item id="announcements" icon="bell" label="Pengumuman" extra={unreadCount>0?<span className="nav-badge danger">{unreadCount}</span>:null}/>
        <Item id="guide" icon="compass" label="Panduan"/>
      </nav>
      <div className="side-foot">
        <div className="side-profile" data-tip={`${name} · Keluar`}>
          <span className="side-avatar">{name.replace(/^(apt\.|dr\.|prof\.)\s*/i,'').slice(0,1).toUpperCase()}</span>
          <span className="side-profile-text"><b>{name}</b><small>{data?.registration_code||''}</small>{data?.attendance_mode&&<span className="side-chip">{data.attendance_mode}</span>}</span>
          <button type="button" className="side-logout" onClick={logout} aria-label="Keluar" title="Keluar"><NavIcon name="logout"/></button>
        </div>
        <button type="button" className="side-collapse" onClick={toggleCollapsed} aria-label={collapsed?'Perluas sidebar':'Ciutkan sidebar'}>
          <NavIcon name={collapsed?'chevron-right':'chevron-left'} size={16}/><span className="nav-text">Ciutkan</span>
        </button>
      </div>
    </aside>
  </>;
}

export function ParticipantTopbar({tab,unreadCount,openAnnouncements}){
  return <header className="nav-topbar part-topbar">
    <div className="topbar-title"><BrandMark compact size="sm"/><div><b>{TAB_LABELS[tab]||'Dashboard'}</b><small>Preseptor 2026</small></div></div>
    <button type="button" className="topbar-btn" onClick={openAnnouncements} aria-label={`Pengumuman${unreadCount?` (${unreadCount} belum dibaca)`:''}`}><NavIcon name="bell"/>{unreadCount>0&&<span className="topbar-dot"/>}</button>
  </header>;
}

export function ParticipantTabbar({tab,select,openMenu,unreadCount,markers}){
  const [sheet,setSheet]=useState(false);
  useEffect(()=>{
    if(!sheet)return;
    const onKey=e=>{if(e.key==='Escape')setSheet(false)};
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[sheet]);
  const testActive=TESTS.some(([id])=>id===tab)||tab==='certificate';
  const testTodo=TESTS.some(([id])=>markers[id]?.type==='todo')||markers.certificate?.type==='todo';
  const go=id=>{setSheet(false);select(id)};
  const Tab=({active,icon,label,onClick,dot,badge})=><button type="button" className={`tab-btn ${active?'active':''}`} onClick={onClick} aria-current={active?'page':undefined}>
    <span className="tab-icon"><NavIcon name={icon} size={21}/>{badge?<span className="tab-badge">{badge>9?'9+':badge}</span>:dot?<span className="tab-dot"/>:null}</span>
    <span className="tab-label">{label}</span>
  </button>;
  return <>
    <nav className="tabbar" aria-label="Navigasi cepat">
      <Tab active={!sheet&&tab==='registration'} icon="home" label="Status" onClick={()=>go('registration')} dot={markers.registration?.type==='todo'}/>
      <Tab active={!sheet&&tab==='attendance'} icon="calendar-check" label="Hadir" onClick={()=>go('attendance')} dot={markers.attendance?.type==='todo'}/>
      <Tab active={testActive||sheet} icon="tests" label="Tes" onClick={()=>setSheet(v=>!v)} dot={testTodo}/>
      <Tab active={!sheet&&tab==='announcements'} icon="bell" label="Info" onClick={()=>go('announcements')} badge={unreadCount}/>
      <Tab active={!sheet&&['profile','access','backgrounds','materials','documentation','guide'].includes(tab)} icon="menu" label="Menu" onClick={()=>{setSheet(false);openMenu()}} dot={markers.profile?.type==='todo'}/>
    </nav>
    {sheet&&<>
      <button type="button" className="sheet-backdrop" onClick={()=>setSheet(false)} aria-label="Tutup"/>
      <div className="tab-sheet" role="dialog" aria-label="Pilih assessment atau sertifikat">
        <div className="tab-sheet-grip"/>
        <strong>Assessment</strong>
        {TESTS.map(([id,label,icon])=>{const m=markers[id];return <button type="button" key={id} className={`sheet-item ${tab===id?'active':''}`} onClick={()=>go(id)}>
          <span className="sheet-icon"><NavIcon name={icon}/></span>
          <span className="sheet-text"><b>{label}</b><small>{m?.hint||'Lihat detail'}</small></span>
          <Marker m={m}/>
        </button>})}
        <strong className="sheet-divider">Penyelesaian</strong>
        <button type="button" className={`sheet-item ${tab==='certificate'?'active':''}`} onClick={()=>go('certificate')}>
          <span className="sheet-icon"><NavIcon name="award"/></span>
          <span className="sheet-text"><b>Sertifikat</b><small>{markers.certificate?.hint||'Lihat syarat & unduh'}</small></span>
          <Marker m={markers.certificate}/>
        </button>
      </div>
    </>}
  </>;
}
