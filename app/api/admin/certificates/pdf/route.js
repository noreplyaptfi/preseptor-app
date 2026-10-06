import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin';
import { logActivity } from '../../../../../lib/audit';
import { certificateConfig,formatCertificateNo } from '../../../../../lib/certificate';
import { buildCertificatePdf } from '../../../../../lib/certificate-pdf';
import { certificateEvent,registrationById,participantCertificate,issueAndRender,pdfResponse,verifyUrlFor } from '../../../../../lib/certificate-data';

// v0.8.0 — Unduh sertifikat peserta oleh Super Admin, atau contoh template (?preview=1).
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request){
  const auth=await requireAdmin(request,['super_admin']);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  try{
    const db=getSupabaseAdmin();
    const event=await certificateEvent(db);
    if(!event)return NextResponse.json({message:'Event tidak ditemukan.'},{status:404});
    const u=new URL(request.url);

    if(u.searchParams.get('preview')==='1'){
      const config=certificateConfig(event.certificate_config);
      const mode=u.searchParams.get('mode')==='Online'?'Online':'Offline';
      const bytes=await buildCertificatePdf({
        name:'apt. Nama Lengkap Peserta, S.Farm., M.Farm.',
        certificateNo:formatCertificateNo(config.number_format,1,false),
        mode,config,
        verifyUrl:verifyUrlFor(request,'CONTOH'),
        verifyCode:'CONTOH',
        watermark:'preview'
      });
      return pdfResponse(bytes,`contoh-sertifikat-${mode.toLowerCase()}.pdf`);
    }

    const reg=await registrationById(db,String(u.searchParams.get('registrationId')||''));
    if(!reg||reg.event_id!==event.id)return NextResponse.json({message:'Peserta tidak ditemukan.'},{status:404});
    const s=await participantCertificate(db,reg,event);
    if(s.status==='revoked')return NextResponse.json({message:'Sertifikat peserta ini sudah dicabut. Pulihkan terlebih dahulu.'},{status:409});
    if(!s.checklist.eligible&&s.cert?.issued_via!=='manual')return NextResponse.json({message:'Peserta belum memenuhi syarat. Gunakan Terbitkan manual bila memang perlu.'},{status:409});
    const first=!s.cert;
    const out=await issueAndRender(db,{reg,event,request,actor:auth.user.email});
    if(first)await logActivity({registrationId:reg.id,actorType:'admin',actorEmail:auth.user.email,action:'certificate_issued',metadata:{serial:out.cert.serial,by_admin:true}});
    return pdfResponse(out.bytes,out.filename);
  }catch(e){
    return NextResponse.json({message:e.message||'Sertifikat gagal dibuat.'},{status:500});
  }
}
