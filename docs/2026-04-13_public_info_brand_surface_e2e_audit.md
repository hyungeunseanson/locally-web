# 공개 정보·브랜드 Surface E2E 감사

## Summary
- 감사 범위: `about`, `company/*`, `help`, `global site announcement`
- 현재 기준 결론:
  - `about`, `help`, `global site announcement`는 메타/공개 진입/운영 의미 기준으로 `정상`
  - `company/partnership`는 media kit 읽기 surface는 `정상`, 하지만 문의 폼 submit은 아직 `UI-only placeholder`라 `부분 보장`
  - `company/news`, `company/notices`, `company/careers`, `company/investors`는 메타는 `정상`이지만, 본문 CTA와 데이터 truth는 정적 placeholder가 섞여 있어 `부분 보장`
- 최신 재검증 결과:
  - `25-public-metadata`
  - `29-sitemap`
  - `30-robots-policy`
  - `103-site-announcements`
  - `104-help-self-service`
  - `110-partnership-media-kit`
  - 결과: `18 passed (17.6s)`

## Result Snapshot
| Surface | Source of truth | Current tests | Result | Notes |
| --- | --- | --- | --- | --- |
| About | `app/about/page.tsx`, `app/about/layout.tsx`, `app/about/aboutLandingAssets.ts` | `25` | 정상 | locale별 메타와 이미지 랜딩 fallback이 일관된다 |
| Help | `app/help/layout.tsx`, `app/help/page.tsx` | `25`, `104`, `30` | 정상 | public metadata, FAQ 탐색, 1:1 문의 진입 copy가 현재 구현과 맞다 |
| Global announcement | `app/config/siteAnnouncements.ts`, `app/utils/siteAnnouncements.ts`, `app/components/GlobalAnnouncementModal.tsx` | `103` | 정상 | path normalize, exclusion, locale fallback, dismissal key 의미가 안정적이다 |
| Partnership | `app/company/partnership/layout.tsx`, `app/company/partnership/page.tsx` | `110`, `25` | 부분 보장 | media kit modal은 green, 문의 폼은 실제 전송 owner가 없다 |
| Newsroom | `app/company/news/layout.tsx`, `app/company/news/page.tsx` | `25` | 부분 보장 | 메타는 정상이나 기사 링크가 `href="#"` 정적 placeholder다 |
| Notices | `app/company/notices/layout.tsx`, `app/company/notices/page.tsx` | 간접 `25` 범위 밖 | 부분 보장 | 아코디언 자체는 단순하지만 데이터가 in-file 정적 배열이다 |
| Careers | `app/company/careers/layout.tsx`, `app/company/careers/page.tsx` | 간접 `25` 범위 밖 | 부분 보장 | open positions CTA가 `href="#"` placeholder다 |
| Investors | `app/company/investors/layout.tsx`, `app/company/investors/page.tsx` | 간접 `25` 범위 밖 | 부분 보장 | annual report 카드가 클릭 affordance만 있고 실제 링크가 없다 |

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

### 4. `company/partnership`는 읽기 surface는 닫혔지만 submit truth는 비어 있다
- source of truth
  - `app/company/partnership/layout.tsx`
  - `app/company/partnership/page.tsx`
- 현재 동작
  - metadata는 정상이다
  - media kit는 modal carousel과 locale copy 기준으로 동작한다
  - 하지만 문의 폼은 `onSubmit={(event) => event.preventDefault()}`만 있고, 실제 API 호출이나 mail/contact owner가 없다
- 테스트 보장
  - `110-partnership-media-kit`
  - `25-public-metadata`
- 판정
  - `부분 보장`
- 운영 리스크
  - 사용자는 “문의 보내기” CTA를 실제 동작으로 기대하지만 현재는 no-op다

### 5. `company/news`, `notices`, `careers`, `investors`는 메타는 정상이지만 본문 truth는 placeholder 비중이 높다
- source of truth
  - `app/company/news/page.tsx`
  - `app/company/notices/page.tsx`
  - `app/company/careers/page.tsx`
  - `app/company/investors/page.tsx`
- 현재 동작
  - 각 layout은 `buildPublicMetadata()`를 사용해 메타를 일관되게 제공한다
  - 반면 페이지 본문은 전부 in-file static array 또는 static card로 구성돼 있다
  - `news` 기사, `careers` 공고는 `href="#"`이고 실제 도착지가 없다
  - `investors` annual report rows는 클릭 affordance만 있고 링크/다운로드 owner가 없다
  - `notices`는 읽기 자체는 가능하지만 데이터 source가 운영 시스템이 아니라 코드 상수다
- 테스트 보장
  - 메타 수준에서만 `25-public-metadata`
- 판정
  - `부분 보장`
- 운영 리스크
  - 검색 유입이나 public entry 이후 사용자가 클릭 가능한 공개 정보 surface로 기대할 때 dead CTA가 발생한다

### 6. public company pages의 모바일 fallback은 현재 정보성 surface 의미와 약간 어긋난다
- 확인 사실
  - `company/news`, `company/notices`의 모바일 back fallback은 history가 없으면 `/account`로 이동한다
- 판정
  - `리스크`
- 이유
  - 해당 페이지는 public surface인데, direct entry 사용자를 guest account surface로 보내는 것은 정보 구조상 다소 어색하다
  - 다만 치명적인 기능 결함은 아니므로 low-risk navigation mismatch로 본다

## Coverage Gap
- `company/news`, `company/notices`, `company/careers`, `company/investors` 본문 interaction 자체를 잠그는 E2E는 없다
- `partnership`는 media kit만 테스트되고, contact submit owner는 아예 구현되지 않았다
- public info pages의 모바일 back fallback(`/account`) 의미는 테스트로 잠겨 있지 않다

## Final Verdict
- `public metadata / robots / announcement / help` 축은 현재 기준 `정상`
- `company/*`는 메타/SEO shell은 괜찮지만, 실제 공개 정보 본문은 placeholder 또는 no-op affordance가 남아 있어 전체 도메인 판정은 `부분 보장`
- 다음 핀셋 수정 1순위는 아래 둘 중 하나다
  1. `company/partnership` 문의 폼을 실제 owner에 연결하거나, 안내형 읽기 surface로 명시적으로 다운그레이드
  2. `news/careers/investors`의 dead CTA를 제거하거나 실제 링크 owner를 붙여 public truth를 맞추기
