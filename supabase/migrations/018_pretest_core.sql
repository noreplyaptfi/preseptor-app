-- APTFI Preseptor v0.6.0 — Pretest Core
-- Engine dibuat generik agar dapat dipakai ulang untuk Posttest/Evaluasi pada update berikutnya.

create table if not exists public.assessment_modules (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  kind text not null check (kind in ('pretest','posttest','evaluation')),
  title text not null,
  description text,
  active boolean not null default false,
  open_at timestamptz,
  close_at timestamptz,
  show_score boolean not null default true,
  requires_day_number integer check (requires_day_number is null or requires_day_number > 0),
  max_attempts integer not null default 1 check (max_attempts between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id,kind)
);

create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessment_modules(id) on delete cascade,
  position integer not null default 1 check (position > 0),
  question_text text not null,
  question_type text not null default 'single_choice' check (question_type in ('single_choice','likert','text')),
  required boolean not null default true,
  points numeric(8,2) not null default 1 check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assessment_questions_module_idx
  on public.assessment_questions(assessment_id,position,id);

create table if not exists public.assessment_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.assessment_questions(id) on delete cascade,
  position integer not null default 1 check (position > 0),
  option_text text not null,
  is_correct boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists assessment_options_question_idx
  on public.assessment_options(question_id,position,id);

create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessment_modules(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  attempt_no integer not null default 1 check (attempt_no > 0),
  status text not null default 'submitted' check (status in ('draft','submitted')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric(10,2),
  max_score numeric(10,2),
  correct_count integer,
  total_questions integer,
  created_at timestamptz not null default now(),
  unique(assessment_id,registration_id,attempt_no)
);

create index if not exists assessment_attempts_module_idx
  on public.assessment_attempts(assessment_id,submitted_at desc);
create index if not exists assessment_attempts_registration_idx
  on public.assessment_attempts(registration_id,assessment_id);

create table if not exists public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  question_id uuid not null references public.assessment_questions(id) on delete cascade,
  selected_option_id uuid references public.assessment_options(id) on delete set null,
  text_answer text,
  is_correct boolean,
  points_awarded numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  unique(attempt_id,question_id)
);

create index if not exists assessment_answers_attempt_idx
  on public.assessment_answers(attempt_id,question_id);

alter table public.assessment_modules enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_options enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.assessment_answers enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='assessment_modules' and policyname='admins read assessment modules'
  ) then
    create policy "admins read assessment modules" on public.assessment_modules
      for select to authenticated using (public.is_aptfi_admin());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='assessment_questions' and policyname='admins read assessment questions'
  ) then
    create policy "admins read assessment questions" on public.assessment_questions
      for select to authenticated using (public.is_aptfi_admin());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='assessment_options' and policyname='admins read assessment options'
  ) then
    create policy "admins read assessment options" on public.assessment_options
      for select to authenticated using (public.is_aptfi_admin());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='assessment_attempts' and policyname='participants read own assessment attempts'
  ) then
    create policy "participants read own assessment attempts" on public.assessment_attempts
      for select to authenticated using (
        public.is_aptfi_admin()
        or exists (
          select 1 from public.registrations r
          where r.id=registration_id
            and lower(r.email::text)=lower(coalesce(auth.jwt()->>'email',''))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='assessment_answers' and policyname='participants read own assessment answers'
  ) then
    create policy "participants read own assessment answers" on public.assessment_answers
      for select to authenticated using (
        public.is_aptfi_admin()
        or exists (
          select 1
          from public.assessment_attempts a
          join public.registrations r on r.id=a.registration_id
          where a.id=attempt_id
            and lower(r.email::text)=lower(coalesce(auth.jwt()->>'email',''))
        )
      );
  end if;
end $$;

insert into public.assessment_modules(
  event_id,kind,title,description,active,show_score,requires_day_number,max_attempts
)
select e.id,'pretest','Pretest Pelatihan Preseptor',
       'Kerjakan pretest setelah presensi Hari 1. Satu peserta hanya dapat mengirim satu kali.',
       false,true,1,1
from public.events e
where e.slug='preseptor-2026'
on conflict(event_id,kind) do nothing;
