-- =============================================================================
-- [Solution 1] public_host_applications 뷰 생성
-- 목적: 기존 host_applications의 엄격한 RLS 정책 우회
-- 홈 화면 체험 노출 및 프로필 페이지 노출용 읽기 전용 퍼블릭 뷰
-- =============================================================================

-- 1. 계좌번호(account_number), 이메일, 전화번호 등 민감 정보를 제외한 안전한 컬럼만 포함
CREATE OR REPLACE VIEW public.public_host_applications WITH (security_invoker = off) AS
SELECT 
  id,
  user_id,
  status,
  name,
  profile_photo,
  languages,
  self_intro,
  created_at
FROM public.host_applications;

-- 2. anon(비로그인 게스트) 및 authenticated(로그인 회원) 역할에게 읽기(SELECT) 권한 부여
GRANT SELECT ON public.public_host_applications TO anon, authenticated;

-- =============================================================================
-- 검증 쿼리 (실행 후 확인)
-- =============================================================================
-- SELECT * FROM public.public_host_applications LIMIT 5;
