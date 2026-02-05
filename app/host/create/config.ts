export const MAJOR_CITIES = {
    Korea: ['서울', '부산', '제주', '인천', '경기', '강원', '경주', '전주', '여수', '기타'],
    Japan: ['도쿄', '오사카', '시즈오카', '교토', '후쿠오카', '삿포로', '오키나와', '나고야', '고베', '기타'],
  };
  
  export const CATEGORIES = [
    '맛집 탐방', '카페/디저트', '산책/힐링', '쇼핑', 
    '문화 체험', '액티비티', '나이트라이프'
  ];
  
  // 단계: 1.지역/카테고리 -> 2.기본정보(제목/사진) -> 3.코스(동선) -> 4.상세(소개/제공) -> 5.규칙 -> 6.가격 -> 7.완료
  export const TOTAL_STEPS = 7;
  
  export const INITIAL_FORM_DATA = {
    country: 'Korea', 
    city: '',      
    subCity: '',   
    category: '', 
    title: '', 
    photos: [] as string[], 
    
    // ✅ 신규: 동선 (루트)
    itinerary: [
      { title: '만남', description: '', type: 'meet' } // 기본값
    ] as { title: string; description: string; type: 'meet'|'spot'|'end' }[],
  
    description: '', 
    
    // 제공 사항
    inclusions: [] as string[],
    exclusions: [] as string[],
    supplies: '',
    
    // 규칙 및 기본 정보
    duration: 3, 
    maxGuests: 4,
    meetingPoint: '', // itinerary의 첫 번째 항목과 동기화하거나 별도 관리
    rules: {
      age_limit: '',
      activity_level: '보통',
      refund_policy: '표준 정책 (5일 전 무료 취소)'
    },
    
    price: 50000,
  };