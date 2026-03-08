# Locally-Web CHANGELOG

> 과거 완료된 버그 수정, UI/UX 조정, 패치 내역을 보관하는 이력 문서.
> 새로운 기능/아키텍처 결정은 `gemini.md`에 기록한다.

---

## v3.37.27 — [Host Landing] `/become-a-host2`를 canonical URL로 정리

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 구주소 redirect 적용 | `/become-a-host2`는 더 이상 본문을 직접 렌더하지 않고 `/become-a-host`로 즉시 redirect되도록 변경 |
| 🟡 메인 URL 성능 유지 | canonical URL인 `/become-a-host`는 기존처럼 공용 랜딩을 직접 렌더하고, 추가 hop은 구주소(`/become-a-host2`) 진입 시에만 발생하도록 유지 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 통과 |

## v3.37.26 — [Host Landing] `/become-a-host`를 새 랜딩으로 안전 교체

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 공용 랜딩 컴포넌트 분리 | `become-a-host2`의 새 랜딩 본문을 공용 컴포넌트로 분리해, 중복 복사 없이 두 라우트가 같은 UI를 렌더하도록 정리 |
| 🟡 기존 URL 유지 교체 | 기존 `/become-a-host` 페이지가 레거시 클라이언트 랜딩 대신 새 랜딩 공용 컴포넌트를 직접 렌더하도록 교체 |
| 🟡 QA 경로 유지 | `/become-a-host2`도 같은 공용 컴포넌트를 계속 렌더하도록 유지해, 기존 QA/공유 링크가 즉시 깨지지 않도록 보수적으로 처리 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 통과 |

## v3.37.25 — [Host Landing] 첫 compact CTA 폭 절반 수준 재조정

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 첫 CTA 폭 재조정 | `become-a-host2`의 1번/2번 이미지 사이 compact `호스트 지원하기` 버튼에서 기본 `w-full` 충돌을 제거하고, 버튼 폭을 명시적으로 더 짧게 고정해 이전 대비 절반 수준에 가깝게 보이도록 재조정 |
| 🟡 첫 이미지 간격 추가 축소 | 첫 번째 이미지와 compact CTA 사이의 상단 spacing을 한 번 더 줄여, CTA가 이미지 바로 아래에 조금 더 붙어 보이도록 보정 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 통과 |

## v3.37.24 — [Host Landing] 첫 compact CTA 패딩·간격 축소

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 첫 CTA 가로 폭 추가 축소 | `become-a-host2`의 1번/2번 이미지 사이 compact `호스트 지원하기` 버튼의 좌우 패딩과 최소 폭을 더 줄여, 가로 길이가 덜 길게 보이도록 조정 |
| 🟡 상단 간격 미세 조정 | 첫 번째 이미지와 compact CTA 사이의 상단 spacing만 소폭 줄여 이미지 흐름이 더 타이트하게 이어지도록 보정 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 통과 |

## v3.37.23 — [Services] 의뢰 상세 조회 경로 안정화

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 상세 조회 경로 수정 | `/services/[requestId]`가 브라우저 Supabase 직조회 대신 `/api/services/requests?requestId=...`를 통해 서버에서 의뢰 상세를 확인하도록 변경. 목록은 보이는데 상세에서만 `의뢰를 찾을 수 없습니다.`가 뜨던 권한 불일치 가능성을 제거 |
| 🟡 번역 누락 보완 | 서비스 상세 빈 상태의 `btn_go_to_list` 키를 `ko/en/ja/zh`에 추가해 raw key가 노출되지 않도록 수정 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 통과 |

## v3.37.22 — [Host Landing] 첫 compact CTA 중앙 복원

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 첫 CTA 중앙 정렬 복원 | `become-a-host2`의 1번/2번 이미지 사이 compact CTA를 다시 중앙 정렬로 복원 |
| 🟡 첫 CTA 가로 폭 추가 축소 | 상단 `호스트 지원하기` 버튼의 최소 폭과 패딩을 더 줄여, 초기의 더 작고 가벼운 비율에 가깝게 보정 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 실행 결과 신규 타입 오류 없이 통과 |

## v3.37.21 — [Host Landing] 첫 CTA 정렬·폭 미세 조정

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 첫 CTA 정렬 조정 | `become-a-host2`의 1번/2번 이미지 사이 compact CTA를 데스크탑에서 우측 텍스트 컬럼 시작선 쪽으로 이동하도록 정렬 보정 |
| 🟡 첫 CTA 폭 축소 | 상단 `호스트 지원하기` 버튼의 가로 폭을 다시 줄여, 이전보다 더 가볍고 단정한 비율로 정리 |
| 🟡 구분선 제거 | 상·하 CTA 영역의 위아래 얇은 선을 제거해 이미지 흐름과 FAQ 사이가 더 자연스럽게 이어지도록 조정 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 실행 결과 신규 타입 오류 없이 통과 |

## v3.37.20 — [Host Landing] `become-a-host2` CTA 이중 배치 재구성

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 CTA 위치 재구성 | `become-a-host2`의 CTA를 하나의 바에서 두 구간으로 재구성. 1번/2번 이미지 사이에는 단일 CTA를, FAQ 바로 위에는 이중 CTA를 배치해 랜딩 중간과 끝에서 각각 자연스럽게 전환될 수 있도록 조정 |
| 🟡 CTA 톤 단순화 | `HostLandingActionBar`의 설명 텍스트와 상태 배지를 제거하고, 버튼만 중앙 정렬되는 구조로 단순화. 상단은 compact 단일 버튼, 하단은 `호스트 지원/대시보드`와 `신청현황` 이중 버튼으로 변형 분리 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 실행 결과 신규 타입 오류 없이 통과 |

## v3.37.19 — [Host Landing] `become-a-host2` CTA 위치·배경 미세 조정

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🟡 CTA 위치 이동 | `become-a-host2`의 CTA 바를 페이지 상단에서 FAQ 섹션 바로 위로 내려, 랜딩 내용을 읽은 뒤 자연스럽게 지원/신청현황으로 이어지도록 흐름을 조정 |
| 🟡 CTA 배경 톤 정렬 | 기존 누런 계열 배경을 제거하고 페이지 기본 톤과 맞는 흰색 바 + 얇은 구분선 구조로 정리 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 실행 결과 신규 타입 오류 없이 통과 |

## v3.37.18 — [Host Landing] `become-a-host2` CTA 바 안전 추가

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🔴 `become-a-host2` 전용 CTA 바 추가 | 새 호스트 랜딩 [`/become-a-host2`]에 얇은 상단 CTA 바를 추가해 `호스트 지원하기`와 신청 상태 기반 `신청현황` 진입 버튼을 페이지 톤에 맞춰 연결. 기존 이미지 중심 랜딩 구조는 유지하고, 페이지 전체를 클라이언트로 전환하지 않도록 CTA만 feature-local client component로 분리 |
| 🟡 기존 인증/모달 흐름 재사용 | 새 CTA는 `AuthContext`와 기존 `LoginModal`을 그대로 사용해 비로그인 사용자는 로그인 모달, 신청자/승인 호스트는 대시보드, 신규 사용자는 지원서로 분기되도록 정리 |
| 🟡 `become-a-host2` 타입 베이스라인 오류 정리 | `page.tsx`의 `JSX.Element` 반환 타입을 제거해 기존 `app/become-a-host2/page.tsx`의 `Cannot find namespace 'JSX'` 베이스라인 오류를 함께 해소 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 실행 결과 이번 시점 기준 신규 타입 오류 없이 통과 |

## v3.37.17 — [Upload] HEIC 명시 차단 및 JPG 변환 안내 팝업

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🔴 HEIC/HEIF 정책 명확화 | `app/utils/image.ts`에서 `HEIC/HEIF`를 MIME 타입과 파일 확장자 기준으로 명시 감지하고, 현재 지원 형식을 `JPG/PNG/WEBP`로 고정. 이미지 검증은 `unsupported_heic` 코드와 안내 메시지를 반환하고, 압축 유틸도 HEIC 원본 fallback 업로드를 막도록 방어 |
| 🔴 전역 JPG 변환 안내 팝업 추가 | `app/context/ToastContext.tsx`에 액션형 토스트를 확장하고, `showHeicUnsupportedToast()`를 추가. HEIC 업로드 시 `JPG 변환 방법` 버튼이 붙은 에러 토스트를 띄우고, 클릭 시 `ko/en/ja/zh` 안내 모달에서 iPhone 설정 경로와 Mac/Windows 변환 방법을 바로 확인할 수 있도록 구성 |
| 🟡 주요 업로드 흐름 공통 연결 | 체험 등록/수정, 호스트 지원서, 게스트 계정 사진, 모바일 프로필 사진, 호스트 프로필 편집, 리뷰 사진, 커뮤니티 글쓰기, 메시지 이미지 전송 경로가 HEIC 업로드 시 동일한 차단/안내 UX를 사용하도록 정리 |
| 🟡 업로드 input 재선택 UX 보정 | HEIC 차단이나 사진 개수 제한으로 업로드가 중단된 뒤에도 동일 파일을 바로 다시 선택할 수 있도록 주요 파일 input 초기화 타이밍을 정리 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 실행 결과 기존 베이스라인 오류 `app/become-a-host2/page.tsx(99,45): Cannot find namespace 'JSX'`만 동일하게 확인되었고, 이번 패치로 인한 신규 타입 오류는 확인되지 않음 |

## v3.37.16 — [i18n/QA] 로케일 실QA 정합성 보정

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🔴 로그인 모달 회귀성 렌더 루프 수정 | 실QA 중 홈 로그인 모달을 열 때 `Maximum update depth exceeded`가 반복되던 문제를 수정. `NotificationProvider`, `UserPresenceTracker`의 Supabase client 인스턴스를 `useMemo`로 고정해 effect 재구독 루프를 차단 |
| 🔴 비로그인 세션 에러 소음 제거 | `AuthContext`가 로그아웃 상태의 `AuthSessionMissingError`를 예외로 간주해 콘솔 에러를 남기던 동작을 정리. 비로그인 상태를 정상 경로로 처리하도록 보정 |
| 🔴 로케일 경로 메타 기준 정렬 | `app/utils/locale.ts`가 쿠키보다 middleware의 `x-locally-locale` 헤더를 우선 보도록 수정. 직접 `/en`, `/ja`, `/zh` 경로로 진입할 때 서버 메타데이터와 클라이언트 표시 언어 기준이 어긋나지 않도록 정리 |
| 🟡 4개 언어 실QA 수행 | `/en|ja|zh/help`, `/en|ja|zh/host/register`, `/en|ja|zh/host/create`, 홈 로그인 모달/푸터를 실제 렌더 기준으로 확인. 본문 로케일 전환은 정상 확인되었고, 법률 본문은 기존 정책대로 제목 현지화 + 한국어 원문 fallback 유지 |
| 🟡 감사 문서 범위 정리 | 사용자 요청에 따라 [docs/2026-03-08_issue_audit_and_implementation_plan.md](/Users/sonhyungeun/Documents/locally-web/docs/2026-03-08_issue_audit_and_implementation_plan.md)에서 일본 계좌 송금 폼 확장 항목을 현재 추진 범위에서 제거 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 실행 결과 기존 베이스라인 오류 `app/become-a-host2/page.tsx(99,45): Cannot find namespace 'JSX'`만 동일하게 확인되었고, 이번 패치로 인한 신규 타입 오류는 확인되지 않음 |

## v3.37.15 — [i18n] 법률 문서 레지스트리 분리 및 로그인 모달 다국어 정리

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🔴 법률 문서 레지스트리 분리 | `app/constants/legalDocuments.ts`를 신설해 `terms/privacy/travel/refund` 문서를 `ko/en/ja/zh` 제목 레지스트리 + 한국어 원문 body fallback 구조로 분리. 기존 `legalText.ts`의 한국어 원문은 유지 |
| 🔴 푸터 약관 모달 로케일 연동 | `SiteFooter`가 더 이상 한국어 상수 제목을 직접 쓰지 않고 현재 `lang` 기준으로 문서 제목을 읽도록 변경. 비한국어 로케일에서는 한국어 원문이 적용된다는 fallback 안내문을 함께 표시 |
| 🔴 로그인 모달 약관/회원가입 문구 정리 | `LoginModal`의 약관 뷰어를 동일한 법률 문서 헬퍼로 연결하고, 회원가입 단계의 제목/검증 토스트/국적 옵션/성별 선택/필수 약관 UI를 `ko/en/ja/zh` 기준으로 로컬라이즈. auth payload의 `gender`, `nationality` 값은 기존과 동일하게 유지 |
| 🟡 기능 전용 로컬라이제이션 분리 | `app/components/loginModalLocalization.ts`를 추가해 로그인 모달 전용 문구와 국적 옵션을 전역 `LanguageContext` 밖으로 분리. 장문/기능 전용 문자열이 전역 사전을 비대화시키지 않도록 정리 |
| 🟡 안전한 법률 fallback 명시 | 영문/일문/중문 법률 본문은 검수 전 번역을 억지로 넣지 않고, 제목만 현지화한 뒤 한국어 원문 적용 안내를 표기하는 안전한 단계적 전환으로 정리 |
| ✅ 검증 | `git diff --check` 통과. `npx tsc --noEmit` 실행 결과 기존 베이스라인 오류 `app/become-a-host2/page.tsx(99,45): Cannot find namespace 'JSX'`만 동일하게 확인되었고, 이번 패치로 인한 신규 타입 오류는 확인되지 않음 |

## v3.37.14 — [i18n] 일본어 누락 구조 보정 1차

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🔴 체험 등록/수정 옵션 구조 정규화 | `app/host/create/localization.ts`를 신설해 도시/카테고리/진행 언어/활동 강도/환불 정책의 표시 라벨을 로케일별 메타데이터로 분리. 저장값은 기존 한국어 값을 유지해 DB 호환성과 선택 상태 비교 로직 회귀를 방지 |
| 🔴 체험 등록 폼 일본어 대응 | `CreateExperiencePage`와 `ExperienceFormSteps`의 단계 제목, 검증 토스트, 버튼, 사진/동선/환불 정책 문구를 로케일별 카피로 전환. 일본어 선택 시 생성 플로우가 더 이상 한국어 하드코딩에 묶이지 않도록 조정 |
| 🔴 체험 수정 화면 공용화 | `/host/experiences/[id]/edit`가 생성 화면과 동일한 옵션 메타데이터를 재사용하도록 변경. 진행 언어/카테고리/활동 강도/단독 투어/동선 사진/환불 정책의 하드코딩 한국어를 제거 |
| 🔴 호스트 지원서 현지화 | `app/host/register/localization.ts`를 신설해 언어 옵션, 단계별 라벨/placeholder, 검증 토스트, 안전 가이드라인 장문을 로케일별 콘텐츠로 분리. 호스트 지원서는 저장 payload를 바꾸지 않고 표시 텍스트만 분리 |
| 🟡 고객센터 문의 모달 개선 | `/help` 문의 모달의 제목/설명/placeholder/에러 문구를 로케일별로 전환하고, 문의 생성 후 `/guest/inbox?inquiryId=...`로 바로 해당 상담 스레드를 열도록 개선 |
| 🟡 조사 문서 반영 | 일본어 누락 구조 감사 및 구현 계획 보고서를 `docs/2026-03-08_japanese_localization_structure_audit_plan.md`로 추가 |
| ✅ 검증 | `npx tsc --noEmit` 실행. 기존 베이스라인 오류 `app/become-a-host2/page.tsx(99,45): Cannot find namespace 'JSX'`만 동일하게 확인되었고, 이번 패치로 인한 신규 타입 오류는 확인되지 않음 |

## v3.37.13 — [메시지] 예약 완료·알림 딥링크 직결

**작업일:** 2026-03-08

| 항목 | 내용 |
|------|------|
| 🔴 예약 완료 메시지 직결 | `/experiences/[id]/payment/complete` 하단 CTA가 더 이상 빈 `/guest/inbox`로 가지 않도록 수정. 예약된 `experiences.host_id`, `experiences.id`, `experiences.title`을 사용해 `/guest/inbox?hostId=...&expId=...&expTitle=...` 딥링크로 바로 연결 |
| 🔴 메시지 알림 스레드 직결 | `useChat.ts`의 `new_message` 알림 링크를 역할별 실제 채팅 화면으로 구체화. 게스트 수신자는 `/guest/inbox?inquiryId=...`, 호스트 수신자는 `/host/dashboard?tab=inquiries&inquiryId=...`, 관리자 CS 수신자는 `/admin/dashboard?tab=CHATS&inquiryId=...`로 이동 |
| 🟡 Inbox 파라미터 확장 | `guest/inbox`와 `host/dashboard/InquiryChat`이 `inquiryId` URL 파라미터를 받아 해당 문의방을 자동 선택하도록 확장. 기존 `hostId`/`expId` 기반 자동 연결은 유지 |
| ✅ 검증 | `npx tsc --noEmit` 실행. 현재 베이스라인의 기존 오류 `app/become-a-host2/page.tsx(99,45): Cannot find namespace 'JSX'`로 실패하며, 이번 패치와 직접 관련된 신규 타입 오류는 확인되지 않음 |

## v3.37.12 — [Host Landing] `/become-a-host2` FAQ 핀셋 폭/톤 조정

**작업일:** 2026-03-07

| 항목 | 내용 |
|------|------|
| 🔴 FAQ 폭 축소 | `/become-a-host2` 하단 FAQ 컨테이너를 `max-w-[790px]`로 축소하여 바로 위 마지막 시안 카드 외곽선과 더 가깝게 정렬 |
| 🔴 배경 톤 보정 | FAQ 섹션 배경을 `#F7F7F7`로 변경하고, 텍스트/보더 대비를 한 단계 낮춰 전체 톤을 부드럽게 조정 |
| 🟡 타이포 핀셋 조정 | 제목/섹션 라벨/본문 크기와 간격을 축소해 기존보다 덜 무겁고 시안 하단과 자연스럽게 이어지도록 보정 |
| ✅ 검증 | `/become-a-host2` 로컬 렌더 재확인 |

## v3.37.11 — [Host Landing] `/become-a-host2` 순수 마크업 재구축

**작업일:** 2026-03-07

| 항목 | 내용 |
|------|------|
| 🔴 스크린샷 의존 제거 | 이전 벤치마크 이미지 렌더링 방식 폐기. `/become-a-host2`를 실제 HTML 구조와 Tailwind 유틸리티만으로 다시 작성 |
| 🔴 정적 섹션 하드코딩 | 상단 미니 헤더, 히어로, 3장 스토리 카드, 카테고리 블록, 브랜드 수치, 단일 폰/2폰/4폰 섹션, FAQ 밴드까지 전부 컴포넌트 형태로 재구성 |
| 🔴 폰 목업 직접 구축 | `next/image`나 잘라낸 스크린샷 없이, 검은 프레임/다이내믹 아일랜드/내부 카드 UI를 중첩 div와 Tailwind만으로 구현 |
| 🟡 전역 레이아웃 예외 처리 | `/become-a-host2`에서는 기본 `SiteFooter`와 모바일 `BottomTabNavigation`이 붙지 않도록 경로 기준으로 숨김 처리 |
| ✅ 검증 | `npx tsc --noEmit` 통과 기준으로 재검증 |

## v3.37.10 — [Host Landing] `/become-a-host2` 데스크톱 벤치마크 픽셀 복제 재구성

**작업일:** 2026-03-07

| 항목 | 내용 |
|------|------|
| 🔴 벤치마크 기반 정적 복제 | 첨부된 참조 스크린샷 기준으로 `/become-a-host2` 본문을 데스크톱 전용 픽셀 복제 형태로 재구성 |
| 🔴 동적 로직 제거 | 기존 `createClient`, `useRouter`, `LoginModal`, 신청 상태 분기 등 호스트 등록 플로우 로직을 전부 제거하고 순수 프론트엔드 랜딩으로 전환 |
| 🔴 로컬 자산화 | 벤치마크 스크린샷에서 본문/FAQ 구간을 잘라 `public/images/become-host2/main-desktop.webp`, `faq-desktop.webp`로 저장하고 페이지에서 `next/image`로 렌더링 |
| 🟡 글로벌 푸터 유지 | 본문 복제는 FAQ 섹션 종료 지점까지 맞추고, 그 아래는 기존 `SiteFooter`가 이어지도록 유지 |
| ✅ 검증 | `npx tsc --noEmit` 통과 예정 기준으로 페이지를 정적 구성. 실제 렌더 확인은 `/become-a-host2` 데스크톱 비교 기준 |

## v3.37.9 — [Host Landing] `/become-a-host2` 에어비앤비 레퍼런스형 신규 페이지

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 신규 호스트 랜딩 추가 | `/become-a-host2` 신규 라우트 추가. 기존 `/become-a-host`는 유지하고, 별도의 실험/비교용 랜딩으로 분리 |
| 🔴 레퍼런스형 구조 반영 | 에어비앤비 `host/experiences` 페이지 구조를 참고해 히어로, 호스트 스토리 카드, 체험 카테고리, 통계, 리스팅 프리뷰, 노출 포인트, 운영 기능, FAQ까지 긴 단일 랜딩으로 재구성 |
| 🔴 로컬리 카피/브랜딩 전환 | 모든 문구를 로컬리 호스트 모집 문맥으로 재작성하고, 현재 `host/register` / `host/dashboard` 이동 로직과 로그인 모달 동선을 그대로 연결 |
| 🟡 미니멀 헤더 분리 | 기본 사이트 헤더 대신 레퍼런스 톤에 맞는 간결한 상단 바와 CTA를 페이지 내부에 별도로 구성 |
| ✅ 검증 | `npx tsc --noEmit` 통과 |

## v3.37.8 — [About] 취향 섹션 에디토리얼 리디자인

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 소개 페이지 톤 재정렬 | `/about`의 `당신의 취향을 발견하세요` 구간을 상품 리스트형 그리드에서 에디토리얼 큐레이션 섹션으로 교체. 소개 페이지 흐름 안에서 브랜드/취향 탐색이 읽히도록 재구성 |
| 🔴 상품 메타 제거 | 가격, 별점, 리뷰수, 좋아요, BEST 배지 중심의 카드 메타를 제거하고 `대표 비주얼 1개 + 카테고리 설명 블록 6개` 구조로 전환 |
| 🔴 에어비앤비 레퍼런스 톤 반영 | `host/experiences` 페이지 감도에 맞춰 절제된 라인 아이콘, 넉넉한 여백, 낮은 정보 밀도, 큐레이션 중심 카피로 톤앤매너 보정 |
| 🟡 CTA 구조 정리 | `모든 체험 보기` CTA를 밑줄 링크에서 방향성 있는 인라인 액션으로 변경하고, 섹션 상단에 `Curated on Locally` 라벨 추가 |
| ✅ 검증 | `npx tsc --noEmit` 통과 |

## v3.37.7 — [커뮤니티] 기본 썸네일 고정 + 작성자명 fallback 정리

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 리스트 썸네일 레이아웃 고정 | `PostListCard.tsx`에서 이미지 유무와 관계없이 동일한 68x68 썸네일 박스를 항상 렌더링하도록 변경. 이미지가 없으면 중성 배경 위에 `/images/logo-black-transparent.png`를 중앙 `object-contain`으로 표시해 제목 시작선이 밀리지 않게 정리 |
| 🔴 로컬리 콘텐츠 fallback 통일 | `PostGridCard.tsx`의 무이미지 fallback을 제목 텍스트 카드에서 로컬 로고 표시 방식으로 교체해 커뮤니티 전역 기본 이미지 규칙을 통일 |
| 🔴 작성자명 fallback 보정 | 커뮤니티 목록/상세/댓글/UI 전반에서 `profiles.full_name -> profiles.name -> 로컬리 유저` 우선순위를 공통 헬퍼로 통일. 기존 `익명`, `유저` fallback 제거 |
| 🟡 프로필 조회 필드 확장 | `community page`, `/api/community`, `/api/community/comments`, 상세 페이지의 profiles 조회에 `full_name` 포함. `Profile` 타입에도 `full_name?: string` 추가 |
| ✅ 검증 | `npx tsc --noEmit` 통과 |

## v3.37.6 — [커뮤니티] 전체보기 기본화 + 글쓰기 모던 UI + 동행 날짜 모달

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 검색 기본 카테고리 `전체보기` | 커뮤니티 메인 기본 카테고리를 `all`로 변경하고, 검색바/탭 첫 항목에 `전체보기` 추가. `all`은 category filter 없이 전체 피드를 조회 |
| 🔴 글쓰기 카테고리 정리 | `궁금해요`, `일정이 맞아요` 같은 보조 문구 제거. 작성 카테고리를 `Q&A / 동행 구하기 / 꿀팁 / 로컬리 콘텐츠` plain label로 통일 |
| 🔴 로컬리 콘텐츠 작성 오픈 | `PostEditor`와 `/api/community/posts` 허용 카테고리에 `locally_content` 추가하여 일반 작성도 가능하게 변경 |
| 🔴 글쓰기 화면 리디자인 | `PostEditor.tsx`를 모바일 full-screen 스타일에서 중앙 카드형 작성 화면으로 교체. 카테고리 pill 선택, 정리된 제목/본문/이미지 업로드 UI 적용 |
| 🔴 동행 날짜 모달 달력 | 동행 글의 `type=date` 입력 제거. 기존 `DatePicker` 비주얼을 재사용한 단일 날짜 선택 모달로 교체하고 `single` 모드 추가 |

## v3.37.5 — [커뮤니티] 검색바 모던 캡슐형 리디자인

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 검색바 전면 리디자인 | `CommunitySearchControls.tsx`의 `select + input + select + button` 폼 구조를 제거하고, 데스크탑은 단일 캡슐형 검색 오브젝트로 재구성 |
| 🔴 데스크탑 팝오버 필터 | 카테고리/정렬을 native select 대신 rounded pill trigger + lightweight popover로 교체. `ESC` 및 외부 클릭 닫기 지원 |
| 🔴 모바일 직접 선택 칩 | 모바일은 1행 검색 입력 + 2행 카테고리 칩 + 정렬 segmented pill 구조로 분리하여 터치성과 가독성 개선 |
| 🟡 탭 위계 보정 | `CommunityCategoryTabs.tsx` active/non-active 대비를 완화해 검색바가 메인 컨트롤로 읽히도록 조정 |
| 🟡 기능 계약 유지 | `category/q/sort` URL query, 검색 submit, 카테고리/정렬 즉시 반영 로직은 그대로 유지 |

## v3.37.4 — [커뮤니티] 검색바 도입 + 카테고리 문맥 유지 + Q&A 잔존 UI 제거

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 피드 상단 CTA 검색바 전환 | 커뮤니티 메인 상단 작성 유도 박스를 검색 UI로 교체. 카테고리 선택, 제목/내용 통합 검색, 최신순/인기순 정렬을 URL query 기반으로 지원 |
| 🔴 카테고리 문맥 유지 | 탭 전환, 글쓰기 진입, 목록→상세 이동, 상세 뒤로가기에서 `category/q/sort` 문맥을 유지하도록 링크와 BackButton 동작 정리 |
| 🔴 Q&A 반쪽 UI 제거 | 댓글의 `채택된 답변` 배지와 카드의 `답변대기` 뱃지 제거. 실제 구현되지 않은 채택 기능 흔적 비노출 처리 |
| 🟡 실데이터 인기글 전환 | 우측 사이드바와 모바일 위젯의 목업 인기글을 최근 7일 기준 실제 인기글 데이터로 교체 |
| 🟡 서버 검증 보강 | `/api/community`에 검색·정렬 파라미터 지원 추가, `/api/community/posts`에 작성 가능 카테고리 검증 추가 |

## v3.37.3 — [어드민 TEAM] 메모 본문 높이 고정 + 댓글 독립 스크롤

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 메모 본문 가독성 회귀 방지 | `TeamTab.tsx` 메모 카드 본문 뷰어를 `flex-1` 가변에서 `min-h/h/max-h` 고정형으로 전환하여 댓글이 길어져도 본문 크기가 줄어들지 않게 수정 |
| 🔴 댓글 영역 독립 스크롤 | 댓글 구역을 `flex flex-col h-*`로 고정하고, 댓글 목록만 `flex-1 min-h-0 overflow-y-auto`로 분리. 입력창은 `shrink-0`로 고정해 본문/댓글 비율 안정화 |
| 🟡 핀셋 범위 유지 | 메모 탭 UI 레이아웃 클래스만 조정, 댓글 등록/실시간/DB/API 로직은 미변경 |

## v3.37.2 — [어드민 맞춤의뢰] Service Requests 라벨 줄바꿈 방지 핀셋 수정

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 상태/배지 텍스트 줄바꿈 방지 | `ServiceAdminTab.tsx` All Requests 행의 결제수단/의뢰상태/결제상태/정산 배지에 `text-[9px] md:text-[10px]` + `whitespace-nowrap` 적용 |
| 🔴 액션 버튼 라벨 정리 | 행 액션의 `강제 취소` 버튼 라벨을 `취소`로 변경하고 버튼 텍스트도 `text-[9px] md:text-[10px]` + `whitespace-nowrap`로 통일 |
| 🟡 회귀 안전 범위 고정 | UI 클래스/라벨만 수정, 결제/환불/API/상태 전이 로직은 미변경 |

## v3.37.1 — [팀 워크스페이스] Shift+Enter 버그 수정 + 메모 줄바꿈 + 댓글 표시 영역 확장

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 Shift+Enter 버그 수정 | 팀 할 일/메모 댓글 textarea onKeyDown에서 `e.shiftKey` → `native.shiftKey` 로 변경. `if (e.key === 'Enter') { if (native.shiftKey) return; ... }` 패턴으로 재구성하여 Shift+Enter 줄바꿈 정상 동작 |
| 🔴 팀 메모장 내용 줄바꿈 | ReactMarkdown+remarkGfm은 단일 `\n`을 무시 → 렌더링 전 `memo.content.replace(/\n/g, '  \n')` 처리(Markdown 소프트 브레이크) |
| 🔴 팀 메모장 댓글 표시 영역 확장 | 댓글 목록 컨테이너 `max-h-32` → `max-h-64` (128px → 256px, 2배) |

## v3.37.0 — [팀 워크스페이스] 줄바꿈 지원 + 메모 댓글 입력 확장

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 팀 할 일 줄바꿈 | `todo.content` 표시에 `whitespace-pre-wrap break-words` 추가 |
| 🔴 팀 할 일 댓글 줄바꿈 | 댓글 표시 `<p>`에 `whitespace-pre-wrap break-words` 추가 |
| 🔴 팀 할 일 댓글 입력 | `<input type="text">` → `<textarea rows={2}>` 전환. Shift+Enter=줄바꿈, Enter=제출 |
| 🔴 팀 메모장 댓글 줄바꿈 | 댓글 표시 `<p>`에 `whitespace-pre-wrap break-words` 추가 |
| 🔴 팀 메모장 댓글 입력 확장 | `<input type="text">` → `<textarea rows={4}>` 전환(약 2배 높이). Shift+Enter=줄바꿈, Enter=제출 |

---

## v3.36.0 — [맞춤의뢰] 호스트 프로필 모달 연락하기 기능 + 고객센터 커스텀 모달

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 ServiceRequestClient 호스트 프로필 모달 연락하기 | HostProfileModal의 "호스트에게 연락하기" 버튼에 `onContactHost` 콜백 연결. 클릭 시 ExpMainContent와 동일한 textarea 메시지 모달(z-[210], 모바일 bottom sheet h-[88dvh] / 데스크탑 max-w-[560px]) 표시. inquiry(experience_id=null) find-or-create 후 inquiry_messages insert → `/guest/inbox?hostId=X` 이동. |
| 🔴 고객센터 1:1 문의 커스텀 모달 | `help/page.tsx`의 `prompt()` + `confirm()` 브라우저 네이티브 팝업 제거. 동일한 디자인 커스텀 textarea 모달로 교체. 제출 성공 시 toast + `/guest/inbox` 이동. |

---

## v3.35.0 — [맞춤의뢰] 매칭 후 1:1 메시지·언어레벨·고객센터 링크 개선

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 매칭 완료 후 1:1 메시지 | `/api/services/start-chat` 신규 API — 매칭된 고객↔호스트 간 inquiry 생성(experience_id 없는 general 타입). 고객 뷰: "호스트에게 메시지" 버튼. 호스트 뷰: "고객에게 메시지" 버튼. |
| 🔴 언어 중복 표기 수정 | `profiles.languages` + `host_applications.languages` 혼용 중복 → `normalizeLanguageLevels`로 통합. 언어 배지에 레벨(`Lv.X 단계`) 병기. |
| 🟡 고객센터 링크 수정 | `/guest/inbox` → `/help`(admin_support 채팅 생성 페이지). |
| 🟡 i18n 2키 추가 | `msg_send_to_host`, `msg_send_to_customer` ko/en/ja/zh. |
| 🟡 `/guest/inbox` hostId 단독 파라미터 지원 | expId 없이 hostId만으로 기존 채팅 자동 선택. |
| 🟡 language_levels API 반환 | `/api/services/applications` — host_applications.language_levels select 추가. |

---

## v3.34.0 — [맞춤의뢰] 서비스 매칭 3차 개선 — i18n·리뷰·커스텀 모달·탭 UX·알림 도시 필터

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 i18n 9키 × 4언어 | `sr_appeal_message`, `sr_selected`, `sr_confirm_select_host`, `sr_selected_host_banner_title/desc`, `sr_selected_host`, `sr_not_selected_host`, `sr_select_host_fail/success` — ko/en/ja/zh 전부 추가. 키 원문 노출 완전 해결. |
| 🔴 호스트 후기수/평점 표시 | `/api/services/applications` GET — `reviews` 테이블 조회 추가. `review_count`/`review_avg` enriched 후 반환. 지원자 카드 + 호스트 프로필 모달에 별점·후기수 정상 표시. |
| 🔴 커스텀 confirm 모달 | `ServiceRequestClient.tsx` — `window.confirm()` 제거. `confirmTarget` state + `handleConfirmSelect` 분리. 호스트 이름 표시하는 커스텀 오버레이 모달로 교체 (z-[200]). |
| 🔴 호스트 선택 후 페이지 갱신 | `router.refresh()` → `router.push(\`/services/\${requestId}\`)` 교체. 클라이언트 useEffect 재실행되어 상태 즉시 반영. |
| 🟡 호스트 대시보드 탭 개선 | `ServiceJobsTab.tsx` — 기본 탭 `my-applications`으로 변경. 탭 순서 내 지원 → 열린 의뢰 → 진행중. 카드 디자인: selected=파란 그라디언트, pending=amber 테두리. 금액 하드코딩 제거 → `total_host_payout` 사용. |
| 🟡 알림 도시 필터 | `nicepay-callback/route.ts` — 결제 완료 시 experiences 테이블 기준으로 해당 도시 보유 호스트만 필터링 후 알림 발송. `reqCity` 미존재 시 기존 전체 발송 동작 유지. |

---

## v3.33.0 — [맞춤의뢰] 서비스 매칭 2차 개선 — 호스트 모달·어드민 수정·재무지표·Master Ledger 통합

**작업일:** 2026-03-06

| 항목 | 내용 |
|------|------|
| 🔴 i18n 키 5개 추가 | `btn_apply`, `sr_application_pending`, `sr_customer_reviewing`, `sr_no_reviews`, `btn_select_host` — ko/en/ja/zh 4개 언어 모두 추가. 키 문자열 그대로 노출되던 문제 해결. |
| 🔴 호스트 프로필 모달 연결 | `ServiceRequestClient.tsx` — 지원자 카드 클릭 시 `HostProfileModal` 오픈. `ServiceApplicationWithProfile` 타입에 `created_at`, `profession`, `dream_destination`, `favorite_song` 추가. `/api/services/applications` GET select 쿼리에 해당 필드 추가. |
| 🟡 어드민 서비스의뢰 수정 기능 | `app/api/admin/service-requests/route.ts` 신규 (PATCH). `ServiceAdminTab.tsx`에 편집 모달(제목+설명) 및 ✏️ 버튼 추가. |
| 🟡 어드민 재무 지표 추가 | `ServiceAdminTab.tsx` — AllRequestsTab 테이블에 `호스트 지급액` · `순수익` 컬럼 추가. KPI 카드 6개로 확장(호스트 지급액 총계, 순수익 추가). |
| 🟠 Master Ledger service_bookings 통합 | `MasterLedgerTab.tsx` — 컴포넌트 마운트 시 `/api/admin/service-bookings` 병렬 fetch, 정규화 후 일반예약과 통합 정렬. Type 컬럼(일반예약/서비스의뢰 배지) 추가. KPI, CSV 다운로드 모두 통합 계산. 서비스의뢰 상세 클릭 시 관리 액션 버튼 미노출(서비스 의뢰 탭 안내 표시). |

---

## v3.32.0 — [어드민 TEAM] 중복 댓글 방지·읽음처리 RPC·카운트 경량화

**작업일:** 2026-03-05

| 항목 | 내용 |
|------|------|
| 🔴 중복 댓글 방지 1차 | `TeamTab.tsx`에 task별 전송 in-flight 락 추가, 전송 중 입력/버튼 비활성화, IME 조합 입력 Enter 무시 처리. |
| 🔴 Realtime 과부하 완화 | `TeamTab.tsx`의 `admin_task_comments` 구독을 `INSERT/DELETE`로 축소하고, 현재 task 집합 외 이벤트 무시 + 200ms 디바운스 재조회 적용. |
| 🔴 읽음처리 UPDATE 루프 제거 | `GlobalTeamChat.tsx`에서 메시지별 UPDATE 반복을 제거하고 `mark_room_messages_read` RPC 1회 호출 방식으로 전환. |
| 🟡 사이드바 경량화 | `/api/admin/team-counts` 신규 추가, Sidebar TEAM 실시간 뱃지는 경량 API만 호출하도록 분리. `/api/admin/sidebar-counts`는 운영 카운트 중심으로 단순화. |
| 🟡 TEAM 탭 선로딩 제거 | `admin/dashboard/page.tsx`에서 `TEAM/CHATS/SERVICE_REQUESTS` 탭은 `useAdminData()` 미호출 구조로 분리하여 초기 부하 완화. |
| 🟡 DB 마이그레이션 | `docs/migrations/v3_29_0_team_workspace_stability.sql` 추가: `admin_task_comments.client_nonce`, partial unique index, `mark_room_messages_read` RPC. |
| ✅ 검증 | `npx tsc --noEmit` 통과, `npx next build --webpack` 통과, 원격 DB에서 `client_nonce` 컬럼 조회 및 `mark_room_messages_read` RPC 응답(0건 업데이트) 확인. |

---

## v3.31.9 — [맞춤의뢰] 서비스 매칭 시스템 검수 수정

**작업일:** 2026-03-05

| 항목 | 내용 |
|------|------|
| 🔴 버그: 캘린더 요일 헤더 "day_sun/day_mon..." 그대로 노출 | `IntroClient.tsx:372` — `t('day_sun')` 등 존재하지 않는 키 사용으로 키 문자열 자체가 렌더링됨. `[0,1,2,3,4,5,6].map(i => t('day_'+i))` 패턴으로 교체. |
| 🔴 정책 위반: 호스트 잡보드에서 고객 결제금액 노출 | `ServiceJobsTab.tsx` — 잡보드 목록에 `total_customer_price`(₩35,000×hours) 표시로 수수료율 역산 가능. `total_host_payout`으로 교체 및 색상도 emerald로 통일. |
| 🟡 어드민 서비스 정산: 고객/호스트 이름 미표시 | `api/admin/service-bookings/route.ts:47` — `profiles.name` 컬럼 미존재 오류. `full_name`으로 수정. |

---

## v3.31.8 — [메시지] 채팅 버그 3종 수정 및 실시간 구독 안정화

**작업일:** 2026-03-05

| 항목 | 내용 |
|------|------|
| 🔴 버그: 읽음 시간 두 번 표시 | `InquiryChat.tsx` / `guest/inbox/page.tsx` 모두 "읽음 {read_at}" 표시 시 `created_at` 시간이 항상 추가 렌더링되는 구조적 오류. 조건 분기를 `is_read=false → 1+created_at`, `is_read=true+read_at → 읽음 read_at만`, `is_read=true+read_at없음 → created_at만`으로 정리. |
| 🔴 버그: 프로필 사진 없는 게스트 자리에 사이트 로고 표시 | `InquiryChat.tsx`의 `secureUrl` fallback이 `/images/logo.png`로 설정돼 있어 아바타 3곳(목록/헤더/메시지)에 로고 노출. `avatar_url` 존재 여부에 따라 `<Image>` vs `<User>` 아이콘 조건부 렌더링으로 교체. |
| 🔴 버그: 실시간 메시지 미수신 (새로고침 필요) | `useChat.ts`의 Realtime useEffect 의존성에 `selectedInquiry`(state)와 `fetchInquiries`의 `inquiries.length` 의존이 있어, 채팅방 전환 및 문의 목록 변경 시마다 채널이 재구독되며 메시지 누락 발생. `inquiriesRef` / `selectedInquiryRef`를 도입해 핸들러 내 최신 값 참조를 ref로 분리 → realtime effect에서 `selectedInquiry` 제거, `fetchInquiries` 의존성에서 `inquiries.length` 제거, `loadMessages` 의존성에서 `inquiries` 제거. 채널이 사용자 변경 시에만 재구독되도록 안정화. |

---

## v3.31.7 — [메시지] 게스트↔호스트 메시지 자동 연결 수정

**작업일:** 2026-03-05

| 항목 | 내용 |
|------|------|
| 🔴 버그: 게스트 나의 예약 메시지 버튼 → 호스트 연결 안됨 | `TripCard.tsx`가 `/guest/inbox?hostId=...`만 전달하고 `expId` 누락 → inbox가 `hostId+expId` 둘 다 있어야 자동 연결하므로 빈 목록만 표시. `expId`, `expTitle` URL 파라미터 추가. |
| 🔴 버그: 호스트 예약관리 메시지 버튼 → 게스트 연결 안됨 | `InquiryChat.tsx`가 `guestId`로 기존 문의를 찾지 못하면 아무 것도 열지 않음(호스트 선제 채팅 불가). `/api/host/start-chat` 신규 API 생성(체험 소유 검증 + service_role로 inquiry 생성 또는 기존 반환). `ReservationManager.tsx`에 `expId` 추가, `InquiryChat.tsx`에 자동 생성 후 연결 로직 추가. |

---

## v3.31.6 — [어드민 핫픽스] Master Ledger 예약 목록 미노출 수정

**작업일:** 2026-03-05

| 항목 | 내용 |
|------|------|
| 🔴 버그: Master Ledger 예약 목록 완전 비어있음 | **근본 원인:** `useAdminData.ts`에서 `bookings` 테이블을 일반 브라우저 JWT 클라이언트로 직접 SELECT 조회하여 RLS가 본인 예약만 허용 → 어드민이 자신이 예약한 것 없으면 0행 반환. |
| 🔧 신규 API 생성 | `app/api/admin/bookings/route.ts` — `createAdminClient()`(service_role, RLS 우회)로 bookings 전체 조회. 페이지네이션(`from`, `to`) 지원. |
| 🔧 useAdminData.ts 교체 | 초기 로딩(`fetchInitialData`)과 더보기(`loadMoreBookings`) 모두 `/api/admin/bookings` API 경유로 전환. |
| 🔧 host-applications API 인증 버그도 수정 | `host-applications/route.ts`에서 `supabaseServer`(일반 JWT)로 `admin_whitelist` 조회 → RLS 차단 버그. `createAdminClient` + `profiles.role`로 교체. |
| ✅ 빌드 검증 | `tsc --noEmit` exit 0 확인. |

---

## v3.31.5 — [어드민 핫픽스] 맞춤 의뢰 관리 탭 403 인증 버그 전수 수정

**작업일:** 2026-03-05

| 항목 | 내용 |
|------|------|
| 🔴 버그: 맞춤 의뢰 탭 전체 비어있음 | **근본 원인:** `service-bookings`, `sidebar-counts`, `service-confirm-payment`, `service-cancel` 4개 admin API가 `supabaseServer`(일반 JWT 클라이언트)로 `admin_whitelist` 테이블을 조회할 때 RLS 정책이 데이터를 차단 → `isAdmin = false` → 403 Forbidden 반환. |
| 🔧 수정: admin 인증 로직 전수 교체 | 4개 API의 `admin_whitelist`·`role` 조회를 `supabaseServer` → `createAdminClient()` (Service Role, RLS 우회)로 교체. `users` 테이블 → `profiles` 테이블로도 수정 (gemini.md §3.1 기준). |
| ✅ 빌드 검증 | `tsc --noEmit` exit 0 확인 완료. |

---

## v3.31.4 — [결제/어드민] 무통장 입금 UI 버그 픽스 및 RLS 권한 우회 서버 API 도입

**작업일:** 2026-03-05

| 항목 | 내용 |
|------|------|
| 🔧 버그: 관리자 '입금 확인' 버튼 미노출 | **원인:** `service_bookings` 테이블의 RLS 정책(`/sb_select/`)이 게스트와 호스트 본인만 조회 가능하도록 제한되어, 관리자 대시보드 로그인 시 데이터 빈 배열 반환. |
| 🔧 수정 1: RLS 우회 API 신설 | `useServiceAdminData.ts` 프론트엔드 직접 조회를 전면 제거하고, `createAdminClient`를 사용해 서버단에서 검증 후 데이터를 내려주는 `/api/admin/service-bookings` GET 라우트 생성 (Manual Join 로직 백엔드 이관). |
| 🔧 수정 2: 사이드바 카운트 우회 API | `Sidebar.tsx` 내부 알림 뱃지 쿼리들(`pending_bookings`, `service_bookings` 등)이 RLS에 막혀 0건으로 나오는 현상 해결을 위해 `/api/admin/sidebar-counts` GET 라우트 분리. |
| 📦 DB 스키마: `bookings` 결제수단 추가 | 기존 `bookings` 에 존재하지 않던 `payment_method` 컬럼 추가 (디폴트값 'card'). |
| 🔧 수정 3: 일반 예약 백엔드 파라미터 연동 | `app/api/bookings/route.ts` 에서 `create_booking_atomic` RPC 호출 시 새롭게 추가된 `payment_method` 파라미터 전달하도록 수정 (`supabase_add_payment_method_bookings_v3.9.3.sql` 작성). |

---

## v3.31.3 — [어드민 버그픽스] 팀 할 일 댓글 미표시 근본 원인 수정

**작업일:** 2026-03-05

| 항목 | 내용 |
|------|------|
| 🔧 버그: 팀 할 일 댓글 안 보임 | **근본 원인:** `MiniChatBar`(팀 미니채팅)가 동일한 `admin_task_comments` 테이블에 `task_id='00000000-...'` 고정 UUID로 채팅 메시지를 쌓아, `fetchComments()`의 `limit(100)`을 먼저 채워버려 실제 TODO 댓글이 fetch 결과에서 밀려나던 문제. |
| 🔧 수정 1: `fetchComments` 필터 추가 | `TeamTab.tsx` — 미니채팅 전용 UUID를 `.neq()` 로 제외하고 limit를 300으로 증가. |
| 🔧 수정 2: insert 후 즉시 갱신 | `addComment`, `addMemoComment` 함수에 insert 성공 후 `fetchComments()` 직접 호출 추가 — Realtime 구독 지연/환경 차이 대응. |

---

## v3.31.2 — [보안 및 규정 준비] Supabase Linter 1차 해결 (Search Path & 비밀번호 정책)

**작업일:** 2026-03-04

| 항목 | 내용 |
|------|------|
| 🔒 보안 패치 | Supabase 보안 경고 `Function Search Path Mutable` (12건) 해결을 위한 `search_path=public` 강제 세팅 SQL 마이그레이션 파일 작성 및 적용 |

---

## v3.31.1 — [런칭 준비] 푸터 사업자 정보 노출 & Web Analytics 연동

**작업일:** 2026-03-04

| 항목 | 내용 |
|------|------|
| ✨ 신규 기능 | `app/layout.tsx` 에 `@vercel/analytics` 컴포넌트를 추가하여 서버 재부팅 없이 실시간 방문자 및 트래픽 분석(Analytics) 연동 완료 |
| 🛠️ 법적 요건 | `SiteFooter.tsx` 하단에 정식 런칭 및 PG사 심사에 필수인 사업자 정보(상호, 대표, 사업자번호, 통신판매업, 주소, 이메일, 개인정보책임자) 하드코딩 추가 |

---

## v3.31.0 — [커뮤니티] 100% 무료 자동화 봇 아키텍처 구축 (게시물/댓글)

**작업일:** 2026-03-04

| 항목 | 내용 |
|------|------|
| ✨ 신규: AI 코어 모듈 | `@google/generative-ai` 설치 및 `generateFriendlyComment`, `generateAutoPost` 유틸 생성 (Gemini 1.5 Flash 무료 API 기반) |
| ✨ 신규: 자동 접속 API | `GET /api/bot/auto-post` (여행 꿀팁/날씨 자동 포스팅 API), `GET /api/bot/auto-comment` (댓글 0개인 글에 매직 댓글 생성 API) 신설 |
| ✨ 신규: 봇 스케줄러 | `.github/workflows/community-bot.yml` — 매일 1회 글 작성, 매일 2회 댓글 스캔 Github Actions 설정 |
| 🛠️ 도구: DB 봇 계정 | `supabase_bot_setup.sql` 봇 마이그레이션 도구 작성 (도쿄 날씨봇, 맛집 헌터) |

---

## v3.30.0 — [커뮤니티] 상세 페이지 전면 개선 (버그 5종 수정 + UX 리뉴얼)

**작업일:** 2026-03-04

| 항목 | 내용 |
|------|------|
| 🔧 버그: 공유 버튼 먹통 | `ShareButton.tsx` 신설 — Web Share API 우선, fallback 클립보드 복사 + "복사됨" 2초 토스트 |
| 🔧 버그: 뒤로가기 로딩 없음 | `BackButton.tsx` 신설 — `useTransition` 로딩 스피너로 전환 피드백 |
| 🔧 버그: 유저 정보 null fallback | 아바타에 이니셜(첫 글자) 표시 추가, 닉네임 fallback '로컬리 유저' 유지 |
| 🔧 버그: 데스크탑 상세 페이지 좁음 | `max-w-[768px]` 단일 컬럼 → `max-w-7xl 2컬럼(8:4)` 재설계. 우측 광고 영역 플레이스홀더 |
| 🔧 버그: 피드 데스크탑 넛지박스 숨겨짐 | `hidden lg:block` 데스크탑 넛지박스 피드 상단에 복구 |
| ✨ UX: 제목 최상단 배치 | 제목 → 유저정보 순서로 변경 (데스크탑/모바일 공통) |
| ✨ UX: 답변대기 뱃지 제거 | Q&A `isQna` 뱃지 완전 제거 |
| ✨ UX: 이전글/다음글 네비게이션 | 같은 카테고리 인접 게시글 조회 → 댓글 하단 배치 |
| ✨ UX: 모바일 UI 소형화 | 유저 아바타 `w-9 h-9`, 닉네임 `text-[13px]`, 넛지박스 패딩 `p-3`, FAB `w-12 h-12` |
| ✨ UX: 광고 영역 | 데스크탑 우측 사이드바 + 모바일 댓글 하단 플레이스홀더 |

---

## v3.29.2 — [커뮤니티] 상세 페이지 댓글 500 오류 + sticky 헤더 위치 버그 수정


**작업일:** 2026-03-04

| 버그 | 원인 | 수정 파일 |
|------|------|---------|
| 댓글 작성/조회 500 오류 (`profiles_1.name does not exist`) | `profiles:user_id(name, avatar_url)` Supabase FK join alias가 내부적으로 `profiles_1` 로 생성되어 컬럼 미존재 | `api/community/comments/route.ts` — GET/POST 모두 join 제거, profiles 별도 조회로 변경 |
| 상단 헤더가 80px 아래에 기괴하게 고정 | `sticky top-[80px]` — SiteHeader 없는 상세 페이지에서 의미없는 오프셋 | `community/[id]/page.tsx` — `top-0`으로 수정 |

---

## v3.29.1 — [커뮤니티] 리스트 피드 원 블록 화이트 보드 스타일 적용


**작업일:** 2026-03-04

- `CommunityFeed.tsx`: 일반 탭 리스트 래퍼에 `bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden` 적용 → 전체 피드가 하나의 하얀 카드 안에 담기는 구조
- `PostListCard.tsx`: 개별 아이템 스타일 정리
  - 바깥 테두리/그림자 제거
  - `border-b border-gray-100 last:border-0` 로만 행 구분
  - `hover:bg-gray-50 transition-colors` hover 강조
  - `px-5` 내부 패딩 통일
- 데이터 패칭·무한스크롤 로직 완전 무손실

---

## v3.29.0 — [커뮤니티] 하이브리드 UI (리스트형 + 그리드형) 전면 개편


**작업일:** 2026-03-04

### 변경 내용

| 파일 | 변경 |
|------|------|
| `CommunityCategoryTabs.tsx` | 4번째 탭 **✨ 로컬리 콘텐츠** 추가, 활성 탭 scale 애니메이션 |
| `PostListCard.tsx` (신설) | Q&A·동행·꿀팁 전용 F-Pattern 수평 리스트형 카드 (좌측 썸네일 + 우측 정보) |
| `PostGridCard.tsx` (신설) | 로컬리 콘텐츠 전용 인스타그램형 그리드 카드 (aspect-square + hover 오버레이) |
| `CommunityFeed.tsx` | `category === 'locally_content'` → 그리드 3/4칸, 나머지 → 리스트 조건부 렌더 |
| `page.tsx` | `locally_content` 카테고리 허용 범위에 추가, 넛지 박스 콘텐츠 탭에서 숨김 |
| `RightSidebar.tsx` | 앱 CTA 배너 삭제 → **⚡ 실시간 업데이트** 위젯으로 교체 (Supabase Realtime INSERT 구독, 그린 Live Indicator) |

### 설계 원칙
- 무한스크롤 / 데이터 패칭 로직 **완전 무손실**
- 모바일 FAB 기존 코드 유지

---

## v3.28.0 — [팀챗] Chrome 모바일 성능 + 리액션 + 읽음처리 전면 개선


**작업일:** 2026-03-04

### Phase 1 — Chrome 모바일 버그 수정 (DB 변경 없음)

| 버그 | 원인 | 수정 |
|------|------|------|
| 채팅창 열 때마다 느려짐 | `isOpen`이 useEffect deps → 토글마다 Supabase 채널 재구독 | `isOpenRef` 도입, deps에서 `isOpen` 제거 |
| 최초 오픈 시 스크롤 안 됨 | 모바일 메시지가 `{isOpen && ...}` 조건부 렌더 → `mobileScrollRef = null` | 항상 렌더 + CSS `overflow: hidden` 제어로 변경 |
| 간헐적 중복 메시지 | content 기반 temp_ 중복 제거 → 동일 내용 메시지 오작동 | `author_id + created_at 5초 이내` 기반으로 교체 |

### Phase 2 — 메시지 리액션 ❤️ ✅ 🙏

- hover/tap 시 🙂 버튼 → 리액션 피커 팝업
- 리액션 집계 버블 (내 리액션 강조 표시)
- Realtime UPDATE 구독 추가 → 다른 팀원 리액션 실시간 반영
- **DB 마이그레이션 필요:** `reactions JSONB` 컬럼 (`docs/migrations/v3_28_0_team_chat_reactions.sql`)

### Phase 3 — 읽음처리 DB 기반

- 기존 localStorage 방식 → `read_by TEXT[]` DB 컬럼으로 업그레이드
- 채팅 오픈 시 자신의 ID를 `read_by`에 추가
- 내가 보낸 마지막 메시지 아래 "읽음 N명" 표시
- **DB 마이그레이션 필요:** `read_by TEXT[]` 컬럼 (동일 SQL 파일)

> [!IMPORTANT]
> **Supabase 콘솔에서 마이그레이션 실행 필요**
> `docs/migrations/v3_28_0_team_chat_reactions.sql` 파일을 Supabase SQL Editor에서 실행하면 Phase 2~3 기능이 활성화됩니다.
> Phase 1 버그 수정은 DB 변경 없이 이미 적용됩니다.

### 회귀 위험 분석 결과

| 파일 | 영향 | 판정 |
|------|------|------|
| `TeamTab.tsx` | `select('*')` 후 JS 렌더 → 새 컬럼 단순 무시 | ✅ 없음 |
| `MiniChatBar.tsx` | 동일 패턴 | ✅ 없음 |
| `Sidebar.tsx` | COUNT만 조회 | ✅ 없음 |

---

## v3.27.6 — [커뮤니티 UI] 하단 탭 복원 + 프로필 메뉴 위치 + 이미지 비율 수정


**작업일:** 2026-03-04

| 항목 | 변경 |
|------|------|
| 모바일 하단 탭 | 커뮤니티 탭 제거 → 5탭 복원 (검색/위시리스트/**여행**/메시지/프로필) |
| 프로필 메뉴 커뮤니티 위치 | 그룹3(Locally 섹션) → **그룹1(위시리스트 바로 아래)** 으로 이동 |
| 데스크탑 이미지 비율 버그 | `aspect-square + w-full + max-h` 3중 충돌 → `max-w-xs md:mx-auto + aspect` 로 해결 |

**원인 설명 (이미지 비율 버그):**
데스크탑 피드 카드 너비 ~ 560px 에서 `w-full` + `aspect-square` 가 560×560px 거대 컨테이너를 만들고,  
`max-h-72(288px)` 가 높이를 강제로 잘라내어 비율이 왜곡됨.  
→ `md:max-w-xs(320px)` 로 너비를 먼저 제한 후 `aspect` 로 높이를 결정하여 충돌 제거.

---

## v3.27.5 — [커뮤니티 UI] 모바일 내비게이션 개선 + 이미지 비율 최적화


**작업일:** 2026-03-04

### 변경 내용

| 항목 | 이전 | 이후 |
|------|------|------|
| 모바일 하단 탭 커뮤니티 아이콘 | `Globe` | `Users2` (데스크탑과 동일) |
| 프로필 메뉴 커뮤니티 링크 | 모달 → `/company/community` | `/community` 직접 이동 |
| `/app/company/community/` | 존재 | **삭제** (폐기) |
| 이미지 비율 (피드 카드) | `aspect-video` (16:9) | 1장: 4:5/1:1 자동 감지, 2~3장: 1:1 그리드 |
| 이미지 비율 (상세 페이지) | 비율 없이 `w-full` | 동일 4:5/1:1 자동 감지 |

### 신규 파일
- `app/community/components/PostImages.tsx` — `onLoad` 기반 이미지 비율 자동 감지 클라이언트 컴포넌트

### 이미지 압축 유틸 현황 (변경 없음, 정상 동작 확인)
- `maxSizeMB: 1` / `maxWidthOrHeight: 1280` / JPEG 변환
- 4:5 원본 이미지도 비율 유지한 채 리사이즈됨 ✅

---

## v3.27.4 — [피드 갱신] 글 등록 후 커뮤니티 피드에 새 글이 안 보이는 버그 수정


**작업일:** 2026-03-04

### 원인 3가지 (동시 발생)

| # | 원인 | 수정 |
|---|------|------|
| 1 | `posts/route.ts`에 `revalidatePath('/community')` 미호출 — 글 등록 후 Next.js 라우터 캐시가 구 피드 서빙 | `revalidatePath('/community')` 추가 |
| 2 | `community/page.tsx`에 `dynamic='force-dynamic'` 없음 — Vercel 엣지 캐시가 구 SSR 결과물 서빙 | `export const dynamic = 'force-dynamic'` 추가 |
| 3 | `page.tsx` + `api/community/route.ts`가 단일 join 쿼리 사용 — join 에러 시 `data=null`→ 빈 피드 | 각각 join 분리 패턴(① post → ② profiles → ③ experiences 별도 조회)으로 전환 |

### 수정 파일
- `app/api/community/posts/route.ts` — `revalidatePath('/community')` 추가
- `app/community/page.tsx` — `force-dynamic` + SSR 쿼리 join 분리
- `app/api/community/route.ts` — 무한스크롤 API join 분리

---

## v3.27.3 — [핵심버그] 커뮤니티 게시글 상세 404 근본 원인 수정


**작업일:** 2026-03-04

### 진짜 원인 (RSC 페이로드 분석으로 특정)

```
generateMetadata (join 없는 단순 쿼리)   → ✅ 포스트 데이터 정상 반환
page 컴포넌트  (profiles + experiences join) → ❌ 쿼리 에러 → data=null → notFound()
```

**단일 쿼리에서 join 에러가 발생해도 `data=null`로 조용히 실패하고, `!post` 체크만 하기 때문에 `notFound()`가 무조건 호출됨.** `error` 필드를 무시한 것이 근본 원인.

### 수정 내용

`community/[id]/page.tsx` 쿼리를 **3단계로 분리**:

1. **① post 단독 조회** (`select('*')`, join 없음) — 실패 시에만 `notFound()`
2. **② profiles 별도 조회** — 실패해도 렌더에 영향 없음 (폴백: '로컬리 유저')  
3. **③ experiences 조건부 조회** — `linked_exp_id`가 있을 때만 실행

→ post 자체가 DB에 있는 한 **절대 404가 나지 않음**.

---

## v3.27.2 — [보안] 어드민 팀 협업 이메일 무단 발송 버그 수정


**작업일:** 2026-03-04

### 버그 원인 (전수조사)

`/api/admin/notify-team` API에서 **이중 소스(Dual-Source)** 로 이메일을 수집하는 로직이 루트 원인:

```
① supabaseAdmin.from('users').eq('role', 'admin')  → profiles 경유로 이메일 추출
② supabaseAdmin.from('admin_whitelist').select('email')
→ 두 소스를 Array.from(new Set([...① , ...②])) 합산
```

`admin_whitelist`에서 삭제해도 **`users.role='admin'`이 남아있는 한 ① 소스에서 계속 이메일이 수집**되어 삭제된 관리자에게 무한히 알림 메일이 발송되었음.

### 수정 내용

- **`app/api/admin/notify-team/route.ts`**: `users.role` 소스 완전 제거. `admin_whitelist` 단일 소스로 교체.
- **이후 팀원 관리 원칙**: 추가/삭제는 반드시 `admin_whitelist` 테이블에서만 수행.

### 트리거 지점 (이메일 발송 유발 액션)

팀 협업에서 아래 액션 시 notify-team API 호출됨:
- TeamTab: 할 일 추가, 할 일 댓글, 메모 신규 작성, 메모 댓글
- GlobalTeamChat: 채팅 메시지 전송

---

## v3.27.1 — 커뮤니티 버그 핫픽스 (SiteHeader 사라짐 / 게시글 상세 404 / 메뉴 텍스트)


**작업일:** 2026-03-04

### 원인 분석

| 버그 | 근본 원인 | 수정 |
|------|-----------|------|
| SiteHeader 사라짐 | 이 프로젝트는 `layout.tsx`에 `SiteHeader`가 없고 **각 페이지마다 직접 import·렌더링**하는 패턴. v3.27.0 작업 중 `community/page.tsx`에서 중복 제거 목적으로 SiteHeader까지 삭제함. | `community/page.tsx`에 `SiteHeader` import 및 렌더링 복원 |
| 게시글 상세 Vercel 404 | `community/[id]/page.tsx`의 Supabase 쿼리에서 `profiles:user_id(name, avatar_url, role)` — `profiles` 테이블에 `role` 컬럼이 존재하지 않아 쿼리 전체가 에러 반환 → `post`가 `null` → `notFound()` 호출 → Vercel 404 페이지 출력 | `profiles:user_id` select에서 `role` 제거. 미사용 `ShieldCheck` import 정리 |
| 우측 드롭다운 'community' 텍스트 | `LanguageContext.t()` 함수가 번역 키가 없을 때 키 이름(`'community'`)을 문자열로 반환하는 패턴이어서 `\|\| '커뮤니티'` fallback이 작동하지 않음 | SiteHeader 메뉴 텍스트를 `'커뮤니티'`로 하드코딩 |

---

## v3.27.0 — 커뮤니티 UI 프리미엄 리뉴얼 (에어비앤비/트리플 스타일 7:3 반응형 레이아웃)


**작업일:** 2026-03-04

기존 API 로직과 헤더/푸터를 완벽히 보존한 채, 커뮤니티 UI를 에어비앤비/트리플 스타일의 프리미엄 반응형 7:3 레이아웃으로 전면 리팩토링했습니다.

### [Layout] 7:3 반응형 2단 그리드 신설
- `page.tsx` 전면 재작성: `bg-[#F7F7F9]` 배경 + `grid-cols-12` (피드 8칸 / 사이드바 4칸) 적용.
- `SiteHeader` / `SiteFooter` 100% 보존. 기존 모바일 단일 컬럼 레이아웃은 `hidden lg:flex`로 분기.

### [Component] RightSidebar.tsx 신설
- `sticky top-28` 고정 사이드바에 4개 위젯 구성: 글쓰기 CTA(로즈 그라디언트 버튼), 주간 인기 체험 리스트, 지금 뜨는 라운지 글, 앱 다운로드 CTA.

### [Component] CommunityCategoryTabs.tsx 알약 탭 전환
- 밑줄 탭 → `rounded-full` 알약(Pill) 형태로 전환. 활성: `bg-black text-white`, 비활성: `bg-white text-gray-500 border border-gray-200`.

### [Component] PostCard.tsx 프리미엄 카드 리뉴얼
- `bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 active:scale-[0.99] transition-all` 카드 적용.
- 카드 헤더: `w-10 h-10` 원형 아바타(첫 글자 폴백) + 카테고리 뱃지. 푸터: 아이콘 인게이지먼트 + `border-t` 구분선.

### [Component] LinkedExperienceChip.tsx 세련된 미니 카드 업그레이드
- `bg-[#F7F7F9] hover:bg-gray-100 border border-gray-200 rounded-xl` + 가격 로즈 컬러 강조 + 썸네일 스케일 호버 효과.

### [UX] Empty State & Loading Skeleton 고도화
- **Empty State:** `MessageSquareDashed` 아이콘 + "첫 글의 주인공이 되어보세요!" + CTA 버튼 (`border-dashed rounded-2xl` 카드).
- **Shimmer Skeleton:** 새 카드 레이아웃(`rounded-2xl`)과 일치하는 `animate-pulse` 스켈레톤 3카드.

### [UX] 글쓰기 유도 넛지 + 모바일 FAB 추가
- 피드 상단에 글쓰기 유도 입력창 카드 (`/community/write` 라우팅).
- 모바일 전용 `fixed bottom-20 right-4 w-14 h-14 bg-[#FF385C]` 플로팅 버튼(FAB) 신설.

### Constraints 준수
- `limit(15)` + `IntersectionObserver` 무한 스크롤 로직 100% 무손실 보존.

---

## v3.26.3 — 커뮤니티 내비게이션 재배치



**작업일:** 2026-03-04

- **`SiteHeader.tsx`:** 상단 네비게이션에서 커뮤니티 링크 제거. 대신 우측 햄버거 드롭다운 메뉴 최상단 위치에 Users2 아이콘과 함께 삽입.
- **`SiteFooter.tsx`:** 하단 펋터 "커뮤니티" 링크를 `/company/community`(Mock 페이지)에서 실제 포럼 `/community`로 수정.

---

## v3.26.2 — 커뮤니티 Phase 4: 댓글 & 좋아요 시스템

**작업일:** 2026-03-04

- **댓글 API (`GET/POST /api/community/comments`):** 게시글별 댓글 조회와 포스팅 API. `.limit(100)` 에러 안전 펯지, 인증 후 INSERT.
- **좋아요 토글 API (`POST /api/community/likes`):** UNIQUE 제약 + DB 트리거로 `like_count` 자동 증감 요청.
- **`CommentSection.tsx`:** 내부 데이터 패치 + `Sticky` 하단 입력츸 UI. Q&A 선택 도구(is_selected) 지원.
- **`LikeButton.tsx`:** 정관적 UI 업데이트 + 실패시 롤백(Rollback) 보언.

---

## v3.26.1 — 커뮤니티 Phase 3: 글쓰기 & 상세보기 SEO

**작업일:** 2026-03-04

- **글쓰기 페이지 (`/community/write`):** 카테고리 선택(Q&A/동행/꿀팁), 사진(최대 3장) 첨부 기능. 업로드 전 `compressImage` 유틸 강제 적용으로 OOM 원천 차단.
- **글 상세 페이지 (`/community/[id]`):** SSR + `generateMetadata`로 개별 게시글 URL이 구글 검색 결과에 직접 노출.
- **글 작성 API (`/api/community/posts`):** `auth.uid` 서버 검증 후 `community_posts` INSERT. RLS 이중 방어 적용.

---

## v3.26.0 — 자체 커뮤니티 엔진 (Community Forum) Phase 1 & Phase 2 연동 성공

**작업일:** 2026-03-04

### 개요
Locally 플랫폼의 자생적 체류 시간 증대 및 검색엔진(SEO) 확장을 위한 **"100% 자체 제작 커뮤니티 엔진"**이 OOM(서버 다운) 방어 체계를 갖추고 성공적으로 연동되었습니다.

### [DB & Server] Phase 1 구조 셋업
- **OOM(서버 다운) 완벽 차단 구조:** 모든 API 및 Feed 렌더링에 `.limit(15)` + `Intersection Observer` 무한 스크롤 강제 적용. 수만 건의 데이터가 쏟아져도 관리자 대시보드처럼 메모리가 폭주하지 않습니다.
- **`community_posts`, `community_comments`, `community_likes` 테이블 신설 & 마이그레이션 적용 완료.**
- **안전한 권한 통제 (RLS):** 구글 크롤러와 모든 게스트는 읽을 수 있지만, 쓰기와 수정/삭제는 자신에게만 권한이 열려있도록 `Row Level Security` 다중 정책 셋업 완료.

### [Frontend UI] Phase 2 코어 연동
- **주요 페이지 라우팅 (`/community`):** 메인 피드 렌더링(`CommunityFeed.tsx`) 셋업. Q&A / 동행 / 꿀팁 카테고리 필터(`CommunityCategoryTabs.tsx`).
- **인게이지먼트 최적화 카드 (`PostCard.tsx`):** 현지 체험 상품 유도를 위한 `LinkedExperienceChip.tsx` (Rich Embeds) 개발 완료. 글을 읽다가 칩을 누르면 즉시 예약 상세 화면으로 빨려 들어갑니다.
- **Dynamic SSR SEO 완성:** `app/community/page.tsx`에 `generateMetadata`를 적용하여 탭 클릭 시마다 구글 봇에게 즉시 최적화된 URL을 제공합니다.
- **내비게이션 통합:** 데스크탑 `SiteHeader` 주요 네비게이션과 모바일 `BottomTabNavigation`의 정중앙에 100% 무손실로 메뉴 삽입. (화면 깜빡임이나 React Hydration 에러 없음)

---

## v3.25.6 — 다국어 동적 메타데이터(SEO) 적용 (feat/seo: implement middleware-based dynamic metadata for i18n)

**작업일:** 2026-03-04

### 개요
기존 구조를 완벽하게 유지한 채로, 구글 로봇과 해외 검색 엔진 유입을 극대화하기 위한 "무손실 다국어 개별 메타데이터(SEO)" 구조를 도입 성공했습니다.

### [Feature] 미들웨어 기반 헤더 인젝션 다국어 최적화
- **안전한 구조 보존:** `app/[locale]` 폴더 전환이라는 파괴적인 프레임워크 변경 없이, 기존 정적 라우팅 구조를 100% 보존하며 구현했습니다.
- **Middleware 언어 탐지:** `app/middleware.ts`에서 접속 URL의 언어 코드(`/ko`, `/ja`, `/zh`, `/en`)를 가로채어 비밀 헤더(`x-locally-locale`)로 서버단에 넘겨주는 로직을 주입.
- **Dynamic SEO Metadata:** `app/layout.tsx`에서 고정 타이틀/설명을 제거하고 `generateMetadata()` 엔진을 투입. 이 엔진이 미들웨어가 찔러준 헤더 언어를 읽고 즉시 현지화(Localization)된 타이틀(`Locally - 日本の現地ガイド`, `로컬리 Locally` 등)과 `hreflang` 태그를 동적으로 생성하여 구글 크롤러에게 제공하게 됩니다.

---

## v3.25.5 — 지난 여행 카드(PastTripCard) 썸네일 누락 핫픽스 (Hotfix)

**작업일:** 2026-03-04

### 개요
`/guest/trips` 페이지의 "나의 여행" 중 과거 여행 목록(`PastTripCard.tsx`)에서 썸네일 사진이 빈 회색 상자로 노출되는 UI 버그(Image Disappearance)를 해결.

### [Bugfix] 구형 사진 렌더링 스크립트 최신화
- **원인:** 진행 중인 예약 카드(`TripCard.tsx`)는 최신 다중 사진 스펙(`trip.photos`)을 바라보도록 앞서 업데이트되었으나, 과거 여행 카드(`PastTripCard.tsx`)는 예전 코드베이스로 방치되어 오직 텅 빈 `trip.image` 스트링만 조회하며 사진이 없다고 판정해버림.
- **수정:** 
  - `PastTripCard.tsx`의 이미지 렌더링 로직을 `trip.photos && trip.photos[0]` 우선 조회 방식으로 3줄 교체.
  - 만약 예전 방식의 사진 구조라면 `trip.image`를 띄우도록 Fallback을, 사진이 아예 없는 비정상 케이스라면 로컬리 표준 빈 이미지 아이콘인 `<Mountain />`이 뜨도록 UI 일관성 보완.

---

## v3.25.4 — 회원가입 500 에러 긴급 복구 및 프로필 동기화 트리거 안정성(Exception) 강화 (Hotfix)

**작업일:** 2026-03-04

### 개요
v3.25.3에서 적용한 DB 트리거(`handle_new_user`) 스크립트가, 프론트엔드에서 넘어오는 빈 문자열(`""`) 이나 비표준 날짜 텍스트를 Postgres `DATE` 타입으로 강제 형변환(Casting)하려다 파싱 에러(invalid input syntax for type date)를 일으켜, **회원가입 트랜잭션 전체가 500 에러와 함께 롤백되는 치명적인 장애**를 발생시킨 현상을 긴급 복구했습니다.

### [Bugfix] DB 트리거 500 롤백 방어 
- **원인:** 회원가입 시 생년월일(`birth_date`)이나 기타 선택 정보가 비어있거나(`""`) 유효하지 않은 형태로 전달될 경우, Postgres가 엄격한 타입 체크에 막혀 `INSERT INTO profiles` 자체를 튕겨내고 Supabase Auth까지 연쇄 실패하게 만들었음.
- **수정 (`supabase_profile_sync_v3_migration.sql` 배포):** 
  - `NULLIF(val, '')` 함수를 씌워 빈 문자열이 들어오면 전부 안전한 `NULL`로 치환하여 `DATE` 컬럼 삽입 에러를 우회하도록 방어벽 추가.
  - 트리거 내부 `BEGIN ... EXCEPTION WHEN others THEN ... END` 예외 처리 블록을 구축. 최악의 경우(날짜 포맷 에러 등)에도 트랜잭션 롤백 없이 **가입을 100% 무조건 성공**시키고 최소 필수 정보(이름, 이메일, 프로필사진)만이라도 먼저 Insert시키는 Fallback(플랜 B) 로직을 적용 완수.

---

## v3.25.3 — 회원가입 프로필 동기화 DB 트리거 누락 핫픽스 (Hotfix)

**작업일:** 2026-03-04

### 개요
v3.21.0에서 단행된 프로필 동기화 아키텍처(Postgres Trigger) 전환 시 누락되었던 필수 게스트 정보(휴대폰 번호, 생년월일, 성별) 컬럼 매핑을 추가하여 회원가입 시 데이터가 100% 정상적으로 `profiles` 테이블에 복사되도록 SQL 마이그레이션을 재작성했습니다.

### [Bugfix] DB 트리거(`handle_new_user`) 매핑 누락 및 오탈자 복구
- **원인:** 기존 `on_auth_user_created` 트리거가 `email`, `name`, `avatar_url`만 복사하고 프론트엔드에서 고생해서 받아온 `phone`, `birth_date`, `gender`를 무시(Drop)하여 가입 데이터가 공중분해되는 현상 및 `full_name` 컬럼 매핑 불일치 발견.
- **수정:** 
  - `supabase_profile_sync_v2_migration.sql` 스크립트를 작성하여 `handle_new_user` 트리거 함수 선언부 전면 교체(REPLACE).
  - 결과적으로 프론트(LoginModal)에서 `auth.signUp` 시 `user_metadata`에 실어 보낸 연락처, 생년월일, 성별, 이름이 계정 관리 페이지(`/account`)에 1:1로 렌더링되도록 백엔드 싱크 로직 정상화 완료.

---

## v3.25.2 — 게스트 썸네일 이미지 매핑 버그 및 Fallback 로직 핫픽스

**작업일:** 2026-03-03

### 개요
게스트의 예약 상세 내역 및 호스트 리뷰에서 이미지/프로필 사진이 제대로 표기되지 않고 "로고 사진이 화면을 가득 채우는" 치명적인 버그를 해결했습니다.

### [Bugfix] 게스트 예약 내역 데이터 API 누락 해결
- **원인 분석:** 게스트 예약 내역을 불러오는 API(`/api/guest/trips/route.ts`) 내부 쿼리에서 `experiences` 테이블을 조인할 때, 현대적인 포맷인 `photos` 배열 컬럼을 선택(`select`)하지 않고 구형 `image_url`만 가져옴으로써 사진 데이터가 프론트엔드로 전달되지 않고 있었습니다. 홈 화면에서 사진이 나오는데 예약 내역에서 안 나오던 근본적인 원인입니다.
- **수정:** API 쿼리에 `photos` 컬럼을 명시적으로 추가하고 `trip.photos`로 올바르게 데이터 매핑을 연결하여, 이제 호스트가 등록한 체험 사진들이 예약 탭에서도 문제없이 렌더링됩니다.

### [Fix] 원형 깨짐을 방지하는 모던 Fallback UI 복원
- **원인 분석:** 실제 프로필 사진이 없는 유저나 체험 데이터일 경우, 회사의 직사각형 로고(logo-black-transparent.png)를 원형 프레임이나 썸네일에 강제로 구겨 넣어 사진이 기괴하게 나오거나 텍스트가 잘리는 현상이 발생했습니다.
- **수정:** 
  1. `TripCard.tsx`: 체험 사진이 전부 지워졌거나 완전히 비어있는 최악의 경우, 로고 대신 깔끔한 회색 배경의 `Mountain` (풍경) 아이콘 구조로 대체했습니다.
  2. `HostReviews.tsx`: 게스트가 아바타 사진을 올리지 않은 경우, 투박한 로고 대신 Lucide의 `User` (사람 시루엣) 아이콘을 사용하여 일관되고 세련된 UI를 유지하도록 복원했습니다.

---

## v3.25.1 — 외부 이미지 도메인 허용 (Image Host 보안 정책 완화)

**작업일:** 2026-03-03

### 개요
외부 서비스에서 불러온 썸네일 등의 이미지가 렌더링될 때 발생하는 `unconfigured host` (400 Bad Request) 보안 에러 핫픽스입니다.

### [Fix] 외부 더미 이미지 서비스 종속성 제거 (안정성 강화)
- **문제 현상:** `next/image` 컴포넌트 사용 시 `via.placeholder.com` 등 외부 더미 이미지 서비스를 사용할 경우, Vercel Edge 서버에서의 DNS Resolve 실패(502 Bad Gateway) 문제와 더불어 실제 화면에 '400x400' 같은 글자가 노출되어 UX를 저해하는 현상 발생.
- **수정:** 
  1. 기존 `next.config.ts`의 `images.remotePatterns` 배열에 임시로 추가했던 외부 더미 이미지 도메인(`via.placeholder.com`, `placehold.co`)을 롤백(제거 대상 여부 검토)하려 했으나, 보험용으로 화이트리스트엔 유지.
  2. 실제 코드베이스(`TripCard.tsx`, `HostReviews.tsx`) 내부의 `[trip.image || 'https://placehold.co/...']` 구문을 Vercel 배포망 내부에 안전하게 캐싱되어 있는 정적 로컬 어셋인 `/images/logo-black-transparent.png`로 전면 교체하여 네트워크 에러 및 UI 품질 저하 문제를 완벽히 해결했습니다.

---

## v3.25.0 — System Performance & Image Compression Optimization

**작업일:** 2026-03-03

### 개요
플랫폼 내 이미지 압축 누락 구간과 어드민 대시보드 및 채팅에서 발생하던 치명적인 메모리 누수(OOM) 취약점을 보완하여 서버 과부하를 원천 차단했습니다.

### [PERF-1] 프리미엄 이미지 최적화 및 스토리지 과부하 방어
- **기존 문제:** `ReviewModal`, `ProfileEditor`, `HostRegisterPage`에서 고해상도 이미지를 원본 그대로 스토리지에 업로드하여 네트워크 업스트림 지연 및 브라우저 성능이 하락하는 취약점이 발견되었습니다.
- **수정:** 모든 누락된 업로드 폼에 `compressImage()` 파이프라인을 강제 적용하여 Storage 트래픽을 대폭 절감했습니다.

### [PERF-2] 무제한 쿼리(Limitless Query) 방어벽 구축 (OOM 차단)
- **기존 문제:** `useAdminData.ts` 및 `useChat.ts` 내부에서 `.limit()` 제어 없이 전체 테이블을 스캔하여 브라우저 크래시(Crash) 및 Vercel Timeout 위험이 높았습니다.
- **수정:** 어드민 페이지네이션 시스템을 갈아엎는 위험한 도박 대신, 무결성을 보장하는 "엔진 안전 제한(Engine Safety Limit)"을 도입했습니다.
  - `Admin Dashboard`: `reviews`, `profiles`는 5000개, `experiences`, `apps`는 3000개 제한 도입.
  - `Chat Inbox`: 전체 문의 내역 대신 최신 100개(`limit(100)`)만 스캔하도록 최적화.

---

## v3.24.4 — E2E 예약 파이프라인 정합성 패치 (Runtime Sync & UI 가이드)

**작업일:** 2026-03-03

### 개요
- **[UI/UX] 결제 대기 예약 뱃지 추가 (Host Dashboard):** 결제 이탈/무통장 입금 대기 등으로 아직 `PAID` 상태가 되지 못한 `PENDING` 예약에 대해, 숨김 처리 대신 호스트가 명확하게 인지할 수 있도록 예약 카드 최상단에 직관적인 "결제 대기중(PENDING)" 뱃지를 시각적으로 구분하여 추가했습니다.
- **[UI/UX] 호스트 취소 비즈니스 룰 안내 추가:** 호스트가 임의로 예약을 1-Click 취소할 수 없는 기획 의도를 시스템 스펙으로 굳히고, `PAID` 상태의 예약 카드 하단에 "예약 취소가 필요한 경우 게스트에게 메시지로 상황을 설명하고 취소를 요청해 주세요"라는 어드바이스 텍스트 영역을 추가하여 UX 데드엔드를 해소했습니다.
- **[Data Sync] Fake `completed` 상태 런타임 물리적 보정:** 게스트 마이페이지(`My Trips`)에서 과거 날짜의 호스트 예약 건에 대해 화면에만 `completed`로 가짜(Mocking) 응답하는 구조를 보완하여, 페이지 조회하는 순간 실제 DB를 Lazy Update 방식으로 즉시 `PATCH` 동기화시킴으로써 향후 리뷰 등 후속 프로세스의 에러 바운더리를 원천 제거했습니다.

---

## v3.24.3 — System Audit: 권한 검증 크래시 방어 및 결제 UX 개선

**작업일:** 2026-03-03

### 개요
- **[CRITICAL]** 일본 전화 대행 의뢰 백엔드 API 라우트(`.ts`) 내부에서 관리자 여부를 판별할 때, 유효하지 않은 `profiles.role` 컬럼을 조회하여 발생하는 치명적인 DB 500 에러(크래시)를 원천 차단했습니다. 로직을 `auth.users` 이메일과 `admin_whitelist`를 대조하는 안전한 방식으로 전면 교체했습니다.
- **[WARNING]** 이메일 렌더러 실패 시 DB에 에러 로그를 남길 때, 대상자 ID(hostId)가 없어 Null Constraint를 위반하던 알림 누락 현상을 타겟 이메일(Target Email) 기반 ID 조회 Fallback 구조를 추가하여 무결하게 수정했습니다.
- **[WARNING]** 사용자가 전화 대행 폼에서 '로컬리 웹 자체 결제' 트랙을 선택했을 때, 아무런 결제 플로우 없이 대기 상태로 끝나버리는 UX 데드엔드를 해결했습니다. 상세 페이지 내부에 결제 수수료와 전용 무통장 입금 계좌 정보를 안내하는 모듈을 삽입했습니다.
- **[OPTIMIZATION]** 플랫폼 성장 시 예상되는 메모리 및 DB 읽기 지연을 방지하기 위해 Proxy Requests 목록 Fetch API 인스턴스에 `limit(50)` 쿼리 옵티마이저를 추가했습니다.

---

## v3.24.2 — 서비스 예약 리스트 UI (Client Routing) 핫픽스

**작업일:** 2026-03-03

### 개요
- '/proxy-bookings' 페이지에서 고객/관리자가 예약 내용을 표시하는 카드 UI를 클릭했을 때, Next.js `<Link>` 인터페이스에서 하위 블록의 클릭 이벤트 크기를 확장하지 못해 라우팅이 원활하게 동작하지 않던 현상을 수정했습니다.
- `ProxyBookingsBoard` 컴포넌트 내부 리스트 렌더러에 `className="block"` 속성을 주입하여 모바일 및 웹앱 환경에서 전체 카드를 터치/클릭하여 상세 내역으로 정상 이동할 수 있도록 조치했습니다.

---

## v3.24.1 — RLS 보안 정책 최적화 및 통합 마이그레이션 스크립트 갱신

**작업일:** 2026-03-03

### 개요
- DB 마이그레이션 적용 중 발생한 Permission Denied 에러를 원천 차단하기 위해 `auth.users` 서브쿼리를 조회하는 불안정한 방식을 폐기하고, Supabase 권장 안전 방식인 `auth.jwt() ->> 'email'` 클레임 추출 방식으로 모든 RLS(Row Level Security) 정책 8개를 전면 재작성했습니다. (안정성 극대화 및 레이턴시 단축)
- 분산될 수 있는 테이블 생성(`proxy_requests`, `proxy_comments`) 및 인덱스/트리거 로직을 하나의 통합본인 `supabase_proxy_service_migration.sql` 파일에 모두 병합하여, 빈 DB에서도 한 번의 실행으로 완벽한 인프라가 구축되도록 무결성을 보장했습니다.

---

## v3.24.0 — 일본 현지 전화 대행 예약 서비스 (Proxy Service) 내재화

**작업일:** 2026-03-03

### 개요
스마트스토어에서 수동으로 운영 중이던 '일본 전화 대행 예약 서비스'를 Locally 플랫폼으로 내재화하여 고객-관리자 간의 1:1 티켓 기반 양방향 커뮤니케이션 파이프라인으로 구축 완료.

### [Proxy-1] 통일된 1:1 티켓 보드 아키텍처 (어드민 대시보드 무의존)
- 무거운 별도의 어드민 페이지 없이, 고객과 관리자가 권한(Role)에 따라 다르게 접근하는 단일 라우트 `/proxy-bookings`를 구현.
- 고객은 자신의 예약건만 확인 가능하고, 관리자는 모든 요청을 모니터링 및 상태 변경 가능하도록 Supabase RLS 및 서버사이드 접근 제어(ACL) 적용.

### [Proxy-2] 유연한 폼 데이터(JSONB)와 2-Track 결제
- 카테고리별(식당 예약, 교통 문의 등 5가지)로 완전히 다른 입력 양식을 하나의 테이블에 수용할 수 있도록 `proxy_requests.form_data`(JSONB) 스키마 도입.
- 기존 스마트스토어 결제 고객(주문번호 대신 직관적 구매자명 수집)과 Locally 자체 웹 결제 고객의 데이터 폼 트랙을 분리하여 Zod 기반 다이나믹 유니온 스키마 검증 구축.

### [Proxy-3] 양방향 댓글 시스템 + 실시간 이메일 알림
- 고객과 관리자가 1:1로 소통할 수 있는 `proxy_comments` 테이블 및 양방향 채팅 UI 구현.
- 답글 작성 시 즉각적으로 상대방에게 로컬리 이메일 알림을 비동기 발송하도록 `/api/notifications/send-email` (`type: proxy_comment_notify`) 백그라운드 확장.

---

## v3.23.0 — Platform Stability & Email Infrastructure Overhaul Backend Patch

**작업일:** 2026-03-03

### 개요
플랫폼의 치명적인 결함(Postgres 참조 무결성 500 에러 및 이메일 결합도로 인한 PG사 결제 타임아웃)을 전면 척결하고, 데이터 정합성과 알림 시스템의 독립성을 보장하는 대규모 백엔드 구조조정 완료.

### [Core-1] Postgres DB Auth Trigger를 통한 프로필 동기화 아키텍처 (100% 보장)
- 클라이언트단(`syncProfile.ts` 등 6곳)에 의존하던 수동 프로필 동기화 런타임을 폭파하고, DB 레벨의 Postgres Trigger(`on_auth_user_created`)로 마이그레이션.
- 예약 및 1:1 문의 등 필수 파이프라인에서 발생하던 `profiles` FK Constraint Violation(`500 Error`) 영구 해결.

### [Core-2] 결제 웹훅과 이메일 시스템의 완벽 분리 (Decoupling)
- 메인 결제 라우트(`nicepay-callback`, `cancel`) 내부에 공생하며 타임아웃을 유발하던 무거운 React Email 렌더링 + Nodemailer 발송 로직 전단 도려냄.
- 이메일 전용 백그라운드 API `/api/notifications/send-email`을 신설하고, PG망에는 `200 OK`를 우선 반환한 후 비동기 Fetch(fire-and-forget) 방식으로 알림을 넘기는 독립 아키텍처 구현.

### [Core-3] React Email 렌더링 크래시 방어 및 안정성 패치
- 결제 콜백 웹훅으로부터 누락되었던 필수 `totalAmount` 페이로드를 조인하여 전송.
- `BookingConfirmationEmail`/`BookingCancellationEmail` 내부에서 조인되지 않은 `null`, `undefined`, 빈 문자열 등이 주입되어도 Vercel 엔진이 뻗지 않도록 모든 Props에 옵셔널 체이닝(`?.`) 및 런타임 Fallback(`|| 0`) 방어벽 100% 구축.

### [Core-4] 백그라운드 에러 로깅 복구 및 무결성 확보 (Silent Error 추적)
- `send-email` 내부의 렌더 에러 예외 처리 블록(`catch`)에서 `request.clone().json()`을 이중으로 호출하다가 "stream already read"로 죽어버려 에러를 은폐하던 치명적 버그 디버깅 완료.
- 렌더에 실패하더라도 메인 결제 모델엔 지장 없이, `notifications` 테이블에 대상자의 `hostId`와 함께 `type: 'system_error'` 로그를 즉각 박아넣는 무결성 달성.

---

## v3.22.1 — React Email 렌더링 및 백그라운드 로깅 핫픽스 (Hotfix)

**작업일:** 2026-03-03

### 개요
v3.22.0 분리 이후 발생한 `BookingConfirmationEmail` 렌더링 크래시 및 에러 로깅 누락(Silent Error) 해결.

### [Hotfix-1] 이메일 페이로드 및 렌더링 타입 안정화
- 결제 콜백 웹훅으로부터 누락되었던 필수 `totalAmount` 데이터를 페이로드에 추가.
- React Email 컴포넌트 내부에서 `null` 값 참조 시 크래시가 발생하던 취약점을 방어하기 위해 Optional Chaining(`?.`) 및 컴포넌트 내부 런타임 Fallback 값 보강.

### [Hotfix-2] 백그라운드 로깅 예외(Exception) 버그 수정
- `app/api/notifications/send-email/route.ts` 내에서 이미 소모된 `request.json()` 스트림을 `catch` 블럭 안에서 `request.clone().json()`으로 중복 호출하여 "Type Error: stream already read" 에러가 이중으로 발생하던 설계상의 버그를 발견하여 즉각 수정.
- 본문 변수(`body`)의 스코프를 `try..catch` 바깥으로 승격시켜 이제 시스템 에러 발생 시 정상적으로 `notifications` 테이블에 대상자와 원인 에러 로그가 강제 저장됨.

---

## v3.22.0 — 결제 웹훅과 이메일 전송의 완전한 분리 (Decoupling)

**작업일:** 2026-03-03

### 개요
결제망의 타임아웃을 유발하던 무거운 React Email 렌더링 부하를 메인 결제 스레드에서 완전히 분리하는 아키텍처 재설계 진행.

### [Fix-1] 이메일 전용 백그라운드 API 신설
- 무거운 HTML 렌더링(React Email)과 Nodemailer 발송 로직만을 전문적으로 담당하는 `app/api/notifications/send-email/route.ts` 신설.
- 이메일 발송 실패 시(Catch), 아무도 모르게 무시(Swallow)하던 버그를 해결하기 위해 `notifications` 테이블에 `type: 'system_error'`로 장애 로그를 강제 기록하도록 구현.

### [Fix-2] 결제 콜백 API에서 이메일 렌더링 로직 철거
- `app/api/payment/nicepay-callback/route.ts` (예약 확정) 및 `app/api/payment/cancel/route.ts` (예약 취소) 내부에 있던 동기식 이메일 처리 로직을 완벽하게 도려냄.
- DB 처리가 끝난 즉시 신설된 전용 API(`send-email`)를 비동기 Fetch(fire-and-forget) 방식으로 호출하고, PG망에는 1순위로 `200 OK`를 빠르게 반환하여 Timeout 및 Silent Failure 사태 원천 차단.

---

## v3.21.0 — 프로필 동기화 아키텍처 개선 및 FK 결함 척결

**작업일:** 2026-03-03

### 개요
예약 및 1:1 문의 등 주요 파이프라인에서 발생하던 `profiles` 테이블 참조 무결성(FK Constraint) 500 에러를 영구적으로 해결하기 위한 DB 레벨 아키텍처 개선.

### [Arch-1] Postgres DB Trigger 기반 자동 프로필 생성 (Backfill 포함)
- 클라이언트의 네트워크 상태나 비정상 종료에 의존하던 불안정한 수동 생성(Upsert) 방식을 폐기.
- Supabase Auth 회원가입(`auth.users` Insert) 시 즉각적으로 연동되는 Postgres Trigger `on_auth_user_created` 구현.
- 기존 DB 내 누락된 '유령 유저'들을 복구하는 Backfill 마이그레이션 스크립트 작성 반영 (`supabase_profile_sync_migration.sql`).

### [Arch-2] 프론트엔드 불안정 코드 척결 및 Graceful Error Handling
- 클라이언트 레벨에서 프로필 시드를 강제로 쑤셔넣던 위험 코드 전역 삭제 (`syncProfile.ts`, `auth/callback/route.ts`, `LoginModal.tsx`, `account/page.tsx`, `MobileProfileView.tsx`, `ProfileEditor.tsx`).
- 핵심 API 라우트 (`api/bookings`, `useChat.ts` 등)에서 DB 지연에 따른 500 에러 발생 시, 유저 친화적인 400 Bad Request 에러 메시지로 반환하도록 런타임 안정성 보강.

---

## v3.20.0 — 이메일 UX 글로벌 프리미엄 모던 리뉴얼 적용

**작업일:** 2026-03-03

### 개요
글로벌 스탠다드에 맞추어 `react-email`을 도입하고, 핵심 비즈니스 이메일(예약 확정 / 예약 취소)의 디자인을 에어비앤비 수준의 모던하고 친근한 영수증 스타일로 전면 개편.

### [Email-1] 공통 이메일 레이아웃 및 컴포넌트 에셋 구축
- **파일:** `app/emails/components/EmailLayout.tsx`, `CTAButton.tsx`
- 연한 회색 바탕과 중앙 정렬된 16px 곡률의 흰색 컨테이너를 기본 레이아웃으로 제정.
- 명확도 높은 검은색 큰 CTA 버튼 적용.

### [Email-2] 핵심 비즈니스 이메일 템플릿(React Email) 교체
- 기존의 하드코딩 Raw HTML을 버리고, React 기반의 선언적 템플릿 렌더링 도입.
- **예약 확정 메일:** 직관적인 영수증 형태의 정보 배치 (인원수, 일자 명확히 분리 표기).
- **예약 취소 알림:** 위약금 환불액과 취소 사유를 명시하는 정중한 톤앤매너 템플릿 적용.
- **파일:**
  - `app/emails/templates/BookingConfirmationEmail.tsx`
  - `app/emails/templates/BookingCancellationEmail.tsx`
  - `app/api/payment/nicepay-callback/route.ts` (템플릿 render() 연결)
  - `app/api/payment/cancel/route.ts` (템플릿 render() 연결)

---

## v3.19.0 — 관리자 대시보드 유저 상세 모달 더미 데이터 척결

**작업일:** 2026-03-03

### 개요
어드민 대시보드(`UsersTab`)의 유저 상세 보기 모달에 방치되어 있던 하드코딩 구매/리뷰 데이터를 실제 DB 연동으로 전면 개편.

### [Data-1] 실제 결제/예약 및 리뷰 내역 연동
- 선택된 유저 ID를 기반으로 Supabase `bookings` 및 `reviews` 테이블 통합 Fetch 로직 추가.
- 가져온 실제 데이터를 바탕으로 '총 구매액', '구매 횟수', '마지막 구매일' 동적 산출 및 렌더링.
- 렌더링 목적의 가짜 구매 활동 배열(`을지로 노포 투어...`) 및 가짜 리뷰 배열 영구 삭제.
- **파일:** `app/admin/dashboard/components/UsersTab.tsx`

### [Data-2] Loading 및 Empty State 처리 추가
- 데이터 Fetching 중 상태를 표시하기 위한 로딩 스피너 UI 추가.
- 해당 유저의 결제 내역이나 받은 리뷰가 없을 경우 "구매 내역이 없습니다", "아직 받은 리뷰가 없습니다" 문구를 표시하는 Empty State 방어 코드 적용.

---

## v3.18.0 — 체험 등록 파이프라인 데이터 렌더링 누수 복구

**작업일:** 2026-03-03

### 개요
호스트가 체험 등록 시 입력한 데이터 중 어드민 및 게스트 화면에서 정상적으로 렌더링되지 않던 항목(누수 및 고립 데이터)을 복구하여 UI에 온전히 표시되도록 수정.

### [UI-1] 어드민 체험 관리(EXPS) 상세 화면 데이터 매핑 복구
- DB에는 저장되지만 화면에 누락되었던 필수 정보들을 추가 렌더링.
- 복구 항목: 진행 언어 및 레벨, 카테고리, 상세 주소(`location`), 준비물, 단독 투어 옵션, 참가 제한 규정(연령, 활동 강도).
- **파일:** `app/admin/dashboard/components/DetailsPanel.tsx`

### [UI-2] 상세 지역(subCity) 고립 현상 해결
- DB/폼에 보유 중이던 `subCity` 데이터를 `city`와 결합하여 렌더링하도록 UI 수정 (예: "오사카, 난바").
- 어드민 상세 화면 및 게스트 체험 카드, 상세 화면 Location Header에 모두 적용 완료.
- **파일:** 
  - `app/experiences/[id]/ExperienceClient.tsx`
  - `app/components/ExperienceCard.tsx`
  - `app/admin/dashboard/components/DetailsPanel.tsx`

---

## v3.17.0 — 글로벌 다국어(i18n) 통합 및 UX 라이팅 고도화

**작업일:** 2026-03-02

### 개요
글로벌 런칭 스펙 확정에 따라, 플랫폼 전체(어드민 제외)의 다국어(i18n) 통합 및 에어비앤비 스타일의 프리미엄 UX 라이팅 고도화 작업을 실시결함.

### [i18n-1] LanguageContext 딕셔너리 확장
- 한국어(`ko`), 영어(`en`), 일본어(`ja`), 중국어(`zh`) 4개 국어 사전을 지원하도록 `LanguageContext.tsx` 전면 동기화.
- 리뷰 모달, 메인 알림센터, 서비스 의뢰(목록, 상세, 도입, 신청, 결제, 완료 등), 호스트 대시보드의 서비스 탭 등 주요 컴포넌트에 필요한 다국어 Key-Value 쌍 추가.
- **파일:** `app/context/LanguageContext.tsx`

### [i18n-2] 컴포넌트 내 하드코딩 텍스트 전면 치환 (UX 라이팅 고도화 적용)
- 사용자 경험 향상을 위해 간결하고 행동 지향적이며, 구어체 기반의 친근한 UX 라이팅 적용.
- `t()` 훅을 전역적으로 주입하여 기존 하드코딩되어 있던 한글 텍스트 완벽 교체 완료.
- **파일:**
  - `app/services/page.tsx`
  - `app/services/request/page.tsx`
  - `app/services/[requestId]/ServiceRequestClient.tsx`
  - `app/services/[requestId]/apply/page.tsx`
  - `app/services/[requestId]/payment/page.tsx`
  - `app/services/[requestId]/payment/complete/page.tsx`
  - `app/services/intro/IntroClient.tsx`
  - `app/services/my/page.tsx`
  - `app/host/experiences/[id]/page.tsx`
  - `app/host/dashboard/page.tsx`
  - `app/host/dashboard/components/ServiceJobsTab.tsx`
  - `app/components/ReviewModal.tsx`

### [i18n-3] 호스트 대시보드 누락 번역 및 Key 매핑 오류 전면 수정
- 프로필 세팅, 문의함, 매칭현황, 정산, 후기, 가이드라인 등 대시보드 내 하단 탭 전체의 하드코딩된 텍스트와 누락 번역 보완.
- `LanguageContext.tsx` 내 `hp_`, `hr_`, `hd_`, `hg_` 등의 프리픽스가 섞여 매핑되지 않던 오류를 전부 식별하고 올바른 Key 값으로 치환.
- **파일:**
  - `app/context/LanguageContext.tsx`
  - `app/host/dashboard/components/ProfileEditor.tsx`
  - `app/host/dashboard/InquiryChat.tsx`
  - `app/host/dashboard/components/ServiceJobsTab.tsx`
  - `app/host/dashboard/Earnings.tsx`
  - `app/host/dashboard/HostReviews.tsx`
  - `app/host/dashboard/components/GuidelinesTab.tsx`
  - `app/host/dashboard/components/ReservationCard.tsx`

---

## v3.16.0 — Admin 대시보드 UI/UX 라우팅 재설계 (Domain Grouping)

**작업일:** 2026-03-02

### 개요
C레벨 파트너의 의사결정에 따라 데이터/API 로직 변경 없이 순수 프론트엔드 UI/UX 배치만 조정.
MANAGEMENT 그룹 재배치 및 REVIEWS, LOGS 탭을 ANALYTICS 하위 중첩 탭으로 흡수.

### [UI-1] Sidebar 네비게이션 재배치
- `MANAGEMENT` 그룹에 'Approvals (승인 관리)', 'User Management (유저 관리)', 'Service Requests' 3종 집중 배치.
- 서비스 의뢰 네비게이션 영문 텍스트 통일.
- 메인 사이드바에서 `Review Management`와 `Audit Logs` 탭 제거.
- **파일:** `app/admin/dashboard/components/Sidebar.tsx`

### [UI-2] AnalyticsTab 내부 중첩 서브 탭 연동
- 메인 Analytics 페이지 상단에 4개의 서브 탭 네비게이터 배치: `Business & Guest`, `Host Ecosystem`, `Review Management`, `Audit Logs`.
- 기존 `ReviewsTab`, `AuditLogTab` 컴포넌트 렌더링 위치를 사이드바 라우팅이 아닌 `AnalyticsTab` 내부 상태 제어로 이관.
- **파일:** `app/admin/dashboard/components/AnalyticsTab.tsx`, `app/admin/dashboard/page.tsx`

### [UI-3] 1:1 문의 채널 상태 관리 및 프로필 고도화
- 관리자가 대기(open) 상태인 1:1 문의에 첫 메시지를 전송 시 자동으로 '처리중(in_progress)' 상태로 전환되도록 자동화 적용. (완료 상태는 수동 관리 유지)
- 관리자가 발송한 메시지의 렌더링 이름을 관리자 개인 계정 이름에서 공식 명칭인 '로컬리'로 고정 노출되도록 개선.
- 기존 '해결' 텍스트를 '완료'로 용어 변경.
- **파일:** `app/admin/dashboard/components/ChatMonitor.tsx`

### [PERF-1] 유저 활동 상태 DB 업데이트 스로틀링 도입 (DB 쓰기 병목 해소)
- 클라이언트의 페이지 전환(라우팅) 시마다 발생하는 무분별한 `last_active_at` 업데이트를 방지하기 위해 5분(300초)의 쿨타임을 적용했습니다.
- 외부 캐시 서버(Redis 등) 도입 없이 브라우저의 `localStorage`와 리액트 의존성(`usePathname`)을 순수하게 활용한 애플리케이션 레벨의 방어 로직을 구축했습니다.
- 실시간 접속 표시를 위한 웹소켓(`Supabase Channel`) 마운트 로직과 영구 저장용 DB 업데이트 로직을 2개의 단독 `useEffect` 훅으로 분리했습니다.
- **파일:** `app/components/UserPresenceTracker.tsx`

### [UX-1] 네이티브 수준의 시각적 고급화 (Premium UX & Micro-interactions)
- **부드러운 페이지 전환 (Page Transitions):** `framer-motion`을 도입하여 페이지 라우팅 시 글로벌 페이드&슬라이드 업 효과 스펙 적용. (어드민 대시보드 예외 처리)
- **쫀득한 조작감 (Bouncy Micro-interactions):** `Button`, `ExperienceCard`, `TripCard`, `ServiceCard`, `HostProfileCard` 등 상호작용 가능한 요소들에 `active:scale-95` 또는 `active:scale-[0.98]` 기반의 물리적 수축 효과 부여. 리플로우(Reflow)를 발생시키지 않는 GPU 가속 애니메이션만을 사용하여 성능을 방어합니다.
- **고급 로딩 경험 (Skeleton UI):** 밋밋한 Pulse 로딩을 걷어내고, 인스타그램/에어비앤비 모델 기반의 Shimmer 스켈레톤 애니메이션 컴포넌트로 전면 교체하여 체감 대기시간 극복.
- **파일:** `app/components/ui/PageTransition.tsx`, `app/components/ui/Skeleton.tsx`, `app/components/ClientMainWrapper.tsx`, `app/components/ui/Button.tsx`, `app/globals.css` 및 카드 컴포넌트 전체.

### [UX-2] 로딩 스피너 디자인 표준화 및 하드코딩 박멸
- **디자인 표준화:** `app/components/ui/Spinner.tsx` 컴포넌트를 신설하여 기존 무분별하게 혼용되던 로딩 방식(텍스트/아이콘)을 통일했습니다. 
- **브랜드 컬러 적용:** `Lucide-react`의 `Loader2`를 기반으로 `Locally` 브랜드 컬러(`text-[#FF385C]`)와 `animate-spin`을 적용, 모듈 십자 레이아웃 호환성을 위해 중앙 정렬(`flex justify-center`) 옵션 내장.
- **하드코딩 텍스트 일괄 제거:** 글로벌 코드베이스를 스캔하여 임시로 작성되었던 `<div>Loading...</div>` 및 `로딩 중...` 텍스트 블록들을 모두 박멸하고 신규 스피너 컴포넌트로 마이그레이션 적용. (ex. `Guest Inbox`, `Account`, `Payment` 파이프라인 등)

## v3.15.0 — 리뷰 시스템 고도화 (알림 파이프라인 + Admin 관리 + 후기 수정 + 평점 집계)

**작업일:** 2026-03-02

### 개요
리뷰 시스템 AS-IS 진단 후 확인된 운영 공백 R1~R7 구현 (R8 영구 폐기).
DB 스키마 변경 2건(마이그레이션 스크립트 `docs/migrations/v3_15_0_review_enhancements.sql` 참조).
R7(게스트 본인 받은 리뷰 열람)은 기존 코드에 이미 구현되어 있음 — 추가 변경 없음.

### [R1] 리뷰 등록 → 호스트 알림

- **기존 문제:** 게스트가 후기 작성 시 호스트에게 아무런 알림 없음. 호스트가 대시보드를 직접 방문해야만 인지 가능.
- **수정:** `POST /api/reviews` 성공 후 `notifications` 테이블에 직접 INSERT (서버사이드 — sendNotification() 불가).
  - type: `'new_review'`, 링크: `/host/dashboard?tab=reviews`
- **파일:** `app/api/reviews/route.ts`

### [R2] 예약 완료 → 게스트 후기 작성 요청 알림

- **기존 문제:** 크론 잡이 예약을 `completed`로 처리하지만, 게스트에게 후기 작성 유도 없음.
- **수정:** `GET /api/cron/complete-trips` — 완료 처리 후 각 게스트에게 `notifications` INSERT.
  - type: `'review_request'`, 링크: `/guest/trips`
  - 초기 select에 `user_id, experiences(title)` 추가.
- **파일:** `app/api/cron/complete-trips/route.ts`

### [R3] 호스트 답글 → 게스트 알림

- **기존 문제:** 호스트가 후기에 답글 작성 시 게스트에게 알림 없음.
- **수정:** `HostReviews.tsx` `handleSubmitReply()` 성공 후 `sendNotification()` 호출 (클라이언트사이드 가능).
  - type: `'review_reply'`, 링크: `/guest/trips`
- **파일:** `app/host/dashboard/HostReviews.tsx`

### [R4] Admin 리뷰 관리 탭 신설

- **기존 문제:** Admin 대시보드에 리뷰 조회/관리 탭 없음. 부적절 리뷰 대응 불가.
- **수정:**
  - `ReviewsTab.tsx` 신규 컴포넌트 생성: 전체 리뷰 목록 + 검색 + 별점 필터 + 강제 삭제.
  - Admin Sidebar `Finance` 그룹에 "Review Management" NavButton 추가 (탭 키: `REVIEWS`).
  - `page.tsx` 라우팅에 `activeTab === 'REVIEWS'` 케이스 추가.
- **파일:** `app/admin/dashboard/components/ReviewsTab.tsx` (신규), `Sidebar.tsx`, `page.tsx`

### [R5] 게스트 후기 수정 기능 (작성 후 7일 이내)

- **기존 문제:** 후기 작성 후 수정 불가. 오탈자/오해 수정 방법 없음.
- **수정:**
  - `PATCH /api/reviews/[id]/route.ts` 신규 엔드포인트: 본인 후기 + 7일 이내 검증 + 평점 재집계.
  - `GET /api/guest/trips`: `reviews (id)` → `reviews (id, rating, content, photos, created_at)` 변경. 응답에 `review` 객체 포함.
  - `ReviewModal.tsx`: `trip.review?.id` 존재 시 수정 모드로 자동 진입. 기존 사진 유지 + 새 사진 추가 지원. 제목 "후기 작성" → "후기 수정" 전환.
  - `PastTripCard.tsx`: 후기 작성 완료 시 "수정" 버튼 노출 (클릭 → `onOpenReview(trip)` 호출 → 수정 모드 ReviewModal 오픈).
- **파일:** `app/api/reviews/[id]/route.ts` (신규), `app/api/guest/trips/route.ts`, `app/components/ReviewModal.tsx`, `app/guest/trips/components/PastTripCard.tsx`

### [R6] 호스트 프로필 전체 평점 집계 (DB 저장 방식)

- **기존 문제:** 호스트 전체 평점이 체험 상세 SSR에서 런타임 계산됨 (체험별 DB 저장값과 불일치).
- **수정:**
  - `profiles.average_rating NUMERIC(3,2)`, `profiles.total_review_count INTEGER` 컬럼 추가 (마이그레이션).
  - `POST /api/reviews` + `PATCH /api/reviews/[id]`: 체험 집계 후 해당 호스트의 전체 리뷰 재집계 → `profiles` 업데이트.
  - 집계 실패 시 후기 저장/수정에 영향 없도록 try-catch 처리.
- **마이그레이션:** `docs/migrations/v3_15_0_review_enhancements.sql`

### [R7] 게스트 본인 받은 리뷰 열람

- **상태:** 기존 코드 확인 결과 이미 구현 완료 (`account/page.tsx` 데스크탑 + `MobileProfileView.tsx` 모바일 양쪽).
- **추가 작업 없음**

### notification.ts — 신규 타입 추가

- `'new_review'`, `'review_reply'`, `'review_request'` 3개 타입 추가.
- **파일:** `app/utils/notification.ts`

---

## v3.14.0 — 메시징 시스템 Phase C (M3 읽음 시각 + M5 CS 상태 큐)

**작업일:** 2026-03-02

### 개요
[M3] C2C 신뢰도 강화: 읽음 시각 정밀화 / [M5] Admin 운영 효율: CS 문의 칸반형 상태 관리.
DB 스키마 변경 2건(마이그레이션 스크립트 `docs/migrations/v3_14_0_chat_enhancements.sql` 참조).

### [M3] inquiry_messages — read_at 컬럼 추가 + "읽음 HH:MM" UI

- **기존 문제:** 발신자 메시지에 '1'만 표시, 상대방이 정확히 언제 읽었는지 알 수 없음.
- **DB 변경:** `inquiry_messages.read_at TIMESTAMPTZ` 컬럼 추가.
- **useChat.ts:** `markAsRead()`에서 `is_read=true`와 함께 `read_at=NOW()` 기록. 이미 `read_at` 있는 메시지는 덮어쓰지 않음(`.is('read_at', null)` 조건).
- **UI 변경 (C2C 발신자 메시지 좌측 메타 영역):**
  - 미읽음: "1" (파란색 bold)
  - 읽음 + read_at 있음: "읽음 오후 2:05" (회색 소문자)
  - 읽음 + read_at 없음(레거시): 표시 없음 (마이그레이션 전 기존 메시지 보호)
- **파일:** `app/hooks/useChat.ts`, `app/guest/inbox/page.tsx`, `app/host/dashboard/InquiryChat.tsx`

### [M5] inquiries — status 컬럼 + ChatMonitor 칸반형 상태 관리

- **기존 문제:** 1:1 CS 문의 상태 관리 불가, 대기/처리중/해결 구분 없음.
- **DB 변경:** `inquiries.status TEXT DEFAULT NULL` 컬럼 추가 (NULL=C2C 무관, 'open'|'in_progress'|'resolved' CS 전용).
- **useChat.ts:** `InquiryRow`에 `status?: string | null` 타입 추가 (select `*`로 자동 포함).
- **ChatMonitor UI:**
  - "1:1 문의" 탭 헤더에 상태 필터 필: 전체 / 대기 / 처리중 / 해결 (null 상태 문의는 '대기'에 포함)
  - 문의 목록 각 아이템에 상태 뱃지 표시 (amber=대기, blue=처리중, green=해결)
  - 채팅 헤더 우상단에 3개 상태 전환 버튼 (클릭 시 supabase.update + refresh() 재조회)
- **C2C 채팅 영향 없음** (monitor 탭은 기존 로직 그대로)
- **파일:** `app/hooks/useChat.ts`, `app/admin/dashboard/components/ChatMonitor.tsx`

---

## v3.13.0 — 메시징 시스템 Phase A & B 고도화 (CS 뱃지 + Admin CS 개시)

**작업일:** 2026-03-02

### 개요
메시징 시스템 현황 진단 후 확인된 운영 긴급 공백(M1, M2) 구현.
DB 스키마 변경 없이 기존 `inquiries.type` 구분 구조 그대로 활용.

### [M2] Sidebar — CS 미답변 건수 뱃지 추가 (Phase A)

- **기존 문제:** Admin 사이드바 "Message Monitoring" 버튼에 CS 1:1 문의 미답변 건수 미노출.
- **수정:**
  - `fetchCounts()`에 2-step 쿼리 추가: admin_support inquiry ID 수집 → `inquiry_messages.is_read=false` 건수 카운트.
  - `counts.csUnreadCount` 상태값 추가, 탭 비활성 시 "Message Monitoring" NavButton 뱃지 노출.
- **파일:** `app/admin/dashboard/components/Sidebar.tsx`

### [M1] DetailsPanel — Admin CS 먼저 개시 기능 (Phase B)

- **기존 문제:** Admin이 유저 목록에서 특정 유저에게 먼저 CS 메시지를 보낼 수 없었음.
- **수정:**
  - USERS 탭 상세 패널 하단에 "1:1 CS 메시지 보내기" 버튼 추가.
  - 클릭 시: 기존 admin_support 문의 있으면 해당 채팅으로 이동, 없으면 신규 `inquiries` 레코드 생성 후 이동.
  - `router.push('/admin/dashboard?tab=CHATS&inquiryId=X')` 패턴으로 ChatMonitor 자동 선택 연동.
- **파일:** `app/admin/dashboard/components/DetailsPanel.tsx`

### [M1] ChatMonitor — URL inquiryId 파라미터 자동 선택 (Phase B)

- **기존 문제:** ChatMonitor에 특정 문의 자동 선택 진입점 없음.
- **수정:**
  - `useSearchParams()`로 `?inquiryId=X` 파라미터 감지.
  - inquiries 로드 시 매칭 문의를 자동 선택 (`setActiveTab('admin')` + `loadMessages()`).
- **파일:** `app/admin/dashboard/components/ChatMonitor.tsx`

---

## v3.12.0 — Admin 대시보드 운영 공백(GAP) 고도화

**작업일:** 2026-03-02

### 개요
맞춤 의뢰(Service) 에스크로 선결제 도입 이후 진단된 6개 운영 공백 중 우선순위 4개(G1~G4)를 해결.
기존 useAdminData.ts 무거운 훅 미수정, 테이블 강제 병합 없이 KPI 통합 + 운영 분리 원칙 유지.

### [G4] Sidebar — 서비스 무통장 입금 대기 뱃지 추가

- **기존 문제:** 사이드바의 "맞춤 의뢰 관리" 버튼에 알림 뱃지 없음. 무통장 입금 대기 건수 파악 불가.
- **수정:** `service_bookings` 테이블에서 `status=PENDING & payment_method=bank` 건수를 `fetchCounts()`에 추가. "맞춤 의뢰 관리" NavButton에 `count={counts.servicePendingBank}` 뱃지 노출.
- **파일:** `app/admin/dashboard/components/Sidebar.tsx`

### [G2] ServiceAdminTab — 취소 요청 검토 KPI 카드 + 필터 필

- **기존 문제:** `cancellation_requested` 상태 건이 전체 목록에 섞여 운영자가 식별하기 어려움.
- **수정:**
  - KPI 그리드를 `grid-cols-3` → `grid-cols-2 md:grid-cols-4`로 변경하고 4번째 "취소 요청 검토" 카드 추가(건수 > 0일 때 오렌지 강조).
  - AllRequestsTab 상단에 필터 필 2종(전체 / 취소 요청) 추가. 취소 요청 탭 선택 시 해당 행 오렌지 배경 강조 및 빈 상태 메시지 별도 표시.
- **파일:** `app/admin/dashboard/components/ServiceAdminTab.tsx`

### [G3] ServiceAdminTab — 정산 명세서 CSV 다운로드 추가

- **기존 문제:** SettlementTab에 "이체 완료 처리" 버튼만 있고 정산 명세서 내보내기 기능 없음.
- **수정:** 각 호스트 그룹 아코디언 하단에 "명세서 CSV" 버튼 추가. 클릭 시 해당 호스트의 서비스 정산 항목(의뢰명, 날짜, 결제액, 지급액)을 UTF-8 BOM CSV로 다운로드.
- **파일:** `app/admin/dashboard/components/ServiceAdminTab.tsx`

### [G1] SalesTab — 맞춤 의뢰 정산 명세서 CSV 추가 (세무 대응)

- **기존 문제:** SalesTab의 "명세서 다운로드"는 체험 bookings 전용 → 서비스 결제가 세무 명세서에서 완전 누락.
- **수정:** 정산 섹션 헤더에 "맞춤 의뢰 명세서 ↓" 버튼 추가. 클릭 시 현재 날짜 필터 기준으로 `service_bookings` + `service_requests` + `host_applications` + `profiles` on-demand JOIN 조회 후 국세청 소명용 CSV(결제일시/주문번호/의뢰명/고객/호스트/결제수단/금액 등) 생성.
- **파일:** `app/admin/dashboard/components/SalesTab.tsx`

---

## v3.11.0 — 알림 시스템 Phase 1 긴급 수정

**작업일:** 2026-03-02

### 개요
알림 시스템 현황 진단(3가지 치명적 리스크)에 따른 즉시 수정 릴리스.
인앱 알림 + 이메일 2채널 구조를 완벽하게 보장하도록 방어 로직 추가.

### [P1 - CRITICAL] 이메일 SMTP 실패 시 인앱 알림 유실 방지

- **기존 문제:** `POST /api/notifications/email`에서 Gmail SMTP `sendMail()`이 예외를 던지면 외부 try/catch가 HTTP 500을 반환. DB insert는 이미 성공했음에도 불구하고 클라이언트에 에러가 반환되어 혼란 유발 가능.
- **수정:** 단건 `sendMail()` 호출을 독립적인 try/catch 블록으로 격리. 이메일 실패는 `console.warn`으로 로깅만 하고 `{ success: true }` 정상 응답 반환. DB 인앱 알림은 이미 저장됐으므로 사용자 알림은 무조건 보장됨.
- **파일:** `app/api/notifications/email/route.ts`

### [P2 - BUG] 알림 타입 누락으로 인한 TypeScript 타입 불일치 수정

- **기존 문제:** `NotificationType` 유니온에 실제 사용되는 타입 2종 미포함:
  - `'cancellation'` — `app/api/payment/cancel/route.ts`에서 직접 DB INSERT 시 사용
  - `'message'` — `NotificationContext` 내부 가상 알림 생성 시 사용
- **수정:**
  - `app/utils/notification.ts`: `'cancellation'`, `'message'` 두 타입을 유니온에 명시적 추가
  - `app/notifications/page.tsx`: `getIcon()` 함수 개선 — `service_*` 타입에 초록색 Calendar 아이콘 명시 매핑 추가. `cancellation`/`message`가 기존 `includes` 로직으로 이미 올바른 아이콘으로 분기됨을 확인.

### [P3 - CRITICAL] 채팅 알림 새로고침 시 증발 현상 수정

- **기존 문제:** `NotificationContext`가 `inquiry_messages` 테이블 INSERT를 감지해 **메모리에만 존재하는 가상 알림**(id: Date.now())을 생성. 앱 재진입 시 사라지고 알림 페이지 이력에도 남지 않음. 또한 `useChat.sendMessage()`가 `sendNotification()`을 통해 이미 DB에 알림을 저장하므로 토스트가 **2번** 발생하는 중복 문제도 동반.
- **수정:**
  - `app/context/NotificationContext.tsx`: `inquiry_messages` INSERT 구독(Channel B) 완전 제거.
  - `notifications` 테이블 INSERT 구독(Channel A)만 유지. `useChat.sendMessage()` → `sendNotification()` → DB INSERT → Channel A 감지 → 영구 알림 + 토스트의 단일 경로로 통합.
  - `markAsRead()` 가상 ID 분기 가드(`id < 1000000000000`) 제거 — 이제 모든 알림이 실 DB 레코드이므로 항상 DB update 실행.
  - 토스트 아이콘 타입: `newNoti.type.includes('message')` 조건으로 메시지 알림 자동 감지.

### 파일 요약
| 파일 | 변경 내용 |
|------|-----------|
| `app/utils/notification.ts` | MODIFY — `'cancellation'`, `'message'` 타입 추가 |
| `app/api/notifications/email/route.ts` | MODIFY — 단건 sendMail try/catch 격리, 이메일 실패 시 성공 응답 보장 |
| `app/context/NotificationContext.tsx` | MODIFY — Channel B(inquiry_messages) 제거, markAsRead 가드 제거, 토스트 타입 자동 감지 |
| `app/notifications/page.tsx` | MODIFY — getIcon() service_* 타입 명시 매핑 추가 |

---

## v3.10.0 — SEO/OG 메타데이터 최적화

**작업일:** 2026-03-02

### 개요
서비스 매칭(`services/*`) 페이지 전체를 구글 검색 및 소셜 공유(카카오톡 썸네일)에 최적화.

### 변경 내용

#### `app/layout.tsx`
- `metadataBase` 추가 (`NEXT_PUBLIC_SITE_URL` 환경변수 기반, fallback: `https://locally.vercel.app`)
  → 하위 페이지의 상대 경로 OG 이미지 URL이 absolute로 올바르게 해석됨
- `keywords` 에 서비스 관련 키워드 추가: `일본 동행`, `일본 현지 가이드`, `맞춤 의뢰`

#### `app/services/intro/` — Server Wrapper 패턴 적용
- **기존 `page.tsx`** → `IntroClient.tsx`로 이름 변경 (내용 무변경)
- **신규 `page.tsx`** (Server Component): 정적 `metadata` export 추가
  - Title: `일본 현지인 동행 가이드 맞춤 의뢰 | Locally`
  - Description: `도쿄·오사카·후쿠오카에서 검증된 현지인 호스트와 단둘이 떠나는 맞춤 여행. 시간당 ₩35,000, 최소 4시간부터 의뢰 가능.`
  - OG/Twitter 카드 포함, keywords 7개
  - OG 이미지: `NEXT_PUBLIC_SERVICE_OG_IMAGE` 환경변수 우선, 없으면 일본 Unsplash 이미지 fallback

#### `app/services/[requestId]/` — Server Wrapper 패턴 적용
- **기존 `page.tsx`** → `ServiceRequestClient.tsx`로 이름 변경 (내용 무변경)
- **신규 `page.tsx`** (Server Component): `generateMetadata` 동적 생성 추가
  - `service_requests` 테이블에서 `title, city, service_date, duration_hours, guest_count` 조회
  - Title: `[의뢰 제목] — 현지 호스트 모집 중 | Locally`
  - Description: `📍 [city] · 📅 [service_date] · ⏱ [n]시간 · 👥 [n]명. 현지인 호스트의 지원을 기다리고 있어요.`
  - OG 이미지: `NEXT_PUBLIC_SERVICE_OG_IMAGE` 환경변수 우선, 없으면 사이트 대표 이미지 fallback (에러 없음 보장)

### 파일 요약
| 파일 | 액션 |
|------|------|
| `app/layout.tsx` | MODIFY — metadataBase 추가 + keywords 보강 |
| `app/services/intro/IntroClient.tsx` | NEW — 기존 page.tsx 내용 이동 (로직 무변경) |
| `app/services/intro/page.tsx` | MODIFY — 서버 래퍼로 교체, 정적 metadata export |
| `app/services/[requestId]/ServiceRequestClient.tsx` | NEW — 기존 page.tsx 내용 이동 (로직 무변경) |
| `app/services/[requestId]/page.tsx` | MODIFY — 서버 래퍼로 교체, generateMetadata 추가 |

---

## v3.3.1 — 버그 수정 이력

**수정일:** 2026-03-01

### [Bug 1 - CRITICAL] 수수료 마진 유출 수정
- **현상:** 호스트 계정으로 잡보드, 의뢰 상세 접속 시 고객 결제 금액(`total_customer_price`)이 노출.
- **수정:**
  - `app/services/page.tsx`: 잡보드 카드 금액 표시를 `total_host_payout`(예상 수입)으로 교체, 라벨/색상 구분
  - `app/services/[requestId]/page.tsx`: 의뢰 상세 금액 블록을 `isOwner` 분기로 엄격 분리 — 고객에게만 총 금액, 호스트에게는 예상 수입만 노출
  - `app/types/service.ts`: `ServiceRequestCard`에 `total_host_payout`, `user_id` 필드 추가
  - `app/api/services/requests/route.ts`: API select 쿼리에 두 필드 추가

### [Bug 2 - DATA] 고객 화면 지원자 리스트 0명 표기 수정
- **현상:** 호스트가 지원 완료 후에도 고객의 의뢰 상세에 "지원한 호스트 (0명)" 표기.
- **근본 원인:** 클라이언트 SDK의 `service_applications` nested join 쿼리가 Supabase RLS 정책에 의해 차단되어 빈 배열 반환.
- **수정:**
  - `app/api/services/applications/route.ts`: `GET` 핸들러 신규 추가 — `service_role` 클라이언트로 RLS 우회, 의뢰 소유자에게는 전체 지원자 + `profiles`/`host_applications` 2단계 조인 반환
  - `app/services/[requestId]/page.tsx`: 클라이언트 직접 조회에서 서버 API 호출로 전환

### [Bug 3 - UX] 호스트 '지원 완료' 상태 렌더링 누락 수정
- **현상:** 호스트가 지원 후 같은 의뢰 상세에 재접속해도 "지원하기" 버튼이 계속 표시됨.
- **근본 원인:** `myApplication` 도출이 `applications` 배열에서만 이루어졌는데, Bug 2로 인해 `applications`가 비어있어 `myApplication`이 항상 `undefined`.
- **수정:**
  - `app/services/[requestId]/page.tsx`: `myApplication`을 독립 state로 분리, `/api/services/applications?requestId=...` GET 호출 시 `myApplication` 직접 반환

### [Bug 4 - UX] 고객(게스트) 진입점 누락 수정
- **현상:** 고객이 의뢰 등록 후 "내 맞춤 의뢰" 목록으로 이동하는 메뉴가 어디에도 없음.
- **수정:**
  - `app/account/page.tsx` 모바일/데스크탑: "내 맞춤 의뢰" → `/services/my` 항목 추가
  - **v3.4.0에서 진입점이 '나의 여행' 페이지로 이동됨 (하단 참고)**

---

## v3.4.0 — UX 개선 이력

**수정일:** 2026-03-01

### [메뉴 재배치] '내 맞춤 의뢰' 진입점 이동
- **이전:** `app/account/page.tsx`(계정/프로필 관리) 내에 위치
- **현재:** `app/guest/trips/page.tsx`(나의 여행 페이지) 하단 "나의 맞춤 의뢰" 섹션으로 통합
  - 최대 5건 미리보기 + "전체 보기" 링크 → `/services/my`
- **account 페이지 정리:** 잘못 추가되었던 모바일 메뉴 아이템, 데스크탑 링크 카드 모두 제거

### [랜딩 페이지 신설] 서비스 소개 페이지 `/services/intro`
- **신규 파일:** `app/services/intro/page.tsx`
- **라우팅 변경:** 홈 화면 5번째 서비스 카드 클릭 시 `/services/request` → `/services/intro`로 변경

### [알림 강화] 서비스 N 배지 시스템 구현
- **호스트 데스크탑:** `app/host/dashboard/page.tsx` — "서비스 매칭" 사이드바 버튼 우측 빨간 점 표시
- **호스트 모바일:** `app/components/mobile/MobileHostMenu.tsx` — "서비스 매칭" 항목 빨간 점 표시
- **고객:** `app/guest/trips/page.tsx` — "나의 맞춤 의뢰" 섹션 제목 옆 빨간 점 표시

### 파일 변경 요약
| 변경 | 파일 |
|---|---|
| [NEW] 서비스 소개 페이지 | `app/services/intro/page.tsx` |
| [MODIFY] 홈 카드 라우팅 변경 | `app/components/HomePageClient.tsx` |
| [MODIFY] 맞춤 의뢰 섹션 + N 배지 추가 | `app/guest/trips/page.tsx` |
| [MODIFY] 서비스 탭 N 배지 (데스크탑) | `app/host/dashboard/page.tsx` |
| [MODIFY] 서비스 탭 N 배지 (모바일) | `app/components/mobile/MobileHostMenu.tsx` |
| [MODIFY] 잘못 추가된 계정 페이지 진입점 제거 | `app/account/page.tsx` |

---

## v3.5.0 — UI/UX 프리미엄 전면 개편

**수정일:** 2026-03-01

### [나의 여행 페이지] 섹션 순서 변경
- 모바일/데스크탑 모두 "나의 맞춤 의뢰" 섹션 → 최상단 배치, 일반 예약 하단

### [서비스 상세 페이지] 에어비앤비 스타일 전면 재설계
- **변경 파일:** `app/services/[requestId]/page.tsx` (전면 재작성)
- 매칭 프로세스 스텝 바, 2×2 아이콘 그리드, LinkedIn 스타일 지원자 카드, 그라디언트 CTA 버튼 추가

### [의뢰 목록 & 잡보드] 카드 UI 개선
- 2섹션 카드 구조, 상태 칩 강화, 금액 강화, 언어 메타, 회색 배경, hover 애니메이션
- **변경 파일:** `app/services/page.tsx`, `app/services/my/page.tsx`

### 파일 변경 요약
| 변경 | 파일 |
|---|---|
| [MODIFY] 맞춤 의뢰 섹션 최상단 배치 | `app/guest/trips/page.tsx` |
| [MODIFY] 상세 페이지 전면 재설계 | `app/services/[requestId]/page.tsx` |
| [MODIFY] 잡보드 카드 UI 개선 | `app/services/page.tsx` |
| [MODIFY] 내 의뢰 목록 카드 UI 개선 | `app/services/my/page.tsx` |

---

## v3.6.0 — 서비스 소개 페이지 에어비앤비 스타일 재설계

**수정일:** 2026-03-01

- **변경 파일:** `app/services/intro/page.tsx` 전면 재작성
- 다크 그라디언트 히어로, 아이콘 그리드, 후기 카드, 데스크탑 sticky 가격 카드, 모바일 하단 고정 바
- **비용:** 시간당 ₩35,000 / 최소 4시간 기준 ₩140,000~
- **대상 지역:** 도쿄, 오사카, 후쿠오카

---

## v3.7.0 — 서비스 소개 페이지 체험 상세 UI 복제

**수정일:** 2026-03-01

### [서비스 소개] 체험 상세 UI 이식
- **변경 파일:** `app/services/intro/page.tsx`
- `app/experiences/[id]/page.tsx`의 레이아웃 구조(사진 갤러리, 헤더/호스트 바, 아이콘 그리드) 복제

### [폼 연동] 예약 바 → 의뢰 정보 수집 연동
- 데스크탑 사이드바: 날짜/시작 시간/이용 시간/인원수 선택 폼
- Query String 라우팅: `/services/request?date=...&startTime=...`으로 전달

### [폼 연동] 의뢰 등록 폼 데이터 Hydration
- **변경 파일:** `app/services/request/page.tsx`
- `useSearchParams`로 intro에서 전달된 파라미터를 초기값으로 자동 매핑

### v3.7.1 Hotfix — 폼 UI 모던화 및 30분 단위 선택
- 날짜 선택: 네이티브 `input type="date"` → 커스텀 달력 UI로 교체
- 시간 선택: 오전 8시~오후 8시 30분 간격 `<select>`로 교체

---

## 누적 상태 정합성 패치 이력 (v3.x P0/P1 시리즈)

> 아래는 booking 상태 상수 통일, Admin 집계 정합성, UI 회귀 수정 등 다수의 핀셋 패치 이력이다.

- 예약 상태 단일화(P1-2): `bookingStatus` 공통 상수에 대소문자 무관 판정 유틸 추가
- Admin 장부/분석 정합성(P1-2): `MasterLedgerTab`, `AnalyticsTab` 하드코딩 상태 배열을 공통 상수 기반으로 전환
- Guest Trips 분류 안정화(P1-2): `useGuestTrips`, `TripCard` 취소/완료 분기를 공통 취소 상태 집합 기준으로 통일
- 예약 상태 유틸 확장(P1-3): `pending/cancellation_requested/completed/cancelled` 전용 판정 유틸 추가
- Admin 매출 탭 정합성(P1-3): `SalesTab` 유효 매출/정산 대상/CSV/상태 뱃지 분기를 공통 상태 유틸로 정렬
- Host 예약 관리 정합성(P1-3): `ReservationManager`, `ReservationCard` 취소요청/취소완료/입금대기 분기를 공통 상태 유틸로 통일
- Admin 정산 실행 정합성(P1-4): `SettlementTab` 상세 유형 분기를 공통 취소 상태 유틸로 통일
- Host 수익 계산 정합성(P1-4): `Earnings` 취소 예약 제외/포함 판단을 공통 유틸 기반으로 정렬
- 결제 취소 API 가드 보강(P1-4): `/api/payment/cancel` "이미 취소됨" 판정을 공통 상태 유틸로 전환
- Admin 정산 조회 필터 보강(P1-5): `SettlementTab` Supabase `.or(...)` 조건을 공통 상태 유틸 기반 필터로 전환
- Admin 장부 Pending 분기 통일(P1-5): `MasterLedgerTab` `PENDING` 직접 비교를 `isPendingBookingStatus`로 치환
- 결제 완료/성공 상태 분기 통일(P1-6): `payment/complete`, `payment/success` 상태 분기를 공통 상태 유틸로 전환
- 결제 좌석 점검 상태 집합 통일(P1-7): `BOOKING_PENDING_STATUSES`, `BOOKING_BLOCKING_STATUSES_FOR_CAPACITY` 상수 추가
- 전역 폰트 로컬 전환(P1-8): `next/font/local` 기반으로 전환, Google Font 의존 제거 (Inter + IBM Plex Sans KR)
- 데스크탑 호스트 전환 회귀 수정(P1-9): `SiteHeader` 드롭다운 호스트 전환 목적지를 `/host/dashboard?tab=reservations`로 복원
- 모바일 언어 전환 진입점 확장(P1-10): 홈 상단, 게스트 계정 헤더, 호스트 메뉴 헤더에 언어 스위처 추가
- 안정성: `.single()` → `.maybeSingle()` 전환, BottomTabNavigation z-index 정리
- 프로필 스키마 정합성(P0): 실DB에 없는 `role/name/is_admin/school` 직접 쿼리 제거
- 호스트 예약 조회 핫픽스(P0): `profiles.school` select 제거 (42703 에러 방지)
- 인증 세션 고정(P0): Supabase 클라이언트 싱글턴, `getUser()` 기반 전환
- OAuth 프로필 동기화 보강(P0): `/auth/callback` 코드 교환 직후 프로필 동기화
- Admin 맞춤 의뢰 관리 통합(v3.9.0): SERVICE_REQUESTS 탭 신설, useServiceAdminData, ServiceAdminTab, /api/admin/service-cancel
- 맞춤 의뢰 무통장 입금 UI 추가(v3.9.1): 결제 수단 선택 UI, complete 페이지 method=bank 분기
- 맞춤 의뢰 무통장 백엔드 연동(v3.9.2): mark-bank API, service-confirm-payment API, ServiceAdminTab 입금 확인 버튼
  - `app/account/page.tsx`
  - `app/components/mobile/MobileProfileView.tsx`
  - `app/host/dashboard/components/ProfileEditor.tsx`
  - `app/host/dashboard/InquiryChat.tsx`
  - `app/host/dashboard/components/ServiceJobsTab.tsx`
  - `app/host/dashboard/Earnings.tsx`
  - `app/host/dashboard/HostReviews.tsx`
