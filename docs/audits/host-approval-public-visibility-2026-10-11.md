# 호스트 승인 권한과 공개 상태 감사 (2026-10-11)

기준 소스는 `e26ee6154030c78f73c37fe7e1ab38c1c5e88e13` (`origin/main`)이다. 운영 Supabase는 카탈로그·집계만 읽었다. 운영 Worker, DB 행, migration 이력은 변경하지 않았다.

## 보안 판정

- 운영 `host_applications`는 RLS가 켜져 있으나 `ha_insert_own`과 `ha_update_own`은 `auth.uid() = user_id`만 확인한다. `anon`과 `authenticated`에는 테이블 전체 쓰기 권한이 부여돼 있고 `status` 컬럼 권한도 상속된다. `status`는 기본값 `pending`인 nullable `text`이며 승인 상태 변경을 제한하는 CHECK나 상태 전용 트리거가 없다.
- 기존 트리거 4개는 프로필 사진 소유권·미디어 동기화를 다룬다. 일반 회원에게 실행 가능한 승인 RPC도 없다. 운영의 정책·권한·트리거는 저장소 baseline 및 후속 호스트 미디어 migration과 일치한다.
- 운영 데이터를 쓰지 않고 30개 기존 migration이 적용된 Apple Silicon native Supabase에서 비관리자 Auth 계정으로 검증했다. 수정 전에는 본인 신청서를 `approved`로 직접 INSERT·UPDATE할 수 있었고 결과가 저장됐다. **승인 권한 우회가 가능한 고우선 보안 결함**이다.
- 신규 migration은 `anon`·`authenticated`의 테이블 직접 쓰기 권한과 소유자 쓰기 정책을 제거한다. 기존 본인 행 SELECT와 서버 `service_role` 쓰기는 유지한다. 신청·재제출은 서버 `/api/host/register/submit`, 관리자 승인·보완 요청·거절은 인증된 서버 action의 `service_role` 경로를 사용한다.

## 공개 상태 정책

- 관리자 action은 승인 시 `approved`를 저장한다. 운영 전체 신청서 상태 집계에서 `approved` 58건, `active` 0건이다.
- 운영 `public_host_applications` 뷰는 회원별 최신 신청서 한 건을 고른 뒤 `approved`만 반환한다. `security_barrier=true`, `security_invoker=off`이며 연락처·신분증·계좌·관리자 코멘트는 투영하지 않는다.
- 홈, 검색, 체험 상세, 공개 호스트 프로필과 리뷰 API는 이 뷰를 조회한다. 최신 신청서가 `pending`·`revision`·`rejected`이거나 레거시 `active`이면 공개하지 않는다. 체험의 별도 `active` 상태는 그대로 유지한다.
- 앱의 공개 상태 helper에 있던 호스트 신청서 `active` 허용을 제거한다. 호스트 공개 데이터가 없는 `/users/[id]`가 인증 배지 모양의 빈 화면을 보이던 경로는 서버 404와 클라이언트 404 화면으로 닫는다. 비공개 호스트의 체험 상세 404 응답에 원래 제목이 `<title>`로 남던 경로도 일반적인 찾을 수 없음 메타데이터로 바꾼다. DB 공개 뷰 정의와 기존 게시 데이터는 변경하지 않는다.

## 재현 가능한 로컬 검증

1. 운영 연결값이 없는 새 임시 디렉터리에 Supabase CLI `2.120.0`을 설치하고 `supabase init`을 실행한다. 저장소의 `supabase/migrations`만 복사한다. Auth site URL·redirect는 `http://127.0.0.1:3100`으로 지정한다.
2. `SUPABASE_HOME`을 별도 임시 디렉터리로 둔 뒤 `SUPABASE_EXPERIMENTAL_STACK=1 supabase stack start --runtime native --exclude studio,analytics,realtime,functions --eager --yes --workdir <임시 프로젝트>`를 실행한다. DB와 Auth는 `127.0.0.1`에만 바인딩한다.
3. `supabase stack status --output-format json`을 프로그램에서 받아 새로 발급된 **로컬** anon·service role 키만 앱의 비추적 `.env.local`(권한 `0600`)에 기록한다. 값은 로그에 출력하지 않는다. 앱·브라우저가 모두 `127.0.0.1:3100`을 사용하고 같은 로컬 Supabase URL을 바라보는지 확인한다.
4. 새 migration은 **격리 DB에만** 적용한다. 비관리자 직접 쓰기 거부, 본인 읽기, 서버 승인·보완·거절, 공개 뷰·민감 컬럼을 확인한다. PR #226의 `npm run test:e2e:isolated:baseline`에는 사전에 승인된 합성 호스트와 공개 체험 fixture 한 건이 필요하다.
5. Auth 사용자와 fixture를 정리하고 잔여 행을 점검한다. 검색·분석 이벤트까지 없애려면 정확한 로컬 stack ID로 `supabase stack destroy --stack-id <ID> --yes`를 실행하고 임시 디렉터리·`.env.local`을 삭제한다. CLI의 Storage 업로드 보존 안내를 확인한다.

이번 감사에서는 위 격리 스택에 신규 migration을 적용한 뒤 `71` E2E 7/7, 관리자 승인 `07` E2E 2/2, PR #226 실행 명령을 사용한 격리 baseline 19/19를 확인했다. 종료 전 Auth 사용자·호스트 신청서·체험 행은 모두 0건이었고 스택을 폐기했다. PGlite 권한 계약, 공개 호스트 SSR 4/4, sitemap 16/16, 커뮤니티 SEO 12/12, TypeScript와 ESLint도 통과했다. 별도로 실행한 광범위 계약 묶음은 로컬 로그인·결제 취소 fixture 조건 때문에 38 PASS / 6 FAIL / 15 NOT_RUN이었다. 이를 통과로 간주하지 않으며 GitHub 필수 CI 결과와 구분한다.

## 운영 적용 경계

이 PR은 Draft이며 migration은 운영에 적용되지 않았다. 운영 승인 권한 위험은 별도 승인된 migration 적용과 권한 재확인 전까지 남는다. 운영 적용 시 migration과 코드의 릴리스 순서, 실제 `anon`·`authenticated`·`service_role` 권한, 승인·재제출 회귀 및 운영 Worker 호환성을 다시 검증해야 한다. 기존 행 보정이나 공개 뷰 확대는 필요하지 않다.
