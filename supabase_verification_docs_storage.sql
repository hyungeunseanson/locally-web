-- =============================================================================
-- verification-docs private storage contract
-- 목적:
--   - 호스트 신청 신분증 이미지를 private bucket에 저장
--   - 브라우저의 authenticated 사용자는 본인 prefix만 upload/update/delete/select 가능
--   - 관리자 상세 조회는 service_role + signed URL 발급으로 처리
-- =============================================================================

-- 1. private bucket 생성 / 유지
insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do update
set public = excluded.public;

-- 2. storage.objects RLS 활성화
alter table storage.objects enable row level security;

-- 3. 재실행 안전 처리
drop policy if exists "Verification docs owners can upload" on storage.objects;
drop policy if exists "Verification docs owners can read" on storage.objects;
drop policy if exists "Verification docs owners can update" on storage.objects;
drop policy if exists "Verification docs owners can delete" on storage.objects;

-- 4. authenticated 사용자는 본인 경로만 접근 가능
-- 경로 규칙:
--   id_card/<auth.uid()>_<timestamp>
create policy "Verification docs owners can upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'verification-docs'
  and name like 'id_card/' || auth.uid()::text || '\_%' escape '\'
);

create policy "Verification docs owners can read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'verification-docs'
  and name like 'id_card/' || auth.uid()::text || '\_%' escape '\'
);

create policy "Verification docs owners can update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'verification-docs'
  and name like 'id_card/' || auth.uid()::text || '\_%' escape '\'
)
with check (
  bucket_id = 'verification-docs'
  and name like 'id_card/' || auth.uid()::text || '\_%' escape '\'
);

create policy "Verification docs owners can delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'verification-docs'
  and name like 'id_card/' || auth.uid()::text || '\_%' escape '\'
);

-- =============================================================================
-- 검증 쿼리
-- =============================================================================
-- select id, public
-- from storage.buckets
-- where id = 'verification-docs';
--
-- select policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'storage'
--   and tablename = 'objects'
--   and (
--     coalesce(qual, '') like '%verification-docs%'
--     or coalesce(with_check, '') like '%verification-docs%'
--   )
-- order by policyname;
