'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { AlertCircle, ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Clock3, Loader2, PhoneCall, X } from 'lucide-react';

import type {
  GeneralInquiryFormData,
  HotelFormData,
  LostAndFoundFormData,
  RestaurantFormData,
  TransportFormData,
} from '@/app/schemas/proxyRequestSchema';
import type { ProxyCategory, RestaurantServiceOption } from '@/app/types/proxy';
import { ProxyRequestValidationSchema } from '@/app/schemas/proxyRequestSchema';
import { createClient } from '@/app/utils/supabase/client';
import { launchCardPayment } from '@/app/utils/payments/card/client';
import {
  getProxyCategoryLabel,
  getProxyRequestFeeKrw,
  PROXY_REQUEST_PRICE_KRW,
  PROXY_RESTAURANT_SERVICE_OPTION_PRICES,
} from '@/app/utils/proxyBooking';

type PaymentMethod = 'card' | 'bank';
type PaymentChannel = 'NAVER' | 'LOCALLY';

type CardReadyResponse = {
  provider: 'portone' | 'nicepay';
  ready: boolean;
  reason?: string;
};

type CategoryOption = {
  id: ProxyCategory;
  label: string;
  description: string;
  priceLabel: string;
};

const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    id: 'RESTAURANT',
    label: '식당 예약 문의',
    description: '식당 예약, 예약 가능 여부, 일반 문의까지 한 번에 접수합니다.',
    priceLabel: '₩4,500~',
  },
  {
    id: 'HOTEL',
    label: '호텔 · 료칸 · 숙소 문의',
    description: '예약 변경, 취소, 일반 문의를 일본어로 대신 확인합니다.',
    priceLabel: '₩6,000',
  },
  {
    id: 'TRANSPORT',
    label: '택시 · 버스 · 교통 예약 문의',
    description: '택시, 호텔택시, 셔틀버스 등 교통 예약/문의 접수용입니다.',
    priceLabel: '₩6,000',
  },
  {
    id: 'GENERAL',
    label: '재고 확인 · 업체 일반 문의',
    description: '재고, 영업 여부, 예약 가능 여부 등 일반 확인 전화를 진행합니다.',
    priceLabel: '₩6,000',
  },
  {
    id: 'LOST_AND_FOUND',
    label: '분실물 문의',
    description: '분실물 접수, 확인 요청, 회수 가능 여부 문의를 대신 진행합니다.',
    priceLabel: '₩9,000',
  },
];

const SERVICE_HIGHLIGHTS = [
  '일본 현지인 팀원이 직접 일본어로 전화해 예약 가능 여부와 문의 내용을 대신 확인합니다.',
  '한국어 대응이 어려운 일본 업체에도 실제 일본 현지인 이름으로 연락해 신뢰도와 연결 성공률을 높입니다.',
  '식당, 숙소, 교통, 재고 확인, 분실물 문의까지 일본 전국 기준으로 접수할 수 있습니다.',
];

const SERVICE_SCOPE = [
  '식당 예약 및 예약 가능 여부 확인',
  '호텔 · 료칸 · 숙소 예약 변경 / 취소 / 일반 문의',
  '택시 · 호텔택시 · 셔틀버스 · 기타 교통 예약 문의',
  '재고 확인, 영업 여부 확인, 일반 문의',
  '분실물 접수 및 회수 가능 여부 확인',
];

const SERVICE_RULES = [
  '상대 업체가 전화를 받는 순간 1통으로 간주됩니다.',
  '영업시간 내 여러 차례 시도했더라도 연결 불가, 만석, 업장 사정에 따른 불가 건은 진행 완료로 처리될 수 있습니다.',
  '추가 통화나 복잡한 문제 해결이 필요한 건은 별도 문의가 필요할 수 있습니다.',
];

const SERVICE_EXCLUSIONS = [
  '예약금 · 취소료가 있는 식당의 취소 대행',
  '노쇼 이력이 있어 재예약이 불가한 식당',
  '오마카세, 미슐랭, 고급 코스 요리 선주문 식당 등 고위험 예약 건',
];

const SERVICE_NOTES = [
  '예약 희망일 기준 1~2달 전에 접수할수록 성공 가능성이 높습니다.',
  '가능한 예약 시간 폭을 넓게 적어주시면 한 번에 예약이 성사될 확률이 높습니다.',
  '업무 시간은 10:00~18:00 기준이며, 주말에는 응답이 지연될 수 있습니다.',
  '요청사항에 카카오톡 아이디 등 추가 연락 수단을 적어주시면 운영팀 확인 시 참고합니다.',
];

const DEFAULT_RESTAURANT_FORM: RestaurantFormData = {
  restaurant_name: '',
  google_map_url: '',
  restaurant_phone: '',
  preferred_slot_primary: '',
  preferred_slot_secondary: '',
  preferred_slot_tertiary: '',
  reservation_name: '',
  guest_number: 2,
  korean_contact: '',
  local_hotel_contact: '',
  request_notes: '',
  alternative_restaurant_mode: 'NONE',
  alternative_restaurant_notes: '',
  notice_acknowledged: false,
  deposit_fee_checked: 'UNKNOWN',
  restaurant_service_option: 'STANDARD',
};

const DEFAULT_HOTEL_FORM: HotelFormData = {
  property_name: '',
  property_phone: '',
  booking_platform: '',
  reservation_number: '',
  reservation_name: '',
  checkin_date: '',
  checkout_date: '',
  hotel_inquiry_type: 'GENERAL',
  request_content: '',
  desired_change: '',
  korean_contact: '',
  additional_notes: '',
  notice_acknowledged: false,
  fee_policy_checked: 'UNKNOWN',
};

const DEFAULT_TRANSPORT_FORM: TransportFormData = {
  reservation_type: 'TAXI',
  service_area: '',
  reservation_name: '',
  korean_contact: '',
  use_date: '',
  use_time: '',
  departure_location: '',
  arrival_location: '',
  passenger_number: 1,
  baggage_count: 0,
  accommodation_reference: '',
  flight_number: '',
  additional_notes: '',
  notice_acknowledged: false,
};

const DEFAULT_GENERAL_FORM: GeneralInquiryFormData = {
  business_name: '',
  business_phone: '',
  business_link: '',
  general_inquiry_type: 'STOCK_CHECK',
  inquiry_content: '',
  preferred_check_time: '',
  korean_contact: '',
  additional_notes: '',
  notice_acknowledged: false,
};

const DEFAULT_LOST_FORM: LostAndFoundFormData = {
  location_name: '',
  location_phone: '',
  lost_date: '',
  lost_time_window: '',
  item_type: '',
  item_description: '',
  last_seen_context: '',
  reservation_name: '',
  korean_contact: '',
  local_stay_name: '',
  additional_notes: '',
  notice_acknowledged: false,
};

function normalizeOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-[17px] font-bold tracking-tight text-slate-900 md:mb-4 md:text-xl">{children}</h2>;
}

function InputField({
  label,
  required,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; required?: boolean }) {
  return (
    <div className={className}>
      <label className="text-xs font-semibold text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <input
        {...props}
        required={required}
        className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
      />
    </div>
  );
}

const SLOT_TIME_OPTIONS = Array.from({ length: 33 }, (_, index) => {
  const totalMinutes = (10 * 60) + index * 30;
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
});

const SLOT_WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function parseSlotValue(value: string) {
  if (!value || !value.includes('T')) {
    return { date: '', time: '' };
  }

  const [date, time] = value.split('T');
  return {
    date: date || '',
    time: (time || '').slice(0, 5),
  };
}

function formatSlotDisplay(value: string) {
  const { date, time } = parseSlotValue(value);
  if (!date || !time) return '월일 시간을 선택해주세요';

  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) return '월일 시간을 선택해주세요';

  return `${parsed.getMonth() + 1}월 ${parsed.getDate()}일 (${SLOT_WEEKDAY_LABELS[parsed.getDay()]}) · ${time}`;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDateKey(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function getMonthDays(currentMonth: Date) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ type: 'empty' } | { type: 'day'; date: Date }> = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ type: 'empty' });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ type: 'day', date: new Date(year, month, day) });
  }

  return cells;
}

function DateTimeChoiceField({
  label,
  value,
  onChange,
  fieldId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  fieldId: string;
}) {
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const maxDate = useMemo(() => new Date(today.getFullYear(), today.getMonth() + 18, today.getDate()), [today]);
  const parsedValue = useMemo(() => parseSlotValue(value), [value]);
  const [isOpen, setIsOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(parsedValue.date);
  const [draftTime, setDraftTime] = useState(parsedValue.time);
  const [visibleMonth, setVisibleMonth] = useState(() => parseDateKey(parsedValue.date) || today);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const openPicker = () => {
    const nextDate = parsedValue.date || toDateKey(today);
    const nextMonth = parseDateKey(nextDate) || today;
    setDraftDate(nextDate);
    setDraftTime(parsedValue.time || '');
    setVisibleMonth(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1));
    setIsOpen(true);
  };

  const closePicker = () => {
    setIsOpen(false);
  };

  const confirmSelection = () => {
    if (!draftDate || !draftTime) return;
    onChange(`${draftDate}T${draftTime}`);
    closePicker();
  };

  const monthDays = getMonthDays(visibleMonth);
  const canGoPrev = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1) > new Date(today.getFullYear(), today.getMonth(), 1);
  const canGoNext = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1) <= new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  return (
    <>
      <div className="rounded-2xl border border-stone-200 bg-white p-3.5 shadow-sm sm:rounded-[1.5rem] sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <label className="text-xs font-semibold text-stone-600">
              {label}
              <span className="text-red-500"> *</span>
            </label>
            <p className="mt-1 text-[11px] leading-5 text-stone-400">원하는 날짜와 시간을 한 번에 골라주세요.</p>
          </div>
          <CalendarDays size={14} className="mt-0.5 shrink-0 text-stone-400" />
        </div>
        <button
          type="button"
          data-testid={`${fieldId}-trigger`}
          onClick={openPicker}
          className="mt-3 flex w-full items-center justify-between rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3.5 text-left transition hover:border-stone-300 hover:bg-white"
        >
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm font-semibold text-stone-900">{formatSlotDisplay(value)}</p>
              <p className="mt-1 text-xs leading-5 text-stone-500">{value ? '탭해서 다시 선택할 수 있습니다.' : '탭해서 날짜와 시간을 선택하세요.'}</p>
            </div>
          </div>
          <Clock3 size={16} className="shrink-0 text-stone-400" />
        </button>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-900/45 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="flex h-[82dvh] w-full min-h-0 flex-col overflow-hidden rounded-t-[28px] border border-stone-200 bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-[2rem]">
            <div className="border-b border-stone-200 bg-white/95 px-4 pt-3 backdrop-blur sm:px-5 sm:pt-5">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-stone-200 sm:hidden" />
              <div className="flex items-start justify-between gap-4 pb-4 sm:pb-5">
                <div>
                  <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] text-stone-400">
                    <CalendarDays size={12} />
                    RESERVATION SLOT
                  </p>
                  <h3 className="mt-2 text-base font-black tracking-tight text-stone-950 sm:text-lg">{label}</h3>
                  <p className="mt-1 text-sm leading-6 text-stone-500">원하는 날짜와 시간을 고르면 아래 필드에 바로 반영됩니다.</p>
                </div>
                <button
                  type="button"
                  aria-label={`${label} 닫기`}
                  onClick={closePicker}
                  className="rounded-full border border-stone-200 p-2 text-stone-500 transition hover:bg-stone-50"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="min-h-0 space-y-5 overflow-y-auto px-4 py-4 sm:space-y-6 sm:px-5 sm:py-5">
              <div className="rounded-[1.35rem] border border-stone-200 bg-stone-50/80 p-3.5 sm:rounded-[1.5rem] sm:p-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => canGoPrev && setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
                    disabled={!canGoPrev}
                    className="rounded-full border border-stone-200 bg-white p-2 text-stone-500 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <p className="text-sm font-bold text-stone-900">
                    {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
                  </p>
                  <button
                    type="button"
                    onClick={() => canGoNext && setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
                    disabled={!canGoNext}
                    className="rounded-full border border-stone-200 bg-white p-2 text-stone-500 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-stone-400 sm:mt-4 sm:gap-2">
                  {SLOT_WEEKDAY_LABELS.map((weekday) => (
                    <span key={weekday}>{weekday}</span>
                  ))}
                </div>

                <div className="mt-2.5 grid grid-cols-7 gap-1.5 sm:mt-3 sm:gap-2">
                  {monthDays.map((cell, index) => {
                    if (cell.type === 'empty') {
                      return <div key={`empty-${fieldId}-${index}`} className="h-9 rounded-full sm:h-10" />;
                    }

                    const dateKey = toDateKey(cell.date);
                    const isDisabled = cell.date < today || cell.date > maxDate;
                    const isSelected = draftDate === dateKey;

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        data-testid={`${fieldId}-day-${dateKey}`}
                        disabled={isDisabled}
                        onClick={() => setDraftDate(dateKey)}
                        className={`h-9 rounded-full text-sm font-semibold transition sm:h-10 ${
                          isSelected
                            ? 'bg-stone-900 text-white shadow-sm'
                            : isDisabled
                              ? 'cursor-not-allowed text-stone-300'
                              : 'border border-transparent text-stone-700 hover:border-stone-300 hover:bg-white'
                        }`}
                      >
                        {cell.date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-stone-600">시간 선택</p>
                <div className="mt-3 grid max-h-52 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:max-h-56 sm:grid-cols-5">
                  {SLOT_TIME_OPTIONS.map((time) => {
                    const isSelected = draftTime === time;
                    return (
                      <button
                        key={time}
                        type="button"
                        data-testid={`${fieldId}-time-${time}`}
                        onClick={() => setDraftTime(time)}
                        className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                          isSelected
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300 hover:bg-white'
                        }`}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              className="border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-5 sm:py-4"
              style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium leading-6 text-stone-500">
                  {draftDate && draftTime ? formatSlotDisplay(`${draftDate}T${draftTime}`) : '날짜와 시간을 모두 선택해주세요.'}
                </p>
                <button
                  type="button"
                  data-testid={`${fieldId}-confirm`}
                  disabled={!draftDate || !draftTime}
                  onClick={confirmSelection}
                  className="w-full rounded-full bg-stone-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300 sm:w-auto sm:min-w-[120px] sm:py-2.5"
                >
                  선택 완료
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SelectField({
  label,
  required,
  className = '',
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="text-xs font-semibold text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <select
        {...props}
        required={required}
        className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
      >
        {children}
      </select>
    </div>
  );
}

function TextareaField({
  label,
  required,
  className = '',
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; required?: boolean }) {
  return (
    <div className={className}>
      <label className="text-xs font-semibold text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <textarea
        {...props}
        required={required}
        className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
      />
    </div>
  );
}

export default function NewProxyBooking() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const portOneImpCode = process.env.NEXT_PUBLIC_PORTONE_IMP_CODE || '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ProxyCategory>('RESTAURANT');
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>('NAVER');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [naverBuyerName, setNaverBuyerName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [restaurantForm, setRestaurantForm] = useState<RestaurantFormData>(DEFAULT_RESTAURANT_FORM);
  const [hotelForm, setHotelForm] = useState<HotelFormData>(DEFAULT_HOTEL_FORM);
  const [transportForm, setTransportForm] = useState<TransportFormData>(DEFAULT_TRANSPORT_FORM);
  const [generalForm, setGeneralForm] = useState<GeneralInquiryFormData>(DEFAULT_GENERAL_FORM);
  const [lostForm, setLostForm] = useState<LostAndFoundFormData>(DEFAULT_LOST_FORM);

  const updateRestaurantField = <K extends keyof RestaurantFormData>(key: K, value: RestaurantFormData[K]) => {
    setRestaurantForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateHotelField = <K extends keyof HotelFormData>(key: K, value: HotelFormData[K]) => {
    setHotelForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateTransportField = <K extends keyof TransportFormData>(key: K, value: TransportFormData[K]) => {
    setTransportForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateGeneralField = <K extends keyof GeneralInquiryFormData>(
    key: K,
    value: GeneralInquiryFormData[K]
  ) => {
    setGeneralForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateLostField = <K extends keyof LostAndFoundFormData>(key: K, value: LostAndFoundFormData[K]) => {
    setLostForm((prev) => ({ ...prev, [key]: value }));
  };

  const categoryData = useMemo(() => {
    switch (category) {
      case 'RESTAURANT':
        return {
          category: 'RESTAURANT' as const,
          form_data: {
            restaurant_name: restaurantForm.restaurant_name.trim(),
            google_map_url: normalizeOptionalText(restaurantForm.google_map_url || ''),
            restaurant_phone: normalizeOptionalText(restaurantForm.restaurant_phone || ''),
            preferred_slot_primary: restaurantForm.preferred_slot_primary,
            preferred_slot_secondary: restaurantForm.preferred_slot_secondary,
            preferred_slot_tertiary: restaurantForm.preferred_slot_tertiary,
            reservation_name: restaurantForm.reservation_name.trim(),
            guest_number: Number(restaurantForm.guest_number),
            korean_contact: restaurantForm.korean_contact.trim(),
            local_hotel_contact: normalizeOptionalText(restaurantForm.local_hotel_contact || ''),
            request_notes: normalizeOptionalText(restaurantForm.request_notes || ''),
            alternative_restaurant_mode: restaurantForm.alternative_restaurant_mode,
            alternative_restaurant_notes: normalizeOptionalText(restaurantForm.alternative_restaurant_notes || ''),
            notice_acknowledged: restaurantForm.notice_acknowledged,
            deposit_fee_checked: restaurantForm.deposit_fee_checked,
            restaurant_service_option: restaurantForm.restaurant_service_option,
          },
        };
      case 'HOTEL':
        return {
          category: 'HOTEL' as const,
          form_data: {
            property_name: hotelForm.property_name.trim(),
            property_phone: normalizeOptionalText(hotelForm.property_phone || ''),
            booking_platform: normalizeOptionalText(hotelForm.booking_platform || ''),
            reservation_number: normalizeOptionalText(hotelForm.reservation_number || ''),
            reservation_name: hotelForm.reservation_name.trim(),
            checkin_date: hotelForm.checkin_date,
            checkout_date: hotelForm.checkout_date,
            hotel_inquiry_type: hotelForm.hotel_inquiry_type,
            request_content: hotelForm.request_content.trim(),
            desired_change: normalizeOptionalText(hotelForm.desired_change || ''),
            korean_contact: hotelForm.korean_contact.trim(),
            additional_notes: normalizeOptionalText(hotelForm.additional_notes || ''),
            notice_acknowledged: hotelForm.notice_acknowledged,
            fee_policy_checked: hotelForm.fee_policy_checked,
          },
        };
      case 'TRANSPORT':
        return {
          category: 'TRANSPORT' as const,
          form_data: {
            reservation_type: transportForm.reservation_type,
            service_area: transportForm.service_area.trim(),
            reservation_name: transportForm.reservation_name.trim(),
            korean_contact: transportForm.korean_contact.trim(),
            use_date: transportForm.use_date,
            use_time: transportForm.use_time,
            departure_location: transportForm.departure_location.trim(),
            arrival_location: transportForm.arrival_location.trim(),
            passenger_number: Number(transportForm.passenger_number),
            baggage_count: Number(transportForm.baggage_count || 0),
            accommodation_reference: normalizeOptionalText(transportForm.accommodation_reference || ''),
            flight_number: normalizeOptionalText(transportForm.flight_number || ''),
            additional_notes: normalizeOptionalText(transportForm.additional_notes || ''),
            notice_acknowledged: transportForm.notice_acknowledged,
          },
        };
      case 'GENERAL':
        return {
          category: 'GENERAL' as const,
          form_data: {
            business_name: generalForm.business_name.trim(),
            business_phone: normalizeOptionalText(generalForm.business_phone || ''),
            business_link: normalizeOptionalText(generalForm.business_link || ''),
            general_inquiry_type: generalForm.general_inquiry_type,
            inquiry_content: generalForm.inquiry_content.trim(),
            preferred_check_time: normalizeOptionalText(generalForm.preferred_check_time || ''),
            korean_contact: generalForm.korean_contact.trim(),
            additional_notes: normalizeOptionalText(generalForm.additional_notes || ''),
            notice_acknowledged: generalForm.notice_acknowledged,
          },
        };
      case 'LOST_AND_FOUND':
      default:
        return {
          category: 'LOST_AND_FOUND' as const,
          form_data: {
            location_name: lostForm.location_name.trim(),
            location_phone: normalizeOptionalText(lostForm.location_phone || ''),
            lost_date: lostForm.lost_date,
            lost_time_window: lostForm.lost_time_window.trim(),
            item_type: lostForm.item_type.trim(),
            item_description: lostForm.item_description.trim(),
            last_seen_context: lostForm.last_seen_context.trim(),
            reservation_name: lostForm.reservation_name.trim(),
            korean_contact: lostForm.korean_contact.trim(),
            local_stay_name: normalizeOptionalText(lostForm.local_stay_name || ''),
            additional_notes: normalizeOptionalText(lostForm.additional_notes || ''),
            notice_acknowledged: lostForm.notice_acknowledged,
          },
        };
    }
  }, [category, generalForm, hotelForm, lostForm, restaurantForm, transportForm]);

  const currentServiceFee = useMemo(
    () => getProxyRequestFeeKrw(categoryData.category, categoryData.form_data),
    [categoryData]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const requiresLocallyPayment = paymentChannel === 'LOCALLY';
    const payload = {
      agreed_to_terms: agreedToTerms,
      payment_channel: paymentChannel,
      ...(paymentChannel === 'NAVER' ? { naver_buyer_name: naverBuyerName.trim() } : {}),
      ...(requiresLocallyPayment
        ? {
            payment_method: paymentMethod,
            contact_name: contactName.trim(),
            contact_phone: contactPhone.trim(),
          }
        : {}),
      category_data: categoryData,
    };

    const validation = ProxyRequestValidationSchema.safeParse(payload);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      setError(firstError?.message || '입력값을 다시 확인해주세요.');
      setLoading(false);
      return;
    }

    let readiness: CardReadyResponse | null = null;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      if (requiresLocallyPayment && paymentMethod === 'card') {
        const readinessRes = await fetch('/api/payment/card-ready', { cache: 'no-store' });
        readiness = (await readinessRes.json()) as CardReadyResponse;

        if (!readinessRes.ok || !readiness?.ready || !portOneImpCode) {
          setError('카드 결제를 지금 사용할 수 없습니다. 무통장 입금을 이용해주세요.');
          setLoading(false);
          return;
        }
      }

      const response = await fetch('/api/proxy-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
      });

      const result = await response.json();
      if (!response.ok || result.success === false) {
        throw new Error(result.error || '전화 예약 요청 생성에 실패했습니다.');
      }

      const requestId = String(result.requestId || '').trim();
      const inquiryRedirectUrl = String(result.redirectUrl || '').trim();
      const locallyOrderId = String(result.locallyOrderId || '').trim();
      const finalAmount = Number(result.finalAmount || currentServiceFee || PROXY_REQUEST_PRICE_KRW);

      if (!requestId) {
        throw new Error('전화 예약 요청 생성에 실패했습니다.');
      }

      if (!requiresLocallyPayment || paymentMethod === 'bank') {
        router.push(inquiryRedirectUrl || `/guest/inbox`);
        return;
      }

      if (!locallyOrderId) {
        router.push(inquiryRedirectUrl || `/guest/inbox`);
        return;
      }

      try {
        const paymentSession = await launchCardPayment({
          provider: readiness?.provider || 'portone',
          merchantCode: portOneImpCode,
          orderId: locallyOrderId,
          productName: `Locally ${getProxyCategoryLabel(category)}`,
          amount: finalAmount,
          buyerEmail: user.email,
          buyerName: contactName.trim(),
          buyerTel: contactPhone.trim(),
          redirectUrl: inquiryRedirectUrl ? `${window.location.origin}${inquiryRedirectUrl}` : `${window.location.origin}/guest/inbox`,
        });

        const callbackRes = await fetch('/api/proxy-bookings/payment/nicepay-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imp_uid: paymentSession.approvalId,
            approvalId: paymentSession.approvalId,
            merchant_uid: locallyOrderId,
            orderId: locallyOrderId,
          }),
        });

        const callbackResult = await callbackRes.json();
        if (!callbackRes.ok || !callbackResult?.success) {
          router.push(inquiryRedirectUrl || `/guest/inbox`);
          return;
        }

        router.push(inquiryRedirectUrl || `/guest/inbox`);
      } catch (paymentError) {
        console.error('[proxy-bookings/new] card payment failed:', paymentError);
        router.push(inquiryRedirectUrl || `/guest/inbox`);
      }
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : '전화 예약 요청 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const renderCategoryFields = () => {
    switch (category) {
      case 'RESTAURANT':
        return (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-600">
                전화 유형
                <span className="ml-2 text-[11px] font-medium text-slate-400">
                  0120 / 0570 번호는 ₩{PROXY_RESTAURANT_SERVICE_OPTION_PRICES.ZERO_ONE_TWO_ZERO.toLocaleString()}, 쿠이테이는 ₩{PROXY_RESTAURANT_SERVICE_OPTION_PRICES.KUITEI.toLocaleString()}
                </span>
              </label>
              <select
                value={restaurantForm.restaurant_service_option}
                onChange={(event) => updateRestaurantField('restaurant_service_option', event.target.value as RestaurantServiceOption)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              >
                <option value="STANDARD">일반 식당 예약 · 문의 (₩{PROXY_RESTAURANT_SERVICE_OPTION_PRICES.STANDARD.toLocaleString()})</option>
                <option value="ZERO_ONE_TWO_ZERO">0120 / 0570 번호 (₩{PROXY_RESTAURANT_SERVICE_OPTION_PRICES.ZERO_ONE_TWO_ZERO.toLocaleString()})</option>
                <option value="KUITEI">쿠이테이 (₩{PROXY_RESTAURANT_SERVICE_OPTION_PRICES.KUITEI.toLocaleString()})</option>
              </select>
            </div>
            <InputField
              label="식당 이름"
              required
              placeholder="예: 스시 지로"
              value={restaurantForm.restaurant_name}
              onChange={(event) => updateRestaurantField('restaurant_name', event.target.value)}
              className="md:col-span-2"
            />
            <InputField
              label="구글맵 링크"
              placeholder="https://maps.google.com/..."
              value={restaurantForm.google_map_url || ''}
              onChange={(event) => updateRestaurantField('google_map_url', event.target.value)}
            />
            <InputField
              label="식당 전화번호"
              placeholder="예: 03-1234-5678"
              value={restaurantForm.restaurant_phone || ''}
              onChange={(event) => updateRestaurantField('restaurant_phone', event.target.value)}
            />
            <div className="md:col-span-2 grid gap-3 md:grid-cols-3">
              <DateTimeChoiceField
                label="예약 희망 일시 1지망"
                value={restaurantForm.preferred_slot_primary}
                onChange={(value) => updateRestaurantField('preferred_slot_primary', value)}
                fieldId="preferred-slot-primary"
              />
              <DateTimeChoiceField
                label="예약 희망 일시 2지망"
                value={restaurantForm.preferred_slot_secondary}
                onChange={(value) => updateRestaurantField('preferred_slot_secondary', value)}
                fieldId="preferred-slot-secondary"
              />
              <DateTimeChoiceField
                label="예약 희망 일시 3지망"
                value={restaurantForm.preferred_slot_tertiary}
                onChange={(value) => updateRestaurantField('preferred_slot_tertiary', value)}
                fieldId="preferred-slot-tertiary"
              />
            </div>
            <InputField
              label="예약자 성함"
              required
              placeholder="예: 홍길동"
              value={restaurantForm.reservation_name}
              onChange={(event) => updateRestaurantField('reservation_name', event.target.value)}
            />
            <InputField
              label="인원수"
              required
              type="number"
              min={1}
              value={restaurantForm.guest_number}
              onChange={(event) => updateRestaurantField('guest_number', Number(event.target.value))}
            />
            <InputField
              label="한국 연락처"
              required
              type="tel"
              placeholder="예: 01012345678"
              value={restaurantForm.korean_contact}
              onChange={(event) => updateRestaurantField('korean_contact', event.target.value)}
            />
            <InputField
              label="현지 호텔 이름 / 전화번호"
              placeholder="예: 호텔명 / 전화번호"
              value={restaurantForm.local_hotel_contact || ''}
              onChange={(event) => updateRestaurantField('local_hotel_contact', event.target.value)}
            />
            <TextareaField
              label="요청사항"
              rows={4}
              className="md:col-span-2"
              placeholder="메모가 필요하면 카카오톡 아이디, 알레르기, 좌석 요청 등을 적어주세요."
              value={restaurantForm.request_notes || ''}
              onChange={(event) => updateRestaurantField('request_notes', event.target.value)}
            />
            <SelectField
              label="대체 식당 진행"
              className="md:col-span-2"
              value={restaurantForm.alternative_restaurant_mode}
              onChange={(event) =>
                updateRestaurantField(
                  'alternative_restaurant_mode',
                  event.target.value as RestaurantFormData['alternative_restaurant_mode']
                )
              }
            >
              <option value="NONE">원하지 않음</option>
              <option value="ALLOW_ONE_REPLACEMENT">1회 대체 식당 진행 동의</option>
            </SelectField>
            {restaurantForm.alternative_restaurant_mode === 'ALLOW_ONE_REPLACEMENT' ? (
              <TextareaField
                label="대체 식당 요청 메모"
                rows={3}
                className="md:col-span-2"
                placeholder="예: 같은 지역, 비슷한 가격대, 스시 우선 등 대체 식당 조건을 적어주세요."
                value={restaurantForm.alternative_restaurant_notes || ''}
                onChange={(event) => updateRestaurantField('alternative_restaurant_notes', event.target.value)}
              />
            ) : null}
            <SelectField
              label="예약금 · 취소료 여부 확인"
              className="md:col-span-2"
              value={restaurantForm.deposit_fee_checked}
              onChange={(event) => updateRestaurantField('deposit_fee_checked', event.target.value as RestaurantFormData['deposit_fee_checked'])}
            >
              <option value="YES">예</option>
              <option value="NO">아니요</option>
              <option value="UNKNOWN">확인불가</option>
            </SelectField>
            <label className="md:col-span-2 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={restaurantForm.notice_acknowledged}
                onChange={(event) => updateRestaurantField('notice_acknowledged', event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-black focus:ring-black"
              />
              <span>유의사항을 확인했고, 예약 가능 여부와 업장 사정에 따라 진행이 제한될 수 있음을 이해했습니다.</span>
            </label>
          </div>
        );
      case 'HOTEL':
        return (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InputField
              label="숙소 이름"
              required
              className="md:col-span-2"
              placeholder="예: 하얏트 리젠시 도쿄"
              value={hotelForm.property_name}
              onChange={(event) => updateHotelField('property_name', event.target.value)}
            />
            <InputField
              label="숙소 전화번호"
              value={hotelForm.property_phone || ''}
              onChange={(event) => updateHotelField('property_phone', event.target.value)}
            />
            <InputField
              label="예약한 사이트"
              placeholder="예: Agoda, Booking.com"
              value={hotelForm.booking_platform || ''}
              onChange={(event) => updateHotelField('booking_platform', event.target.value)}
            />
            <InputField
              label="예약 번호"
              value={hotelForm.reservation_number || ''}
              onChange={(event) => updateHotelField('reservation_number', event.target.value)}
            />
            <InputField
              label="예약자 성함"
              required
              value={hotelForm.reservation_name}
              onChange={(event) => updateHotelField('reservation_name', event.target.value)}
            />
            <SelectField
              label="문의 유형"
              required
              value={hotelForm.hotel_inquiry_type}
              onChange={(event) => updateHotelField('hotel_inquiry_type', event.target.value as HotelFormData['hotel_inquiry_type'])}
            >
              <option value="CHANGE">변경</option>
              <option value="CANCEL">취소</option>
              <option value="GENERAL">일반 문의</option>
            </SelectField>
            <InputField
              label="체크인 날짜"
              required
              type="date"
              value={hotelForm.checkin_date}
              onChange={(event) => updateHotelField('checkin_date', event.target.value)}
            />
            <InputField
              label="체크아웃 날짜"
              required
              type="date"
              value={hotelForm.checkout_date}
              onChange={(event) => updateHotelField('checkout_date', event.target.value)}
            />
            <InputField
              label="한국 연락처"
              required
              type="tel"
              value={hotelForm.korean_contact}
              onChange={(event) => updateHotelField('korean_contact', event.target.value)}
            />
            <TextareaField
              label="요청 내용"
              required
              rows={4}
              className="md:col-span-2"
              value={hotelForm.request_content}
              onChange={(event) => updateHotelField('request_content', event.target.value)}
            />
            <TextareaField
              label="변경 희망 내용"
              rows={3}
              className="md:col-span-2"
              value={hotelForm.desired_change || ''}
              onChange={(event) => updateHotelField('desired_change', event.target.value)}
            />
            <TextareaField
              label="기타 요청사항"
              rows={3}
              className="md:col-span-2"
              value={hotelForm.additional_notes || ''}
              onChange={(event) => updateHotelField('additional_notes', event.target.value)}
            />
            <SelectField
              label="취소료 · 변경 수수료 여부 확인"
              className="md:col-span-2"
              value={hotelForm.fee_policy_checked}
              onChange={(event) => updateHotelField('fee_policy_checked', event.target.value as HotelFormData['fee_policy_checked'])}
            >
              <option value="YES">예</option>
              <option value="NO">아니요</option>
              <option value="UNKNOWN">확인불가</option>
            </SelectField>
            <label className="md:col-span-2 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={hotelForm.notice_acknowledged}
                onChange={(event) => updateHotelField('notice_acknowledged', event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-black focus:ring-black"
              />
              <span>유의사항을 확인했고, 숙소 정책과 수수료 규정에 따라 결과가 달라질 수 있음을 이해했습니다.</span>
            </label>
          </div>
        );
      case 'TRANSPORT':
        return (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField
              label="예약 유형"
              required
              value={transportForm.reservation_type}
              onChange={(event) => updateTransportField('reservation_type', event.target.value as TransportFormData['reservation_type'])}
              className="md:col-span-2"
            >
              <option value="TAXI">택시</option>
              <option value="HOTEL_TAXI">호텔 택시</option>
              <option value="SHUTTLE_BUS">셔틀버스</option>
              <option value="OTHER">기타 교통</option>
            </SelectField>
            <InputField
              label="이용 지역"
              required
              value={transportForm.service_area}
              onChange={(event) => updateTransportField('service_area', event.target.value)}
            />
            <InputField
              label="예약자 성함"
              required
              value={transportForm.reservation_name}
              onChange={(event) => updateTransportField('reservation_name', event.target.value)}
            />
            <InputField
              label="한국 연락처"
              required
              type="tel"
              value={transportForm.korean_contact}
              onChange={(event) => updateTransportField('korean_contact', event.target.value)}
            />
            <InputField
              label="이용 날짜"
              required
              type="date"
              value={transportForm.use_date}
              onChange={(event) => updateTransportField('use_date', event.target.value)}
            />
            <InputField
              label="이용 시간"
              required
              type="time"
              value={transportForm.use_time}
              onChange={(event) => updateTransportField('use_time', event.target.value)}
            />
            <InputField
              label="출발 장소"
              required
              value={transportForm.departure_location}
              onChange={(event) => updateTransportField('departure_location', event.target.value)}
            />
            <InputField
              label="도착 장소"
              required
              value={transportForm.arrival_location}
              onChange={(event) => updateTransportField('arrival_location', event.target.value)}
            />
            <InputField
              label="인원수"
              required
              type="number"
              min={1}
              value={transportForm.passenger_number}
              onChange={(event) => updateTransportField('passenger_number', Number(event.target.value))}
            />
            <InputField
              label="짐 개수"
              type="number"
              min={0}
              value={transportForm.baggage_count || 0}
              onChange={(event) => updateTransportField('baggage_count', Number(event.target.value))}
            />
            <InputField
              label="숙소 이름 / 예약 번호"
              className="md:col-span-2"
              value={transportForm.accommodation_reference || ''}
              onChange={(event) => updateTransportField('accommodation_reference', event.target.value)}
            />
            <InputField
              label="항공편명"
              value={transportForm.flight_number || ''}
              onChange={(event) => updateTransportField('flight_number', event.target.value)}
            />
            <TextareaField
              label="기타 요청사항"
              rows={4}
              className="md:col-span-2"
              value={transportForm.additional_notes || ''}
              onChange={(event) => updateTransportField('additional_notes', event.target.value)}
            />
            <label className="md:col-span-2 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={transportForm.notice_acknowledged}
                onChange={(event) => updateTransportField('notice_acknowledged', event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-black focus:ring-black"
              />
              <span>유의사항을 확인했고, 교통사 및 현지 운영 상황에 따라 예약 가능 여부가 달라질 수 있음을 이해했습니다.</span>
            </label>
          </div>
        );
      case 'GENERAL':
        return (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InputField
              label="업장명"
              required
              className="md:col-span-2"
              value={generalForm.business_name}
              onChange={(event) => updateGeneralField('business_name', event.target.value)}
            />
            <InputField
              label="업장 전화번호"
              value={generalForm.business_phone || ''}
              onChange={(event) => updateGeneralField('business_phone', event.target.value)}
            />
            <InputField
              label="업장 정보 링크"
              value={generalForm.business_link || ''}
              onChange={(event) => updateGeneralField('business_link', event.target.value)}
            />
            <SelectField
              label="문의 유형"
              required
              value={generalForm.general_inquiry_type}
              onChange={(event) => updateGeneralField('general_inquiry_type', event.target.value as GeneralInquiryFormData['general_inquiry_type'])}
            >
              <option value="STOCK_CHECK">재고 확인</option>
              <option value="BUSINESS_HOURS">영업 여부 확인</option>
              <option value="RESERVATION_AVAILABILITY">예약 가능 여부</option>
              <option value="OTHER">기타 문의</option>
            </SelectField>
            <InputField
              label="희망 확인 날짜 또는 시간"
              value={generalForm.preferred_check_time || ''}
              onChange={(event) => updateGeneralField('preferred_check_time', event.target.value)}
            />
            <InputField
              label="한국 연락처"
              required
              type="tel"
              className="md:col-span-2"
              value={generalForm.korean_contact}
              onChange={(event) => updateGeneralField('korean_contact', event.target.value)}
            />
            <TextareaField
              label="문의 내용"
              required
              rows={4}
              className="md:col-span-2"
              value={generalForm.inquiry_content}
              onChange={(event) => updateGeneralField('inquiry_content', event.target.value)}
            />
            <TextareaField
              label="기타 요청사항"
              rows={3}
              className="md:col-span-2"
              value={generalForm.additional_notes || ''}
              onChange={(event) => updateGeneralField('additional_notes', event.target.value)}
            />
            <label className="md:col-span-2 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={generalForm.notice_acknowledged}
                onChange={(event) => updateGeneralField('notice_acknowledged', event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-black focus:ring-black"
              />
              <span>유의사항을 확인했고, 업체 상황에 따라 확인 결과가 달라질 수 있음을 이해했습니다.</span>
            </label>
          </div>
        );
      case 'LOST_AND_FOUND':
      default:
        return (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InputField
              label="분실 장소(업장명)"
              required
              className="md:col-span-2"
              value={lostForm.location_name}
              onChange={(event) => updateLostField('location_name', event.target.value)}
            />
            <InputField
              label="업장 전화번호"
              value={lostForm.location_phone || ''}
              onChange={(event) => updateLostField('location_phone', event.target.value)}
            />
            <InputField
              label="예약자 성함"
              required
              value={lostForm.reservation_name}
              onChange={(event) => updateLostField('reservation_name', event.target.value)}
            />
            <InputField
              label="분실 날짜"
              required
              type="date"
              value={lostForm.lost_date}
              onChange={(event) => updateLostField('lost_date', event.target.value)}
            />
            <InputField
              label="분실 시간대"
              required
              placeholder="예: 18:00~19:00"
              value={lostForm.lost_time_window}
              onChange={(event) => updateLostField('lost_time_window', event.target.value)}
            />
            <InputField
              label="분실물 종류"
              required
              value={lostForm.item_type}
              onChange={(event) => updateLostField('item_type', event.target.value)}
            />
            <InputField
              label="한국 연락처"
              required
              type="tel"
              value={lostForm.korean_contact}
              onChange={(event) => updateLostField('korean_contact', event.target.value)}
            />
            <InputField
              label="현지 체류 숙소명"
              className="md:col-span-2"
              value={lostForm.local_stay_name || ''}
              onChange={(event) => updateLostField('local_stay_name', event.target.value)}
            />
            <TextareaField
              label="분실물 특징"
              required
              rows={3}
              className="md:col-span-2"
              value={lostForm.item_description}
              onChange={(event) => updateLostField('item_description', event.target.value)}
            />
            <TextareaField
              label="마지막으로 확인한 장소 또는 상황"
              required
              rows={4}
              className="md:col-span-2"
              value={lostForm.last_seen_context}
              onChange={(event) => updateLostField('last_seen_context', event.target.value)}
            />
            <TextareaField
              label="기타 요청사항"
              rows={3}
              className="md:col-span-2"
              value={lostForm.additional_notes || ''}
              onChange={(event) => updateLostField('additional_notes', event.target.value)}
            />
            <label className="md:col-span-2 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={lostForm.notice_acknowledged}
                onChange={(event) => updateLostField('notice_acknowledged', event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-black focus:ring-black"
              />
              <span>유의사항을 확인했고, 회수 가능 여부는 업장 응답과 현지 상황에 따라 달라질 수 있음을 이해했습니다.</span>
            </label>
          </div>
        );
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-5 sm:py-8">
      <Script src="https://cdn.iamport.kr/v1/iamport.js" strategy="afterInteractive" />

      <button
        onClick={() => router.back()}
        className="mb-5 flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900 sm:mb-6"
      >
        <ArrowLeft size={16} /> 돌아가기
      </button>

      <div className="mb-6 space-y-4 sm:mb-8 sm:space-y-6">
        <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-[linear-gradient(135deg,#f7f2eb_0%,#ffffff_45%,#f5f7fb_100%)] shadow-sm">
          <div className="p-5 sm:p-6 md:p-8">
            <div className="max-w-none">
              <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] text-stone-500 sm:text-xs">
                <PhoneCall size={13} className="shrink-0" />
                PHONE RESERVATION SUPPORT
              </p>
              <h1 className="mt-3 text-[28px] font-black leading-[1.12] tracking-tight text-stone-950 sm:text-[34px] md:text-4xl">
                  일본인이 대신 전화 예약을 도와드립니다
              </h1>
              <p className="mt-4 max-w-none text-[15px] leading-7 text-stone-700 md:max-w-3xl md:text-base">
                일본의 일부 식당과 업체는 지금도 전화로만 예약이나 변경, 문의를 받습니다. 로컬리에서는 일본 현지인 팀원이 직접 일본어로 전화를 걸어 예약 가능 여부부터 변경, 취소, 재고 확인, 분실물 문의까지 대신 진행합니다. 예약이 확정되거나 확인이 끝나면 상세 페이지 답글과 알림으로 안내드리고, 남겨주신 연락처를 기준으로 운영팀이 후속 조율을 이어갑니다.
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICE_HIGHLIGHTS.map((item) => (
                <div key={item} className="rounded-2xl border border-stone-200 bg-white/85 px-4 py-4 text-[14px] leading-6 text-stone-700 shadow-sm">
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[26px] border border-stone-200 bg-white/80 p-4 shadow-sm sm:p-5 md:p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-sm font-bold text-stone-500">리뷰 확인은</p>
                  <p className="mt-2 text-xl font-black tracking-tight text-stone-950 md:text-2xl">🔖 locally-travel.com</p>
                  <p className="mt-3 max-w-2xl text-[14px] leading-6 text-stone-600 sm:text-sm">
                    일본 현지 업체와 실제로 통화하는 주체가 누구인지가 응답률과 신뢰도에 직접 영향을 줍니다. 로컬리는 일본 현지인 팀원이 직접 전화해 보다 자연스럽고 신뢰도 높은 예약 진행을 돕습니다.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
                  <div className="rounded-2xl bg-stone-100 px-4 py-4 text-center">
                    <p className="text-lg font-black text-stone-900">한국인 ❌</p>
                    <p className="mt-2 text-[14px] leading-6 text-stone-600">한국어만 가능한 대행이 아니라, 일본 현지 업체가 신뢰할 수 있는 방식으로 연락합니다.</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-center">
                    <p className="text-lg font-black text-emerald-700">일본 현지인 ✅</p>
                    <p className="mt-2 text-[14px] leading-6 text-emerald-800">실제 일본인 이름으로 직접 통화하여 일본 식당과 업체에서도 신뢰도와 응답률을 높입니다.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-white p-4 shadow-sm sm:p-6 md:p-8">
          <SectionTitle>서비스 안내</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2 md:gap-5">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 md:rounded-[1.5rem] md:p-5">
              <h3 className="mb-2 text-sm font-bold text-slate-900">서비스 내용</h3>
              <ul className="space-y-1.5 text-[14px] leading-6 text-slate-600 md:text-sm">
                {SERVICE_SCOPE.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1 text-slate-400">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 md:rounded-[1.5rem] md:p-5">
              <h3 className="mb-2 text-sm font-bold text-slate-900">서비스 기준</h3>
              <ul className="space-y-1.5 text-[14px] leading-6 text-slate-600 md:text-sm">
                {SERVICE_RULES.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1 text-slate-400">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 md:rounded-[1.5rem] md:p-5">
              <h3 className="mb-2 text-sm font-bold text-slate-900">진행 불가 또는 별도 문의</h3>
              <ul className="space-y-1.5 text-[14px] leading-6 text-slate-600 md:text-sm">
                {SERVICE_EXCLUSIONS.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1 text-slate-400">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 md:rounded-[1.5rem] md:p-5">
              <h3 className="mb-2 text-sm font-bold text-slate-900">유의 사항</h3>
              <ul className="space-y-1.5 text-[14px] leading-6 text-slate-600 md:text-sm">
                {SERVICE_NOTES.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1 text-slate-400">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
          <SectionTitle>서비스 카테고리 선택</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {CATEGORY_OPTIONS.map((item) => (
              <label
                key={item.id}
                className={`cursor-pointer rounded-2xl border p-4 transition-colors ${
                  category === item.id
                    ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  checked={category === item.id}
                  onChange={() => setCategory(item.id)}
                />
                <p className="text-sm font-bold text-slate-900">{item.label}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500 md:text-[13px]">{item.description}</p>
                <p className="mt-3 text-xs font-black text-slate-700">{item.priceLabel}</p>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
          <SectionTitle>{getProxyCategoryLabel(category)} 양식</SectionTitle>
          {renderCategoryFields()}
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
          <SectionTitle>결제 방식 선택</SectionTitle>
          <div className="mb-6 flex flex-col gap-3">
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors ${
                paymentChannel === 'NAVER'
                  ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                value="NAVER"
                checked={paymentChannel === 'NAVER'}
                onChange={() => setPaymentChannel('NAVER')}
                className="h-4 w-4 text-green-600"
              />
              <div className="flex-1">
                <div className="font-semibold text-sm">네이버 스마트스토어 결제 고객</div>
                <div className="text-xs text-slate-500">이미 네이버로 결제하신 분은 구매자명 확인 후 바로 폼을 접수합니다.</div>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors ${
                paymentChannel === 'LOCALLY'
                  ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                value="LOCALLY"
                checked={paymentChannel === 'LOCALLY'}
                onChange={() => setPaymentChannel('LOCALLY')}
                className="h-4 w-4 text-blue-600"
              />
              <div className="flex-1">
                <div className="font-semibold text-sm">로컬리 자체 결제</div>
                <div className="text-xs text-slate-500">카드 즉시 결제 또는 무통장 입금으로 접수 후 바로 요청을 생성합니다.</div>
              </div>
            </label>
          </div>

          {paymentChannel === 'NAVER' ? (
            <div className="rounded-2xl border border-green-100 bg-green-50/70 p-4">
              <InputField
                label="스마트스토어 구매자명"
                required
                placeholder="결제 시 입력한 구매자 성함을 입력해주세요."
                value={naverBuyerName}
                onChange={(event) => setNaverBuyerName(event.target.value)}
              />
              <p className="mt-2 text-[11px] text-green-700">
                기존 네이버 결제 고객은 구매자명 기준으로 주문을 대조합니다.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors ${
                    paymentMethod === 'card'
                      ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    value="card"
                    checked={paymentMethod === 'card'}
                    onChange={() => setPaymentMethod('card')}
                    className="h-4 w-4 text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-sm">카드 즉시 결제</div>
                    <div className="text-xs text-slate-500">요청 생성 후 바로 카드 결제를 진행합니다.</div>
                  </div>
                </label>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors ${
                    paymentMethod === 'bank'
                      ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    value="bank"
                    checked={paymentMethod === 'bank'}
                    onChange={() => setPaymentMethod('bank')}
                    className="h-4 w-4 text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-sm">무통장 입금</div>
                    <div className="text-xs text-slate-500">요청 생성 후 상세 페이지에서 입금 안내를 확인합니다.</div>
                  </div>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="결제자 이름"
                  required
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                />
                <InputField
                  label="결제 연락처"
                  required
                  type="tel"
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                />
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-900">
                예상 수수료는 <span className="font-bold">₩{currentServiceFee.toLocaleString()}</span> 입니다.
                {paymentMethod === 'card'
                  ? ' 요청 제출 후 바로 카드 결제로 이어집니다.'
                  : ' 요청 제출 후 상세 페이지에서 입금 안내를 확인할 수 있습니다.'}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-4 shadow-sm sm:p-5 md:p-6">
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(event) => setAgreedToTerms(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-black focus:ring-black"
            />
            <span>
              <span className="mb-1 block font-bold text-slate-900">서비스 기준 및 환불 규정을 확인했고 동의합니다. (필수)</span>
              연결 완료, 만석, 업장 사정, 통화 착수 이후 환불 제한, 특수 번호/추가 통화의 별도 비용 가능성을 이해했습니다.
            </span>
          </label>
        </section>

        <button
          disabled={loading || !agreedToTerms}
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-black py-4 text-lg font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : null}
          {paymentChannel === 'LOCALLY' && paymentMethod === 'card' ? '결제 후 요청 제출하기' : '요청 제출하기'}
        </button>
      </form>

      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 sm:mt-6">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>
            운영팀 답글과 안내는 1:1 문의함에서 이어집니다. 카드 결제 완료 후에도 운영 확인이 필요할 수 있으며, 추가 문의가 있으면 담당자 스레드로 남겨주세요.
          </p>
        </div>
      </div>
    </div>
  );
}
