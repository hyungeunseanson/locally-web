# PHASE 2 출시 Gate 증거 (2026-10-11 KST)

## 결론

**운영 적용 중단.** 이번 조사에서 실제 금융 사고는 확인되지 않았지만, A/B 사후 NICEPAY 거래대사 완료와 운영 DB Migration 일치가 검증되지 않았다. 승인된 연속 출시의 필수 Gate가 충족될 때까지 운영 Migration, PR Merge, Worker 전환, Cron 활성화는 실행하지 않는다.

## Fresh 운영 조회

| 대상 | 확인 결과 |
| --- | --- |
| GitHub main | `905bb105187118d99e4d4a961f77a47512c04f49` (`git ls-remote origin`) |
| 배포 Worker | `fdc729a3-fb86-4c29-ad66-bafcd38727cb` 100%, 버전 메모 소스 `905bb105…` (`wrangler deployments status --env production`) |
| Production DB | `20261011000100_experience_nicepay_recovery` 미적용. 복구 원장/RPC 미존재 (Supabase migration list 및 `to_regclass`/`to_regprocedure`) |
| Migration 차이 | Production은 `20261010113747_translation_queue_recovery_p1` 적용. main은 `20261010102639_translation_queue_recovery_p1`을 미적용으로 기록. 동일한 이름의 서로 다른 버전이며 기능/스키마 동일성은 미확인. 범위 외 Migration을 자동 적용하면 안 된다. |
| A/B | 두 예약 모두 `cancelled`/`released`, TID 없음, 환불액·호스트 정산액·플랫폼 수익 0원. `private.targeted_card_closeouts` 2건. |
| C | `PAID`/`completed`, TID 존재, 금액 46,200원, 호스트 정산액 33,600원, 플랫폼 수익 12,600원, 환불액 0원. |
| A/B PG 증거 | 종료 원장의 마지막 NICEPAY 확인 시각은 2026-10-09 16:09:00 UTC. 당시 승인 내역 없음으로 기록됐고 `operational_incomplete_with_residual_risk`, `residual_legacy_risk_accepted=true`로 종료. **이후의 독립적인 NICEPAY 거래대사 완료 증거는 확보하지 못함.** |
| 백업·복구 | Supabase 대시보드의 예약 물리 백업 7개와 Restore 경로를 확인. 표시된 최신 백업은 2026-10-09 20:43:33 UTC. PITR은 미활성(추가 기능 안내). 배포 직전 새 백업 및 실제 복구 가능 시점 검증은 미실행. |

NICEPAY 가맹점 관리자 URL에 접근했으나 로그인된 거래조회 화면을 확보하지 못했다. 기존 DB 종료 증거를 새로운 PG 조회로 대체하지 않았다.

## 코드 수정과 격리 검증

- NICEPAY Claim과 복구 원장 생성은 새 service_role 전용 RPC의 단일 Postgres 트랜잭션에서 수행한다. 원장 INSERT/트리거 실패 시 Claim도 롤백된다. 요청 응답이 끊겨도 DB의 두 기록은 함께 존재하거나 함께 부재한다.
- 복구 Cron은 DB에서 기한이 된 활성 시도와 아직 알리지 않은 수동 검토 건을 **먼저** 선별한 뒤 20건으로 제한한다. 이미 알림 완료된 160건과 미래 재시도 10건 사이에서도 새 사고가 조회된다.
- Wrangler 설정과 표준 배포 계약의 복구 플래그 기본값을 `true`로 고정했다. 최초 전환에는 `--enable-nicepay-recovery`로 계획된 변경을 명시하고, 이후 배포는 원격 활성값과 불일치하면 사전 검사에서 멈춘다.
- PGlite PHASE 2 13건, Mock 회복/증거, 기존 환불 통보 37건, 기존 결제 Claim 계약, PHASE 1 보호 소스 검사, TypeScript와 변경 파일 ESLint 통과. Cloudflare 배포 계약의 최초 실행에서는 변경된 기본 플래그에 대한 기존 테스트 기대값 15건이 실패했고, 기대값을 갱신한 `run-production-deploy.test.mjs` 31/31 및 배포 의미 계약 검사 통과. 전체 Cloudflare 계약 재실행 결과는 CI와 함께 확인한다.

## 해제해야 할 Gate

1. NICEPAY 관리자에서 A/B 주문번호의 종료 이후 현재까지 승인·취소·환불·입금 기록을 직접 재조회하고, 결과와 확인 시각을 보존한다. 이상이 있으면 사건 처리를 우선한다.
2. Production의 번역 Migration 버전 차이가 저장소 계획과 어떤 관계인지 확인하고, 필요하면 별도 승인된 정합성 작업으로 맞춘다. PHASE 2 Migration 외의 pending migration을 자동 적용하지 않는다.
3. 운영 DB의 배포 직전 최신 백업을 확보하고, 복구 가능한 시점과 실제 복구 절차를 확인한다. 현재 보이는 물리 백업은 출시 직전 지점이 아니며 PITR은 비활성이다.
4. 새 PR Head의 필수 CI가 모두 통과했는지 확인한다. 이후에만 사전 금융 지문 보존 → PHASE 2 Migration 정확히 1회 → DB ACL/금융 불변 확인 → Merge → Merge SHA 기반 Worker 배포 → 100%/Cron/비금융 점검 순으로 진행한다.

이 문서는 운영 변경 실행 기록이 아니다. 운영 결제·환불·취소 API 호출과 고객 예약 데이터 변경은 하지 않았다.
