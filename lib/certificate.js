// v0.8.0 — Aturan sertifikat (tanpa akses database; aman dipakai di server maupun client).
// v0.8.6 — nomor awal, halaman 2 (tabel materi & JEP), teks bahasa Inggris, pemateri & moderator.

const SYLLABUS_ID=[
  'Pretes | 0,25',
  '_Pedagogik dalam pendidikan profesi apoteker_ | 1,5',
  'Keterampilan Manajemen | 1,5',
  'Peran Preseptor Sebagai Fasilitator dan Evaluator | 1,5',
  'Peran Preseptor Sebagai Role Model dan Edukator | 1,5',
  'Interprofesional Education dan Interprofesional Collaboration | 1,5',
  'Komunikasi Interpersonal dan Manajemen konflik | 1,5',
  '_Sharing Experiences_ | 1',
  'Postes | 0,25'
].join('\n');

const SYLLABUS_EN=[
  'Pre-test | 0.25',
  'Pedagogy in Pharmacist Professional Education | 1.5',
  'Management Skills | 1.5',
  'The Preceptor as Facilitator and Evaluator | 1.5',
  'The Preceptor as Role Model and Educator | 1.5',
  'Interprofessional Education and Interprofessional Collaboration | 1.5',
  'Interpersonal Communication and Conflict Management | 1.5',
  'Sharing Experiences | 1',
  'Post-test | 0.25'
].join('\n');

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
  number_format:'{NNN}/X/SERTIF/APTFI/2026',
  number_start:'339',
  note_text:'',
  syllabus_title:'MATERI PELATIHAN',
  syllabus_text:SYLLABUS_ID,
  heading_en:'CERTIFICATE',
  event_name_en:'Preceptor Training for Pharmacist Professional Education',
  organizer_en:'Indonesian Association of Pharmacy Higher Education (APTFI)',
  date_text_en:'7–8 October 2026',
  location_text_en:'Padang, Indonesia',
  issue_date_text_en:'8 October 2026',
  signatory_title_en:'Chairperson of APTFI',
  syllabus_title_en:'TRAINING MATERIALS',
  syllabus_text_en:SYLLABUS_EN
};

// [kunci, label, panjang maks., opsi]. opsi.group: umum | halaman2 | inggris; opsi.type: text | number | textarea.
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
  ['number_start','Nomor awal',6,{type:'number'}],
  ['note_text','Catatan tambahan (opsional)',160],
  ['syllabus_title','Judul halaman 2',60,{group:'halaman2'}],
  ['syllabus_text','Tabel materi (satu baris: Materi | Durasi JEP)',3000,{group:'halaman2',type:'textarea'}],
  ['heading_en','Judul (Inggris)',40,{group:'inggris'}],
  ['event_name_en','Nama kegiatan (Inggris)',140,{group:'inggris'}],
  ['organizer_en','Penyelenggara (Inggris)',160,{group:'inggris'}],
  ['date_text_en','Tanggal kegiatan (Inggris)',60,{group:'inggris'}],
  ['location_text_en','Lokasi luring (Inggris)',60,{group:'inggris'}],
  ['issue_date_text_en','Tanggal terbit (Inggris)',60,{group:'inggris'}],
  ['signatory_title_en','Jabatan penandatangan (Inggris)',80,{group:'inggris'}],
  ['syllabus_title_en','Judul halaman 2 (Inggris)',60,{group:'inggris'}],
  ['syllabus_text_en','Tabel materi (Inggris)',3000,{group:'inggris',type:'textarea'}]
];

const OPTIONAL_FIELDS=['note_text'];

function cleanMultiline(value,max){
  return String(value??'').replace(/\r/g,'').split('\n').map(l=>l.replace(/\t+/g,' | ').replace(/\s+/g,' ').trim()).filter(Boolean).join('\n').slice(0,max);
}

export function certificateConfig(raw){
  const src=raw&&typeof raw==='object'?raw:{};
  const out={...CERTIFICATE_DEFAULTS};
  for(const [key,,max,opts={}] of CERTIFICATE_FIELDS){
    if(!Object.prototype.hasOwnProperty.call(src,key))continue;
    if(opts.type==='textarea'){out[key]=cleanMultiline(src[key],max)||CERTIFICATE_DEFAULTS[key];continue}
    const v=String(src[key]??'').replace(/\s+/g,' ').trim().slice(0,max);
    if(opts.type==='number'){const n=Number.parseInt(v,10);out[key]=Number.isFinite(n)&&n>=1&&n<=99999?String(n):CERTIFICATE_DEFAULTS[key];continue}
    out[key]=OPTIONAL_FIELDS.includes(key)?v:(v||CERTIFICATE_DEFAULTS[key]);
  }
  // Tanda tangan & cap disimpan di storage privat; config hanya menyimpan path-nya.
  if(typeof src.signature_path==='string'&&src.signature_path)out.signature_path=src.signature_path;
  if(src.signature_updated_at)out.signature_updated_at=String(src.signature_updated_at);
  return out;
}

// Nomor tampil = nomor awal + nomor urut − 1. Contoh: nomor awal 339, urut 1 → 339/X/SERTIF/APTFI/2026.
export function certificateNumber(config,serial,isTest=false){
  const start=Number.parseInt(config?.number_start,10)||1;
  return formatCertificateNo(config?.number_format,start+Math.max(1,Number(serial)||1)-1,isTest);
}

// Teks dengan bagian miring: "Peran Preseptor Sebagai _Role Model_ dan Edukator"
// → [{text:'Peran Preseptor Sebagai ',italic:false},{text:'Role Model',italic:true},{text:' dan Edukator',italic:false}]
export function parseItalic(value){
  const s=String(value||'');
  const parts=[];
  const re=/_([^_]+)_/g;
  let last=0,m;
  while((m=re.exec(s))){
    if(m.index>last)parts.push({text:s.slice(last,m.index),italic:false});
    parts.push({text:m[1],italic:true});
    last=m.index+m[0].length;
  }
  if(last<s.length)parts.push({text:s.slice(last),italic:false});
  return parts.filter(p=>p.text);
}

// Halaman 2: "Materi | 1,5" per baris. Kata/kalimat yang diapit _..._ dicetak miring
// (boleh sebagian kata, mis. "_Interprofesional Education_ dan _Interprofesional Collaboration_").
export function parseSyllabus(text){
  const rows=[];
  for(const line of String(text||'').split('\n')){
    const raw=line.trim();
    if(!raw)continue;
    const m=raw.match(/^(.*?)\s*(?:\||\t)\s*([0-9]+(?:[.,][0-9]+)?)\s*$/);
    if(!m)continue;
    const parts=parseItalic(m[1].trim());
    const title=parts.map(p=>p.text).join('').trim();
    const italic=parts.length>0&&parts.every(p=>p.italic);
    const hours=Number(m[2].replace(',','.'));
    if(title&&Number.isFinite(hours))rows.push({title,italic,parts,hours});
  }
  const total=Math.round(rows.reduce((a,r)=>a+r.hours,0)*100)/100;
  return {rows,total};
}

export function formatHours(n,lang='id'){
  const s=String(Math.round(Number(n||0)*100)/100);
  return lang==='en'?s:s.replace('.',',');
}

export const RECIPIENT_ROLES={
  speaker:{label:'Pemateri',id:'PEMATERI',en:'SPEAKER',topicId:'dengan materi',topicEn:'on the topic'},
  moderator:{label:'Moderator',id:'MODERATOR',en:'MODERATOR',topicId:'pada sesi',topicEn:'in the session'}
};

// '{NNN}/APTFI/PRESEPTOR/X/2026' + 7 -> '007/APTFI/PRESEPTOR/X/2026'. Akun TEST diberi awalan TEST-.
export function formatCertificateNo(format,serial,isTest=false){
  const f=String(format||CERTIFICATE_DEFAULTS.number_format);
  const n=Math.max(0,Number(serial)||0);
  let used=false;
  let out=f.replace(/\{(N+)\}/g,(_,ns)=>{used=true;return String(n).padStart(ns.length,'0')});
  if(!used)out=`${String(n).padStart(3,'0')}/${out}`;
  return isTest?`TEST-${out}`:out;
}

// mode: 'Offline' | 'Online' | null (tanpa keterangan, dipakai pemateri/moderator yang tidak diisi).
export function modeText(mode,config,lang='id'){
  const c=config||CERTIFICATE_DEFAULTS;
  if(lang==='en'){
    if(mode==='Offline')return `in ${c.location_text_en||CERTIFICATE_DEFAULTS.location_text_en}`;
    if(mode==='Online')return 'online via Zoom Meeting';
    return '';
  }
  if(mode==='Offline')return `secara luring di ${c.location_text}`;
  if(mode==='Online')return 'secara daring melalui Zoom Meeting';
  return '';
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
