'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { ChevronLeft, CreditCard, Calendar, Users, ShieldCheck, Clock, Info, CheckCircle2 } from 'lucide-react';
import Spinner from '@/app/components/ui/Spinner';
import Script from 'next/script';
import Image from 'next/image';
import { createClient } from '@/app/utils/supabase/client';
import { getAnalyticsTrackingMetadata } from '@/app/utils/analytics/client';
import { useToast } from '@/app/context/ToastContext';
import { BOOKING_BLOCKING_STATUSES_FOR_CAPACITY } from '@/app/constants/bookingStatus';
import { SOLO_GUARANTEE_PRICE } from '@/app/constants/soloGuarantee';
import { getPublicBankInfo } from '@/app/utils/publicBankInfo';

type PaymentExperience = {
  title?: string;
  image_url?: string | null;
  photos?: string[] | null;
  location?: string | null;
  price?: number | null;
  private_price?: number | null;
  max_guests?: number | null;
  host_id?: string | null;
};

type BookingCheckRow = {
  guests: number | null;
  type: string | null;
};

type BookingApiResponse = {
  success?: boolean;
  newOrderId?: string;
  finalAmount?: number;
  error?: string;
};

type PaymentMethod = 'card' | 'bank' | 'paypal';
type ExperienceCardReadyReason = 'missing_portone_credentials' | 'missing_imp_code';
type ExperienceCardReadyResponse = {
  ready?: boolean;
  reason?: ExperienceCardReadyReason;
};

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

type ImpRequestData = {
  pg: string;
  pay_method: 'card';
  merchant_uid: string;
  name: string;
  amount: number;
  buyer_email?: string;
  buyer_name: string;
  buyer_tel: string;
  m_redirect_url: string;
};

type ImpResponse = {
  success?: boolean;
  code?: string;
  status?: string;
  imp_uid?: string;
  error_msg?: string;
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

declare global {
  interface Window {
    IMP?: {
      init: (merchantCode: string) => void;
      request_pay: (data: ImpRequestData, callback: (rsp: ImpResponse) => void) => void;
    };
    paypal?: PayPalNamespace;
  }
}

function PaymentContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();

  const [isProcessing, setIsProcessing] = useState(false);
  const [experience, setExperience] = useState<PaymentExperience | null>(null);
  const [paymentError, setPaymentError] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeSafety, setAgreeSafety] = useState(false);
  const [agreeNoOffPlatform, setAgreeNoOffPlatform] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [isCardReady, setIsCardReady] = useState(false);
  const [isCardReadyResolved, setIsCardReadyResolved] = useState(false);
  const [cardReadyReason, setCardReadyReason] = useState<ExperienceCardReadyReason | ''>('');
  const [isFeeInfoOpen, setIsFeeInfoOpen] = useState(false);
  const [isPayPalSdkReady, setIsPayPalSdkReady] = useState(false);
  const [paypalSdkError, setPaypalSdkError] = useState('');
  const feeInfoRef = useRef<HTMLDivElement | null>(null);
  const paypalButtonRef = useRef<HTMLDivElement | null>(null);
  const paypalSessionRef = useRef<PayPalPreparedSession | null>(null);
  const latestPayPalContextRef = useRef<PayPalCheckoutContext>({
    customerName: '',
    customerPhone: '',
    agreeTerms: false,
    agreeSafety: false,
    agreeNoOffPlatform: false,
  });

  const experienceId = params?.id as string;
  const date = searchParams?.get('date') || '날짜 미정';
  const time = searchParams?.get('time') || '시간 미정';
  const guests = Number(searchParams?.get('guests')) || 1;
  const isPrivate = searchParams?.get('type') === 'private';
  const isSoloGuarantee = searchParams?.get('solo') === '1' && guests === 1 && !isPrivate;

  const expPrice = Number(experience?.price || 50000);
  const baseHostPrice = isPrivate ? Number(experience?.private_price || 300000) : expPrice * guests;
  const soloGuaranteePrice = isSoloGuarantee ? SOLO_GUARANTEE_PRICE : 0;
  const hostPrice = baseHostPrice + soloGuaranteePrice;
  const guestFee = Math.floor(hostPrice * 0.1);
  const finalAmount = hostPrice + guestFee;
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';
  const isPayPalEnabled = Boolean(paypalClientId);
  const portOneImpCode = process.env.NEXT_PUBLIC_PORTONE_IMP_CODE || '';

  const buildPayPalSessionKey = useCallback(
    () =>
      JSON.stringify([
        experienceId,
        date,
        time,
        guests,
        isPrivate,
        isSoloGuarantee,
      ]),
    [date, experienceId, guests, isPrivate, isSoloGuarantee, time]
  );

  const getCheckoutValidationError = useCallback((context: PayPalCheckoutContext) => {
    if (!context.customerName || !context.customerPhone) {
      return '예약자 정보를 입력해주세요.';
    }

    if (!context.agreeTerms || !context.agreeSafety || !context.agreeNoOffPlatform) {
      return '모든 필수 안전 및 이용 규정에 동의해주세요.';
    }

    return null;
  }, []);

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
    latestPayPalContextRef.current = {
      customerName,
      customerPhone,
      agreeTerms,
      agreeSafety,
      agreeNoOffPlatform,
    };
  }, [agreeNoOffPlatform, agreeSafety, agreeTerms, customerName, customerPhone]);

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
        setCardReadyReason(response.ok && !result.ready ? result.reason || '' : '');
      } catch {
        if (!isMounted) return;

        setIsCardReady(false);
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
    if (!isPayPalEnabled && paymentMethod === 'paypal') {
      setPaymentMethod(isCardReadyResolved && !isCardReady ? 'bank' : 'card');
      return;
    }

    if (isCardReadyResolved && !isCardReady && paymentMethod === 'card') {
      setPaymentMethod(isPayPalEnabled ? 'paypal' : 'bank');
    }
  }, [isCardReady, isCardReadyResolved, isPayPalEnabled, paymentMethod]);

  useEffect(() => {
    if (paymentMethod !== 'paypal') {
      paypalSessionRef.current = null;
      setPaymentError('');
    }
  }, [paymentMethod, experienceId, date, time, guests, isPrivate, isSoloGuarantee]);

  useEffect(() => {
    const fetchExp = async () => {
      if (!experienceId) return;

      const { data: expData } = await supabase
        .from('experiences')
        .select('title, image_url, photos, location, price, private_price, max_guests, host_id')
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
          supabase.from('analytics_events').insert([{
            event_type: 'payment_init',
            target_id: experienceId,
            user_id: user.id,
            ...getAnalyticsTrackingMetadata(),
          }]).then(({ error }) => {
            if (error) console.error('Payment Init Log Error:', error);
          });
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
      .in('status', [...BOOKING_BLOCKING_STATUSES_FOR_CAPACITY]);

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
    const context = latestPayPalContextRef.current;
    const validationMessage = getCheckoutValidationError(context);

    if (validationMessage) {
      setPaymentError(validationMessage);
      showToast(validationMessage, 'error');
      throw new Error(validationMessage);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const message = '로그인이 필요합니다.';
      setPaymentError(message);
      showToast(message, 'error');
      router.push('/login');
      throw new Error(message);
    }

    const sessionKey = buildPayPalSessionKey();
    const existingSession = paypalSessionRef.current;
    if (existingSession && existingSession.key === sessionKey) {
      return existingSession;
    }

    const isAvailable = await checkAvailability();
    if (!isAvailable) {
      const message = isPrivate
        ? '해당 시간대에 이미 다른 예약이 있어 단독 투어 진행이 어렵습니다.'
        : '죄송합니다. 잔여석이 부족하여 예약할 수 없습니다.';
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
        isSoloGuarantee,
        customerName: context.customerName,
        customerPhone: context.customerPhone,
        paymentMethod: 'paypal',
      }),
    });

    const result = (await res.json()) as BookingApiResponse;

    if (!res.ok || !result.success || !result.newOrderId) {
      const message = result.error || '예약 처리 중 오류가 발생했습니다.';
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
    buildPayPalSessionKey,
    checkAvailability,
    date,
    experienceId,
    getCheckoutValidationError,
    guests,
    isPrivate,
    isSoloGuarantee,
    router,
    showToast,
    supabase.auth,
    time,
  ]);

  const createPayPalOrder = useCallback(async () => {
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
        const message = result.error || 'PayPal 주문 생성에 실패했습니다.';
        setPaymentError(message);
        showToast(message, 'error');
        throw new Error(message);
      }

      return result.paypalOrderId;
    } finally {
      setIsProcessing(false);
    }
  }, [preparePayPalBooking, showToast]);

  const handlePayPalApprove = useCallback(
    async (data: PayPalApproveData) => {
      setPaymentError('');
      setIsProcessing(true);

      try {
        const session = paypalSessionRef.current;
        if (!session) {
          throw new Error('PayPal 결제 세션을 찾을 수 없습니다. 다시 시도해주세요.');
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
          const message = result.error || 'PayPal 결제 승인 처리에 실패했습니다.';
          setPaymentError(message);
          showToast(message, 'error');
          return;
        }

        router.push(`/experiences/${experienceId}/payment/complete?orderId=${session.orderId}`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'PayPal 결제 승인 처리 중 오류가 발생했습니다.';
        setPaymentError(message);
        showToast(message, 'error');
      } finally {
        setIsProcessing(false);
      }
    },
    [experienceId, router, showToast]
  );

  useEffect(() => {
    if (paymentMethod !== 'paypal') {
      if (paypalButtonRef.current) {
        paypalButtonRef.current.innerHTML = '';
      }
      return;
    }

    if (!isPayPalEnabled || !isPayPalSdkReady || !paypalButtonRef.current || !window.paypal?.Buttons) {
      return;
    }

    const container = paypalButtonRef.current;
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
        createOrder: async () => createPayPalOrder(),
        onApprove: async (data) => handlePayPalApprove(data),
        onCancel: () => {
          setIsProcessing(false);
          showToast('PayPal 결제가 취소되었습니다.', 'error');
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : 'PayPal 버튼 처리 중 오류가 발생했습니다.';
          console.error('[PAYPAL] client button error:', error);
          setPaymentError(message);
          setIsProcessing(false);
          showToast(message, 'error');
        },
      })
      .render(container)
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'PayPal 버튼을 불러오지 못했습니다.';
        console.error('[PAYPAL] button render error:', error);
        setPaypalSdkError(message);
        setPaymentError(message);
        showToast(message, 'error');
      });

    return () => {
      container.innerHTML = '';
    };
  }, [createPayPalOrder, handlePayPalApprove, isPayPalEnabled, isPayPalSdkReady, paymentMethod, showToast]);

  const handlePayment = async () => {
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

    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const message = '로그인이 필요합니다.';
        setPaymentError(message);
        showToast(message, 'error');
        setIsProcessing(false);
        router.push('/login');
        return;
      }

      const isAvailable = await checkAvailability();
      if (!isAvailable) {
        const message = isPrivate
          ? '해당 시간대에 이미 다른 예약이 있어 단독 투어 진행이 어렵습니다.'
          : '죄송합니다. 잔여석이 부족하여 예약할 수 없습니다.';
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
          isSoloGuarantee,
          customerName,
          customerPhone,
          paymentMethod
        })
      });

      const result = (await res.json()) as BookingApiResponse;

      if (!res.ok || !result.success || !result.newOrderId || result.finalAmount == null) {
        const message = result.error || '예약 처리 중 오류가 발생했습니다.';
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
        const message = '카드 결제를 지금 사용할 수 없습니다. 무통장 또는 PayPal을 이용해주세요.';
        setPaymentError(message);
        showToast(message, 'error');
        setIsProcessing(false);
        return;
      }

      const imp = window.IMP;
      if (!imp) {
        const message = '결제 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
        setPaymentError(message);
        showToast(message, 'error');
        setIsProcessing(false);
        return;
      }

      imp.init(portOneImpCode);

      const data: ImpRequestData = {
        pg: 'nice_v2',
        pay_method: 'card',
        merchant_uid: newOrderId,
        name: experience?.title || 'Locally 체험 예약',
        amount: Number(secureFinalAmount),
        buyer_email: user.email,
        buyer_name: customerName,
        buyer_tel: customerPhone,
        m_redirect_url: `${window.location.origin}/api/payment/nicepay-callback`,
      };

      imp.request_pay(data, async (rsp: ImpResponse) => {
        const isSuccess = rsp.success === true || rsp.code === '0' || rsp.status === 'paid' || (Boolean(rsp.imp_uid) && !rsp.error_msg);

        if (!isSuccess) {
          const message = `결제 실패: ${rsp.error_msg || '알 수 없는 오류'}`;
          setPaymentError(message);
          showToast(message, 'error');
          setIsProcessing(false);
          return;
        }

        if (!rsp.imp_uid) {
          const message = '결제 확인용 imp_uid를 받지 못했습니다. 다시 시도해주세요.';
          setPaymentError(message);
          showToast(message, 'error');
          setIsProcessing(false);
          return;
        }

        try {
          const response = await fetch('/api/payment/nicepay-callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imp_uid: rsp.imp_uid,
              merchant_uid: newOrderId,
              orderId: newOrderId,
            }),
          });
          const callbackResult = (await response.json()) as { success?: boolean; error?: string };

          if (!response.ok || !callbackResult.success) {
            const message = `결제 검증 중 오류가 발생했습니다. ${callbackResult.error || ''}`.trim();
            setPaymentError(message);
            showToast(message, 'error');
            setIsProcessing(false);
            return;
          }

          router.push(`/experiences/${experienceId}/payment/complete?orderId=${newOrderId}`);
        } catch (err: unknown) {
          const message = err instanceof Error ? `네트워크 통신 오류: ${err.message}` : '네트워크 통신 오류가 발생했습니다.';
          setPaymentError(message);
          showToast(message, 'error');
          setIsProcessing(false);
        }
      });

    } catch (error: unknown) {
      console.error(error);
      const message = '시스템 오류가 발생했습니다.';
      setPaymentError(message);
      showToast(message, 'error');
      setIsProcessing(false);
    }
  };

  const imageUrl = experience?.photos?.[0] || experience?.image_url || 'https://images.unsplash.com/photo-1540206395-688085723adb';
  const bankInfo = getPublicBankInfo();

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
            const message = 'PayPal 결제 모듈을 불러오지 못했습니다.';
            setPaypalSdkError(message);
            setIsPayPalSdkReady(false);
          }}
        />
      )}

      <div className="bg-white w-full max-w-md rounded-2xl md:rounded-3xl shadow-lg md:shadow-xl overflow-hidden border border-slate-100">
        <div className="h-12 md:h-16 border-b border-slate-100 flex items-center px-3 md:px-4 gap-2.5 md:gap-4 bg-white sticky top-0 z-10">
          <button onClick={() => router.back()} className="p-1.5 md:p-2 hover:bg-slate-50 rounded-full transition-colors"><ChevronLeft className="w-5 h-5 md:w-6 md:h-6" /></button>
          <span className="font-black text-[15px] md:text-lg">결제하기</span>
        </div>

        <div className="p-4 md:p-6">
          <div className="flex gap-3 md:gap-5 mb-6 md:mb-8">
            <div className="w-20 h-28 md:w-24 md:h-32 relative rounded-lg md:rounded-xl overflow-hidden flex-shrink-0 bg-slate-200 shadow-sm border border-slate-100">
              <Image src={imageUrl} alt="Experience" fill className="object-cover" sizes="100px" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
              <span className="text-[10px] md:text-xs font-bold text-slate-500 mb-1 md:mb-1.5 uppercase tracking-wide">{experience?.location || 'SEOUL'}</span>
              <h3 className="font-bold text-slate-900 leading-snug line-clamp-3 text-[15px] md:text-lg">
                {experience ? experience.title : <Spinner size={16} className="inline-block" />}
              </h3>
            </div>
          </div>

          <h2 className="text-[16px] md:text-xl font-bold mb-3 md:mb-4">예약 정보 확인</h2>
          <div className="bg-slate-50 p-4 md:p-6 rounded-xl md:rounded-2xl space-y-3 md:space-y-4 mb-5 md:mb-6 text-[12px] md:text-sm text-slate-700 border border-slate-100">
            <div className="flex justify-between items-center"><span className="text-slate-500 flex items-center gap-1.5 md:gap-2"><Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" /> 날짜</span><span className="font-bold">{date}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-500 flex items-center gap-1.5 md:gap-2"><Clock className="w-3.5 h-3.5 md:w-4 md:h-4" /> 시간</span><span className="font-bold">{time}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-500 flex items-center gap-1.5 md:gap-2"><Users className="w-3.5 h-3.5 md:w-4 md:h-4" /> 인원</span><span className="font-bold">{guests}명</span></div>
            {isPrivate && <div className="flex justify-between items-center"><span className="text-slate-500 flex items-center gap-1.5 md:gap-2"><ShieldCheck className="w-3.5 h-3.5 md:w-4 md:h-4" /> 타입</span><span className="font-bold text-rose-500">프라이빗 투어</span></div>}
            {isSoloGuarantee && (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[11px] md:text-xs text-slate-500 leading-relaxed">
                <span className="font-semibold text-slate-700">1인 출발 확정 옵션이 적용되었습니다.</span>
              </div>
            )}
          </div>

          <div className="mb-6 md:mb-8 space-y-3 md:space-y-4">
            <h2 className="text-[16px] md:text-xl font-bold">예약자 정보</h2>
            <div>
              <label className="block text-[11px] md:text-xs font-bold text-slate-500 mb-1 md:mb-1.5">이름</label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full px-3 py-2.5 md:p-3 text-[13px] md:text-sm bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl outline-none focus:border-black transition-colors" placeholder="예약자 성함" />
            </div>
            <div>
              <label className="block text-[11px] md:text-xs font-bold text-slate-500 mb-1 md:mb-1.5">연락처</label>
              <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full px-3 py-2.5 md:p-3 text-[13px] md:text-sm bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl outline-none focus:border-black transition-colors" placeholder="010-0000-0000" />
            </div>
          </div>

          <div className="mb-6 md:mb-8">
            <h2 className="text-[16px] md:text-xl font-bold mb-3 md:mb-4">결제 수단</h2>
          <div className={`grid gap-2 md:gap-3 mb-3 md:mb-4 ${isPayPalEnabled ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <button
                type="button"
                onClick={() => {
                  if (isCardReadyResolved && isCardReady) {
                    setPaymentMethod('card');
                  }
                }}
                disabled={!isCardReadyResolved || !isCardReady}
                className={`p-3 md:p-4 rounded-lg md:rounded-xl border-2 flex flex-col items-center gap-1.5 md:gap-2 transition-all ${paymentMethod === 'card' ? 'border-black bg-slate-50 text-black' : !isCardReadyResolved || !isCardReady ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
              >
                <CreditCard className="w-5 h-5 md:w-6 md:h-6" />
                <span className="font-bold text-[12px] md:text-sm">카드 결제</span>
              </button>
              <button
                onClick={() => setPaymentMethod('bank')}
                className={`p-3 md:p-4 rounded-lg md:rounded-xl border-2 flex flex-col items-center gap-1.5 md:gap-2 transition-all ${paymentMethod === 'bank' ? 'border-black bg-slate-50 text-black' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
              >
                <div className="flex items-center gap-1"><Users className="w-5 h-5 md:w-6 md:h-6" /><span className="text-[9px] md:text-[10px] font-bold bg-rose-100 text-rose-600 px-1 rounded">추천</span></div>
                <span className="font-bold text-[12px] md:text-sm">무통장 입금</span>
              </button>
              {isPayPalEnabled && (
                <button
                  onClick={() => setPaymentMethod('paypal')}
                  className={`p-3 md:p-4 rounded-lg md:rounded-xl border-2 flex flex-col items-center gap-1.5 md:gap-2 transition-all ${paymentMethod === 'paypal' ? 'border-black bg-slate-50 text-black' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                >
                  <div className="rounded bg-[#0070ba] px-2 py-0.5 text-[10px] font-black text-white">PayPal</div>
                  <span className="font-bold text-[12px] md:text-sm">PayPal</span>
                </button>
              )}
            </div>

            {isCardReadyResolved && !isCardReady && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] md:text-xs text-amber-700">
                카드 결제를 지금 사용할 수 없습니다. {cardReadyReason === 'missing_imp_code' ? '결제 설정이 아직 완료되지 않았습니다.' : '무통장 또는 PayPal을 이용해주세요.'}
              </div>
            )}

            {paymentMethod === 'bank' && (
              <div className="bg-slate-50 p-3 md:p-4 rounded-lg md:rounded-xl border border-slate-200 animate-in fade-in zoom-in-95">
                <p className="text-[11px] md:text-xs font-bold text-slate-500 mb-1">입금하실 계좌</p>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-black text-[16px] md:text-lg text-slate-900">{bankInfo.account}</span>
                  <span className="text-[10px] md:text-xs font-bold bg-yellow-300 px-1 md:px-1.5 py-0.5 rounded text-black">{bankInfo.bankName}</span>
                </div>
                <p className="text-[11px] md:text-xs text-slate-400">
                  * 예약 후 <span className="text-rose-500 font-bold">1시간 이내</span>에 미입금 시 자동 취소됩니다.
                </p>
              </div>
            )}

            {paymentMethod === 'paypal' && (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:rounded-xl md:p-4 animate-in fade-in zoom-in-95">
                <div className="text-[11px] md:text-xs text-slate-500 leading-relaxed">
                  PayPal 승인 후 결제가 완료되며, 기존 카드/무통장 결제 흐름에는 영향을 주지 않습니다.
                </div>
                {paypalSdkError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] md:text-xs text-rose-600">
                    {paypalSdkError}
                  </div>
                )}
                {!isPayPalSdkReady && !paypalSdkError && (
                  <div className="flex h-12 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white text-[12px] text-slate-500">
                    <Spinner size={16} className="mr-2" />
                    PayPal 버튼을 불러오는 중입니다.
                  </div>
                )}
                <div ref={paypalButtonRef} className={isPayPalSdkReady ? 'min-h-[48px]' : 'hidden'} />
              </div>
            )}
          </div>

          <div className="px-1 md:px-2 space-y-1.5 md:space-y-2 mb-6 md:mb-8 text-[12px] md:text-sm">
            <div className="flex justify-between items-center text-slate-600"><span>체험 금액</span><span>₩{baseHostPrice.toLocaleString()}</span></div>
            {isSoloGuarantee && (
              <div className="flex justify-between items-center text-slate-600"><span>1인 출발 확정비</span><span>+ ₩{soloGuaranteePrice.toLocaleString()}</span></div>
            )}
            <div className="flex justify-between items-center text-blue-600">
              <span className="flex items-center gap-1">
                서비스 수수료 (10%)
                <span
                  ref={feeInfoRef}
                  className="relative inline-flex"
                  onMouseEnter={() => setIsFeeInfoOpen(true)}
                  onMouseLeave={() => setIsFeeInfoOpen(false)}
                >
                  <button
                    type="button"
                    aria-label="서비스 수수료 안내"
                    aria-expanded={isFeeInfoOpen}
                    onClick={() => setIsFeeInfoOpen((prev) => !prev)}
                    onFocus={() => setIsFeeInfoOpen(true)}
                    className="inline-flex items-center justify-center rounded-full text-blue-600 transition-colors hover:text-blue-700 focus:outline-none"
                  >
                    <Info className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  </button>
                  {isFeeInfoOpen && (
                    <div className="absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium leading-relaxed text-slate-600 shadow-xl md:w-64 md:text-xs">
                      서비스 수수료는 결제 처리, 고객 지원, 플랫폼 운영에 사용됩니다.
                    </div>
                  )}
                </span>
              </span>
              <span>+ ₩{guestFee.toLocaleString()}</span>
            </div>
            <div className="border-t border-slate-100 pt-3 md:pt-4 mt-1.5 md:mt-2 flex justify-between items-center"><span className="font-bold text-slate-900">총 결제금액</span><span className="text-[24px] md:text-3xl font-black text-slate-900">₩{finalAmount.toLocaleString()}</span></div>
          </div>

          <div className="mb-5 md:mb-6 space-y-2.5 md:space-y-3 bg-red-50/50 p-4 md:p-5 rounded-xl md:rounded-2xl border border-red-100">
            <h3 className="text-[13px] md:text-sm font-bold text-red-600 mb-2.5 md:mb-3 flex items-center gap-1 md:gap-1.5"><ShieldCheck className="w-3.5 h-3.5 md:w-4 md:h-4" /> 게스트 안전 필수 동의</h3>

            <label className="flex items-start gap-2.5 md:gap-3 cursor-pointer hover:bg-white/50 p-1.5 md:p-2 -ml-1 md:-ml-2 rounded-lg md:rounded-xl transition-colors">
              <div className={`mt-0.5 min-w-[18px] h-[18px] md:min-w-[20px] md:h-5 rounded border flex items-center justify-center transition-colors ${agreeNoOffPlatform ? 'bg-black border-black text-white' : 'border-slate-300 bg-white text-transparent'}`}><CheckCircle2 className="w-3 h-3 md:w-3.5 md:h-3.5" /></div>
              <input type="checkbox" className="hidden" checked={agreeNoOffPlatform} onChange={() => setAgreeNoOffPlatform(!agreeNoOffPlatform)} />
              <div className="text-[12px] md:text-sm font-medium text-slate-700 leading-[1.45] md:leading-snug">
                <span className="text-red-600 font-bold">[필수]</span> 호스트와의 직접 연락 및 플랫폼 외부 결제는 금지되며, 적발 시 계정 영구 정지 처분에 동의합니다.
              </div>
            </label>

            <label className="flex items-start gap-2.5 md:gap-3 cursor-pointer hover:bg-white/50 p-1.5 md:p-2 -ml-1 md:-ml-2 rounded-lg md:rounded-xl transition-colors">
              <div className={`mt-0.5 min-w-[18px] h-[18px] md:min-w-[20px] md:h-5 rounded border flex items-center justify-center transition-colors ${agreeSafety ? 'bg-black border-black text-white' : 'border-slate-300 bg-white text-transparent'}`}><CheckCircle2 className="w-3 h-3 md:w-3.5 md:h-3.5" /></div>
              <input type="checkbox" className="hidden" checked={agreeSafety} onChange={() => setAgreeSafety(!agreeSafety)} />
              <div className="text-[12px] md:text-sm font-medium text-slate-700 leading-[1.45] md:leading-snug">
                <span className="text-red-600 font-bold">[필수]</span> 플랫폼 내 게스트 안전 가이드라인을 숙지하였으며, 상호 존중하는 올바른 호스팅 문화에 기여하겠습니다.
              </div>
            </label>

            <label className="flex items-start gap-2.5 md:gap-3 cursor-pointer hover:bg-white/50 p-1.5 md:p-2 -ml-1 md:-ml-2 rounded-lg md:rounded-xl transition-colors">
              <div className={`mt-0.5 min-w-[18px] h-[18px] md:min-w-[20px] md:h-5 rounded border flex items-center justify-center transition-colors ${agreeTerms ? 'bg-black border-black text-white' : 'border-slate-300 bg-white text-transparent'}`}><CheckCircle2 className="w-3 h-3 md:w-3.5 md:h-3.5" /></div>
              <input type="checkbox" className="hidden" checked={agreeTerms} onChange={() => setAgreeTerms(!agreeTerms)} />
              <div className="text-[12px] md:text-sm font-medium text-slate-700 leading-[1.45] md:leading-snug">
                <span className="text-slate-900 font-bold">[필수]</span> 구매 조건, 취소/환불 규정을 모두 확인하였으며 본 플랫폼 서비스 이용 약관에 동의합니다.
              </div>
            </label>
          </div>

          {paymentError && (
            <div className="mb-4 rounded-lg md:rounded-xl border border-rose-200 bg-rose-50 px-3 md:px-4 py-2.5 md:py-3 text-[12px] md:text-[13px] text-rose-600 leading-relaxed">
              {paymentError}
            </div>
          )}

          {paymentMethod !== 'paypal' ? (
            <button
              onClick={handlePayment}
              disabled={isProcessing || (paymentMethod === 'card' && (!isCardReadyResolved || !isCardReady))}
              className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl font-bold text-[15px] md:text-lg bg-black text-white hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 md:gap-2 shadow-md md:shadow-lg shadow-slate-200 active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
            >
              {isProcessing ? (
                <Spinner size={20} className="w-[18px] h-[18px] md:w-5 md:h-5 text-white" />
              ) : (
                <>
                  <CreditCard className="w-[18px] h-[18px] md:w-5 md:h-5" /> ₩{finalAmount.toLocaleString()} 결제하기
                </>
              )}
            </button>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-[12px] text-slate-500 md:rounded-2xl md:text-sm">
              위 PayPal 버튼에서 승인하면 결제가 완료됩니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return <Suspense fallback={<Spinner fullScreen />}><PaymentContent /></Suspense>;
}
