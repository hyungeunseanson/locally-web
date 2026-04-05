# Host Verification Storage Contract

호스트 신청 신분증 이미지는 공개 `images` 버킷이 아니라 private `verification-docs` 버킷에 저장한다.

## 현재 계약
- 업로드 주체: 브라우저의 authenticated user
- 업로드 경로: `id_card/<auth.uid()>_<timestamp>`
- 저장값: `host_applications.id_card_file` 에 public URL 대신 storage path 문자열 저장
- 관리자 열람: [`app/api/admin/host-applications/route.ts`](../app/api/admin/host-applications/route.ts) 가 service-role 로 signed URL 발급

## 필요한 인프라
- bucket: `verification-docs`
- policy source of truth: [`supabase_verification_docs_storage.sql`](../supabase_verification_docs_storage.sql)
- bucket visibility: `private`

## 장애 징후
- 신청 화면에서 `신분증 업로드에 실패했습니다`
- locale에 따라 같은 의미의 영어/일본어/중국어 문구만 달라짐
- submit route 전에 실패하므로 `host_applications.id_card_file` 이 비어 있거나 row 자체가 생성되지 않을 수 있음

## 운영 확인 순서
1. `storage.buckets` 에 `verification-docs` 가 존재하는지 확인
2. `storage.objects` 정책이 authenticated insert/select/update/delete 를 허용하는지 확인
3. 정책이 `id_card/<auth.uid()>_<timestamp>` 패턴을 허용하는지 확인
4. `/host/register` 재현 시 브라우저 network 에서 `/storage/v1/object/verification-docs/...` 응답 코드와 body 확인

## SQL 적용 시 주의
- `storage.objects` 는 Supabase managed system table 이라 owner-only `ALTER TABLE storage.objects ...` 는 피한다
- `must be owner of table objects` 가 나오면, 보통 불필요한 owner-level DDL 을 실행한 것이다
- 현재 source-of-truth SQL 은 bucket 생성과 policy 정의만 포함하고, RLS enable 자체는 건드리지 않는다
- 만약 `CREATE POLICY` 단계에서도 권한 오류가 나면, 일반 app 연결이 아니라 Supabase SQL Editor 또는 Storage Policies UI 에서 적용해야 한다

## 증상별 해석
- `403` 또는 `new row violates row-level security`: policy mismatch 가능성 높음
- `401`: auth/session 전달 문제 또는 unauthenticated upload
- `Bucket not found`: 버킷 미생성 또는 환경 드리프트
- `400` with path validation/body mismatch: 정책의 prefix 규칙이나 업로드 포맷 불일치 가능성

## 코드 관측성
- [`app/host/register/page.tsx`](../app/host/register/page.tsx) 는 storage upload 실패 시 redacted diagnostic 을 `console.error` 와 Sentry client exception 에 남긴다
- redaction helper: [`app/utils/supabase/storageUploadDiagnostics.ts`](../app/utils/supabase/storageUploadDiagnostics.ts)
- live smoke: [`tests/e2e/03-live-host-signup-registration.spec.ts`](../tests/e2e/03-live-host-signup-registration.spec.ts) 가 `verification-docs` upload response 를 캡처하도록 유지
