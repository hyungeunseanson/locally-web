-- ============================================================
-- v3.15.0 Review System Enhancements
-- 적용 대상: Supabase SQL Editor (service_role 권한)
-- ============================================================

-- [R6] 호스트 프로필 집계 컬럼 추가
-- 체험별 평점(experiences.rating)과 별개로, 호스트 전체 평균 평점/리뷰 수를 DB에 저장
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS total_review_count INTEGER DEFAULT 0;

-- [R5] 후기 수정 시각 컬럼 추가 (7일 이내 수정 가능 여부 추적)
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NULL;

-- [선택] 기존 호스트 프로필 집계 초기화 (마이그레이션 직후 실행)
-- 아래 쿼리는 기존 리뷰 데이터 기반으로 profiles.average_rating / total_review_count 를 초기화합니다.
-- 필요 시 주석 해제 후 실행하세요.
/*
UPDATE profiles p
SET
  average_rating = sub.avg_rating,
  total_review_count = sub.cnt
FROM (
  SELECT
    e.host_id,
    ROUND(AVG(r.rating)::numeric, 2) AS avg_rating,
    COUNT(r.id) AS cnt
  FROM reviews r
  JOIN experiences e ON e.id = r.experience_id
  GROUP BY e.host_id
) sub
WHERE p.id = sub.host_id;
*/
