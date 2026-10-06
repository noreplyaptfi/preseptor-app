import { assessmentAdminGet,assessmentAdminPatch,assessmentAdminPost,assessmentAdminDelete } from '../../../../lib/assessment-admin';

// v0.7.0 — Admin Posttest (Super Admin). Logika ada di lib/assessment-admin.js.
export const dynamic='force-dynamic';

export async function GET(request){return assessmentAdminGet(request,'posttest')}
export async function PATCH(request){return assessmentAdminPatch(request,'posttest')}
export async function POST(request){return assessmentAdminPost(request,'posttest')}
export async function DELETE(request){return assessmentAdminDelete(request,'posttest')}
