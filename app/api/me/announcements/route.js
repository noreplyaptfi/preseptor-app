import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { announcementMatches } from '../../../../lib/announcement';

// v0.8.5 — skp_eligible dibaca untuk pengumuman khusus peserta SKP (tetap jalan bila migration 023 belum ada).
async function myRegistration(db,email){
  const fields='id,event_id,attendance_mode,overall_status';
  const q=cols=>db.from('registrations').select(cols).ilike('email',email).order('created_at',{ascending:false}).limit(1).maybeSingle();
  let r=await q(`${fields},skp_eligible`);
  if(r.error) r=await q(fields);
  return r.data||null;
}

export async function GET(request){
  const auth=await requireUser(request);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const reg=await myRegistration(db,auth.user.email);
  if(!reg) return NextResponse.json({announcements:[],unreadCount:0});
  const [{data:all},{data:reads}]=await Promise.all([
    db.from('announcements').select('*').eq('event_id',reg.event_id).order('published_at',{ascending:false}),
    db.from('announcement_reads').select('announcement_id,read_at').eq('registration_id',reg.id)
  ]);
  const readMap=new Map((reads||[]).map(x=>[x.announcement_id,x.read_at]));
  const announcements=(all||[]).filter(a=>announcementMatches(reg,a.audience)).map(a=>({...a,read_at:readMap.get(a.id)||null,is_read:readMap.has(a.id)}));
  return NextResponse.json({announcements,unreadCount:announcements.filter(a=>!a.is_read).length});
}

export async function POST(request){
  const auth=await requireUser(request);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const {announcementId}=await request.json();
  if(!announcementId) return NextResponse.json({message:'ID pengumuman wajib diisi.'},{status:422});
  const db=getSupabaseAdmin();
  const reg=await myRegistration(db,auth.user.email);
  const {data:a}=await db.from('announcements').select('*').eq('id',announcementId).maybeSingle();
  if(!reg||!a||a.event_id!==reg.event_id||!announcementMatches(reg,a.audience)) return NextResponse.json({message:'Pengumuman tidak ditemukan.'},{status:404});
  await db.from('announcement_reads').upsert({announcement_id:a.id,registration_id:reg.id,read_at:new Date().toISOString()},{onConflict:'announcement_id,registration_id'});
  return NextResponse.json({ok:true});
}
