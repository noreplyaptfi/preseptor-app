import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { participantEligible,isTestRegistration,scorePercent } from '../../../../lib/assessment';
import { logActivity } from '../../../../lib/audit';
export const dynamic='force-dynamic';

function parseWib(v){
  const s=String(v||'').trim();
  if(!s)return null;
  const d=new Date(/([zZ]|[+-]\d{2}:?\d{2})$/.test(s)?s:`${s.length===16?s+':00':s}+07:00`);
  return Number.isNaN(d.getTime())?null:d;
}

async function context(db){
  const slug=process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026';
  const {data:event}=await db.from('events').select('id,slug,title').eq('slug',slug).single();
  if(!event)return {error:'Event tidak ditemukan.'};
  const {data:module,error}=await db.from('assessment_modules').select('*').eq('event_id',event.id).eq('kind','pretest').maybeSingle();
  if(error)return {error:'Migration Pretest belum dijalankan.'};
  if(!module)return {error:'Modul Pretest belum tersedia. Jalankan migration 018.'};
  return {event,module};
}

async function questions(db,moduleId,includeCorrect=true){
  const {data:q,error}=await db.from('assessment_questions').select('*').eq('assessment_id',moduleId).order('position').order('id');
  if(error)throw new Error('Gagal memuat soal pretest.');
  const ids=(q||[]).map(x=>x.id);
  let options=[];
  if(ids.length){
    const res=await db.from('assessment_options').select('*').in('question_id',ids).order('position').order('id');
    if(res.error)throw new Error('Gagal memuat pilihan jawaban.');
    options=res.data||[];
  }
  return (q||[]).map(item=>({...item,options:options.filter(o=>o.question_id===item.id).map(o=>includeCorrect?o:(({is_correct,...rest})=>rest)(o))}));
}

async function hasAttempts(db,moduleId){
  const {count}=await db.from('assessment_attempts').select('id',{count:'exact',head:true}).eq('assessment_id',moduleId);
  return Number(count||0)>0;
}

function normalizeQuestion(body){
  const text=String(body.question_text||'').trim();
  const points=Number(body.points||1);
  const raw=Array.isArray(body.options)?body.options:[];
  const opts=raw.map((x,i)=>({text:String(typeof x==='string'?x:x?.text||'').trim(),is_correct:typeof x==='object'?!!x.is_correct:Number(body.correct_index)===i})).filter(x=>x.text);
  if(text.length<5)return {error:'Pertanyaan minimal 5 karakter.'};
  if(!Number.isFinite(points)||points<0)return {error:'Bobot soal tidak valid.'};
  if(opts.length<2||opts.length>6)return {error:'Sediakan 2–6 pilihan jawaban.'};
  if(opts.filter(x=>x.is_correct).length!==1)return {error:'Pilih tepat satu jawaban benar.'};
  return {text,points,opts};
}

export async function GET(request){
  const auth=await requireAdmin(request,['super_admin']);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  try{
    const db=getSupabaseAdmin(),c=await context(db);
    if(c.error)return NextResponse.json({message:c.error},{status:500});
    const qs=await questions(db,c.module.id,true);
    const [{data:regs},{data:attempts}]=await Promise.all([
      db.from('registrations').select('id,registration_code,full_name,email,attendance_mode,requirements_status,payment_status,lifecycle_status,is_test_account').eq('event_id',c.event.id).order('full_name'),
      db.from('assessment_attempts').select('*').eq('assessment_id',c.module.id).eq('status','submitted').order('submitted_at',{ascending:false})
    ]);
    const eligible=(regs||[]).filter(participantEligible).map(r=>({...r,test:isTestRegistration(r)}));
    const byReg=new Map((attempts||[]).map(a=>[a.registration_id,a]));
    const results=eligible.map(r=>({...r,attempt:byReg.get(r.id)||null}));
    const official=results.filter(r=>!r.test),tests=results.filter(r=>r.test);
    const submitted=official.filter(r=>r.attempt),testSubmitted=tests.filter(r=>r.attempt);
    const avg=submitted.length?Math.round(submitted.reduce((sum,r)=>sum+scorePercent(r.attempt),0)/submitted.length):0;
    return NextResponse.json({
      event:c.event,module:c.module,questions:qs,results,
      stats:{eligible:official.length,submitted:submitted.length,pending:Math.max(0,official.length-submitted.length),averagePercent:avg,testAccounts:tests.length,testSubmitted:testSubmitted.length}
    },{headers:{'Cache-Control':'private, no-store'}});
  }catch(e){return NextResponse.json({message:e.message||'Gagal memuat Pretest.'},{status:500})}
}

export async function PATCH(request){
  const auth=await requireAdmin(request,['super_admin']);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin(),c=await context(db);
  if(c.error)return NextResponse.json({message:c.error},{status:500});
  const b=await request.json().catch(()=>({}));
  const open=parseWib(b.open_at),close=parseWib(b.close_at);
  if(b.open_at&&!open||b.close_at&&!close)return NextResponse.json({message:'Format waktu Pretest tidak valid.'},{status:422});
  if(open&&close&&open>=close)return NextResponse.json({message:'Waktu tutup harus setelah waktu buka.'},{status:422});
  if(b.active){
    const {count}=await db.from('assessment_questions').select('id',{count:'exact',head:true}).eq('assessment_id',c.module.id);
    if(!count)return NextResponse.json({message:'Tambahkan minimal satu soal sebelum Pretest diaktifkan.'},{status:409});
    if(!open||!close)return NextResponse.json({message:'Atur waktu buka dan tutup sebelum Pretest diaktifkan.'},{status:409});
  }
  const requires=b.requires_day_number===''||b.requires_day_number===null?null:Number(b.requires_day_number);
  if(requires!==null&&(!Number.isInteger(requires)||requires<1))return NextResponse.json({message:'Hari prasyarat tidak valid.'},{status:422});
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
  const {error}=await db.from('assessment_modules').update(update).eq('id',c.module.id);
  if(error)return NextResponse.json({message:'Gagal menyimpan pengaturan Pretest.'},{status:500});
  await logActivity({actorType:'admin',actorEmail:auth.user.email,action:'pretest_config_updated',metadata:{assessment_id:c.module.id,active:update.active,requires_day_number:update.requires_day_number}});
  return NextResponse.json({ok:true});
}

export async function POST(request){
  const auth=await requireAdmin(request,['super_admin']);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin(),c=await context(db);
  if(c.error)return NextResponse.json({message:c.error},{status:500});
  const b=await request.json().catch(()=>({}));
  const action=String(b.action||'create_question');

  if(action==='reset_attempt'){
    const registrationId=String(b.registrationId||'');
    if(!registrationId)return NextResponse.json({message:'Peserta tidak valid.'},{status:422});
    const {data:deleted,error}=await db.from('assessment_attempts').delete().eq('assessment_id',c.module.id).eq('registration_id',registrationId).select('id');
    if(error)return NextResponse.json({message:'Gagal mereset hasil Pretest.'},{status:500});
    await logActivity({registrationId,actorType:'admin',actorEmail:auth.user.email,action:'pretest_attempt_reset',metadata:{assessment_id:c.module.id,deleted:(deleted||[]).length}});
    return NextResponse.json({ok:true});
  }

  if(action==='reset_test_attempts'){
    const {data:tests}=await db.from('registrations').select('id').eq('event_id',c.event.id).eq('is_test_account',true);
    const ids=(tests||[]).map(x=>x.id);
    if(ids.length){
      const {error}=await db.from('assessment_attempts').delete().eq('assessment_id',c.module.id).in('registration_id',ids);
      if(error)return NextResponse.json({message:'Gagal mereset hasil akun TEST.'},{status:500});
    }
    await logActivity({actorType:'admin',actorEmail:auth.user.email,action:'pretest_test_attempts_reset',metadata:{assessment_id:c.module.id,count:ids.length}});
    return NextResponse.json({ok:true});
  }

  if(await hasAttempts(db,c.module.id))return NextResponse.json({message:'Soal tidak dapat diubah selama masih ada hasil Pretest. Reset hasil yang ada terlebih dahulu.'},{status:409});
  const q=normalizeQuestion(b);
  if(q.error)return NextResponse.json({message:q.error},{status:422});

  if(action==='create_question'){
    const {data:last}=await db.from('assessment_questions').select('position').eq('assessment_id',c.module.id).order('position',{ascending:false}).limit(1).maybeSingle();
    const {data:created,error}=await db.from('assessment_questions').insert({assessment_id:c.module.id,position:Number(last?.position||0)+1,question_text:q.text,question_type:'single_choice',required:true,points:q.points}).select('*').single();
    if(error)return NextResponse.json({message:'Gagal menambahkan soal.'},{status:500});
    const {error:optionError}=await db.from('assessment_options').insert(q.opts.map((o,i)=>({question_id:created.id,position:i+1,option_text:o.text,is_correct:o.is_correct})));
    if(optionError){await db.from('assessment_questions').delete().eq('id',created.id);return NextResponse.json({message:'Gagal menyimpan pilihan jawaban.'},{status:500})}
    return NextResponse.json({ok:true,id:created.id});
  }

  if(action==='update_question'){
    const id=String(b.questionId||'');
    const {data:existing}=await db.from('assessment_questions').select('id').eq('id',id).eq('assessment_id',c.module.id).maybeSingle();
    if(!existing)return NextResponse.json({message:'Soal tidak ditemukan.'},{status:404});
    const {error}=await db.from('assessment_questions').update({question_text:q.text,points:q.points,updated_at:new Date().toISOString()}).eq('id',id);
    if(error)return NextResponse.json({message:'Gagal memperbarui soal.'},{status:500});
    await db.from('assessment_options').delete().eq('question_id',id);
    const {error:optionError}=await db.from('assessment_options').insert(q.opts.map((o,i)=>({question_id:id,position:i+1,option_text:o.text,is_correct:o.is_correct})));
    if(optionError)return NextResponse.json({message:'Soal tersimpan, tetapi pilihan jawaban gagal diperbarui.'},{status:500});
    return NextResponse.json({ok:true});
  }

  return NextResponse.json({message:'Aksi tidak dikenal.'},{status:400});
}

export async function DELETE(request){
  const auth=await requireAdmin(request,['super_admin']);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin(),c=await context(db);
  if(c.error)return NextResponse.json({message:c.error},{status:500});
  if(await hasAttempts(db,c.module.id))return NextResponse.json({message:'Soal tidak dapat dihapus selama masih ada hasil Pretest. Reset hasil terlebih dahulu.'},{status:409});
  const b=await request.json().catch(()=>({})),id=String(b.questionId||'');
  const {error}=await db.from('assessment_questions').delete().eq('assessment_id',c.module.id).eq('id',id);
  if(error)return NextResponse.json({message:'Gagal menghapus soal.'},{status:500});
  return NextResponse.json({ok:true});
}
