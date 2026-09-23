import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { validateFile,validateFileSignature,safeFileName } from '../../../../lib/validation';
import { overallStatus } from '../../../../lib/status';
import { logActivity } from '../../../../lib/audit';
export const runtime='nodejs';

export async function POST(request){
  const auth=await requireUser(request);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const {data:reg}=await db.from('registrations').select('*').ilike('email',auth.user.email).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(!reg) return NextResponse.json({message:'Pendaftaran tidak ditemukan.'},{status:404});
  if(reg.payment_status==='verified') return NextResponse.json({message:'Pembayaran sudah terverifikasi dan tidak dapat diganti.'},{status:409});
  const fd=await request.formData();
  const file=fd.get('payment_proof');
  const fileError=validateFile(file,'Bukti pembayaran');
  if(fileError) return NextResponse.json({message:fileError},{status:422});
  const {data:old}=await db.from('registration_documents').select('storage_path').eq('registration_id',reg.id).eq('document_type','payment_proof');
  if(old?.length){await db.storage.from('preseptor-private').remove(old.map(x=>x.storage_path));await db.from('registration_documents').delete().eq('registration_id',reg.id).eq('document_type','payment_proof')}
  const path=`${reg.id}/payment_proof/${Date.now()}-${safeFileName(file.name)}`;
  const buffer=Buffer.from(await file.arrayBuffer());
  const {error}=await db.storage.from('preseptor-private').upload(path,buffer,{contentType:file.type});
  if(error) return NextResponse.json({message:'Gagal mengunggah bukti pembayaran.'},{status:500});
  await db.from('registration_documents').insert({registration_id:reg.id,document_type:'payment_proof',storage_path:path,original_name:file.name,mime_type:file.type,file_size:file.size,status:'pending'});
  await db.from('registrations').update({payment_status:'pending',overall_status:overallStatus(reg.requirements_status,'pending'),updated_at:new Date().toISOString()}).eq('id',reg.id);
  await logActivity({registrationId:reg.id,actorType:'participant',actorEmail:auth.user.email,action:'payment_proof_reuploaded'});
  return NextResponse.json({ok:true});
}
