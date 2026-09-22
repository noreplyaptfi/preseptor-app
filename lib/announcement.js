import sanitizeHtml from 'sanitize-html';

export function sanitizeAnnouncementHtml(value=''){
  return sanitizeHtml(String(value||''),{
    allowedTags:['p','div','br','strong','b','em','i','u','ul','ol','li','a','h2','h3','blockquote','hr'],
    allowedAttributes:{a:['href','target','rel']},
    allowedSchemes:['http','https','mailto'],
    transformTags:{a:(tagName,attribs)=>({tagName:'a',attribs:{...attribs,target:'_blank',rel:'noopener noreferrer'}})}
  }).trim();
}

export function announcementMatches(reg,audience){
  if(audience==='all') return true;
  if(audience==='online') return reg.attendance_mode==='Online';
  if(audience==='offline') return reg.attendance_mode==='Offline';
  if(audience==='verified') return reg.overall_status==='verified';
  return false;
}
