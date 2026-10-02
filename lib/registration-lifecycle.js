export const ACTIVE_REGISTRATION_STATUSES=['active','withdrawal_requested'];
export const INACTIVE_REGISTRATION_STATUSES=['withdrawn','rejected'];

export function isActiveRegistration(status){
  return ACTIVE_REGISTRATION_STATUSES.includes(String(status||'active'));
}

export function isInactiveRegistration(status){
  return INACTIVE_REGISTRATION_STATUSES.includes(String(status||''));
}

export function lifecycleLabel(status){
  return status==='withdrawn'?'Mengundurkan diri':status==='rejected'?'Pendaftaran ditolak':status==='withdrawal_requested'?'Pengunduran diri diajukan':'Aktif';
}
