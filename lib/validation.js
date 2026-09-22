const allowedModes = ['Online','Offline'];
const allowedParticipants = ['practitioner','lecturer','lecturer_practitioner'];
const allowedPractice = ['Apotek','Rumah Sakit (RS)','Industri','PBF','Puskesmas'];
export const MAX_FILE = 5 * 1024 * 1024;
export const ALLOWED_TYPES = ['image/jpeg','image/png','application/pdf'];

export function clean(value, max = 255) { return String(value ?? '').trim().slice(0, max); }
export function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim()); }
export function validStraNumber(value){ return String(value ?? '').replace(/[^A-Za-z0-9]/g,'').length >= 5; }
export function isPracticeEligible(type, years) {
  const y = Number(years || 0);
  if (type === 'Puskesmas') return y >= 1;
  return ['Apotek','Rumah Sakit (RS)','Industri','PBF'].includes(type) && y >= 3;
}
export function validateProfessionalData(data) {
  const errors = {};
  if (!allowedParticipants.includes(data.participant_type)) errors.participant_type = 'Pilih kategori peserta.';
  const practitioner = ['practitioner','lecturer_practitioner'].includes(data.participant_type);
  const lecturer = ['lecturer','lecturer_practitioner'].includes(data.participant_type);
  let practiceEligible = false, teachingEligible = false;
  if (practitioner) {
    if (!allowedPractice.includes(data.practice_type)) errors.practice_type = 'Pilih jenis tempat praktik.';
    if (clean(data.practice_name,255).length < 2) errors.practice_name = 'Nama tempat praktik wajib diisi.';
    practiceEligible = isPracticeEligible(data.practice_type, data.practice_years);
  }
  if (lecturer) teachingEligible = Number(data.teaching_years || 0) >= 2;
  if (data.participant_type === 'practitioner' && !practiceEligible) errors.practice_years = 'Pengalaman praktik belum memenuhi persyaratan.';
  if (data.participant_type === 'lecturer' && !teachingEligible) errors.teaching_years = 'Dosen wajib memiliki pengalaman mengajar minimal 2 tahun.';
  if (data.participant_type === 'lecturer_practitioner' && !practiceEligible && !teachingEligible) errors.eligibility = 'Minimal salah satu jalur pengalaman harus memenuhi persyaratan.';
  return errors;
}
export function validateFile(file, label) {
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size) return `${label} wajib diunggah.`;
  if (file.size > MAX_FILE) return `${label} maksimal 5 MB.`;
  if (!ALLOWED_TYPES.includes(file.type)) return `${label} harus JPG, PNG, atau PDF.`;
  return '';
}
export function validateOptionalFile(file,label){
  if(!file || typeof file.arrayBuffer !== 'function' || !file.size) return '';
  return validateFile(file,label);
}
export function safeFileName(name='file') { return name.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-120) || 'file'; }
export { allowedModes };
