# PHASE 2 출시 Gate 증거 (2026-10-11 KST)

## 결론

**세 운영 Gate PASS, PHASE 2 DB 적용 완료, 최종 CI 대기.** A/B의 NICEPAY 운영 MID 사후 거래대사, 번역 Migration 버전 정합화, 배포 직전 백업의 격리 복원·R2 검증을 마쳤다. PHASE 2 Migration은 한 번 적용했고, 신규 객체의 권한과 기존 금융 데이터 불변을 확인했다. 최종 PR Head의 필수 CI가 모두 통과하면 PR Merge, Worker 전환, Cron 활성화 순서로 진행한다.

## Fresh 운영 조회

| 대상 | 확인 결과 |
| --- | --- |
| GitHub main | `905bb105187118d99e4d4a961f77a47512c04f49` (`git ls-remote origin`) |
| 배포 Worker | `fdc729a3-fb86-4c29-ad66-bafcd38727cb` 100%, 버전 메모 소스 `905bb105…` (`wrangler deployments status --env production`) |
| Production DB | `20261010172837_experience_nicepay_recovery` 1회 적용. 저장 SQL SHA-256 `c48d009c964368e1ab0b6d25cc795b2cce711a01edb1244a305fc65e7f7f5965`가 PR 파일과 일치한다. 복구 원장·이벤트 테이블은 0건이고 RLS가 켜졌으며 익명·일반 회원 조회 및 RPC 실행이 차단되고 service_role만 허용된다. 적용 전후 기존 예약 48건, 환불 원장·시도 각 1건, 수동 정산 3건, A/B 종료 원장 2건의 전체 행 지문이 동일했다. |
| Migration 차이 | Production `20261010113747_translation_queue_recovery_p1`의 저장된 SQL MD5 `fd5b220dae5cc1bfccc1e42b5e4d4f22`가 저장소 파일과 정확히 일치한다. SHA-256 `43e07bbf2f3d9a6b37b6a3e51430797e89acf3ac646b04e8e8d8b3285fb122ce`도 일치한다. 운영 RLS 영수증 테이블, 함수 6개, 활성 트리거 3개, service_role 전용 공개 RPC 3개, anon/service_role 테이블 직접 조회 거부를 확인했다. PR에서 파일명을 실제 운영 버전으로 변경하고 pending 목록에서 제거했다. 운영 SQL 재실행 없음. |
| A/B | 두 예약 모두 `cancelled`/`released`, TID 없음, 환불액·호스트 정산액·플랫폼 수익 0원. `private.targeted_card_closeouts` 2건. |
| C | `PAID`/`completed`, TID 존재, 금액 46,200원, 호스트 정산액 33,600원, 플랫폼 수익 12,600원, 환불액 0원. |
| A/B PG 증거 | 2026-10-10 17:05 UTC NICEPAY 운영 가맹점 관리자 `FIsonnerdm`의 통합거래조회에서 거래일자 2026/10/08~2026/10/11, 주문번호별, 모든 상태·결제서비스로 직접 조회. A/B 각각 승인 0건·취소 0건·거래 행 0건. PHASE 1 원장 확인 시각(2026-10-09 16:09 UTC) 이후 새 금융 거래는 없었다. C는 카드 승인 1건·46,200원, 취소 0건이며 상세 TID가 DB와 정확히 일치했다. C 승인일 2026/10/09, 승인매입일 2026/10/10, 정산 예정일 2026/10/20로 표시됐다. |
| 백업·복구 | [배포 직전 운영 백업 실행 38071535075](https://github.com/hyungeunseanson/locally-web/actions/runs/38071535075) 성공. 2026-10-10 17:24:00 UTC 생성, 격리 Postgres 17 복원 후 데이터 건수·권한·보안 객체·Realtime 구성 일치(`RESTORE_COUNTS_SECURITY_OBJECTS_AND_REALTIME_PASS`). R2 `daily/2026-10-10T17-24-00Z-38071535075-1/`에 age 암호화 백업 및 SHA-256 저장 후 재다운로드 무결성 확인. 앞선 [백업 38069534146](https://github.com/hyungeunseanson/locally-web/actions/runs/38069534146)의 R2 객체는 별도로 로컬 재다운로드·오프라인 복구 키(0600) 복호화·내부 전체 체크섬 검증까지 통과했다. 기존 백업과 복구 키는 보존. |

NICEPAY 공식 문서가 지정한 `npg.nicepay.co.kr`에 운영 계정으로 로그인해 거래를 직접 재조회했다. 거래가 없는 A/B에는 승인·취소·정산 대상 TID도 없고, C의 승인·매입·정산 예정 및 TID는 운영 DB와 일치한다. 결제 취소·환불 버튼은 사용하지 않았다.

## 코드 수정과 격리 검증

- NICEPAY Claim과 복구 원장 생성은 새 service_role 전용 RPC의 단일 Postgres 트랜잭션에서 수행한다. 원장 INSERT/트리거 실패 시 Claim도 롤백된다. 요청 응답이 끊겨도 DB의 두 기록은 함께 존재하거나 함께 부재한다.
- 복구 Cron은 DB에서 기한이 된 활성 시도와 아직 알리지 않은 수동 검토 건을 **먼저** 선별한 뒤 20건으로 제한한다. 이미 알림 완료된 160건과 미래 재시도 10건 사이에서도 새 사고가 조회된다.
- Wrangler 설정과 표준 배포 계약의 복구 플래그 기본값을 `true`로 고정했다. 최초 전환에는 `--enable-nicepay-recovery`로 계획된 변경을 명시하고, 이후 배포는 원격 활성값과 불일치하면 사전 검사에서 멈춘다.
- PGlite PHASE 2 13건, Mock 회복/증거, 기존 환불 통보 37건, 기존 결제 Claim 계약, PHASE 1 보호 소스 검사, TypeScript와 변경 파일 ESLint 통과. Cloudflare 배포 계약의 최초 실행에서는 변경된 기본 플래그에 대한 기존 테스트 기대값 15건이 실패했고, 기대값을 갱신한 `run-production-deploy.test.mjs` 31/31 및 배포 의미 계약 검사 통과. 전체 Cloudflare 계약 재실행 결과는 CI와 함께 확인한다.

## 해제해야 할 Gate

1. 실제 적용된 Migration 버전을 반영한 새 PR Head의 필수 CI를 확인한다. 이후 Merge → Merge SHA 기반 Worker 배포 → 100%/Cron/비금융 점검 순으로 진행한다.

운영 결제·환불·취소 API 호출과 고객 예약 데이터 변경은 하지 않았다.
