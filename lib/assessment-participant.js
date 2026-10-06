import { NextResponse } from 'next/server';
import { requireUser } from './auth';
import { getSupabaseAdmin } from './supabase-admin';
import { logActivity } from './audit';
import {
  participantEligible,isTestRegistration,assessmentWindowState,inWindow,
  publicAttempt,bestAttempt,latestAttempt,attemptPassed,scoreSubmission,kindLabel,ASSESSMENT_KINDS
} from './assessment';

// v0.7.0 — handler peserta untuk Pretest, Posttest, dan Evaluasi.

const NO_STORE={headers:{'Cache-Control':'private, no-store'}};

async function load(db,email,kind){
  const {data:reg}=await db.from('registrations')
    .select('id,event_id,registration_code,full_name,email,attendance_mode,requirements_status,payment_status,lifecycle_status,is_test_account')
    .ilike('email',email).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(!reg)return {error:'Pendaftaran tidak ditemukan.'};
  const {data:module,error}=await db.from('assessment_modules').select('*').eq('event_id',reg.event_id).eq('kind',kind).maybeSingle();
  if(error)return {reg,error:`Migration ${kindLabel(kind)} belum dijalankan.`};
  if(!module)return {reg,error:`Modul ${kindLabel(kind)} belum dikonfigurasi.`};
  const {data:attempts}=await db.from('assessment_attempts').select('*')
    .eq('assessment_id',module.id).eq('registration_id',reg.id).eq('status','submitted')
    .order('attempt_no',{ascending:true});
  return {reg,module,attempts:attempts||[]};
}

async function attendanceRequirement(db,c){
  if(!c.module.requires_day_number)return {required:false,satisfied:true,day:null};
  const {data:day}=await db.from('event_days').select('id,day_number,title,event_date')
    .eq('event_id',c.reg.event_id).eq('day_number',c.module.requires_day_number).maybeSingle();
  if(!day)return {required:true,satisfied:false,day:null};
  const {data:record}=await db.from('attendance_records').select('id,occurred_at,channel')
    .eq('registration_id',c.reg.id).eq('event_day_id',day.id).maybeSingle();
  return {required:true,satisfied:!!record,day,record:record||null};
}

async function loadQuestions(db,moduleId,{withKey}){
  const {data:q,error}=await db.from('assessment_questions').select('*').eq('assessment_id',moduleId).order('position').order('id');
  if(error)throw new Error('Soal gagal dimuat.');
  const ids=(q||[]).map(x=>x.id);
  let opts=[];
  if(ids.length){
    const res=await db.from('assessment_options').select('*').in('question_id',ids).order('position').order('id');
    if(res.error)throw new Error('Pilihan jawaban gagal dimuat.');
    opts=res.data||[];
  }
  return (q||[]).map(item=>{
    const options=opts.filter(o=>o.question_id===item.id).map(o=>withKey?o:{id:o.id,question_id:o.question_id,position:o.position,option_text:o.option_text});
    if(withKey)return {...item,options};
    return {
      id:item.id,position:item.position,section:item.section||null,question_text:item.question_text,
      question_type:item.question_type,required:item.required,
      scale_min:item.scale_min??1,scale_max:item.scale_max??5,
      scale_min_label:item.scale_min_label||null,scale_max_label:item.scale_max_label||null,
      options
    };
  });
}

async function loadTargets(db,moduleId){
  const {data,error}=await db.from('assessment_targets').select('id,position,name,affiliation,topic,active')
    .eq('assessment_id',moduleId).eq('active',true).order('position').order('id');
  if(error)return [];
  return data||[];
}

function attemptLimitReached(module,used){
  const limit=module.max_attempts===null||module.max_attempts===undefined?null:Number(module.max_attempts);
  return limit!==null&&used>=limit;
}

export async function assessmentParticipantGet(request,kind){
  if(!ASSESSMENT_KINDS[kind])return NextResponse.json({message:'Modul tidak dikenal.'},{status:404});
  const auth=await requireUser(request);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  try{
    const db=getSupabaseAdmin(),c=await load(db,auth.user.email,kind);
    if(c.error&&!c.reg)return NextResponse.json({message:c.error},{status:404});
    if(c.error)return NextResponse.json({configured:false,kind,message:c.error},NO_STORE);

    const m=c.module,test=isTestRegistration(c.reg),eligible=participantEligible(c.reg);
    const attendance=await attendanceRequirement(db,c);
    const state=test?'open':assessmentWindowState(m);
    const windowOpen=test||(m.active&&inWindow(m.open_at,m.close_at));
    const {count}=await db.from('assessment_questions').select('id',{count:'exact',head:true}).eq('assessment_id',m.id);
    const used=c.attempts.length;
    const limit=m.max_attempts===null||m.max_attempts===undefined?null:Number(m.max_attempts);
    const limitReached=attemptLimitReached(m,used);
    const canStart=eligible&&attendance.satisfied&&Number(count||0)>0&&windowOpen&&!limitReached;

    const questions=canStart?await loadQuestions(db,m.id,{withKey:false}):[];
    const targets=canStart?await loadTargets(db,m.id):[];
    const showScore=!!m.show_score,pass=m.pass_percent===null||m.pass_percent===undefined?null:Number(m.pass_percent);
    const best=bestAttempt(c.attempts);

    // Isian (esai) otomatis terisi dari attempt terakhir agar peserta tidak mengetik ulang.
    let prefill={};
    const latest=latestAttempt(c.attempts);
    if(canStart&&latest){
      const {data:prev}=await db.from('assessment_answers').select('question_id,target_id,text_answer').eq('attempt_id',latest.id);
      for(const a of prev||[]){if(a.text_answer)prefill[a.target_id?`${a.question_id}::${a.target_id}`:a.question_id]=a.text_answer}
    }

    return NextResponse.json({
      configured:true,kind,testAccount:test,eligible,attendance,state,windowOpen,canStart,
      questionCount:Number(count||0),
      module:{id:m.id,kind:m.kind,title:m.title,description:m.description,active:m.active,open_at:m.open_at,close_at:m.close_at,show_score:showScore,requires_day_number:m.requires_day_number,max_attempts:limit,pass_percent:pass},
      attempt:publicAttempt(latest,showScore,pass),
      attempts:[...c.attempts].reverse().map(a=>publicAttempt(a,showScore,pass)),
      best:publicAttempt(best,showScore,pass),
      passed:showScore&&best?attemptPassed(best,pass):null,
      attemptsUsed:used,
      attemptsLeft:limit===null?null:Math.max(0,limit-used),
      questions,targets,prefill
    },NO_STORE);
  }catch(e){
    return NextResponse.json({message:e.message||`${kindLabel(kind)} gagal dimuat.`},{status:500});
  }
}

export async function assessmentParticipantPost(request,kind){
  if(!ASSESSMENT_KINDS[kind])return NextResponse.json({message:'Modul tidak dikenal.'},{status:404});
  const auth=await requireUser(request);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  const label=kindLabel(kind);
  try{
    const db=getSupabaseAdmin(),c=await load(db,auth.user.email,kind);
    if(c.error)return NextResponse.json({message:c.error},{status:404});
    const m=c.module,test=isTestRegistration(c.reg);
    if(!participantEligible(c.reg))return NextResponse.json({message:`Pendaftaran belum memenuhi syarat untuk ${label}.`},{status:409});
    const attendance=await attendanceRequirement(db,c);
    if(!attendance.satisfied)return NextResponse.json({message:`Lakukan presensi ${attendance.day?.title||`Hari ${m.requires_day_number}`} terlebih dahulu.`},{status:409});
    if(!test&&!m.active)return NextResponse.json({message:`${label} belum diaktifkan panitia.`},{status:409});
    if(!test&&!inWindow(m.open_at,m.close_at))return NextResponse.json({message:`Waktu ${label} belum dibuka atau sudah ditutup.`},{status:409});
    if(attemptLimitReached(m,c.attempts.length)){
      return NextResponse.json({message:Number(m.max_attempts)===1?`${label} sudah pernah dikirim dan tidak dapat diulang.`:`Batas pengerjaan ${label} sudah tercapai.`},{status:409});
    }

    const questions=await loadQuestions(db,m.id,{withKey:true});
    if(!questions.length)return NextResponse.json({message:`Soal ${label} belum tersedia.`},{status:409});
    const targets=await loadTargets(db,m.id);
    if(kind==='evaluation'&&!targets.length)return NextResponse.json({message:'Daftar pemateri belum tersedia.'},{status:409});

    const body=await request.json().catch(()=>({}));
    const result=scoreSubmission({questions,targets,answers:body.answers});
    if(result.error)return NextResponse.json({message:result.error},{status:422});

    const now=new Date().toISOString();
    let attempt=null,lastError=null;
    for(let tries=0;tries<3&&!attempt;tries++){
      const {data:last}=await db.from('assessment_attempts').select('attempt_no')
        .eq('assessment_id',m.id).eq('registration_id',c.reg.id)
        .order('attempt_no',{ascending:false}).limit(1).maybeSingle();
      const nextNo=Number(last?.attempt_no||0)+1;
      if(attemptLimitReached(m,nextNo-1))return NextResponse.json({message:`${label} sudah pernah dikirim.`},{status:409});
      const ins=await db.from('assessment_attempts').insert({
        assessment_id:m.id,registration_id:c.reg.id,attempt_no:nextNo,status:'submitted',
        started_at:now,submitted_at:now,score:result.score,max_score:result.maxScore,
        correct_count:result.correctCount,total_questions:result.totalQuestions
      }).select('*').single();
      if(!ins.error){attempt=ins.data;break}
      lastError=ins.error;
      if(String(ins.error.code)!=='23505')break;
    }
    if(!attempt){
      if(String(lastError?.code)==='23505')return NextResponse.json({message:`${label} sudah pernah dikirim.`},{status:409});
      return NextResponse.json({message:`Hasil ${label} gagal disimpan.`},{status:500});
    }

    const rows=result.rows.map(x=>({...x,attempt_id:attempt.id}));
    for(let i=0;i<rows.length;i+=500){
      const {error:answerError}=await db.from('assessment_answers').insert(rows.slice(i,i+500));
      if(answerError){
        await db.from('assessment_attempts').delete().eq('id',attempt.id);
        return NextResponse.json({message:`Jawaban ${label} gagal disimpan. Silakan kirim ulang.`},{status:500});
      }
    }

    const showScore=!!m.show_score,pass=m.pass_percent===null||m.pass_percent===undefined?null:Number(m.pass_percent);
    const best=bestAttempt([...c.attempts,attempt]);
    await logActivity({
      registrationId:c.reg.id,actorType:'participant',actorEmail:auth.user.email,action:`${kind}_submitted`,
      metadata:{assessment_id:m.id,attempt_no:attempt.attempt_no,test_account:test,score:result.score,max_score:result.maxScore,total_questions:result.totalQuestions}
    });
    return NextResponse.json({
      ok:true,
      attempt:publicAttempt(attempt,showScore,pass),
      best:publicAttempt(best,showScore,pass),
      passed:showScore?attemptPassed(best,pass):null
    });
  }catch(e){
    return NextResponse.json({message:e.message||`${label} gagal dikirim.`},{status:500});
  }
}
