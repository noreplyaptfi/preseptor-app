export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, skipped: true, error: 'RESEND_API_KEY belum diatur.' };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'APTFI <noreply@aptfi.or.id>', to: [to], subject, html })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, error: body?.message || `Email HTTP ${response.status}` };
  return { ok: true, id: body.id };
}


export async function sendBulkEmail(messages=[]) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, skipped: true, error: 'RESEND_API_KEY belum diatur.' };
  const from = process.env.EMAIL_FROM || 'APTFI <noreply@aptfi.or.id>';
  const chunks=[];
  for(let i=0;i<messages.length;i+=100) chunks.push(messages.slice(i,i+100));
  const ids=[];
  for(const chunk of chunks){
    const response=await fetch('https://api.resend.com/emails/batch',{
      method:'POST',
      headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify(chunk.map(m=>({from,to:[m.to],subject:m.subject,html:m.html})))
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok) return {ok:false,error:body?.message||`Email HTTP ${response.status}`,ids};
    if(Array.isArray(body?.data)) ids.push(...body.data.map(x=>x.id).filter(Boolean));
  }
  return {ok:true,ids};
}
