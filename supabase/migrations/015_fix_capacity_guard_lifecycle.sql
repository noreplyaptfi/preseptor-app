-- v0.4.20
-- Align database capacity guards with registration lifecycle accounting.
-- Only active / withdrawal_requested registrations consume quota.

create or replace function public.enforce_preseptor_capacity()
returns trigger
language plpgsql
as $$
declare
  v_quota_total integer;
  v_quota_online integer;
  v_quota_offline integer;
  v_active_total integer;
  v_active_mode integer;
begin
  -- Inactive registrations do not consume capacity.
  if coalesce(new.lifecycle_status, 'active') not in ('active', 'withdrawal_requested') then
    return new;
  end if;

  -- Serialize capacity-sensitive writes per event.
  select e.quota_total, e.quota_online, e.quota_offline
    into v_quota_total, v_quota_online, v_quota_offline
  from public.events e
  where e.id = new.event_id
  for update;

  if not found then
    raise exception 'event_not_found' using errcode = 'P0001';
  end if;

  select count(*)::integer
    into v_active_total
  from public.registrations r
  where r.event_id = new.event_id
    and coalesce(r.lifecycle_status, 'active') in ('active', 'withdrawal_requested');

  if coalesce(v_quota_total, 0) > 0 and v_active_total >= v_quota_total then
    raise exception 'quota_total_full' using errcode = 'P0001';
  end if;

  if new.attendance_mode = 'Online' then
    select count(*)::integer
      into v_active_mode
    from public.registrations r
    where r.event_id = new.event_id
      and r.attendance_mode = 'Online'
      and coalesce(r.lifecycle_status, 'active') in ('active', 'withdrawal_requested');

    if coalesce(v_quota_online, 0) > 0 and v_active_mode >= v_quota_online then
      raise exception 'quota_online_full' using errcode = 'P0001';
    end if;
  elsif new.attendance_mode = 'Offline' then
    select count(*)::integer
      into v_active_mode
    from public.registrations r
    where r.event_id = new.event_id
      and r.attendance_mode = 'Offline'
      and coalesce(r.lifecycle_status, 'active') in ('active', 'withdrawal_requested');

    if coalesce(v_quota_offline, 0) > 0 and v_active_mode >= v_quota_offline then
      raise exception 'quota_offline_full' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_preseptor_capacity_update()
returns trigger
language plpgsql
as $$
declare
  v_quota_total integer;
  v_quota_online integer;
  v_quota_offline integer;
  v_active_total integer;
  v_active_mode integer;
begin
  -- Moving a registration to an inactive lifecycle always frees capacity.
  if coalesce(new.lifecycle_status, 'active') not in ('active', 'withdrawal_requested') then
    return new;
  end if;

  -- Serialize capacity-sensitive writes per event.
  select e.quota_total, e.quota_online, e.quota_offline
    into v_quota_total, v_quota_online, v_quota_offline
  from public.events e
  where e.id = new.event_id
  for update;

  if not found then
    raise exception 'event_not_found' using errcode = 'P0001';
  end if;

  -- Exclude the row being updated; NEW represents its post-update state.
  select count(*)::integer
    into v_active_total
  from public.registrations r
  where r.event_id = new.event_id
    and r.id <> new.id
    and coalesce(r.lifecycle_status, 'active') in ('active', 'withdrawal_requested');

  if coalesce(v_quota_total, 0) > 0 and v_active_total >= v_quota_total then
    raise exception 'quota_total_full' using errcode = 'P0001';
  end if;

  if new.attendance_mode = 'Online' then
    select count(*)::integer
      into v_active_mode
    from public.registrations r
    where r.event_id = new.event_id
      and r.id <> new.id
      and r.attendance_mode = 'Online'
      and coalesce(r.lifecycle_status, 'active') in ('active', 'withdrawal_requested');

    if coalesce(v_quota_online, 0) > 0 and v_active_mode >= v_quota_online then
      raise exception 'quota_online_full' using errcode = 'P0001';
    end if;
  elsif new.attendance_mode = 'Offline' then
    select count(*)::integer
      into v_active_mode
    from public.registrations r
    where r.event_id = new.event_id
      and r.id <> new.id
      and r.attendance_mode = 'Offline'
      and coalesce(r.lifecycle_status, 'active') in ('active', 'withdrawal_requested');

    if coalesce(v_quota_offline, 0) > 0 and v_active_mode >= v_quota_offline then
      raise exception 'quota_offline_full' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

-- Existing triggers keep pointing at the same function names, so they do not
-- need to be dropped/recreated.
