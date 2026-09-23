import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { resolveEventState } from '../../../../lib/event-state';

export async function GET(){
  const db=getSupabaseAdmin();
  const slug=process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026';
  const {data,error}=await db.from('events').select('id,slug,title,event_start,event_end,registration_status,registration_opens_at,registration_closes_at,maintenance_until,maintenance_message,not_open_message,closed_message,registration_fee,quota_total,quota_online,quota_offline').eq('slug',slug).single();
  if(error) return NextResponse.json({message:'Event tidak ditemukan.'},{status:404});
  const [{count:total},{count:online},{count:offline}]=await Promise.all([
    db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',data.id),
    db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',data.id).eq('attendance_mode','Online'),
    db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',data.id).eq('attendance_mode','Offline')
  ]).catch(()=>[{count:0},{count:0},{count:0}]);
  const totalOpen=Number(total||0)<Number(data.quota_total||200);
  const availability={
    Online:totalOpen&&Number(online||0)<Number(data.quota_online||150),
    Offline:totalOpen&&Number(offline||0)<Number(data.quota_offline||50)
  };
  const {quota_total,quota_online,quota_offline,...publicEvent}=data;
  return NextResponse.json({event:publicEvent,state:resolveEventState(data),availability},{headers:{'Cache-Control':'private, max-age=15, stale-while-revalidate=30'}});
}
