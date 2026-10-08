import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { participantEligible,isTestRegistration,inWindow,windowState } from '../../../../lib/day-h';
import { assessmentWindowState,attemptPercent } from '../../../../lib/assessment';
import { certificateChecklist,certificateStatus } from '../../../../lib/certificate';
import { assetVisibleFor } from '../../../../lib/event-assets';

// v0.7.3 — Ringkasan status peserta untuk penanda di menu (✓ selesai, • perlu tindakan, 🔒 belum dibuka).
// Hanya membaca; tidak mengubah data.
export const dynamic='force-dynamic';

export async function GET(request){
  const auth=await requireUser(request);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const {data:reg}=await db.from('registrations')
    .select('id,event_id,attendance_mode,requirements_status,payment_status,lifecycle_status,is_test_account')
    .ilike('email',auth.user.email).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(!reg)return NextResponse.json({message:'Pendaftaran tidak ditemukan.'},{status:404});

  const test=isTestRegistration(reg),eligible=participantEligible(reg);
  const [{data:event},{data:days},{data:records},{data:modules}]=await Promise.all([
    db.from('events').select('*').eq('id',reg.event_id).maybeSingle(),
    db.from('event_days').select('id,day_number,title,event_date,checkin_open_at,checkin_close_at,active').eq('event_id',reg.event_id).eq('active',true).order('day_number'),
    db.from('attendance_records').select('event_day_id').eq('registration_id',reg.id),
    db.from('assessment_modules').select('id,kind,active,open_at,close_at,requires_day_number,max_attempts,pass_percent').eq('event_id',reg.event_id)
  ]);
  const checked=new Set((records||[]).map(r=>r.event_day_id));
  const dayList=(days||[]).map(d=>({id:d.id,day_number:d.day_number,title:d.title,event_date:d.event_date,checked:checked.has(d.id),state:test?'open':windowState(d.checkin_open_at,d.checkin_close_at)}));

  let attempts=[];
  const moduleIds=(modules||[]).map(m=>m.id);
  if(moduleIds.length){
    const {data}=await db.from('assessment_attempts').select('assessment_id,score,max_score').eq('registration_id',reg.id).eq('status','submitted').in('assessment_id',moduleIds);
    attempts=data||[];
  }

  const assessments={};
  for(const m of modules||[]){
    const mine=attempts.filter(a=>a.assessment_id===m.id);
    const best=mine.reduce((top,a)=>{const p=attemptPercent(a);return p!==null&&(top===null||p>top)?p:top},null);
    const pass=m.pass_percent===null||m.pass_percent===undefined?null:Number(m.pass_percent);
    const reqDay=m.requires_day_number;
    const attendanceOk=!reqDay||dayList.some(d=>d.day_number===reqDay&&d.checked);
    const windowOpen=test||(m.active&&inWindow(m.open_at,m.close_at));
    const limitReached=m.max_attempts!==null&&m.max_attempts!==undefined&&mine.length>=Number(m.max_attempts);
    assessments[m.kind]={
      done:mine.length>0,
      attempts:mine.length,
      passed:pass===null||best===null?null:best>=pass,
      attendanceOk,
      canStart:eligible&&attendanceOk&&windowOpen&&!limitReached,
      state:test?'open':assessmentWindowState(m)
    };
  }

  // v0.8.0 — status sertifikat & jumlah aset untuk penanda menu.
  let certificate=null,assets={virtual_background:0,material:0,documentation:0};
  try{
    const byKind=Object.fromEntries((modules||[]).map(m=>[m.kind,m]));
    const grouped={};for(const a of attempts)(grouped[a.assessment_id]||=[]).push(a);
    const checklist=certificateChecklist({reg,days:days||[],checkedDayIds:checked,modules:{pretest:byKind.pretest||null,evaluation:byKind.evaluation||null,posttest:byKind.posttest||null},attempts:grouped});
    const {data:cert}=await db.from('certificates').select('issued_via,revoked_at,download_count').eq('registration_id',reg.id).maybeSingle();
    const status=certificateStatus({checklist,released:!!event?.certificate_enabled,cert});
    certificate={status,downloaded:(cert?.download_count||0)>0};
  }catch{}
  if(eligible){
    const {data:rows}=await db.from('event_assets').select('kind,audience,published').eq('event_id',reg.event_id).eq('published',true);
    for(const a of rows||[])if(assetVisibleFor(a,reg.attendance_mode))assets[a.kind]=(assets[a.kind]||0)+1;
  }

  return NextResponse.json({
    eligible,testAccount:test,certificate,assets,
    attendance:{enabled:!!event?.day_h_enabled||test,days:dayList},
    assessments
  },{headers:{'Cache-Control':'private, no-store'}});
}
