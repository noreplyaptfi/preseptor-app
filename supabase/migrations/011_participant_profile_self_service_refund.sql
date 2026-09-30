-- v0.4.9 Participant Profile, Self-Service & Refund Management

alter table public.registrations
  add column if not exists name_core text,
  add column if not exists title_prefix text,
  add column if not exists title_suffix text,
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists withdrawn_at timestamptz,
  add column if not exists withdrawn_reason text,
  add column if not exists withdrawn_by text;

update public.registrations
set name_core = full_name
where name_core is null or btrim(name_core) = '';

alter table public.registrations drop constraint if exists registrations_lifecycle_status_check;
alter table public.registrations
  add constraint registrations_lifecycle_status_check
  check (lifecycle_status in ('active','withdrawal_requested','withdrawn'));

create index if not exists registrations_lifecycle_status_idx
  on public.registrations(event_id,lifecycle_status);

create table if not exists public.master_data_options (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  group_key text not null,
  value text not null,
  label text not null,
  min_years numeric(6,2),
  sort_order integer not null default 100,
  active boolean not null default true,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id,group_key,value)
);

create index if not exists master_data_options_group_idx
  on public.master_data_options(event_id,group_key,active,sort_order);

create table if not exists public.self_service_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  request_type text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  reason text,
  admin_note text,
  requested_by_type text not null default 'participant',
  requested_by_email text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint self_service_requests_type_check check (request_type in ('email_change','attendance_mode_change','withdrawal')),
  constraint self_service_requests_status_check check (status in ('pending','approved','rejected','cancelled')),
  constraint self_service_requests_requester_check check (requested_by_type in ('participant','admin'))
);

create unique index if not exists self_service_requests_pending_unique
  on public.self_service_requests(registration_id,request_type)
  where status='pending';
create index if not exists self_service_requests_event_idx
  on public.self_service_requests(event_id,status,created_at desc);

create table if not exists public.refund_batches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  batch_code text not null unique,
  status text not null default 'draft',
  total_items integer not null default 0,
  total_amount numeric(14,2) not null default 0,
  notes text,
  created_by text,
  processed_by text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint refund_batches_status_check check (status in ('draft','processing','completed','cancelled'))
);

create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  withdrawal_request_id uuid references public.self_service_requests(id) on delete set null,
  batch_id uuid references public.refund_batches(id) on delete set null,
  status text not null default 'requested',
  requested_amount numeric(14,2) not null default 0,
  approved_amount numeric(14,2),
  bank_name text not null,
  account_number text not null,
  account_holder text not null,
  reason text,
  admin_note text,
  transfer_reference text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint refund_requests_status_check check (status in ('requested','under_review','ready','processing','refunded','rejected','cancelled'))
);

create unique index if not exists refund_requests_active_unique
  on public.refund_requests(registration_id)
  where status not in ('rejected','cancelled');
create index if not exists refund_requests_event_idx
  on public.refund_requests(event_id,status,requested_at desc);
create index if not exists refund_requests_batch_idx
  on public.refund_requests(batch_id);

alter table public.master_data_options enable row level security;
alter table public.self_service_requests enable row level security;
alter table public.refund_batches enable row level security;
alter table public.refund_requests enable row level security;

-- Seed master data from the form used in v0.4.8.
insert into public.master_data_options(event_id,group_key,value,label,min_years,sort_order,active,meta)
select e.id,'practice_type',x.value,x.label,x.min_years,x.sort_order,true,'{}'::jsonb
from public.events e
cross join (values
  ('Apotek','Apotek',3::numeric,10),
  ('Rumah Sakit (RS)','Rumah Sakit (RS)',3::numeric,20),
  ('Industri','Industri Farmasi',3::numeric,30),
  ('PBF','PBF',3::numeric,40),
  ('Puskesmas','Puskesmas',1::numeric,50)
) as x(value,label,min_years,sort_order)
on conflict(event_id,group_key,value) do nothing;

insert into public.master_data_options(event_id,group_key,value,label,min_years,sort_order,active,meta)
select e.id,'participant_type',x.value,x.label,null,x.sort_order,true,x.meta::jsonb
from public.events e
cross join (values
  ('practitioner','Praktisi',10,'{"requires_practice":true,"requires_teaching":false}'),
  ('lecturer','Dosen',20,'{"requires_practice":false,"requires_teaching":true,"min_teaching_years":2}'),
  ('lecturer_practitioner','Dosen & Praktisi',30,'{"requires_practice":true,"requires_teaching":true,"min_teaching_years":2}')
) as x(value,label,sort_order,meta)
on conflict(event_id,group_key,value) do nothing;
