import { certificateChecklist,certificateStatus,certificateConfig,certificateNumber,STATUS_LABEL,RECIPIENT_ROLES } from './certificate';
import { buildCertificatePdf,certificateFilename,recipientFilename } from './certificate-pdf';
import { displayName } from './profile';
import { ASSET_BUCKET } from './event-assets';

// v0.8.0 — Akses data sertifikat (server). Dipakai API admin, API peserta, dan halaman verifikasi.
// v0.8.6 — + nomor awal, tanda tangan & cap dari storage privat, pemateri & moderator, siapkan nomor sekaligus.

const PAGE=1000;
const REG_FIELDS='id,event_id,registration_code,full_name,name_core,title_prefix,title_suffix,email,university,attendance_mode,lifecycle_status,requirements_status,payment_status,is_test_account';

export async function fetchAll(makeQuery){
  const out=[];
  for(let from=0;;from+=PAGE){
    const {data,error}=await makeQuery().range(from,from+PAGE-1);
    if(error)throw new Error(error.message||'Gagal memuat data.');
    out.push(...(data||[]));
    if(!data||data.length<PAGE)break;
  }
  return out;
}

export function siteUrl(request){
  const env=String(process.env.NEXT_PUBLIC_SITE_URL||'').replace(/\/$/,'');
  if(env)return env;
  try{return new URL(request.url).origin}catch{return 'https://preseptor.aptfi.or.id'}
}

export function verifyUrlFor(request,code){return `${siteUrl(request)}/verifikasi/${encodeURIComponent(code)}`}

export function isTestReg(reg){return !!reg?.is_test_account||reg?.lifecycle_status==='test'}

export async function certificateEvent(db,eventId=null){
  let q=db.from('events').select('id,slug,title,certificate_enabled,certificate_config');
  q=eventId?q.eq('id',eventId):q.eq('slug',process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026');
  const {data,error}=await q.maybeSingle();
  if(error)throw new Error('Migration 020 (sertifikat) belum dijalankan.');
  return data||null;
}

export async function registrationByEmail(db,email){
  const {data}=await db.from('registrations').select(REG_FIELDS).ilike('email',email).order('created_at',{ascending:false}).limit(1).maybeSingle();
  return data||null;
}

export async function registrationById(db,id){
  const {data}=await db.from('registrations').select(REG_FIELDS).eq('id',id).maybeSingle();
  return data||null;
}

async function baseContext(db,eventId){
  const [{data:days},{data:modules}]=await Promise.all([
    db.from('event_days').select('id,day_number,title,event_date').eq('event_id',eventId).order('day_number'),
    db.from('assessment_modules').select('id,kind,pass_percent').eq('event_id',eventId)
  ]);
  const byKind=Object.fromEntries((modules||[]).map(m=>[m.kind,m]));
  return {
    days:days||[],
    modules:{pretest:byKind.pretest||null,evaluation:byKind.evaluation||null,posttest:byKind.posttest||null}
  };
}

function groupAttempts(rows){
  const out={};
  for(const a of rows||[]){(out[a.assessment_id]||=[]).push(a)}
  return out;
}

export function publicCertificate(cert,config,request){
  if(!cert)return null;
  return {
    number:certificateNumber(config,cert.serial,cert.is_test),
    issued_at:cert.issued_at,
    issued_via:cert.issued_via,
    override_reason:cert.override_reason||null,
    revoked_at:cert.revoked_at||null,
    revoke_reason:cert.revoke_reason||null,
    download_count:cert.download_count||0,
    last_downloaded_at:cert.last_downloaded_at||null,
    verify_code:cert.verify_code,
    verify_url:request?verifyUrlFor(request,cert.verify_code):null
  };
}

// Status satu peserta (untuk dashboard peserta & unduhan).
export async function participantCertificate(db,reg,event){
  const ctx=await baseContext(db,reg.event_id);
  const moduleIds=Object.values(ctx.modules).filter(Boolean).map(m=>m.id);
  const [{data:records},attemptRes,{data:cert}]=await Promise.all([
    db.from('attendance_records').select('event_day_id').eq('registration_id',reg.id),
    moduleIds.length
      ?db.from('assessment_attempts').select('assessment_id,score,max_score').eq('registration_id',reg.id).eq('status','submitted').in('assessment_id',moduleIds)
      :Promise.resolve({data:[]}),
    db.from('certificates').select('*').eq('registration_id',reg.id).maybeSingle()
  ]);
  const checklist=certificateChecklist({
    reg,days:ctx.days,
    checkedDayIds:new Set((records||[]).map(r=>r.event_day_id)),
    modules:ctx.modules,
    attempts:groupAttempts(attemptRes?.data)
  });
  const status=certificateStatus({checklist,released:!!event?.certificate_enabled,cert});
  return {checklist,status,statusLabel:STATUS_LABEL[status],cert:cert||null,config:certificateConfig(event?.certificate_config)};
}

// Status semua peserta (untuk admin). Peserta ditolak/mundur tetap ditampilkan agar bisa dilacak.
export async function allCertificates(db,event){
  const ctx=await baseContext(db,event.id);
  const dayIds=ctx.days.map(d=>d.id);
  const moduleIds=Object.values(ctx.modules).filter(Boolean).map(m=>m.id);
  const [regs,records,attempts,certs]=await Promise.all([
    fetchAll(()=>db.from('registrations').select(REG_FIELDS).eq('event_id',event.id).order('full_name').order('id')),
    dayIds.length?fetchAll(()=>db.from('attendance_records').select('registration_id,event_day_id').in('event_day_id',dayIds).order('id')):Promise.resolve([]),
    moduleIds.length?fetchAll(()=>db.from('assessment_attempts').select('registration_id,assessment_id,score,max_score').eq('status','submitted').in('assessment_id',moduleIds).order('id')):Promise.resolve([]),
    fetchAll(()=>db.from('certificates').select('*').eq('event_id',event.id).order('id'))
  ]);
  const checked=new Map(),tries=new Map(),certBy=new Map(certs.map(c=>[c.registration_id,c]));
  for(const r of records){if(!checked.has(r.registration_id))checked.set(r.registration_id,new Set());checked.get(r.registration_id).add(r.event_day_id)}
  for(const a of attempts){if(!tries.has(a.registration_id))tries.set(a.registration_id,[]);tries.get(a.registration_id).push(a)}
  const config=certificateConfig(event.certificate_config);
  return {config,days:ctx.days,modules:ctx.modules,rows:regs.map(reg=>{
    const checklist=certificateChecklist({reg,days:ctx.days,checkedDayIds:checked.get(reg.id)||new Set(),modules:ctx.modules,attempts:groupAttempts(tries.get(reg.id))});
    const cert=certBy.get(reg.id)||null;
    const status=certificateStatus({checklist,released:!!event.certificate_enabled,cert});
    return {reg,checklist,status,cert};
  })};
}

// Gambar tanda tangan & cap (PNG) dari bucket privat. Path berubah setiap unggah ulang, jadi cache per path aman.
const signatureCache=new Map();
export async function loadSignature(db,config){
  const p=config?.signature_path;
  if(!p)return null;
  if(!signatureCache.has(p)){
    signatureCache.set(p,(async()=>{
      const {data,error}=await db.storage.from(ASSET_BUCKET).download(p);
      if(error||!data)throw new Error(error?.message||'file tidak ditemukan');
      return new Uint8Array(await data.arrayBuffer());
    })().catch(e=>{signatureCache.delete(p);console.error('certificate signature:',e.message);return null}));
  }
  return signatureCache.get(p);
}

// Menerbitkan (bila belum) lalu membuat PDF.
export async function issueAndRender(db,{reg,event,request,via='auto',reason=null,actor=null,countDownload=false}){
  const test=isTestReg(reg);
  const {data,error}=await db.rpc('ensure_preseptor_certificate',{p_registration_id:reg.id,p_is_test:test,p_via:via,p_reason:reason,p_actor:actor});
  if(error)throw new Error('Sertifikat gagal diterbitkan. Pastikan migration 020 sudah dijalankan.');
  let cert=Array.isArray(data)?data[0]:data;
  if(!cert)throw new Error('Sertifikat gagal diterbitkan.');
  const name=displayName(reg)||reg.full_name||'Peserta';
  const now=new Date().toISOString();
  const patch={name_on_certificate:name,updated_at:now};
  if(countDownload){patch.download_count=Number(cert.download_count||0)+1;patch.last_downloaded_at=now}
  const upd=await db.from('certificates').update(patch).eq('id',cert.id).select('*').maybeSingle();
  if(upd?.data)cert=upd.data;
  const config=certificateConfig(event?.certificate_config);
  const bytes=await buildCertificatePdf({
    name,
    certificateNo:certificateNumber(config,cert.serial,test),
    mode:reg.attendance_mode,
    config,
    verifyUrl:verifyUrlFor(request,cert.verify_code),
    verifyCode:cert.verify_code,
    watermark:test?'test':null,
    signature:await loadSignature(db,config)
  });
  return {bytes,cert,filename:certificateFilename(reg.registration_code,test)};
}

// ---------- Pemateri & moderator (v0.8.6) ----------
const ROLE_ORDER={speaker:0,moderator:1};
export function sortRecipients(list){
  return [...(list||[])].sort((a,b)=>(ROLE_ORDER[a.role]??9)-(ROLE_ORDER[b.role]??9)||Number(a.position||0)-Number(b.position||0)||String(a.created_at||'').localeCompare(String(b.created_at||'')));
}

export async function listRecipients(db,eventId){
  const {data,error}=await db.from('certificate_recipients').select('*').eq('event_id',eventId);
  if(error)throw new Error('Migration 024 (pemateri & moderator) belum dijalankan.');
  return sortRecipients(data);
}

export async function recipientById(db,eventId,id){
  if(!id)return null;
  const {data}=await db.from('certificate_recipients').select('*').eq('id',String(id)).maybeSingle();
  return data&&data.event_id===eventId?data:null;
}

export async function recipientCertificates(db,eventId){
  const {data,error}=await db.from('certificates').select('*').eq('event_id',eventId).not('recipient_id','is',null);
  if(error)throw new Error('Migration 024 (pemateri & moderator) belum dijalankan.');
  return new Map((data||[]).map(c=>[c.recipient_id,c]));
}

export async function issueRecipientAndRender(db,{recipient,event,request,actor=null,countDownload=true}){
  const {data,error}=await db.rpc('ensure_recipient_certificate',{p_recipient_id:recipient.id,p_actor:actor});
  if(error)throw new Error('Sertifikat gagal diterbitkan. Pastikan migration 024 sudah dijalankan.');
  let cert=Array.isArray(data)?data[0]:data;
  if(!cert)throw new Error('Sertifikat gagal diterbitkan.');
  if(cert.revoked_at)throw new Error('Sertifikat ini sudah dicabut. Pulihkan terlebih dahulu.');
  const now=new Date().toISOString();
  const patch={name_on_certificate:recipient.name,updated_at:now};
  if(countDownload){patch.download_count=Number(cert.download_count||0)+1;patch.last_downloaded_at=now}
  const upd=await db.from('certificates').update(patch).eq('id',cert.id).select('*').maybeSingle();
  if(upd?.data)cert=upd.data;
  const config=certificateConfig(event?.certificate_config);
  const bytes=await buildCertificatePdf({
    name:recipient.name,
    certificateNo:certificateNumber(config,cert.serial,false),
    mode:recipient.attendance_mode||null,
    config,
    verifyUrl:verifyUrlFor(request,cert.verify_code),
    verifyCode:cert.verify_code,
    kind:recipient.role,
    lang:recipient.language==='en'?'en':'id',
    topic:recipient.topic||null,
    signature:await loadSignature(db,config)
  });
  return {bytes,cert,filename:recipientFilename(recipient.role,recipient.name)};
}

// Kunci urut abjad: nama tanpa gelar depan (apt., Dr., Prof., dll.).
const TITLE_PREFIX=/^\s*((?:prof|dr|drs|dra|apt|ir|h|hj|assoc|ns)(?:\.|,|\s)[\s.,]*)+/i;
export function nameSortKey(reg){
  const base=String(reg?.name_core||reg?.full_name||'').replace(TITLE_PREFIX,'').trim();
  return (base||String(reg?.full_name||'')).toLocaleLowerCase('id');
}

// Siapkan nomor sekaligus: pemateri → moderator → peserta resmi (abjad).
// Peserta yang diberi nomor: sudah memenuhi syarat atau sudah terbit manual (bukan akun TEST, bukan ditolak/mundur).
// renumber=true menyusun ulang semua nomor resmi dari nomor awal (hanya boleh sebelum rilis).
export async function assignNumbers(db,event,{renumber=false,actor=null}={}){
  const recipients=await listRecipients(db,event.id);
  const all=await allCertificates(db,event);
  const participants=all.rows
    .filter(r=>!isTestReg(r.reg)&&['active','withdrawal_requested'].includes(String(r.reg.lifecycle_status||'active')))
    .filter(r=>['ready','waiting_release'].includes(r.status))
    .sort((a,b)=>nameSortKey(a.reg).localeCompare(nameSortKey(b.reg),'id')||String(a.reg.registration_code).localeCompare(String(b.reg.registration_code)));
  const {data,error}=await db.rpc('assign_certificate_numbers',{
    p_event_id:event.id,
    p_recipient_ids:recipients.map(r=>r.id),
    p_registration_ids:participants.map(r=>r.reg.id),
    p_renumber:!!renumber,
    p_actor:actor
  });
  if(error){console.error('assign numbers:',error);throw new Error('Nomor gagal disiapkan. Pastikan migration 024 sudah dijalankan.')}
  return {changed:Number(data||0),recipients:recipients.length,participants:participants.length};
}

export function recipientView(r,cert,config,request){
  return {
    id:r.id,role:r.role,roleLabel:RECIPIENT_ROLES[r.role]?.label||r.role,name:r.name,language:r.language,topic:r.topic||'',
    attendance_mode:r.attendance_mode||'',position:r.position,certificate:publicCertificate(cert,config,request)
  };
}

export function pdfResponse(bytes,filename){
  return new Response(Buffer.from(bytes),{status:200,headers:{
    'Content-Type':'application/pdf',
    'Content-Disposition':`attachment; filename="${filename}"`,
    'Cache-Control':'private, no-store'
  }});
}
