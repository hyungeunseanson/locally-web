# Diagnostics

임시 확인용 스크립트를 루트에서 분리해 모아둔 폴더입니다.

- 앱 런타임에서 직접 쓰는 코드는 아닙니다
- 대부분 로컬 `.env.local` 값을 읽고 Supabase 상태를 확인합니다
- 루트 기준 상대경로 의존은 `loadEnv.cjs`로 정리했습니다
- release gate, cutover smoke, 배포 직전 공식 점검 절차에는 포함하지 않습니다
- 배포 직전 공식 명령은 `docs/runtime_verification.md`에 적힌 package script만 기준으로 삼습니다

주의:
- 실행 전 `.env.local`에 필요한 Supabase 값이 있어야 합니다
- 결과를 저장하거나 스키마를 바꾸는 스크립트는 내용 확인 후 실행해야 합니다
- 일부 스크립트는 데이터나 스키마를 직접 변경할 수 있으므로, release-day에는 별도 owner 판단 없이 실행하지 않습니다
