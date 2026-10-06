import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { certificateEvent,registrationByEmail,participantCertificate,publicCertificate,isTestReg } from '../../../../lib/certificate-data';
import { displayName } from '../../../../lib/profile';

// v0.8.0 — Status sertifikat peserta: daftar syarat, status rilis, dan data sertifikat bila sudah terbit.
export const dynamic='force-dynamic';

export async function GET(request){
  const auth=await requireUser(request);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  try{
    const db=getSupabaseAdmin();
    const reg=await registrationByEmail(db,auth.user.email);
    if(!reg)return NextResponse.json({message:'Pendaftaran tidak ditemukan.'},{status:404});
    const event=await certificateEvent(db,reg.event_id);
    const s=await participantCertificate(db,reg,event);
    return NextResponse.json({
      status:s.status,
      statusLabel:s.statusLabel,
      eligible:s.checklist.eligible,
      released:!!event?.certificate_enabled,
      testAccount:isTestReg(reg),
      items:s.checklist.items,
      name:displayName(reg)||reg.full_name,
      mode:reg.attendance_mode,
      eventName:s.config.event_name,
      certificate:publicCertificate(s.cert,s.config,request)
    },{headers:{'Cache-Control':'private, no-store'}});
  }catch(e){
    return NextResponse.json({message:e.message||'Status sertifikat gagal dimuat.'},{status:500});
  }
}
