import sanitizeHtml from 'sanitize-html';

export function sanitizeAnnouncementHtml(value=''){
  return sanitizeHtml(String(value||''),{
    allowedTags:['p','div','br','strong','b','em','i','u','ul','ol','li','a','h2','h3','blockquote','hr'],
    allowedAttributes:{a:['href','target','rel']},
    allowedSchemes:['http','https','mailto'],
    transformTags:{a:(tagName,attribs)=>({tagName:'a',attribs:{...attribs,target:'_blank',rel:'noopener noreferrer'}})}
  }).trim();
}

// v0.8.3: aturan penerima dipindah ke announcement-audience.js (bisa dipakai di browser).
export { announcementMatches,announcementRecipient } from './announcement-audience';
