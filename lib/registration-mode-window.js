import { resolveEventState } from './event-state';

const MODE_KEYS={
  Online:{open:'online_registration_opens_at',close:'online_registration_closes_at'},
  Offline:{open:'offline_registration_opens_at',close:'offline_registration_closes_at'}
};

function toDate(value){
  if(!value)return null;
  const d=new Date(value);
  return Number.isNaN(d.getTime())?null:d;
}

function publicDate(value){
  const d=toDate(value);
  return d?d.toISOString():null;
}

export function resolveModeRegistrationWindow(event,mode,now=new Date()){
  const keys=MODE_KEYS[mode];
  if(!keys)return {mode,isOpen:false,status:'invalid',reason:'invalid_mode',message:'Mode pendaftaran tidak valid.',opensAt:null,closesAt:null,usesModeWindow:false};

  if(event?.registration_status==='maintenance'){
    return {mode,isOpen:false,status:'maintenance',reason:'maintenance',message:event.maintenance_message||'Pendaftaran sedang dalam pemeliharaan.',opensAt:null,closesAt:null,usesModeWindow:false};
  }
  if(event?.registration_status==='closed'){
    return {mode,isOpen:false,status:'closed',reason:'global_closed',message:'Pendaftaran sedang ditutup oleh panitia.',opensAt:null,closesAt:null,usesModeWindow:false};
  }

  const openValue=event?.[keys.open]||null;
  const closeValue=event?.[keys.close]||null;
  const usesModeWindow=!!(openValue||closeValue);

  // Backward compatible: before a mode-specific schedule is configured,
  // keep using the existing global registration state and dates.
  if(!usesModeWindow){
    const state=resolveEventState(event);
    return {
      mode,
      isOpen:!!state.isOpen,
      status:state.status,
      reason:state.isOpen?'open':state.status==='scheduled'?'not_open':'global_closed',
      message:state.message,
      opensAt:publicDate(event?.registration_opens_at),
      closesAt:publicDate(event?.registration_closes_at),
      usesModeWindow:false
    };
  }

  const opensAt=toDate(openValue);
  const closesAt=toDate(closeValue);
  const current=now instanceof Date?now:new Date(now);

  if(opensAt&&current<opensAt){
    return {mode,isOpen:false,status:'scheduled',reason:'not_open',message:`Pendaftaran ${mode} belum dibuka.`,opensAt:publicDate(openValue),closesAt:publicDate(closeValue),usesModeWindow:true};
  }
  if(closesAt&&current>=closesAt){
    return {mode,isOpen:false,status:'closed',reason:'closed',message:`Pendaftaran ${mode} sudah ditutup.`,opensAt:publicDate(openValue),closesAt:publicDate(closeValue),usesModeWindow:true};
  }
  return {mode,isOpen:true,status:'open',reason:'open',message:`Pendaftaran ${mode} dibuka.`,opensAt:publicDate(openValue),closesAt:publicDate(closeValue),usesModeWindow:true};
}

export function resolveAllModeRegistrationWindows(event,now=new Date()){
  return {
    Online:resolveModeRegistrationWindow(event,'Online',now),
    Offline:resolveModeRegistrationWindow(event,'Offline',now)
  };
}
