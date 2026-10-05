import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { participantEligible,isTestRegistration,assessmentWindowState,inWindow,publicAttempt } from '../../../../lib/assessment';
import { logActivity } from '../../../../lib/audit';
export const dynamic='force-dynamic';

async function load(db,email){
  const {data:reg}=await db.from('registrations').select('id,event_id,registration_code,full_name,email,attendance_mode,requirements_status,payment_status,lifecycle_status,is_test_account').ilike('email',email).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(!reg)return {error:'Pendaftaran tidak ditemukan.'};
  const {data:module,error}=await db.from('assessment_modules').select('*').eq('event_id',reg.event_id).eq('kind','pretest').maybeSingle();
  if(error)return {error:'Migration Pretest belum dijalankan.'};
  if(!module)return {reg,error:'Modul Pretest belum dikonfigurasi.'};
  const {data:attempt}=await db.from('assessment_attempts').select('*').eq('assessment_id',module.id).eq('registration_id',reg.id).eq('status','submitted').order('attempt_no',{ascending:false}).limit(1).maybeSingle();
  return {reg,module,attempt};
}

async function attendanceRequirement(db,c){
  if(!c.module.requires_day_number)return {required:false,satisfied:true,day:null};
  const {data:day}=await db.from('event_days').select('id,day_number,title,event_date').eq('event_id',c.reg.event_id).eq('day_number',c.module.requires_day_number).maybeSingle();
  if(!day)return {required:true,satisfied:false,day:null};
  const {data:record}=await db.from('attendance_records').select('id,occurred_at,channel').eq('registration_id',c.reg.id).eq('event_day_id',day.id).maybeSingle();
  return {required:true,satisfied:!!record,day,record:record||null};
}

async function publicQuestions(db,moduleId){
  const {data:q}=await db.from('assessment_questions').select('id,position,question_text,question_type,required,points').eq('assessment_id',moduleId).order('position').order('id');
  const ids=(q||[]).map(x=>x.id);
  let opts=[];
  if(ids.length){const res=await db.from('assessment_options').select('id,question_id,position,option_text').in('question_id',ids).order('position').order('id');opts=res.data||[]}
  return (q||[]).map(item=>({...item,options:opts.filter(o=>o.question_id===item.id)}));
}

async function scoringQuestions(db,moduleId){
  const {data:q,error}=await db.from('assessment_questions').select('*').eq('assessment_id',moduleId).order('position').order('id');
  if(error)throw new Error('Soal Pretest gagal dimuat.');
  const ids=(q||[]).map(x=>x.id);let opts=[];
  if(ids.length){const res=await db.from('assessment_options').select('*').in('question_id',ids).order('position').order('id');if(res.error)throw new Error('Pilihan jawaban gagal dimuat.');opts=res.data||[]}
  return (q||[]).map(item=>({...item,options:opts.filter(o=>o.question_id===item.id)}));
}

export async function GET(request){
  const auth=await requireUser(request);if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin(),c=await load(db,auth.user.email);
  if(c.error&&!c.reg)return NextResponse.json({message:c.error},{status:404});
  if(c.error)return NextResponse.json({configured:false,message:c.error},{headers:{'Cache-Control':'private, no-store'}});
  const test=isTestRegistration(c.reg),eligible=participantEligible(c.reg),attendance=await attendanceRequirement(db,c);
  const state=test?'open':assessmentWindowState(c.module);
  const submitted=!!c.attempt;
  const {count}=await db.from('assessment_questions').select('id',{count:'exact',head:true}).eq('assessment_id',c.module.id);
  const canStart=!submitted&&eligible&&attendance.satisfied&&Number(count||0)>0&&(test||(c.module.active&&inWindow(c.module.open_at,c.module.close_at)));
  const qs=canStart?await publicQuestions(db,c.module.id):[];
  return NextResponse.json({
    configured:true,testAccount:test,eligible,attendance,state,canStart,questionCount:Number(count||0),
    module:{id:c.module.id,title:c.module.title,description:c.module.description,active:c.module.active,open_at:c.module.open_at,close_at:c.module.close_at,show_score:c.module.show_score,requires_day_number:c.module.requires_day_number},
    attempt:publicAttempt(c.attempt,c.module.show_score),questions:qs
  },{headers:{'Cache-Control':'private, no-store'}});
}

export async function POST(request){
  const auth=await requireUser(request);if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin(),c=await load(db,auth.user.email);
  if(c.error)return NextResponse.json({message:c.error},{status:404});
  const test=isTestRegistration(c.reg);
  if(c.attempt)return NextResponse.json({message:'Pretest sudah pernah dikirim dan tidak dapat diulang.'},{status:409});
  if(!participantEligible(c.reg))return NextResponse.json({message:'Pendaftaran belum memenuhi syarat untuk Pretest.'},{status:409});
  const attendance=await attendanceRequirement(db,c);
  if(!attendance.satisfied)return NextResponse.json({message:`Lakukan presensi ${attendance.day?.title||`Hari ${c.module.requires_day_number}`} terlebih dahulu.`},{status:409});
  if(!test&&!c.module.active)return NextResponse.json({message:'Pretest belum diaktifkan panitia.'},{status:409});
  if(!test&&!inWindow(c.module.open_at,c.module.close_at))return NextResponse.json({message:'Waktu Pretest belum dibuka atau sudah ditutup.'},{status:409});
  const qs=await scoringQuestions(db,c.module.id);
  if(!qs.length)return NextResponse.json({message:'Soal Pretest belum tersedia.'},{status:409});
  const body=await request.json().catch(()=>({})),answers=body.answers&&typeof body.answers==='object'?body.answers:{};
  const answerRows=[];let score=0,maxScore=0,correctCount=0;
  for(const q of qs){
    const points=Number(q.points||0);maxScore+=points;
    const selectedId=String(answers[q.id]||'');
    if(q.required&&!selectedId)return NextResponse.json({message:`Soal nomor ${q.position} belum dijawab.`},{status:422});
    const option=q.options.find(o=>o.id===selectedId);
    if(selectedId&&!option)return NextResponse.json({message:`Jawaban soal nomor ${q.position} tidak valid.`},{status:422});
    const correct=!!option?.is_correct,awarded=correct?points:0;
    if(correct){score+=awarded;correctCount++}
    answerRows.push({question_id:q.id,selected_option_id:option?.id||null,is_correct:correct,points_awarded:awarded});
  }
  const now=new Date().toISOString();
  const {data:attempt,error}=await db.from('assessment_attempts').insert({assessment_id:c.module.id,registration_id:c.reg.id,attempt_no:1,status:'submitted',started_at:now,submitted_at:now,score,max_score:maxScore,correct_count:correctCount,total_questions:qs.length}).select('*').single();
  if(error){
    if(String(error.code)==='23505')return NextResponse.json({message:'Pretest sudah pernah dikirim.'},{status:409});
    return NextResponse.json({message:'Hasil Pretest gagal disimpan.'},{status:500});
  }
  const {error:answerError}=await db.from('assessment_answers').insert(answerRows.map(x=>({...x,attempt_id:attempt.id})));
  if(answerError){await db.from('assessment_attempts').delete().eq('id',attempt.id);return NextResponse.json({message:'Jawaban Pretest gagal disimpan.'},{status:500})}
  await logActivity({registrationId:c.reg.id,actorType:'participant',actorEmail:auth.user.email,action:'pretest_submitted',metadata:{assessment_id:c.module.id,test_account:test,score,max_score:maxScore,total_questions:qs.length}});
  return NextResponse.json({ok:true,attempt:publicAttempt(attempt,c.module.show_score)});
}
