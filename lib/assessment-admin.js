import { NextResponse } from 'next/server';
import { requireAdmin } from './auth';
import { getSupabaseAdmin } from './supabase-admin';
import { logActivity } from './audit';
import {
  participantEligible,isTestRegistration,bestAttempt,latestAttempt,attemptPercent,attemptPassed,
  isScoredQuestion,summarizeEvaluation,kindLabel,ASSESSMENT_KINDS,QUESTION_TYPES
} from './assessment';
import { standardBank } from './assessment-banks';

// v0.7.0 — handler admin (Super Admin) untuk Pretest, Posttest, dan Evaluasi.

const NO_STORE={headers:{'Cache-Control':'private, no-store'}};
const PAGE=1000;

function parseWib(v){
  const s=String(v||'').trim();
  if(!s)return null;
  const d=new Date(/([zZ]|[+-]\d{2}:?\d{2})$/.test(s)?s:`${s.length===16?s+':00':s}+07:00`);
  return Number.isNaN(d.getTime())?null:d;
}

function fail(message,status=500){return NextResponse.json({message},{status})}

// Supabase membatasi 1000 baris per request; ambil semua halaman.
export async function fetchAll(makeQuery){
  const out=[];
  for(let from=0;;from+=PAGE){
    const {data,error}=await makeQuery().range(from,from+PAGE-1);
    if(error)throw new Error(error.message||'Gagal memuat data.');
    out.push(...(data||[]));
    if(!data||data.length<PAGE)break;
  }
  return out;
}

async function context(db,kind){
  const slug=process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026';
  const {data:event}=await db.from('events').select('id,slug,title').eq('slug',slug).single();
  if(!event)return {error:'Event tidak ditemukan.'};
  const {data:module,error}=await db.from('assessment_modules').select('*').eq('event_id',event.id).eq('kind',kind).maybeSingle();
  if(error)return {error:`Migration ${kindLabel(kind)} belum dijalankan.`};
  if(!module)return {error:`Modul ${kindLabel(kind)} belum tersedia. Jalankan migration 019.`};
  return {event,module};
}

async function loadQuestions(db,moduleId){
  const {data:q,error}=await db.from('assessment_questions').select('*').eq('assessment_id',moduleId).order('position').order('id');
  if(error)throw new Error('Gagal memuat soal.');
  const ids=(q||[]).map(x=>x.id);
  let options=[];
  if(ids.length){
    const res=await db.from('assessment_options').select('*').in('question_id',ids).order('position').order('id');
    if(res.error)throw new Error('Gagal memuat pilihan jawaban.');
    options=res.data||[];
  }
  return (q||[]).map(item=>({...item,options:options.filter(o=>o.question_id===item.id)}));
}

async function loadTargets(db,moduleId){
  const {data,error}=await db.from('assessment_targets').select('*').eq('assessment_id',moduleId).order('position').order('id');
  if(error)return [];
  return data||[];
}

async function hasAttempts(db,moduleId){
  const {count}=await db.from('assessment_attempts').select('id',{count:'exact',head:true}).eq('assessment_id',moduleId);
  return Number(count||0)>0;
}

async function answersFor(db,attemptIds){
  const out=[];
  for(let i=0;i<attemptIds.length;i+=25){
    const chunk=attemptIds.slice(i,i+25);
    const rows=await fetchAll(()=>db.from('assessment_answers')
      .select('id,attempt_id,question_id,target_id,selected_option_id,text_answer,likert_value,is_correct,points_awarded')
      .in('attempt_id',chunk).order('id'));
    out.push(...rows);
  }
  return out;
}

function summarizeAttempt(a){
  if(!a)return null;
  const p=attemptPercent(a);
  return {id:a.id,attempt_no:a.attempt_no,submitted_at:a.submitted_at,score:Number(a.score||0),max_score:Number(a.max_score||0),percent:p===null?null:Math.round(p),correct_count:a.correct_count,total_questions:a.total_questions};
}

async function buildResults(db,c){
  const m=c.module;
  const pass=m.pass_percent===null||m.pass_percent===undefined?null:Number(m.pass_percent);
  const [regs,attempts]=await Promise.all([
    fetchAll(()=>db.from('registrations')
      .select('id,registration_code,full_name,email,university,attendance_mode,practice_name,practice_years,teaching_years,requirements_status,payment_status,lifecycle_status,is_test_account')
      .eq('event_id',c.event.id).order('full_name').order('id')),
    fetchAll(()=>db.from('assessment_attempts').select('*').eq('assessment_id',m.id).eq('status','submitted').order('submitted_at').order('id'))
  ]);
  const byReg=new Map();
  for(const a of attempts){if(!byReg.has(a.registration_id))byReg.set(a.registration_id,[]);byReg.get(a.registration_id).push(a)}
  const results=regs.filter(participantEligible).map(r=>{
    const list=byReg.get(r.id)||[];
    const best=bestAttempt(list),latest=latestAttempt(list);
    return {
      id:r.id,registration_code:r.registration_code,full_name:r.full_name,email:r.email,university:r.university,
      attendance_mode:r.attendance_mode,practice_name:r.practice_name,practice_years:r.practice_years,teaching_years:r.teaching_years,
      test:isTestRegistration(r),attemptsCount:list.length,
      best:summarizeAttempt(best),latest:summarizeAttempt(latest),
      passed:best?attemptPassed(best,pass):null,
      _attempts:list
    };
  });
  return {results,attempts,pass};
}

function stripPrivate(results){return results.map(({_attempts,...r})=>r)}

function statsOf(results,scored,pass){
  const official=results.filter(r=>!r.test),tests=results.filter(r=>r.test);
  const submitted=official.filter(r=>r.attemptsCount>0);
  const percents=submitted.map(r=>r.best?.percent).filter(v=>v!==null&&v!==undefined);
  return {
    eligible:official.length,
    submitted:submitted.length,
    pending:Math.max(0,official.length-submitted.length),
    averagePercent:scored&&percents.length?Math.round(percents.reduce((s,v)=>s+v,0)/percents.length):null,
    passed:pass===null?null:submitted.filter(r=>r.passed).length,
    totalAttempts:official.reduce((s,r)=>s+r.attemptsCount,0),
    testAccounts:tests.length,
    testSubmitted:tests.filter(r=>r.attemptsCount>0).length
  };
}

function cut(text,n=70){const s=String(text||'').replace(/\s+/g,' ').trim();return s.length>n?`${s.slice(0,n-1)}…`:s}
function fmtWib(v){
  if(!v)return '';
  try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v))}catch{return String(v)}
}

async function exportResults(db,c,questions,targets){
  const kind=c.module.kind;
  const {results,pass}=await buildResults(db,c);
  const official=results.filter(r=>!r.test);
  const scored=questions.some(isScoredQuestion);
  const multi=c.module.max_attempts===null||Number(c.module.max_attempts)>1;

  if(kind==='evaluation'){
    const submitted=official.filter(r=>r.latest);
    const answers=await answersFor(db,submitted.map(r=>r.latest.id));
    const likert=questions.filter(q=>q.question_type==='likert');
    const texts=questions.filter(q=>q.question_type==='text');
    const columns=[
      {header:'No. Pendaftaran',width:18},{header:'Nama',width:34},{header:'Mode',width:10},
      {header:'Pemateri',width:36},{header:'Instansi',width:30},
      ...likert.map((q,i)=>({header:`P${i+1}. ${cut(q.question_text,50)}`,width:16})),
      ...texts.map(q=>({header:cut(q.question_text,40),width:48})),
      {header:'Dikirim',width:20}
    ];
    const rows=[];
    for(const r of submitted){
      for(const t of targets){
        const mine=answers.filter(a=>a.attempt_id===r.latest.id&&a.target_id===t.id);
        if(!mine.length)continue;
        rows.push([
          r.registration_code||'',r.full_name||'',r.attendance_mode||'',t.name||'',t.affiliation||'',
          ...likert.map(q=>{const a=mine.find(x=>x.question_id===q.id);return a?.likert_value??''}),
          ...texts.map(q=>{const a=mine.find(x=>x.question_id===q.id);return a?.text_answer||''}),
          fmtWib(r.latest.submitted_at)
        ]);
      }
    }
    return {filename:'evaluasi-pemateri-preseptor-2026.xlsx',sheet:'Evaluasi',columns,rows};
  }

  // Pretest / Posttest: satu baris per peserta.
  // Pilihan ganda diambil dari attempt terbaik; isian dari attempt terakhir.
  const ids=new Set();
  for(const r of official){if(r.best)ids.add(r.best.id);if(r.latest)ids.add(r.latest.id)}
  const answers=await answersFor(db,[...ids]);
  const optionText=new Map();
  for(const q of questions)for(const o of q.options||[])optionText.set(o.id,o.option_text);
  const columns=[
    {header:'No',width:6},{header:'No. Pendaftaran',width:18},{header:'Nama',width:34},{header:'Email',width:30},
    {header:'Mode',width:10},{header:'Homebase',width:30},{header:'Tempat Praktik',width:30},
    {header:'Lama Praktik (thn)',width:12},{header:'Lama Membimbing (thn)',width:12},
    {header:'Status',width:12},
    ...(multi?[{header:'Jumlah Attempt',width:10}]:[]),
    ...(scored?[{header:multi?'Skor Terbaik':'Skor',width:10},{header:'Maks',width:8},{header:multi?'Nilai Terbaik (%)':'Nilai (%)',width:12}]:[]),
    ...(pass!==null?[{header:`Lulus (≥ ${pass})`,width:12}]:[]),
    {header:multi?'Waktu Nilai Terbaik':'Dikirim',width:20},
    ...questions.map((q,i)=>({header:`${i+1}. ${cut(q.question_text)}`,width:q.question_type==='text'?48:14}))
  ];
  const rows=official.map((r,i)=>{
    const bestAns=r.best?answers.filter(a=>a.attempt_id===r.best.id):[];
    const latestAns=r.latest?answers.filter(a=>a.attempt_id===r.latest.id):[];
    return [
      i+1,r.registration_code||'',r.full_name||'',r.email||'',r.attendance_mode||'',r.university||'',r.practice_name||'',
      r.practice_years??'',r.teaching_years??'',
      r.attemptsCount?'Selesai':'Belum',
      ...(multi?[r.attemptsCount]:[]),
      ...(scored?[r.best?r.best.score:'',r.best?r.best.max_score:'',r.best?.percent??'']:[]),
      ...(pass!==null?[r.best?(r.passed?'Lulus':'Belum lulus'):'']:[]),
      r.best?fmtWib(r.best.submitted_at):'',
      ...questions.map(q=>{
        if(q.question_type==='text'){const a=latestAns.find(x=>x.question_id===q.id);return a?.text_answer||''}
        const a=bestAns.find(x=>x.question_id===q.id);
        if(!a)return '';
        if(q.question_type==='likert')return a.likert_value??'';
        return optionText.get(a.selected_option_id)||'';
      })
    ];
  });
  return {filename:`hasil-${kind}-preseptor-2026.xlsx`,sheet:kindLabel(kind),columns,rows};
}

async function exportAttempts(db,c){
  const {results,pass}=await buildResults(db,c);
  const columns=[
    {header:'No. Pendaftaran',width:18},{header:'Nama',width:34},{header:'Mode',width:10},
    {header:'Attempt ke',width:10},{header:'Skor',width:8},{header:'Maks',width:8},{header:'Nilai (%)',width:10},
    ...(pass!==null?[{header:`Lulus (≥ ${pass})`,width:12}]:[]),
    {header:'Dikirim',width:20}
  ];
  const rows=[];
  for(const r of results.filter(x=>!x.test)){
    for(const a of r._attempts){
      const p=attemptPercent(a);
      rows.push([
        r.registration_code||'',r.full_name||'',r.attendance_mode||'',a.attempt_no,Number(a.score||0),Number(a.max_score||0),p===null?'':Math.round(p),
        ...(pass!==null?[attemptPassed(a,pass)?'Lulus':'Belum lulus']:[]),
        fmtWib(a.submitted_at)
      ]);
    }
  }
  return {filename:`semua-attempt-${c.module.kind}-preseptor-2026.xlsx`,sheet:'Attempt',columns,rows};
}

export async function assessmentAdminGet(request,kind){
  if(!ASSESSMENT_KINDS[kind])return fail('Modul tidak dikenal.',404);
  const auth=await requireAdmin(request,['super_admin']);
  if(auth.error)return fail(auth.error,auth.status);
  try{
    const db=getSupabaseAdmin(),c=await context(db,kind);
    if(c.error)return fail(c.error);
    const exp=new URL(request.url).searchParams.get('export');
    const [questions,targets]=await Promise.all([loadQuestions(db,c.module.id),loadTargets(db,c.module.id)]);
    if(exp==='results')return NextResponse.json(await exportResults(db,c,questions,targets),NO_STORE);
    if(exp==='attempts')return NextResponse.json(await exportAttempts(db,c),NO_STORE);

    const {results,pass}=await buildResults(db,c);
    const scored=questions.some(isScoredQuestion);
    let evaluationSummary=null;
    if(kind==='evaluation'){
      const latestIds=results.filter(r=>!r.test&&r.latest).map(r=>r.latest.id);
      const answers=await answersFor(db,latestIds);
      evaluationSummary=summarizeEvaluation({questions,targets,answers});
    }
    return NextResponse.json({
      kind,event:c.event,module:c.module,questions,targets,
      results:stripPrivate(results),
      stats:statsOf(results,scored,pass),
      scored,
      locked:await hasAttempts(db,c.module.id),
      evaluationSummary,
      hasStandardBank:!!standardBank(kind)
    },NO_STORE);
  }catch(e){
    return fail(e.message||`Gagal memuat ${kindLabel(kind)}.`);
  }
}

export async function assessmentAdminPatch(request,kind){
  if(!ASSESSMENT_KINDS[kind])return fail('Modul tidak dikenal.',404);
  const auth=await requireAdmin(request,['super_admin']);
  if(auth.error)return fail(auth.error,auth.status);
  const label=kindLabel(kind);
  const db=getSupabaseAdmin(),c=await context(db,kind);
  if(c.error)return fail(c.error);
  const b=await request.json().catch(()=>({}));
  const open=parseWib(b.open_at),close=parseWib(b.close_at);
  if(b.open_at&&!open||b.close_at&&!close)return fail(`Format waktu ${label} tidak valid.`,422);
  if(open&&close&&open>=close)return fail('Waktu tutup harus setelah waktu buka.',422);
  if(b.active){
    const {count}=await db.from('assessment_questions').select('id',{count:'exact',head:true}).eq('assessment_id',c.module.id);
    if(!count)return fail(`Tambahkan soal sebelum ${label} diaktifkan.`,409);
    if(!open||!close)return fail(`Atur waktu buka dan tutup sebelum ${label} diaktifkan.`,409);
    if(kind==='evaluation'){
      const {count:tc}=await db.from('assessment_targets').select('id',{count:'exact',head:true}).eq('assessment_id',c.module.id).eq('active',true);
      if(!tc)return fail('Tambahkan minimal satu pemateri sebelum Evaluasi diaktifkan.',409);
    }
  }
  const requires=b.requires_day_number===''||b.requires_day_number===null||b.requires_day_number===undefined?null:Number(b.requires_day_number);
  if(requires!==null&&(!Number.isInteger(requires)||requires<1))return fail('Hari prasyarat tidak valid.',422);

  const update={
    title:String(b.title||c.module.title).trim().slice(0,180)||c.module.title,
    description:String(b.description??c.module.description??'').trim().slice(0,2000)||null,
    active:!!b.active,
    open_at:open?open.toISOString():null,
    close_at:close?close.toISOString():null,
    show_score:b.show_score!==false,
    requires_day_number:requires,
    updated_at:new Date().toISOString()
  };
  if(Object.prototype.hasOwnProperty.call(b,'max_attempts')){
    const v=b.max_attempts===''||b.max_attempts===null?null:Number(b.max_attempts);
    if(v!==null&&(!Number.isInteger(v)||v<1))return fail('Batas attempt harus angka ≥ 1 atau dikosongkan (tanpa batas).',422);
    update.max_attempts=v;
  }
  if(Object.prototype.hasOwnProperty.call(b,'pass_percent')){
    const v=b.pass_percent===''||b.pass_percent===null?null:Number(b.pass_percent);
    if(v!==null&&(!Number.isFinite(v)||v<0||v>100))return fail('Nilai lulus harus 0–100 atau dikosongkan.',422);
    update.pass_percent=v;
  }
  const {error}=await db.from('assessment_modules').update(update).eq('id',c.module.id);
  if(error)return fail(`Gagal menyimpan pengaturan ${label}.`);
  await logActivity({actorType:'admin',actorEmail:auth.user.email,action:`${kind}_config_updated`,metadata:{assessment_id:c.module.id,active:update.active,open_at:update.open_at,close_at:update.close_at,requires_day_number:update.requires_day_number,max_attempts:update.max_attempts,pass_percent:update.pass_percent}});
  return NextResponse.json({ok:true});
}

export function normalizeQuestion(body){
  const type=QUESTION_TYPES.includes(body.question_type)?body.question_type:'single_choice';
  const text=String(body.question_text||'').trim();
  if(text.length<3)return {error:'Pertanyaan minimal 3 karakter.'};
  const section=String(body.section||'').trim().slice(0,120)||null;
  const required=body.required!==false;
  if(type==='single_choice'){
    const raw=Array.isArray(body.options)?body.options:[];
    const opts=raw.map((x,i)=>({text:String(typeof x==='string'?x:x?.text||'').trim(),is_correct:typeof x==='object'&&x!==null?!!x.is_correct:Number(body.correct_index)===i})).filter(x=>x.text);
    if(opts.length<2||opts.length>6)return {error:'Sediakan 2–6 pilihan jawaban.'};
    const keys=opts.filter(x=>x.is_correct).length;
    if(keys>1)return {error:'Pilih paling banyak satu jawaban benar.'};
    const points=keys?Number(body.points??1):0;
    if(!Number.isFinite(points)||points<0)return {error:'Bobot soal tidak valid.'};
    return {type,text,section,required,points,opts,scale:null};
  }
  if(type==='likert'){
    const min=Number(body.scale_min??1),max=Number(body.scale_max??5);
    if(!Number.isInteger(min)||!Number.isInteger(max)||min<0||max>10||min>=max)return {error:'Skala tidak valid (contoh 1–5).'};
    return {type,text,section,required,points:0,opts:[],scale:{scale_min:min,scale_max:max,scale_min_label:String(body.scale_min_label||'').trim().slice(0,60)||null,scale_max_label:String(body.scale_max_label||'').trim().slice(0,60)||null}};
  }
  return {type,text,section,required,points:0,opts:[],scale:null};
}

function questionRow(q){
  return {
    question_text:q.text,question_type:q.type,required:q.required,points:q.points,section:q.section,
    scale_min:q.scale?.scale_min??1,scale_max:q.scale?.scale_max??5,
    scale_min_label:q.scale?.scale_min_label??null,scale_max_label:q.scale?.scale_max_label??null
  };
}

async function loadStandardBank(db,c,kind){
  const bank=standardBank(kind);
  if(!bank)return {error:'Bank soal standar tidak tersedia untuk modul ini.'};
  const {error:delQ}=await db.from('assessment_questions').delete().eq('assessment_id',c.module.id);
  if(delQ)return {error:'Gagal menghapus soal lama.'};
  if(kind==='evaluation'){
    const {error:delT}=await db.from('assessment_targets').delete().eq('assessment_id',c.module.id);
    if(delT)return {error:'Gagal menghapus pemateri lama.'};
  }
  const now=new Date().toISOString();
  const qRows=bank.questions.map((q,i)=>({
    assessment_id:c.module.id,position:i+1,
    ...questionRow(normalizeQuestion({question_type:q.type,question_text:q.text,section:q.section,required:q.required,points:q.points,options:(q.options||[]).map(o=>({text:o.text,is_correct:o.correct})),scale_min:q.scale_min,scale_max:q.scale_max,scale_min_label:q.scale_min_label,scale_max_label:q.scale_max_label})),
    created_at:now,updated_at:now
  }));
  const {data:inserted,error:insQ}=await db.from('assessment_questions').insert(qRows).select('id,position');
  if(insQ||!inserted)return {error:'Gagal menyimpan bank soal.'};
  const idByPos=new Map(inserted.map(x=>[Number(x.position),x.id]));
  const optRows=[];
  bank.questions.forEach((q,i)=>{(q.options||[]).forEach((o,j)=>optRows.push({question_id:idByPos.get(i+1),position:j+1,option_text:o.text,is_correct:!!o.correct}))});
  if(optRows.length){
    const {error:insO}=await db.from('assessment_options').insert(optRows);
    if(insO)return {error:'Soal tersimpan, tetapi pilihan jawaban gagal disimpan. Muat ulang bank soal.'};
  }
  if(kind==='evaluation'&&bank.targets.length){
    const {error:insT}=await db.from('assessment_targets').insert(bank.targets.map((t,i)=>({assessment_id:c.module.id,position:i+1,name:t.name,affiliation:t.affiliation||null,topic:t.topic||null,active:true})));
    if(insT)return {error:'Soal tersimpan, tetapi daftar pemateri gagal disimpan.'};
  }
  return {ok:true,questions:qRows.length,targets:kind==='evaluation'?bank.targets.length:0};
}

function normalizeTarget(b){
  const name=String(b.name||'').trim().slice(0,200);
  if(name.length<3)return {error:'Nama pemateri minimal 3 karakter.'};
  return {name,affiliation:String(b.affiliation||'').trim().slice(0,200)||null,topic:String(b.topic||'').trim().slice(0,500)||null,active:b.active!==false};
}

export async function assessmentAdminPost(request,kind){
  if(!ASSESSMENT_KINDS[kind])return fail('Modul tidak dikenal.',404);
  const auth=await requireAdmin(request,['super_admin']);
  if(auth.error)return fail(auth.error,auth.status);
  const label=kindLabel(kind);
  const db=getSupabaseAdmin(),c=await context(db,kind);
  if(c.error)return fail(c.error);
  const b=await request.json().catch(()=>({}));
  const action=String(b.action||'create_question');
  const log=(act,metadata={},registrationId)=>logActivity({registrationId,actorType:'admin',actorEmail:auth.user.email,action:`${kind}_${act}`,metadata:{assessment_id:c.module.id,...metadata}});

  if(action==='reset_attempt'){
    const registrationId=String(b.registrationId||'');
    if(!registrationId)return fail('Peserta tidak valid.',422);
    const {data:deleted,error}=await db.from('assessment_attempts').delete().eq('assessment_id',c.module.id).eq('registration_id',registrationId).select('id');
    if(error)return fail(`Gagal mereset hasil ${label}.`);
    await log('attempt_reset',{deleted:(deleted||[]).length},registrationId);
    return NextResponse.json({ok:true});
  }

  if(action==='reset_test_attempts'){
    const {data:tests}=await db.from('registrations').select('id').eq('event_id',c.event.id).eq('is_test_account',true);
    const ids=(tests||[]).map(x=>x.id);
    if(ids.length){
      const {error}=await db.from('assessment_attempts').delete().eq('assessment_id',c.module.id).in('registration_id',ids);
      if(error)return fail('Gagal mereset hasil akun TEST.');
    }
    await log('test_attempts_reset',{count:ids.length});
    return NextResponse.json({ok:true});
  }

  if(action==='update_target'){
    const id=String(b.targetId||'');
    const t=normalizeTarget(b);
    if(t.error)return fail(t.error,422);
    const {data:existing}=await db.from('assessment_targets').select('id').eq('id',id).eq('assessment_id',c.module.id).maybeSingle();
    if(!existing)return fail('Pemateri tidak ditemukan.',404);
    const {error}=await db.from('assessment_targets').update({...t,updated_at:new Date().toISOString()}).eq('id',id);
    if(error)return fail('Gagal memperbarui pemateri.');
    return NextResponse.json({ok:true});
  }

  // Aksi di bawah ini mengubah struktur bank soal/pemateri: dikunci bila sudah ada hasil.
  if(await hasAttempts(db,c.module.id))return fail(`Bank soal dan daftar pemateri terkunci karena sudah ada hasil ${label}. Reset hasil (termasuk akun TEST) terlebih dahulu.`,409);

  if(action==='load_standard_bank'){
    const r=await loadStandardBank(db,c,kind);
    if(r.error)return fail(r.error);
    await log('standard_bank_loaded',{questions:r.questions,targets:r.targets});
    return NextResponse.json(r);
  }

  if(action==='create_target'){
    if(kind!=='evaluation')return fail('Pemateri hanya untuk Evaluasi.',400);
    const t=normalizeTarget(b);
    if(t.error)return fail(t.error,422);
    const {data:last}=await db.from('assessment_targets').select('position').eq('assessment_id',c.module.id).order('position',{ascending:false}).limit(1).maybeSingle();
    const {error}=await db.from('assessment_targets').insert({assessment_id:c.module.id,position:Number(last?.position||0)+1,...t});
    if(error)return fail('Gagal menambahkan pemateri.');
    return NextResponse.json({ok:true});
  }

  if(action==='delete_target'){
    const {error}=await db.from('assessment_targets').delete().eq('assessment_id',c.module.id).eq('id',String(b.targetId||''));
    if(error)return fail('Gagal menghapus pemateri.');
    return NextResponse.json({ok:true});
  }

  const q=normalizeQuestion(b);
  if(q.error)return fail(q.error,422);

  if(action==='create_question'){
    const {data:last}=await db.from('assessment_questions').select('position').eq('assessment_id',c.module.id).order('position',{ascending:false}).limit(1).maybeSingle();
    const {data:created,error}=await db.from('assessment_questions').insert({assessment_id:c.module.id,position:Number(last?.position||0)+1,...questionRow(q)}).select('*').single();
    if(error)return fail('Gagal menambahkan soal.');
    if(q.opts.length){
      const {error:optionError}=await db.from('assessment_options').insert(q.opts.map((o,i)=>({question_id:created.id,position:i+1,option_text:o.text,is_correct:o.is_correct})));
      if(optionError){await db.from('assessment_questions').delete().eq('id',created.id);return fail('Gagal menyimpan pilihan jawaban.')}
    }
    return NextResponse.json({ok:true,id:created.id});
  }

  if(action==='update_question'){
    const id=String(b.questionId||'');
    const {data:existing}=await db.from('assessment_questions').select('id').eq('id',id).eq('assessment_id',c.module.id).maybeSingle();
    if(!existing)return fail('Soal tidak ditemukan.',404);
    const {error}=await db.from('assessment_questions').update({...questionRow(q),updated_at:new Date().toISOString()}).eq('id',id);
    if(error)return fail('Gagal memperbarui soal.');
    await db.from('assessment_options').delete().eq('question_id',id);
    if(q.opts.length){
      const {error:optionError}=await db.from('assessment_options').insert(q.opts.map((o,i)=>({question_id:id,position:i+1,option_text:o.text,is_correct:o.is_correct})));
      if(optionError)return fail('Soal tersimpan, tetapi pilihan jawaban gagal diperbarui.');
    }
    return NextResponse.json({ok:true});
  }

  return fail('Aksi tidak dikenal.',400);
}

export async function assessmentAdminDelete(request,kind){
  if(!ASSESSMENT_KINDS[kind])return fail('Modul tidak dikenal.',404);
  const auth=await requireAdmin(request,['super_admin']);
  if(auth.error)return fail(auth.error,auth.status);
  const label=kindLabel(kind);
  const db=getSupabaseAdmin(),c=await context(db,kind);
  if(c.error)return fail(c.error);
  if(await hasAttempts(db,c.module.id))return fail(`Soal tidak dapat dihapus selama masih ada hasil ${label}. Reset hasil terlebih dahulu.`,409);
  const b=await request.json().catch(()=>({})),id=String(b.questionId||'');
  const {error}=await db.from('assessment_questions').delete().eq('assessment_id',c.module.id).eq('id',id);
  if(error)return fail('Gagal menghapus soal.');
  return NextResponse.json({ok:true});
}
