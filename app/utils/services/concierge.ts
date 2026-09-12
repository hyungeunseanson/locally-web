import type {
  ServicePricingReason,
  ServicePricingTier,
  ServiceScheduleItemInput,
  ServiceType,
} from '@/app/types/service';

export const SERVICE_COUNTRY = 'Japan' as const;
export const SERVICE_STANDARD_CUSTOMER_HOURLY_RATE = 35_000;
export const SERVICE_PREMIUM_CUSTOMER_HOURLY_RATE = 55_000;
export const SERVICE_STANDARD_HOST_HOURLY_RATE = 20_000;
export const SERVICE_MIN_DAILY_HOURS = 3;
export const SERVICE_MAX_DAILY_HOURS = 24;
export const SERVICE_MAX_TOTAL_HOURS = 168;
export const SERVICE_MAX_GUESTS = 10;
export const SERVICE_MAX_SCHEDULE_ITEMS = 56;

export const SERVICE_LANGUAGE_OPTIONS = ['한국어', '일본어', '영어', '중국어'] as const;
export const SERVICE_JAPAN_CITY_SUGGESTIONS = [
  '도쿄', '오사카', '후쿠오카', '삿포로', '나고야', '요코하마',
  '교토', '고베', '히로시마', '센다이', '나하', '가나자와',
] as const;

export type ServicePricing = {
  tier: ServicePricingTier;
  reason: ServicePricingReason;
  hourlyRate: number;
  totalPrice: number;
};

export type ServiceScheduleValidation =
  | { success: true; schedule: ServiceScheduleItemInput[]; totalHours: number }
  | { success: false; error: string };

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HALF_HOUR_TIME_PATTERN = /^(?:[01]\d|2[0-3]):(?:00|30)$/;

type ServiceLabelLocale = 'ko' | 'en' | 'ja' | 'zh';

export function isServiceType(value: unknown): value is ServiceType {
  return value === 'general' || value === 'business';
}

export function calculateServicePricing(params: {
  serviceType: ServiceType;
  guestCount: number;
  totalHours: number;
}): ServicePricing {
  const isBusiness = params.serviceType === 'business';
  const isLargeGroup = params.guestCount >= 6;
  const tier: ServicePricingTier = isBusiness || isLargeGroup ? 'premium' : 'standard';
  const reason: ServicePricingReason = isBusiness
    ? (isLargeGroup ? 'business_and_group_6_plus' : 'business')
    : (isLargeGroup ? 'group_6_plus' : 'standard');
  const hourlyRate = tier === 'premium'
    ? SERVICE_PREMIUM_CUSTOMER_HOURLY_RATE
    : SERVICE_STANDARD_CUSTOMER_HOURLY_RATE;

  return { tier, reason, hourlyRate, totalPrice: hourlyRate * params.totalHours };
}

export function getServicePricingReasonLabel(
  reason: ServicePricingReason,
  locale: ServiceLabelLocale = 'ko'
): string {
  const labels: Record<ServiceLabelLocale, Record<ServicePricingReason, string>> = {
    ko: {
      standard: '일반 1~5인 요금',
      business: '비즈니스 통역 요금',
      group_6_plus: '6인 이상 그룹 요금',
      business_and_group_6_plus: '비즈니스 통역·6인 이상 그룹 요금',
    },
    en: {
      standard: 'General 1–5 guest rate',
      business: 'Business interpreting rate',
      group_6_plus: '6+ guest group rate',
      business_and_group_6_plus: 'Business · 6+ guest rate',
    },
    ja: {
      standard: '一般1～5名料金',
      business: 'ビジネス通訳料金',
      group_6_plus: '6名以上のグループ料金',
      business_and_group_6_plus: 'ビジネス・6名以上料金',
    },
    zh: {
      standard: '普通1–5人价格',
      business: '商务口译价格',
      group_6_plus: '6人以上团体价格',
      business_and_group_6_plus: '商务·6人以上价格',
    },
  };
  return labels[locale][reason];
}

export function getServiceTypeLabel(
  serviceType: ServiceType,
  locale: ServiceLabelLocale = 'ko'
): string {
  const labels: Record<ServiceLabelLocale, Record<ServiceType, string>> = {
    ko: { general: '일반 동행·생활 통역', business: '비즈니스 통역' },
    en: { general: 'Local companion & everyday interpreting', business: 'Business interpreting' },
    ja: { general: '一般同行・生活通訳', business: 'ビジネス通訳' },
    zh: { general: '普通陪同与生活口译', business: '商务口译' },
  };
  return labels[locale][serviceType];
}

export function validateServiceSchedule(
  value: unknown,
  options?: { today?: string }
): ServiceScheduleValidation {
  if (!Array.isArray(value) || value.length === 0 || value.length > SERVICE_MAX_SCHEDULE_ITEMS) {
    return { success: false, error: '일정은 1일 이상 56일 이하로 입력해주세요.' };
  }

  const today = options?.today || new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const normalized: ServiceScheduleItemInput[] = [];
  const dates = new Set<string>();

  for (const rawItem of value) {
    if (!rawItem || typeof rawItem !== 'object') {
      return { success: false, error: '일정 형식이 올바르지 않습니다.' };
    }
    const item = rawItem as Record<string, unknown>;
    const serviceDate = String(item.serviceDate || '').trim();
    const startTime = String(item.startTime || '').trim();
    const durationHours = Number(item.durationHours);

    if (!ISO_DATE_PATTERN.test(serviceDate) || serviceDate < today) {
      return { success: false, error: '일본 현지 기준 오늘 이후 날짜를 입력해주세요.' };
    }
    if (!HALF_HOUR_TIME_PATTERN.test(startTime)) {
      return { success: false, error: '시작 시각은 30분 단위로 입력해주세요.' };
    }
    if (!Number.isInteger(durationHours) || durationHours < 3 || durationHours > 24) {
      return { success: false, error: '날짜별 이용시간은 3~24시간의 정수로 입력해주세요.' };
    }
    if (dates.has(serviceDate)) {
      return { success: false, error: '하나의 날짜는 한 번만 추가할 수 있습니다.' };
    }
    dates.add(serviceDate);
    normalized.push({ serviceDate, startTime, durationHours });
  }

  normalized.sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));
  const totalHours = normalized.reduce((sum, item) => sum + item.durationHours, 0);
  if (totalHours > SERVICE_MAX_TOTAL_HOURS) {
    return { success: false, error: '총 이용시간은 168시간을 넘을 수 없습니다.' };
  }

  for (let index = 0; index < normalized.length - 1; index += 1) {
    const current = normalized[index];
    const next = normalized[index + 1];
    const currentStart = Date.parse(`${current.serviceDate}T${current.startTime}:00Z`);
    const currentEnd = currentStart + current.durationHours * 60 * 60 * 1_000;
    const nextStart = Date.parse(`${next.serviceDate}T${next.startTime}:00Z`);
    if (currentEnd > nextStart) {
      return { success: false, error: '이용 일정끼리 시간이 겹치지 않도록 입력해주세요.' };
    }
  }

  return { success: true, schedule: normalized, totalHours };
}

export function createServiceRequestTitle(params: {
  city: string;
  firstDate: string;
}) {
  return `${params.city} · ${params.firstDate}`;
}
