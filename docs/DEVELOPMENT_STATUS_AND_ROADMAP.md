# 로컬리(Locally) 개발 현황 및 로드맵

**작성일:** 2025-02-17  
**대상:** app 폴더 전수 검토 기반

---

## 1. 현재 개발 단계: **약 62%**

| 구간 | 내용 | 진행률 |
|------|------|--------|
| 인프라·공통 | Next.js, Supabase, Auth, 미들웨어, Provider, 레이아웃 | 95% |
| 게스트 플로우 | 메인·검색·체험 상세·결제·여행·위시리스트·메시지 | 75% |
| 호스트 플로우 | 체험 등록·일정 관리·대시보드·예약·채팅·정산 | 70% |
| 관리자 | 대시보드·승인·예약/매출/분석·채팅 모니터 | 65% |
| 부가·운영 | 회사 소개·고객지원·알림·다국어·SEO | 60% |
| 미구축·보완 | 로그인 전용 페이지·에러 페이지·지도·결제 통합·정산 자동화·데이터 연동 | 30% |

**종합:** 핵심 플로우(예약·결제·채팅·알림)는 구현되어 있으나, 로그인/에러 페이지·지도·결제 PG 완전 연동·정산 자동화·운영 도구가 남아 있어 **전체 완성도는 약 62%**로 추정합니다.

---

## 2. 앱 구조 요약 (학습 내용)

### 2.1 라우팅 구조

```
/                     메인 (히어로, 체험/서비스 탭, 카드 리스트)
/search               검색 (location, language, 날짜 필터, 지도 placeholder)
/experiences/[id]     체험 상세 (SSR + ExperienceClient)
/experiences/[id]/payment      결제 페이지 (날짜/시간/인원, PG 연동)
/experiences/[id]/payment/complete   결제 완료 (폭죽, 영수증)

/guest/trips          나의 여행 (API /api/guest/trips)
/guest/wishlists      위시리스트
/guest/inbox          메시지함 (useChat, inquiries/inquiry_messages)

/host/register        호스트 지원서 (8단계, host_applications)
/host/create          체험 등록 (7단계, config.ts 기준)
/host/dashboard       대시보드 (예약·체험·채팅·수익·리뷰·프로필)
/host/experiences/[id]         체험 관리 (삭제 등)
/host/experiences/[id]/edit    체험 수정
/host/experiences/[id]/dates  일정 관리 (experience_availability)

/admin/*              관리자 전용 (layout에서 role=admin 체크)
  /admin/dashboard    APPS/USERS/BOOKINGS/SALES/ANALYTICS/CHATS

/account              프로필·계정 (profiles)
/notifications        알림 목록
/help                 고객지원 (문의 → inquiries/inquiry_messages)
/about, /company/*    회사 소개·공지·채용 등 (정적/하드코딩)
/become-a-host        호스트 소개 랜딩
/payment/success     결제 성공 (orderId 쿼리, booking confirmed)
```

### 2.2 사용 중인 Supabase 리소스

**테이블**

- **experiences** — 체험 (title, description, price, host_id, status, photos, languages, duration, max_guests, meeting_point, itinerary, is_private_enabled, private_price, 다국어 필드 등)
- **profiles** — 유저 프로필 (full_name, email, avatar_url, phone, bio 등)
- **users** — (admin layout에서 role 조회, auth.users와 별도 관리 테이블로 추정)
- **bookings** — 예약 (order_id, experience_id, user_id, date, time, guests, amount, status: pending/confirmed/PAID/cancelled/completed, tid, contact_name 등)
- **reviews** — 후기 (experience_id, user_id, rating, content, 이미지 등)
- **notifications** — 알림 (user_id, type, title, message, link, is_read)
- **inquiries** — 문의방 (user_id, host_id, experience_id, type)
- **inquiry_messages** — 채팅 메시지 (inquiry_id, sender_id, content, is_read)
- **host_applications** — 호스트 지원 (user_id, status, name, phone, bank, languages 등)
- **wishlists** — 위시리스트 (user_id, experience_id)
- **experience_availability** — 체험별 가용 일정 (experience_id, date, start_time, is_booked)

**스토리지 버킷**

- **experiences** — 체험 사진
- **avatars** — 프로필 사진
- **images** — 리뷰/호스트 등 기타 이미지

**Realtime**

- notifications INSERT → 알림 토스트
- inquiry_messages INSERT → 새 메시지 토스트
- admin: presence, bookings INSERT

### 2.3 API 라우트

- `GET/POST /api/auth/callback` — OAuth 코드 교환, 리다이렉트 (실패 시 `/auth/auth-code-error`)
- `GET /api/guest/trips` — 로그인 유저 여행 목록 (bookings + completed 자동 업데이트)
- `POST /api/reviews` — 후기 작성 (booking 소유·기한 체크)
- `POST /api/payment/nicepay-callback` — PG 콜백 (bookings PAID, 알림·이메일)
- `POST /api/payment/cancel` — 결제 취소 (bookings 상태, 알림)
- `POST /api/notifications/email` — 알림 DB 저장 + 이메일 발송 (nodemailer)

### 2.4 주요 Context·Hook

- **LanguageContext** — ko/en/ja/zh, localStorage 유지, `t(key)`, `lang`
- **ToastContext** — 전역 토스트 (success/error)
- **NotificationContext** — 알림 목록, Realtime 구독, 토스트
- **useChat** — inquiries/inquiry_messages 조회·전송·Realtime
- **useWishlist** — 위시리스트 토글
- **useExperienceFilter** — 메인 체험 필터 (지역·카테고리·언어·날짜)
- **useGuestTrips** — /api/guest/trips 호출

### 2.5 결제 흐름

1. 체험 상세 → 날짜/시간/인원 선택 → `/experiences/[id]/payment`
2. 결제 페이지에서 booking INSERT (status pending) → PG 결제 요청 (NicePay 등)
3. PG 콜백 → `/api/payment/nicepay-callback` → booking PAID, 알림·이메일
4. 게스트는 `/experiences/[id]/payment/complete?orderId=...` 또는 `/payment/success?orderId=...` 로 이동
5. payment/success 또는 complete에서 booking confirmed 업데이트, 호스트 알림

---

## 3. 미구축·불완전한 부분

| 항목 | 현재 상태 | 필요한 작업 |
|------|-----------|-------------|
| **로그인 전용 페이지** | ~~미구축~~ **완료** | `/login` 페이지 추가됨 (LoginModal 재사용, returnUrl 지원, 이미 로그인 시 리다이렉트) |
| **인증 에러 페이지** | ~~미구축~~ **완료** | `/auth/auth-code-error` 페이지 추가됨 (에러 안내 + 다시 로그인/홈 버튼) |
| **검색 지도** | 검색 페이지에 "지도 뷰 준비 중" placeholder | Google Maps(또는 Kakao Map) 연동, 체험 마커 표시 |
| **결제 PG** | NicePay 콜백·취소 API 있음, 클라이언트 위젯/연동은 코드 상 다양 | 하나의 PG(Toss/NicePay)로 클라이언트~서버 플로우 통일 및 테스트 |
| **정산** | 관리자 SettlementTab에서 수동 확인 위주 | 정산 주기·자동 계산·출금 요청 상태 테이블·호스트 정산 대시 연동 |
| **회사/공지 데이터** | company, notices 등 하드코딩 | CMS 또는 Supabase 테이블(notices, pages)로 이전 후 CRUD |
| **다국어 DB 필드** | experiences에 title_en 등 있음, contentHelper 사용 | 모든 노출 텍스트에 대해 ko/en/ja/zh 필드 정의 및 입력·노출 일관화 |
| **sitemap** | 정적 URL만 포함 | experiences 동적 URL 추가 (generateStaticParams 또는 on-demand) |
| **이미지 버킷 통일** | experiences, avatars, images 혼용 | 정책 정리(경로·용도) 및 edit/upload 시 버킷명 통일 |

---

## 4. 데이터 연동 계획

### 4.1 이미 연동됨

- Supabase Auth (이메일/비밀번호, OAuth는 callback만 준비)
- Supabase DB: experiences, profiles, users, bookings, reviews, notifications, inquiries, inquiry_messages, host_applications, wishlists, experience_availability
- Supabase Storage: experiences, avatars, images
- Supabase Realtime: 알림, 채팅, (admin) presence·bookings
- 환경 변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, PG·이메일·Kakao Map 등

### 4.2 앞으로 연결할 데이터

| 대상 | 목적 | 방법 |
|------|------|------|
| **Google Maps API** (또는 Kakao Map) | 검색·체험 상세 지도, 마커 | env에 API 키, 검색/상세 페이지에 지도 컴포넌트 |
| **결제 PG** | 결제·환불 일원화 | Toss 또는 NicePay 중 하나로 클라이언트 SDK + 서버 검증·콜백 고정 |
| **이메일 템플릿** | 예약 확정·취소·호스트 알림 | nodemailer + HTML 템플릿 또는 Resend 등 서비스 |
| **공지/회사 소개** | 운영자가 수정 가능 | Supabase 테이블(notices, company_pages) 또는 헤드리스 CMS |
| **정산 데이터** | 호스트별 정산 주기·금액·상태 | settlements 테이블 설계, admin·host 대시와 연동 |

---

## 5. 앞으로 구축할 기능·작업 (우선순위)

### Phase 1 — 필수 보완 (1~2주)

1. **로그인/에러 페이지**
   - `/login`: 로그인 폼 또는 LoginModal 래퍼 페이지 (기존 모달 재사용 가능)
   - `/auth/auth-code-error`: OAuth 실패 시 안내 + 홈/재시도 링크

2. **결제 플로우 통일**
   - 한 PG로 클라이언트 결제 요청 → 서버 검증 → 콜백 처리까지 E2E 테스트
   - 결제 실패/타임아웃 시 booking 상태 정리 및 사용자 메시지

3. **체험 상세·카드 다국어**
   - ExperienceClient·ExperienceCard 등 `lang` 사용 일관화 (이미 수정됨)
   - 노출 필드별 ko/en/ja/zh 누락 여부 점검

### Phase 2 — 핵심 UX (2~3주)

4. **검색 지도**
   - Google Maps(또는 Kakao) 연동, 검색 결과 마커 표시, 클릭 시 리스트 연동

5. **정산 구조**
   - settlements(또는 host_settlements) 테이블 설계
   - admin: 기간별 정산 집계·상태 변경
   - host: 내 정산 요약·지급 예정일 노출

6. **공지/회사 페이지 데이터화**
   - notices, company_pages 등 테이블 추가
   - company/notices 등 페이지는 DB 조회로 전환

### Phase 3 — 운영·확장 (2~4주)

7. **sitemap 동적화**
   - `/experiences/[id]` URL sitemap에 포함 (빌드 시 또는 on-demand)

8. **이메일 템플릿**
   - 예약 확정/취소/호스트 알림용 HTML 템플릿 및 환경별 설정

9. **호스트 정산 상세**
   - 호스트 대시보드에 정산 내역·기간별 매출 차트

10. **관리자·운영 도구**
    - 대량 공지, 이용약관 버전 관리, 간단한 A/B 플래그 등 (필요 시)

---

## 6. 기술 부채·개선

- **Storage 버킷명**: edit/upload 시 `images` vs `experiences` 혼용 정리
- **결제 금액 검증**: nicepay-callback에서 금액 검증 제거된 상태 → 보안상 서버에서 PG 응답과 DB 금액 재검증 권장
- **admin console.log**: 배포 빌드에서 제거 또는 NODE_ENV 조건 처리
- **복사/백업 파일**: `page copy.txt`, `help/page copy.txt` 등 정리 또는 docs로 이동
- **타입**: `types/index.ts`에 Experience·Booking·Profile 정의됨. API·DB와 동기화 유지

---

## 7. 요약

- **현재 개발 단계: 약 62%**. 메인·검색·체험 상세·예약·결제·채팅·알림·호스트/관리자 대시는 구현되어 있음.
- **즉시 보완**: 로그인/에러 페이지, 결제 E2E, 다국어 `lang` 일관화(일부 반영됨).
- **단기**: 검색 지도, 정산 테이블·admin 연동, 공지/회사 DB화.
- **중기**: sitemap 동적화, 이메일 템플릿, 호스트 정산 상세, 운영 도구.

이 문서는 app 폴더 전수 검토와 `.cursorrules`·기능 목표를 바탕으로 작성되었으며, 필요에 따라 우선순위와 단계를 조정해 사용하시면 됩니다.
