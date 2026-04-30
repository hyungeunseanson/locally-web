-- =============================================================================
-- Locally experience translation queue stale cleanup
-- Date: 2026-05-01
--
-- Purpose:
--   Cancel only superseded active translation tasks/jobs for the two currently
--   affected production experiences, while preserving current-version tasks so
--   the existing translation cron can finish them.
--
-- Run in:
--   Supabase SQL Editor
--
-- Safety:
--   - Does not delete data.
--   - Does not update experiences, host profiles, bookings, or provider state.
--   - Aborts if the live queue no longer matches the verified recovery shape.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Preview current recovery target.
-- Expected before applying:
--   stale_active_tasks = 48
--   current_active_tasks = 5
-- ---------------------------------------------------------------------------
select
  t.experience_id,
  e.translation_version as current_translation_version,
  t.translation_version as task_translation_version,
  t.status,
  t.target_locale,
  count(*) as task_count
from public.experience_translation_tasks t
join public.experiences e on e.id = t.experience_id
where t.experience_id in (3071, 3081)
  and t.status in ('queued', 'retryable', 'leased', 'processing')
group by
  t.experience_id,
  e.translation_version,
  t.translation_version,
  t.status,
  t.target_locale
order by
  t.experience_id,
  t.translation_version,
  t.target_locale;

select
  count(*) filter (where t.translation_version <> e.translation_version) as stale_active_tasks,
  count(*) filter (where t.translation_version = e.translation_version) as current_active_tasks
from public.experience_translation_tasks t
join public.experiences e on e.id = t.experience_id
where t.experience_id in (3071, 3081)
  and t.status in ('queued', 'retryable', 'leased', 'processing');

-- ---------------------------------------------------------------------------
-- 2) Apply cleanup.
-- Guardrails:
--   - 3071 must still be active version 2.
--   - 3081 must still be active version 22.
--   - Exactly 48 stale active tasks and 5 current active tasks must exist.
-- If any guard fails, this transaction aborts before changing rows.
-- ---------------------------------------------------------------------------
begin;

do $$
declare
  v_3071 integer;
  v_3081 integer;
  stale_active_count integer;
  current_active_count integer;
begin
  select translation_version
  into v_3071
  from public.experiences
  where id = 3071
    and status = 'active';

  select translation_version
  into v_3081
  from public.experiences
  where id = 3081
    and status = 'active';

  if v_3071 is distinct from 2 then
    raise exception 'Abort stale translation cleanup: experience 3071 expected active translation_version 2, got %', v_3071;
  end if;

  if v_3081 is distinct from 22 then
    raise exception 'Abort stale translation cleanup: experience 3081 expected active translation_version 22, got %', v_3081;
  end if;

  select
    count(*) filter (where t.translation_version <> e.translation_version),
    count(*) filter (where t.translation_version = e.translation_version)
  into stale_active_count, current_active_count
  from public.experience_translation_tasks t
  join public.experiences e on e.id = t.experience_id
  where t.experience_id in (3071, 3081)
    and t.status in ('queued', 'retryable', 'leased', 'processing');

  if stale_active_count <> 48 then
    raise exception 'Abort stale translation cleanup: expected 48 stale active tasks, got %', stale_active_count;
  end if;

  if current_active_count <> 5 then
    raise exception 'Abort stale translation cleanup: expected 5 current active tasks, got %', current_active_count;
  end if;
end $$;

with stale_tasks as (
  select t.id
  from public.experience_translation_tasks t
  join public.experiences e on e.id = t.experience_id
  where t.experience_id in (3071, 3081)
    and t.status in ('queued', 'retryable', 'leased', 'processing')
    and t.translation_version <> e.translation_version
),
cancelled_tasks as (
  update public.experience_translation_tasks t
  set
    status = 'cancelled',
    completed_at = timezone('utc'::text, now()),
    lease_expires_at = null,
    last_error = 'Cancelled by 2026-05-01 operational cleanup: superseded by current experience translation_version'
  from stale_tasks s
  where t.id = s.id
  returning
    t.id,
    t.job_id,
    t.experience_id,
    t.translation_version,
    t.target_locale,
    t.status
)
select *
from cancelled_tasks
order by experience_id, translation_version, target_locale;

with stale_jobs as (
  select j.id
  from public.experience_translation_jobs j
  join public.experiences e on e.id = j.experience_id
  where j.experience_id in (3071, 3081)
    and j.translation_version <> e.translation_version
    and j.status in ('queued', 'processing')
    and not exists (
      select 1
      from public.experience_translation_tasks t
      where t.job_id = j.id
        and t.status in ('queued', 'retryable', 'leased', 'processing')
    )
),
cancelled_jobs as (
  update public.experience_translation_jobs j
  set
    status = 'cancelled',
    completed_at = timezone('utc'::text, now())
  from stale_jobs s
  where j.id = s.id
  returning
    j.id,
    j.experience_id,
    j.translation_version,
    j.status
)
select *
from cancelled_jobs
order by experience_id, translation_version;

commit;

-- ---------------------------------------------------------------------------
-- 3) Verification after cleanup.
-- Expected after applying:
--   stale_active_tasks = 0
--   current_active_tasks = 5
--   remaining current tasks:
--     3071 v2: en, ja, zh
--     3081 v22: en, ko
-- ---------------------------------------------------------------------------
select
  count(*) filter (where t.translation_version <> e.translation_version) as stale_active_tasks,
  count(*) filter (where t.translation_version = e.translation_version) as current_active_tasks
from public.experience_translation_tasks t
join public.experiences e on e.id = t.experience_id
where t.experience_id in (3071, 3081)
  and t.status in ('queued', 'retryable', 'leased', 'processing');

select
  t.experience_id,
  t.translation_version,
  t.target_locale,
  t.provider,
  t.status,
  t.not_before,
  t.lease_expires_at,
  t.last_error
from public.experience_translation_tasks t
join public.experiences e on e.id = t.experience_id
where t.experience_id in (3071, 3081)
  and t.status in ('queued', 'retryable', 'leased', 'processing')
  and t.translation_version = e.translation_version
order by
  t.experience_id,
  t.translation_version,
  t.target_locale;

select
  j.experience_id,
  j.translation_version,
  j.status,
  j.started_at,
  j.completed_at
from public.experience_translation_jobs j
where j.experience_id in (3071, 3081)
order by
  j.experience_id,
  j.translation_version;
