-- =============================================================================
-- Locally: 일본 전화 대행 서비스 - DB 마이그레이션 (1:1 티켓 게시판 방식)
-- Plan: call_proxy_architecture_proposal.md
-- =============================================================================

-- -----------------------------------------------------------------------------
-- [0] 사전 정리 (재실행 안전 처리)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.proxy_comments CASCADE;
DROP TABLE IF EXISTS public.proxy_requests CASCADE;

-- =============================================================================
-- [1] proxy_requests — 고객 전화 대행 의뢰 티켓
-- =============================================================================
CREATE TABLE public.proxy_requests (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 분류 및 상태
  category         TEXT         NOT NULL CHECK (category IN ('RESTAURANT', 'TRANSPORT', 'HOTEL', 'LOST_AND_FOUND', 'GENERAL')),
  status           TEXT         NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  
  -- 폼 입력 데이터 (카테고리별 상이한 구조를 유연하게 수용)
  form_data        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  
  -- 결제 트랙 및 메타데이터
  payment_channel  TEXT         NOT NULL CHECK (payment_channel IN ('NAVER', 'LOCALLY')),
  payment_status   TEXT         NOT NULL DEFAULT 'WAITING' CHECK (payment_status IN ('WAITING', 'COMPLETED', 'FAILED', 'REFUNDED')),
  
  -- NAVER 트랙 (구매자명) / LOCALLY 트랙 (자체 PG 주문번호)
  naver_buyer_name TEXT,
  locally_order_id TEXT,
  
  -- 필수 규정 동의 여부 (앱 레벨에서 Zod로 검증하지만, DB에도 이력 보관)
  agreed_to_terms  BOOLEAN      NOT NULL DEFAULT false,
  
  -- 타임스탬프
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_pr_user ON public.proxy_requests(user_id);
CREATE INDEX idx_pr_status ON public.proxy_requests(status);
CREATE INDEX idx_pr_category ON public.proxy_requests(category);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.set_proxy_requests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pr_updated_at
  BEFORE UPDATE ON public.proxy_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_proxy_requests_updated_at();

-- =============================================================================
-- [2] proxy_comments — 양방향 소통 스레드 (댓글)
-- =============================================================================
CREATE TABLE public.proxy_comments (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id       UUID         NOT NULL REFERENCES public.proxy_requests(id) ON DELETE CASCADE,
  author_id        UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  content          TEXT         NOT NULL,
  is_admin         BOOLEAN      NOT NULL DEFAULT false, -- 관리자 작성 여부
  
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_pc_request ON public.proxy_comments(request_id);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.set_proxy_comments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pc_updated_at
  BEFORE UPDATE ON public.proxy_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_proxy_comments_updated_at();


-- =============================================================================
-- [3] RLS (Row Level Security) 정책
-- =============================================================================

-- ---------------------------------------------------------------------------
-- proxy_requests 정책
-- ---------------------------------------------------------------------------
ALTER TABLE public.proxy_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: 고객은 자신의 의뢰만, 관리자는 전체 의뢰 조회
CREATE POLICY "pr_select" ON public.proxy_requests
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.admin_whitelist WHERE email = (auth.jwt() ->> 'email')::text)
  );

-- INSERT: 인증된 사용자가 본인 명의로만 생성 가능
CREATE POLICY "pr_insert" ON public.proxy_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: 고객은 자신의 의뢰(예: 취소) 수정, 관리자는 전체 수정(상태 변경 등) 가능
CREATE POLICY "pr_update" ON public.proxy_requests
  FOR UPDATE
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.admin_whitelist WHERE email = (auth.jwt() ->> 'email')::text)
  )
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.admin_whitelist WHERE email = (auth.jwt() ->> 'email')::text)
  );

-- DELETE: 관리자만 권한 부여 (고객은 취소 상태로만 변경 유도)
CREATE POLICY "pr_delete" ON public.proxy_requests
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.admin_whitelist WHERE email = (auth.jwt() ->> 'email')::text));


-- ---------------------------------------------------------------------------
-- proxy_comments 정책
-- ---------------------------------------------------------------------------
ALTER TABLE public.proxy_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: 해당 request의 소유자(고객)이거나 관리자일 경우
CREATE POLICY "pc_select" ON public.proxy_comments
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.proxy_requests WHERE id = request_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.admin_whitelist WHERE email = (auth.jwt() ->> 'email')::text)
  );

-- INSERT: 해당 request의 소유자(고객)이거나 관리자일 경우
CREATE POLICY "pc_insert" ON public.proxy_comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = author_id AND (
      EXISTS (SELECT 1 FROM public.proxy_requests WHERE id = request_id AND user_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM public.admin_whitelist WHERE email = (auth.jwt() ->> 'email')::text)
    )
  );

-- UPDATE: 본인이 작성한 댓글만 수정 가능 (혹은 시스템에 따라 수정 불가 처리 가능)
CREATE POLICY "pc_update" ON public.proxy_comments
  FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- DELETE: 관리자 혹은 본인이 작성한 댓글 삭제
CREATE POLICY "pc_delete" ON public.proxy_comments
  FOR DELETE
  USING (
    auth.uid() = author_id OR
    EXISTS (SELECT 1 FROM public.admin_whitelist WHERE email = (auth.jwt() ->> 'email')::text)
  );
