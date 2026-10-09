import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { sanitizeAnnouncementHtml } from '../../../../lib/announcement';
import { announcementRecipient,ANNOUNCEMENT_AUDIENCE_VALUES } from '../../../../lib/announcement-audience';
import { nikRowsForEvent } from '../../../../lib/nik-data';
import { sendBulkEmail } from '../../../../lib/email';
import { announcementEmail } from '../../../../lib/email-template';

export const runtime='nodejs';

export async function GET(request){
  const auth=await requireAdmin(request);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const {data:event}=await db.from('events').select('id').eq('slug',process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026').single();
  const {data,error}=await db.from('announcements').select('*').eq('event_id',event.id).order('published_at',{ascending:false});
  if(error) return NextResponse.json({message:'Gagal membaca pengumuman.'},{status:500});
  return NextResponse.json({announcements:data||[]});
}

export async function POST(request){
  const auth=await requireAdmin(request,['super_admin','event_admin']);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const body=await request.json();
  const subject=String(body.subject||'').trim().slice(0,180);
  const bodyHtml=sanitizeAnnouncementHtml(body.bodyHtml||'');
  const audience=ANNOUNCEMENT_AUDIENCE_VALUES.includes(body.audience)?body.audience:'all';
  if(subject.length<3||bodyHtml.length<3) return NextResponse.json({message:'Subject dan isi pengumuman wajib diisi.'},{status:422});
  const db=getSupabaseAdmin();
  const {data:event}=await db.from('events').select('id').eq('slug',process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026').single();
  // v0.8.5 — data SKP/NIK dibaca dulu agar pengumuman SKP tidak tersimpan bila migration 023 belum dijalankan.
  const skpAudience=audience==='skp'||audience==='skp_nik_missing';
  const fields='id,email,full_name,attendance_mode,overall_status,lifecycle_status,email_needs_update';
  let regsResult=await db.from('registrations').select(`${fields},skp_eligible`).eq('event_id',event.id);
  if(regsResult.error&&!skpAudience) regsResult=await db.from('registrations').select(fields).eq('event_id',event.id);
  if(regsResult.error) return NextResponse.json({message:skpAudience?'Data SKP belum siap. Jalankan migration 023 terlebih dahulu.':'Gagal membaca data peserta.'},{status:500});
  let regs=regsResult.data||[];
  if(audience==='skp_nik_missing'){
    const {map,ready}=await nikRowsForEvent(db,event.id);
    if(!ready) return NextResponse.json({message:'Data NIK belum siap. Jalankan migration 023 terlebih dahulu.'},{status:500});
    regs=regs.map(r=>({...r,nik_filled:map.has(r.id)}));
  }
  const {data:announcement,error}=await db.from('announcements').insert({event_id:event.id,subject,body_html:bodyHtml,audience,created_by:auth.user.email}).select('*').single();
  if(error) return NextResponse.json({message:'Gagal menyimpan pengumuman.'},{status:500});
  // v0.8.3: email hanya untuk peserta aktif (bukan ditolak / mengundurkan diri) dengan email valid.
  const recipients=regs.filter(r=>announcementRecipient(r,audience));
  const origin=new URL(request.url).origin;
  const html=announcementEmail({subject,bodyHtml,dashboardUrl:`${origin}/dashboard?tab=announcements`});
  let emailResult={ok:true,skipped:false};
  if(recipients.length) emailResult=await sendBulkEmail(recipients.map(r=>({to:r.email,subject:`[APTFI Preseptor] ${subject}`,html})));
  if(recipients.length){
    const status=emailResult.ok?'sent':emailResult.skipped?'skipped':'failed';
    const rows=recipients.map(r=>({registration_id:r.id,email_type:`announcement:${announcement.id}`,recipient:r.email,status,error_message:emailResult.error||null}));
    await db.from('email_logs').insert(rows);
  }
  return NextResponse.json({ok:true,announcement,recipientCount:recipients.length,emailSent:!!emailResult.ok,emailError:emailResult.error||null});
}
