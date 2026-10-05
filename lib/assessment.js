import { participantEligible,isTestRegistration,windowState,inWindow } from './day-h';

export { participantEligible,isTestRegistration,windowState,inWindow };

export function assessmentWindowState(module,now=new Date()){
  if(!module)return 'missing';
  if(!module.active)return 'inactive';
  return windowState(module.open_at,module.close_at,now);
}

export function scorePercent(attempt){
  const max=Number(attempt?.max_score||0),score=Number(attempt?.score||0);
  if(!max)return 0;
  return Math.round((score/max)*100);
}

export function publicAttempt(attempt,showScore=true){
  if(!attempt)return null;
  return {
    id:attempt.id,
    status:attempt.status,
    submitted_at:attempt.submitted_at,
    total_questions:attempt.total_questions,
    correct_count:showScore?attempt.correct_count:null,
    score:showScore?attempt.score:null,
    max_score:showScore?attempt.max_score:null,
    percent:showScore?scorePercent(attempt):null
  };
}
