import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { resolveEventState } from '../../../../lib/event-state';
import { clean,validEmail,validStraNumber,validateProfessionalData,allowedModes } from '../../../../lib/validation';
import { normalizeEmail,normalizePhone,normalizeStra } from '../../../../lib/normalization';
import { enforceRequestLimit,requestIp } from '../../../../lib/request-rate-limit';
import { validateFileDescriptor,createSignedUpload } from '../../../../lib/direct-upload';

export const runtime='nodejs';

async function findDuplicate(db,eventId,{normalized_email,normalized_whatsapp,normalized_stra}){
  for(const [kind,value,column] of [['email',normalized_email,'normalized_email'],['whatsapp',normalized_whatsapp,'normalized_whatsapp'],['stra',normalized_stra,'normalized_stra']]){
    if(!value)continue;
    const {data}=await db.from('registrations').select('id,email,registration_code').eq('event_id',eventId).eq(column,value).limit(1).maybeSingle();
    if(data)return {kind,registration:data};
  }
  return null;
}

export async function POST(request){
  const limit=await enforceRequestLimit({scope:'registration_prepare',identifier:requestIp(request),limit:30,windowSeconds:600});
  if(!limit.ok)return NextResponse.json({message:'Terlalu banyak percobaan. Silakan tunggu beberapa menit.'},{status:429,headers:{'Retry-After':String(limit.retryAfter)}});
  let body;try{body=await request.json()}catch{return NextResponse.json({message:'Data pendaftaran tidak valid.'},{status:400})}
  if(clean(body.website))return NextResponse.json({ok:true});
  const db=getSupabaseAdmin();
  const {data:event}=await db.from('events').select('*').eq('slug',process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026').single();
  if(!event)return NextResponse.json({message:'Event belum dikonfigurasi.'},{status:503});
  const state=resolveEventState(event);
  if(!state.isOpen)return NextResponse.json({message:state.status==='maintenance'?'Pendaftaran sedang dalam pemeliharaan.':state.message},{status:423});

  const data={
    full_name:clean(body.full_name),email:normalizeEmail(clean(body.email,190)),whatsapp:clean(body.whatsapp,50),stra_number:clean(body.stra_number,100),university:clean(body.university),attendance_mode:clean(body.attendance_mode,20),participant_type:clean(body.participant_type,40),practice_type:clean(body.practice_type,100),practice_name:clean(body.practice_name),practice_years:Number(body.practice_years||0),teaching_years:Number(body.teaching_years||0)
  };
  data.normalized_email=normalizeEmail(data.email);data.normalized_whatsapp=normalizePhone(data.whatsapp);data.normalized_stra=normalizeStra(data.stra_number);
  const errors=validateProfessionalData(data);
  if(data.full_name.length<3)errors.full_name='Nama wajib diisi.';
  if(!validEmail(data.email))errors.email='Email tidak valid.';
  if(data.normalized_whatsapp.length<10)errors.whatsapp='Nomor WhatsApp tidak valid.';
  if(!validStraNumber(data.stra_number))errors.stra_number='Nomor STRA wajib diisi dengan benar.';
  if(!data.university)errors.university='Homebase wajib diisi.';
  if(!allowedModes.includes(data.attendance_mode))errors.attendance_mode='Pilih mode keikutsertaan.';
  if(body.confirm_data!=='1')errors.confirm_data='Pernyataan wajib disetujui.';
  const files=body.files||{};
  for(const [key,label] of [['stra','Bukti STRA'],['experience','Bukti pengalaman'],['payment_proof','Bukti pembayaran']]){const e=validateFileDescriptor(files[key],label);if(e)errors[key]=e}
  if(Object.keys(errors).length)return NextResponse.json({message:Object.values(errors)[0],errors},{status:422});

  const [{count:totalCount},{count:modeCount}]=await Promise.all([
    db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',event.id),
    db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',event.id).eq('attendance_mode',data.attendance_mode)
  ]);
  const totalQuota=Number(event.quota_total||200),modeQuota=data.attendance_mode==='Offline'?Number(event.quota_offline||50):Number(event.quota_online||150);
  if(totalQuota>0&&Number(totalCount||0)>=totalQuota)return NextResponse.json({message:'Kuota Pelatihan Preseptor sudah penuh.'},{status:409});
  if(modeQuota>0&&Number(modeCount||0)>=modeQuota)return NextResponse.json({message:`Kuota ${data.attendance_mode} sudah penuh. Silakan pilih mode lain jika masih tersedia.`},{status:409});
  const duplicate=await findDuplicate(db,event.id,data);
  if(duplicate){const message=duplicate.kind==='email'?'Email ini sudah memiliki pendaftaran. Silakan masuk ke Dashboard Peserta untuk melanjutkan.':'Data peserta yang sama sudah terdaftar. Jangan membuat pendaftaran baru. Silakan masuk dengan akun yang sebelumnya digunakan atau hubungi panitia jika perlu mengganti email.';return NextResponse.json({message,duplicate:true,duplicateBy:duplicate.kind},{status:409})}

  const registrationId=crypto.randomUUID();
  let uploads;
  try{uploads=await createSignedUpload(db,{registrationId,files})}catch(e){console.error('prepare upload:',e);return NextResponse.json({message:'Gagal menyiapkan unggahan dokumen. Silakan coba kembali.'},{status:500})}
  const sessionId=crypto.randomUUID();
  const expiresAt=new Date(Date.now()+2*60*60*1000).toISOString();
  const {error}=await db.from('registration_upload_sessions').insert({id:sessionId,registration_id:registrationId,event_id:event.id,payload:data,files:uploads,expires_at:expiresAt});
  if(error){console.error('prepare session:',error);return NextResponse.json({message:'Gagal menyiapkan sesi pendaftaran.'},{status:500})}
  return NextResponse.json({ok:true,sessionId,uploads:Object.fromEntries(Object.entries(uploads).map(([k,v])=>[k,{path:v.path,token:v.token}]))});
}
