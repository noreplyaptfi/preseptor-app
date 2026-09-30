import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { normalizePhone,normalizeStra } from '../../../../lib/normalization';
import { validStraNumber } from '../../../../lib/validation';
import { masterOptions,validateProfessionalWithMaster } from '../../../../lib/master-data';
import { cleanText,displayName,maskAccount } from '../../../../lib/profile';
import { overallStatus } from '../../../../lib/status';
import { logActivity } from '../../../../lib/audit';
export const dynamic='force-dynamic';

async function registrationFor(db,email){return (await db.from('registrations').select('*').ilike('email',email).order('created_at',{ascending:false}).limit(1).maybeSingle()).data}

export async function GET(request){
  const auth=await requireUser(request);if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin(),reg=await registrationFor(db,auth.user.email);if(!reg)return NextResponse.json({message:'Pendaftaran tidak ditemukan.'},{status:404});
  let options={};try{options=await masterOptions(db,reg.event_id,{activeOnly:false})}catch{}
  const {data:requests}=await db.from('self_service_requests').select('*').eq('registration_id',reg.id).order('created_at',{ascending:false});
  const {data:refund}=await db.from('refund_requests').select('id,status,requested_amount,approved_amount,bank_name,account_number,account_holder,reason,admin_note,transfer_reference,requested_at,reviewed_at,processed_at,batch_id').eq('registration_id',reg.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
  const safeRefund=refund?{...refund,account_number_masked:maskAccount(refund.account_number),account_number:undefined}:null;
  return NextResponse.json({registration:reg,requests:requests||[],refund:safeRefund,options},{headers:{'Cache-Control':'private, no-store'}});
}

export async function PATCH(request){
  const auth=await requireUser(request);if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin(),reg=await registrationFor(db,auth.user.email);if(!reg)return NextResponse.json({message:'Pendaftaran tidak ditemukan.'},{status:404});
  if(reg.lifecycle_status!=='active')return NextResponse.json({message:'Perubahan profil dikunci selama pengajuan pengunduran diri diproses atau setelah pengunduran diri disetujui.'},{status:409});
  const b=await request.json().catch(()=>({}));
  const data={
    name_core:cleanText(b.name_core||reg.name_core||reg.full_name,255),title_prefix:cleanText(b.title_prefix,80),title_suffix:cleanText(b.title_suffix,120),
    whatsapp:cleanText(b.whatsapp,50),university:cleanText(b.university,255),stra_number:cleanText(b.stra_number,100),participant_type:cleanText(b.participant_type,40),practice_type:cleanText(b.practice_type,120),practice_name:cleanText(b.practice_name,255),practice_years:Number(b.practice_years||0),teaching_years:Number(b.teaching_years||0)
  };
  const errors={};
  if(data.name_core.length<3)errors.name_core='Nama peserta wajib diisi.';
  const normalizedWhatsapp=normalizePhone(data.whatsapp);if(normalizedWhatsapp.length<10)errors.whatsapp='Nomor WhatsApp tidak valid.';
  if(!data.university)errors.university='Homebase wajib diisi.';
  if(!validStraNumber(data.stra_number))errors.stra_number='Nomor STRA wajib diisi dengan benar.';
  let options={};try{options=await masterOptions(db,reg.event_id,{activeOnly:false})}catch(e){console.error('profile master:',e)}
  Object.assign(errors,validateProfessionalWithMaster(data,options,{allowCurrentPracticeType:reg.practice_type||'',allowCurrentParticipantType:reg.participant_type||''}));
  const [{data:dupWa},{data:dupStra}]=await Promise.all([
    db.from('registrations').select('id').eq('event_id',reg.event_id).eq('normalized_whatsapp',normalizedWhatsapp).neq('id',reg.id).limit(1).maybeSingle(),
    db.from('registrations').select('id').eq('event_id',reg.event_id).eq('normalized_stra',normalizeStra(data.stra_number)).neq('id',reg.id).limit(1).maybeSingle()
  ]);
  if(dupWa)errors.whatsapp='Nomor WhatsApp sudah digunakan peserta lain.';if(dupStra)errors.stra_number='Nomor STRA sudah digunakan peserta lain.';
  if(Object.keys(errors).length)return NextResponse.json({message:Object.values(errors)[0],errors},{status:422});
  const {data:uni}=await db.from('universities').select('name,active').ilike('name',data.university).limit(1).maybeSingle();if(!uni&&data.university!==reg.university)return NextResponse.json({message:'Homebase harus dipilih dari Data Homebase.'},{status:422});if(uni&&!uni.active&&data.university!==reg.university)return NextResponse.json({message:'Homebase tersebut sedang dinonaktifkan.'},{status:422});
  const straChanged=normalizeStra(data.stra_number)!==normalizeStra(reg.stra_number||'');
  const experienceChanged=['participant_type','practice_type','practice_name'].some(k=>String(data[k]||'')!==String(reg[k]||''))||Number(data.practice_years||0)!==Number(reg.practice_years||0)||Number(data.teaching_years||0)!==Number(reg.teaching_years||0);
  const full_name=displayName({...data,full_name:reg.full_name});
  const update={...data,full_name,normalized_whatsapp:normalizedWhatsapp,normalized_stra:normalizeStra(data.stra_number),updated_at:new Date().toISOString()};
  let requirementsStatus=reg.requirements_status;
  if(straChanged||experienceChanged){requirementsStatus='pending';update.requirements_status='pending';update.overall_status=overallStatus('pending',reg.payment_status)}
  const {error}=await db.from('registrations').update(update).eq('id',reg.id);if(error){console.error('profile update:',error);return NextResponse.json({message:'Gagal menyimpan perubahan profil.'},{status:500})}
  const reset=[];
  if(straChanged){const {data:docs}=await db.from('registration_documents').select('id').eq('registration_id',reg.id).eq('document_type','stra').order('created_at',{ascending:false}).limit(1);if(docs?.[0]){await db.from('registration_documents').update({status:'pending',review_note:null,next_action:null,reviewed_at:null,reviewed_by:null}).eq('id',docs[0].id);reset.push('stra')}}
  if(experienceChanged){const {data:docs}=await db.from('registration_documents').select('id').eq('registration_id',reg.id).eq('document_type','experience').order('created_at',{ascending:false}).limit(1);if(docs?.[0]){await db.from('registration_documents').update({status:'pending',review_note:null,next_action:null,reviewed_at:null,reviewed_by:null}).eq('id',docs[0].id);reset.push('experience')}}
  await logActivity({registrationId:reg.id,actorType:'participant',actorEmail:auth.user.email,action:'profile_updated'});
  return NextResponse.json({ok:true,full_name,reviewReset:reset,requirementsStatus});
}
