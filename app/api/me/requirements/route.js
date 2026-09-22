import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { clean,validStraNumber,validateProfessionalData,validateOptionalFile,safeFileName } from '../../../../lib/validation';
import { normalizeStra } from '../../../../lib/normalization';
import { overallStatus } from '../../../../lib/status';
import { logActivity } from '../../../../lib/audit';
export const runtime='nodejs';

async function latestDoc(db,registrationId,type){
  const {data}=await db.from('registration_documents').select('*').eq('registration_id',registrationId).eq('document_type',type).order('created_at',{ascending:false}).limit(1).maybeSingle();
  return data;
}

export async function POST(request){
  const auth=await requireUser(request);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const {data:reg}=await db.from('registrations').select('*').ilike('email',auth.user.email).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(!reg) return NextResponse.json({message:'Pendaftaran tidak ditemukan.'},{status:404});
  if(reg.requirements_status==='valid') return NextResponse.json({message:'Dokumen sudah dinyatakan valid dan tidak dapat diganti dari dashboard.'},{status:409});

  const fd=await request.formData();
  const data={
    stra_number:clean(fd.get('stra_number'),100),
    participant_type:clean(fd.get('participant_type'),40),
    practice_type:clean(fd.get('practice_type'),100),
    practice_name:clean(fd.get('practice_name')),
    practice_years:Number(fd.get('practice_years')||0),
    teaching_years:Number(fd.get('teaching_years')||0)
  };
  const errors=validateProfessionalData(data);
  if(!validStraNumber(data.stra_number)) errors.stra_number='Nomor STRA wajib diisi dengan benar.';
  const stra=fd.get('stra_proof'),experience=fd.get('experience_proof');
  const oldStra=await latestDoc(db,reg.id,'stra');
  const oldExp=await latestDoc(db,reg.id,'experience');
  const straRequired=!oldStra||oldStra.status==='rejected';
  const expRequired=!oldExp||oldExp.status==='rejected';
  if(straRequired&&!stra?.size) errors.stra='Bukti STRA perlu diunggah ulang.';
  if(expRequired&&!experience?.size) errors.experience='Bukti pengalaman perlu diunggah ulang.';
  for(const [key,file,label] of [['stra',stra,'Bukti STRA'],['experience',experience,'Bukti pengalaman']]){const e=validateOptionalFile(file,label);if(e)errors[key]=e}
  if(Object.keys(errors).length) return NextResponse.json({message:Object.values(errors)[0],errors},{status:422});

  const normalizedStra=normalizeStra(data.stra_number);
  const {data:duplicateStra}=await db.from('registrations').select('id').eq('event_id',reg.event_id).eq('normalized_stra',normalizedStra).neq('id',reg.id).limit(1).maybeSingle();
  if(duplicateStra) return NextResponse.json({message:'Nomor STRA tersebut sudah digunakan pada pendaftaran lain. Hubungi panitia jika data ini perlu dikoreksi.'},{status:409});

  for(const [type,file] of [['stra',stra],['experience',experience]]){
    if(!file?.size) continue;
    const {data:old}=await db.from('registration_documents').select('storage_path').eq('registration_id',reg.id).eq('document_type',type);
    if(old?.length){await db.storage.from('preseptor-private').remove(old.map(x=>x.storage_path));await db.from('registration_documents').delete().eq('registration_id',reg.id).eq('document_type',type)}
    const path=`${reg.id}/${type}/${Date.now()}-${safeFileName(file.name)}`;
    const buffer=Buffer.from(await file.arrayBuffer());
    const {error}=await db.storage.from('preseptor-private').upload(path,buffer,{contentType:file.type});
    if(error) return NextResponse.json({message:'Gagal mengunggah dokumen.'},{status:500});
    await db.from('registration_documents').insert({registration_id:reg.id,document_type:type,storage_path:path,original_name:file.name,mime_type:file.type,file_size:file.size,status:'pending'});
  }

  await db.from('registrations').update({...data,normalized_stra:normalizedStra,requirements_status:'pending',overall_status:overallStatus('pending',reg.payment_status),updated_at:new Date().toISOString()}).eq('id',reg.id);
  await logActivity({registrationId:reg.id,actorType:'participant',actorEmail:auth.user.email,action:'requirements_completed'});
  return NextResponse.json({ok:true});
}
