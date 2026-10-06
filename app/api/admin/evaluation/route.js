import { assessmentAdminGet,assessmentAdminPatch,assessmentAdminPost,assessmentAdminDelete } from '../../../../lib/assessment-admin';

// v0.7.0 — Admin Evaluasi (Super Admin). Logika ada di lib/assessment-admin.js.
export const dynamic='force-dynamic';

export async function GET(request){return assessmentAdminGet(request,'evaluation')}
export async function PATCH(request){return assessmentAdminPatch(request,'evaluation')}
export async function POST(request){return assessmentAdminPost(request,'evaluation')}
export async function DELETE(request){return assessmentAdminDelete(request,'evaluation')}
