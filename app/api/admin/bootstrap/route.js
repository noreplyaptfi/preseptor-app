import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { normalizeName,normalizeInstitution } from '../../../../lib/normalization';

function latestDocuments(list=[]){const out={};for(const doc of list){if(!out[doc.document_type])out[doc.document_type]=doc}return out}
// v0.7.3 — jumlah antrean untuk badge menu admin (hanya hitungan, tanpa data pribadi).
async function queueCounts(db,eventId,role){
  const canRequests=['super_admin','event_admin'].includes(role);
  const canRefunds=['super_admin','event_admin','payment_verifier'].includes(role);
  const [requestCount,refundCount]=await Promise.all([
    canRequests?db.from('self_service_requests').select('id',{count:'exact',head:true}).eq('event_id',eventId).eq('status','pending'):Promise.resolve({count:0}),
    canRefunds?db.from('refund_requests').select('id',{count:'exact',head:true}).eq('event_id',eventId).in('status',['requested','under_review']):Promise.resolve({count:0})
  ]);
  return {requests:Number(requestCount?.count||0),refunds:Number(refundCount?.count||0)};
}

export async function GET(request){
  const auth=await requireAdmin(request);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const slug=process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026';
  const {data:event,error:eventError}=await db.from('events').select('*').eq('slug',slug).single();
  if(eventError||!event) return NextResponse.json({message:'Event tidak ditemukan.'},{status:404});
  if(new URL(request.url).searchParams.get('counts')==='1')return NextResponse.json({navCounts:await queueCounts(db,event.id,auth.adminUser.role)},{headers:{'Cache-Control':'private, no-store'}});
  const [registrationsResult,announcementsResult,teamResult]=await Promise.all([
    db.from('registrations').select('*,registration_documents(*)').eq('event_id',event.id).order('created_at',{ascending:false}).order('created_at',{referencedTable:'registration_documents',ascending:false}),
    db.from('announcements').select('*').eq('event_id',event.id).order('published_at',{ascending:false}),
    auth.adminUser.role==='super_admin'?db.from('admin_users').select('*').order('created_at',{ascending:true}):Promise.resolve({data:[]})
  ]);
  if(registrationsResult.error) return NextResponse.json({message:'Gagal membaca data pendaftar.'},{status:500});
  const data=registrationsResult.data||[];
  const softKeys=new Map();
  for(const r of data){const key=`${normalizeName(r.full_name)}|${normalizeInstitution(r.university)}`;if(key!=='|')softKeys.set(key,(softKeys.get(key)||0)+1)}
  const registrations=data.map(r=>{const documents=latestDocuments(r.registration_documents||[]);const key=`${normalizeName(r.full_name)}|${normalizeInstitution(r.university)}`;return {...r,registration_documents:undefined,documents,document_types:Object.keys(documents),possible_duplicate:(softKeys.get(key)||0)>1}});
  const navCounts=await queueCounts(db,event.id,auth.adminUser.role);
  const offlineVerified=registrations.filter(x=>x.attendance_mode==='Offline'&&x.overall_status==='verified').length;
  const checkedIn=registrations.filter(x=>x.attendance_mode==='Offline'&&x.checked_in_at).length;
  const onlineVerified=registrations.filter(x=>x.attendance_mode==='Online'&&x.overall_status==='verified').length;
  return NextResponse.json({
    adminUser:auth.adminUser,registrations,event,announcements:announcementsResult.data||[],team:teamResult.data||[],navCounts,
    eventAccess:{event,stats:{offlineVerified,checkedIn,onlineVerified}}
  },{headers:{'Cache-Control':'private, no-store'}});
}
