export function normalizeEmail(value=''){
  return String(value).trim().toLowerCase();
}

export function normalizePhone(value=''){
  let digits=String(value).replace(/\D/g,'');
  if(digits.startsWith('0')) digits=`62${digits.slice(1)}`;
  else if(digits.startsWith('8')) digits=`62${digits}`;
  return digits.slice(0,24);
}

export function normalizeStra(value=''){
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,80);
}

export function normalizeName(value=''){
  return String(value).toLowerCase().replace(/\b(apt|dr|prof|m\.?si|s\.?farm|phd|mm|m\.?farm)\b\.?/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}

export function normalizeInstitution(value=''){
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
