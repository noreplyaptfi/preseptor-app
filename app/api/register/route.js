import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';
import { resolveEventState } from '../../../lib/event-state';
import { clean,validEmail,validStraNumber,validateProfessionalData,validateFile,safeFileName,allowedModes } from '../../../lib/validation';
import { normalizeEmail,normalizePhone,normalizeStra } from '../../../lib/normalization';
import { overallStatus } from '../../../lib/status';
import { logActivity } from '../../../lib/audit';
import { sendEmail } from '../../../lib/email';
import { createPasswordSetupToken } from '../../../lib/password-tokens';
import { registrationEmail } from '../../../lib/email-template';

export const runtime='nodejs';

async function findDuplicate(db,eventId,{normalizedEmail,normalizedWhatsapp,normalizedStra}){
  const checks=[
    ['email',normalizedEmail,'normalized_email'],
    ['whatsapp',normalizedWhatsapp,'normalized_whatsapp'],
    ['stra',normalizedStra,'normalized_stra']
  ];
  for(const [kind,value,column] of checks){
    if(!value) continue;
    const {data}=await db.from('registrations').select('id,email,registration_code').eq('event_id',eventId).eq(column,value).limit(1).maybeSingle();
    if(data) return {kind,registration:data};
  }
  return null;
}

export async function POST(request){
  const db=getSupabaseAdmin();
  const fd=await request.formData();
  if(clean(fd.get('website'))) return NextResponse.json({ok:true});

  const {data:event}=await db.from('events').select('*').eq('slug',process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026').single();
  if(!event) return NextResponse.json({message:'Event belum dikonfigurasi.'},{status:503});
  const state=resolveEventState(event);
  if(!state.isOpen) return NextResponse.json({message:state.status==='maintenance'?'Pendaftaran sedang dalam pemeliharaan.':state.message},{status:423});

  const data={
    full_name:clean(fd.get('full_name')),
    email:normalizeEmail(clean(fd.get('email'),190)),
    whatsapp:clean(fd.get('whatsapp'),50),
    stra_number:clean(fd.get('stra_number'),100),
    university:clean(fd.get('university')),
    attendance_mode:clean(fd.get('attendance_mode'),20),
    participant_type:clean(fd.get('participant_type'),40),
    practice_type:clean(fd.get('practice_type'),100),
    practice_name:clean(fd.get('practice_name')),
    practice_years:Number(fd.get('practice_years')||0),
    teaching_years:Number(fd.get('teaching_years')||0)
  };
  data.normalized_email=normalizeEmail(data.email);
  data.normalized_whatsapp=normalizePhone(data.whatsapp);
  data.normalized_stra=normalizeStra(data.stra_number);

  const errors=validateProfessionalData(data);
  if(data.full_name.length<3) errors.full_name='Nama wajib diisi.';
  if(!validEmail(data.email)) errors.email='Email tidak valid.';
  if(data.normalized_whatsapp.length<10) errors.whatsapp='Nomor WhatsApp tidak valid.';
  if(!validStraNumber(data.stra_number)) errors.stra_number='Nomor STRA wajib diisi dengan benar.';
  if(!data.university) errors.university='Homebase wajib diisi.';
  if(!allowedModes.includes(data.attendance_mode)) errors.attendance_mode='Pilih mode keikutsertaan.';
  if(fd.get('confirm_data')!=='1') errors.confirm_data='Pernyataan wajib disetujui.';

  const files={stra:fd.get('stra_proof'),experience:fd.get('experience_proof'),payment_proof:fd.get('payment_proof')};
  for(const [key,label] of [['stra','Bukti STRA'],['experience','Bukti pengalaman'],['payment_proof','Bukti pembayaran']]){
    const e=validateFile(files[key],label);if(e)errors[key]=e;
  }
  if(Object.keys(errors).length) return NextResponse.json({message:Object.values(errors)[0],errors},{status:422});

  const [{count:totalCount},{count:modeCount}]=await Promise.all([
    db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',event.id),
    db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',event.id).eq('attendance_mode',data.attendance_mode)
  ]);
  const totalQuota=Number(event.quota_total||200);
  const modeQuota=data.attendance_mode==='Offline'?Number(event.quota_offline||50):Number(event.quota_online||150);
  if(totalQuota>0&&Number(totalCount||0)>=totalQuota) return NextResponse.json({message:'Kuota Pelatihan Preseptor sudah penuh.'},{status:409});
  if(modeQuota>0&&Number(modeCount||0)>=modeQuota) return NextResponse.json({message:`Kuota ${data.attendance_mode} sudah penuh. Silakan pilih mode lain jika masih tersedia.`},{status:409});

  const duplicate=await findDuplicate(db,event.id,data);
  if(duplicate){
    const message=duplicate.kind==='email'
      ? 'Email ini sudah memiliki pendaftaran. Silakan masuk ke Dashboard Peserta untuk melanjutkan.'
      : 'Data peserta yang sama sudah terdaftar. Jangan membuat pendaftaran baru. Silakan masuk dengan akun yang sebelumnya digunakan atau hubungi panitia jika perlu mengganti email.';
    return NextResponse.json({message,duplicate:true,duplicateBy:duplicate.kind},{status:409});
  }

  const {data:codeData,error:codeError}=await db.rpc('next_preseptor_registration_code');
  if(codeError) return NextResponse.json({message:'Gagal membuat nomor pendaftaran.'},{status:500});

  const reg={
    event_id:event.id,
    registration_code:codeData,
    ...data,
    requirements_status:'pending',
    payment_status:'pending',
    overall_status:overallStatus('pending','pending'),
    amount_due:Number(event.registration_fee||1000000),
    legacy_source:null
  };
  const {data:created,error:insertError}=await db.from('registrations').insert(reg).select('*').single();
  if(insertError){
    if(insertError.code==='23505') return NextResponse.json({message:'Data peserta yang sama sudah terdaftar. Silakan masuk ke Dashboard Peserta atau hubungi panitia.',duplicate:true},{status:409});
    if(String(insertError.message||'').includes('quota_total_full')) return NextResponse.json({message:'Kuota Pelatihan Preseptor sudah penuh.'},{status:409});
    if(String(insertError.message||'').includes('quota_online_full')) return NextResponse.json({message:'Kuota Online sudah penuh.'},{status:409});
    if(String(insertError.message||'').includes('quota_offline_full')) return NextResponse.json({message:'Kuota Offline sudah penuh.'},{status:409});
    console.error('registration insert:',insertError);
    return NextResponse.json({message:'Gagal menyimpan pendaftaran.'},{status:500});
  }

  const uploaded=[];
  try{
    for(const [type,file] of Object.entries(files)){
      const path=`${created.id}/${type}/${Date.now()}-${safeFileName(file.name)}`;
      const buffer=Buffer.from(await file.arrayBuffer());
      const {error}=await db.storage.from('preseptor-private').upload(path,buffer,{contentType:file.type,upsert:false});
      if(error) throw error;
      uploaded.push(path);
      await db.from('registration_documents').insert({registration_id:created.id,document_type:type,storage_path:path,original_name:file.name,mime_type:file.type,file_size:file.size,status:'pending'});
    }
  }catch(e){
    for(const path of uploaded) await db.storage.from('preseptor-private').remove([path]);
    await db.from('registrations').delete().eq('id',created.id);
    console.error('registration files:',e);
    return NextResponse.json({message:'Gagal menyimpan dokumen. Silakan coba kembali.'},{status:500});
  }

  await logActivity({registrationId:created.id,actorType:'participant',actorEmail:data.email,action:'registration_created'});
  let activationUrl='';
  try{
    const origin=new URL(request.url).origin;
    const link=await createPasswordSetupToken({email:data.email,audience:'participant',purpose:'activate',next:'/dashboard',origin});
    activationUrl=link.url;
  }catch(linkError){console.error('registration activation link:',linkError)}
  const mail=await sendEmail({to:data.email,subject:`Pendaftaran berhasil - ${created.registration_code}`,html:registrationEmail({name:data.full_name,registrationCode:created.registration_code,activationUrl})});
  await db.from('email_logs').insert({registration_id:created.id,email_type:'registration',recipient:data.email,status:mail.ok?'sent':mail.skipped?'skipped':'failed',provider_id:mail.id||null,error_message:mail.error||null});
  return NextResponse.json({ok:true,registrationCode:created.registration_code,emailSent:!!mail.ok});
}
