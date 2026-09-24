import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { resolveEventState } from '../../../../lib/event-state';
import { overallStatus } from '../../../../lib/status';
import { logActivity } from '../../../../lib/audit';
import { sendEmail } from '../../../../lib/email';
import { createPasswordSetupToken } from '../../../../lib/password-tokens';
import { registrationEmail } from '../../../../lib/email-template';
import { verifyStoredUpload,removeUploadedPaths } from '../../../../lib/direct-upload';
import { enforceRequestLimit,requestIp } from '../../../../lib/request-rate-limit';

export const runtime='nodejs';

async function duplicateNow(db,eventId,data){
  for(const [value,column] of [[data.normalized_email,'normalized_email'],[data.normalized_whatsapp,'normalized_whatsapp'],[data.normalized_stra,'normalized_stra']]){
    if(!value)continue;const {data:found}=await db.from('registrations').select('id').eq('event_id',eventId).eq(column,value).limit(1).maybeSingle();if(found)return true;
  }return false;
}

export async function POST(request){
  const limit=await enforceRequestLimit({scope:'registration_finalize',identifier:requestIp(request),limit:30,windowSeconds:600});
  if(!limit.ok)return NextResponse.json({message:'Terlalu banyak percobaan. Silakan tunggu beberapa menit.'},{status:429});
  let body;try{body=await request.json()}catch{return NextResponse.json({message:'Sesi pendaftaran tidak valid.'},{status:400})}
  const db=getSupabaseAdmin();
  const {data:session,error:sErr}=await db.from('registration_upload_sessions').select('*').eq('id',String(body.sessionId||'')).maybeSingle();
  if(sErr||!session)return NextResponse.json({message:'Sesi pendaftaran tidak ditemukan. Silakan mulai kembali.'},{status:404});
  if(session.used_at)return NextResponse.json({message:'Sesi pendaftaran ini sudah digunakan.'},{status:409});
  if(new Date(session.expires_at).getTime()<Date.now()){await removeUploadedPaths(db,session.files);return NextResponse.json({message:'Sesi pendaftaran kedaluwarsa. Silakan kirim form kembali.'},{status:410})}
  const {data:event}=await db.from('events').select('*').eq('id',session.event_id).single();
  if(!event)return NextResponse.json({message:'Event tidak ditemukan.'},{status:404});
  const state=resolveEventState(event);if(!state.isOpen){await removeUploadedPaths(db,session.files);return NextResponse.json({message:state.message||'Pendaftaran sudah ditutup.'},{status:423})}
  const data=session.payload||{},files=session.files||{};
  if(await duplicateNow(db,event.id,data)){await removeUploadedPaths(db,files);await db.from('registration_upload_sessions').update({used_at:new Date().toISOString()}).eq('id',session.id);return NextResponse.json({message:'Data peserta yang sama sudah terdaftar. Silakan masuk ke Dashboard Peserta.',duplicate:true},{status:409})}
  for(const [key,label] of [['stra','Bukti STRA'],['experience','Bukti pengalaman'],['payment_proof','Bukti pembayaran']]){const err=await verifyStoredUpload(db,files[key],label);if(err){await removeUploadedPaths(db,files);return NextResponse.json({message:err},{status:422})}}
  const {data:codeData,error:codeError}=await db.rpc('next_preseptor_registration_code');
  if(codeError){await removeUploadedPaths(db,files);return NextResponse.json({message:'Gagal membuat nomor pendaftaran.'},{status:500})}
  const reg={id:session.registration_id,event_id:event.id,registration_code:codeData,...data,requirements_status:'pending',payment_status:'pending',overall_status:overallStatus('pending','pending'),amount_due:Number(event.registration_fee||1000000),legacy_source:null};
  const {data:created,error:insertError}=await db.from('registrations').insert(reg).select('*').single();
  if(insertError){await removeUploadedPaths(db,files);if(insertError.code==='23505')return NextResponse.json({message:'Data peserta yang sama sudah terdaftar. Silakan masuk ke Dashboard Peserta.',duplicate:true},{status:409});if(String(insertError.message||'').includes('quota_total_full'))return NextResponse.json({message:'Kuota Pelatihan Preseptor sudah penuh.'},{status:409});if(String(insertError.message||'').includes('quota_online_full'))return NextResponse.json({message:'Kuota Online sudah penuh.'},{status:409});if(String(insertError.message||'').includes('quota_offline_full'))return NextResponse.json({message:'Kuota Offline sudah penuh.'},{status:409});console.error('finalize insert:',insertError);return NextResponse.json({message:'Gagal menyimpan pendaftaran.'},{status:500})}
  try{
    const docs=Object.entries(files).map(([document_type,f])=>({registration_id:created.id,document_type,storage_path:f.path,original_name:f.name,mime_type:f.type,file_size:f.size,status:'pending'}));
    const {error}=await db.from('registration_documents').insert(docs);if(error)throw error;
  }catch(e){await db.from('registrations').delete().eq('id',created.id);await removeUploadedPaths(db,files);console.error('finalize docs:',e);return NextResponse.json({message:'Gagal menyimpan data dokumen.'},{status:500})}
  await db.from('registration_upload_sessions').update({used_at:new Date().toISOString()}).eq('id',session.id);
  await logActivity({registrationId:created.id,actorType:'participant',actorEmail:data.email,action:'registration_created'});
  let activationUrl='';try{const origin=new URL(request.url).origin;const link=await createPasswordSetupToken({email:data.email,audience:'participant',purpose:'activate',next:'/dashboard',origin});activationUrl=link.url}catch(e){console.error('activation link:',e)}
  const mail=await sendEmail({to:data.email,subject:`Pendaftaran berhasil - ${created.registration_code}`,html:registrationEmail({name:data.full_name,registrationCode:created.registration_code,activationUrl})});
  await db.from('email_logs').insert({registration_id:created.id,email_type:'registration',recipient:data.email,status:mail.ok?'sent':mail.skipped?'skipped':'failed',provider_id:mail.id||null,error_message:mail.error||null});
  return NextResponse.json({ok:true,registrationCode:created.registration_code,emailSent:!!mail.ok});
}
