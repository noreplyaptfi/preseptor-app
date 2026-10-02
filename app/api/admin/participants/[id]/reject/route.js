import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../../../lib/supabase-admin';
import { cleanText } from '../../../../../../lib/profile';
import { sendEmail } from '../../../../../../lib/email';
import { requestEmailHtml } from '../../../../../../lib/self-service';
import { logActivity } from '../../../../../../lib/audit';

export const dynamic='force-dynamic';

export async function POST(request,{params}){
  const auth=await requireAdmin(request,['super_admin','event_admin']);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const {id}=await params;
  const body=await request.json().catch(()=>({}));
  const reason=cleanText(body.reason,1800);
  if(reason.length<5)return NextResponse.json({message:'Alasan penolakan pendaftaran wajib diisi.'},{status:422});

  const {data:reg,error}=await db.from('registrations').select('*').eq('id',id).maybeSingle();
  if(error||!reg)return NextResponse.json({message:'Pendaftar tidak ditemukan.'},{status:404});
  if(reg.lifecycle_status==='rejected')return NextResponse.json({message:'Pendaftaran ini sudah berstatus ditolak.'},{status:409});
  if(reg.lifecycle_status==='withdrawn')return NextResponse.json({message:'Pendaftaran ini sudah berstatus mengundurkan diri.'},{status:409});
  if(reg.lifecycle_status==='withdrawal_requested')return NextResponse.json({message:'Selesaikan pengajuan pengunduran diri terlebih dahulu sebelum menolak pendaftaran.'},{status:409});

  const {data:docs}=await db.from('registration_documents').select('document_type,status').eq('registration_id',reg.id).in('document_type',['stra','experience','payment_proof']).order('created_at',{ascending:false});
  const latest={};for(const doc of docs||[])if(!latest[doc.document_type])latest[doc.document_type]=doc;
  const invalidDocs=Object.entries(latest).filter(([,doc])=>doc?.status==='rejected').map(([type])=>type);
  const hasInvalid=invalidDocs.length>0||reg.requirements_status==='rejected'||reg.payment_status==='rejected';
  if(!hasInvalid)return NextResponse.json({message:'Pendaftaran hanya dapat ditolak setelah minimal satu dokumen berstatus Ditolak.'},{status:409});

  const now=new Date().toISOString();
  const {error:updateError}=await db.from('registrations').update({
    lifecycle_status:'rejected',
    rejected_at:now,
    rejected_reason:reason,
    rejected_by:auth.user.email,
    updated_at:now
  }).eq('id',reg.id);
  if(updateError){console.error('registration reject:',updateError);return NextResponse.json({message:'Gagal menolak pendaftaran.'},{status:500})}

  await db.from('self_service_requests').update({status:'cancelled',admin_note:'Dibatalkan otomatis karena pendaftaran ditolak.',reviewed_by:auth.user.email,reviewed_at:now,updated_at:now}).eq('registration_id',reg.id).eq('status','pending');

  const refundCopy=reg.payment_status==='verified'
    ? 'Pembayaran Anda sebelumnya sudah terverifikasi. Anda tetap dapat masuk ke akun peserta dan mengajukan refund melalui menu Profil Saya.'
    : 'Tidak ada proses refund otomatis dari penolakan ini.';
  const emailResult=await sendEmail({
    to:reg.email,
    subject:'Pendaftaran Pelatihan Preseptor APTFI ditolak',
    html:requestEmailHtml({name:reg.full_name,title:'Pendaftaran ditolak',message:`Pendaftaran Anda dinyatakan tidak memenuhi persyaratan dan telah ditolak oleh panitia. ${refundCopy}`,note:reason})
  });
  await db.from('email_logs').insert({registration_id:reg.id,email_type:'registration_rejected',recipient:reg.email,status:emailResult.ok?'sent':emailResult.skipped?'skipped':'failed',provider_id:emailResult.id||null,error_message:emailResult.error||null});
  await logActivity({registrationId:reg.id,actorType:'admin',actorEmail:auth.user.email,action:'registration_rejected'});
  return NextResponse.json({ok:true,emailSent:!!emailResult.ok,refundEligible:reg.payment_status==='verified'});
}
