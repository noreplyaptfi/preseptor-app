import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { overallStatus } from '../../../../lib/status';
import { logActivity } from '../../../../lib/audit';
import { sendEmail } from '../../../../lib/email';
import { rejectionEmail,paymentVerifiedEmail } from '../../../../lib/email-template';

const documentLabels={stra:'STRA',experience:'Bukti pengalaman',payment_proof:'Bukti pembayaran'};

function latestByType(docs=[]){
  const out={};
  for(const doc of docs){if(!out[doc.document_type]) out[doc.document_type]=doc;}
  return out;
}

export async function PATCH(request){
  const body=await request.json();
  const type=body.documentType;
  if(!body.registrationId||!['stra','experience','payment_proof'].includes(type)||!['valid','rejected'].includes(body.status)) return NextResponse.json({message:'Permintaan verifikasi tidak valid.'},{status:422});
  const roles=type==='payment_proof'?['super_admin','event_admin','payment_verifier']:['super_admin','event_admin','document_verifier'];
  const auth=await requireAdmin(request,roles);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const reason=String(body.reason||'').trim().slice(0,1200);
  const nextAction=String(body.nextAction||'').trim().slice(0,1200);
  if(body.status==='rejected'&&(!reason||!nextAction)) return NextResponse.json({message:'Alasan penolakan dan langkah selanjutnya wajib diisi.'},{status:422});

  const db=getSupabaseAdmin();
  const {data:reg}=await db.from('registrations').select('*').eq('id',body.registrationId).single();
  if(!reg) return NextResponse.json({message:'Pendaftaran tidak ditemukan.'},{status:404});
  const {data:doc}=await db.from('registration_documents').select('*').eq('registration_id',reg.id).eq('document_type',type).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(!doc) return NextResponse.json({message:'Dokumen belum tersedia.'},{status:404});

  const now=new Date().toISOString();
  const {error:updateDocError}=await db.from('registration_documents').update({
    status:body.status,
    review_note:body.status==='rejected'?reason:null,
    next_action:body.status==='rejected'?nextAction:null,
    reviewed_at:now,
    reviewed_by:auth.user.email
  }).eq('id',doc.id);
  if(updateDocError) return NextResponse.json({message:'Gagal memperbarui dokumen.'},{status:500});

  const {data:allDocs}=await db.from('registration_documents').select('*').eq('registration_id',reg.id).order('created_at',{ascending:false});
  const docs=latestByType(allDocs||[]);
  const requirementDocs=[docs.stra,docs.experience];
  let requirementsStatus='pending';
  if(requirementDocs.some(x=>!x)) requirementsStatus='incomplete';
  else if(requirementDocs.some(x=>x.status==='rejected')) requirementsStatus='rejected';
  else if(requirementDocs.every(x=>x.status==='valid')) requirementsStatus='valid';
  const paymentStatus=!docs.payment_proof?'pending':docs.payment_proof.status==='valid'?'verified':docs.payment_proof.status==='rejected'?'rejected':'pending';
  const regPatch={requirements_status:requirementsStatus,payment_status:paymentStatus,overall_status:overallStatus(requirementsStatus,paymentStatus),updated_at:now};
  if(type==='payment_proof'){
    regPatch.payment_verified_at=['valid','rejected'].includes(body.status)?now:null;
    regPatch.payment_verified_by=auth.user.email;
  }else{
    regPatch.requirements_verified_at=['valid','rejected'].includes(requirementsStatus)?now:null;
    regPatch.requirements_verified_by=auth.user.email;
  }
  await db.from('registrations').update(regPatch).eq('id',reg.id);
  await logActivity({registrationId:reg.id,actorType:'admin',actorEmail:auth.user.email,action:`document_${type}_${body.status}`,metadata:{document_id:doc.id,reason:reason||null,next_action:nextAction||null,previous_status:doc.status}});

  const origin=new URL(request.url).origin;
  let emailResult=null;
  if(body.status==='rejected'){
    emailResult=await sendEmail({to:reg.email,subject:`Perlu perbaikan - ${documentLabels[type]} - ${reg.registration_code}`,html:rejectionEmail({name:reg.full_name,registrationCode:reg.registration_code,documentLabel:documentLabels[type],reason,nextAction,dashboardUrl:`${origin}/dashboard`})});
    await db.from('email_logs').insert({registration_id:reg.id,email_type:`${type}_rejected`,recipient:reg.email,status:emailResult.ok?'sent':emailResult.skipped?'skipped':'failed',provider_id:emailResult.id||null,error_message:emailResult.error||null});
  }
  if(type==='payment_proof'&&body.status==='valid'){
    emailResult=await sendEmail({to:reg.email,subject:`Pembayaran terverifikasi - ${reg.registration_code}`,html:paymentVerifiedEmail({name:reg.full_name,registrationCode:reg.registration_code,dashboardUrl:`${origin}/dashboard`})});
    await db.from('email_logs').insert({registration_id:reg.id,email_type:'payment_verified',recipient:reg.email,status:emailResult.ok?'sent':emailResult.skipped?'skipped':'failed',provider_id:emailResult.id||null,error_message:emailResult.error||null});
  }
  return NextResponse.json({ok:true,requirementsStatus,paymentStatus,overallStatus:regPatch.overall_status,emailSent:!!emailResult?.ok});
}
