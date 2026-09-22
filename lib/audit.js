import { getSupabaseAdmin } from './supabase-admin';
export async function logActivity({ registrationId = null, actorType = 'system', actorEmail = '', action, metadata = {} }) {
  const db = getSupabaseAdmin();
  await db.from('activity_logs').insert({ registration_id: registrationId, actor_type: actorType, actor_email: actorEmail || null, action, metadata });
}
