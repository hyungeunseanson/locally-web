import type {
  ProxyCategory,
  ProxyComment,
  ProxyFormData,
  ProxyPaymentMethod,
  ProxyRequest,
  RestaurantServiceOption,
} from '@/app/types/proxy';
import type { HotelFormData } from '@/app/schemas/proxyRequestSchema';

export const PROXY_REQUEST_PRICE_KRW = 4500;

export const PROXY_BASE_PRICE_BY_CATEGORY: Record<ProxyCategory, number> = {
  RESTAURANT: 4500,
  HOTEL: 6000,
  TRANSPORT: 6000,
  GENERAL: 6000,
  LOST_AND_FOUND: 9000,
};

export const PROXY_RESTAURANT_SERVICE_OPTION_PRICES: Record<RestaurantServiceOption, number> = {
  STANDARD: 4500,
  ZERO_ONE_TWO_ZERO: 8000,
  KUITEI: 9000,
};

export const PROXY_LINKED_INQUIRY_REQUIRED_ERROR = '연결된 1:1 문의를 찾을 수 없습니다.';

const INTERNAL_PROXY_FORM_FIELDS = new Set(['payment_method', 'contact_name', 'contact_phone', 'service_fee_krw', 'linked_inquiry_id']);

const PROXY_FORM_LABELS: Record<string, string> = {
  restaurant_name: '식당 이름',
  google_map_url: '구글맵 링크',
  restaurant_phone: '식당 전화번호',
  target_date: '예약 희망 날짜',
  preferred_slot_primary: '예약 희망 일시 1지망',
  preferred_slot_secondary: '예약 희망 일시 2지망',
  preferred_slot_tertiary: '예약 희망 일시 3지망',
  preferred_time_primary: '예약 희망 시간 1지망',
  preferred_time_secondary: '예약 희망 시간 2지망',
  reservation_name: '예약자 성함',
  guest_number: '인원수',
  korean_contact: '한국 연락처',
  local_hotel_contact: '현지 호텔 이름 / 전화번호',
  request_notes: '요청사항',
  alternative_restaurant_mode: '대체 식당 진행',
  alternative_restaurant_notes: '대체 식당 요청 메모',
  notice_acknowledged: '유의사항 확인 여부',
  deposit_fee_checked: '예약금·취소료 여부 확인',
  property_name: '숙소 이름',
  property_phone: '숙소 전화번호',
  booking_platform: '예약한 사이트',
  reservation_number: '예약 번호',
  checkin_date: '체크인 날짜',
  checkout_date: '체크아웃 날짜',
  hotel_inquiry_type: '문의 유형',
  request_content: '요청 내용',
  desired_change: '변경 희망 내용',
  additional_notes: '기타 요청사항',
  fee_policy_checked: '취소료·변경 수수료 여부 확인',
  reservation_type: '예약 유형',
  service_area: '이용 지역',
  use_date: '이용 날짜',
  use_time: '이용 시간',
  departure_location: '출발 장소',
  arrival_location: '도착 장소',
  passenger_number: '인원수',
  baggage_count: '짐 개수',
  accommodation_reference: '숙소 이름 / 예약 번호',
  flight_number: '항공편명',
  business_name: '업장명',
  business_phone: '업장 전화번호',
  business_link: '업장 정보 링크',
  general_inquiry_type: '문의 유형',
  inquiry_content: '문의 내용',
  preferred_check_time: '희망 확인 날짜 또는 시간',
  location_name: '분실 장소(업장명)',
  location_phone: '업장 전화번호',
  lost_date: '분실 날짜',
  lost_time_window: '분실 시간대',
  item_type: '분실물 종류',
  item_description: '분실물 특징',
  last_seen_context: '마지막으로 확인한 장소 또는 상황',
  local_stay_name: '현지 체류 숙소명',
  restaurant_service_option: '전화 유형',
};

const PROXY_FORM_VALUE_LABELS: Record<string, Record<string, string>> = {
  deposit_fee_checked: {
    YES: '예',
    NO: '아니요',
    UNKNOWN: '확인불가',
  },
  fee_policy_checked: {
    YES: '예',
    NO: '아니요',
    UNKNOWN: '확인불가',
  },
  hotel_inquiry_type: {
    CHANGE: '변경',
    CANCEL: '취소',
    GENERAL: '일반 문의',
  },
  general_inquiry_type: {
    STOCK_CHECK: '재고 확인',
    BUSINESS_HOURS: '영업 여부 확인',
    RESERVATION_AVAILABILITY: '예약 가능 여부',
    OTHER: '기타 문의',
  },
  reservation_type: {
    TAXI: '택시',
    HOTEL_TAXI: '호텔 택시',
    SHUTTLE_BUS: '셔틀버스',
    OTHER: '기타 교통',
  },
  restaurant_service_option: {
    STANDARD: '일반 식당 예약',
    ZERO_ONE_TWO_ZERO: '0120/0570 번호',
    KUITEI: '쿠이테이',
  },
  alternative_restaurant_mode: {
    NONE: '원하지 않음',
    ALLOW_ONE_REPLACEMENT: '1회 대체 식당 진행 동의',
  },
};

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeProxyHotelDesiredChange(
  hotelInquiryType: HotelFormData['hotel_inquiry_type'],
  desiredChange: string | null | undefined
) {
  return hotelInquiryType === 'CHANGE' ? readString(desiredChange) : '';
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeProxyLinkedInquiryId(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function hasEmailProfile(
  profile: ProxyRequest['profiles'] | ProxyComment['profiles'] | null | undefined
): profile is { email?: string | null } {
  return Boolean(profile && typeof profile === 'object' && 'email' in profile);
}

export function getProxyCategoryLabel(category: ProxyCategory) {
  switch (category) {
    case 'RESTAURANT':
      return '식당 예약 문의';
    case 'HOTEL':
      return '호텔 · 료칸 · 숙소 문의';
    case 'TRANSPORT':
      return '택시 · 버스 · 교통 예약 문의';
    case 'GENERAL':
      return '재고 확인 · 업체 일반 문의';
    case 'LOST_AND_FOUND':
      return '분실물 문의';
    default:
      return '전화 예약 요청';
  }
}

export function getProxyPaymentMethod(
  formData: Record<string, unknown> | null | undefined
): ProxyPaymentMethod | null {
  const method = readString(formData?.payment_method);
  if (method === 'card' || method === 'bank') {
    return method;
  }

  return null;
}

export function getProxyPaymentStatusLabel(
  request: Pick<ProxyRequest, 'payment_channel' | 'payment_status' | 'form_data'>
) {
  switch (request.payment_status) {
    case 'COMPLETED':
      return '결제 완료';
    case 'FAILED':
      return '결제 취소';
    case 'REFUNDED':
      return '환불 완료';
    default:
      if (request.payment_channel === 'NAVER') {
        return '결제 확인 대기';
      }

      return getProxyPaymentMethod(request.form_data) === 'bank'
        ? '입금 대기'
        : '카드 결제 미완료';
  }
}

export function getProxyLinkedInquiryId(
  formData: Record<string, unknown> | null | undefined
): string | null {
  return normalizeProxyLinkedInquiryId(formData?.linked_inquiry_id);
}

export function getProxyLinkedInquiryIdFromRequest(
  request:
    | {
        linked_inquiry_id?: string | number | null;
        form_data?: Record<string, unknown> | null;
      }
    | null
    | undefined
) {
  return normalizeProxyLinkedInquiryId(request?.linked_inquiry_id) ?? getProxyLinkedInquiryId(request?.form_data);
}

export function getProxyRestaurantServiceOption(
  formData: Record<string, unknown> | null | undefined
): RestaurantServiceOption {
  const option = readString(formData?.restaurant_service_option);
  if (option === 'ZERO_ONE_TWO_ZERO' || option === 'KUITEI') {
    return option;
  }

  return 'STANDARD';
}

export function getProxyRequestFeeKrw(
  category: ProxyCategory,
  formData: Record<string, unknown> | null | undefined
) {
  const storedFee = readNumber(formData?.service_fee_krw);
  if (storedFee && storedFee > 0) {
    return storedFee;
  }

  if (category === 'RESTAURANT') {
    return PROXY_RESTAURANT_SERVICE_OPTION_PRICES[getProxyRestaurantServiceOption(formData)];
  }

  return PROXY_BASE_PRICE_BY_CATEGORY[category] ?? PROXY_REQUEST_PRICE_KRW;
}

export function getProxyRequestTitle(request: Pick<ProxyRequest, 'category' | 'form_data'>) {
  if (request.category === 'RESTAURANT') {
    return readString(request.form_data?.restaurant_name) || '식당 예약 요청';
  }

  if (request.category === 'HOTEL') {
    return readString(request.form_data?.property_name) || '숙소 문의 요청';
  }

  if (request.category === 'TRANSPORT') {
    const departure = readString(request.form_data?.departure_location);
    const arrival = readString(request.form_data?.arrival_location);
    if (departure && arrival) {
      return `${departure} → ${arrival}`;
    }
    return '교통 예약 요청';
  }

  if (request.category === 'GENERAL') {
    return readString(request.form_data?.business_name) || '업체 문의 요청';
  }

  if (request.category === 'LOST_AND_FOUND') {
    const location = readString(request.form_data?.location_name);
    const itemType = readString(request.form_data?.item_type);
    if (location && itemType) {
      return `${location} · ${itemType}`;
    }
    return location || itemType || '분실물 문의 요청';
  }

  return '전화 예약 요청';
}

export function getProxyFormDisplayEntries(formData: ProxyFormData | null | undefined) {
  return Object.entries(formData || {}).flatMap(([key, rawValue]) => {
    if (INTERNAL_PROXY_FORM_FIELDS.has(key)) {
      return [];
    }

    if (
      rawValue === null ||
      rawValue === undefined ||
      (typeof rawValue === 'string' && rawValue.trim() === '') ||
      rawValue === false
    ) {
      return [];
    }

    const label = PROXY_FORM_LABELS[key] || key.replace(/_/g, ' ');
    let value: string;

    if (typeof rawValue === 'boolean') {
      value = rawValue ? '예' : '아니요';
    } else if (typeof rawValue === 'number') {
      value = rawValue.toString();
    } else {
      const stringValue = String(rawValue);
      value = PROXY_FORM_VALUE_LABELS[key]?.[stringValue] || stringValue;
    }

    return [{ key, label, value }];
  });
}

export function buildProxyInquiryInitialMessage(request: {
  category: ProxyCategory;
  formData: ProxyFormData;
  paymentChannel: string;
  finalAmount: number;
  naverBuyerName?: string | null;
}) {
  const { category, formData, paymentChannel, finalAmount, naverBuyerName } = request;
  const title = getProxyRequestTitle({ category, form_data: formData } as Pick<ProxyRequest, 'category' | 'form_data'>);
  const entries = getProxyFormDisplayEntries(formData)
    .map((entry) => `- ${entry.label}: ${entry.value}`)
    .join('\n');

  const paymentSummary = paymentChannel === 'NAVER'
    ? `결제 채널: NAVER${naverBuyerName ? `\n- 네이버 구매자명: ${naverBuyerName}` : ''}`
    : `결제 채널: LOCALLY\n- 결제 수단: ${getProxyPaymentMethod(formData) === 'card' ? '카드' : '무통장 입금'}\n- 서비스 수수료: ₩${finalAmount.toLocaleString()}`;

  return [
    '전화 예약 요청이 접수되었습니다.',
    '',
    `카테고리: ${getProxyCategoryLabel(category)}`,
    `제목: ${title}`,
    paymentSummary,
    '',
    '[고객 입력 내용]',
    entries || '- 입력 내용 없음',
    '',
    '전화 진행 상황과 결과는 1:1 문의함에서 안내드립니다.',
  ].join('\n');
}

export function getProxyRequesterDisplayName(
  profile?: ProxyRequest['profiles'] | ProxyComment['profiles'] | null
) {
  if (profile?.full_name?.trim()) {
    return profile.full_name.trim();
  }

  if (hasEmailProfile(profile) && typeof profile.email === 'string' && profile.email.trim()) {
    return profile.email.trim().split('@')[0];
  }

  return '고객';
}
