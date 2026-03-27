# 전역 팝업 띄우는 법

비개발자 기준으로는 **`app/config/siteAnnouncements.ts` 파일의 공지 1개를 켜고, 날짜와 문구만 바꾸면 됩니다.**

## 어디를 수정하나요?
- 파일: `app/config/siteAnnouncements.ts`

## 가장 자주 바꾸는 항목 5개
- `enabled`
  - `true`면 팝업이 뜹니다.
  - `false`면 팝업이 뜨지 않습니다.
- `id`
  - 공지의 고유 이름입니다.
  - **중요:** 이미 한 번 닫은 공지를 다시 보여주려면 `id`를 새 이름으로 바꿔야 합니다.
- `startAt`
  - 공지를 시작할 날짜/시간입니다.
- `endAt`
  - 공지를 끝낼 날짜/시간입니다.
- `body.ko`
  - 팝업 본문 문구입니다.

## 가장 쉬운 사용법
### 1. 팝업 켜기
- `enabled: false`를 `enabled: true`로 바꿉니다.

### 2. 기간 바꾸기
- `startAt`, `endAt`을 원하는 일정으로 수정합니다.
- 예:
```ts
startAt: '2026-03-20T00:00:00+09:00',
endAt: '2026-04-01T00:00:00+09:00',
```

### 3. 제목/본문 바꾸기
- `title.ko`
- `body.ko`
- 버튼 문구는 보통 그대로 둬도 됩니다.

예:
```ts
title: {
  ko: '결제 안내',
  en: 'Payment Notice',
  ja: '決済のお知らせ',
  zh: '支付通知',
},
body: {
  ko: '나이스페이 연결 전까지 2026년 4월 1일까지는 무통장 입금만 이용할 수 있습니다.',
  en: 'Until NicePay is connected, only bank transfer is available through April 1, 2026.',
  ja: 'NicePay 連携前のため、2026年4月1日までは銀行振込のみご利用いただけます。',
  zh: '在 NicePay 接入完成前，截至 2026 年 4 月 1 日仅支持银行转账。',
},
```

## 다시 띄우고 싶을 때
사용자가 한 번 닫은 팝업은 같은 브라우저에서 다시 안 뜹니다.

그래서 **공지 내용을 새로 띄우려면 `id`를 바꿔야 합니다.**

예:
- 기존: `bank-only-template-2026-04-01`
- 새 공지: `bank-only-extended-2026-04-15`

## 끄는 방법
아래 3가지 중 하나만 하면 됩니다.
- `enabled: false`로 바꾸기
- `endAt`을 지난 날짜로 바꾸기
- 공지 객체를 배열에서 제거하기

## 알아두면 좋은 점
- 이 팝업은 **전체 방문자**에게 뜹니다.
- `/admin`에서는 뜨지 않습니다.
- 한 번에 **가장 우선순위가 높은 공지 1개만** 뜹니다.
- `href: '/company/notices'`가 있으면 `공지 보기` 버튼이 같이 뜹니다.

## 실무용 체크리스트
- `enabled`를 `true`로 바꿨는지
- `startAt`, `endAt`이 맞는지
- `id`가 새 공지용으로 바뀌었는지
- `title.ko`, `body.ko`가 최신 문구인지
- 배포 요청이 함께 되었는지

## 가장 흔한 실수
- 문구만 바꾸고 `id`를 안 바꿔서, 이미 닫은 사용자에게 팝업이 다시 안 뜨는 경우
- `enabled: false`인 상태로 두는 경우
- 종료일(`endAt`)이 이미 지나 있는 경우

## 빠른 예시
```ts
{
  id: 'bank-only-2026-04-01',
  enabled: true,
  priority: 100,
  startAt: '2026-03-20T00:00:00+09:00',
  endAt: '2026-04-01T00:00:00+09:00',
  audience: 'all',
  excludePathPrefixes: ['/admin'],
  title: {
    ko: '결제 안내',
    en: 'Payment Notice',
    ja: '決済のお知らせ',
    zh: '支付通知',
  },
  body: {
    ko: '나이스페이 연결 전까지 2026년 4월 1일까지는 무통장 입금만 이용할 수 있습니다.',
    en: 'Until NicePay is connected, only bank transfer is available through April 1, 2026.',
    ja: 'NicePay 連携前のため、2026年4月1日までは銀行振込のみご利用いただけます。',
    zh: '在 NicePay 接入完成前，截至 2026 年 4 月 1 日仅支持银行转账。',
  },
  primaryLabel: {
    ko: '확인했어요',
    en: 'Got it',
    ja: '確認しました',
    zh: '我知道了',
  },
  secondaryLabel: {
    ko: '공지 보기',
    en: 'View notice',
    ja: 'お知らせを見る',
    zh: '查看公告',
  },
  href: '/company/notices',
  variant: 'warning',
}
```
