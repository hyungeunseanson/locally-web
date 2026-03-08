# 일본어 누락 구조 감사 및 구현 계획

작성일: 2026-03-08

## 목적

일본어 미노출 이슈를 "번역 키 몇 개 추가" 수준이 아니라 구조 문제로 보고, 아래 범위를 전수 점검했다.

- 호스트 지원서
- 체험 등록
- 체험 수정
- 고객센터 문의 모달
- 이용약관 / 개인정보 처리방침 / 여행약관 / 취소 및 환불 정책

이번 문서는 구현이 아니라, 실제 수정에 들어가기 전에 어디가 막혀 있고 어떤 순서로 풀어야 하는지 정리한 감사 보고서다.

## 결론 요약

1. 호스트 지원서와 체험 등록은 일본어 번역 키가 부족한 정도가 아니라, 화면 라벨과 저장값이 같은 문자열로 묶여 있어 구조 분리가 먼저 필요하다.
2. 고객센터 모달은 구조 개편까지는 필요 없고, 하드코딩 문자열을 `useLanguage()` 체계로 편입하면 해결 가능하다.
3. 약관/정책 본문은 현재 한국어 템플릿 문자열 상수 하나에 의존하고 있어 `LanguageContext`에 넣는 방식으로는 유지보수가 불가능하다.
4. 체험 수정 화면은 일부 다국어 필드를 이미 지원하지만, 생성 화면의 설정값 구조를 공유하기 때문에 생성/수정을 분리해서 볼 수 없다.
5. 기존 다국어 소비 경로는 이미 있다. `app/utils/contentHelper.ts`가 `title_ja`, `description_ja`, `category_ja`를 우선 사용하도록 되어 있어, 문제의 핵심은 "표시"보다 "입력/관리 구조"에 있다.

## 현재 i18n 구조

### 1. 공통 번역 사전

- `app/context/LanguageContext.tsx`
- `ko/en/ja/zh` 딕셔너리를 한 파일에 인라인으로 가지고 있다.
- 짧은 UI 문구에는 적합하지만, 약관/정책 같은 장문 본문이나 호스트 서약 안내문까지 여기에 넣는 구조는 적합하지 않다.

### 2. 다국어 콘텐츠 소비 경로

- `app/utils/contentHelper.ts`
- `getContent(data, field, lang)`가 `field_lang` 값을 우선 사용하고 없으면 기본 필드로 폴백한다.
- 즉, 체험 상세/검색/카드에서 일본어 콘텐츠를 보여주는 소비 경로는 이미 존재한다.

## 전수 조사 결과

## A. 호스트 지원서

### 관련 파일

- `app/host/register/page.tsx`
- `app/host/register/components/HostRegisterForm.tsx`
- `app/utils/languageLevels.ts`

### 확인 결과

#### 1. 페이지 로직 레벨 하드코딩

`app/host/register/page.tsx`

- 156-165: Step 2 검증 토스트가 한국어 하드코딩
- 187-204: 제출 전 검증 / 로그인 필요 오류가 한국어 하드코딩
- 271-276: 성공/실패 토스트가 한국어 하드코딩
- 파일 전체에서 `useLanguage()`를 사용하지 않는다

#### 2. 폼 UI 거의 전체가 한국어 고정

`app/host/register/components/HostRegisterForm.tsx`

- 56-61: `LANGUAGE_OPTIONS` 자체가 한국어 라벨 기반
- 166-186: 국적 선택 설명과 버튼 텍스트 하드코딩
- 194-211: 언어/레벨/자격증 설명 및 placeholder 하드코딩
- 219-248: 이름/생년월일/연락처/가입 경로 UI 하드코딩
- 258-268: 프로필 소개 텍스트 하드코딩
- 277-300: 신분증 업로드 안내 하드코딩
- 307-323: 정산 계좌 입력 폼 하드코딩
- 331-344: 서약 체크박스 문구 하드코딩
- 353-418: 안전 가이드라인 6개 항목 전체가 JSX 안에 장문으로 하드코딩
- 425-432: 이전/다음/신청 완료 버튼 하드코딩

#### 3. 언어 선택 구조가 값/표시를 분리하지 않음

`app/host/register/components/HostRegisterForm.tsx`

- `toggleLanguage(lang.label)` 방식이라 실제 저장값도 `한국어`, `영어`, `일본어`, `중국어`로 들어간다.

`app/utils/languageLevels.ts`

- 3-5: `LanguageLevelEntry.language`가 자유 문자열
- 67-81: `formatLanguageLevelLabel()`이 한국어 레벨 설명만 반환
- 84-93: 요약 문자열도 `언어명 + Lv.n` 포맷에 묶여 있다

### 판단

호스트 지원서는 단순 번역 키 추가 대상이 아니다.

- 짧은 라벨/버튼/에러 메시지는 `LanguageContext`로 옮길 수 있다.
- Step 8 안전 가이드라인 같은 장문은 별도 로케일 콘텐츠 모듈로 빼야 한다.
- 언어 옵션은 저장값과 표시 라벨을 분리해야 한다.

### 권장 방향

- 1차: DB 저장값은 유지한다.
- 1차: 옵션 구조를 `{ value, labelKey, code, flag }` 형태로 바꾼다.
- 1차: Step 8 장문은 `app/host/register/content.ts` 같은 별도 파일로 분리한다.
- 2차: 필요 시 언어 저장값을 코드 기반(`ko`, `en`, `ja`, `zh`)으로 마이그레이션한다.

## B. 체험 등록

### 관련 파일

- `app/host/create/config.ts`
- `app/host/create/page.tsx`
- `app/host/create/components/ExperienceFormSteps.tsx`
- `app/utils/languageLevels.ts`

### 확인 결과

#### 1. 설정 파일이 한국어 문자열을 저장값으로 사용

`app/host/create/config.ts`

- 3-6: `MAJOR_CITIES`가 한국어 도시명을 직접 값으로 사용
- 8-20: `CATEGORIES`가 한국어 문자열 배열
- 23-25: `SUPPORTED_LANGUAGES`가 한국어 문자열 배열
- 28: `FIXED_REFUND_POLICY`가 한국어 고정 문자열
- 45-47: 기본 itinerary 타이틀이 `만남`
- 58-61: 기본 활동 강도가 `보통`

이 구조에서는 일본어 UI를 붙여도 저장되는 값, 선택 상태 비교, 수정 화면 렌더링이 모두 한국어 문자열에 의존한다.

#### 2. 생성 페이지 로직 하드코딩

`app/host/create/page.tsx`

- 49-137: 단계별 검증 에러가 모두 한국어 토스트
- 206-219: 이미지 검증 에러가 한국어
- 306-307: 로그인 오류가 한국어
- 369-376: 성공/실패 토스트가 한국어
- 426-432: 하단 네비게이션 버튼이 한국어
- 파일 전체에서 `useLanguage()`를 사용하지 않는다

#### 3. 생성 폼 UI 하드코딩

`app/host/create/components/ExperienceFormSteps.tsx`

- 118-157: 진행 언어 선택 UI가 한국어 값에 직접 의존
- 183-195: 카테고리 아이콘 매핑이 한국어 카테고리명에 직접 의존
- 201-260: 지역/카테고리 안내와 버튼 라벨 하드코딩
- 275-278: 언어 단계 설명 하드코딩
- 287-318: 대표사진/제목/메인 배지 하드코딩
- 342-434: 만나는 장소/주소/동선/사진 업로드 UI 하드코딩
- 446-529: 설명/포함/불포함/준비물 하드코딩
- 540-602: 참가 연령/활동 강도/환불 정책 설명 하드코딩
- 613-659: 가격/단독 투어 옵션 하드코딩
- 676-686: 완료 화면 하드코딩

### 판단

체험 등록의 핵심 문제는 "번역 누락"이 아니라 "설정값이 곧 화면 문구"인 설계다.

### 권장 방향

- 도시/카테고리/언어/활동 강도/환불 정책을 모두 구조화한다.
- 예시:

```ts
type LocalizedOption = {
  value: string;
  labelKey: string;
};
```

- 초기 단계에서는 `value`를 기존 한국어 값으로 둬서 DB 호환성을 유지한다.
- 화면에는 `t(labelKey)`를 사용한다.
- 카테고리 아이콘 매핑도 한국어 문자열이 아니라 `value` 또는 별도 `id`에 매핑한다.

## C. 체험 수정

### 관련 파일

- `app/host/experiences/[id]/edit/page.tsx`
- `app/host/create/config.ts`
- `app/utils/languageLevels.ts`

### 확인 결과

#### 1. 좋은 점

`app/host/experiences/[id]/edit/page.tsx`

- 16-21: `useLanguage()` 사용
- 89-98: `title_en/title_ja/title_zh`, `description_en/description_ja/description_zh`, `category_en/category_ja/category_zh` 초기화
- 169-178: 저장 시 다국어 필드 업데이트

즉, 수정 화면은 "다국어 필드 저장" 자체는 이미 가능하다.

#### 2. 남아 있는 구조 문제

- 85-86: 기본 `activity_level`이 여전히 한국어 값 `보통`
- 107-123: 이미지 검증 에러가 한국어
- 132-134: 단독 투어 가격 검증 에러가 한국어
- 244-260: 동선 사진 업로드/삭제 성공 메시지가 한국어
- 341-349, 357-359: 대표 사진 관리 UI 일부 한국어
- 403-433: `SUPPORTED_LANGUAGES`를 그대로 사용
- 440-444: `CATEGORIES`를 그대로 사용
- 471-520: 단독 투어 옵션 / 만나는 장소 / 주소 라벨 일부 한국어
- 560: `불포함 사항` 하드코딩
- 596-620: 동선 사진 관련 버튼 하드코딩
- 656-658: 환불 정책 설명 하드코딩

### 판단

수정 화면은 "절반만 현지화된 상태"다.

- 입력 필드는 일부 다국어지만
- 옵션 구성, 검증 메시지, 공용 설정값은 여전히 생성 화면의 한국어 중심 구조를 공유한다

### 권장 방향

- 생성 화면 구조를 먼저 정규화하고
- 수정 화면은 같은 옵션 메타데이터를 재사용하도록 통합한다
- 생성과 수정을 서로 다른 번역 체계로 따로 고치면 유지보수 비용이 두 번 든다

## D. 고객센터 문의 모달

### 관련 파일

- `app/help/page.tsx`

### 확인 결과

FAQ 본문은 이미 `useLanguage()`를 쓰고 있지만, 문의 모달과 제출 로직은 아직 한국어 하드코딩이 남아 있다.

- 158-169: "현재 상담 가능한 관리자가 없습니다." 하드코딩
- 197-208: 성공/실패 토스트와 계정 동기화 지연 문구 하드코딩
- 343: 닫기 SR 텍스트 하드코딩
- 349-357: 모달 제목/설명/placeholder 하드코딩
- 369: 전송 버튼 텍스트 하드코딩

### 판단

이 영역은 구조 개편 대상이 아니라, 일반적인 i18n 보강 대상이다.

### 권장 방향

- `LanguageContext`에 키 추가
- `help.page.tsx`에서 하드코딩 제거
- 문의 생성 성공 후 이동도 현재는 `/guest/inbox`로만 보내는데, 추후에는 생성된 `room.id`를 붙여 특정 문의로 바로 열리게 맞추는 것이 좋다

## E. 약관 / 정책 본문

### 관련 파일

- `app/constants/legalText.ts`
- `app/components/SiteFooter.tsx`
- `app/components/LoginModal.tsx`

### 확인 결과

#### 1. 약관 본문이 전부 한국어 상수 문자열

`app/constants/legalText.ts`

- 3: `TERMS_OF_USE`
- 124: `PRIVACY_POLICY`
- 290: `TRAVEL_TERMS`
- 546: `REFUND_POLICY`

모두 거대한 한국어 템플릿 문자열이다.

#### 2. 푸터와 로그인 모달이 이 한국어 본문을 직접 소비

`app/components/SiteFooter.tsx`

- 8: 한국어 legal constants 직접 import
- 30-36: 모달 제목/본문 선택 로직이 한국어 고정
- 186-187: 사업자 정보도 한국어/일본어 혼합 고정 문자열
- 223-227: 닫기 버튼 `확인` 하드코딩

`app/components/LoginModal.tsx`

- 9: 한국어 legal constants 직접 import
- 197-205: 약관 오버레이 제목/본문이 한국어 고정
- 213: `확인` 하드코딩
- 233-236, 260-331, 353-380, 420: 회원가입 문구 일부도 한국어 하드코딩

### 판단

이 영역은 `LanguageContext`에 문자열 몇 개 넣는 방식으로 처리하면 안 된다.

- 본문이 너무 길다
- 법무 검토/개정 이력 관리가 필요하다
- 푸터와 로그인 모달이 같은 원문을 공유해야 한다

### 권장 방향

장문 법률 문서는 별도 로케일 레지스트리로 분리한다.

예시:

```ts
export type LegalDocType = 'terms' | 'privacy' | 'travel' | 'refund';

export function getLegalDocument(
  lang: Locale,
  type: LegalDocType
): { title: string; body: string } {
  // locale fallback 포함
}
```

권장 파일 구조 예시:

- `app/constants/legal/ko.ts`
- `app/constants/legal/en.ts`
- `app/constants/legal/ja.ts`
- `app/constants/legal/zh.ts`
- `app/constants/legal/index.ts`

그리고 `SiteFooter.tsx`, `LoginModal.tsx`는 `useLanguage()`의 현재 언어값으로 이 헬퍼를 호출하도록 바꾼다.

## 구조적 원인 정리

이번 조사에서 반복적으로 확인된 근본 원인은 아래 4가지다.

1. 저장값과 표시값이 분리되지 않음
- 도시명, 카테고리명, 언어명, 활동 강도 등이 모두 한국어 문자열 그 자체다.

2. 장문 콘텐츠가 JSX 안에 직접 들어가 있음
- 호스트 안전 가이드라인, 약관/정책 본문이 대표 사례다.

3. 일부 화면만 `useLanguage()`를 사용함
- 소비 화면은 번역 훅이 들어가 있지만, 입력/관리 화면은 아직 미적용 구간이 많다.

4. 공용 설정이 생성/수정/관리 화면에 동시에 퍼져 있음
- `app/host/create/config.ts` 한 군데를 고치지 않으면 생성과 수정이 같이 막힌다.

## 권장 구현 원칙

1. 짧은 UI 문구는 `LanguageContext` 키로 관리한다.
2. 장문 콘텐츠는 별도 콘텐츠 모듈로 관리한다.
3. 옵션은 문자열 배열이 아니라 객체 배열로 관리한다.
4. 1차 배포에서는 DB 저장값을 유지해 마이그레이션 리스크를 피한다.
5. 2차에서 필요하면 locale-neutral code 체계로 데이터 마이그레이션을 검토한다.

## 단계별 구현 계획

## Phase 1. 호스트 지원서 구조 정리

### 목표

- 일본어 UI 제공
- 장문 안내문 분리
- 언어 선택 구조 정규화

### 작업

1. `app/host/register/page.tsx`에 `useLanguage()` 도입
2. 검증/에러/성공 토스트를 모두 번역 키로 이동
3. `app/host/register/components/HostRegisterForm.tsx`의 라벨/placeholder/버튼/설명을 번역 키로 이동
4. `LANGUAGE_OPTIONS`를 아래 형태로 변경

```ts
const HOST_LANGUAGE_OPTIONS = [
  { value: '한국어', labelKey: 'lang_ko', code: 'ko', flag: '🇰🇷' },
  { value: '영어', labelKey: 'lang_en', code: 'en', flag: '🇺🇸' },
  { value: '일본어', labelKey: 'lang_ja', code: 'ja', flag: '🇯🇵' },
  { value: '중국어', labelKey: 'lang_zh', code: 'zh', flag: '🇨🇳' },
];
```

5. Step 8 안전 가이드라인을 `app/host/register/content.ts`로 분리
6. `app/utils/languageLevels.ts`에 locale-aware formatter 추가

### 산출물

- 일본어 지원되는 호스트 지원서
- 하드코딩 장문 제거
- 저장값 호환 유지

## Phase 2. 체험 등록/수정 공용 옵션 정규화

### 목표

- 생성/수정 공통 구조 확립
- 일본어 UI 적용 시 저장값 충돌 방지

### 작업

1. `app/host/create/config.ts`를 문자열 배열에서 메타데이터 기반으로 변경

예시:

```ts
export const EXPERIENCE_CATEGORIES = [
  { value: '맛집 탐방', labelKey: 'exp_cat_food', icon: 'utensils' },
];
```

2. 아래 항목 전체를 객체형 옵션으로 변경
- 도시
- 카테고리
- 진행 언어
- 활동 강도
- 고정 환불 정책 표시 텍스트

3. `app/host/create/page.tsx`에 `useLanguage()` 도입
4. 생성 화면의 검증/토스트/버튼 전부 현지화
5. `app/host/create/components/ExperienceFormSteps.tsx`에서 `t(labelKey)` 기반 렌더링으로 전환
6. `app/host/experiences/[id]/edit/page.tsx`가 같은 옵션 메타데이터를 재사용하도록 통일
7. 카테고리 아이콘 매핑을 한국어 문구가 아니라 option id/value 기준으로 변경

### 산출물

- 생성/수정 간 옵션 구조 일치
- 일본어 UI 적용 가능
- 기존 DB 값 호환 유지

## Phase 3. 고객센터 문의 모달 현지화

### 목표

- 일본어 문의 UX 완성

### 작업

1. 문의 모달 제목/설명/placeholder/버튼/닫기 문구 번역 키 추가
2. 제출 실패/성공/관리자 없음/계정 동기화 지연 메시지 번역 키 추가
3. 문의 생성 후 `room.id` 기반 딥링크 이동으로 개선 검토

### 산출물

- `/help` 문의 모달 일본어 지원
- 문의 접수 피드백 일관화

## Phase 4. 법률 문서 로케일 레지스트리 도입

### 목표

- 약관/정책 본문을 언어별로 안정적으로 관리
- 푸터와 로그인 모달에서 동일 소스 사용

### 작업

1. `app/constants/legalText.ts` 의존 제거
2. 언어별 법률 문서 파일 분리
3. `getLegalDocument(lang, type)` 헬퍼 도입
4. `SiteFooter.tsx`를 현재 언어 기반 본문 호출 구조로 변경
5. `LoginModal.tsx`도 같은 헬퍼 사용
6. 로그인/회원가입 화면의 남은 하드코딩 문구도 같이 정리

### 산출물

- 약관/정책 일본어 본문 노출 가능
- 법률 문서 유지보수 경로 단일화

## Phase 5. QA 및 배포 검증

### 회귀 테스트 경로

- `/host/register`
- `/host/create`
- `/host/experiences/[id]/edit`
- `/help`
- 푸터 약관 모달
- 로그인/회원가입 모달의 약관 보기

### 검증 항목

1. 일본어 선택 시 한국어 하드코딩이 남지 않는지 확인
2. 번역 누락 시 한국어 또는 기본 언어로 안전하게 폴백되는지 확인
3. 생성/수정 저장 후 DB 값이 기존 구조와 호환되는지 확인
4. 상세 페이지 / 검색 / 카드에서 `title_ja`, `description_ja`, `category_ja` 소비가 깨지지 않는지 확인
5. 모바일 모달과 데스크톱 모달에서 줄바꿈/스크롤이 정상인지 확인

## 우선순위

### P1

- 호스트 지원서
- 체험 등록/수정 공용 옵션 구조 정리

이 두 개가 일본어 누락의 핵심 구조 문제다.

### P2

- 고객센터 문의 모달

구조는 가볍지만 사용자 체감이 크다.

### P3

- 약관/정책 본문 로케일 분리

구현 난도와 번역량이 크므로 별도 배포 단위로 묶는 것이 안전하다.

## 리스크

1. 장문 약관의 번역 정확도
- 단순 UI 번역과 달리 법률 문구 검토가 필요하다.

2. 옵션 저장값과 화면값 혼용
- 생성/수정 중 한쪽만 바꾸면 선택 상태 비교가 깨질 수 있다.

3. 기존 데이터 호환성
- 이미 저장된 `category`, `languages`, `rules.activity_level` 값이 한국어이므로 1차에서는 호환 레이어가 반드시 필요하다.

4. 번역 사전 비대화
- `LanguageContext.tsx`에 장문을 계속 넣으면 관리가 더 어려워진다.

## 최종 권고

일본어 누락 대응은 아래 순서가 가장 안전하다.

1. 호스트 지원서와 체험 등록/수정의 옵션 구조를 먼저 정리한다.
2. 그 위에서 짧은 UI 문구를 `LanguageContext`로 옮긴다.
3. 고객센터 모달은 별도 구조 변경 없이 빠르게 현지화한다.
4. 약관/정책은 법률 문서 레지스트리로 분리해서 별도 배포한다.

핵심은 "번역 키 추가"보다 "표시용 텍스트와 저장용 값을 분리"하는 것이다. 이 단계 없이 일본어를 붙이면 화면은 번역돼도 생성/수정/재편집 흐름에서 다시 한국어 중심 구조가 드러난다.
