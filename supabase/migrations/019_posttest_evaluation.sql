-- APTFI Preseptor v0.7.0 — Posttest & Evaluasi
-- Melanjutkan engine assessment dari 018:
--   * attempt tanpa batas (max_attempts NULL) + nilai lulus (pass_percent)
--   * tipe soal skala (likert) dan isian (text) dengan section/label skala
--   * pemateri/narasumber sebagai target evaluasi
--   * jawaban per pemateri
--   * seed modul Posttest & Evaluasi (NONAKTIF) + jadwal default
-- Aman dijalankan ulang (idempotent). Tidak menghapus data hasil Pretest.

-- 1) Modul: attempt tanpa batas + nilai lulus -------------------------------
alter table public.assessment_modules drop constraint if exists assessment_modules_max_attempts_check;
alter table public.assessment_modules alter column max_attempts drop not null;
alter table public.assessment_modules
  add constraint assessment_modules_max_attempts_check
  check (max_attempts is null or max_attempts >= 1);

alter table public.assessment_modules
  add column if not exists pass_percent numeric(5,2);
alter table public.assessment_modules drop constraint if exists assessment_modules_pass_percent_check;
alter table public.assessment_modules
  add constraint assessment_modules_pass_percent_check
  check (pass_percent is null or (pass_percent >= 0 and pass_percent <= 100));

-- 2) Soal: section + skala ---------------------------------------------------
alter table public.assessment_questions add column if not exists section text;
alter table public.assessment_questions add column if not exists scale_min integer not null default 1;
alter table public.assessment_questions add column if not exists scale_max integer not null default 5;
alter table public.assessment_questions add column if not exists scale_min_label text;
alter table public.assessment_questions add column if not exists scale_max_label text;
alter table public.assessment_questions drop constraint if exists assessment_questions_scale_check;
alter table public.assessment_questions
  add constraint assessment_questions_scale_check
  check (scale_min >= 0 and scale_max <= 10 and scale_min < scale_max);

-- 3) Pemateri / narasumber (target evaluasi) ---------------------------------
create table if not exists public.assessment_targets (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessment_modules(id) on delete cascade,
  position integer not null default 1 check (position > 0),
  name text not null,
  affiliation text,
  topic text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assessment_targets_module_idx
  on public.assessment_targets(assessment_id,position,id);

alter table public.assessment_targets enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='assessment_targets' and policyname='admins read assessment targets'
  ) then
    create policy "admins read assessment targets" on public.assessment_targets
      for select to authenticated using (public.is_aptfi_admin());
  end if;
end $$;

-- 4) Jawaban per pemateri + nilai skala ---------------------------------------
alter table public.assessment_answers
  add column if not exists target_id uuid references public.assessment_targets(id) on delete cascade;
alter table public.assessment_answers
  add column if not exists likert_value smallint;
alter table public.assessment_answers drop constraint if exists assessment_answers_likert_value_check;
alter table public.assessment_answers
  add constraint assessment_answers_likert_value_check
  check (likert_value is null or likert_value between 0 and 10);

-- Satu jawaban per soal per attempt, kini per pemateri.
alter table public.assessment_answers drop constraint if exists assessment_answers_attempt_id_question_id_key;
create unique index if not exists assessment_answers_attempt_question_target_uidx
  on public.assessment_answers(attempt_id,question_id,coalesce(target_id,'00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists assessment_answers_target_idx
  on public.assessment_answers(target_id);

-- 5) Modul Posttest & Evaluasi (NONAKTIF sampai diaktifkan Super Admin) -------
insert into public.assessment_modules(
  event_id,kind,title,description,active,open_at,close_at,show_score,requires_day_number,max_attempts,pass_percent
)
select e.id,'posttest','Posttest Pelatihan Preseptor',
       'Posttest dapat dikerjakan berulang kali selama jadwal masih dibuka. Nilai terbaik yang digunakan, batas lulus 80.',
       false,
       '2026-10-08 16:00:00+07'::timestamptz,
       '2026-10-08 18:00:00+07'::timestamptz,
       true,2,null,80
from public.events e
where e.slug='preseptor-2026'
on conflict(event_id,kind) do nothing;

insert into public.assessment_modules(
  event_id,kind,title,description,active,open_at,close_at,show_score,requires_day_number,max_attempts,pass_percent
)
select e.id,'evaluation','Evaluasi Kepuasan Pelatihan',
       'Isi kuesioner kepuasan untuk masing-masing pemateri. Evaluasi hanya dikirim satu kali.',
       false,
       '2026-10-08 14:00:00+07'::timestamptz,
       '2026-10-08 17:00:00+07'::timestamptz,
       false,2,1,null
from public.events e
where e.slug='preseptor-2026'
on conflict(event_id,kind) do nothing;

-- Pretest: isi jadwal default 7 Okt 08.00–10.00 WIB hanya bila belum diisi admin.
update public.assessment_modules m
set open_at=coalesce(m.open_at,'2026-10-07 08:00:00+07'::timestamptz),
    close_at=coalesce(m.close_at,'2026-10-07 10:00:00+07'::timestamptz),
    updated_at=now()
from public.events e
where m.event_id=e.id and e.slug='preseptor-2026' and m.kind='pretest'
  and (m.open_at is null or m.close_at is null);

-- Bank soal & daftar pemateri dimuat dari Admin:
--   Pelaksanaan -> Pretest/Evaluasi/Posttest -> "Muat bank soal standar APTFI".
