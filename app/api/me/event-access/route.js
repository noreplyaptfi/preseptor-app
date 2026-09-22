import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { requireUser } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { released,verifiedRegistration } from '../../../../lib/event-access';

export const runtime='nodejs';
export const dynamic='force-dynamic';

async function qr(value){
  return QRCode.toDataURL(value,{errorCorrectionLevel:'M',margin:1,width:520,color:{dark:'#11185D',light:'#FFFFFF'}});
}

export async function GET(request){
  const auth=await requireUser(request);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const {data:reg,error}=await db.from('registrations').select('id,event_id,registration_code,full_name,email,attendance_mode,requirements_status,payment_status,overall_status,checkin_token,checked_in_at,checked_in_by').ilike('email',auth.user.email).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(error) return NextResponse.json({message:'Gagal membaca akses acara.'},{status:500});
  if(!reg) return NextResponse.json({message:'Pendaftaran tidak ditemukan.'},{status:404});
  const {data:event}=await db.from('events').select('id,event_start,event_end,offline_qr_enabled,offline_qr_release_at,online_access_enabled,online_access_release_at,zoom_url').eq('id',reg.event_id).single();
  const eligible=verifiedRegistration(reg);
  const origin=new URL(request.url).origin;
  if(reg.attendance_mode==='Offline'){
    const isReleased=released(event?.offline_qr_enabled,event?.offline_qr_release_at);
    const available=eligible&&isReleased&&!!reg.checkin_token;
    const checkinUrl=available?`${origin}/admin/checkin?token=${encodeURIComponent(reg.checkin_token)}`:'';
    return NextResponse.json({
      eligible,
      mode:'Offline',
      kind:'offline',
      enabled:!!event?.offline_qr_enabled,
      releaseAt:event?.offline_qr_release_at||null,
      released:isReleased,
      available,
      qrDataUrl:available?await qr(checkinUrl):'',
      checkedInAt:reg.checked_in_at||null,
      eventStart:event?.event_start||null,
      eventEnd:event?.event_end||null
    },{headers:{'Cache-Control':'private, no-store'}});
  }
  const isReleased=released(event?.online_access_enabled,event?.online_access_release_at);
  const zoomUrl=eligible&&isReleased&&event?.zoom_url?String(event.zoom_url):'';
  return NextResponse.json({
    eligible,
    mode:'Online',
    kind:'online',
    enabled:!!event?.online_access_enabled,
    releaseAt:event?.online_access_release_at||null,
    released:isReleased,
    available:!!zoomUrl,
    zoomUrl,
    qrDataUrl:zoomUrl?await qr(zoomUrl):'',
    eventStart:event?.event_start||null,
    eventEnd:event?.event_end||null
  },{headers:{'Cache-Control':'private, no-store'}});
}
