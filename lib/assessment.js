import { participantEligible,isTestRegistration,windowState,inWindow } from './day-h';

export { participantEligible,isTestRegistration,windowState,inWindow };

// v0.7.0 — engine assessment generik untuk Pretest, Posttest, dan Evaluasi.

export const ASSESSMENT_KINDS={
  pretest:{kind:'pretest',label:'Pretest',noun:'Pretest'},
  posttest:{kind:'posttest',label:'Posttest',noun:'Posttest'},
  evaluation:{kind:'evaluation',label:'Evaluasi',noun:'Evaluasi'}
};

export function kindLabel(kind){return ASSESSMENT_KINDS[kind]?.label||'Assessment'}

export const QUESTION_TYPES=['single_choice','likert','text'];

export function assessmentWindowState(module,now=new Date()){
  if(!module)return 'missing';
  if(!module.active)return 'inactive';
  return windowState(module.open_at,module.close_at,now);
}

// Soal pilihan ganda dinilai bila memiliki tepat satu kunci dan bobot > 0.
// Pilihan ganda tanpa kunci = pertanyaan survei (tidak dinilai).
export function isScoredQuestion(q){
  if(q?.question_type!=='single_choice')return false;
  if(!(Number(q?.points||0)>0))return false;
  return (q?.options||[]).filter(o=>o.is_correct).length===1;
}

export function answerKey(questionId,targetId){
  return targetId?`${questionId}::${targetId}`:String(questionId);
}

export function scorePercent(attempt){
  const max=Number(attempt?.max_score||0),score=Number(attempt?.score||0);
  if(!max)return 0;
  return Math.round((score/max)*100);
}

export function attemptPercent(attempt){
  if(!attempt)return null;
  const max=Number(attempt.max_score||0);
  if(!max)return null;
  return Math.round((Number(attempt.score||0)/max)*10000)/100;
}

export function attemptPassed(attempt,passPercent){
  if(passPercent===null||passPercent===undefined||passPercent==='')return null;
  const p=attemptPercent(attempt);
  if(p===null)return null;
  return p>=Number(passPercent);
}

// Nilai terbaik; bila sama, attempt paling awal.
export function bestAttempt(attempts){
  let best=null;
  for(const a of attempts||[]){
    if(!a)continue;
    if(!best){best=a;continue}
    const pa=attemptPercent(a)??-1,pb=attemptPercent(best)??-1;
    if(pa>pb||(pa===pb&&new Date(a.submitted_at||0)<new Date(best.submitted_at||0)))best=a;
  }
  return best;
}

export function latestAttempt(attempts){
  let latest=null;
  for(const a of attempts||[]){
    if(!latest||Number(a.attempt_no||0)>Number(latest.attempt_no||0))latest=a;
  }
  return latest;
}

export function publicAttempt(attempt,showScore=true,passPercent=null){
  if(!attempt)return null;
  const percent=showScore?attemptPercent(attempt):null;
  return {
    id:attempt.id,
    attempt_no:attempt.attempt_no,
    status:attempt.status,
    submitted_at:attempt.submitted_at,
    total_questions:attempt.total_questions,
    correct_count:showScore?attempt.correct_count:null,
    score:showScore?Number(attempt.score??0):null,
    max_score:showScore?Number(attempt.max_score??0):null,
    percent:percent===null?null:Math.round(percent),
    passed:showScore?attemptPassed(attempt,passPercent):null
  };
}

function questionLabel(q,index,target){
  const base=`nomor ${index+1}`;
  return target?`${base} untuk ${target.name}`:base;
}

// Menilai jawaban di server. answers: { [answerKey]: optionId | angka skala | teks }.
// Bila ada targets (pemateri), setiap soal dijawab untuk setiap target.
export function scoreSubmission({questions,targets,answers}){
  const list=Array.isArray(questions)?questions:[];
  const tgs=(Array.isArray(targets)?targets:[]).filter(t=>t&&t.active!==false);
  const input=answers&&typeof answers==='object'?answers:{};
  const units=tgs.length?tgs.flatMap(t=>list.map((q,i)=>({q,i,t}))):list.map((q,i)=>({q,i,t:null}));
  const rows=[];
  let score=0,maxScore=0,correctCount=0,scoredCount=0;

  for(const {q,i,t} of units){
    const key=answerKey(q.id,t?.id);
    const raw=input[key];
    const label=questionLabel(q,i,t);
    const row={question_id:q.id,target_id:t?.id||null,selected_option_id:null,text_answer:null,likert_value:null,is_correct:null,points_awarded:0};

    if(q.question_type==='single_choice'){
      const selected=raw===undefined||raw===null?'':String(raw);
      if(!selected){
        if(q.required)return {error:`Pertanyaan ${label} belum dijawab.`};
      }
      const option=selected?(q.options||[]).find(o=>String(o.id)===selected):null;
      if(selected&&!option)return {error:`Jawaban pertanyaan ${label} tidak valid.`};
      row.selected_option_id=option?.id||null;
      if(isScoredQuestion(q)){
        const points=Number(q.points||0);
        maxScore+=points;scoredCount++;
        const correct=!!option?.is_correct;
        row.is_correct=correct;
        if(correct){row.points_awarded=points;score+=points;correctCount++}
      }
    }else if(q.question_type==='likert'){
      const min=Number(q.scale_min??1),max=Number(q.scale_max??5);
      const empty=raw===undefined||raw===null||raw==='';
      if(empty){
        if(q.required)return {error:`Pertanyaan ${label} belum diisi.`};
      }else{
        const n=Number(raw);
        if(!Number.isInteger(n)||n<min||n>max)return {error:`Nilai pertanyaan ${label} harus ${min}–${max}.`};
        row.likert_value=n;
      }
    }else if(q.question_type==='text'){
      const text=raw===undefined||raw===null?'':String(raw).trim();
      if(!text&&q.required)return {error:`Pertanyaan ${label} wajib diisi.`};
      row.text_answer=text?text.slice(0,4000):null;
    }else{
      return {error:`Tipe pertanyaan ${label} tidak dikenal.`};
    }
    rows.push(row);
  }

  return {rows,score,maxScore,correctCount,totalQuestions:scoredCount||units.length};
}

// Rekap evaluasi: rata-rata skala per pemateri per pertanyaan.
export function summarizeEvaluation({questions,targets,answers}){
  const likert=(questions||[]).filter(q=>q.question_type==='likert');
  const textQs=(questions||[]).filter(q=>q.question_type==='text');
  return (targets||[]).map(t=>{
    const mine=(answers||[]).filter(a=>a.target_id===t.id);
    const perQuestion=likert.map(q=>{
      const vals=mine.filter(a=>a.question_id===q.id&&a.likert_value!==null&&a.likert_value!==undefined).map(a=>Number(a.likert_value));
      const avg=vals.length?Math.round(vals.reduce((s,v)=>s+v,0)/vals.length*100)/100:null;
      return {question_id:q.id,average:avg,count:vals.length};
    });
    const all=perQuestion.filter(x=>x.average!==null);
    const overall=all.length?Math.round(all.reduce((s,x)=>s+x.average,0)/all.length*100)/100:null;
    const respondents=new Set(mine.map(a=>a.attempt_id)).size;
    const comments=mine.filter(a=>textQs.some(q=>q.id===a.question_id)&&a.text_answer).length;
    return {target_id:t.id,name:t.name,affiliation:t.affiliation,topic:t.topic,active:t.active,perQuestion,overall,respondents,comments};
  });
}
