-- APTFI Preseptor v0.2.2
-- Per-document review metadata + duplicate-registration protection.

alter table public.registrations add column if not exists stra_number text;
alter table public.registrations add column if not exists normalized_email text;
alter table public.registrations add column if not exists normalized_whatsapp text;
alter table public.registrations add column if not exists normalized_stra text;

alter table public.registration_documents add column if not exists review_note text;
alter table public.registration_documents add column if not exists next_action text;
alter table public.registration_documents add column if not exists reviewed_at timestamptz;
alter table public.registration_documents add column if not exists reviewed_by citext;

-- Align per-document status with aggregate statuses created by v0.2.1.
update public.registration_documents d
set status='valid', reviewed_at=coalesce(d.reviewed_at,r.requirements_verified_at), reviewed_by=coalesce(d.reviewed_by,r.requirements_verified_by)
from public.registrations r
where d.registration_id=r.id and d.document_type in ('stra','experience') and r.requirements_status='valid' and d.status='pending';

update public.registration_documents d
set status='valid', reviewed_at=coalesce(d.reviewed_at,r.payment_verified_at), reviewed_by=coalesce(d.reviewed_by,r.payment_verified_by)
from public.registrations r
where d.registration_id=r.id and d.document_type='payment_proof' and r.payment_status='verified' and d.status='pending';

update public.registration_documents d
set status='rejected',
    review_note=coalesce(d.review_note,'Status ditolak pada versi sistem sebelumnya. Silakan periksa kembali catatan panitia.'),
    next_action=coalesce(d.next_action,'Silakan tindak lanjuti melalui Dashboard Peserta atau hubungi panitia.'),
    reviewed_at=coalesce(d.reviewed_at,r.payment_verified_at),
    reviewed_by=coalesce(d.reviewed_by,r.payment_verified_by)
from public.registrations r
where d.registration_id=r.id and d.document_type='payment_proof' and r.payment_status='rejected' and d.status='pending';

-- Populate normalized values only when they are unique inside an event.
-- This keeps the migration safe if historical/legacy rows already contain a duplicate phone.
with candidates as (
  select id,event_id,lower(trim(email::text)) as value,
         count(*) over (partition by event_id, lower(trim(email::text))) as n
  from public.registrations
  where nullif(trim(email::text),'') is not null
)
update public.registrations r
set normalized_email=c.value
from candidates c
where r.id=c.id and c.n=1 and r.normalized_email is null;

with candidates as (
  select id,event_id,created_at,
    case
      when regexp_replace(coalesce(whatsapp,''),'[^0-9]','','g') like '0%'
        then '62' || substr(regexp_replace(coalesce(whatsapp,''),'[^0-9]','','g'),2)
      when regexp_replace(coalesce(whatsapp,''),'[^0-9]','','g') like '8%'
        then '62' || regexp_replace(coalesce(whatsapp,''),'[^0-9]','','g')
      else regexp_replace(coalesce(whatsapp,''),'[^0-9]','','g')
    end as value
  from public.registrations
), ranked as (
  select *,row_number() over (partition by event_id,value order by created_at,id) as rn
  from candidates where nullif(value,'') is not null
)
update public.registrations r
set normalized_whatsapp=c.value
from ranked c
where r.id=c.id and c.rn=1 and r.normalized_whatsapp is null;

with candidates as (
  select id,event_id,upper(regexp_replace(coalesce(stra_number,''),'[^A-Za-z0-9]','','g')) as value
  from public.registrations
), counted as (
  select *,count(*) over (partition by event_id,value) as n from candidates where nullif(value,'') is not null
)
update public.registrations r
set normalized_stra=c.value
from counted c
where r.id=c.id and c.n=1 and r.normalized_stra is null;

create unique index if not exists registrations_event_normalized_email_unique
  on public.registrations(event_id,normalized_email)
  where normalized_email is not null;

create unique index if not exists registrations_event_normalized_whatsapp_unique
  on public.registrations(event_id,normalized_whatsapp)
  where normalized_whatsapp is not null;

create unique index if not exists registrations_event_normalized_stra_unique
  on public.registrations(event_id,normalized_stra)
  where normalized_stra is not null;

create index if not exists registration_documents_review_idx
  on public.registration_documents(registration_id,document_type,status);
