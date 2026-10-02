import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { resolveEventState } from '../../../../lib/event-state';
import { resolveAllModeRegistrationWindows } from '../../../../lib/registration-mode-window';

export const dynamic='force-dynamic';

function buildModePublic(windowState,{modeFull,totalFull}){
  let reason=windowState.reason;
  let message=windowState.message;
  let selectable=windowState.isOpen&&!modeFull&&!totalFull;
  if(windowState.isOpen&&totalFull){reason='total_quota_full';message='Kuota pendaftaran keseluruhan sudah penuh.';selectable=false}
  else if(windowState.isOpen&&modeFull){reason='quota_full';message=`Kuota pendaftaran ${windowState.mode} sudah penuh.`;selectable=false}
  return {
    selectable,
    reason,
    message,
    status:windowState.status,
    opens_at:windowState.opensAt,
    closes_at:windowState.closesAt,
    quota_full:!!modeFull,
    uses_mode_window:!!windowState.usesModeWindow
  };
}

export async function GET(){
  const db=getSupabaseAdmin();
  const {data:event,error}=await db.from('events').select('*').eq('slug',process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026').single();
  if(error||!event)return NextResponse.json({message:'Event belum dikonfigurasi.'},{status:503});

  const [total,online,offline]=await Promise.all([
    db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',event.id).neq('lifecycle_status','withdrawn'),
    db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',event.id).neq('lifecycle_status','withdrawn').eq('attendance_mode','Online'),
    db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',event.id).neq('lifecycle_status','withdrawn').eq('attendance_mode','Offline')
  ]);

  if(total.error||online.error||offline.error){console.error('public quota counts:',total.error||online.error||offline.error);return NextResponse.json({message:'Status kuota belum dapat dibaca.'},{status:503})}
  const countTotal=Number(total.count||0),countOnline=Number(online.count||0),countOffline=Number(offline.count||0);
  const quotaTotal=Number(event.quota_total||200),quotaOnline=Number(event.quota_online||150),quotaOffline=Number(event.quota_offline||50);
  const totalFull=quotaTotal>0&&countTotal>=quotaTotal;
  const windows=resolveAllModeRegistrationWindows(event);
  const modeAvailability={
    Online:buildModePublic(windows.Online,{modeFull:quotaOnline>0&&countOnline>=quotaOnline,totalFull}),
    Offline:buildModePublic(windows.Offline,{modeFull:quotaOffline>0&&countOffline>=quotaOffline,totalFull})
  };
  const availability={Online:modeAvailability.Online.selectable,Offline:modeAvailability.Offline.selectable};

  const legacyState=resolveEventState(event);
  const anyWindowOpen=windows.Online.isOpen||windows.Offline.isOpen;
  const anySelectable=availability.Online||availability.Offline;
  const state=(event.registration_status==='closed'||event.registration_status==='maintenance')?legacyState:{
    ...legacyState,
    isOpen:anyWindowOpen,
    status:anyWindowOpen?'open':(windows.Online.reason==='not_open'||windows.Offline.reason==='not_open'?'scheduled':'closed'),
    message:anySelectable?'Pendaftaran tersedia.':anyWindowOpen?'Pendaftaran dibuka, tetapi pilihan mode yang tersedia saat ini sudah penuh.':'Pendaftaran belum tersedia untuk mode Online maupun Offline.'
  };

  const publicEvent={
    registration_status:event.registration_status,
    registration_opens_at:event.registration_opens_at,
    registration_closes_at:event.registration_closes_at,
    maintenance_until:event.maintenance_until,
    maintenance_message:event.maintenance_message,
    online_registration_opens_at:event.online_registration_opens_at,
    online_registration_closes_at:event.online_registration_closes_at,
    offline_registration_opens_at:event.offline_registration_opens_at,
    offline_registration_closes_at:event.offline_registration_closes_at
  };

  return NextResponse.json({
    ...publicEvent,
    event:publicEvent,
    state,
    availability,
    modeAvailability
  },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
