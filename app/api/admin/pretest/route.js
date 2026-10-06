import { assessmentAdminGet,assessmentAdminPatch,assessmentAdminPost,assessmentAdminDelete } from '../../../../lib/assessment-admin';

// v0.7.0 — Admin Pretest (Super Admin). Logika ada di lib/assessment-admin.js.
export const dynamic='force-dynamic';

export async function GET(request){return assessmentAdminGet(request,'pretest')}
export async function PATCH(request){return assessmentAdminPatch(request,'pretest')}
export async function POST(request){return assessmentAdminPost(request,'pretest')}
export async function DELETE(request){return assessmentAdminDelete(request,'pretest')}
