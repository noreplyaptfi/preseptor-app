import crypto from 'node:crypto';
import { getSupabaseAdmin } from './supabase-admin';

function hash(value){return crypto.createHash('sha256').update(String(value||'')).digest('hex')}
export function requestIp(request){return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||request.headers.get('x-real-ip')||'unknown'}
export async function enforceRequestLimit({scope,identifier,limit=20,windowSeconds=600}){
  const db=getSupabaseAdmin();
  const keyHash=hash(identifier||'unknown');
  const since=new Date(Date.now()-windowSeconds*1000).toISOString();
  const {count}=await db.from('request_events').select('id',{count:'exact',head:true}).eq('scope',scope).eq('key_hash',keyHash).gte('created_at',since);
  if(Number(count||0)>=limit) return {ok:false,retryAfter:windowSeconds};
  await db.from('request_events').insert({scope,key_hash:keyHash});
  // Opportunistic cleanup keeps the table small without a scheduler.
  if(Math.random()<0.02) await db.from('request_events').delete().lt('created_at',new Date(Date.now()-24*60*60*1000).toISOString());
  return {ok:true};
}
