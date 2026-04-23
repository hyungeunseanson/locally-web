-- Community view_count atomic increment function
-- Apply in Supabase SQL Editor (or your DB migration pipeline)

create or replace function public.increment_community_post_view_count(
  p_post_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_view_count bigint;
begin
  update public.community_posts
  set view_count = coalesce(view_count, 0) + 1
  where id = p_post_id
  returning view_count into v_next_view_count;

  return v_next_view_count;
end;
$$;

revoke all on function public.increment_community_post_view_count(uuid) from public, anon, authenticated;
grant execute on function public.increment_community_post_view_count(uuid) to service_role;
