import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { normalizeEmail,normalizePhone } from '../../../../lib/normalization';
import { validEmail } from '../../../../lib/validation';
import { cleanText } from '../../../../lib/profile';
import { ACTIVE_REGISTRATION_STATUSES } from '../../../../lib/registration-lifecycle';
import { sendEmail } from '../../../../lib/email';
import { htmlEscape } from '../../../../lib/self-service';
import { logActivity } from '../../../../lib/audit';

export const dynamic='force-dynamic';
export const runtime='nodejs';

async function context(request){
  const auth=await requireAdmin(request,['super_admin','event_admin']);
  if(auth.error)return {response:NextResponse.json({message:auth.error},{status:auth.status})};
  const db=getSupabaseAdmin();
  const {data:event,error}=await db.from('events').select('id,slug,quota_total,quota_online,quota_offline').eq('slug',process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026').single();
  if(error||!event)return {response:NextResponse.json({message:'Event tidak ditemukan.'},{status:404})};
  return {auth,db,event};
}

function jakartaDateCode(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get=t=>parts.find(x=>x.type===t)?.value||'';
  return `${get('year')}${get('month')}${get('day')}`;
}

function suffix(length=6){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes=new Uint8Array(length);crypto.getRandomValues(bytes);
  return Array.from(bytes,b=>chars[b%chars.length]).join('');
}

async function registrationCode(db){
  const date=jakartaDateCode();
  for(let i=0;i<20;i++){
    const code=`APT-PRS-${date}-${suffix(6)}`;
    const {data}=await db.from('registrations').select('id').eq('registration_code',code).limit(1).maybeSingle();
    if(!data)return code;
  }
  throw new Error('Gagal membuat nomor pendaftaran unik.');
}

function onboardingHtml({name,email,code,mode}){
  const site=String(process.env.NEXT_PUBLIC_SITE_URL||'https://preseptor.aptfi.or.id').replace(/\/$/,'');
  const login=`${site}/login`;
  return `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#17204f;max-width:640px;margin:auto">
    <h2 style="margin-bottom:8px">Akun Peserta Pelatihan Preseptor APTFI</h2>
    <p>Yth. ${htmlEscape(name)},</p>
    <p>Panitia telah mendaftarkan Anda sebagai peserta khusus Pelatihan Preseptor APTFI dengan mode <strong>${htmlEscape(mode)}</strong>.</p>
    <div style="background:#f4f7ff;border:1px solid #d9e2ff;border-radius:12px;padding:14px 16px;margin:18px 0">
      <div><strong>Nomor pendaftaran:</strong> ${htmlEscape(code)}</div>
      <div><strong>Email akun:</strong> ${htmlEscape(email)}</div>
    </div>
    <p>Untuk keamanan, buka halaman login lalu pilih <strong>Lupa Password</strong> untuk membuat password Anda. Setelah itu login dan lengkapi Profil Saya, STRA, bukti pengalaman, dan bukti pembayaran.</p>
    <p style="margin:24px 0"><a href="${login}" style="background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 18px;border-radius:9px;display:inline-block;font-weight:700">Buka Halaman Login</a></p>
    <p>Alamat login: <a href="${login}">${login}</a>.</p>
    <p>Panitia Pelatihan Preseptor APTFI</p>
  </div>`;
}

async function sendOnboarding(db,reg){
  const result=await sendEmail({to:reg.email,subject:'Akun peserta Pelatihan Preseptor APTFI',html:onboardingHtml({name:reg.full_name,email:reg.email,code:reg.registration_code,mode:reg.attendance_mode})});
  await db.from('email_logs').insert({registration_id:reg.id,email_type:'special_participant_onboarding',recipient:reg.email,status:result.ok?'sent':result.skipped?'skipped':'failed',provider_id:result.id||null,error_message:result.error||null});
  return result;
}

export async function GET(request){
  const c=await context(request);if(c.response)return c.response;
  const {data,error}=await c.db.from('registrations').select('id,registration_code,full_name,email,whatsapp,university,attendance_mode,requirements_status,payment_status,lifecycle_status,created_at,special_enrollment_at,special_enrollment_by').eq('event_id',c.event.id).eq('enrollment_source','admin_special').order('created_at',{ascending:false});
  if(error){console.error('special participant list:',error);return NextResponse.json({message:'Gagal membaca peserta khusus. Pastikan migration v0.4.17 sudah dijalankan.'},{status:500})}
  return NextResponse.json({participants:data||[]},{headers:{'Cache-Control':'private, no-store'}});
}

export async function POST(request){
  const c=await context(request);if(c.response)return c.response;
  const body=await request.json().catch(()=>({}));
  if(body.action==='resend'){
    const id=cleanText(body.registration_id,80);
    const {data:reg}=await c.db.from('registrations').select('id,registration_code,full_name,email,attendance_mode,enrollment_source').eq('id',id).eq('event_id',c.event.id).maybeSingle();
    if(!reg||reg.enrollment_source!=='admin_special')return NextResponse.json({message:'Peserta khusus tidak ditemukan.'},{status:404});
    const email=await sendOnboarding(c.db,reg);
    await logActivity({registrationId:reg.id,actorType:'admin',actorEmail:c.auth.user.email,action:'special_participant_onboarding_resent'});
    return NextResponse.json({ok:true,emailSent:!!email.ok,warning:email.ok?null:'Data tetap aman, tetapi email belum berhasil dikirim.'});
  }

  const raw=Array.isArray(body.participants)?body.participants:body.participant?[body.participant]:[];
  if(!raw.length)return NextResponse.json({message:'Tidak ada data peserta untuk diproses.'},{status:422});
  if(raw.length>100)return NextResponse.json({message:'Maksimal 100 peserta dalam satu import.'},{status:422});

  const [{data:existing},{count:activeTotal},{count:activeOnline},{count:activeOffline}]=await Promise.all([
    c.db.from('registrations').select('id,registration_code,normalized_email,normalized_whatsapp,email,whatsapp,lifecycle_status').eq('event_id',c.event.id),
    c.db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',c.event.id).in('lifecycle_status',ACTIVE_REGISTRATION_STATUSES),
    c.db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',c.event.id).in('lifecycle_status',ACTIVE_REGISTRATION_STATUSES).eq('attendance_mode','Online'),
    c.db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',c.event.id).in('lifecycle_status',ACTIVE_REGISTRATION_STATUSES).eq('attendance_mode','Offline')
  ]);

  const emailMap=new Map((existing||[]).filter(x=>x.normalized_email).map(x=>[x.normalized_email,x]));
  const phoneMap=new Map((existing||[]).filter(x=>x.normalized_whatsapp).map(x=>[x.normalized_whatsapp,x]));
  const batchEmails=new Set(),batchPhones=new Set();
  let total=Number(activeTotal||0),online=Number(activeOnline||0),offline=Number(activeOffline||0);
  const quotaTotal=Number(c.event.quota_total||0),quotaOnline=Number(c.event.quota_online||0),quotaOffline=Number(c.event.quota_offline||0);
  const results=[];
  const authList=await c.db.auth.admin.listUsers({page:1,perPage:1000});
  const authByEmail=new Map((authList.data?.users||[]).filter(u=>u.email).map(u=>[String(u.email).toLowerCase(),u]));

  for(let index=0;index<raw.length;index++){
    const item=raw[index]||{};
    const name=cleanText(item.full_name||item.name,255);
    const email=normalizeEmail(cleanText(item.email,190));
    const whatsapp=cleanText(item.whatsapp,60);
    const normalizedWhatsapp=normalizePhone(whatsapp);
    const university='';
    const mode=cleanText(item.attendance_mode||item.mode,20);
    const base={row:index+1,name,email,whatsapp,university,mode};
    let error='';
    if(name.length<3)error='Nama peserta wajib diisi.';
    else if(!validEmail(email))error='Email tidak valid.';
    else if(normalizedWhatsapp.length<10)error='Nomor WhatsApp tidak valid.';
    else if(!['Online','Offline'].includes(mode))error='Mode harus Online atau Offline.';
    else if(emailMap.has(email))error=`Email sudah terdaftar (${emailMap.get(email).registration_code||'record lama'}).`;
    else if(phoneMap.has(normalizedWhatsapp))error=`WhatsApp sudah terdaftar (${phoneMap.get(normalizedWhatsapp).registration_code||'record lama'}).`;
    else if(batchEmails.has(email))error='Email duplikat di dalam data import.';
    else if(batchPhones.has(normalizedWhatsapp))error='WhatsApp duplikat di dalam data import.';
    else if(quotaTotal>0&&total>=quotaTotal)error='Kuota total sudah penuh.';
    else if(mode==='Online'&&quotaOnline>0&&online>=quotaOnline)error='Kuota Online sudah penuh.';
    else if(mode==='Offline'&&quotaOffline>0&&offline>=quotaOffline)error='Kuota Offline sudah penuh.';
    if(error){results.push({...base,ok:false,message:error});continue}

    batchEmails.add(email);batchPhones.add(normalizedWhatsapp);
    let createdAuthUser=null;
    try{
      let authUser=authByEmail.get(email);
      if(!authUser){
        const password=`${crypto.randomUUID()}${crypto.randomUUID()}`;
        const created=await c.db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name,account_type:'participant'}});
        if(created.error)throw new Error(`Akun login gagal dibuat: ${created.error.message}`);
        authUser=created.data?.user;createdAuthUser=authUser;if(authUser)authByEmail.set(email,authUser);
      }
      const id=crypto.randomUUID(),code=await registrationCode(c.db),now=new Date().toISOString();
      const row={id,event_id:c.event.id,registration_code:code,full_name:name,name_core:name,title_prefix:'',title_suffix:'',email,normalized_email:email,whatsapp,normalized_whatsapp:normalizedWhatsapp,university,attendance_mode:mode,participant_type:null,practice_type:null,practice_name:null,practice_years:0,teaching_years:0,stra_number:null,normalized_stra:null,requirements_status:'incomplete',payment_status:'pending',overall_status:'pending',lifecycle_status:'active',enrollment_source:'admin_special',special_enrollment_at:now,special_enrollment_by:c.auth.user.email,created_at:now,updated_at:now};
      const inserted=await c.db.from('registrations').insert(row).select('id,registration_code,full_name,email,attendance_mode').single();
      if(inserted.error){if(createdAuthUser?.id)await c.db.auth.admin.deleteUser(createdAuthUser.id).catch(()=>{});throw new Error(`Pendaftaran gagal dibuat: ${inserted.error.message}`)}
      const reg=inserted.data;const emailResult=await sendOnboarding(c.db,reg);
      await logActivity({registrationId:reg.id,actorType:'admin',actorEmail:c.auth.user.email,action:'special_participant_created'});
      total++;if(mode==='Online')online++;else offline++;
      emailMap.set(email,{...reg,normalized_email:email});phoneMap.set(normalizedWhatsapp,{...reg,normalized_whatsapp:normalizedWhatsapp});
      results.push({...base,ok:true,registration_code:reg.registration_code,emailSent:!!emailResult.ok,warning:emailResult.ok?null:'Akun dan pendaftaran berhasil dibuat, tetapi email petunjuk belum terkirim.'});
    }catch(e){console.error('special participant import row',index+1,e);results.push({...base,ok:false,message:e.message||'Gagal membuat peserta.'})}
  }

  const created=results.filter(x=>x.ok).length,failed=results.length-created;
  return NextResponse.json({ok:created>0,created,failed,results,counts:{active_total:total,active_online:online,active_offline:offline}},{status:created?200:422});
}
