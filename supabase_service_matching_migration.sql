-- =============================================================================
-- Locally: 맞춤형 동행/통역 서비스 — 역경매 매칭 시스템 DB 마이그레이션
-- Plan: .claude/service-matching-plan.md
-- 주의: 기존 experiences / bookings 테이블 및 로직 일절 변경 없음
-- =============================================================================

-- -----------------------------------------------------------------------------
-- [0] 사전 정리 (재실행 안전 처리)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.service_bookings CASCADE;
DROP TABLE IF EXISTS public.service_applications CASCADE;
DROP TABLE IF EXISTS public.service_requests CASCADE;
DROP FUNCTION IF EXISTS public.create_service_booking_atomic(UUID, UUID, UUID, TEXT, TEXT);


-- =============================================================================
-- [1] service_requests — 고객 의뢰
-- =============================================================================
CREATE TABLE public.service_requests (
  id                   UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 의뢰 내용
  title                TEXT         NOT NULL,
  description          TEXT         NOT NULL,
  city                 TEXT         NOT NULL,
  country              TEXT         NOT NULL DEFAULT 'JP',
  service_date         DATE         NOT NULL,
  start_time           TEXT         NOT NULL,
  duration_hours       INTEGER      NOT NULL CHECK (duration_hours >= 4),
  languages            TEXT[]       NOT NULL DEFAULT '{}',
  guest_count          INTEGER      NOT NULL DEFAULT 1 CHECK (guest_count >= 1),

  -- 고정 가격 (수수료 구조 은폐: 외부에 비율 노출 금지)
  -- 고객 단가: ₩35,000/hr, 호스트 단가: ₩20,000/hr, 플랫폼 마진: ₩15,000/hr
  hourly_rate_customer INTEGER      NOT NULL DEFAULT 35000,
  hourly_rate_host     INTEGER      NOT NULL DEFAULT 20000,
  total_customer_price INTEGER      GENERATED ALWAYS AS (hourly_rate_customer * duration_hours) STORED,
  total_host_payout    INTEGER      GENERATED ALWAYS AS (hourly_rate_host * duration_hours) STORED,

  -- 라이프사이클
  -- open → matched → paid → confirmed → completed
  -- open → cancelled / expired
  -- matched → cancelled (결제 전 취소)
  status               TEXT         NOT NULL DEFAULT 'open'
                                    CHECK (status IN ('open','matched','paid','confirmed','completed','cancelled','expired')),
  selected_application_id UUID,
  selected_host_id     UUID,

  -- 연락처 (예약 확정 후 상대방에게 공개)
  contact_name         TEXT,
  contact_phone        TEXT,

  -- 타임스탬프
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  expires_at           TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX idx_sr_user        ON public.service_requests(user_id);
CREATE INDEX idx_sr_city_status ON public.service_requests(city, status);
CREATE INDEX idx_sr_status_date ON public.service_requests(status, service_date);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.set_service_requests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sr_updated_at
  BEFORE UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_service_requests_updated_at();


-- =============================================================================
-- [2] service_applications — 호스트 지원
-- =============================================================================
CREATE TABLE public.service_applications (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id      UUID         NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  host_id         UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appeal_message  TEXT         NOT NULL,

  -- pending → selected (고객 선택됨)
  -- pending → rejected (다른 호스트 선택됨)
  -- pending → withdrawn (호스트 스스로 철회)
  status          TEXT         NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','selected','rejected','withdrawn')),

  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT unique_host_per_request UNIQUE (request_id, host_id)
);

-- 인덱스
CREATE INDEX idx_sa_request ON public.service_applications(request_id);
CREATE INDEX idx_sa_host    ON public.service_applications(host_id);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.set_service_applications_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sa_updated_at
  BEFORE UPDATE ON public.service_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_service_applications_updated_at();


-- =============================================================================
-- [3] service_bookings — 결제/정산
-- =============================================================================
CREATE TABLE public.service_bookings (
  id                  TEXT         PRIMARY KEY,          -- SVC-{YYYYMMDD}-{랜덤}
  order_id            TEXT         NOT NULL UNIQUE,       -- NicePay merchant_uid (동일값)
  request_id          UUID         NOT NULL REFERENCES public.service_requests(id),
  application_id      UUID         NOT NULL REFERENCES public.service_applications(id),
  customer_id         UUID         NOT NULL REFERENCES auth.users(id),
  host_id             UUID         NOT NULL REFERENCES auth.users(id),

  -- 결제 금액 (고객 결제 총액)
  amount              INTEGER      NOT NULL,

  -- 정산 (플랫폼 내부용 — UI에 수수료율/비율 절대 노출 금지)
  host_payout_amount  INTEGER,    -- 호스트 수령액 (20,000 × hours)
  platform_revenue    INTEGER,    -- 플랫폼 마진 (15,000 × hours)

  -- PG 결제 정보
  tid                 TEXT,       -- NicePay 트랜잭션 ID
  payment_method      TEXT        DEFAULT 'card',

  -- 상태
  -- PENDING → PAID → confirmed → completed
  -- PENDING/PAID → cancelled
  -- confirmed → cancellation_requested → cancelled
  status              TEXT        NOT NULL DEFAULT 'PENDING'
                                  CHECK (status IN ('PENDING','PAID','confirmed','completed','cancelled','cancellation_requested')),
  payout_status       TEXT        DEFAULT 'pending'
                                  CHECK (payout_status IN ('pending','processing','paid','failed')),

  -- 연락처 (예약 확정 시 복사)
  contact_name        TEXT,
  contact_phone       TEXT,

  -- 취소/환불
  cancel_reason       TEXT,
  refund_amount       INTEGER,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_sb_customer ON public.service_bookings(customer_id);
CREATE INDEX idx_sb_host     ON public.service_bookings(host_id);
CREATE INDEX idx_sb_request  ON public.service_bookings(request_id);
CREATE INDEX idx_sb_status   ON public.service_bookings(status);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.set_service_bookings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sb_updated_at
  BEFORE UPDATE ON public.service_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_service_bookings_updated_at();


-- =============================================================================
-- [4] create_service_booking_atomic — 원자적 예약 생성 RPC
-- 기존 create_booking_atomic 패턴을 준수하며 완전 독립 구현
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_service_booking_atomic(
  p_customer_id    UUID,
  p_request_id     UUID,
  p_application_id UUID,
  p_contact_name   TEXT,
  p_contact_phone  TEXT
)
RETURNS TABLE (
  new_order_id       TEXT,
  final_amount       INTEGER,
  host_payout        INTEGER,
  platform_margin    INTEGER,
  host_id            UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request         public.service_requests%ROWTYPE;
  v_application     public.service_applications%ROWTYPE;
  v_order_id        TEXT;
  v_amount          INTEGER;
  v_host_payout     INTEGER;
  v_platform_margin INTEGER;
BEGIN
  -- [1] service_requests 행 잠금 (경쟁 예약 방지)
  SELECT * INTO v_request
  FROM public.service_requests
  WHERE id = p_request_id
  FOR UPDATE;

  -- [2] 존재 여부 검증
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SVC_NOT_FOUND: 의뢰를 찾을 수 없습니다. request_id=%', p_request_id;
  END IF;

  -- [3] 상태 검증 — 반드시 'matched' 상태여야 결제 가능
  IF v_request.status != 'matched' THEN
    RAISE EXCEPTION 'SVC_INVALID_STATUS: 결제 가능한 상태가 아닙니다. 현재 status=%', v_request.status;
  END IF;

  -- [4] 고객 소유권 검증
  IF v_request.user_id != p_customer_id THEN
    RAISE EXCEPTION 'SVC_FORBIDDEN: 해당 의뢰의 소유자가 아닙니다.';
  END IF;

  -- [5] 선택된 지원서 일치 검증
  IF v_request.selected_application_id IS NULL OR v_request.selected_application_id != p_application_id THEN
    RAISE EXCEPTION 'SVC_BAD_REQUEST: 선택된 지원서가 일치하지 않습니다.';
  END IF;

  -- [6] service_applications 조회 및 상태 검증
  SELECT * INTO v_application
  FROM public.service_applications
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SVC_NOT_FOUND: 지원서를 찾을 수 없습니다. application_id=%', p_application_id;
  END IF;

  IF v_application.status != 'selected' THEN
    RAISE EXCEPTION 'SVC_INVALID_STATUS: 지원서 상태가 selected가 아닙니다. 현재 status=%', v_application.status;
  END IF;

  -- [7] 금액 계산 (generated column 값 사용)
  v_amount          := v_request.total_customer_price;  -- 35,000 × hours
  v_host_payout     := v_request.total_host_payout;     -- 20,000 × hours
  v_platform_margin := v_amount - v_host_payout;        -- 15,000 × hours (내부용)

  -- [8] SVC- 접두사 주문번호 생성 (기존 예약과 명확히 구분)
  v_order_id := 'SVC-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::TEXT, 1, 8));

  -- [9] service_bookings 삽입
  INSERT INTO public.service_bookings (
    id,
    order_id,
    request_id,
    application_id,
    customer_id,
    host_id,
    amount,
    host_payout_amount,
    platform_revenue,
    status,
    contact_name,
    contact_phone
  ) VALUES (
    v_order_id,
    v_order_id,
    p_request_id,
    p_application_id,
    p_customer_id,
    v_application.host_id,
    v_amount,
    v_host_payout,
    v_platform_margin,
    'PENDING',
    p_contact_name,
    p_contact_phone
  );

  -- [10] service_requests 상태 유지 (결제 완료는 callback에서 'paid'로 변경)
  -- 여기서는 상태 변경 없음 — callback API가 검증 후 변경

  -- [11] 결과 반환
  RETURN QUERY SELECT
    v_order_id,
    v_amount,
    v_host_payout,
    v_platform_margin,
    v_application.host_id;

END;
$$;


-- =============================================================================
-- [5] RLS (Row Level Security) 정책
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 5.1 service_requests
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 의뢰 OR open 상태 의뢰(호스트 잡보드) OR 선택된 호스트가 자신의 의뢰 확인
CREATE POLICY "sr_select" ON public.service_requests
  FOR SELECT
  USING (
    auth.uid() = user_id                                      -- 의뢰 소유자
    OR status = 'open'                                        -- 잡보드: 모든 인증 사용자가 열린 의뢰 탐색
    OR auth.uid() = selected_host_id                         -- 선택된 호스트가 자신의 매칭된 의뢰 확인
  );

-- INSERT: 인증된 사용자만 본인 명의로 생성
CREATE POLICY "sr_insert" ON public.service_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: 의뢰 소유자만 수정 가능
CREATE POLICY "sr_update" ON public.service_requests
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 소유자만 삭제 (open 상태에서만 허용은 앱 레이어에서 제어)
CREATE POLICY "sr_delete" ON public.service_requests
  FOR DELETE
  USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 5.2 service_applications
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_applications ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 지원서 OR 해당 의뢰의 소유자(고객이 지원자 목록 확인)
CREATE POLICY "sa_select" ON public.service_applications
  FOR SELECT
  USING (
    auth.uid() = host_id                                      -- 지원한 호스트 본인
    OR EXISTS (                                               -- 의뢰 소유자(고객)
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = request_id AND sr.user_id = auth.uid()
    )
  );

-- INSERT: 인증된 사용자(host_applications 승인 여부는 앱 레이어에서 검증)
-- RLS 레벨에서는 본인 host_id로만 삽입 가능하도록 제한
CREATE POLICY "sa_insert" ON public.service_applications
  FOR INSERT
  WITH CHECK (auth.uid() = host_id);

-- UPDATE: 호스트 본인만 자신의 지원서 수정 (예: 철회)
CREATE POLICY "sa_update" ON public.service_applications
  FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

-- DELETE: 호스트 본인만 삭제 가능
CREATE POLICY "sa_delete" ON public.service_applications
  FOR DELETE
  USING (auth.uid() = host_id);


-- ---------------------------------------------------------------------------
-- 5.3 service_bookings
-- service_role(서버)만 INSERT/UPDATE 가능, 당사자만 SELECT 가능
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;

-- SELECT: 고객 또는 호스트 당사자만
CREATE POLICY "sb_select" ON public.service_bookings
  FOR SELECT
  USING (
    auth.uid() = customer_id
    OR auth.uid() = host_id
  );

-- INSERT: 서버(service_role)만 — 클라이언트 직접 삽입 불가
-- service_role은 RLS를 우회하므로 별도 정책 불필요
-- 아래 정책으로 일반 사용자의 직접 INSERT 차단
CREATE POLICY "sb_insert_deny" ON public.service_bookings
  FOR INSERT
  WITH CHECK (false);

-- UPDATE: 서버(service_role)만 — 클라이언트 직접 수정 불가
CREATE POLICY "sb_update_deny" ON public.service_bookings
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

-- DELETE: 전면 차단
CREATE POLICY "sb_delete_deny" ON public.service_bookings
  FOR DELETE
  USING (false);


-- =============================================================================
-- [6] RPC 실행 권한 설정
-- =============================================================================

-- 인증된 사용자(authenticated role)가 원자적 예약 함수를 호출할 수 있도록 허용
GRANT EXECUTE ON FUNCTION public.create_service_booking_atomic(UUID, UUID, UUID, TEXT, TEXT)
  TO authenticated;

-- anon은 호출 불가
REVOKE EXECUTE ON FUNCTION public.create_service_booking_atomic(UUID, UUID, UUID, TEXT, TEXT)
  FROM anon;


-- =============================================================================
-- 마이그레이션 완료 확인용 쿼리 (실행 후 검증)
-- =============================================================================
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   AND table_name IN ('service_requests', 'service_applications', 'service_bookings');
--
-- SELECT routine_name FROM information_schema.routines
--   WHERE routine_schema = 'public'
--   AND routine_name = 'create_service_booking_atomic';
--
-- SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public'
--   AND tablename IN ('service_requests', 'service_applications', 'service_bookings');
