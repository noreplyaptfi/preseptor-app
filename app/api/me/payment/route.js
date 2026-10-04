import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { overallStatus } from '../../../../lib/status';
import { logActivity } from '../../../../lib/audit';
import { verifyStoredUpload } from '../../../../lib/direct-upload';

export const runtime='nodejs';

async function latestPaymentDoc(db,registrationId){
  const {data}=await db.from('registration_documents')
    .select('*')
    .eq('registration_id',registrationId)
    .eq('document_type','payment_proof')
    .order('created_at',{ascending:false})
    .limit(1)
    .maybeSingle();
  return data;
}

export async function POST(request){
  const auth=await requireUser(request);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});

  const db=getSupabaseAdmin();
  const {data:reg,error:regError}=await db.from('registrations')
    .select('*')
    .ilike('email',auth.user.email)
    .order('created_at',{ascending:false})
    .limit(1)
    .maybeSingle();

  if(regError)return NextResponse.json({message:'Gagal membaca pendaftaran.'},{status:500});
  if(!reg)return NextResponse.json({message:'Pendaftaran tidak ditemukan.'},{status:404});
  if(['withdrawn','rejected'].includes(reg.lifecycle_status))return NextResponse.json({message:'Pendaftaran sudah tidak aktif sehingga bukti pembayaran tidak dapat diubah.'},{status:409});
  if(reg.payment_status==='verified')return NextResponse.json({message:'Pembayaran sudah terverifikasi dan tidak dapat diganti dari dashboard.'},{status:409});

  let body;
  try{body=await request.json()}catch{return NextResponse.json({message:'Data bukti pembayaran tidak valid.'},{status:400})}
  const file=body?.files?.payment_proof;
  if(!file)return NextResponse.json({message:'Bukti pembayaran wajib diunggah.'},{status:422});
  if(!String(file.path||'').startsWith(`${reg.id}/`))return NextResponse.json({message:'Lokasi file pembayaran tidak valid.'},{status:422});

  const fileError=await verifyStoredUpload(db,file,'Bukti pembayaran');
  if(fileError)return NextResponse.json({message:fileError},{status:422});

  const old=await latestPaymentDoc(db,reg.id);
  const replacing=!!old;
  const replaceAllowed=reg.payment_status==='rejected'||old?.status==='rejected';
  if(old&&!replaceAllowed)return NextResponse.json({message:'Bukti pembayaran sudah diterima dan sedang menunggu verifikasi panitia.'},{status:409});

  if(old){
    const {data:oldRows}=await db.from('registration_documents').select('storage_path').eq('registration_id',reg.id).eq('document_type','payment_proof');
    await db.from('registration_documents').delete().eq('registration_id',reg.id).eq('document_type','payment_proof');
    if(oldRows?.length)await db.storage.from('preseptor-private').remove(oldRows.map(x=>x.storage_path)).catch(()=>{});
  }

  const {error:docError}=await db.from('registration_documents').insert({
    registration_id:reg.id,
    document_type:'payment_proof',
    storage_path:file.path,
    original_name:file.name,
    mime_type:file.type,
    file_size:file.size,
    status:'pending'
  });
  if(docError){
    console.error('participant payment insert:',docError);
    return NextResponse.json({message:'Gagal mencatat bukti pembayaran.'},{status:500});
  }

  const {error:updateError}=await db.from('registrations').update({
    payment_status:'pending',
    overall_status:overallStatus(reg.requirements_status,'pending'),
    payment_verified_at:null,
    updated_at:new Date().toISOString()
  }).eq('id',reg.id);
  if(updateError){
    console.error('participant payment registration update:',updateError);
    return NextResponse.json({message:'Bukti tersimpan, tetapi status pembayaran gagal diperbarui. Hubungi panitia.'},{status:500});
  }

  await logActivity({registrationId:reg.id,actorType:'participant',actorEmail:auth.user.email,action:replacing?'payment_proof_reuploaded':'payment_proof_uploaded'});
  return NextResponse.json({ok:true,reuploaded:replacing});
}
