import { certificateChecklist,certificateStatus,certificateConfig,formatCertificateNo,STATUS_LABEL } from './certificate';
import { buildCertificatePdf,certificateFilename } from './certificate-pdf';
import { displayName } from './profile';

// v0.8.0 — Akses data sertifikat (server). Dipakai API admin, API peserta, dan halaman verifikasi.

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
    number:formatCertificateNo(config.number_format,cert.serial,cert.is_test),
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
    certificateNo:formatCertificateNo(config.number_format,cert.serial,test),
    mode:reg.attendance_mode,
    config,
    verifyUrl:verifyUrlFor(request,cert.verify_code),
    verifyCode:cert.verify_code,
    watermark:test?'test':null
  });
  return {bytes,cert,filename:certificateFilename(reg.registration_code,test)};
}

export function pdfResponse(bytes,filename){
  return new Response(Buffer.from(bytes),{status:200,headers:{
    'Content-Type':'application/pdf',
    'Content-Disposition':`attachment; filename="${filename}"`,
    'Cache-Control':'private, no-store'
  }});
}
