import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { resolveEventState } from '../../../../lib/event-state';

export const dynamic='force-dynamic';

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
  const totalAvailable=quotaTotal<=0||countTotal<quotaTotal;
  const state=resolveEventState(event);
  const availability={
    Online:totalAvailable&&(quotaOnline<=0||countOnline<quotaOnline),
    Offline:totalAvailable&&(quotaOffline<=0||countOffline<quotaOffline)
  };

  const publicEvent={
    registration_status:event.registration_status,
    registration_opens_at:event.registration_opens_at,
    registration_closes_at:event.registration_closes_at,
    maintenance_until:event.maintenance_until,
    maintenance_message:event.maintenance_message
  };

  return NextResponse.json({
    ...publicEvent,
    event:publicEvent,
    state,
    availability
  },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
