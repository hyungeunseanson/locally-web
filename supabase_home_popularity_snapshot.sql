-- =============================================================================
-- Home popularity snapshot contract
-- 목적:
--   - 홈 인기 체험 랭킹용 wishlist count를 공개 snapshot으로 제공
--   - raw wishlists row는 계속 보호하고, 공개 가능한 집계값만 노출
--   - refresh는 service-role 경계 cron route에서만 수행
-- =============================================================================

create table if not exists public.experience_popularity_snapshot (
  experience_id bigint primary key references public.experiences(id) on delete cascade,
  wishlist_count integer not null,
  computed_at timestamptz not null
);

create index if not exists experience_popularity_snapshot_wishlist_count_idx
  on public.experience_popularity_snapshot (wishlist_count desc);

create index if not exists experience_popularity_snapshot_computed_at_idx
  on public.experience_popularity_snapshot (computed_at desc);

alter table public.experience_popularity_snapshot enable row level security;

drop policy if exists "Public can read experience popularity snapshot" on public.experience_popularity_snapshot;

create policy "Public can read experience popularity snapshot"
on public.experience_popularity_snapshot
for select
to anon, authenticated
using (true);

grant select on public.experience_popularity_snapshot to anon, authenticated;

create or replace function public.refresh_experience_popularity_snapshot()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot_now timestamptz := now();
  inserted_count integer := 0;
begin
  truncate table public.experience_popularity_snapshot;

  insert into public.experience_popularity_snapshot (
    experience_id,
    wishlist_count,
    computed_at
  )
  select
    w.experience_id,
    count(*)::integer as wishlist_count,
    snapshot_now
  from public.wishlists w
  group by w.experience_id;

  get diagnostics inserted_count = row_count;
  return coalesce(inserted_count, 0);
end;
$$;

revoke all on function public.refresh_experience_popularity_snapshot() from public;
revoke all on function public.refresh_experience_popularity_snapshot() from anon;
revoke all on function public.refresh_experience_popularity_snapshot() from authenticated;
grant execute on function public.refresh_experience_popularity_snapshot() to service_role;
