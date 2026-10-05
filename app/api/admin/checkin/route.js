import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { inWindow,participantEligible,isTestRegistration,jakartaDateKey } from '../../../../lib/day-h';
import { logActivity } from '../../../../lib/audit';

export const dynamic='force-dynamic';

// v0.6.1: scan QR presensi Offline dapat dilakukan oleh SEMUA akun panitia aktif
// (super_admin, event_admin, document_verifier, payment_verifier, viewer).
// Check-in manual, pembatalan, dan Command Center tetap khusus Super Admin.

async function findReg(db,token){
  if(!token)return null;
  const {data}=await db.from('registrations')
    .select('id,event_id,registration_code,full_name,email,university,attendance_mode,requirements_status,payment_status,lifecycle_status,is_test_account,checkin_token')
    .eq('checkin_token',token)
    .maybeSingle();
  return data||null;
}

async function pickDay(db,eventId,dayId,test){
  const {data:event}=await db.from('events').select('day_h_enabled').eq('id',eventId).single();
  if(!event?.day_h_enabled&&!test)return {day:null,reason:'day_h_disabled'};
  let q=db.from('event_days').select('*').eq('event_id',eventId).eq('active',true);
  if(dayId)q=q.eq('id',dayId);else q=q.eq('event_date',jakartaDateKey());
  const {data}=await q.limit(1).maybeSingle();
  return data?{day:data,reason:null}:{day:null,reason:'no_day'};
}

async function findRecord(db,regId,dayId){
  const {data}=await db.from('attendance_records')
    .select('*')
    .eq('registration_id',regId)
    .eq('event_day_id',dayId)
    .eq('attendance_type','checkin')
    .maybeSingle();
  return data||null;
}

function payload(reg,day,record){
  return {
    registrationCode:reg.registration_code,
    fullName:reg.full_name,
    email:reg.email,
    university:reg.university,
    attendanceMode:reg.attendance_mode,
    valid:participantEligible(reg),
    testAccount:isTestRegistration(reg),
    checkedInAt:record?.occurred_at||null,
    checkedInBy:record?.operator_email||null,
    checkinChannel:record?.channel||null,
    day:day?{id:day.id,title:day.title,eventDate:day.event_date}:null
  };
}

// Alasan tunggal kenapa peserta tidak bisa di-check-in sekarang (null = bisa).
function blockReason({reg,day,dayReason,record,test}){
  if(record)return null;
  if(reg.attendance_mode!=='Offline')return 'not_offline';
  if(!participantEligible(reg))return 'not_eligible';
  if(!day)return dayReason||'no_day';
  if(!test&&!inWindow(day.checkin_open_at,day.checkin_close_at))return 'outside_window';
  return null;
}

const MESSAGES={
  not_offline:'QR ini bukan untuk peserta Offline. Peserta Online melakukan presensi mandiri dari dashboard.',
  not_eligible:'Peserta belum memenuhi syarat presensi (persyaratan harus valid dan pembayaran terverifikasi).',
  day_h_disabled:'Presensi Hari-H belum diaktifkan oleh Super Admin.',
  no_day:'Tidak ada jadwal presensi aktif untuk QR/hari ini.',
  outside_window:'Di luar jam presensi. Hubungi Super Admin untuk perpanjangan waktu atau check-in manual.'
};

async function context(db,token,dayId){
  const reg=await findReg(db,token);
  if(!reg)return {error:NextResponse.json({message:'QR tidak valid atau peserta tidak ditemukan.'},{status:404})};
  const test=isTestRegistration(reg);
  const {day,reason:dayReason}=await pickDay(db,reg.event_id,dayId,test);
  const record=day?await findRecord(db,reg.id,day.id):null;
  return {reg,test,day,dayReason,record};
}

export async function GET(request){
  const auth=await requireAdmin(request);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  const u=new URL(request.url);
  const token=String(u.searchParams.get('token')||'').trim();
  const dayId=String(u.searchParams.get('dayId')||'').trim();
  const db=getSupabaseAdmin();
  const c=await context(db,token,dayId);
  if(c.error)return c.error;
  const reason=blockReason(c);
  return NextResponse.json({
    registration:payload(c.reg,c.day,c.record),
    dayHActive:!!c.day,
    windowOpen:!!c.day&&(c.test||inWindow(c.day.checkin_open_at,c.day.checkin_close_at)),
    canCheckIn:!c.record&&!reason,
    blockReason:reason,
    blockMessage:reason?MESSAGES[reason]:null,
    operator:{email:auth.user.email,role:auth.adminUser?.role||null}
  },{headers:{'Cache-Control':'private, no-store'}});
}

export async function POST(request){
  const auth=await requireAdmin(request);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  const b=await request.json().catch(()=>({}));
  const token=String(b.token||'').trim();
  const dayId=String(b.dayId||'').trim();
  const db=getSupabaseAdmin();
  const c=await context(db,token,dayId);
  if(c.error)return c.error;
  if(c.record)return NextResponse.json({ok:true,already:true,registration:payload(c.reg,c.day,c.record)});
  const reason=blockReason(c);
  if(reason)return NextResponse.json({message:MESSAGES[reason]},{status:409});

  const now=new Date().toISOString();
  const {data,error}=await db.from('attendance_records').insert({
    registration_id:c.reg.id,
    event_day_id:c.day.id,
    attendance_type:'checkin',
    channel:'offline_qr',
    occurred_at:now,
    operator_email:auth.user.email,
    notes:c.test?'Akun uji / dummy':null
  }).select('*').single();

  if(error){
    // Dua panitia memindai QR yang sama hampir bersamaan: baris pertama menang,
    // yang kedua cukup diberi tahu bahwa presensi sudah tercatat.
    if(String(error.code)==='23505'){
      const existing=await findRecord(db,c.reg.id,c.day.id);
      if(existing)return NextResponse.json({ok:true,already:true,registration:payload(c.reg,c.day,existing)});
    }
    return NextResponse.json({message:'Gagal menyimpan presensi. Coba scan ulang.'},{status:500});
  }

  await logActivity({
    registrationId:c.reg.id,
    actorType:'admin',
    actorEmail:auth.user.email,
    action:'day_h_offline_checkin',
    metadata:{event_day_id:c.day.id,test_account:c.test,operator_role:auth.adminUser?.role||null}
  });
  return NextResponse.json({ok:true,registration:payload(c.reg,c.day,data)});
}
