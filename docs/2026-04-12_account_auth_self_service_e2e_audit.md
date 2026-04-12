# 계정·인증 self-service 경계 엔드투엔드 구조 점검

## Summary
- 감사 범위: `로그인 진입 / 회원가입 / returnUrl 복귀 / OAuth 복귀 / account 진입 / help FAQ 기반 self-service 안내`
- 제외 범위: `호스트 신청`, `예약/결제 상태 머신`, `실제 계정 삭제 처리`, `비밀번호 재설정 기능 구현`, live mutation 재실행
- 실행 방식: 정적 코드 감사 + 핵심 non-live E2E 재실행
- latest run
  - `11 passed (23.2s)`
  - rerun bundle
    - `tests/e2e/108-login-flow-guidance.spec.ts`
    - `tests/e2e/128-auth-success-transition.spec.ts`
    - `tests/e2e/169-account-accessibility-auth-surfaces.spec.ts`
- 이번 패스 핵심 결론
  - `/login` page, `LoginModal`, `AuthContext`, `/account`, `/help`는 현재 제품 의미를 대체로 일관되게 공유한다
  - 회원가입 비밀번호 확인 2칸, protected page의 canonical `returnUrl`, “비밀번호 재설정 미지원 / 회원 탈퇴는 운영팀 문의” 문구는 최신 기준으로 실제 구현과 맞는다
  - 다만 로그아웃 contract는 아직 완전히 한 곳으로 수렴하지 않았다
    - `SiteHeader`는 `AuthContext.signOut()`를 사용하지만
    - `/account` 쪽 sign out surface는 아직 직접 `supabase.auth.signOut()`를 호출한다
  - 따라서 현재 최종 판정은 `로그인·가입·계정 self-service surface는 정상`, `로그아웃 contract parity는 부분 보장`이다

## Result Snapshot
| Chain | Source of truth | Current tests | Verdict | Notes |
| --- | --- | --- | --- | --- |
| 로그인 진입 / returnUrl 정규화 | `app/login/page.tsx`, `normalizeReturnUrl()` | `108` | 정상 | 외부 URL, `//`, `javascript:`는 `/`로 fail-closed 되고, 내부 상대 경로만 복귀 대상으로 허용된다 |
| 회원가입 / 로그인 modal surface | `app/components/LoginModal.tsx` | `128`, `169` | 정상 | signup은 `LoginModal` 단일 surface로 유지되고, 비밀번호 확인 2칸과 필수값 검증이 client에서 먼저 잠긴다 |
| 인증 성공 후 전환 | `LoginModal.finalizeSuccessfulAuth()`, `/auth/callback?next=...` | `128` | 정상 | 로그인 성공은 success toast 후 즉시 복귀하고, verification-needed signup은 LOGIN 모드로 바로 돌아온다 |
| protected guest page 복귀 | `/guest/inbox`, `/guest/wishlists`, `/account` direct entry | `108` | 정상 | 비로그인 직접 진입 시 canonical `returnUrl`을 붙여 `/login`으로 보내고, 성공 후 같은 path로 복귀한다 |
| account self-service 안내 | `app/account/page.tsx`, `app/help/page.tsx`, `LanguageContext` FAQ copy | `169` | 정상 | “회원 탈퇴는 운영팀 문의”, “비밀번호 재설정 미지원” 문구가 현재 실제 구현과 일치한다 |
| 로그아웃 contract parity | `AuthContext.signOut()`, `SiteHeader`, `app/account/page.tsx` | static audit only | 부분 보장 | header는 context signOut + localStorage cleanup을 쓰지만, account surface는 direct Supabase signOut으로 아직 분기돼 있다 |

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

## Static Risk Notes
### 1. 로그아웃 owner가 아직 완전히 통일되진 않았다
- `SiteHeader`는 [app/context/AuthContext.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/context/AuthContext.tsx:140)의 `signOut()`를 사용한다
  - localStorage cleanup
  - local sign-out
  - hard redirect `/`
- 반면 `/account` 쪽 sign-out surface는 [app/account/page.tsx](/Users/hyungeunseanson/Documents/서비스/locally-web/app/account/page.tsx:623)에서 직접 `supabase.auth.signOut()` 후 `router.push('/')`를 호출한다
- 현재 영향
  - runtime에서 즉시 눈에 띄는 치명적 실패가 확인된 것은 아니다
  - 하지만 `admin_active_tab`, `global_chat_last_viewed`, `host_checked_reservations` 같은 auth-adjacent localStorage cleanup 의미는 header 경로와 완전히 같다고 보장되지 않는다
- 이번 감사에서는 구현 수정 대신 `부분 보장`으로 기록한다

## Coverage Gaps
- 재실행하지 않은 reference
  - live signup / live auth:
    - `tests/e2e/03-live-host-signup-registration.spec.ts`
    - `tests/e2e/05-live-guest-booking-messaging-support.spec.ts`
    - `tests/e2e/23-live-guest-post-booking.spec.ts`
    - `tests/e2e/31-live-guest-trip-cancel.spec.ts`
- 로그아웃 parity는 이번 문서에서 static audit로만 확인했고 dedicated regression spec은 없다
- `/account` 모바일/데스크탑 sign-out surface가 `AuthContext.signOut()`와 완전히 같은 cleanup semantics를 보장하는지까지는 현재 테스트로 닫히지 않았다

## Follow-up Need
- 1순위
  - `/account` sign-out surface를 `AuthContext.signOut()` 단일 owner로 맞출지 검토
  - 이건 기능 확장이 아니라 contract alignment용 핀셋 수정 후보다
- 2순위
  - sign-out parity를 닫는 얇은 E2E 또는 contract smoke를 추가하면 좋다
    - 예: sign-out 후 `/` 복귀
    - auth-adjacent localStorage cleanup

## Final Verdict
- 로그인 진입, signup modal, returnUrl continuity, account/help self-service copy는 최신 기준으로 정상이다
- 즉 현재 제품 의미는 아래처럼 명확하다
  - 로그인/가입: 지원
  - protected page 복귀: 지원
  - 비밀번호 재설정: 현재 미지원
  - 회원 탈퇴 직접 처리: 현재 미지원, 운영팀 문의 안내만 제공
- 다만 로그아웃 contract는 아직 `AuthContext.signOut()` 단일 owner로 완전히 정렬되지 않아 `부분 보장` 항목이 1건 남아 있다
- 따라서 이번 감사 기준 최종 판정은 `auth/account self-service core는 정상, sign-out parity는 부분 보장`이다
