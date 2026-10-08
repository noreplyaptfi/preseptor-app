'use client';
import { useEffect,useState } from 'react';
import NavIcon from './NavIcon';
import BrandMark from './BrandMark';

// v0.7.3 — Sidebar admin: lambang APTFI, ikon seragam, badge antrean, tooltip saat diciutkan,
// dan drawer + topbar (dengan tombol Scan QR) di HP.

const TITLES={overview:'Ringkasan',participants:'Pendaftar',requests:'Permintaan Peserta',special:'Peserta Khusus',refunds:'Refund',settings:'Status Form',announcements:'Pengumuman',access:'Akses Acara',dayh:'Command Center',pretest:'Pretest',evaluation:'Evaluasi',posttest:'Posttest',assets:'Materi & Background',documentation:'Dokumentasi',certificates:'Sertifikat',masterdata:'Data Master',homebases:'Data Homebase',testaccounts:'Akun Uji',team:'Tim Panitia',guide:'Panduan Admin'};

function Badge({value,tone='warn'}){
  if(!value)return null;
  return <span className={`nav-badge ${tone}`}>{value>99?'99+':value}</span>;
}

export default function AdminSidebar({view,setView,adminUser,roleLabel={},openNavGroup,toggleNavGroup,collapsed,toggleSidebar,logout,counts={}}){
  const [open,setOpen]=useState(false);
  const role=adminUser?.role;
  const is=(...roles)=>roles.includes(role);

  useEffect(()=>{
    if(!open)return;
    const prev=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const onKey=e=>{if(e.key==='Escape')setOpen(false)};
    window.addEventListener('keydown',onKey);
    return ()=>{document.body.style.overflow=prev;window.removeEventListener('keydown',onKey)};
  },[open]);

  function go(next){setView(next);setOpen(false)}
  function scan(){location.href='/admin/checkin'}

  const groups=[
    {id:'participants',label:'Peserta',icon:'users',items:[
      {view:'participants',label:'Pendaftar',icon:'users',badge:counts.queue,hint:counts.queue?`${counts.queue} menunggu verifikasi`:''},
      is('super_admin','event_admin')&&{view:'requests',label:'Permintaan',icon:'inbox',badge:counts.requests,tone:'danger',hint:counts.requests?`${counts.requests} permintaan baru`:''},
      is('super_admin','event_admin')&&{view:'special',label:'Peserta Khusus',icon:'star'}
    ]},
    is('super_admin','event_admin','payment_verifier')&&{id:'finance',label:'Keuangan',icon:'wallet',items:[
      {view:'refunds',label:'Refund',icon:'wallet',badge:counts.refunds,hint:counts.refunds?`${counts.refunds} refund perlu ditinjau`:''}
    ]},
    {id:'registration',label:'Pendaftaran',icon:'form',items:[
      {view:'settings',label:'Status Form',icon:'form'},
      {view:'announcements',label:'Pengumuman',icon:'megaphone'}
    ]},
    {id:'event',label:'Pelaksanaan',icon:'calendar',items:[
      {view:'access',label:'Akses Acara',icon:'play'},
      is('super_admin')&&{view:'dayh',label:'Hari-H',icon:'calendar-check'},
      is('super_admin')&&{view:'pretest',label:'Pretest',icon:'edit'},
      is('super_admin')&&{view:'evaluation',label:'Evaluasi',icon:'star'},
      is('super_admin')&&{view:'posttest',label:'Posttest',icon:'check'},
      is('super_admin','event_admin')&&{view:'assets',label:'Materi & Background',icon:'folder'},
      is('super_admin','event_admin')&&{view:'documentation',label:'Dokumentasi',icon:'camera'},
      is('super_admin')&&{view:'certificates',label:'Sertifikat',icon:'award'},
      {action:scan,label:'Scan QR',icon:'qr',key:'scan'}
    ]},
    {id:'system',label:'Data & Sistem',icon:'database',items:[
      is('super_admin','event_admin')&&{view:'masterdata',label:'Data Master',icon:'database'},
      is('super_admin','event_admin')&&{view:'homebases',label:'Data Homebase',icon:'building'},
      is('super_admin')&&{view:'testaccounts',label:'Akun Uji',icon:'flask'},
      is('super_admin')&&{view:'team',label:'Tim Panitia',icon:'shield'},
      {view:'guide',label:'Panduan Admin',icon:'book'}
    ]}
  ].filter(Boolean).map(g=>({...g,items:g.items.filter(Boolean)}));

  const initial=(adminUser?.display_name||adminUser?.email||'A').slice(0,1).toUpperCase();

  return <>
    <header className="nav-topbar admin-topbar">
      <button type="button" className="topbar-btn" onClick={()=>setOpen(true)} aria-label="Buka menu" aria-expanded={open}><NavIcon name="menu"/>{(counts.queue||counts.requests)?<span className="topbar-dot"/>:null}</button>
      <div className="topbar-title"><BrandMark compact size="sm"/><div><b>{TITLES[view]||'Dashboard'}</b><small>Panel Panitia</small></div></div>
      <button type="button" className="topbar-btn primary" onClick={scan} aria-label="Scan QR presensi"><NavIcon name="qr"/></button>
    </header>

    {open&&<button type="button" className="nav-backdrop" onClick={()=>setOpen(false)} aria-label="Tutup menu"/>}

    <aside className={`app-sidebar admin-side ${open?'open':''}`} aria-label="Menu panitia">
      <div className="side-brand">
        <BrandMark title="APTFI" subtitle="Panel Panitia · Preseptor 2026"/>
        <button type="button" className="side-close" onClick={()=>setOpen(false)} aria-label="Tutup menu"><NavIcon name="close"/></button>
      </div>

      <nav className="side-nav">
        <button type="button" className={`nav-item ${view==='overview'?'active':''}`} onClick={()=>go('overview')} data-tip="Ringkasan"><NavIcon name="home"/><span className="nav-text">Ringkasan</span></button>
        {groups.map(g=>{
          const isOpen=openNavGroup===g.id;
          const hasActive=g.items.some(it=>it.view===view);
          const total=g.items.reduce((s,it)=>s+(Number(it.badge)||0),0);
          const tip=total?`${g.label} · ${total} perlu tindakan`:g.label;
          return <div key={g.id} className={`nav-group ${isOpen?'open':''} ${hasActive?'has-active':''}`}>
            <button type="button" className="nav-item nav-group-head" onClick={()=>toggleNavGroup(g.id)} aria-expanded={isOpen} data-tip={tip}>
              <NavIcon name={g.icon}/><span className="nav-text">{g.label}</span>
              {(!isOpen||collapsed)&&<Badge value={total} tone={g.items.some(it=>it.badge&&it.tone==='danger')?'danger':'warn'}/>}
              <NavIcon name="chevron-down" className="nav-caret" size={16}/>
            </button>
            <div className="nav-sub">
              {g.items.map(it=><button type="button" key={it.view||it.key} className={`nav-item sub ${it.view&&view===it.view?'active':''}`} onClick={()=>it.action?it.action():go(it.view)} title={it.hint||undefined}>
                <NavIcon name={it.icon} size={16}/><span className="nav-text">{it.label}</span><Badge value={it.badge} tone={it.tone}/>{it.action&&<NavIcon name="external" size={14} className="nav-ext"/>}
              </button>)}
            </div>
          </div>;
        })}
      </nav>

      <div className="side-foot">
        <div className="side-profile" data-tip={`${adminUser?.display_name||'Panitia'} · Keluar`}>
          <span className="side-avatar">{initial}</span>
          <span className="side-profile-text"><b>{adminUser?.display_name||'Panitia APTFI'}</b><small>{roleLabel[role]||role||''}</small></span>
          <button type="button" className="side-logout" onClick={logout} aria-label="Keluar" title="Keluar"><NavIcon name="logout"/></button>
        </div>
        <button type="button" className="side-collapse" onClick={toggleSidebar} aria-label={collapsed?'Perluas sidebar':'Ciutkan sidebar'}>
          <NavIcon name={collapsed?'chevron-right':'chevron-left'} size={16}/><span className="nav-text">Ciutkan</span>
        </button>
      </div>
    </aside>
  </>;
}
