import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { logActivity } from '../../../../lib/audit';
import { ACTIVE_REGISTRATION_STATUSES } from '../../../../lib/registration-lifecycle';

export const dynamic='force-dynamic';

function quotaNumber(value,label){
  const n=Number(value);
  if(!Number.isInteger(n)||n<1||n>5000)throw new Error(`${label} harus berupa angka bulat antara 1–5000.`);
  return n;
}

async function counts(db,eventId){
  const [total,online,offline]=await Promise.all([
    db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',eventId).in('lifecycle_status',ACTIVE_REGISTRATION_STATUSES),
    db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',eventId).in('lifecycle_status',ACTIVE_REGISTRATION_STATUSES).eq('attendance_mode','Online'),
    db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',eventId).in('lifecycle_status',ACTIVE_REGISTRATION_STATUSES).eq('attendance_mode','Offline')
  ]);
  return {total:Number(total.count||0),online:Number(online.count||0),offline:Number(offline.count||0)};
}

export async function PATCH(request){
  const auth=await requireAdmin(request,['super_admin','event_admin']);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const {data:event,error:eventError}=await db.from('events').select('id,quota_total,quota_online,quota_offline').eq('slug',process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026').single();
  if(eventError||!event)return NextResponse.json({message:'Event tidak ditemukan.'},{status:404});

  let quotaOnline,quotaOffline;
  try{
    const body=await request.json();
    quotaOnline=quotaNumber(body.quota_online,'Kuota Online');
    quotaOffline=quotaNumber(body.quota_offline,'Kuota Offline');
  }catch(e){
    return NextResponse.json({message:e.message||'Data kuota tidak valid.'},{status:422});
  }

  const active=await counts(db,event.id);
  if(quotaOnline<active.online)return NextResponse.json({message:`Kuota Online tidak boleh lebih kecil dari ${active.online} peserta aktif saat ini.`},{status:409});
  if(quotaOffline<active.offline)return NextResponse.json({message:`Kuota Offline tidak boleh lebih kecil dari ${active.offline} peserta aktif saat ini.`},{status:409});
  const quotaTotal=quotaOnline+quotaOffline;
  if(quotaTotal<active.total)return NextResponse.json({message:`Total kuota tidak boleh lebih kecil dari ${active.total} peserta aktif saat ini.`},{status:409});

  const {data:updated,error}=await db.from('events').update({quota_online:quotaOnline,quota_offline:quotaOffline,quota_total:quotaTotal}).eq('id',event.id).select('id,quota_total,quota_online,quota_offline').single();
  if(error){
    console.error('quota update:',error);
    return NextResponse.json({message:'Gagal memperbarui kuota event.'},{status:500});
  }

  await logActivity({actorType:'admin',actorEmail:auth.admin?.email||auth.user?.email,action:'event_quota_updated'});
  return NextResponse.json({ok:true,event:updated,counts:active});
}
