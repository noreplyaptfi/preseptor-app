-- v0.4.21
-- Peserta khusus lama yang dibuat sebelum flow dokumen awal diperbaiki bisa berstatus
-- requirements_status='pending' walaupun belum memiliki STRA / bukti pengalaman.
-- Normalisasi hanya record peserta khusus aktif yang memang masih kekurangan dokumen.

update public.registrations r
set
  requirements_status = 'incomplete',
  updated_at = now()
where r.enrollment_source = 'admin_special'
  and r.lifecycle_status in ('active','withdrawal_requested')
  and r.requirements_status = 'pending'
  and (
    not exists (
      select 1
      from public.registration_documents d
      where d.registration_id = r.id
        and d.document_type = 'stra'
    )
    or not exists (
      select 1
      from public.registration_documents d
      where d.registration_id = r.id
        and d.document_type = 'experience'
    )
  );
