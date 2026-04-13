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
    type: 'Update',
    title: '서비스 이용약관 개정 안내',
    dateLabel: 'Feb 10, 2026',
    content:
      '안녕하세요. Locally 팀입니다.\n\n투명한 서비스 운영을 위해 이용약관이 개정됩니다.\n주요 변경 사항은 위치기반 서비스 사업자 정보 현행화입니다.\n\n시행일: 2026년 2월 20일',
  },
  {
    id: 2,
    type: 'Event',
    title: '신규 지역 "부산" 오픈 및 런칭 프로모션',
    dateLabel: 'Jan 20, 2026',
    content:
      '부산 지역 서비스가 공식 오픈되었습니다.\n지금 부산의 로컬 호스트들을 만나보세요.\n\n오픈 기념으로 2월 한 달간 수수료 면제 혜택을 드립니다.',
  },
  {
    id: 3,
    type: 'Notice',
    title: '시스템 정기 점검 안내',
    dateLabel: 'Jan 05, 2026',
    content:
      '더 안정적인 서비스를 위해 서버 점검이 진행됩니다.\n새벽 시간대(02:00~04:00) 일시적인 접속 불안정이 발생할 수 있습니다.',
  },
];
