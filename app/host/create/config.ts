import { LanguageLevelEntry } from '@/app/utils/languageLevels';

export const MAJOR_CITIES = {
  Korea: ['서울', '부산', '제주', '인천', '경기', '강원', '경주', '전주', '여수', '기타'],
  Japan: ['도쿄', '오사카', '시즈오카', '교토', '후쿠오카', '삿포로', '오키나와', '나고야', '고베', '기타'],
};

export const CATEGORIES = [
  '맛집 탐방',
  '카페/디저트',
  '산책/힐링',
  '쇼핑',
  '문화 체험',
  '액티비티',
  '나이트라이프',
  '건축',
  '공연/경기',
  '랜드마크',
  '원데이 클래스',
];

// ✅ 지원 언어 목록 추가
export const SUPPORTED_LANGUAGES = [
  '한국어', '영어', '일본어', '중국어'
];

export const MAX_EXPERIENCE_PHOTOS = 5;
export const FIXED_REFUND_POLICY = '표준 정책 (7일 전 무료 취소)';

export const TOTAL_STEPS = 8;

export const INITIAL_FORM_DATA = {
  country: 'Korea', 
  city: '',      
  subCity: '',   
  category: '', 
  
  languages: [] as string[],
  language_levels: [] as LanguageLevelEntry[],

  title: '', 
  photos: [] as string[], 
  location: '',
  
  itinerary: [
    { title: '만남', description: '', type: 'meet', image_url: '' }
  ] as { title: string; description: string; type: 'meet'|'spot'|'end'; image_url?: string }[],

  description: '', 
  
  inclusions: [] as string[],
  exclusions: [] as string[],
  supplies: '',
  
  duration: 3, 
  maxGuests: 4,
  meeting_point: '',
  rules: {
    age_limit: '',
    activity_level: '보통',
    refund_policy: FIXED_REFUND_POLICY
  },
  
  price: 50000,
};
