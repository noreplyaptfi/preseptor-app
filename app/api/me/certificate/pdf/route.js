import { NextResponse } from 'next/server';
import { requireUser } from '../../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin';
import { logActivity } from '../../../../../lib/audit';
import { certificateEvent,registrationByEmail,participantCertificate,issueAndRender,pdfResponse,isTestReg } from '../../../../../lib/certificate-data';

// v0.8.0 — Unduh sertifikat peserta. Nomor sertifikat diberikan saat unduhan pertama.
export const runtime='nodejs';
export const dynamic='force-dynamic';

const BLOCKED={
  incomplete:'Sertifikat belum tersedia karena syarat belum lengkap.',
  waiting_release:'Anda sudah memenuhi syarat. Sertifikat dapat diunduh setelah dirilis panitia.',
  revoked:'Sertifikat Anda telah dicabut panitia. Hubungi panitia untuk informasi lebih lanjut.'
};

export async function GET(request){
  const auth=await requireUser(request);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  try{
    const db=getSupabaseAdmin();
    const reg=await registrationByEmail(db,auth.user.email);
    if(!reg)return NextResponse.json({message:'Pendaftaran tidak ditemukan.'},{status:404});
    const event=await certificateEvent(db,reg.event_id);
    const s=await participantCertificate(db,reg,event);
    if(s.status!=='ready')return NextResponse.json({message:BLOCKED[s.status]||'Sertifikat belum tersedia.'},{status:409});
    const first=!s.cert;
    const out=await issueAndRender(db,{reg,event,request,countDownload:true});
    if(first)await logActivity({registrationId:reg.id,actorType:'participant',actorEmail:auth.user.email,action:'certificate_issued',metadata:{serial:out.cert.serial,test_account:isTestReg(reg)}});
    return pdfResponse(out.bytes,out.filename);
  }catch(e){
    return NextResponse.json({message:e.message||'Sertifikat gagal dibuat.'},{status:500});
  }
}
