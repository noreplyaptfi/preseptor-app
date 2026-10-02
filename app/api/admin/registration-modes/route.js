import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { logActivity } from '../../../../lib/audit';
import { resolveAllModeRegistrationWindows } from '../../../../lib/registration-mode-window';

export const dynamic='force-dynamic';

function parseJakartaLocal(value,label){
  const raw=String(value||'').trim();
  if(!raw)return null;
  const iso=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(raw)?`${raw.length===16?raw+':00':raw}+07:00`:raw;
  const d=new Date(iso);
  if(Number.isNaN(d.getTime()))throw new Error(`${label} tidak valid.`);
  return d.toISOString();
}

function validateRange(openAt,closeAt,label){
  if(openAt&&closeAt&&new Date(closeAt)<=new Date(openAt))throw new Error(`Waktu tutup ${label} harus setelah waktu buka.`);
}

async function eventRow(db){
  return db.from('events').select('id,registration_status,registration_opens_at,registration_closes_at,maintenance_until,maintenance_message,online_registration_opens_at,online_registration_closes_at,offline_registration_opens_at,offline_registration_closes_at').eq('slug',process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026').single();
}

export async function GET(request){
  const auth=await requireAdmin(request,['super_admin','event_admin']);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const {data:event,error}=await eventRow(db);
  if(error||!event)return NextResponse.json({message:'Event tidak ditemukan.'},{status:404});
  return NextResponse.json({event,states:resolveAllModeRegistrationWindows(event),serverNow:new Date().toISOString()},{headers:{'Cache-Control':'no-store, max-age=0'}});
}

export async function PATCH(request){
  const auth=await requireAdmin(request,['super_admin','event_admin']);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const {data:event,error:eventError}=await eventRow(db);
  if(eventError||!event)return NextResponse.json({message:'Event tidak ditemukan.'},{status:404});

  let update;
  try{
    const body=await request.json();
    update={
      online_registration_opens_at:parseJakartaLocal(body.online_registration_opens_at,'Waktu buka Online'),
      online_registration_closes_at:parseJakartaLocal(body.online_registration_closes_at,'Waktu tutup Online'),
      offline_registration_opens_at:parseJakartaLocal(body.offline_registration_opens_at,'Waktu buka Offline'),
      offline_registration_closes_at:parseJakartaLocal(body.offline_registration_closes_at,'Waktu tutup Offline')
    };
    validateRange(update.online_registration_opens_at,update.online_registration_closes_at,'Online');
    validateRange(update.offline_registration_opens_at,update.offline_registration_closes_at,'Offline');
  }catch(e){
    return NextResponse.json({message:e.message||'Jadwal mode tidak valid.'},{status:422});
  }

  const {data:updated,error}=await db.from('events').update(update).eq('id',event.id).select('id,registration_status,registration_opens_at,registration_closes_at,maintenance_until,maintenance_message,online_registration_opens_at,online_registration_closes_at,offline_registration_opens_at,offline_registration_closes_at').single();
  if(error){console.error('registration modes update:',error);return NextResponse.json({message:'Gagal menyimpan jadwal pendaftaran per mode.'},{status:500})}

  await logActivity({actorType:'admin',actorEmail:auth.admin?.email||auth.user?.email,action:'registration_mode_windows_updated'});
  return NextResponse.json({ok:true,event:updated,states:resolveAllModeRegistrationWindows(updated)});
}
