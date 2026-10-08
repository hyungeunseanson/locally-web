# SEO F01 — 공개 체험 사이트맵 복구

기준: 2026-10-08 fresh main `3eda49f5f887e5a3d8023dff0496996651c3a170`.
범위는 F01이다. Production DB는 SELECT만 사용했다. Production 배포 전이므로 아래 변경 후 동작은 로컬 검증 결과이며, 운영 사이트가 이미 복구됐다는 뜻은 아니다.

## 원인 및 변경 전후

Production `experiences`에는 `id`, `host_id`, `status`, `is_active`, `created_at` 등이 있고 `updated_at`은 없다. 기존 사이트맵은 없는 컬럼을 조회한 뒤 Supabase `error`를 버리고 `data || []`로 처리하여 HTTP 200의 XML에서 체험을 모두 누락했다. 실제 Production을 읽기 전용으로 확인한 공개 적격 체험 수는 **33개**이며, 공개 표본 체험 4659도 포함된다.

수정 후 체험 쿼리는 `id, host_id, status, is_active`만 조회한다. 체험 수정일 근거가 없으므로 **체험 URL의 lastModified를 생략**한다. 새 컬럼이나 migration은 추가하지 않았다.

| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| 존재하지 않는 체험 컬럼 | updated_at 조회 | 조회하지 않음 |
| 체험 공개 판정 | active query + is_active + 공개 host | 같은 정책과 기존 helper를 사용 |
| 조회 오류 | 빈 목록/정적-only XML을 200으로 제공 | source·code만 기록 후 예외 전파; cold request는 500 |
| 캐시 | 사이트맵 route ISR 1시간 | request-time route + 완전히 성공한 데이터의 1시간 Data Cache |
| 부분 실패 후 캐시 | 불완전한 결과로 대체 가능 | 전체 실패 시 새 데이터 캐시 저장 안 함; 기존 완전한 성공 결과는 유지 가능 |
| build의 DB 의존 | build 중 사이트맵 생성 시 DB 조회 | 사이트맵은 build 때 DB에 접근하지 않음 |
| 응답 제한 | pagination 없음 | 안정적인 순서 + exact count + 실제 받은 수만큼 offset 진행 |

데이터 캐시 키에는 공개 Supabase URL을 포함하여 로컬 fixture와 다른 backend의 데이터를 구분한다. 인증 키는 캐시 키나 로그에 포함하지 않는다. `force-dynamic`은 정상 URL 데이터를 매 요청 DB에서 읽는다는 뜻이 아니며, 성공 데이터만 `unstable_cache`에 3600초 보관한다. 백그라운드 갱신 실패도 정제된 source/code로 기록된다. TTL 중 공개 상태 변경의 반영 지연은 기존 1시간 정책 범위다.

## 공개 적격성

- `status === 'active'`이고 `is_active !== false`인 체험만 포함한다. 기존 정책대로 null is_active는 허용한다.
- host_id가 존재하고, 해당 호스트의 **최신** application이 approved 또는 active여야 한다.
- 모든 application을 읽은 다음 created_at/id 기준으로 최신 항목을 결정한다. 과거 승인 이후 최신 revision/pending/rejected인 호스트를 승인 상태만 먼저 걸러 노출하지 않는다.
- 상세 페이지의 익명 공개 snapshot과 metadata도 같은 active/is_active 및 latest approved/active host 정책을 적용한다. 상세·metadata·RLS는 수정하지 않았다.
- 정적 15개 경로, community의 기존 board/legacy hub/locally_content 필터와 기존 lastmod, public host URL 및 기존 날짜 동작은 유지한다. F02 noindex 정책은 이번 변경에 포함하지 않는다.

## 조회 실패 및 pagination

세 동적 source 모두 error, null data, 누락된 count를 확인한다. 체험 또는 host뿐 아니라 community primary/fallback 실패도 전체 생성 실패로 처리한다. community의 missing board_country에 대한 기존 fallback만 유지하며, 그 외 오류는 fallback 성공으로 숨기지 않는다.

각 page는 500행을 요청한다. 서버가 예를 들어 125행만 반환해도 실제 받은 125행만큼 다음 offset으로 이동하여 전체 exact count에 도달할 때까지 읽는다. count 변화, 중복 ID, 예정 count 전의 empty page, 불완전 응답은 명시적 오류다. 이 방식은 서버의 row cap에 의한 조용한 누락을 방지한다. 다중 HTTP 조회가 하나의 SQL snapshot transaction을 제공하는 것은 아니므로 동일 count의 모든 동시 변경까지 원자적으로 보장하지는 않는다. 단일 XML의 50,000 URL 규모에 도달하면 별도의 sitemap 분할 설계가 필요하다.

로그에는 row content, 원본 DB message/hint, 인증 키를 출력하지 않는다. request-time route의 새 데이터 생성 실패는 500이며, stale한 **완전한** 이전 성공 데이터가 있는 경우 Next Data Cache가 이를 제공하면서 갱신 실패를 기록할 수 있다. 이는 불완전한 새 데이터를 성공 결과로 저장하는 동작과 구분한다.

## 검증

`npm run test:seo:sitemap`은 외부 provider가 아닌 로컬 PGlite PostgreSQL schema와 HTTP adapter, 실제 Supabase JS SDK, 실제 sitemap 함수 및 Next XML serializer를 사용한다. SQL fixture는 updated_at과 board_country 없는 Production 관련 schema를 재현한다. metadata 테스트는 실제 기존 generateMetadata를 공개 snapshot fixture로 호출한다. 모든 provider URL/키는 loopback synthetic 값이며 .env.local을 읽지 않는다.

16개 검증 항목:

1. active + approved/active host 체험 포함, 체험 lastmod 부재.
2. is_active=false·draft·host 없음·미승인·최신 승인 취소 호스트 제외.
3. 동일 시각 application의 id tie-breaker 유지.
4. 정적 15개와 community/host membership·기존 날짜 유지.
5. 실제 missing board_country의 legacy fallback 유지.
6. 실제 PostgreSQL missing-column `42703` 재현 및 조회 실패 전파.
7. 세 source 각각의 오류 및 community fallback 오류 전파.
8. 뒤 page 실패 후 앞 page만 성공 결과로 반환하지 않음.
9. 체험 1,025 / community 1,010 / host 1,050개, 서버 cap 125에서 누락 없음.
10. count 누락·변경·empty page·중복 ID 시 실패.
11. 정확한 XML namespace·www canonical URL·체험 lastmod 생략.
12. 기존 ko/en/ja/zh self canonical·4언어 hreflang 유지, private/inactive metadata noindex 유지.
13. 실제 Next dev HTTP: 초기 500 → 정상 재시도 200 XML → 성공 데이터 cache hit.
14. 같은 suite의 OpenNext 모드: 실제 생성 Worker를 local workerd·합성 SQL·local R2만으로 실행하여 동일 500/200/cache 검증.

위 목록은 개별 assertion 그룹을 설명하며 node:test의 실행 test 수는 16개다. 로컬에서 두 모드 모두 **16/16 PASS**, 변경 파일 lint·TypeScript 검사·전체 lint(기존 경고 7개, 오류 0)·Next build·OpenNext Production build wrapper가 PASS였다. 빌드는 fixture mode 및 loopback DB 설정을 사용했고 배포하지 않았다.

GitHub에서는 새 `SEO Sitemap Recovery` workflow가 suite·변경 파일 lint·OpenNext build·local workerd suite를 수행한다. 기존 Cloudflare Foundation 및 package 변경으로 트리거되는 Chat performance regressions도 PR 검증 대상이다. 실제 head별 CI 결과는 Draft PR의 Checks를 최종 기준으로 한다.

재현 명령:

```sh
npm ci
npm run test:seo:sitemap
npx eslint app/sitemap.ts app/utils/sitemapData.ts tests/integration/sitemap-recovery.test.mjs
npx tsc --noEmit
```

OpenNext fixture build와 local worker 재현은 `.github/workflows/seo-sitemap-check.yml`의 명시적 loopback 환경을 사용한다. 실제 provider credential·Production DB·remote R2를 테스트에 전달하지 않는다. 기존 29-sitemap/27-detail E2E의 인증 사용자 생성·DB insert/delete 시나리오는 Production에 실행하지 않았다.

참고: [Supabase range](https://supabase.com/docs/reference/javascript/range), [select/count](https://supabase.com/docs/reference/javascript/select), [Next sitemap](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap), [Next Data Cache](https://nextjs.org/docs/app/api-reference/functions/unstable_cache).

## 변경 범위와 운영 카운터

변경 파일: app/sitemap.ts, app/utils/sitemapData.ts, tests/integration/sitemap-recovery.test.mjs, package.json의 테스트 script, .github/workflows/seo-sitemap-check.yml, 이 문서.

F02–F06, R2 authority, Financial/NICEPAY/Admin Chat, Queue/Cron, Cloudflare release 설정은 수정하지 않았다. 사용자의 기존 dirty checkout은 별도 worktree로 분리해 보존했다.

- Production DB mutations: **0**
- Cloudflare setting changes: **0**
- Worker deployments: **0**
- Production traffic changes: **0**
- DB migrations: **0**
- Draft PR merge: **0**
