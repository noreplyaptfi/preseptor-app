// v0.8.0 — Aturan sertifikat (tanpa akses database; aman dipakai di server maupun client).

export const CERTIFICATE_DEFAULTS={
  heading:'SERTIFIKAT',
  role_text:'PESERTA',
  event_name:'Pelatihan Preseptor Profesi Apoteker',
  organizer:'Asosiasi Pendidikan Tinggi Farmasi Indonesia (APTFI)',
  date_text:'7–8 Oktober 2026',
  location_text:'Padang',
  issue_place:'Padang',
  issue_date_text:'8 Oktober 2026',
  signatory_title:'Ketua Umum APTFI',
  signatory_name:'Prof. Dr. apt. Yandi Syukri, M.Si.',
  number_format:'{NNN}/APTFI/PRESEPTOR/X/2026',
  note_text:''
};

export const CERTIFICATE_FIELDS=[
  ['heading','Judul sertifikat',40],
  ['role_text','Peran peserta',40],
  ['event_name','Nama kegiatan',120],
  ['organizer','Penyelenggara',140],
  ['date_text','Tanggal kegiatan',60],
  ['location_text','Lokasi luring',60],
  ['issue_place','Tempat terbit',60],
  ['issue_date_text','Tanggal terbit',60],
  ['signatory_title','Jabatan penandatangan',80],
  ['signatory_name','Nama penandatangan',120],
  ['number_format','Format nomor',80],
  ['note_text','Catatan tambahan (opsional)',160]
];

export function certificateConfig(raw){
  const src=raw&&typeof raw==='object'?raw:{};
  const out={...CERTIFICATE_DEFAULTS};
  for(const [key,,max] of CERTIFICATE_FIELDS){
    if(Object.prototype.hasOwnProperty.call(src,key)){
      const v=String(src[key]??'').replace(/\s+/g,' ').trim().slice(0,max);
      out[key]=key==='note_text'?v:(v||CERTIFICATE_DEFAULTS[key]);
    }
  }
  return out;
}

// '{NNN}/APTFI/PRESEPTOR/X/2026' + 7 -> '007/APTFI/PRESEPTOR/X/2026'. Akun TEST diberi awalan TEST-.
export function formatCertificateNo(format,serial,isTest=false){
  const f=String(format||CERTIFICATE_DEFAULTS.number_format);
  const n=Math.max(0,Number(serial)||0);
  let used=false;
  let out=f.replace(/\{(N+)\}/g,(_,ns)=>{used=true;return String(n).padStart(ns.length,'0')});
  if(!used)out=`${String(n).padStart(3,'0')}/${out}`;
  return isTest?`TEST-${out}`:out;
}

export function modeText(mode,config){
  const c=config||CERTIFICATE_DEFAULTS;
  return mode==='Offline'?`secara luring di ${c.location_text}`:'secara daring melalui Zoom Meeting';
}

function percent(a){
  const max=Number(a?.max_score||0);
  if(!max)return null;
  return Math.round(Number(a?.score||0)/max*100);
}

// Delapan syarat sertifikat sesuai roadmap.
// input: { reg, days:[{id,day_number,title}], checkedDayIds:Set, modules:{pretest,evaluation,posttest}, attempts:{[moduleId]:[{score,max_score}]} }
export function certificateChecklist({reg,days=[],checkedDayIds=new Set(),modules={},attempts={}}){
  const test=!!reg?.is_test_account||reg?.lifecycle_status==='test';
  const life=String(reg?.lifecycle_status||'active');
  const day=n=>days.find(d=>Number(d.day_number)===n);
  const present=n=>{const d=day(n);return !!d&&checkedDayIds.has(d.id)};
  const tries=m=>m?(attempts[m.id]||[]):[];
  const post=modules.posttest;
  const pass=post&&post.pass_percent!==null&&post.pass_percent!==undefined?Number(post.pass_percent):null;
  const postTries=tries(post);
  const best=postTries.reduce((top,a)=>{const p=percent(a);return p!==null&&(top===null||p>top)?p:top},null);
  const postOk=postTries.length>0&&(pass===null||(best!==null&&best>=pass));
  const items=[
    {key:'active',label:'Pendaftaran aktif',ok:test||['active','withdrawal_requested'].includes(life),tab:'registration'},
    {key:'requirements',label:'Dokumen persyaratan valid',ok:test||reg?.requirements_status==='valid',tab:'registration'},
    {key:'payment',label:'Pembayaran terverifikasi',ok:test||reg?.payment_status==='verified',tab:'registration'},
    {key:'day1',label:`Hadir ${day(1)?.title||'Hari 1'}`,ok:present(1),tab:'attendance'},
    {key:'day2',label:`Hadir ${day(2)?.title||'Hari 2'}`,ok:present(2),tab:'attendance'},
    {key:'pretest',label:'Pretest selesai',ok:tries(modules.pretest).length>0,tab:'pretest'},
    {key:'evaluation',label:'Evaluasi pemateri selesai',ok:tries(modules.evaluation).length>0,tab:'evaluation'},
    {key:'posttest',label:pass===null?'Posttest selesai':`Posttest lulus (nilai terbaik ≥ ${pass})`,ok:postOk,tab:'posttest',detail:best===null?'Belum dikerjakan':`Nilai terbaik ${best}`}
  ];
  return {items,eligible:items.every(i=>i.ok),test,best,pass};
}

// Status yang dilihat peserta.
//   revoked          dicabut panitia
//   ready            boleh diunduh (eligible & dirilis, atau diterbitkan manual, atau akun TEST yang eligible)
//   waiting_release  sudah memenuhi syarat, menunggu panitia merilis
//   incomplete       belum memenuhi syarat
export function certificateStatus({checklist,released,cert}){
  if(cert?.revoked_at)return 'revoked';
  if(cert&&cert.issued_via==='manual')return 'ready';
  if(checklist.eligible&&(released||checklist.test))return 'ready';
  if(checklist.eligible)return 'waiting_release';
  return 'incomplete';
}

export const STATUS_LABEL={
  ready:'Siap diunduh',
  waiting_release:'Menunggu rilis panitia',
  incomplete:'Belum memenuhi syarat',
  revoked:'Dicabut'
};

// Hanya karakter WinAnsi (font standar PDF). Huruf beraksen diganti padanan ASCII.
const WIN_EXTRA='€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
export function winAnsiSafe(value,{trim=true}={}){
  const out=String(value??'').normalize('NFC').split('').map(ch=>{
    const c=ch.charCodeAt(0);
    if(c<0x20)return ' ';
    if(c<=0x7e||(c>=0xa0&&c<=0xff)||WIN_EXTRA.includes(ch))return ch;
    const base=ch.normalize('NFKD').replace(/[̀-ͯ]/g,'');
    return [...base].every(b=>b.charCodeAt(0)<=0x7e)?base:'';
  }).join('').replace(/\s+/g,' ');
  return trim?out.trim():out;
}
