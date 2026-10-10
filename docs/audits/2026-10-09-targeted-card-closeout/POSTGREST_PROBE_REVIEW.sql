-- 검토용. 운영 승인 없이 실행 금지. 금융 테이블/예약/TID/PG API 접근 없음.
-- 승인 범위: private 테이블 1개(최대 1행), service_role RPC 1개, COMMIT 1회.
-- 다음 예외 제거와 COMMIT 변경은 실행 책임자의 별도 승인 후에만 허용.
BEGIN;
DO $$ BEGIN RAISE EXCEPTION 'REVIEW_ONLY_POSTGREST_PROBE_NOT_AUTHORIZED'; END $$;
-- PROBE_SETUP_BEGIN
CREATE TABLE private.phase1_postgrest_commit_probe (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  nonce uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',
  observed_at timestamptz,
  http_status integer CHECK(http_status=409)
);
ALTER TABLE private.phase1_postgrest_commit_probe ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.phase1_postgrest_commit_probe FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO private.phase1_postgrest_commit_probe DEFAULT VALUES;
CREATE FUNCTION public.phase1_postgrest_commit_probe_atomic(p_nonce uuid)
RETURNS TABLE(outcome text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p private.phase1_postgrest_commit_probe;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'PROBE_FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT * INTO p FROM private.phase1_postgrest_commit_probe WHERE singleton FOR UPDATE;
  IF p.nonce IS DISTINCT FROM p_nonce OR p.expires_at<now() THEN RAISE EXCEPTION 'PROBE_CLOSED'; END IF;
  UPDATE private.phase1_postgrest_commit_probe SET observed_at=coalesce(observed_at,now()),http_status=409 WHERE singleton;
  PERFORM set_config('response.status','409',true);
  RETURN QUERY SELECT 'targeted_closeout_review_required'::text;
END $$;
REVOKE ALL ON FUNCTION public.phase1_postgrest_commit_probe_atomic(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase1_postgrest_commit_probe_atomic(uuid) TO service_role;
NOTIFY pgrst,'reload schema';
-- PROBE_SETUP_END
ROLLBACK;

-- 별도 승인 후 관찰: 기존 안전한 운영 서버 service_role 환경의 동일 버전
-- supabase-js .rpc('phase1_postgrest_commit_probe_atomic',{p_nonce}).maybeSingle().
-- key/nonce 원문을 출력하거나 클라이언트에 전달하지 않는다. Prefer tx=commit
-- 강제 지정 없이 구 Worker와 동일 기본 헤더/경로를 사용한다. 기대: HTTP 409,
-- 클라이언트 error != null, data == null. 독립 SELECT에서 observed_at NOT NULL.
-- 409와 증거 커밋을 모두 얻지 못하면 A/B 종료 금지. 익명 RPC는 401/403/404.
-- 검증 전후 A/B/C 전체 행 지문, 금융 원장 count/hash가 같아야 한다.
-- 성공/실패/timeout 모두 금융 테이블은 변경하지 않는다. timeout 재호출은
-- 동일 nonce 1행에만 멱등 기록; 새 nonce 생성/금융 거래 재시도 금지.

-- 승인된 복구: 증거 SELECT를 보관한 뒤 RPC 권한 회수 및 2개 probe 객체만 제거.
-- 금융 migration/원장/기존 RPC는 제거하지 않는다. 별도 cleanup 승인 필요.
BEGIN;
DO $$ BEGIN RAISE EXCEPTION 'REVIEW_ONLY_POSTGREST_PROBE_CLEANUP_NOT_AUTHORIZED'; END $$;
REVOKE EXECUTE ON FUNCTION public.phase1_postgrest_commit_probe_atomic(uuid) FROM service_role;
DROP FUNCTION public.phase1_postgrest_commit_probe_atomic(uuid);
DROP TABLE private.phase1_postgrest_commit_probe;
NOTIFY pgrst,'reload schema';
ROLLBACK;
