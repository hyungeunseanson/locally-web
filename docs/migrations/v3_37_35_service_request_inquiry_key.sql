-- v3.37.35 Service Request Inquiry Key Migration
-- 작성일: 2026-03-08
-- 내용: 서비스 매칭 채팅을 guest-host 단위가 아니라 request 단위로 분리하기 위한 inquiries.service_request_id 추가

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS service_request_id UUID NULL;

ALTER TABLE inquiries
  DROP CONSTRAINT IF EXISTS inquiries_service_request_id_fkey;

ALTER TABLE inquiries
  ADD CONSTRAINT inquiries_service_request_id_fkey
  FOREIGN KEY (service_request_id)
  REFERENCES service_requests(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inquiries_service_request_id
  ON inquiries(service_request_id, updated_at DESC)
  WHERE service_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inquiries_service_request_scope
  ON inquiries(user_id, host_id, service_request_id)
  WHERE service_request_id IS NOT NULL
    AND type = 'general';

-- 운영 메모:
-- 1. 기존 서비스 매칭 채팅은 service_request_id가 NULL인 상태로 유지된다.
-- 2. 과거 구조상 guest-host 단위로 병합된 스레드를 request별로 자동 분리 backfill 하는 것은 안전하지 않으므로 수행하지 않는다.
-- 3. 본 SQL 적용 후 새로 생성되는 서비스 매칭 채팅부터 request 단위 식별이 활성화된다.
