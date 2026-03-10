# 파일 정리 메모

## 0. 이번에 실제로 정리한 것

- 루트에 흩어져 있던 진단 스크립트를 `scripts/diagnostics/`로 이동
- 느슨한 참고 문서/아티팩트를 `docs/archive/`로 이동
- 이동 때문에 깨질 수 있는 `.env.local` 상대경로는 `scripts/diagnostics/loadEnv.cjs`로 정리
- `test-supabase2.js`에 박혀 있던 하드코딩 Supabase 값은 env 기반으로 교체

즉, 이번 단계는 "안전한 정리"만 먼저 한 상태입니다.

## 1. 지금 바로 지우지 말아야 하는 것

- 루트의 `supabase_*.sql` 파일들
- 이유: 이미 여러 문서에서 직접 파일명을 참조하고 있고, 새 환경 세팅이나 기록 확인용으로도 쓰이고 있습니다
- 특히 아래 3개는 지금 체험 번역 작업과 직접 연결돼 있습니다
  - `supabase_experience_translation_queue_migration.sql`
  - `supabase_experience_translation_worker_functions.sql`
  - `supabase_experience_translation_content_migration.sql`

즉, 이 SQL 파일들은 바로 삭제하지 말고 나중에 한 번에 옮기는 방식이 맞습니다.

---

## 2. 이번에 옮긴 파일

### `docs/archive/`

- `docs/archive/bot_operation_guide.md.resolved`
- `docs/archive/db_reset_plan.md.resolved`
- `docs/archive/pre_launch_status_report.md.resolved`
- `docs/archive/vercel_vs_cloudflare_report.md.resolved`
- `docs/archive/ScreenShot Tool -20260307002107.png`
- `docs/archive/henrikdev.ag-quota-1.1.0.vsix`

현재 운영 코드와 직접 연결되지 않는 파일들만 먼저 옮겼습니다.

### `scripts/diagnostics/`

- `scripts/diagnostics/check_booking_fields.js`
- `scripts/diagnostics/check_bookings.js`
- `scripts/diagnostics/check_inquiries.js`
- `scripts/diagnostics/check_schema.js`
- `scripts/diagnostics/create_analytics_tables.js`
- `scripts/diagnostics/test-schema.cjs`
- `scripts/diagnostics/test-schema.mjs`
- `scripts/diagnostics/test_columns.js`
- `scripts/diagnostics/test_db.js`
- `scripts/diagnostics/test_db_service.js`
- `scripts/diagnostics/test_eq.js`
- `scripts/diagnostics/test_exp.ts`
- `scripts/diagnostics/test_join.ts`
- `scripts/diagnostics/test_rls.js`
- `scripts/diagnostics/test_schema.js`
- `scripts/diagnostics/test_supabase.js`
- `scripts/diagnostics/test-supabase2.js`

루트가 지저분했던 부분을 별도 폴더로 분리한 상태입니다.

---

## 3. SQL 파일 정리할 때 안전한 방식

루트 `supabase_*.sql` 파일은 하나씩 대충 옮기면 안 됩니다.

안전한 순서:

1. 새 폴더를 먼저 정합니다
   - 예: `docs/migrations/legacy/`
   - 또는 `sql/manual/`
2. 루트 `supabase_*.sql` 파일을 한 번에 옮깁니다
3. 아래 문서들의 파일 경로를 같이 바꿉니다
   - `docs/CHANGELOG.md`
   - `docs/gemini.md`
   - `docs/FINAL_AUDIT_REPORT.md`
   - `docs/e2e_test_log.md`
   - `docs/qa_report_01_signup.md`
   - `docs/archive/bot_operation_guide.md.resolved`
   - `scripts/diagnostics/create_analytics_tables.js`

즉, SQL 파일 정리는 "이동 + 참조 수정"을 한 번에 해야 안전합니다.

---

## 4. 추천 정리 순서

1. 먼저 안 쓰는 문서/아티팩트 후보를 archive 또는 삭제
2. 진단용 스크립트를 `scripts/diagnostics/`로 이동
3. 마지막에 루트 `supabase_*.sql`를 한 번에 이동하면서 참조 수정

이 순서가 제일 회귀 위험이 낮습니다.
