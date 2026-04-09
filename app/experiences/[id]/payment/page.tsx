'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams, useParams } from 'next/navigation';
import { ChevronLeft, CreditCard, Calendar, Users, ShieldCheck, Clock, Info, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import Spinner from '@/app/components/ui/Spinner';
import StatusNotice from '@/app/components/ui/StatusNotice';
import Script from 'next/script';
import Image from 'next/image';
import { flushSync } from 'react-dom';
import { createClient } from '@/app/utils/supabase/client';
import { sendAnalyticsEvent } from '@/app/utils/analytics/client';
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';
import { SOLO_GUARANTEE_PRICE } from '@/app/constants/soloGuarantee';
import { launchCardPayment } from '@/app/utils/payments/card/client';
import type { CardPaymentProvider, CardPaymentReadiness } from '@/app/utils/payments/card/types';
import { getPublicBankInfo } from '@/app/utils/publicBankInfo';
import { getLocalizedExperienceRules } from '@/app/utils/experienceTranslation';
import { ExperienceAvailabilitySummary, ExperienceSlotSummary } from '../types';

type PaymentExperience = {
  title?: string;
  image_url?: string | null;
  photos?: string[] | null;
  location?: string | null;
  price?: number | null;
  private_price?: number | null;
  max_guests?: number | null;
  host_id?: string | null;
  rules?: Record<string, unknown> | null;
  rules_i18n?: Record<string, unknown> | null;
};

type BookingCheckRow = {
  guests: number | null;
  type: string | null;
};

type BookingApiResponse = {
  success?: boolean;
  newOrderId?: string;
  finalAmount?: number;
  errorCode?: string;
  error?: string;
};

type PaymentMethod = 'card' | 'bank' | 'paypal';
type BookingErrorCode =
  | 'unauthorized'
  | 'missing_required_fields'
  | 'customer_name_too_long'
  | 'customer_phone_invalid'
  | 'solo_guarantee_invalid'
  | 'invalid_payment_method'
  | 'max_guests_exceeded'
  | 'booking_conflict'
  | 'booking_not_found'
  | 'booking_bad_request'
  | 'solo_guarantee_unavailable_existing_booking'
  | 'profile_sync_in_progress'
  | 'server_error';
type ExperienceCardReadyReason = CardPaymentReadiness['reason'];
type ExperienceCardReadyResponse = CardPaymentReadiness;

type PayPalCreateOrderResponse = {
  success?: boolean;
  paypalOrderId?: string;
  error?: string;
};

type PayPalCaptureResponse = {
  success?: boolean;
  captureId?: string | null;
  paypalOrderId?: string;
  error?: string;
};

type PayPalButtonStyle = {
  layout?: 'vertical' | 'horizontal';
  color?: 'gold' | 'blue' | 'silver' | 'white' | 'black';
  shape?: 'rect' | 'pill';
  label?: 'paypal' | 'checkout' | 'pay' | 'buynow';
  height?: number;
};

type PayPalCreateOrderData = {
  orderID?: string;
};

type PayPalApproveData = {
  orderID: string;
};

type PayPalButtonsComponent = {
  render: (container: HTMLElement) => Promise<void>;
};

type PayPalButtonsOptions = {
  style?: PayPalButtonStyle;
  createOrder: (data: PayPalCreateOrderData) => Promise<string>;
  onApprove: (data: PayPalApproveData) => Promise<void>;
  onCancel?: () => void;
  onError?: (error: unknown) => void;
};

type PayPalNamespace = {
  Buttons: (options: PayPalButtonsOptions) => PayPalButtonsComponent;
};

type PayPalPreparedSession = {
  bookingId: string;
  orderId: string;
  key: string;
};

type PayPalCheckoutContext = {
  customerName: string;
  customerPhone: string;
  agreeTerms: boolean;
  agreeSafety: boolean;
  agreeNoOffPlatform: boolean;
};

type AgreementKey = 'off_platform' | 'manners' | 'refund';

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

type CheckoutSectionState = 'complete' | 'required' | 'error' | 'loading';

const SECTION_STATE_STYLES: Record<CheckoutSectionState, string> = {
  complete: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  required: 'border-amber-200 bg-amber-50 text-amber-700',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
  loading: 'border-slate-200 bg-slate-100 text-slate-600',
};

const SECTION_STATE_DOT_STYLES: Record<CheckoutSectionState, string> = {
  complete: 'bg-emerald-500',
  required: 'bg-amber-500',
  error: 'bg-rose-500',
  loading: 'bg-slate-500 animate-pulse',
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function PaymentSectionCard({
  step,
  title,
  status,
  statusLabel,
  testId,
  children,
}: {
  step: number;
  title: string;
  status: CheckoutSectionState;
  statusLabel: string;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      data-testid={testId}
      data-state={status}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:rounded-3xl md:p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
            {step}
          </div>
          <h2 className="text-[16px] font-bold text-slate-900 md:text-[18px]">{title}</h2>
        </div>
        <span
          data-testid={testId ? `${testId}-status` : undefined}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold',
            SECTION_STATE_STYLES[status]
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', SECTION_STATE_DOT_STYLES[status])} />
          {statusLabel}
        </span>
      </div>
      {children}
    </section>
  );
}

function PaymentContent() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const { t, lang } = useLanguage();

  const [isProcessing, setIsProcessing] = useState(false);
  const [experience, setExperience] = useState<PaymentExperience | null>(null);
  const [paymentError, setPaymentError] = useState('');
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeSafety, setAgreeSafety] = useState(false);
  const [agreeNoOffPlatform, setAgreeNoOffPlatform] = useState(false);
  const [activeAgreement, setActiveAgreement] = useState<AgreementKey | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [cardProvider, setCardProvider] = useState<CardPaymentProvider>('portone');
  const [isCardReady, setIsCardReady] = useState(false);
  const [isCardReadyResolved, setIsCardReadyResolved] = useState(false);
  const [cardReadyReason, setCardReadyReason] = useState<ExperienceCardReadyReason | ''>('');
  const [isFeeInfoOpen, setIsFeeInfoOpen] = useState(false);
  const [isPayPalSdkReady, setIsPayPalSdkReady] = useState(false);
  const [isPayPalButtonsReady, setIsPayPalButtonsReady] = useState(false);
  const [paypalSdkError, setPaypalSdkError] = useState('');
  const [slotSummary, setSlotSummary] = useState<ExperienceSlotSummary | null>(null);
  const [isSlotSummaryResolved, setIsSlotSummaryResolved] = useState(false);
  const [hasSlotSummaryLoaded, setHasSlotSummaryLoaded] = useState(false);
  const feeInfoRef = useRef<HTMLDivElement | null>(null);
  const paypalButtonRef = useRef<HTMLDivElement | null>(null);
  const paypalSessionRef = useRef<PayPalPreparedSession | null>(null);
  const paypalRenderedKeyRef = useRef('');
  const hasManualPaymentMethodSelectionRef = useRef(false);

  const soloOptionNoticeShownRef = useRef(false);
  const createPayPalOrderRef = useRef<() => Promise<string>>(async () => {
    throw new Error('PayPal create order handler is not ready.');
  });
  const handlePayPalApproveRef = useRef<(data: PayPalApproveData) => Promise<void>>(async () => {});
  const latestPayPalContextRef = useRef<PayPalCheckoutContext>({
    customerName: '',
    customerPhone: '',
    agreeTerms: false,
    agreeSafety: false,
    agreeNoOffPlatform: false,
  });

  const experienceId = params?.id as string;
  const date = searchParams?.get('date') || (t('exp_payment_date_tbd') as string);
  const time = searchParams?.get('time') || (t('exp_payment_time_tbd') as string);
  const guests = Number(searchParams?.get('guests')) || 1;
  const isPrivate = searchParams?.get('type') === 'private';
  const requestedSoloGuarantee = searchParams?.get('solo') === '1' && guests === 1 && !isPrivate;
  const effectiveIsSoloGuarantee =
    requestedSoloGuarantee &&
    hasSlotSummaryLoaded &&
    Boolean(slotSummary?.soloGuaranteeEligible);

  const expPrice = Number(experience?.price || 50000);
  const baseHostPrice = isPrivate ? Number(experience?.private_price || 300000) : expPrice * guests;
  const soloGuaranteePrice = effectiveIsSoloGuarantee ? SOLO_GUARANTEE_PRICE : 0;
  const hostPrice = baseHostPrice + soloGuaranteePrice;

  const getLocalizedBookingApiError = useCallback((result?: Pick<BookingApiResponse, 'errorCode' | 'error'>) => {
    if (!result) return t('exp_payment_booking_error') as string;

    switch (result.errorCode as BookingErrorCode | undefined) {
      case 'unauthorized':
        return t('login_required') as string;
      case 'booking_conflict':
        return isPrivate
          ? (t('exp_payment_private_conflict') as string)
          : (t('exp_payment_capacity_conflict') as string);
      case 'server_error':
        return t('server_error') as string;
      default:
        break;
    }

    if (result.error?.includes('해당 시간대에 남은 좌석이 부족합니다.')) {
      return isPrivate
        ? (t('exp_payment_private_conflict') as string)
        : (t('exp_payment_capacity_conflict') as string);
    }

    if (lang === 'ko' && result.error?.trim()) {
      return result.error.trim();
    }

    return t('exp_payment_booking_error') as string;
  }, [isPrivate, lang, t]);
  const guestFee = Math.floor(hostPrice * 0.1);
  const finalAmount = hostPrice + guestFee;
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';
  const isPayPalEnabled = Boolean(paypalClientId);
  const portOneImpCode = process.env.NEXT_PUBLIC_PORTONE_IMP_CODE || '';
  const hostNotice = experience
    ? (getLocalizedExperienceRules(experience, lang).host_notice || '').trim()
    : '';

  const payPalCheckoutSessionKey = useMemo(
    () =>
      JSON.stringify([
        experienceId,
        date,
        time,
        guests,
        isPrivate,
        effectiveIsSoloGuarantee,
      ]),
    [date, effectiveIsSoloGuarantee, experienceId, guests, isPrivate, time]
  );

  const getCheckoutValidationError = useCallback((context: PayPalCheckoutContext) => {
    if (!context.customerName.trim() || !context.customerPhone.trim()) {
      return t('exp_payment_validation_customer') as string;
    }

    if (!context.agreeTerms || !context.agreeSafety || !context.agreeNoOffPlatform) {
      return t('exp_payment_validation_agreements') as string;
    }

    return null;
  }, [t]);

  const setPaymentMethodChecked = useCallback((nextMethod: PaymentMethod) => {
    flushSync(() => {
      setPaymentMethod(nextMethod);
    });
  }, []);

  const markAgreementChecked = useCallback((key: AgreementKey) => {
    flushSync(() => {
      if (key === 'off_platform') setAgreeNoOffPlatform(true);
      if (key === 'manners') setAgreeSafety(true);
      if (key === 'refund') setAgreeTerms(true);
    });
  }, []);

  const closeAgreementModal = useCallback(() => {
    if (activeAgreement) {
      markAgreementChecked(activeAgreement);
    }
    setActiveAgreement(null);
  }, [activeAgreement, markAgreementChecked]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!feeInfoRef.current?.contains(event.target as Node)) {
        setIsFeeInfoOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!activeAgreement) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAgreementModal();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEsc);
    };
  }, [activeAgreement, closeAgreementModal]);

  useEffect(() => {
    latestPayPalContextRef.current = {
      customerName,
      customerPhone,
      agreeTerms,
      agreeSafety,
      agreeNoOffPlatform,
    };
  }, [agreeNoOffPlatform, agreeSafety, agreeTerms, customerName, customerPhone]);

  const refreshSlotSummary = useCallback(async () => {
    if (!experienceId || !date || !time || date === t('exp_payment_date_tbd') || time === t('exp_payment_time_tbd')) {
      setSlotSummary(null);
      setHasSlotSummaryLoaded(false);
      setIsSlotSummaryResolved(true);
      return;
    }

    setIsSlotSummaryResolved(false);

    try {
      const response = await fetch(`/api/experiences/${experienceId}/availability-summary`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch slot summary: ${response.status}`);
      }

      const summary = (await response.json()) as ExperienceAvailabilitySummary;
      const slotKey = `${date}_${time.slice(0, 5)}`;

      setSlotSummary(summary.slotSummaryMap?.[slotKey] || null);
      setHasSlotSummaryLoaded(true);
    } catch (error) {
      console.error('Payment slot summary fetch error:', error);
      setSlotSummary(null);
      setHasSlotSummaryLoaded(false);
    } finally {
      setIsSlotSummaryResolved(true);
    }
  }, [date, experienceId, t, time]);

  useEffect(() => {
    let isMounted = true;

    const fetchCardReady = async () => {
      try {
        const response = await fetch('/api/payment/card-ready', {
          cache: 'no-store',
        });
        const result = (await response.json()) as ExperienceCardReadyResponse;

        if (!isMounted) return;

        setIsCardReady(Boolean(response.ok && result.ready));
        setCardProvider(result.provider || 'portone');
        setCardReadyReason(response.ok && !result.ready ? result.reason || '' : '');
      } catch {
        if (!isMounted) return;

        setIsCardReady(false);
        setCardProvider('portone');
        setCardReadyReason('missing_portone_credentials');
      } finally {
        if (isMounted) {
          setIsCardReadyResolved(true);
        }
      }
    };

    void fetchCardReady();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    void refreshSlotSummary();
  }, [refreshSlotSummary]);

  useEffect(() => {
    if (!requestedSoloGuarantee) {
      soloOptionNoticeShownRef.current = false;
      return;
    }

    if (!isSlotSummaryResolved || !hasSlotSummaryLoaded || effectiveIsSoloGuarantee || !searchParams) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('solo');
    const nextQuery = nextParams.toString();

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);

    if (!soloOptionNoticeShownRef.current) {
      showToast(t('exp_payment_solo_removed') as string, 'error');
      soloOptionNoticeShownRef.current = true;
    }
  }, [
    effectiveIsSoloGuarantee,
    hasSlotSummaryLoaded,
    isSlotSummaryResolved,
    pathname,
    requestedSoloGuarantee,
    router,
    searchParams,
    showToast,
    t,
  ]);

  useEffect(() => {
    if (!isPayPalEnabled && paymentMethod === 'paypal') {
      setPaymentMethod(isCardReadyResolved && !isCardReady ? 'bank' : 'card');
      return;
    }

    if (
      isCardReadyResolved &&
      !isCardReady &&
      paymentMethod === 'card' &&
      !hasManualPaymentMethodSelectionRef.current
    ) {
      setPaymentMethod('bank');
    }
  }, [isCardReady, isCardReadyResolved, isPayPalEnabled, paymentMethod]);

  useEffect(() => {
    if (paymentMethod !== 'paypal') {
      paypalSessionRef.current = null;
      setPaymentError('');
    }
  }, [date, effectiveIsSoloGuarantee, experienceId, guests, isPrivate, paymentMethod, time]);

  useEffect(() => {
    const fetchExp = async () => {
      if (!experienceId) return;

      const { data: expData } = await supabase
        .from('experiences')
        .select('title, image_url, photos, location, price, private_price, max_guests, host_id, rules, rules_i18n')
        .eq('id', experienceId)
        .maybeSingle();
      if (expData) setExperience(expData as PaymentExperience);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle();
        if (profile) {
          setCustomerName(profile.full_name || '');
          setCustomerPhone(profile.phone || '');
        }

        if (experienceId) {
          sendAnalyticsEvent('payment_init', experienceId);
        }
      }
    };
    fetchExp();
  }, [experienceId, supabase]);

  const checkAvailability = useCallback(async () => {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('guests, type')
      .eq('experience_id', experienceId)
      .eq('date', date)
      .eq('time', time)
      // [Fix] PENDING 포함 BLOCKING → ACTIVE 전용으로 교체
      // — PENDING 예약이 자동 취소되기 전 클라이언트 용량 체크가 false "자리 없음"을 반환하는 버그 수정
      // 실제 용량 보호는 서버 RPC가 atomic하게 담당
      .in('status', [...BOOKING_ACTIVE_STATUS_FOR_CAPACITY]);

    const bookingRows = (bookings || []) as BookingCheckRow[];
    const currentBookedCount = bookingRows.reduce((sum, b) => sum + Number(b.guests || 0), 0);
    const hasPrivateBooking = bookingRows.some((b) => b.type === 'private');
    const maxGuests = Number(experience?.max_guests || 10);

    if (hasPrivateBooking) return false;
    if (isPrivate && currentBookedCount > 0) return false;
    if (!isPrivate && (currentBookedCount + guests > maxGuests)) return false;

    return true;
  }, [supabase, experienceId, date, time, experience?.max_guests, guests, isPrivate]);

  const preparePayPalBooking = useCallback(async () => {
    setHasAttemptedSubmit(true);
    const context = latestPayPalContextRef.current;
    const validationMessage = getCheckoutValidationError(context);

    if (validationMessage) {
      setPaymentError(validationMessage);
      showToast(validationMessage, 'error');
      throw new Error(validationMessage);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const message = t('login_required') as string;
      setPaymentError(message);
      showToast(message, 'error');
      router.push('/login');
      throw new Error(message);
    }

    const sessionKey = payPalCheckoutSessionKey;
    const existingSession = paypalSessionRef.current;
    if (existingSession && existingSession.key === sessionKey) {
      return existingSession;
    }

    const isAvailable = await checkAvailability();
    if (!isAvailable) {
      const message = isPrivate
        ? (t('exp_payment_private_conflict') as string)
        : (t('exp_payment_capacity_conflict') as string);
      setPaymentError(message);
      showToast(message, 'error');
      throw new Error(message);
    }

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experienceId,
        date,
        time,
        guests,
        isPrivate,
        isSoloGuarantee: effectiveIsSoloGuarantee,
        customerName: context.customerName,
        customerPhone: context.customerPhone,
        paymentMethod: 'paypal',
      }),
    });

    const result = (await res.json()) as BookingApiResponse;

    if (!res.ok || !result.success || !result.newOrderId) {
      const message = getLocalizedBookingApiError(result);
      setPaymentError(message);
      showToast(message, 'error');
      throw new Error(message);
    }

    const nextSession = {
      bookingId: result.newOrderId,
      orderId: result.newOrderId,
      key: sessionKey,
    };

    paypalSessionRef.current = nextSession;
    return nextSession;
  }, [
    checkAvailability,
    date,
    experienceId,
    getCheckoutValidationError,
    getLocalizedBookingApiError,
    guests,
    isPrivate,
    effectiveIsSoloGuarantee,
    payPalCheckoutSessionKey,
    router,
    showToast,
    supabase.auth,
    t,
    time,
  ]);

  const createPayPalOrder = useCallback(async () => {
    setHasAttemptedSubmit(true);
    setPaymentError('');
    setIsProcessing(true);

    try {
      const session = await preparePayPalBooking();
      const response = await fetch('/api/payment/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: session.bookingId }),
      });

      const result = (await response.json()) as PayPalCreateOrderResponse;
      if (!response.ok || !result.success || !result.paypalOrderId) {
        const message = result.error || (t('exp_payment_paypal_create_error') as string);
        setPaymentError(message);
        showToast(message, 'error');
        throw new Error(message);
      }

      return result.paypalOrderId;
    } finally {
      setIsProcessing(false);
    }
  }, [preparePayPalBooking, showToast, t]);

  const handlePayPalApprove = useCallback(
    async (data: PayPalApproveData) => {
      setPaymentError('');
      setIsProcessing(true);

      try {
        const session = paypalSessionRef.current;
        if (!session) {
          throw new Error(t('exp_payment_paypal_session_missing') as string);
        }

        const response = await fetch('/api/payment/paypal/capture-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: session.bookingId,
            paypalOrderId: data.orderID,
          }),
        });

        const result = (await response.json()) as PayPalCaptureResponse;
        if (!response.ok || !result.success) {
          const message = result.error || (t('exp_payment_paypal_capture_error') as string);
          setPaymentError(message);
          showToast(message, 'error');
          return;
        }

        router.push(`/experiences/${experienceId}/payment/complete?orderId=${session.orderId}`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : (t('exp_payment_paypal_capture_processing_error') as string);
        setPaymentError(message);
        showToast(message, 'error');
      } finally {
        setIsProcessing(false);
      }
    },
    [experienceId, router, showToast, t]
  );

  useEffect(() => {
    createPayPalOrderRef.current = createPayPalOrder;
  }, [createPayPalOrder]);

  useEffect(() => {
    handlePayPalApproveRef.current = handlePayPalApprove;
  }, [handlePayPalApprove]);

  useEffect(() => {
    if (!isPayPalSdkReady) {
      setIsPayPalButtonsReady(false);
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const syncPayPalButtons = () => {
      if (cancelled) return;

      if (window.paypal?.Buttons) {
        setIsPayPalButtonsReady(true);
        return;
      }

      if (attempts >= 20) {
        setIsPayPalButtonsReady(false);
        return;
      }

      attempts += 1;
      window.setTimeout(syncPayPalButtons, 50);
    };

    syncPayPalButtons();

    return () => {
      cancelled = true;
    };
  }, [isPayPalSdkReady]);

  useEffect(() => {
    const container = paypalButtonRef.current;

    if (paymentMethod !== 'paypal' || !isPayPalEnabled) {
      if (container && paypalRenderedKeyRef.current) {
        container.innerHTML = '';
      }
      paypalRenderedKeyRef.current = '';
      return;
    }

    if (!container) {
      return;
    }

    if (
      !isSlotSummaryResolved ||
      !isPayPalButtonsReady ||
      !window.paypal?.Buttons
    ) {
      return;
    }

    const nextRenderKey = `${payPalCheckoutSessionKey}:${paymentMethod}`;
    if (paypalRenderedKeyRef.current === nextRenderKey) {
      return;
    }

    paypalRenderedKeyRef.current = '';
    container.innerHTML = '';

    window.paypal
      .Buttons({
        style: {
          color: 'gold',
          shape: 'rect',
          label: 'paypal',
          layout: 'vertical',
          height: 48,
        },
        createOrder: async () => createPayPalOrderRef.current(),
        onApprove: async (data) => handlePayPalApproveRef.current(data),
        onCancel: () => {
          setIsProcessing(false);
          showToast(t('exp_payment_paypal_cancelled') as string, 'error');
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : (t('exp_payment_paypal_button_error') as string);
          console.error('[PAYPAL] client button error:', error);
          setPaymentError(message);
          setIsProcessing(false);
          showToast(message, 'error');
        },
      })
      .render(container)
      .then(() => {
        paypalRenderedKeyRef.current = nextRenderKey;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : (t('exp_payment_paypal_load_error') as string);
        console.error('[PAYPAL] button render error:', error);
        paypalRenderedKeyRef.current = '';
        setPaypalSdkError(message);
        setPaymentError(message);
        showToast(message, 'error');
      });
  }, [
    isPayPalEnabled,
    isPayPalButtonsReady,
    isSlotSummaryResolved,
    payPalCheckoutSessionKey,
    paymentMethod,
    showToast,
    t,
  ]);

  useEffect(() => {
    const container = paypalButtonRef.current;
    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, []);

  const handlePayment = async () => {
    setHasAttemptedSubmit(true);
    setPaymentError('');

    const validationMessage = getCheckoutValidationError({
      customerName,
      customerPhone,
      agreeTerms,
      agreeSafety,
      agreeNoOffPlatform,
    });
    if (validationMessage) {
      setPaymentError(validationMessage);
      return showToast(validationMessage, 'error');
    }

    if (!isSlotSummaryResolved) {
      const message = t('exp_payment_missing_availability') as string;
      setPaymentError(message);
      return showToast(message, 'error');
    }

    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const message = t('login_required') as string;
        setPaymentError(message);
        showToast(message, 'error');
        setIsProcessing(false);
        router.push('/login');
        return;
      }

      const isAvailable = await checkAvailability();
      if (!isAvailable) {
        const message = isPrivate
          ? (t('exp_payment_private_conflict') as string)
          : (t('exp_payment_capacity_conflict') as string);
        setPaymentError(message);
        showToast(message, 'error');
        setIsProcessing(false);
        return;
      }

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experienceId,
          date,
          time,
          guests,
          isPrivate,
          isSoloGuarantee: effectiveIsSoloGuarantee,
          customerName,
          customerPhone,
          paymentMethod
        })
      });

      const result = (await res.json()) as BookingApiResponse;

      if (!res.ok || !result.success || !result.newOrderId || result.finalAmount == null) {
        const message = getLocalizedBookingApiError(result);
        setPaymentError(message);
        showToast(message, 'error');
        setIsProcessing(false);
        return;
      }

      const { newOrderId, finalAmount: secureFinalAmount } = result;

      if (paymentMethod === 'bank') {
        router.push(`/experiences/${experienceId}/payment/complete?orderId=${newOrderId}`);
        return;
      }

      if (!isCardReady || !portOneImpCode) {
        const message = t('exp_payment_card_unavailable') as string;
        setPaymentError(message);
        showToast(message, 'error');
        setIsProcessing(false);
        return;
      }

      try {
        const paymentSession = await launchCardPayment({
          provider: cardProvider,
          merchantCode: portOneImpCode,
          orderId: newOrderId,
          productName: experience?.title || (t('exp_payment_fallback_product_name') as string),
          amount: Number(secureFinalAmount),
          buyerEmail: user.email,
          buyerName: customerName,
          buyerTel: customerPhone,
          redirectUrl: `${window.location.origin}/api/payment/nicepay-callback`,
        });

        const response = await fetch('/api/payment/nicepay-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imp_uid: paymentSession.approvalId,
            approvalId: paymentSession.approvalId,
            merchant_uid: newOrderId,
            orderId: newOrderId,
          }),
        });
        const callbackResult = (await response.json()) as { success?: boolean; error?: string };

        if (!response.ok || !callbackResult.success) {
          const message = [t('exp_payment_card_verify_error'), callbackResult.error]
            .filter(Boolean)
            .join(' ');
          setPaymentError(message);
          showToast(message, 'error');
          setIsProcessing(false);
          return;
        }

        router.push(`/experiences/${experienceId}/payment/complete?orderId=${newOrderId}`);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : (t('exp_payment_card_process_error') as string);
        setPaymentError(message);
        showToast(message, 'error');
        setIsProcessing(false);
      }

    } catch (error: unknown) {
      console.error(error);
      const message = t('server_error') as string;
      setPaymentError(message);
      showToast(message, 'error');
      setIsProcessing(false);
    }
  };

  const imageUrl = experience?.photos?.[0] || experience?.image_url || 'https://images.unsplash.com/photo-1540206395-688085723adb';
  const bankInfo = getPublicBankInfo();
  const normalizedCustomerName = customerName.trim();
  const normalizedCustomerPhone = customerPhone.trim();
  const hasCustomerName = normalizedCustomerName.length > 0;
  const hasCustomerPhone = normalizedCustomerPhone.length > 0;
  const isBookerComplete = hasCustomerName && hasCustomerPhone;
  const areRequiredAgreementsComplete = agreeTerms && agreeSafety && agreeNoOffPlatform;
  const hasAvailabilityConflict =
    paymentError === (t('exp_payment_missing_availability') as string) ||
    paymentError === (t('exp_payment_private_conflict') as string) ||
    paymentError === (t('exp_payment_capacity_conflict') as string);
  const isSummaryLoading = !experience || !isSlotSummaryResolved;
  const isCardMethodLoading = paymentMethod === 'card' && !isCardReadyResolved;
  const isCardMethodError = paymentMethod === 'card' && isCardReadyResolved && !isCardReady;
  const isPayPalMethodLoading =
    paymentMethod === 'paypal' &&
    (!isSlotSummaryResolved || ((!isPayPalSdkReady || !isPayPalButtonsReady) && !paypalSdkError));
  const isPayPalMethodError = paymentMethod === 'paypal' && Boolean(paypalSdkError);
  const isSubmitDisabled =
    isProcessing ||
    !isSlotSummaryResolved ||
    (paymentMethod === 'card' && (!isCardReadyResolved || !isCardReady));
  const summaryStatus: CheckoutSectionState = isSummaryLoading
    ? 'loading'
    : hasAvailabilityConflict
      ? 'error'
      : 'complete';
  const bookerStatus: CheckoutSectionState = isBookerComplete
    ? 'complete'
    : hasAttemptedSubmit
      ? 'error'
      : 'required';
  const paymentMethodStatus: CheckoutSectionState = isCardMethodLoading || isPayPalMethodLoading
    ? 'loading'
    : isCardMethodError || isPayPalMethodError
      ? 'error'
      : 'complete';
  const finalSectionStatus: CheckoutSectionState = isProcessing
    ? 'loading'
    : !isBookerComplete || !areRequiredAgreementsComplete
      ? (hasAttemptedSubmit ? 'error' : 'required')
      : isCardMethodLoading || isPayPalMethodLoading
        ? 'loading'
        : isCardMethodError || isPayPalMethodError
          ? 'error'
          : 'complete';
  const sectionStatusLabel = {
    complete: t('btn_complete') as string,
    required: t('exp_payment_state_required') as string,
    error: t('exp_payment_state_error') as string,
    loading: t('exp_payment_state_loading') as string,
  };
  const nameInputError = hasAttemptedSubmit && !hasCustomerName;
  const phoneInputError = hasAttemptedSubmit && !hasCustomerPhone;
  const agreementsError = hasAttemptedSubmit && !areRequiredAgreementsComplete;
  const checkoutHelperText = (() => {
    if (isProcessing) return t('status_processing') as string;
    if (!isSlotSummaryResolved) return t('exp_payment_slot_loading') as string;
    if (!isBookerComplete) return t('exp_payment_validation_customer') as string;
    if (!areRequiredAgreementsComplete) return t('exp_payment_validation_agreements') as string;
    if (paymentMethod === 'card' && !isCardReadyResolved) {
      return t('exp_payment_card_loading') as string;
    }
    if (paymentMethod === 'card' && !isCardReady) {
      return (cardReadyReason === 'missing_imp_code'
        ? t('exp_payment_card_unavailable_config')
        : t('exp_payment_card_unavailable_alternative')) as string;
    }
    if (paymentMethod === 'paypal' && paypalSdkError) return paypalSdkError;
    if (paymentMethod === 'paypal' && (!isPayPalSdkReady || !isPayPalButtonsReady)) {
      return t('exp_payment_paypal_loading') as string;
    }
    return '';
  })();
  const visiblePaymentError = (() => {
    if (!paymentError) return '';
    if (paymentError === (t('exp_payment_validation_customer') as string) && isBookerComplete) return '';
    if (paymentError === (t('exp_payment_validation_agreements') as string) && areRequiredAgreementsComplete) return '';
    if (
      paymentMethod !== 'card' &&
      paymentError === (t('exp_payment_card_unavailable') as string)
    ) {
      return '';
    }
    if (
      paymentMethod !== 'paypal' &&
      (paymentError === (t('exp_payment_paypal_load_error') as string) ||
        paymentError === (t('exp_payment_paypal_button_error') as string))
    ) {
      return '';
    }
    return paymentError;
  })();
  const agreementRows = [
    {
      key: 'off_platform' as const,
      checked: agreeNoOffPlatform,
      testId: 'exp-payment-agree-off-platform',
      labelKey: 'exp_payment_agree_off_platform_label',
      titleKey: 'exp_payment_agree_off_platform_title',
      bodyKey: 'exp_payment_agree_off_platform_body',
    },
    {
      key: 'manners' as const,
      checked: agreeSafety,
      testId: 'exp-payment-agree-safety',
      labelKey: 'exp_payment_agree_manners_label',
      titleKey: 'exp_payment_agree_manners_title',
      bodyKey: 'exp_payment_agree_manners_body',
    },
    {
      key: 'refund' as const,
      checked: agreeTerms,
      testId: 'exp-payment-agree-terms',
      labelKey: 'exp_payment_agree_terms_label',
      titleKey: 'exp_payment_agree_terms_title',
      bodyKey: 'exp_payment_agree_terms_body',
    },
  ];
  const activeAgreementMeta = agreementRows.find((agreement) => agreement.key === activeAgreement) || null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-6 md:py-10 font-sans px-3 md:px-4">
      <Script src="https://cdn.iamport.kr/v1/iamport.js" strategy="afterInteractive" />
      {isPayPalEnabled && (
        <Script
          id="paypal-js-sdk"
          src={`https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=KRW&intent=capture&components=buttons`}
          strategy="afterInteractive"
          onLoad={() => {
            setPaypalSdkError('');
            setIsPayPalSdkReady(true);
          }}
          onError={() => {
            const message = t('exp_payment_paypal_load_error') as string;
            setPaypalSdkError(message);
            setIsPayPalSdkReady(false);
            setIsPayPalButtonsReady(false);
          }}
        />
      )}

      <div className="bg-white w-full max-w-md rounded-2xl md:rounded-3xl shadow-lg md:shadow-xl overflow-hidden border border-slate-100">
        <div className="h-12 md:h-16 border-b border-slate-100 flex items-center px-3 md:px-4 gap-2.5 md:gap-4 bg-white sticky top-0 z-10">
          <button onClick={() => router.back()} className="p-1.5 md:p-2 hover:bg-slate-50 rounded-full transition-colors"><ChevronLeft className="w-5 h-5 md:w-6 md:h-6" /></button>
          <span className="font-black text-[15px] md:text-lg">{t('exp_payment_title')}</span>
        </div>

        <div className="space-y-4 p-4 md:space-y-5 md:p-6">
          {visiblePaymentError && (
            <StatusNotice
              tone="error"
              testId="exp-payment-global-error"
            >
              {visiblePaymentError}
            </StatusNotice>
          )}

          <PaymentSectionCard
            step={1}
            title={t('exp_payment_summary_title') as string}
            status={summaryStatus}
            statusLabel={sectionStatusLabel[summaryStatus]}
            testId="exp-payment-section-summary"
          >
            <div className="flex gap-3 md:gap-5">
              <div className="relative h-28 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-200 shadow-sm md:h-32 md:w-24 md:rounded-xl">
                <Image src={imageUrl} alt="Experience" fill unoptimized className="object-cover" sizes="100px" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center py-1">
                <span className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 md:mb-1.5 md:text-xs">
                  {experience?.location || 'SEOUL'}
                </span>
                <h3 className="line-clamp-3 text-[15px] font-bold leading-snug text-slate-900 md:text-lg">
                  {experience ? experience.title : <Spinner inline size={16} className="inline-block" ariaHidden />}
                </h3>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-[12px] text-slate-700 md:rounded-2xl md:p-5 md:text-sm">
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-500 md:gap-2">
                    <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4" /> {t('exp_payment_label_date')}
                  </span>
                  <span className="font-bold">{date}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-500 md:gap-2">
                    <Clock className="h-3.5 w-3.5 md:h-4 md:w-4" /> {t('exp_payment_label_time')}
                  </span>
                  <span className="font-bold">{time}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-500 md:gap-2">
                    <Users className="h-3.5 w-3.5 md:h-4 md:w-4" /> {t('exp_payment_label_guests')}
                  </span>
                  <span className="font-bold">{t('trip_meta_guests', { count: String(guests) })}</span>
                </div>
                {isPrivate && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500 md:gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 md:h-4 md:w-4" /> {t('exp_payment_label_type')}
                    </span>
                    <span className="font-bold text-rose-500">{t('exp_payment_private_type')}</span>
                  </div>
                )}
                {effectiveIsSoloGuarantee && (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[11px] leading-relaxed text-slate-500 md:text-xs">
                    <span className="font-semibold text-slate-700">{t('exp_payment_solo_note')}</span>
                  </div>
                )}
              </div>
            </div>

            {hostNotice && (
              <StatusNotice tone="warning" className="mt-4">
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 md:text-xs">
                    {t('exp_guest_notice_title')}
                  </p>
                  <p className="whitespace-pre-wrap">{hostNotice}</p>
                </div>
              </StatusNotice>
            )}
          </PaymentSectionCard>

          <PaymentSectionCard
            step={2}
            title={t('exp_payment_booker_title') as string}
            status={bookerStatus}
            statusLabel={sectionStatusLabel[bookerStatus]}
            testId="exp-payment-section-booker"
          >
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-500 md:mb-1.5 md:text-xs">
                  {t('exp_payment_name_label')}
                </label>
                <input
                  data-testid="exp-payment-booker-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none transition-colors md:rounded-xl md:p-3 md:text-sm',
                    nameInputError
                      ? 'border-rose-300 bg-rose-50/80 focus:border-rose-500'
                      : 'border-slate-200 bg-slate-50 focus:border-black'
                  )}
                  placeholder={t('exp_payment_name_placeholder') as string}
                />
                {nameInputError && (
                  <p
                    data-testid="exp-payment-booker-name-error"
                    className="mt-2 text-[11px] text-rose-600 md:text-xs"
                  >
                    {t('exp_payment_name_required_inline')}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-500 md:mb-1.5 md:text-xs">
                  {t('exp_payment_phone_label')}
                </label>
                <input
                  data-testid="exp-payment-booker-phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2.5 text-[13px] outline-none transition-colors md:rounded-xl md:p-3 md:text-sm',
                    phoneInputError
                      ? 'border-rose-300 bg-rose-50/80 focus:border-rose-500'
                      : 'border-slate-200 bg-slate-50 focus:border-black'
                  )}
                  placeholder={t('exp_payment_phone_placeholder') as string}
                />
                {phoneInputError && (
                  <p
                    data-testid="exp-payment-booker-phone-error"
                    className="mt-2 text-[11px] text-rose-600 md:text-xs"
                  >
                    {t('exp_payment_phone_required_inline')}
                  </p>
                )}
              </div>
            </div>
          </PaymentSectionCard>

          <PaymentSectionCard
            step={3}
            title={t('exp_payment_method_title') as string}
            status={paymentMethodStatus}
            statusLabel={sectionStatusLabel[paymentMethodStatus]}
            testId="exp-payment-section-method"
          >
            <div className={cn('mb-3 grid gap-2 md:mb-4 md:gap-3', isPayPalEnabled ? 'grid-cols-3' : 'grid-cols-2')}>
              <button
                data-testid="exp-payment-method-card"
                type="button"
                onClick={() => {
                  if (isCardReadyResolved && isCardReady) {
                    hasManualPaymentMethodSelectionRef.current = true;
                    setPaymentMethodChecked('card');
                  }
                }}
                disabled={!isCardReadyResolved || !isCardReady}
                className={cn(
                  'rounded-lg border-2 p-3 transition-all md:rounded-xl md:p-4',
                  'flex flex-col items-center gap-1.5 md:gap-2',
                  paymentMethod === 'card'
                    ? 'border-black bg-slate-50 text-black shadow-sm'
                    : !isCardReadyResolved || !isCardReady
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                      : 'border-slate-100 text-slate-400 hover:border-slate-200'
                )}
              >
                <CreditCard className="h-5 w-5 md:h-6 md:w-6" />
                <span className="text-[12px] font-bold md:text-sm">{t('exp_payment_method_card')}</span>
              </button>
              <button
                data-testid="exp-payment-method-bank"
                type="button"
                onClick={() => {
                  hasManualPaymentMethodSelectionRef.current = true;
                  setPaymentMethodChecked('bank');
                }}
                className={cn(
                  'rounded-lg border-2 p-3 transition-all md:rounded-xl md:p-4',
                  'flex flex-col items-center gap-1.5 md:gap-2',
                  paymentMethod === 'bank'
                    ? 'border-black bg-slate-50 text-black shadow-sm'
                    : 'border-slate-100 text-slate-400 hover:border-slate-200'
                )}
              >
                <div className="flex items-center gap-1">
                  <Users className="h-5 w-5 md:h-6 md:w-6" />
                  <span className="rounded bg-rose-100 px-1 text-[9px] font-bold text-rose-600 md:text-[10px]">
                    {t('exp_payment_method_recommended')}
                  </span>
                </div>
                <span className="text-[12px] font-bold md:text-sm">{t('exp_payment_method_bank')}</span>
              </button>
              {isPayPalEnabled && (
                <button
                  data-testid="exp-payment-method-paypal"
                  type="button"
                  onClick={() => {
                    hasManualPaymentMethodSelectionRef.current = true;
                    setPaymentMethodChecked('paypal');
                  }}
                  className={cn(
                    'rounded-lg border-2 p-3 transition-all md:rounded-xl md:p-4',
                    'flex flex-col items-center gap-1.5 md:gap-2',
                    paymentMethod === 'paypal'
                      ? 'border-black bg-slate-50 text-black shadow-sm'
                      : 'border-slate-100 text-slate-400 hover:border-slate-200'
                  )}
                >
                  <div className="rounded bg-[#0070ba] px-2 py-0.5 text-[10px] font-black text-white">PayPal</div>
                  <span className="text-[12px] font-bold md:text-sm">{t('exp_payment_method_paypal')}</span>
                </button>
              )}
            </div>

            {isCardReadyResolved && !isCardReady && (
              <StatusNotice tone="warning" size="sm" className="mb-3">
                {cardReadyReason === 'missing_imp_code'
                  ? t('exp_payment_card_unavailable_config')
                  : t('exp_payment_card_unavailable_alternative')}
              </StatusNotice>
            )}

            {paymentMethod === 'bank' && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 animate-in fade-in zoom-in-95 md:rounded-xl md:p-4">
                <p className="mb-1 text-[11px] font-bold text-slate-500 md:text-xs">{t('exp_payment_bank_label')}</p>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[16px] font-black text-slate-900 md:text-lg">{bankInfo.account}</span>
                  <span className="rounded bg-yellow-300 px-1 py-0.5 text-[10px] font-bold text-black md:px-1.5 md:text-xs">
                    {bankInfo.bankName}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 md:text-xs">
                  {t('exp_payment_bank_timeout_prefix')} <span className="font-bold text-rose-500">{t('exp_payment_bank_timeout_highlight')}</span>{t('exp_payment_bank_timeout_suffix')}
                </p>
              </div>
            )}

            {paymentMethod === 'paypal' && (
              <div
                data-testid="exp-payment-paypal-panel"
                className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 animate-in fade-in zoom-in-95 md:rounded-xl md:p-4"
              >
                <div className="text-[11px] leading-relaxed text-slate-500 md:text-xs">
                  {t('exp_payment_paypal_desc')}
                </div>
                {!isSlotSummaryResolved && (
                  <StatusNotice
                    tone="info"
                    size="sm"
                    icon={null}
                    testId="exp-payment-paypal-loading-notice"
                    className="items-center border-dashed bg-white text-[12px] text-slate-500"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Spinner inline size={16} className="text-slate-500" ariaHidden />
                      <span>{t('exp_payment_slot_loading')}</span>
                    </span>
                  </StatusNotice>
                )}
                {paypalSdkError && (
                  <StatusNotice
                    tone="error"
                    size="sm"
                    testId="exp-payment-paypal-error-notice"
                  >
                    {paypalSdkError}
                  </StatusNotice>
                )}
                {isSlotSummaryResolved && (!isPayPalSdkReady || !isPayPalButtonsReady) && !paypalSdkError && (
                  <StatusNotice
                    tone="info"
                    size="sm"
                    icon={null}
                    testId="exp-payment-paypal-loading-notice"
                    className="items-center border-dashed bg-white text-[12px] text-slate-500"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Spinner inline size={16} className="text-slate-500" ariaHidden />
                      <span>{t('exp_payment_paypal_loading')}</span>
                    </span>
                  </StatusNotice>
                )}
                <div
                  ref={paypalButtonRef}
                  className={cn(
                    'transition-opacity duration-200',
                    isPayPalButtonsReady && isSlotSummaryResolved ? 'min-h-[48px] opacity-100' : 'hidden opacity-0'
                  )}
                />
              </div>
            )}
          </PaymentSectionCard>

          <PaymentSectionCard
            step={4}
            title={t('exp_payment_final_title') as string}
            status={finalSectionStatus}
            statusLabel={sectionStatusLabel[finalSectionStatus]}
            testId="exp-payment-section-final"
          >
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-4 text-[12px] md:rounded-2xl md:px-5 md:py-5 md:text-sm">
                <div className="space-y-1.5 md:space-y-2">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>{t('exp_payment_host_price')}</span>
                    <span>₩{baseHostPrice.toLocaleString()}</span>
                  </div>
                  {effectiveIsSoloGuarantee && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>{t('exp_payment_solo_price')}</span>
                      <span>+ ₩{soloGuaranteePrice.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-blue-600">
                    <span className="flex items-center gap-1">
                      {t('exp_payment_platform_fee')}
                      <span
                        ref={feeInfoRef}
                        className="relative inline-flex"
                        onMouseEnter={() => setIsFeeInfoOpen(true)}
                        onMouseLeave={() => setIsFeeInfoOpen(false)}
                      >
                        <button
                          type="button"
                          data-testid="exp-payment-platform-fee-trigger"
                          aria-label={t('exp_payment_platform_fee_aria') as string}
                          aria-expanded={isFeeInfoOpen}
                          onClick={() => setIsFeeInfoOpen(true)}
                          onFocus={() => setIsFeeInfoOpen(true)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 md:h-5 md:w-5"
                        >
                          <Info className="h-3 w-3 md:h-3.5 md:w-3.5" />
                        </button>
                        {isFeeInfoOpen && (
                          <div
                            data-testid="exp-payment-platform-fee-tooltip"
                            className="absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium leading-relaxed text-slate-600 shadow-xl md:w-64 md:text-xs"
                          >
                            {t('exp_payment_platform_fee_tooltip')}
                          </div>
                        )}
                      </span>
                    </span>
                    <span>+ ₩{guestFee.toLocaleString()}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 md:mt-4 md:pt-4">
                  <span className="font-bold text-slate-900">{t('exp_payment_total')}</span>
                  <span data-testid="exp-payment-total-amount" className="text-[24px] font-black text-slate-900 md:text-3xl">₩{finalAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-2.5 rounded-xl border border-red-100 bg-red-50/50 p-4 md:rounded-2xl md:p-5">
                <h3 className="mb-1 flex items-center gap-1 text-[13px] font-bold text-red-600 md:text-sm">
                  <ShieldCheck className="h-3.5 w-3.5 md:h-4 md:w-4" /> {t('exp_payment_safety_title')}
                </h3>

                {agreementRows.map((agreement) => (
                  <button
                  key={agreement.key}
                  type="button"
                  role="checkbox"
                  aria-checked={agreement.checked}
                  data-testid={agreement.testId}
                  onClick={() => setActiveAgreement(agreement.key)}
                  className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-white/50 md:gap-3 md:p-2"
                >
                    <div
                      className={cn(
                        'mt-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded border transition-colors md:h-5 md:min-w-[20px]',
                        agreement.checked ? 'border-black bg-black text-white' : 'border-slate-300 bg-white text-transparent'
                      )}
                    >
                      <CheckCircle2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1 text-[12px] font-medium leading-[1.45] text-slate-700 md:text-sm md:leading-snug">
                      {t(agreement.labelKey)}
                    </div>
                  </button>
                ))}

                {agreementsError && (
                  <StatusNotice
                    tone="error"
                    size="sm"
                    testId="exp-payment-agreements-error"
                    className="mt-1"
                  >
                    {t('exp_payment_agreements_inline_required')}
                  </StatusNotice>
                )}
              </div>

              {paymentMethod !== 'paypal' ? (
                <Button
                  data-testid="exp-payment-submit"
                  type="button"
                  onClick={handlePayment}
                  disabled={isSubmitDisabled}
                  isLoading={isProcessing}
                  loadingLabel={t('status_processing') as string}
                  spinnerVariant="inverse"
                  interaction="app"
                  size="lg"
                  variant="primary"
                  className={cn(
                    'h-12 w-full px-0 text-[15px] md:h-14 md:rounded-2xl md:text-lg',
                    'bg-black text-white hover:bg-slate-800',
                    'disabled:bg-slate-300 disabled:text-slate-100 disabled:shadow-none'
                  )}
                >
                  <>
                    <CreditCard className="h-[18px] w-[18px] md:h-5 md:w-5" />
                    {t('exp_payment_pay_button', { amount: `₩${finalAmount.toLocaleString()}` })}
                  </>
                </Button>
              ) : (
                <StatusNotice tone="info" className="justify-center bg-white text-center md:text-sm">
                  {t('exp_payment_paypal_button_hint')}
                </StatusNotice>
              )}

              {checkoutHelperText && (
                <p
                  data-testid="exp-payment-submit-helper"
                  className={cn(
                    'text-center text-[11px] leading-relaxed md:text-xs',
                    isSubmitDisabled || hasAttemptedSubmit ? 'text-slate-500' : 'text-slate-400'
                  )}
                >
                  {checkoutHelperText}
                </p>
              )}
            </div>
          </PaymentSectionCard>
        </div>
      </div>

      {activeAgreementMeta && (
        <div
          className="fixed inset-0 z-[220] flex items-end bg-black/45 p-0 backdrop-blur-[1px] md:items-center md:justify-center md:p-4"
          data-testid="exp-payment-agreement-modal-overlay"
          onClick={closeAgreementModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="exp-payment-agreement-modal-title"
            data-testid="exp-payment-agreement-modal"
            data-agreement-key={activeAgreementMeta.key}
            className="relative w-full rounded-t-[26px] bg-white px-5 pb-[calc(max(env(safe-area-inset-bottom,0px),0px)+20px)] pt-5 shadow-2xl md:max-w-md md:rounded-[28px] md:px-6 md:pb-6 md:pt-6"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeAgreementModal}
              data-testid="exp-payment-agreement-modal-close"
              className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3
              id="exp-payment-agreement-modal-title"
              data-testid="exp-payment-agreement-modal-title"
              className="pr-10 text-[18px] font-bold leading-snug text-slate-900 md:text-[20px]"
            >
              {t(activeAgreementMeta.titleKey)}
            </h3>
            <p
              data-testid="exp-payment-agreement-modal-body"
              className="mt-3 whitespace-pre-line text-[13px] leading-6 text-slate-600 md:text-sm"
            >
              {t(activeAgreementMeta.bodyKey)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentPage() {
  return <Suspense fallback={<Spinner fullScreen />}><PaymentContent /></Suspense>;
}
