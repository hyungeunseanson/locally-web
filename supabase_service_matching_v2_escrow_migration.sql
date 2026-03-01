-- =============================================================================
-- Service Matching System v2 — 에스크로 선결제 마이그레이션
-- Run AFTER: supabase_service_matching_migration.sql
-- =============================================================================

-- 1. service_requests.status 제약에 'pending_payment' 추가
ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_status_check;
ALTER TABLE service_requests
  ADD CONSTRAINT service_requests_status_check
  CHECK (status IN (
    'pending_payment',  -- 신규: 결제 대기 (잡보드 미노출)
    'open',             -- 결제 완료, 호스트 모집 중
    'matched',          -- 호스트 선택 완료
    'paid',             -- (레거시 호환)
    'confirmed',        -- (레거시 호환)
    'completed',        -- 서비스 완료
    'cancelled',        -- 취소 + 환불
    'expired'           -- 기간 만료
  ));

-- 2. service_bookings.host_id → nullable
--    에스크로 결제 시 호스트가 아직 결정되지 않은 상태를 허용
ALTER TABLE service_bookings
  ALTER COLUMN host_id DROP NOT NULL;

-- 3. service_bookings.application_id → nullable (이미 nullable일 수 있음)
ALTER TABLE service_bookings
  ALTER COLUMN application_id DROP NOT NULL;

-- 4. 성능 인덱스
CREATE INDEX IF NOT EXISTS idx_service_requests_pending_payment
  ON service_requests(user_id, created_at)
  WHERE status = 'pending_payment';

CREATE INDEX IF NOT EXISTS idx_service_requests_open_city
  ON service_requests(city, created_at)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_service_bookings_request
  ON service_bookings(request_id, status);
