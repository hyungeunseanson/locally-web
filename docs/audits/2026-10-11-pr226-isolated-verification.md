# PR #226 격리 Auth 및 운영 검증 기록 — 2026-10-11

## 실행 경계

- PR #225와 #224가 포함된 운영 Worker는 이미 배포된 상태로 두었다. 이 검증에서 Worker 재배포, 운영 DB 쓰기·migration, NICEPAY 설정 변경은 하지 않았다.
- 기존 main 작업 트리 대신 PR #226 전용 작업 트리에서 실행했다. 운영 Supabase 환경변수·API 키·사용자·데이터를 격리 환경에 복사하지 않았다.
- 운영 대상은 GET 전용 smoke와 `public_host_applications` 뷰 정의의 읽기 전용 조회에 한정했다. 운영 관리자 세션/UI, 체험 저장·승인은 실행하지 않았다.

## 격리 환경

- 호스트: macOS 15.7.5, Apple Silicon. Docker/Podman, 시스템 PostgreSQL, Supabase CLI 설치본은 없었다.
- 작업 트리 밖 임시 디렉터리에 Supabase CLI 2.120.0을 설치하고, Docker가 필요 없는 `native` runtime으로 새 로컬 스택을 생성했다. PostgreSQL 17, Auth, REST, Storage는 `127.0.0.1:54321`/`:54322`에서 실행했다.
- 저장소의 SQL migration 30개를 새 로컬 DB에 순서대로 적용했다. `users`, `profiles`, `admin_whitelist`, RLS, 관리자 판별 함수와 Auth 사용자 생성 트리거는 실제 migration 그대로 사용했다.
- CLI가 새로 발급한 anon/service-role 키만 비추적·권한 0600의 `.env.local`에 기록했다. Playwright와 Next.js 서버는 모두 `http://127.0.0.1:3100`을 사용했다.
- 공개 검색/상세 테스트를 위해 격리 DB에만 합성 호스트 1명, `approved` 호스트 신청 1건, `active` 체험 1건을 만들었다.

## 결과

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| `69-admin-role-access.spec.ts` | **PASS 2/2** | `users.role=admin` 접근, 화이트리스트 접근과 제거 후 권한 회수, 헤더·계정·대시보드 확인 |
| `npm run test:e2e:isolated:baseline` | **FAIL: 14 PASS / 1 FAIL / 2 NOT_RUN** | `71-public-host-profile.spec.ts`의 `active` 호스트 리뷰 API가 200 대신 404. 직렬 묶음의 뒤 2건은 미실행 |
| 운영 보호 계약 | **PASS 179/179** | `npm run cloudflare:production-build:contract` |
| PHASE1 소스 계약 | **PASS 5/5** | `node --test tests/unit/phase1-protected-source.test.mjs` |
| Ops Anomaly 계약 | **PASS 54/54** | `npm run cloudflare:ops-anomaly:contract` |
| TypeScript | **PASS** | `npx tsc --noEmit` |
| 전체 ESLint | **PASS** | 오류 0건, 기존 경고 7건 |
| Production GET smoke | **PASS 2/2** | `npm run test:e2e:live:gate`를 `https://www.locally-travel.com`에 순차 실행. 홈·검색·상세·로그인 GET 및 익명 관리자 API 차단 확인 |
| 격리 데이터 정리 | **PASS** | 테스트 후 Auth/화이트리스트·예약·리뷰 잔여 0. 합성 fixture와 익명 로그가 남은 임시 스택을 ID 지정해 폐기했고, 스택 목록 0건·로컬 Auth 포트 연결 거부 확인. 비추적 `.env.local`도 삭제 |

## 실패 분류 및 변경

- 첫 Auth 실행에서 홈의 기존 체험 팝업이 헤더 클릭을 가렸다. `69` 테스트의 기존 안내 닫기 도우미에 팝업 닫기만 추가한 뒤 2/2가 통과했다.
- `43` 검색 테스트도 같은 팝업이 체험 카드 클릭을 가렸다. 도우미에 팝업 닫기를 추가했다. 검색 페이지의 백그라운드 요청 때문에 `networkidle`이 끝나지 않는 경우는 페이지 로드 기준을 `domcontentloaded`로 바꾸고 기존 카드·상세·빈 결과 UI 단언을 그대로 유지했다. 별도 실행에서 4/4가 통과했다.
- `71`의 실패는 환경 부재가 아니다. 테스트는 `active` 호스트 신청을 생성하고 공개 리뷰 API 200을 기대한다. 앱의 `hostVisibility.ts`도 `approved`와 `active`를 공개 상태로 인정한다. 그러나 저장소 migration과 **운영 DB의 읽기 전용 `pg_get_viewdef` 결과** 모두 `public_host_applications` 뷰를 `status = 'approved'`로 제한한다. 그래서 해당 호스트가 공개 뷰에서 사라져 API가 404를 반환한다. 테스트 상태를 `approved`로 바꾸거나 격리 뷰/RLS를 완화하면 원래 검증 의도가 사라지므로 하지 않았다. 공개 호스트 상태 정책과 뷰 계약은 PR #226 밖에서 별도 결정·수정·검증이 필요하다.
- baseline의 `43`은 익명 검색·분석 로그를 남긴다. 테스트 자체 정리만으로 모든 행이 지워진다고 하던 요약 문구를 고치고, 임시 스택 전체 폐기를 정리 요건으로 문서화했다.

## 판정

- `DEPLOYED`: 기존 PR #225 통합 배포 상태 유지. 이번 검증에서 배포 변경 없음.
- `RUNTIME_SMOKE`: **PASS** — 공개 GET 및 익명 관리자 차단만 검증. 운영 관리자 UI·쓰기 기능은 미검증.
- `AUTH_ISOLATED_E2E`: **PASS** — 원본 `69`의 권한·권한 회수 2/2와 테스트 사용자 정리 확인.
- `RELEASE_GATE`: **VERIFICATION_INCOMPLETE** — 격리 baseline 1건 실패, 후속 2건 미실행. GitHub CI가 통과해도 이 실패를 PASS로 대체할 수 없다.
