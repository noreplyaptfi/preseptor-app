import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { parseJakartaDateTime,safeHttpsUrl } from '../../../../lib/event-access';
import { logActivity } from '../../../../lib/audit';

export async function GET(request){
  const auth=await requireAdmin(request);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const slug=process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026';
  const {data:event,error}=await db.from('events').select('id,event_start,event_end,offline_qr_enabled,offline_qr_release_at,online_access_enabled,online_access_release_at,zoom_url').eq('slug',slug).single();
  if(error) return NextResponse.json({message:'Event tidak ditemukan.'},{status:404});
  const [{count:offlineVerified},{count:checkedIn},{count:onlineVerified}]=await Promise.all([
    db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',event.id).eq('attendance_mode','Offline').eq('requirements_status','valid').eq('payment_status','verified'),
    db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',event.id).eq('attendance_mode','Offline').not('checked_in_at','is',null),
    db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',event.id).eq('attendance_mode','Online').eq('requirements_status','valid').eq('payment_status','verified')
  ]);
  return NextResponse.json({event,stats:{offlineVerified:Number(offlineVerified||0),checkedIn:Number(checkedIn||0),onlineVerified:Number(onlineVerified||0)}});
}

export async function PATCH(request){
  const auth=await requireAdmin(request,['super_admin','event_admin']);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const body=await request.json().catch(()=>({}));
  const zoomRaw=String(body.zoom_url||'').trim();
  const zoomUrl=zoomRaw?safeHttpsUrl(zoomRaw):'';
  if(zoomRaw&&!zoomUrl) return NextResponse.json({message:'Link Zoom harus menggunakan URL https yang valid.'},{status:422});
  const offlineRelease=parseJakartaDateTime(body.offline_qr_release_at);
  const onlineRelease=parseJakartaDateTime(body.online_access_release_at);
  if(body.offline_qr_release_at&&!offlineRelease) return NextResponse.json({message:'Waktu publikasi QR Offline tidak valid.'},{status:422});
  if(body.online_access_release_at&&!onlineRelease) return NextResponse.json({message:'Waktu publikasi akses Online tidak valid.'},{status:422});
  const patch={
    offline_qr_enabled:body.offline_qr_enabled===true,
    offline_qr_release_at:offlineRelease?.toISOString()||null,
    online_access_enabled:body.online_access_enabled===true,
    online_access_release_at:onlineRelease?.toISOString()||null,
    zoom_url:zoomUrl||null,
    updated_at:new Date().toISOString()
  };
  const db=getSupabaseAdmin();
  const slug=process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026';
  const {data:event,error}=await db.from('events').update(patch).eq('slug',slug).select('id').single();
  if(error) return NextResponse.json({message:'Gagal menyimpan pengaturan akses acara.'},{status:500});
  await logActivity({registrationId:null,actorType:'admin',actorEmail:auth.user.email,action:'event_access_updated',metadata:{event_id:event.id,...patch,zoom_url:zoomUrl?'configured':null}});
  return NextResponse.json({ok:true});
}
