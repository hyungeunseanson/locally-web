export type CompanyNoticeType = 'Update' | 'Event' | 'Notice';

export type CompanyNotice = {
  id: number;
  type: CompanyNoticeType;
  title: string;
  dateLabel: string;
  content: string;
};

// 회사 공지는 이 파일 한 곳에서만 관리합니다.
//
// 가장 쉬운 사용법:
// 1) 새 공지는 배열 맨 위에 추가합니다.
// 2) dateLabel, title, content만 바꿔도 페이지에 바로 반영됩니다.
// 3) 정렬 기준은 별도 필드 없이 배열 순서 그대로입니다.
export const COMPANY_NOTICES: CompanyNotice[] = [
  {
    id: 1,
    type: 'Notice',
    title: 'Locally 웹사이트 오픈 안내',
    dateLabel: 'Apr 29, 2026',
    content:
      '안녕하세요. Locally 팀입니다.\n\nLocally 웹사이트가 새롭게 오픈했습니다.\n여행자와 현지 호스트가 더 안전하고 편하게 만날 수 있도록 검색, 예약, 메시지, 문의 흐름을 계속 다듬어가고 있습니다.\n\n이용 중 불편한 점이나 오류, 개선이 필요한 부분을 발견하시면 1:1 문의로 편하게 남겨주세요.\n보내주시는 의견은 서비스 안정화와 개선에 큰 도움이 됩니다.\n\n더 좋은 여행 경험을 만들기 위해 꾸준히 업데이트하겠습니다.\n감사합니다.',
  },
];
