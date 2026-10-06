import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { requireUser } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { released,verifiedRegistration,normalizeVenue,venueReady,venueMapsLink,venueEmbedUrl,whatsappLink } from '../../../../lib/event-access';

export const runtime='nodejs';
export const dynamic='force-dynamic';

// v0.8.1: Peserta Offline → info lokasi (tanpa QR). QR presensi Offline hanya di menu Kehadiran.
// Peserta Online → link Zoom + QR Zoom (tidak berubah).

async function qr(value){return QRCode.toDataURL(value,{errorCorrectionLevel:'M',margin:1,width:520,color:{dark:'#11185D',light:'#FFFFFF'}})}

export async function GET(request){
  const auth=await requireUser(request);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const {data:reg,error}=await db.from('registrations').select('id,event_id,registration_code,full_name,email,attendance_mode,requirements_status,payment_status,overall_status,lifecycle_status').ilike('email',auth.user.email).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(error)return NextResponse.json({message:'Gagal membaca akses acara.'},{status:500});
  if(!reg)return NextResponse.json({message:'Pendaftaran tidak ditemukan.'},{status:404});
  const {data:event}=await db.from('events').select('*').eq('id',reg.event_id).single();
  const withdrawn=reg.lifecycle_status==='withdrawn',rejected=reg.lifecycle_status==='rejected',inactive=withdrawn||rejected;
  const eligible=!inactive&&verifiedRegistration(reg);
  const base={eligible,withdrawn,rejected,inactive,eventStart:event?.event_start||null,eventEnd:event?.event_end||null};
  const headers={'Cache-Control':'private, no-store'};

  if(reg.attendance_mode==='Offline'){
    const venue=normalizeVenue(event?.offline_venue);
    const isReleased=released(event?.offline_qr_enabled,event?.offline_qr_release_at);
    const available=eligible&&isReleased&&venueReady(venue);
    return NextResponse.json({...base,mode:'Offline',kind:'offline',enabled:!!event?.offline_qr_enabled,releaseAt:event?.offline_qr_release_at||null,released:isReleased,available,
      venue:available?{...venue,mapsLink:venueMapsLink(venue),embedUrl:venueEmbedUrl(venue),whatsapp:whatsappLink(venue.contact_phone)}:null},{headers});
  }

  const isReleased=released(event?.online_access_enabled,event?.online_access_release_at);
  const zoomUrl=eligible&&isReleased&&event?.zoom_url?String(event.zoom_url):'';
  return NextResponse.json({...base,mode:'Online',kind:'online',enabled:!!event?.online_access_enabled,releaseAt:event?.online_access_release_at||null,released:isReleased,available:!!zoomUrl,zoomUrl,qrDataUrl:zoomUrl?await qr(zoomUrl):''},{headers});
}
