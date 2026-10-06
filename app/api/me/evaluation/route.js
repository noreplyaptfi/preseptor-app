import { assessmentParticipantGet,assessmentParticipantPost } from '../../../../lib/assessment-participant';

// v0.7.0 — Evaluasi peserta. Logika ada di lib/assessment-participant.js.
export const dynamic='force-dynamic';

export async function GET(request){return assessmentParticipantGet(request,'evaluation')}
export async function POST(request){return assessmentParticipantPost(request,'evaluation')}
