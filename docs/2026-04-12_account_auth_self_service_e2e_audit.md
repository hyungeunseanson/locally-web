# 계정·인증 self-service 경계 엔드투엔드 구조 점검

## Summary
- 감사 범위: `로그인 진입 / 회원가입 / returnUrl 복귀 / OAuth 복귀 / account 진입 / help FAQ 기반 self-service 안내`
- 제외 범위: `호스트 신청`, `예약/결제 상태 머신`, `실제 계정 삭제 처리`, `비밀번호 재설정 기능 구현`, live mutation 재실행
- 실행 방식: 정적 코드 감사 + 핵심 non-live E2E 재실행
- latest run
  - `12 passed (24.1s)`
  - rerun bundle
    - `tests/e2e/108-login-flow-guidance.spec.ts`
    - `tests/e2e/128-auth-success-transition.spec.ts`
    - `tests/e2e/169-account-accessibility-auth-surfaces.spec.ts`
- 이번 패스 핵심 결론
  - `/login` page, `LoginModal`, `AuthContext`, `/account`, `/help`는 현재 제품 의미를 대체로 일관되게 공유한다
  - 회원가입 비밀번호 확인 2칸, protected page의 canonical `returnUrl`, “비밀번호 재설정 미지원 / 회원 탈퇴는 운영팀 문의” 문구는 최신 기준으로 실제 구현과 맞는다
  - `/account` 모바일 로그아웃 surface도 현재 `AuthContext.signOut()` 단일 owner를 공유하며, auth-adjacent localStorage cleanup까지 포함한 공통 계약이 실제 테스트로 닫혔다
  - 따라서 현재 최종 판정은 `계정·인증 self-service core는 정상`이다

## Result Snapshot
| Chain | Source of truth | Current tests | Verdict | Notes |
| --- | --- | --- | --- | --- |
| 로그인 진입 / returnUrl 정규화 | `app/login/page.tsx`, `normalizeReturnUrl()` | `108` | 정상 | 외부 URL, `//`, `javascript:`는 `/`로 fail-closed 되고, 내부 상대 경로만 복귀 대상으로 허용된다 |
| 회원가입 / 로그인 modal surface | `app/components/LoginModal.tsx` | `128`, `169` | 정상 | signup은 `LoginModal` 단일 surface로 유지되고, 비밀번호 확인 2칸과 필수값 검증이 client에서 먼저 잠긴다 |
| 인증 성공 후 전환 | `LoginModal.finalizeSuccessfulAuth()`, `/auth/callback?next=...` | `128` | 정상 | 로그인 성공은 success toast 후 즉시 복귀하고, verification-needed signup은 LOGIN 모드로 바로 돌아온다 |
| protected guest page 복귀 | `/guest/inbox`, `/guest/wishlists`, `/account` direct entry | `108` | 정상 | 비로그인 직접 진입 시 canonical `returnUrl`을 붙여 `/login`으로 보내고, 성공 후 같은 path로 복귀한다 |
| account self-service 안내 | `app/account/page.tsx`, `app/help/page.tsx`, `LanguageContext` FAQ copy | `169` | 정상 | “회원 탈퇴는 운영팀 문의”, “비밀번호 재설정 미지원” 문구가 현재 실제 구현과 일치한다 |
| 로그아웃 contract parity | `AuthContext.signOut()`, `SiteHeader`, `app/account/page.tsx` | `169` | 정상 | account 모바일 로그아웃 surface도 shared signOut을 사용하고, `/` 복귀와 auth-adjacent localStorage cleanup이 함께 검증됐다 |

## Confirmed Findings
### 1. `/login` page는 현재 내부 경로 복귀 전용 surface로 잘 잠겨 있다
- source of truth
  - [app/login/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/login/page.tsx:1)
- 현재 계약
  - `returnUrl` 또는 `next`는 내부 상대 경로만 허용
  - 이미 로그인된 사용자는 `/login` 진입 시 즉시 정규화된 복귀 경로로 이동
  - `returnUrl`이 없거나 비정상이면 `/`로 fallback
- 근거 테스트
  - [tests/e2e/108-login-flow-guidance.spec.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/tests/e2e/108-login-flow-guidance.spec.ts:1)
    - `/login?returnUrl=%2Fguest%2Ftrips`
    - `https://evil.example`
    - `//evil.example`
    - `javascript:...`

### 2. 회원가입 대표 경로는 여전히 `LoginModal`의 `SIGNUP` 모드다
- source of truth
  - [app/components/LoginModal.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/components/LoginModal.tsx:1)
- 현재 계약
  - 독립 `/signup` page는 현재 runtime surface로 보이지 않는다
  - signup은 `LoginModal`에서만 처리한다
  - client-side validation은 아래를 먼저 막는다
    - email/password 공란
    - `passwordConfirm` 공란
    - password mismatch
    - real name / nationality / phone / birth date / gender 누락
    - 약관 미동의
- 특히 이번 감사 기준으로 중요한 점
  - `passwordConfirm` 입력칸이 실제로 렌더링된다
  - mismatch 시 `supabase.auth.signUp()` 호출 전에 toast로 차단된다
- 근거 테스트
  - [tests/e2e/169-account-accessibility-auth-surfaces.spec.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/tests/e2e/169-account-accessibility-auth-surfaces.spec.ts:1)
  - [tests/e2e/128-auth-success-transition.spec.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/tests/e2e/128-auth-success-transition.spec.ts:1)

### 3. 인증 성공 후 전환 의미는 현재 “success card 없이 즉시 복귀”로 고정돼 있다
- source of truth
  - `LoginModal.finalizeSuccessfulAuth()`
  - `/auth/callback?next=...`
- 현재 계약
  - email/password login 성공 시 success toast를 띄운 뒤 modal close + `router.refresh()`
  - `/login` page에서는 `onLoginSuccess`가 `returnUrl || '/'`로 push
  - verification-needed signup은 success card 없이 LOGIN mode로 즉시 복귀하고 verification toast를 유지
  - social login도 `redirectTo=/auth/callback?next=...`로 같은 상대 경로 정책을 공유한다
- 근거 테스트
  - `128-auth-success-transition`
  - `108-login-flow-guidance`의 social return hint visibility

### 4. protected guest surface의 auth continuity는 현재 정상이다
- source of truth
  - [app/guest/inbox/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/guest/inbox/page.tsx:74)
  - [app/guest/wishlists/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/guest/wishlists/page.tsx:102)
  - [app/account/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/account/page.tsx:187)
- 현재 계약
  - 비로그인 직접 진입은 각각의 canonical path를 `returnUrl`로 붙여 `/login`으로 이동
  - 로그인 성공 후 원래 보려던 private page로 복귀
- 근거 테스트
  - `108-login-flow-guidance`

### 5. account / help self-service copy는 현재 실제 제품과 정렬돼 있다
- source of truth
  - [app/account/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/account/page.tsx:1064)
  - [app/help/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/help/page.tsx:84)
  - [app/context/LanguageContext.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/context/LanguageContext.tsx:466)
- 현재 계약
  - 계정 페이지에는 `회원 탈퇴는 운영팀에 문의` 안내만 표시
  - 도움말 guest account FAQ에는
    - `비밀번호 재설정 기능은 현재 미지원`
    - `회원 탈퇴는 운영팀 문의`
    가 현재 구현과 같은 의미로 노출된다
- 즉 현재 제품 의미는
  - self-service password reset: 없음
  - in-app direct account deletion: 없음
  - guidance-only surface: 있음
- 근거 테스트
  - `169-account-accessibility-auth-surfaces`

## Confirmed Close-out
### 1. 로그아웃 contract parity는 현재 정상으로 닫혔다
- `/account` 모바일 로그아웃 surface는 [app/account/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/account/page.tsx:623)에서 `useAuth().signOut()`를 직접 호출한다
- shared owner인 [app/context/AuthContext.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/context/AuthContext.tsx:163)는 아래 공통 의미를 유지한다
  - local sign-out
  - auth-adjacent localStorage cleanup
  - hard redirect `/`
- 근거 테스트
  - `169-account-accessibility-auth-surfaces`
    - `/account` 모바일 로그아웃 후 `/` 복귀
    - `admin_active_tab`
    - `global_chat_last_viewed`
    - `host_checked_reservations`
    - `last_active_update`
    - `locally_recent_searches`
    cleanup 확인

## Coverage Gaps
- 재실행하지 않은 reference
  - live signup / live auth:
    - `tests/e2e/03-live-host-signup-registration.spec.ts`
    - `tests/e2e/05-live-guest-booking-messaging-support.spec.ts`
    - `tests/e2e/23-live-guest-post-booking.spec.ts`
    - `tests/e2e/31-live-guest-trip-cancel.spec.ts`
- desktop header sign-out까지 같은 키 cleanup을 end-to-end로 다시 잠근 dedicated parity spec은 아직 없다

## Follow-up Need
- 1순위
  - 다음 감사 영역으로 넘어간다
  - 이 문서 범위 안의 active implementation follow-up은 현재 없다
- 2순위
  - 필요 시 나중에 desktop header sign-out cleanup parity를 얇은 smoke로 추가할 수 있다

## Final Verdict
- 로그인 진입, signup modal, returnUrl continuity, account/help self-service copy는 최신 기준으로 정상이다
- `/account` 모바일 로그아웃도 `AuthContext.signOut()` 공통 계약과 cleanup semantics를 실제 테스트로 닫았다
- 즉 현재 제품 의미는 아래처럼 명확하다
  - 로그인/가입: 지원
  - protected page 복귀: 지원
  - 비밀번호 재설정: 현재 미지원
  - 회원 탈퇴 직접 처리: 현재 미지원, 운영팀 문의 안내만 제공
- 로그아웃 contract parity까지 포함해 현재 감사 범위의 active risk는 보이지 않는다
- 따라서 이번 감사 기준 최종 판정은 `계정·인증 self-service core는 정상`이다
