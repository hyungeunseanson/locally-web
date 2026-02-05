// 체험 등록에 사용되는 상수 및 설정값

export const MAJOR_CITIES = {
    Korea: ['서울', '부산', '제주', '인천', '경기', '강원', '경주', '전주', '여수', '기타'],
    Japan: ['도쿄', '오사카', '시즈오카', '교토', '후쿠오카', '삿포로', '오키나와', '나고야', '고베', '기타'],
  };
  
  export const CATEGORIES = [
    '맛집 탐방', '카페/디저트', '산책/힐링', '쇼핑', 
    '문화 체험', '액티비티', '나이트라이프'
  ];
  
  export const TOTAL_STEPS = 6;
  
  // 기본 폼 데이터 초기값
  export const INITIAL_FORM_DATA = {
    country: 'Korea', 
    city: '',      
    subCity: '',   
    title: '', 
    category: '', 
    duration: 3, 
    maxGuests: 4,
    description: '', 
    spots: '', 
    meetingPoint: '',
    photos: [] as string[], 
    price: 50000,
    
    // ✅ 신규 추가된 데이터 필드
    inclusions: [] as string[],
    exclusions: [] as string[],
    supplies: '',
    rules: {
      age_limit: '',
      activity_level: '보통',
      refund_policy: '표준 정책 (5일 전 무료 취소)'
    }
  };