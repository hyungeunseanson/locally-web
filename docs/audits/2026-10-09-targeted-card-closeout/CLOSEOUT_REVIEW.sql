-- 검토용. 이번 단계에서 운영 실행하지 않는다. 실제 금융 API 호출은 전혀 포함하지 않는다.
-- 승인 후: schema 적용 -> A/B 승인 차단 코드를 모든 운영 트래픽에 적용/검증 -> 백업/SELECT 비교 -> 이 종료 트랜잭션.
-- 추가 Gate: 구 Worker 요청 배출/롤백 차단, 운영 PostgREST 409 + 증거 COMMIT 호환 검증.
-- 다음 플래그는 운영자가 확보한 증거의 명시적 확인값이며 RPC가 외부 배포 상태를 자동 검증하지 않는다.
-- REVIEW_ONLY 예외는 사용자 승인 후 실행 책임자가 제거한다. ROLLBACK이 기본값이다.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='15s';
DO $$ BEGIN RAISE EXCEPTION 'REVIEW_ONLY_NO_PRODUCTION_EXECUTION_APPROVAL'; END $$;

-- 신뢰된 DB 운영자 세션에서만 사용. 일반 사용자의 권한을 바꾸는 구문이 아니다.
-- 승인된 service_role 서버 RPC 호출로 아래 함수/동일 인수를 전달해도 된다.
SET LOCAL request.jwt.claim.role='service_role';

-- 실제 승인 참조와 배포 증거를 넣는다. 값이 바뀌었다면 기존 검토안을 그대로 실행하지 않는다.
SELECT public.close_targeted_card_attempts_atomic(
 'REPLACE_WITH_ACTUAL_USER_APPROVAL_REFERENCE',
 'f0b5a7ec5234fd115183603c3fdf3354',
 jsonb_build_object('decision','operational_incomplete',
  'runtime_mid_matches_admin',true,'approval_fence_deployed',true,
  'old_workers_drained',true,
    'alternate_worker_paths_blocked',true,
    'financial_visibility_verified',true,'legacy_rpc_409_commit_verified',true,
  'deployment_reference','REPLACE_WITH_VERIFIED_PRODUCTION_VERSION',
  'nicepay_admin_evidence','2026-10-09 A/B 승인·취소·실패 없음, C 46200원 승인',
  'scope','A/B hold only; no PG approval/cancel/refund; C protected')
);

-- 기대: closed_count=2, already_closed=false. 재호출은 closed_count=0, already_closed=true.
DO $$
DECLARE v_confirmed integer; v_pending integer; v_remaining integer;
BEGIN
 IF (SELECT md5(to_jsonb(b)::text) FROM public.bookings b WHERE id='ORD-20261009014356883-813')
  IS DISTINCT FROM 'f0b5a7ec5234fd115183603c3fdf3354' THEN RAISE EXCEPTION 'PROTECTED_C_CHANGED'; END IF;
 IF (SELECT count(*) FROM public.bookings WHERE id IN
  ('ORD-20261008232253248-691','ORD-20261008232336792-577') AND status='cancelled'
  AND payment_claim_state='released' AND tid IS NULL AND refund_amount=0
  AND host_payout_amount=0 AND platform_revenue=0 AND amount=46200)<>2 THEN
  RAISE EXCEPTION 'TARGET_PAIR_VERIFY_FAILED'; END IF;
 SELECT coalesce(sum(guests) FILTER(WHERE lower(status) IN ('paid','confirmed')),0),
  coalesce(sum(guests) FILTER(WHERE lower(status)='pending'),0),
  4-coalesce(sum(guests) FILTER(WHERE lower(status) IN ('pending','paid','confirmed')),0)
 INTO v_confirmed,v_pending,v_remaining FROM public.bookings
 WHERE experience_id=4659 AND date='2026-10-15' AND time='12:00';
 IF v_confirmed<>1 OR v_pending<>0 OR v_remaining<>3 THEN RAISE EXCEPTION 'SLOT_VERIFY_FAILED'; END IF;
 IF (SELECT count(*) FROM private.targeted_card_closeouts)<>2 THEN RAISE EXCEPTION 'AUDIT_BACKUP_MISSING'; END IF;
END $$;

ROLLBACK;
-- 실제 종료 승인은 보호코드 적용과 사전 검증을 포함한다. 승인된 실행에서만 위 ROLLBACK을 COMMIT으로 바꾼다.
-- 어떤 단계든 실패하면 전체 ROLLBACK. COMMIT 후 A/B를 PENDING으로 되돌리는 자동 롤백은 제공하지 않는다.
