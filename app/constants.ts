export const CATEGORIES = [
  { id: 'all', label: 'city_all', icon: '🌏' },
  { id: 'tokyo', label: 'city_tokyo', icon: '🗼' },
  { id: 'osaka', label: 'city_osaka', icon: '🏯' },
  { id: 'fukuoka', label: 'city_fukuoka', icon: '🍜' },
  { id: 'sapporo', label: 'city_sapporo', icon: '☃️' },
  { id: 'nagoya', label: 'city_nagoya', icon: '🍣' },
  { id: 'seoul', label: 'city_seoul', icon: '🏙️' },
  { id: 'busan', label: 'city_busan', icon: '🚢' },
  { id: 'jeju', label: 'city_jeju', icon: '🏔️' },
];

export type HomeMobileCityShortcutId =
  | 'all'
  | 'tokyo'
  | 'osaka'
  | 'fukuoka'
  | 'seoul'
  | 'busan'
  | 'jeju';

export type HomeMobileCityShortcut = {
  id: HomeMobileCityShortcutId;
  label: 'city_all' | 'city_tokyo' | 'city_osaka' | 'city_fukuoka' | 'city_seoul' | 'city_busan' | 'city_jeju';
  cityValue?: '도쿄' | '오사카' | '후쿠오카' | '서울' | '부산' | '제주';
  visual: 'emoji' | 'special';
  emoji?: '🌏' | '🗼' | '🏯' | '🍜';
};

export const HOME_MOBILE_CITY_SHORTCUTS: HomeMobileCityShortcut[] = [
  { id: 'all', label: 'city_all', visual: 'emoji', emoji: '🌏' },
  { id: 'tokyo', label: 'city_tokyo', cityValue: '도쿄', visual: 'emoji', emoji: '🗼' },
  { id: 'osaka', label: 'city_osaka', cityValue: '오사카', visual: 'emoji', emoji: '🏯' },
  { id: 'fukuoka', label: 'city_fukuoka', cityValue: '후쿠오카', visual: 'emoji', emoji: '🍜' },
  { id: 'seoul', label: 'city_seoul', cityValue: '서울', visual: 'special' },
  { id: 'busan', label: 'city_busan', cityValue: '부산', visual: 'special' },
  { id: 'jeju', label: 'city_jeju', cityValue: '제주', visual: 'special' },
];

export const SERVICE_TYPES = [
  { id: 'experience', label: 'cat_exp', icon: '🎈' },
  { id: 'service', label: 'cat_service', icon: '🛎️' },
];
  
export const LOCALLY_SERVICES = [
    { id: 1, title: '일본 전화 예약 · 문의 대행', price: 4500, image: '/images/services/phone-reservation-fr2.jpg', desc: '식당·숙소·교통·재고 문의까지 일본 현지 전화로 대신 확인해드립니다.', href: '/proxy-bookings/new' },
    { id: 5, title: '현지인 동행/통역 맞춤 의뢰', price: 35000, image: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655', desc: '원하는 일정에 맞는 현지인 호스트를 직접 매칭받으세요.', href: '/services/intro' },
  ];
