import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { verifiedRegistration } from '../../../../lib/event-access';
import { logActivity } from '../../../../lib/audit';

function payload(reg){
  const valid=reg.attendance_mode==='Offline'&&verifiedRegistration(reg);
  return {
    id:reg.id,
    registrationCode:reg.registration_code,
    fullName:reg.full_name,
    email:reg.email,
    university:reg.university,
    attendanceMode:reg.attendance_mode,
    requirementsStatus:reg.requirements_status,
    paymentStatus:reg.payment_status,
    overallStatus:reg.overall_status,
    valid,
    checkedInAt:reg.checked_in_at||null,
    checkedInBy:reg.checked_in_by||null
  };
}

async function find(db,token){
  if(!token) return null;
  const {data}=await db.from('registrations').select('id,registration_code,full_name,email,university,attendance_mode,requirements_status,payment_status,overall_status,checked_in_at,checked_in_by,checkin_token').eq('checkin_token',token).maybeSingle();
  return data||null;
}

export async function GET(request){
  const auth=await requireAdmin(request);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const token=new URL(request.url).searchParams.get('token')||'';
  const db=getSupabaseAdmin();
  const reg=await find(db,token);
  if(!reg) return NextResponse.json({message:'QR check-in tidak valid atau peserta tidak ditemukan.'},{status:404});
  return NextResponse.json({registration:payload(reg),canCheckIn:['super_admin','event_admin'].includes(auth.adminUser.role)});
}

export async function POST(request){
  const auth=await requireAdmin(request,['super_admin','event_admin']);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const body=await request.json().catch(()=>({}));
  const token=String(body.token||'').trim();
  const db=getSupabaseAdmin();
  const reg=await find(db,token);
  if(!reg) return NextResponse.json({message:'QR check-in tidak valid atau peserta tidak ditemukan.'},{status:404});
  if(reg.attendance_mode!=='Offline') return NextResponse.json({message:'QR ini bukan untuk peserta Offline.'},{status:409});
  if(!verifiedRegistration(reg)) return NextResponse.json({message:'Peserta belum terverifikasi lengkap dan tidak dapat check-in.'},{status:409});
  if(reg.checked_in_at) return NextResponse.json({ok:true,alreadyCheckedIn:true,registration:payload(reg)});
  const now=new Date().toISOString();
  const {data:updated,error}=await db.from('registrations').update({checked_in_at:now,checked_in_by:auth.user.email,updated_at:now}).eq('id',reg.id).is('checked_in_at',null).select('id,registration_code,full_name,email,university,attendance_mode,requirements_status,payment_status,overall_status,checked_in_at,checked_in_by').maybeSingle();
  if(error) return NextResponse.json({message:'Gagal menyimpan check-in.'},{status:500});
  const finalReg=updated||await find(db,token);
  await logActivity({registrationId:reg.id,actorType:'admin',actorEmail:auth.user.email,action:'participant_checked_in',metadata:{registration_code:reg.registration_code}});
  return NextResponse.json({ok:true,alreadyCheckedIn:!updated,registration:payload(finalReg)});
}
