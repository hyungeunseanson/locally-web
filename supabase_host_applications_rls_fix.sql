-- =============================================================================
-- host_applications 테이블 RLS 보안 수정
-- Supabase Security Advisor 이슈 해결:
--   1. Policy Exists RLS Disabled → RLS 활성화
--   2. RLS Disabled in Public → RLS 활성화
--   3. Sensitive Columns Exposed (account_number) → RLS로 접근 제한
-- =============================================================================

-- [STEP 1] RLS 활성화
-- 기존에 정책은 있었으나 RLS 자체가 꺼져 있어 정책이 무효 상태였음
ALTER TABLE public.host_applications ENABLE ROW LEVEL SECURITY;

-- [STEP 2] 기존 정책 확인 후 정리 (재실행 안전 처리)
-- 기존 정책: "Enable all access for admin logic", "Enable insert for authenticated users",
--           "Enable select for own application", "Host applications are viewable by everyone"
DROP POLICY IF EXISTS "Enable all access for admin logic"        ON public.host_applications;
DROP POLICY IF EXISTS "Enable insert for authenticated users"    ON public.host_applications;
DROP POLICY IF EXISTS "Enable select for own application"        ON public.host_applications;
DROP POLICY IF EXISTS "Host applications are viewable by everyone" ON public.host_applications;

-- [STEP 3] 새로운 RLS 정책 정의

-- SELECT: 본인 신청서만 조회 가능
-- account_number 등 민감한 컬럼이 포함되어 있으므로 본인만 조회 가능하도록 제한
-- (어드민은 service_role 키로 RLS를 우회하기 때문에 별도 정책 불필요)
CREATE POLICY "ha_select_own"
  ON public.host_applications
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: 인증된 사용자가 본인 명의로만 신청 가능
CREATE POLICY "ha_insert_own"
  ON public.host_applications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: 본인 신청서만 수정 가능
CREATE POLICY "ha_update_own"
  ON public.host_applications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 본인 신청서만 삭제 가능
CREATE POLICY "ha_delete_own"
  ON public.host_applications
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- 검증 쿼리 (실행 후 아래로 확인)
-- =============================================================================
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'host_applications';
-- → true 가 나오면 RLS 활성화 확인

-- SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'host_applications';
-- → ha_select_own, ha_insert_own, ha_update_own, ha_delete_own 4개 정책 확인
