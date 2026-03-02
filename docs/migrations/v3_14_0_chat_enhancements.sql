-- v3.14.0 Chat Enhancements Migration
-- 작성일: 2026-03-02
-- 내용: [M3] inquiry_messages.read_at 컬럼 추가 + [M5] inquiries.status CS 전용 상태 컬럼 추가

-- [M3] 읽음 시각 컬럼: 상대방이 읽은 정확한 시각 기록 (NULL = 아직 미읽음)
ALTER TABLE inquiry_messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ DEFAULT NULL;

-- [M5] CS 문의 상태 큐 컬럼: C2C에는 NULL, CS 전용 'open' | 'in_progress' | 'resolved'
ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT NULL;

-- 기존 admin_support 문의를 모두 'open'으로 초기화 (선택적, 운영 상황에 따라 실행)
-- UPDATE inquiries SET status = 'open' WHERE type IN ('admin_support', 'admin') AND status IS NULL;
