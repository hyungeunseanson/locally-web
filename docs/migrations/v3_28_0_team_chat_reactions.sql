-- ============================================================
-- v3.28.0 Team Chat: Reactions + Read Receipts
-- ============================================================
-- 실행: Supabase 콘솔 > SQL Editor에서 실행 후 코드 배포
-- 회귀 위험 없음: 기존 컬럼/데이터 변경 없이 새 컬럼만 추가 (DEFAULT 값 보장)
-- ============================================================

-- 1. 리액션 컬럼 추가
--    구조: { "❤️": ["user_id_1", "user_id_2"], "✅": ["user_id_3"] }
ALTER TABLE admin_task_comments
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;

-- 2. 읽음 처리 컬럼 추가
--    구조: ["user_id_1", "user_id_2"] (읽은 사용자 ID 배열)
ALTER TABLE admin_task_comments
ADD COLUMN IF NOT EXISTS read_by TEXT[] DEFAULT '{}';

-- 결과 확인
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'admin_task_comments'
AND column_name IN ('reactions', 'read_by');
