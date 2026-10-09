import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin';
import { logActivity } from '../../../../../lib/audit';
import { certificateConfig,certificateNumber } from '../../../../../lib/certificate';
import { buildCertificatePdf } from '../../../../../lib/certificate-pdf';
import { certificateEvent,registrationById,participantCertificate,issueAndRender,pdfResponse,verifyUrlFor,loadSignature,recipientById,issueRecipientAndRender } from '../../../../../lib/certificate-data';

// v0.8.0 — Unduh sertifikat peserta oleh Super Admin, atau contoh template (?preview=1).
// v0.8.6 — + pemateri/moderator (?recipientId=), contoh per jenis (?preview=1&kind=speaker|moderator&lang=en).
export const runtime='nodejs';
export const dynamic='force-dynamic';

const SAMPLE_NAME={participant:'apt. Nama Lengkap Peserta, S.Farm., M.Farm.',speaker:'Prof. Dr. apt. Nama Pemateri, M.Si.',moderator:'Dr. apt. Nama Moderator, M.Farm.'};

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
      const kind=['speaker','moderator'].includes(u.searchParams.get('kind'))?u.searchParams.get('kind'):'participant';
      const lang=u.searchParams.get('lang')==='en'?'en':'id';
      const m=u.searchParams.get('mode');
      const mode=m==='Online'?'Online':m==='Offline'?'Offline':(kind==='participant'?'Offline':null);
      const bytes=await buildCertificatePdf({
        name:lang==='en'&&kind!=='participant'?'Assoc. Prof. Speaker Name':SAMPLE_NAME[kind],
        certificateNo:certificateNumber(config,1,false),
        mode,config,kind,lang,
        topic:kind==='participant'?null:(u.searchParams.get('topic')||null),
        verifyUrl:verifyUrlFor(request,'CONTOH'),
        verifyCode:'CONTOH',
        watermark:'preview',
        signature:await loadSignature(db,config)
      });
      return pdfResponse(bytes,`contoh-sertifikat-${kind}${lang==='en'?'-en':''}${kind==='participant'?`-${mode.toLowerCase()}`:''}.pdf`);
    }

    const recipientId=u.searchParams.get('recipientId');
    if(recipientId){
      const recipient=await recipientById(db,event.id,recipientId);
      if(!recipient)return NextResponse.json({message:'Pemateri/moderator tidak ditemukan.'},{status:404});
      const {data:had}=await db.from('certificates').select('id').eq('recipient_id',recipient.id).maybeSingle();
      const out=await issueRecipientAndRender(db,{recipient,event,request,actor:auth.user.email});
      if(!had)await logActivity({actorType:'admin',actorEmail:auth.user.email,action:'certificate_issued',metadata:{serial:out.cert.serial,recipient_id:recipient.id,role:recipient.role}});
      return pdfResponse(out.bytes,out.filename);
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
    return NextResponse.json({message:e.message||'Sertifikat gagal dibuat.'},{status:e.message?.includes('dicabut')?409:500});
  }
}
