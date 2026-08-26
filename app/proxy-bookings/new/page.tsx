'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Clock3, Loader2, PhoneCall, X } from 'lucide-react';

import type {
  GeneralInquiryFormData,
  HotelFormData,
  LostAndFoundFormData,
  RestaurantFormData,
  TransportFormData,
} from '@/app/schemas/proxyRequestSchema';
import type { ProxyCategory, RestaurantServiceOption } from '@/app/types/proxy';
import { ProxyRequestValidationSchema } from '@/app/schemas/proxyRequestSchema';
import { useAuth } from '@/app/context/AuthContext';
import { createClient } from '@/app/utils/supabase/client';
import { ProxyBankTransferNotice } from '@/app/components/proxy/ProxyBankTransferNotice';
import { launchCardPayment } from '@/app/utils/payments/card/client';
import { buildCardPaymentCallbackRequestBody } from '@/app/utils/payments/card/public';
import type {
  CardPaymentPublicRuntime,
  CardPaymentReadiness,
} from '@/app/utils/payments/card/types';
import {
  getProxyCategoryLabel,
  getProxyRequestFeeKrw,
  normalizeProxyHotelDesiredChange,
  PROXY_BASE_PRICE_BY_CATEGORY,
  PROXY_REQUEST_PRICE_KRW,
  PROXY_RESTAURANT_SERVICE_OPTION_PRICES,
} from '@/app/utils/proxyBooking';

type PaymentMethod = 'card' | 'bank';
type PaymentChannel = 'NAVER' | 'LOCALLY';

type CardReadyResponse = CardPaymentReadiness;

type PendingProxyCardPayment = {
  requestId: string;
  inquiryRedirectUrl: string;
  locallyOrderId: string;
  finalAmount: number;
  runtime: CardPaymentPublicRuntime;
  buyerEmail?: string;
  buyerName: string;
  buyerTel: string;
  productName: string;
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
    label: '식당 예약',
    description: '예약 및 예약 가능 여부 확인',
    priceLabel: `${PROXY_RESTAURANT_SERVICE_OPTION_PRICES.STANDARD.toLocaleString()}원부터`,
  },
  {
    id: 'HOTEL',
    label: '숙소 문의',
    description: '호텔, 료칸 예약 변경, 취소, 기타 문의',
    priceLabel: `${PROXY_BASE_PRICE_BY_CATEGORY.HOTEL.toLocaleString()}원`,
  },
  {
    id: 'TRANSPORT',
    label: '교통 문의',
    description: '택시, 호텔 택시, 셔틀버스 등',
    priceLabel: `${PROXY_BASE_PRICE_BY_CATEGORY.TRANSPORT.toLocaleString()}원`,
  },
  {
    id: 'GENERAL',
    label: '현지 업체 문의',
    description: '재고, 영업 여부, 예약 가능 여부 등',
    priceLabel: `${PROXY_BASE_PRICE_BY_CATEGORY.GENERAL.toLocaleString()}원`,
  },
  {
    id: 'LOST_AND_FOUND',
    label: '분실물 문의',
    description: '호텔, 식당, 매장 등에 분실물 확인',
    priceLabel: `${PROXY_BASE_PRICE_BY_CATEGORY.LOST_AND_FOUND.toLocaleString()}원`,
  },
];

const PROXY_BOOKING_LOGIN_CATEGORY_STORAGE_KEY = 'proxy-bookings:new:login-category';

function isProxyCategory(value: string | null): value is ProxyCategory {
  return CATEGORY_OPTIONS.some((item) => item.id === value);
}

const SERVICE_POLICY_ITEMS = [
  '업체와 정상적으로 통화가 연결되면 예약이나 문의 결과와 관계없이 서비스가 진행된 것으로 처리될 수 있습니다.',
  '만석, 휴무, 업체 사정 등에 따라 요청이 완료되지 않을 수 있습니다.',
  '추가 통화 또는 별도 비용이 필요하면 먼저 안내 후 진행합니다.',
  '일부 특수번호는 서비스 요금이 다를 수 있습니다.',
  '진행 상태에 따라 취소 또는 환불이 제한될 수 있습니다.',
  '결과는 1:1 문의함에서 안내합니다.',
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
  property_link: '',
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
  business_name: '',
  business_link: '',
  business_phone: '',
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
  location_link: '',
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

function FormSubsection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function OptionalFields({ children }: { children: React.ReactNode }) {
  return (
    <details className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
      <summary className="list-none cursor-pointer text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">+ 추가 정보 입력</summary>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </details>
  );
}

function InputField({
  label,
  required,
  className = '',
  description,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; required?: boolean; description?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
        <input
          {...props}
          required={required}
          className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
        />
      </label>
      {description ? <p className="mt-1.5 text-[11px] leading-5 text-slate-500">{description}</p> : null}
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
        <select
          {...props}
          required={required}
          className="mt-1.5 block w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          {children}
        </select>
      </label>
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
      <label className="block text-xs font-semibold text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
        <textarea
          {...props}
          required={required}
          className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
        />
      </label>
    </div>
  );
}

export default function NewProxyBooking() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { user, isLoading: isAuthLoading } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoginRequiredDialogOpen, setIsLoginRequiredDialogOpen] = useState(false);
  const [category, setCategory] = useState<ProxyCategory>('RESTAURANT');
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>('NAVER');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [cardRuntime, setCardRuntime] = useState<CardPaymentPublicRuntime | null>(null);
  const [pendingCardPayment, setPendingCardPayment] = useState<PendingProxyCardPayment | null>(null);
  const [cardRetryAvailable, setCardRetryAvailable] = useState(false);
  const [naverBuyerName, setNaverBuyerName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [restaurantForm, setRestaurantForm] = useState<RestaurantFormData>(DEFAULT_RESTAURANT_FORM);
  const [hotelForm, setHotelForm] = useState<HotelFormData>(DEFAULT_HOTEL_FORM);
  const [transportForm, setTransportForm] = useState<TransportFormData>(DEFAULT_TRANSPORT_FORM);
  const [generalForm, setGeneralForm] = useState<GeneralInquiryFormData>(DEFAULT_GENERAL_FORM);
  const [lostForm, setLostForm] = useState<LostAndFoundFormData>(DEFAULT_LOST_FORM);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedCategory = window.sessionStorage.getItem(PROXY_BOOKING_LOGIN_CATEGORY_STORAGE_KEY);
    window.sessionStorage.removeItem(PROXY_BOOKING_LOGIN_CATEGORY_STORAGE_KEY);

    if (isProxyCategory(savedCategory)) {
      setCategory(savedCategory);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchCardRuntime = async () => {
      try {
        const readinessRes = await fetch('/api/payment/card-ready', { cache: 'no-store' });
        const readiness = (await readinessRes.json()) as CardReadyResponse;

        if (!isMounted) return;
        setCardRuntime(readiness.runtime || null);
      } catch {
        if (!isMounted) return;
        setCardRuntime(null);
      }
    };

    void fetchCardRuntime();

    return () => {
      isMounted = false;
    };
  }, []);

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

  const openLoginRequiredDialog = async () => {
    if (user) return;

    if (isAuthLoading) {
      const {
        data: { user: resolvedUser },
      } = await supabase.auth.getUser();

      if (resolvedUser) return;
    }

    setIsLoginRequiredDialogOpen(true);
  };

  const moveToLogin = () => {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(PROXY_BOOKING_LOGIN_CATEGORY_STORAGE_KEY, category);
      } catch {
        // 로그인 이동 자체는 저장소를 사용할 수 없는 환경에서도 계속합니다.
      }
    }

    router.push(`/login?returnUrl=${encodeURIComponent('/proxy-bookings/new')}`);
  };

  const handleBusinessNameFocus = () => {
    void openLoginRequiredDialog();
  };

  const handleUnauthenticatedSubmitClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (user) return;

    event.preventDefault();
    void openLoginRequiredDialog();
  };

  const categoryData = useMemo(() => {
    switch (category) {
      case 'RESTAURANT':
        return {
          category: 'RESTAURANT' as const,
          form_data: {
            restaurant_name: restaurantForm.restaurant_name.trim(),
            google_map_url: restaurantForm.google_map_url.trim(),
            restaurant_phone: restaurantForm.restaurant_phone.trim(),
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
            property_link: hotelForm.property_link.trim(),
            property_phone: hotelForm.property_phone.trim(),
            booking_platform: normalizeOptionalText(hotelForm.booking_platform || ''),
            reservation_number: normalizeOptionalText(hotelForm.reservation_number || ''),
            reservation_name: hotelForm.reservation_name.trim(),
            checkin_date: hotelForm.checkin_date,
            checkout_date: hotelForm.checkout_date,
            hotel_inquiry_type: hotelForm.hotel_inquiry_type,
            request_content: hotelForm.request_content.trim(),
            desired_change: normalizeProxyHotelDesiredChange(
              hotelForm.hotel_inquiry_type,
              hotelForm.desired_change
            ),
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
            business_name: transportForm.business_name.trim(),
            business_link: transportForm.business_link.trim(),
            business_phone: transportForm.business_phone.trim(),
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
            business_phone: generalForm.business_phone.trim(),
            business_link: generalForm.business_link.trim(),
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
            location_link: lostForm.location_link.trim(),
            location_phone: lostForm.location_phone.trim(),
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
  const selectedCategoryOption = CATEGORY_OPTIONS.find((item) => item.id === category) ?? CATEGORY_OPTIONS[0];
  const hotelRequestContentLabel =
    hotelForm.hotel_inquiry_type === 'CHANGE'
      ? '호텔에 확인할 내용'
      : '요청 내용을 적어주세요';
  const hotelRequestContentExample =
    hotelForm.hotel_inquiry_type === 'CANCEL'
      ? '예: 예약을 취소하고 싶습니다. 취소 수수료가 있다면 금액도 함께 확인해주세요.'
      : '예: 호텔에 확인하거나 전달할 내용을 적어주세요.';

  const runProxyCardPayment = async (pending: PendingProxyCardPayment) => {
    let paymentSession;

    try {
      paymentSession = await launchCardPayment({
        provider: pending.runtime.provider,
        merchantCode: pending.runtime.merchantCode,
        publicClientKey: pending.runtime.publicClientKey,
        orderId: pending.locallyOrderId,
        productName: pending.productName,
        amount: pending.finalAmount,
        buyerEmail: pending.buyerEmail,
        buyerName: pending.buyerName,
        buyerTel: pending.buyerTel,
        redirectUrl: pending.inquiryRedirectUrl
          ? `${window.location.origin}${pending.inquiryRedirectUrl}`
          : `${window.location.origin}/guest/inbox`,
      });
    } catch (paymentError) {
      console.error('[proxy-bookings/new] card payment launch failed:', paymentError);

      if (pending.runtime.provider === 'nicepay') {
        setPendingCardPayment(pending);
        setCardRetryAvailable(true);
        setError('요청은 저장됐지만 카드 결제는 완료되지 않았습니다. 새 요청을 만들지 말고 같은 요청으로 다시 결제해주세요.');
        return;
      }

      setPendingCardPayment(null);
      setCardRetryAvailable(false);
      router.push(`/proxy-bookings/${encodeURIComponent(pending.requestId)}?payment=review`);
      return;
    }

    setCardRetryAvailable(false);

    const callbackRes = await fetch('/api/proxy-bookings/payment/nicepay-callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        buildCardPaymentCallbackRequestBody({
          orderId: pending.locallyOrderId,
          paymentSession,
        })
      ),
    });

    const callbackResult = await callbackRes.json().catch(() => null);
    if (!callbackRes.ok || !callbackResult?.success) {
      setPendingCardPayment(null);
      router.push(`/proxy-bookings/${encodeURIComponent(pending.requestId)}?payment=review`);
      return;
    }

    setPendingCardPayment(null);
    router.push(pending.inquiryRedirectUrl || '/guest/inbox');
  };

  const handleCardPaymentRetry = async () => {
    if (!pendingCardPayment || !cardRetryAvailable || loading) return;

    setLoading(true);
    setError(null);
    try {
      await runProxyCardPayment(pendingCardPayment);
    } catch (paymentError) {
      console.error('[proxy-bookings/new] card payment retry callback failed:', paymentError);
      setPendingCardPayment(null);
      setCardRetryAvailable(false);
      router.push(`/proxy-bookings/${encodeURIComponent(pendingCardPayment.requestId)}?payment=review`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pendingCardPayment) {
      setError('이미 저장된 요청이 있습니다. 새로 제출하지 말고 같은 요청으로 카드 결제를 다시 시도해주세요.');
      return;
    }
    setLoading(true);
    setError(null);

    const requiresLocallyPayment = paymentChannel === 'LOCALLY';
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoginRequiredDialogOpen(true);
        return;
      }

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
        return;
      }

      let readiness: CardReadyResponse | null = null;

      if (requiresLocallyPayment && paymentMethod === 'card') {
        const readinessRes = await fetch('/api/payment/card-ready', { cache: 'no-store' });
        readiness = (await readinessRes.json()) as CardReadyResponse;
        setCardRuntime(readiness.runtime || null);

        if (!readinessRes.ok || !readiness?.ready || !readiness.runtime?.merchantCode) {
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

      if (!locallyOrderId || !readiness?.runtime) {
        router.push(`/proxy-bookings/${encodeURIComponent(requestId)}?payment=review`);
        return;
      }

      try {
        const pendingPayment: PendingProxyCardPayment = {
          requestId,
          inquiryRedirectUrl,
          locallyOrderId,
          finalAmount,
          runtime: readiness.runtime,
          buyerEmail: user.email,
          buyerName: contactName.trim(),
          buyerTel: contactPhone.trim(),
          productName: `Locally ${getProxyCategoryLabel(category)}`,
        };
        setPendingCardPayment(pendingPayment);
        await runProxyCardPayment(pendingPayment);
      } catch (paymentError) {
        console.error('[proxy-bookings/new] card payment callback failed:', paymentError);
        setPendingCardPayment(null);
        setCardRetryAvailable(false);
        router.push(`/proxy-bookings/${encodeURIComponent(requestId)}?payment=review`);
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
          <div className="space-y-6">
            <FormSubsection title="식당 정보를 알려주세요">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">전화번호 유형</label>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">전화번호 유형에 따라 서비스 요금이 달라집니다.</p>
                  <select
                    value={restaurantForm.restaurant_service_option}
                    onChange={(event) => updateRestaurantField('restaurant_service_option', event.target.value as RestaurantServiceOption)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="STANDARD">일반 전화 — {PROXY_RESTAURANT_SERVICE_OPTION_PRICES.STANDARD.toLocaleString()}원</option>
                    <option value="ZERO_ONE_TWO_ZERO">0120 / 0570 번호 — {PROXY_RESTAURANT_SERVICE_OPTION_PRICES.ZERO_ONE_TWO_ZERO.toLocaleString()}원</option>
                    <option value="KUITEI">쿠이테이 예약 — {PROXY_RESTAURANT_SERVICE_OPTION_PRICES.KUITEI.toLocaleString()}원</option>
                  </select>
                </div>
                <InputField
                  label="식당 이름"
                  required
                  readOnly={!user}
                  placeholder="예: 스시 지로"
                  value={restaurantForm.restaurant_name}
                  onFocus={handleBusinessNameFocus}
                  onChange={(event) => updateRestaurantField('restaurant_name', event.target.value)}
                  className="md:col-span-2"
                />
                <InputField
                  label="업장 링크 주소"
                  required
                  type="url"
                  inputMode="url"
                  placeholder="예: Google Maps 또는 공식 홈페이지 링크"
                  value={restaurantForm.google_map_url}
                  onChange={(event) => updateRestaurantField('google_map_url', event.target.value)}
                />
                <InputField
                  label="업장 전화번호"
                  required
                  type="tel"
                  placeholder="예: 03-1234-5678"
                  value={restaurantForm.restaurant_phone}
                  onChange={(event) => updateRestaurantField('restaurant_phone', event.target.value)}
                />
              </div>
            </FormSubsection>

            <FormSubsection title="예약 희망 일시" description="가능한 일시를 세 가지로 남겨주시면 예약 가능 여부를 더 빠르게 확인할 수 있어요.">
              <div className="grid gap-3 md:grid-cols-3">
                <DateTimeChoiceField
                  label="1지망"
                  value={restaurantForm.preferred_slot_primary}
                  onChange={(value) => updateRestaurantField('preferred_slot_primary', value)}
                  fieldId="preferred-slot-primary"
                />
                <DateTimeChoiceField
                  label="2지망"
                  value={restaurantForm.preferred_slot_secondary}
                  onChange={(value) => updateRestaurantField('preferred_slot_secondary', value)}
                  fieldId="preferred-slot-secondary"
                />
                <DateTimeChoiceField
                  label="3지망"
                  value={restaurantForm.preferred_slot_tertiary}
                  onChange={(value) => updateRestaurantField('preferred_slot_tertiary', value)}
                  fieldId="preferred-slot-tertiary"
                />
              </div>
            </FormSubsection>

            <FormSubsection title="예약자 정보를 알려주세요">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InputField
                  label="예약자 이름"
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
                  description="운영팀에서 추가 확인이 필요할 때 연락드릴 번호"
                  value={restaurantForm.korean_contact}
                  onChange={(event) => updateRestaurantField('korean_contact', event.target.value)}
                  className="md:col-span-2"
                />
              </div>
            </FormSubsection>

            <FormSubsection title="요청사항">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextareaField
                  label="식당에 전달할 요청사항"
                  rows={4}
                  className="md:col-span-2"
                  placeholder="알레르기, 좌석, 기념일 등 식당에 전달할 내용을 적어주세요."
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
              </div>
              <OptionalFields>
                <InputField
                  label="현지 숙소 이름 또는 연락처"
                  placeholder="예: 호텔명 / 전화번호"
                  value={restaurantForm.local_hotel_contact || ''}
                  onChange={(event) => updateRestaurantField('local_hotel_contact', event.target.value)}
                  className="md:col-span-2"
                />
              </OptionalFields>
            </FormSubsection>
          </div>
        );
      case 'HOTEL':
        return (
          <div className="space-y-6">
            <FormSubsection title="예약 정보를 알려주세요">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InputField
                  label="숙소 이름"
                  required
                  readOnly={!user}
                  className="md:col-span-2"
                  placeholder="예: 오리엔탈 호텔 도쿄 베이"
                  value={hotelForm.property_name}
                  onFocus={handleBusinessNameFocus}
                  onChange={(event) => updateHotelField('property_name', event.target.value)}
                />
                <InputField
                  label="업장 링크 주소"
                  required
                  type="url"
                  inputMode="url"
                  placeholder="예: Google Maps 또는 공식 홈페이지 링크"
                  value={hotelForm.property_link}
                  onChange={(event) => updateHotelField('property_link', event.target.value)}
                />
                <InputField
                  label="업장 전화번호"
                  required
                  type="tel"
                  placeholder="예: 03-1234-5678"
                  value={hotelForm.property_phone}
                  onChange={(event) => updateHotelField('property_phone', event.target.value)}
                />
                <InputField
                  label="예약자 이름"
                  required
                  placeholder="예약할 때 입력한 이름"
                  value={hotelForm.reservation_name}
                  onChange={(event) => updateHotelField('reservation_name', event.target.value)}
                />
                <InputField
                  label="예약한 사이트"
                  placeholder="예: Agoda, Booking.com"
                  value={hotelForm.booking_platform || ''}
                  onChange={(event) => updateHotelField('booking_platform', event.target.value)}
                />
                <InputField
                  label="예약 번호"
                  className="md:col-span-2"
                  value={hotelForm.reservation_number || ''}
                  onChange={(event) => updateHotelField('reservation_number', event.target.value)}
                />
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
              </div>
            </FormSubsection>

            <FormSubsection title="무엇을 도와드릴까요?">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SelectField
                  label="문의 유형"
                  required
                  className="md:col-span-2"
                  value={hotelForm.hotel_inquiry_type}
                  onChange={(event) => updateHotelField('hotel_inquiry_type', event.target.value as HotelFormData['hotel_inquiry_type'])}
                >
                  <option value="CHANGE">예약 변경</option>
                  <option value="CANCEL">예약 취소</option>
                  <option value="GENERAL">기타 문의</option>
                </SelectField>
                {hotelForm.hotel_inquiry_type === 'CHANGE' ? (
                  <TextareaField
                    label="어떻게 변경하고 싶으신가요?"
                    rows={3}
                    className="md:col-span-2"
                    placeholder="예: 9월 21일 체크인을 9월 22일로 변경하고 싶어요."
                    value={hotelForm.desired_change || ''}
                    onChange={(event) => updateHotelField('desired_change', event.target.value)}
                  />
                ) : null}
                <TextareaField
                  label={hotelRequestContentLabel}
                  required
                  rows={4}
                  className="md:col-span-2"
                  placeholder={
                    hotelForm.hotel_inquiry_type === 'CHANGE'
                      ? '예: 변경 가능 여부와 추가 요금이 있는지 확인해주세요.'
                      : '호텔에 확인하거나 전달할 내용을 적어주세요.'
                  }
                  value={hotelForm.request_content}
                  onChange={(event) => updateHotelField('request_content', event.target.value)}
                />
                {hotelForm.hotel_inquiry_type !== 'CHANGE' ? (
                  <p className="-mt-2 text-[11px] leading-5 text-slate-500 md:col-span-2">
                    {hotelRequestContentExample}
                  </p>
                ) : null}
                <InputField
                  label="한국 연락처"
                  required
                  type="tel"
                  description="운영팀에서 추가 확인이 필요할 때 연락드릴 번호"
                  value={hotelForm.korean_contact}
                  onChange={(event) => updateHotelField('korean_contact', event.target.value)}
                  className="md:col-span-2"
                />
              </div>
              <OptionalFields>
                <TextareaField
                  label="기타 요청사항"
                  rows={3}
                  value={hotelForm.additional_notes || ''}
                  onChange={(event) => updateHotelField('additional_notes', event.target.value)}
                />
              </OptionalFields>
            </FormSubsection>
          </div>
        );
      case 'TRANSPORT':
        return (
          <div className="space-y-6">
            <FormSubsection title="업장 정보를 알려주세요">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InputField
                  label="업체 이름"
                  required
                  readOnly={!user}
                  className="md:col-span-2"
                  placeholder="예: 도쿄 MK 택시"
                  value={transportForm.business_name}
                  onFocus={handleBusinessNameFocus}
                  onChange={(event) => updateTransportField('business_name', event.target.value)}
                />
                <InputField
                  label="업장 링크 주소"
                  required
                  type="url"
                  inputMode="url"
                  placeholder="예: Google Maps 또는 공식 홈페이지 링크"
                  value={transportForm.business_link}
                  onChange={(event) => updateTransportField('business_link', event.target.value)}
                />
                <InputField
                  label="업장 전화번호"
                  required
                  type="tel"
                  placeholder="예: 03-1234-5678"
                  value={transportForm.business_phone}
                  onChange={(event) => updateTransportField('business_phone', event.target.value)}
                />
              </div>
            </FormSubsection>
            <FormSubsection title="이용 정보를 알려주세요">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SelectField
                  label="교통수단"
                  required
                  className="md:col-span-2"
                  value={transportForm.reservation_type}
                  onChange={(event) => updateTransportField('reservation_type', event.target.value as TransportFormData['reservation_type'])}
                >
                  <option value="TAXI">택시</option>
                  <option value="HOTEL_TAXI">호텔 택시</option>
                  <option value="SHUTTLE_BUS">셔틀버스</option>
                  <option value="OTHER">기타 교통</option>
                </SelectField>
                <InputField
                  label="이용 지역"
                  required
                  placeholder="예: 도쿄 시부야"
                  value={transportForm.service_area}
                  onChange={(event) => updateTransportField('service_area', event.target.value)}
                  className="md:col-span-2"
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
              </div>
            </FormSubsection>

            <FormSubsection title="이동 경로를 알려주세요">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              </div>
            </FormSubsection>

            <FormSubsection title="신청자 정보를 알려주세요">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InputField
                  label="예약자 이름"
                  required
                  value={transportForm.reservation_name}
                  onChange={(event) => updateTransportField('reservation_name', event.target.value)}
                />
                <InputField
                  label="한국 연락처"
                  required
                  type="tel"
                  description="운영팀에서 추가 확인이 필요할 때 연락드릴 번호"
                  value={transportForm.korean_contact}
                  onChange={(event) => updateTransportField('korean_contact', event.target.value)}
                />
              </div>
              <OptionalFields>
                <InputField
                  label="짐 개수"
                  type="number"
                  min={0}
                  value={transportForm.baggage_count || 0}
                  onChange={(event) => updateTransportField('baggage_count', Number(event.target.value))}
                />
                <InputField
                  label="숙소 이름 또는 예약 번호"
                  value={transportForm.accommodation_reference || ''}
                  onChange={(event) => updateTransportField('accommodation_reference', event.target.value)}
                />
                <InputField
                  label="항공편명"
                  value={transportForm.flight_number || ''}
                  onChange={(event) => updateTransportField('flight_number', event.target.value)}
                />
                <TextareaField
                  label="추가 요청사항"
                  rows={3}
                  value={transportForm.additional_notes || ''}
                  onChange={(event) => updateTransportField('additional_notes', event.target.value)}
                />
              </OptionalFields>
            </FormSubsection>
          </div>
        );
      case 'GENERAL':
        return (
          <div className="space-y-6">
            <FormSubsection title="업체 정보를 알려주세요">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InputField
                  label="업체 이름"
                  required
                  readOnly={!user}
                  className="md:col-span-2"
                  value={generalForm.business_name}
                  onFocus={handleBusinessNameFocus}
                  onChange={(event) => updateGeneralField('business_name', event.target.value)}
                />
                <InputField
                  label="업장 링크 주소"
                  required
                  type="url"
                  inputMode="url"
                  placeholder="예: Google Maps 또는 공식 홈페이지 링크"
                  value={generalForm.business_link}
                  onChange={(event) => updateGeneralField('business_link', event.target.value)}
                />
                <InputField
                  label="업장 전화번호"
                  required
                  type="tel"
                  placeholder="예: 03-1234-5678"
                  value={generalForm.business_phone}
                  onChange={(event) => updateGeneralField('business_phone', event.target.value)}
                />
              </div>
            </FormSubsection>

            <FormSubsection title="무엇을 확인해드릴까요?">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  placeholder="예: 9월 21일 오후 3시"
                  value={generalForm.preferred_check_time || ''}
                  onChange={(event) => updateGeneralField('preferred_check_time', event.target.value)}
                />
                <TextareaField
                  label="문의 내용을 적어주세요"
                  required
                  rows={4}
                  className="md:col-span-2"
                  placeholder="업체에 확인하거나 전달할 내용을 적어주세요."
                  value={generalForm.inquiry_content}
                  onChange={(event) => updateGeneralField('inquiry_content', event.target.value)}
                />
              </div>
            </FormSubsection>

            <FormSubsection title="신청자 정보를 알려주세요">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InputField
                  label="한국 연락처"
                  required
                  type="tel"
                  description="운영팀에서 추가 확인이 필요할 때 연락드릴 번호"
                  value={generalForm.korean_contact}
                  onChange={(event) => updateGeneralField('korean_contact', event.target.value)}
                  className="md:col-span-2"
                />
              </div>
              <OptionalFields>
                <TextareaField
                  label="추가 요청사항"
                  rows={3}
                  className="md:col-span-2"
                  value={generalForm.additional_notes || ''}
                  onChange={(event) => updateGeneralField('additional_notes', event.target.value)}
                />
              </OptionalFields>
            </FormSubsection>
          </div>
        );
      case 'LOST_AND_FOUND':
      default:
        return (
          <div className="space-y-6">
            <FormSubsection title="분실 장소와 시간을 알려주세요">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InputField
                  label="분실 장소"
                  required
                  readOnly={!user}
                  className="md:col-span-2"
                  placeholder="예: ○○ 호텔 로비"
                  value={lostForm.location_name}
                  onFocus={handleBusinessNameFocus}
                  onChange={(event) => updateLostField('location_name', event.target.value)}
                />
                <InputField
                  label="업장 링크 주소"
                  required
                  type="url"
                  inputMode="url"
                  placeholder="예: Google Maps 또는 공식 홈페이지 링크"
                  value={lostForm.location_link}
                  onChange={(event) => updateLostField('location_link', event.target.value)}
                />
                <InputField
                  label="업장 전화번호"
                  required
                  type="tel"
                  placeholder="예: 03-1234-5678"
                  value={lostForm.location_phone}
                  onChange={(event) => updateLostField('location_phone', event.target.value)}
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
              </div>
            </FormSubsection>

            <FormSubsection title="분실물 정보를 알려주세요">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InputField
                  label="분실물 종류"
                  required
                  value={lostForm.item_type}
                  onChange={(event) => updateLostField('item_type', event.target.value)}
                  className="md:col-span-2"
                />
                <TextareaField
                  label="분실물 특징"
                  required
                  rows={3}
                  className="md:col-span-2"
                  placeholder="색상, 브랜드, 크기, 내용물 등 찾는 데 도움이 되는 정보를 적어주세요."
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
              </div>
            </FormSubsection>

            <FormSubsection title="신청자 정보를 알려주세요">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InputField
                  label="예약자 이름"
                  required
                  value={lostForm.reservation_name}
                  onChange={(event) => updateLostField('reservation_name', event.target.value)}
                />
                <InputField
                  label="한국 연락처"
                  required
                  type="tel"
                  description="운영팀에서 추가 확인이 필요할 때 연락드릴 번호"
                  value={lostForm.korean_contact}
                  onChange={(event) => updateLostField('korean_contact', event.target.value)}
                />
              </div>
              <OptionalFields>
                <InputField
                  label="현지 체류 숙소명"
                  value={lostForm.local_stay_name || ''}
                  onChange={(event) => updateLostField('local_stay_name', event.target.value)}
                />
                <TextareaField
                  label="추가 요청사항"
                  rows={3}
                  className="md:col-span-2"
                  value={lostForm.additional_notes || ''}
                  onChange={(event) => updateLostField('additional_notes', event.target.value)}
                />
              </OptionalFields>
            </FormSubsection>
          </div>
        );
    }
  };

  const shouldLoadCardRuntimeScript =
    Boolean(cardRuntime?.scriptSrc) && cardRuntime?.provider !== 'nicepay';

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-5 sm:py-8">
      {shouldLoadCardRuntimeScript && cardRuntime?.scriptSrc && (
        <Script
          id={`proxy-card-sdk-${cardRuntime.provider}`}
          src={cardRuntime.scriptSrc}
          strategy="afterInteractive"
        />
      )}

      {isLoginRequiredDialogOpen ? (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/45 p-4" data-testid="proxy-login-required-dialog">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="proxy-login-required-title"
            className="w-full max-w-sm rounded-[24px] border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <h2 id="proxy-login-required-title" className="text-lg font-black text-slate-900">
              로그인이 필요합니다
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              전화 대행 신청은 로그인 후 이용할 수 있습니다.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setIsLoginRequiredDialogOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                autoFocus
                onClick={moveToLogin}
                className="flex-1 rounded-xl bg-black px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                로그인/회원가입하기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <button
        onClick={() => router.back()}
        className="mb-5 flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900 sm:mb-6"
      >
        <ArrowLeft size={16} /> 돌아가기
      </button>

      <div className="mb-6 space-y-4 sm:mb-8 sm:space-y-6">
        <header className="overflow-hidden rounded-[28px] border border-stone-200 bg-[linear-gradient(135deg,#f7f2eb_0%,#ffffff_45%,#f5f7fb_100%)] shadow-sm">
          <div className="p-4 sm:p-6 md:p-8">
            <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] text-stone-500 sm:text-xs">
              <PhoneCall size={13} className="shrink-0" />
              JAPAN PHONE SUPPORT
            </p>
            <h1 className="mt-3 text-[28px] font-black leading-[1.12] tracking-tight text-stone-950 sm:text-[34px] md:text-4xl">
              일본 현지 전화, 로컬리가 대신해드려요
            </h1>
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-stone-700 sm:mt-4 md:text-base">
              식당 예약부터 숙소 문의, 교통, 분실물까지 일본어 전화가 필요한 일을 대신 처리해드립니다.
            </p>
            <p className="mt-1.5 text-[15px] leading-7 text-stone-700 sm:mt-2 md:text-base">
              일본어를 못해도 괜찮아요. 필요한 내용을 한국어로 남겨주세요.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5 text-xs font-semibold text-stone-700 sm:mt-5 sm:gap-2">
              <span className="rounded-full border border-stone-200 bg-white/80 px-3 py-1.5">
                식당 예약 {PROXY_RESTAURANT_SERVICE_OPTION_PRICES.STANDARD.toLocaleString()}원부터
              </span>
              <span className="rounded-full border border-stone-200 bg-white/80 px-3 py-1.5">일본 전역 이용 가능</span>
              <span className="rounded-full border border-stone-200 bg-white/80 px-3 py-1.5">결과는 1:1 문의함으로 안내</span>
            </div>
          </div>
        </header>

        <section className="rounded-[28px] border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm sm:p-6">
          <h2 aria-label="한국인 ❌ 일본 현지인 ✅" className="text-xl font-black tracking-tight text-emerald-950 sm:text-2xl">
            <span className="inline-flex items-center gap-1.5">
              <span>한국인</span>
              <span style={{ fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif' }}>❌</span>
              <span className="ml-1">일본 현지인</span>
              <span style={{ fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif' }}>✅</span>
            </span>
          </h2>
          <p className="mt-2.5 max-w-3xl text-sm leading-6 text-emerald-900 sm:mt-3 sm:text-base">
            일본인이 직접 전화하여, 일본 식당 및 업체에서도 신뢰도 UP!
          </p>
        </section>

        <section className="rounded-[28px] border border-blue-100 bg-blue-50/70 p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-bold text-slate-900">이용 방법</h2>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm font-semibold leading-6 text-slate-800 sm:hidden">
            <span className="whitespace-nowrap">① 요청 작성</span>
            <span className="whitespace-nowrap">② 결제 확인</span>
            <span className="whitespace-nowrap">③ 현지 전화</span>
            <span className="whitespace-nowrap">④ 결과 안내</span>
          </div>
          <p className="mt-2 hidden text-sm font-semibold leading-6 text-slate-800 sm:block">① 요청 작성 → ② 결제 확인 → ③ 현지 전화 → ④ 결과 안내</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">전화 결과와 추가 안내는 로컬리 1:1 문의함에서 알려드려요.</p>
        </section>
      </div>

      {error ? (
        <div className={`mb-6 rounded-2xl px-4 py-3 text-sm ${cardRetryAvailable ? 'border border-amber-200 bg-amber-50 text-amber-900' : 'border border-red-100 bg-red-50 text-red-600'}`}>
          <p>{error}</p>
          {cardRetryAvailable && pendingCardPayment ? (
            <button
              type="button"
              data-testid="proxy-card-payment-retry"
              disabled={loading}
              onClick={() => {
                void handleCardPaymentRetry();
              }}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              같은 요청으로 다시 결제
            </button>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
          <SectionTitle>어떤 도움이 필요하신가요?</SectionTitle>
          <div className="grid gap-2.5 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
            {CATEGORY_OPTIONS.map((item) => (
              <label
                key={item.id}
                className={`cursor-pointer rounded-2xl border px-4 py-3.5 transition-colors sm:p-4 ${
                  category === item.id
                    ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="proxy-category"
                  value={item.id}
                  className="sr-only"
                  checked={category === item.id}
                  onChange={() => setCategory(item.id)}
                />
                <p className="text-sm font-bold text-slate-900">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500 sm:mt-1.5 md:text-[13px]">{item.description}</p>
                <p className="mt-2 text-xs font-black text-slate-700 sm:mt-2.5">{item.priceLabel}</p>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
          <SectionTitle>{selectedCategoryOption.label} 신청 정보</SectionTitle>
          {renderCategoryFields()}
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
          <SectionTitle>결제 방법</SectionTitle>
          <div className="flex flex-col gap-3">
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors ${
                paymentChannel === 'LOCALLY' && paymentMethod === 'card'
                  ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="proxy-payment-method"
                value="card"
                checked={paymentChannel === 'LOCALLY' && paymentMethod === 'card'}
                onChange={() => {
                  setPaymentChannel('LOCALLY');
                  setPaymentMethod('card');
                }}
                className="h-4 w-4 text-blue-600"
              />
              <div className="flex-1">
                <div className="text-sm font-semibold">카드 결제</div>
                <div className="text-xs text-slate-500">카드로 바로 결제합니다.</div>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors ${
                paymentChannel === 'LOCALLY' && paymentMethod === 'bank'
                  ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="proxy-payment-method"
                value="bank"
                checked={paymentChannel === 'LOCALLY' && paymentMethod === 'bank'}
                onChange={() => {
                  setPaymentChannel('LOCALLY');
                  setPaymentMethod('bank');
                }}
                className="h-4 w-4 text-blue-600"
              />
              <div className="flex-1">
                <div className="text-sm font-semibold">무통장 입금</div>
                <div className="text-xs text-slate-500">계좌이체로 결제합니다.</div>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors ${
                paymentChannel === 'NAVER'
                  ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="proxy-payment-method"
                value="NAVER"
                checked={paymentChannel === 'NAVER'}
                onChange={() => setPaymentChannel('NAVER')}
                className="h-4 w-4 text-green-600"
              />
              <div className="flex-1">
                <div className="text-sm font-semibold">네이버 스마트스토어에서 이미 결제했어요</div>
                <div className="text-xs text-slate-500">스마트스토어에서 결제를 완료한 고객만 선택해주세요.</div>
              </div>
            </label>
          </div>

          <div className="mt-5 space-y-4">
            {paymentChannel === 'NAVER' ? (
              <div className="rounded-2xl border border-green-100 bg-green-50/70 p-4">
                <h3 className="text-sm font-bold text-green-950">네이버 스마트스토어에서 이미 결제했어요</h3>
                <p className="mt-2 text-xs leading-5 text-green-800">
                  스마트스토어에서 결제할 때 입력한 구매자 이름을 적어주세요. 운영팀이 결제 내역을 확인한 뒤 요청을 진행합니다.
                </p>
                <div className="mt-4">
                  <InputField
                    label="구매자 이름"
                    required
                    placeholder="결제 시 입력한 이름을 입력해주세요."
                    value={naverBuyerName}
                    onChange={(event) => setNaverBuyerName(event.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <h3 className="text-sm font-bold text-slate-900">결제자 정보</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
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
              </div>
            )}

            {paymentChannel === 'LOCALLY' && paymentMethod === 'bank' ? (
              <ProxyBankTransferNotice amount={currentServiceFee} mode="before-submit" />
            ) : (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-blue-950">
                <p className="text-xs font-semibold text-blue-800">결제 금액</p>
                <p className="mt-1 text-2xl font-black tracking-tight">₩{currentServiceFee.toLocaleString()}</p>
                <p className="mt-2 text-xs leading-5 text-blue-800">추가 통화나 별도 비용이 필요한 경우 진행 전에 먼저 안내드립니다.</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
          <SectionTitle>이용 전 확인해주세요</SectionTitle>
          <details className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">서비스 이용 기준 보기</summary>
            <ul className="mt-4 space-y-2.5 text-xs leading-5 text-slate-600 sm:text-sm">
              {SERVICE_POLICY_ITEMS.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-slate-400">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </details>
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
              <span className="block font-bold text-slate-900">서비스 이용 및 환불 규정에 동의합니다. (필수)</span>
            </span>
          </label>
        </section>

        <div>
          <button
            disabled={loading || !agreedToTerms || Boolean(pendingCardPayment)}
            type="submit"
            onClick={handleUnauthenticatedSubmitClick}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-black py-4 text-lg font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : null}
            {paymentChannel === 'LOCALLY' && paymentMethod === 'card' ? '카드로 결제하고 요청하기' : '요청 접수하기'}
          </button>
          {paymentChannel === 'LOCALLY' && paymentMethod === 'bank' ? (
            <p className="mt-2 text-center text-xs text-slate-500">입금 확인 후 전화 업무를 시작합니다.</p>
          ) : null}
          {paymentChannel === 'NAVER' ? (
            <p className="mt-2 text-center text-xs text-slate-500">운영팀이 스마트스토어 결제 내역을 확인한 뒤 진행합니다.</p>
          ) : null}
        </div>
      </form>

    </div>
  );
}
