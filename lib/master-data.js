export async function eventForSlug(db){
  const slug=process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026';
  const {data,error}=await db.from('events').select('*').eq('slug',slug).single();
  return {event:data,error};
}

export async function masterOptions(db,eventId,{activeOnly=false}={}){
  let q=db.from('master_data_options').select('*').eq('event_id',eventId).order('group_key').order('sort_order').order('label');
  if(activeOnly)q=q.eq('active',true);
  const {data,error}=await q;
  if(error)throw error;
  const grouped={};
  for(const item of data||[]){(grouped[item.group_key]||(grouped[item.group_key]=[])).push(item)}
  return grouped;
}

export function practiceRule(options,value){return (options?.practice_type||[]).find(x=>x.value===value)||null}
export function participantRule(options,value){return (options?.participant_type||[]).find(x=>x.value===value)||null}

export function validateProfessionalWithMaster(data,options,{allowCurrentPracticeType='',allowCurrentParticipantType=''}={}){
  const errors={};
  const participant=participantRule(options,data.participant_type);
  if(!participant||(!participant.active&&data.participant_type!==allowCurrentParticipantType))errors.participant_type='Kategori peserta tidak valid atau sedang dinonaktifkan.';
  const requiresPractice=!!participant?.meta?.requires_practice;
  const requiresTeaching=!!participant?.meta?.requires_teaching;
  if(requiresPractice){
    const rule=practiceRule(options,data.practice_type);
    if(!rule||(!rule.active&&data.practice_type!==allowCurrentPracticeType))errors.practice_type='Jenis tempat praktik tidak valid atau sudah dinonaktifkan.';
    if(!String(data.practice_name||'').trim())errors.practice_name='Nama tempat praktik wajib diisi.';
    const years=Number(data.practice_years||0);
    if(!Number.isFinite(years)||years<0)errors.practice_years='Lama praktik tidak valid.';
    const min=Number(rule?.min_years||0);
    if(rule&&years<min)errors.practice_years=`Minimal pengalaman untuk ${rule.label} adalah ${min} tahun.`;
  }
  if(requiresTeaching){
    const years=Number(data.teaching_years||0),min=Number(participant?.meta?.min_teaching_years||2);
    if(!Number.isFinite(years)||years<min)errors.teaching_years=`Minimal pengalaman mengajar adalah ${min} tahun.`;
  }
  return errors;
}
