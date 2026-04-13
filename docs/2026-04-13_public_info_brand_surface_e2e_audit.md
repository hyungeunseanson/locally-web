# 공개 정보·브랜드 Surface E2E 감사

## Summary
- 감사 범위: `about`, `company/*`, `help`, `global site announcement`
- 현재 기준 결론:
  - `about`, `help`, `global site announcement`, `company/partnership`는 메타/공개 진입/운영 의미 기준으로 `정상`
  - `company/news`, `company/careers`, `company/investors`는 dead CTA 제거 이후 `정상`
  - `company/notices`는 메타는 `정상`이지만, 데이터 truth가 정적 placeholder 성격이라 `부분 보장`
- 최신 재검증 결과:
  - `110-partnership-media-kit`
  - `172-partnership-inquiry-route`
  - `25-public-metadata`
  - `173-public-company-surface-cta`
  - `174-public-company-mobile-back`
  - 결과: `17 passed`

## Result Snapshot
| Surface | Source of truth | Current tests | Result | Notes |
| --- | --- | --- | --- | --- |
| About | `app/about/page.tsx`, `app/about/layout.tsx`, `app/about/aboutLandingAssets.ts` | `25` | 정상 | locale별 메타와 이미지 랜딩 fallback이 일관된다 |
| Help | `app/help/layout.tsx`, `app/help/page.tsx` | `25`, `104`, `30` | 정상 | public metadata, FAQ 탐색, 1:1 문의 진입 copy가 현재 구현과 맞다 |
| Global announcement | `app/config/siteAnnouncements.ts`, `app/utils/siteAnnouncements.ts`, `app/components/GlobalAnnouncementModal.tsx` | `103` | 정상 | path normalize, exclusion, locale fallback, dismissal key 의미가 안정적이다 |
| Partnership | `app/company/partnership/layout.tsx`, `app/company/partnership/page.tsx`, `/api/company/partnership-inquiry` | `110`, `172`, `25` | 정상 | media kit modal과 public inquiry mail submit이 모두 current truth에 맞게 동작한다 |
| Newsroom | `app/company/news/layout.tsx`, `app/company/news/page.tsx` | `25`, `173` | 정상 | 기사 카드는 archive preview로만 노출되고 dead link가 제거되었다 |
| Notices | `app/company/notices/layout.tsx`, `app/company/notices/page.tsx` | 간접 `25` 범위 밖 | 부분 보장 | 아코디언 자체는 단순하지만 데이터가 in-file 정적 배열이다 |
| Careers | `app/company/careers/layout.tsx`, `app/company/careers/page.tsx` | `173` | 정상 | 채용 링크 owner가 없을 때 upcoming roles 안내형 surface로 내려가 있다 |
| Investors | `app/company/investors/layout.tsx`, `app/company/investors/page.tsx` | `173` | 정상 | annual report rows는 read-only 안내형으로 정리돼 false click이 없다 |

## Detailed Findings

### 1. `about`는 공개 브랜드 랜딩으로 현재 기준 충분히 닫혀 있다
- source of truth
  - `app/about/layout.tsx`
  - `app/about/page.tsx`
  - `app/about/aboutLandingAssets.ts`
- 현재 동작
  - locale별 title/description/canonical이 layout에서 생성된다
  - 이미지 랜딩 자산이 있으면 image landing, 없으면 editorial fallback을 렌더한다
  - 비-ko locale은 해당 locale 자산이 없을 때 `ko` 자산으로 안전하게 fallback한다
- 테스트 보장
  - `25-public-metadata`
- 판정
  - `정상`

### 2. `help`는 public info + self-service 안내 surface로 안정적이다
- source of truth
  - `app/help/layout.tsx`
  - `app/help/page.tsx`
- 현재 동작
  - public metadata는 `buildPublicMetadata()`를 통해 일관되게 생성된다
  - FAQ 검색 empty state, inbox reply guidance, 1:1 문의 진입 copy가 현재 제품 정책과 맞는다
  - account/auth 감사에서 닫은 `운영팀 문의`, `비밀번호 재설정 미지원` 의미와 충돌하지 않는다
- 테스트 보장
  - `25-public-metadata`
  - `104-help-self-service`
  - `30-robots-policy`
- 판정
  - `정상`

### 3. global site announcement는 공용 운영 토글로 의미가 분명하다
- source of truth
  - `app/config/siteAnnouncements.ts`
  - `app/utils/siteAnnouncements.ts`
  - `app/components/GlobalAnnouncementModal.tsx`
- 현재 동작
  - 활성 공지는 config 배열에서 priority 기준 1건만 선택된다
  - locale prefix가 붙은 path도 normalize 후 exclusion을 검사한다
  - dismissal key는 `announcement.id` 기준 localStorage에 저장된다
  - `/admin` exclusion은 기본 정책으로 잠겨 있다
- 테스트 보장
  - `103-site-announcements`
- 판정
  - `정상`

### 4. `company/partnership`는 media kit + inquiry submit까지 현재 기준 정상이다
- source of truth
  - `app/company/partnership/layout.tsx`
  - `app/company/partnership/page.tsx`
  - `app/api/company/partnership-inquiry/route.ts`
- 현재 동작
  - metadata는 정상이다
  - media kit는 modal carousel과 locale copy 기준으로 동작한다
  - 문의 폼은 이제 public route로 연결되고, 유효한 submit은 `locally.partners@gmail.com` 수신 메일로 전달된다
  - route는 필수값, 이메일 형식, message 길이를 fail-closed로 검증한다
  - non-production에서는 `opsAdmin` mock capture를 사용해 실제 발송 없이 계약 검증이 가능하다
- 테스트 보장
  - `110-partnership-media-kit`
  - `172-partnership-inquiry-route`
  - `25-public-metadata`
- 판정
  - `정상`

### 5. `company/news`, `careers`, `investors`는 dead CTA 제거 후 안내형 public surface로 정리됐다
- source of truth
  - `app/company/news/page.tsx`
  - `app/company/careers/page.tsx`
  - `app/company/investors/page.tsx`
- 현재 동작
  - 각 layout은 `buildPublicMetadata()`를 사용해 메타를 일관되게 제공한다
  - `news` 기사 카드는 외부 링크 대신 archive preview 배지와 안내 문구를 노출한다
  - `careers`는 open positions가 아니라 upcoming roles 읽기 surface로 내려가 있고 지원 링크는 더 이상 노출되지 않는다
  - `investors` annual report rows는 다운로드 owner가 붙기 전까지 read-only 안내형으로 유지된다
- 테스트 보장
  - `25-public-metadata`
  - `173-public-company-surface-cta`
- 판정
  - `정상`

### 6. `company/notices`는 여전히 정적 데이터 의존이 남아 있다
- source of truth
  - `app/company/notices/page.tsx`
- 현재 동작
  - 읽기 자체는 가능하지만 데이터 source가 운영 시스템이 아니라 코드 상수다
- 테스트 보장
  - 메타 수준에서만 간접 `25-public-metadata`
- 판정
  - `부분 보장`

### 7. public company pages의 모바일 fallback은 이제 public brand surface 의미와 맞는다
- 확인 사실
  - `company/news`, `company/notices`의 모바일 back은 내부 진입이면 `router.back()`, direct entry면 `/about`으로 fallback한다
  - public page가 guest account surface로 튀는 동선은 제거됐다
- 테스트 보장
  - `174-public-company-mobile-back`
- 판정
  - `정상`

## Coverage Gap
- `company/notices` 본문 interaction은 여전히 전용 E2E가 없다

## Final Verdict
- `public metadata / robots / announcement / help` 축은 현재 기준 `정상`
- `company/news`, `company/careers`, `company/investors`의 false click affordance와 public mobile fallback mismatch는 닫혔고, 남은 active gap은 `company/notices`의 정적 데이터 owner다
- 다음 핀셋 수정 1순위는 `company/notices`의 운영 truth 정리다
