import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { parseJakartaDateTime,safeHttpsUrl,normalizeVenue,venueReady } from '../../../../lib/event-access';
import { logActivity } from '../../../../lib/audit';

// v0.8.1: Peserta Offline → Akses Acara berisi info lokasi (offline_venue), bukan QR.
// Saklar offline_qr_enabled / offline_qr_release_at dipakai sebagai "Publikasikan info lokasi".

export async function GET(request){
  const auth=await requireAdmin(request);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const slug=process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026';
  const {data:event,error}=await db.from('events').select('*').eq('slug',slug).single();
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
  if(body.offline_qr_release_at&&!offlineRelease) return NextResponse.json({message:'Waktu tampil info lokasi tidak valid.'},{status:422});
  if(body.online_access_release_at&&!onlineRelease) return NextResponse.json({message:'Waktu publikasi akses Online tidak valid.'},{status:422});
  const offlineEnabled=body.offline_qr_enabled===true;
  const onlineEnabled=body.online_access_enabled===true;
  if(onlineEnabled&&!zoomUrl) return NextResponse.json({message:'Isi link Zoom sebelum mempublikasikan akses Online.'},{status:422});

  const patch={
    offline_qr_enabled:offlineEnabled,
    offline_qr_release_at:offlineRelease?.toISOString()||null,
    online_access_enabled:onlineEnabled,
    online_access_release_at:onlineRelease?.toISOString()||null,
    zoom_url:zoomUrl||null,
    updated_at:new Date().toISOString()
  };

  let venueMeta=null;
  if(body.offline_venue!==undefined){
    const venue=normalizeVenue(body.offline_venue);
    if(venue.maps_url&&!safeHttpsUrl(venue.maps_url)) return NextResponse.json({message:'Link Google Maps harus berupa URL https yang valid.'},{status:422});
    if(offlineEnabled&&!venueReady(venue)) return NextResponse.json({message:'Isi minimal nama tempat atau alamat sebelum mempublikasikan info lokasi.'},{status:422});
    patch.offline_venue=venue;
    venueMeta={name:venue.name||null,has_address:!!venue.address,has_maps:!!venue.maps_url};
  }

  const db=getSupabaseAdmin();
  const slug=process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026';
  const {data:event,error}=await db.from('events').update(patch).eq('slug',slug).select('id').single();
  if(error) return NextResponse.json({message:/offline_venue/.test(error.message||'')?'Kolom info lokasi belum ada. Jalankan migration 021 terlebih dahulu.':'Gagal menyimpan pengaturan akses acara.'},{status:500});
  const {offline_venue:_v,...logged}=patch;
  await logActivity({registrationId:null,actorType:'admin',actorEmail:auth.user.email,action:'event_access_updated',metadata:{event_id:event.id,...logged,zoom_url:zoomUrl?'configured':null,offline_venue:venueMeta}});
  return NextResponse.json({ok:true});
}
