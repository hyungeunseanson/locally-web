'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, CreditCard, Landmark, Loader2, Clock, Users, ShieldCheck, Lock } from 'lucide-react';
import Script from 'next/script';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { launchCardPayment } from '@/app/utils/payments/card/client';
import { buildCardPaymentCallbackRequestBody } from '@/app/utils/payments/card/public';
import type {
  CardPaymentProvider,
  CardPaymentPublicRuntime,
  CardPaymentReadiness,
} from '@/app/utils/payments/card/types';
import type { ServiceRequest } from '@/app/types/service';
import { getPublicBankInfo } from '@/app/utils/publicBankInfo';

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

type PendingBooking = {
  id: string;
  order_id: string;
  amount: number;
  status: string;
  payment_method: string | null;
};

type ServicePaymentRequest = Pick<
  ServiceRequest,
  | 'id'
  | 'title'
  | 'service_date'
  | 'start_time'
  | 'duration_hours'
  | 'guest_count'
  | 'service_type'
  | 'pricing_reason'
  | 'hourly_rate_customer'
  | 'total_customer_price'
  | 'contact_name'
  | 'contact_phone'
> & {
  schedule?: Array<{
    id: string;
    serviceDate: string;
    startTime: string;
    durationHours: number;
    sortOrder: number;
  }>;
};

type PaymentMethod = 'card' | 'bank' | 'paypal';

type ServiceCardReadyReason = CardPaymentReadiness['reason'];
type ServiceCardReadyResponse = CardPaymentReadiness;

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

function ServicePaymentContent() {
  const router = useRouter();
  const params = useParams<{ requestId: string }>();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const { t } = useLanguage();

  const requestId = params.requestId;

  const [isProcessing, setIsProcessing] = useState(false);
  const [request, setRequest] = useState<ServicePaymentRequest | null>(null);
  const [pendingBooking, setPendingBooking] = useState<PendingBooking | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [cardProvider, setCardProvider] = useState<CardPaymentProvider>('portone');
  const [cardRuntime, setCardRuntime] = useState<CardPaymentPublicRuntime | null>(null);
  const [isCardReady, setIsCardReady] = useState(false);
  const [isCardReadyResolved, setIsCardReadyResolved] = useState(false);
  const [cardReadyReason, setCardReadyReason] = useState<ServiceCardReadyReason | ''>('');
  const [isPayPalSdkReady, setIsPayPalSdkReady] = useState(false);
  const [paypalSdkError, setPaypalSdkError] = useState('');
  const paypalButtonRef = useRef<HTMLDivElement | null>(null);
  const paypalPanelRef = useRef<HTMLDivElement | null>(null);
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';
  const isPayPalEnabled = false;
  const isBankLockedBooking = (pendingBooking?.payment_method || '').toLowerCase() === 'bank';
  const bankInfo = getPublicBankInfo();

  const getCheckoutValidationError = useCallback(() => {
    if (!contactName.trim() || !contactPhone.trim()) {
      return t('sp_err_empty') as string;
    }
    if (!agreeTerms) {
      return t('sp_err_terms') as string;
    }
    if (!request || !pendingBooking) {
      return t('sp_err_info') as string;
    }
    return null;
  }, [agreeTerms, contactName, contactPhone, pendingBooking, request, t]);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const paymentResponse = await fetch(`/api/services/bookings?requestId=${encodeURIComponent(requestId)}`, {
      cache: 'no-store',
    });
    const paymentData = await paymentResponse.json() as {
      success?: boolean;
      request?: ServicePaymentRequest;
      booking?: PendingBooking;
    };
    if (!paymentResponse.ok || !paymentData.success || !paymentData.request || !paymentData.booking) {
      router.push(`/services/${requestId}`);
      return;
    }
    setRequest(paymentData.request);
    setPendingBooking(paymentData.booking);
    setContactName(paymentData.request.contact_name || '');
    setContactPhone(paymentData.request.contact_phone || '');
  }, [requestId, router, supabase]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  useEffect(() => {
    let isMounted = true;

    const fetchCardReady = async () => {
      try {
        const response = await fetch('/api/services/payment/card-ready', {
          cache: 'no-store',
        });
        const result = (await response.json()) as ServiceCardReadyResponse;

        if (!isMounted) return;

        setIsCardReady(Boolean(response.ok && result.ready));
        setCardProvider(result.provider || 'portone');
        setCardRuntime(result.runtime || null);
        setCardReadyReason(response.ok && !result.ready ? result.reason || '' : '');
      } catch {
        if (!isMounted) return;

        setIsCardReady(false);
        setCardProvider('portone');
        setCardRuntime(null);
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
    if (isBankLockedBooking && paymentMethod !== 'bank') {
      setPaymentMethod('bank');
      return;
    }

    if (!isPayPalEnabled && paymentMethod === 'paypal') {
      setPaymentMethod('card');
    }
  }, [isBankLockedBooking, isPayPalEnabled, paymentMethod]);

  useEffect(() => {
    if (isBankLockedBooking) {
      return;
    }

    if (!isCardReadyResolved || isCardReady || paymentMethod !== 'card') {
      return;
    }

    if (isPayPalEnabled) {
      setPaymentMethod('paypal');
      return;
    }

    setPaymentMethod('bank');
  }, [isBankLockedBooking, isCardReady, isCardReadyResolved, isPayPalEnabled, paymentMethod]);

  useEffect(() => {
    if (paymentMethod !== 'paypal') {
      setPaymentError('');
    }
  }, [paymentMethod]);

  const createPayPalOrder = useCallback(async () => {
    setPaymentError('');
    setIsProcessing(true);

    try {
      const validationMessage = getCheckoutValidationError();
      if (validationMessage) {
        setPaymentError(validationMessage);
        showToast(validationMessage, 'error');
        throw new Error(validationMessage);
      }

      if (!pendingBooking) {
        const message = t('sp_err_info') as string;
        setPaymentError(message);
        showToast(message, 'error');
        throw new Error(message);
      }

      if ((pendingBooking.payment_method || '').toLowerCase() === 'bank') {
        const message = t('sp_err_bank_locked') as string;
        setPaymentError(message);
        showToast(message, 'error');
        throw new Error(message);
      }

      const response = await fetch('/api/services/payment/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: pendingBooking.id }),
      });

      const result = (await response.json()) as PayPalCreateOrderResponse;
      if (!response.ok || !result.success || !result.paypalOrderId) {
        const message = result.error || (t('sp_err_paypal_create') as string);
        setPaymentError(message);
        showToast(message, 'error');
        throw new Error(message);
      }

      return result.paypalOrderId;
    } finally {
      setIsProcessing(false);
    }
  }, [getCheckoutValidationError, pendingBooking, showToast, t]);

  const handlePayPalApprove = useCallback(async (data: PayPalApproveData) => {
    setPaymentError('');
    setIsProcessing(true);

    try {
      if (!pendingBooking) {
        throw new Error(t('sp_err_paypal_session_missing') as string);
      }

      const response = await fetch('/api/services/payment/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: pendingBooking.id,
          paypalOrderId: data.orderID,
        }),
      });

      const result = (await response.json()) as PayPalCaptureResponse;
      if (!response.ok || !result.success) {
        const message = result.error || (t('sp_err_paypal_capture') as string);
        setPaymentError(message);
        showToast(message, 'error');
        return;
      }

      router.push(`/services/${requestId}/payment/complete?orderId=${pendingBooking.order_id}&method=paypal`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : (t('sp_err_paypal_processing') as string);
      setPaymentError(message);
      showToast(message, 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [pendingBooking, requestId, router, showToast, t]);

  const releaseCardSelection = useCallback(async (orderId: string) => {
    try {
      await fetch('/api/services/payment/release-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
    } catch (error) {
      console.error('[SERVICE] release-card request failed:', error);
    }
  }, []);

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
          showToast(t('sp_err_cancel') as string, 'error');
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : (t('sp_err_paypal_button') as string);
          console.error('[PAYPAL][SERVICE] client button error:', error);
          setPaymentError(message);
          setIsProcessing(false);
          showToast(message, 'error');
        },
      })
      .render(container)
      .catch((error) => {
        const message = error instanceof Error ? error.message : (t('sp_err_paypal_load') as string);
        console.error('[PAYPAL][SERVICE] button render error:', error);
        setPaypalSdkError(message);
        setPaymentError(message);
        showToast(message, 'error');
      });

    return () => {
      container.innerHTML = '';
    };
  }, [createPayPalOrder, handlePayPalApprove, isPayPalEnabled, isPayPalSdkReady, paymentMethod, showToast, t]);

  const handlePayment = useCallback(async () => {
    setPaymentError('');

    const validationMessage = getCheckoutValidationError();
    if (validationMessage) {
      showToast(validationMessage, 'error');
      return;
    }
    if (paymentMethod === 'paypal') return;

    const currentBooking = pendingBooking;
    const currentRequest = request;
    if (!currentBooking || !currentRequest) {
      const message = t('sp_err_info') as string;
      showToast(message, 'error');
      return;
    }

    setIsProcessing(true);
    try {
      // 무통장 입금: IMP 호출 없이 결제수단 저장 후 완료 페이지로 이동
      if (paymentMethod === 'bank') {
        const markRes = await fetch('/api/services/payment/mark-bank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: currentBooking.order_id }),
        });
        if (!markRes.ok) {
          setPaymentError(t('sp_err_bank_fail') as string);
          setIsProcessing(false);
          return;
        }
        router.push(`/services/${requestId}/payment/complete?orderId=${currentBooking.order_id}&method=bank`);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if ((currentBooking.payment_method || '').toLowerCase() === 'bank') {
        const message = t('sp_err_bank_locked') as string;
        setPaymentError(message);
        showToast(message, 'error');
        setIsProcessing(false);
        return;
      }

      if (!isCardReady || !cardRuntime?.merchantCode) {
        const message = t('sp_err_card_unavailable') as string;
        setPaymentError(message);
        showToast(message, 'error');
        setIsProcessing(false);
        return;
      }

      // v2 에스크로: 사전 생성된 orderId 사용 (새 예약 생성 불필요)
      const { order_id: orderId, amount } = currentBooking;
      let cardSelectionLocked = false;

      try {
        const markCardRes = await fetch('/api/services/payment/mark-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        });
        const markCardResult = (await markCardRes.json()) as { success?: boolean; error?: string };

        if (!markCardRes.ok || !markCardResult.success) {
          setPaymentError(markCardResult.error || (t('sp_err_process') as string));
          setIsProcessing(false);
          return;
        }

        cardSelectionLocked = true;

        const paymentSession = await launchCardPayment({
          provider: cardProvider,
          merchantCode: cardRuntime.merchantCode,
          publicClientKey: cardRuntime.publicClientKey,
          orderId,
          productName: currentRequest.title,
          amount,
          buyerEmail: user?.email,
          buyerName: contactName.trim(),
          buyerTel: contactPhone.trim(),
          redirectUrl: `${window.location.origin}/services/${requestId}/payment/complete`,
        });

        // 서버 검증 (서비스 전용 callback 엔드포인트)
        const callbackRes = await fetch('/api/services/payment/nicepay-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            buildCardPaymentCallbackRequestBody({
              orderId,
              paymentSession,
            })
          ),
        });

        const callbackResult = (await callbackRes.json()) as { success?: boolean; error?: string };

        if (!callbackRes.ok || !callbackResult.success) {
          await releaseCardSelection(orderId);
          setPaymentError(callbackResult.error || (t('sp_err_verify') as string));
          setIsProcessing(false);
          return;
        }

        router.push(`/services/${requestId}/payment/complete?orderId=${orderId}`);
      } catch (error: unknown) {
        if (cardSelectionLocked) {
          await releaseCardSelection(orderId);
        }
        const message = error instanceof Error ? error.message : (t('sp_err_process') as string);
        setPaymentError(message);
        setIsProcessing(false);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : (t('sp_err_process') as string);
      setPaymentError(message);
      setIsProcessing(false);
    }
  }, [cardProvider, cardRuntime, contactName, contactPhone, getCheckoutValidationError, isCardReady, paymentMethod, pendingBooking, releaseCardSelection, request, requestId, router, showToast, supabase, t]);

  const scrollToPayPalButton = useCallback(() => {
    paypalPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  if (!request || !pendingBooking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-slate-300" />
      </div>
    );
  }

  const shouldLoadCardRuntimeScript =
    Boolean(cardRuntime?.scriptSrc) && cardRuntime?.provider !== 'nicepay';

  return (
    <>
      {shouldLoadCardRuntimeScript && cardRuntime?.scriptSrc && (
        <Script
          id={`service-card-sdk-${cardRuntime.provider}`}
          src={cardRuntime.scriptSrc}
          strategy="lazyOnload"
        />
      )}
      {isPayPalEnabled && (
        <Script
          id="paypal-js-sdk-service"
          src={`https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=KRW&intent=capture&components=buttons`}
          strategy="afterInteractive"
          onLoad={() => {
            setPaypalSdkError('');
            setIsPayPalSdkReady(true);
          }}
          onError={() => {
            const message = t('sp_err_paypal_load') as string;
            setPaypalSdkError(message);
            setIsPayPalSdkReady(false);
          }}
        />
      )}
      <div className="mx-auto max-w-2xl px-5 py-8 pb-44 md:px-8 md:py-12 md:pb-16">
        {/* 헤더 */}
        <div className="mb-8 flex items-center gap-3 border-b border-zinc-200 pb-7">
          <button onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center text-zinc-500 hover:text-zinc-950">
            <ChevronLeft size={17} />
          </button>
          <h1 className="text-2xl font-semibold tracking-[-0.025em]">{t('sp_title')}</h1>
        </div>

        {/* 에스크로 안내 */}
        <div className="mb-7 flex items-start gap-3 rounded-md bg-zinc-100 px-4 py-3.5">
          <Lock size={16} className="mt-0.5 shrink-0 text-zinc-700" />
          <div>
            <p className="mb-0.5 text-xs font-semibold text-zinc-900 md:text-[13px]">{t('sp_escrow_badge')}</p>
            <p className="text-[11px] leading-relaxed text-zinc-600 md:text-xs">
              {t('sp_escrow_desc')}
            </p>
          </div>
        </div>

        {/* 서비스 요약 */}
        <div className="mb-8 border-y border-zinc-200 py-5">
          <h2 className="mb-2 line-clamp-2 text-sm font-semibold md:text-[15px]">{request.title}</h2>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500 md:text-[13px]">
            <span className="flex items-center gap-1"><Clock size={11} />{request.duration_hours}{t('req_duration_hours')}</span>
            <span className="flex items-center gap-1"><Users size={11} />{request.guest_count}{t('req_guest_count')}</span>
            <span>₩{request.hourly_rate_customer.toLocaleString()}/h</span>
          </div>
          <div className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200">
            {(request.schedule || []).map((item) => (
              <div key={item.id} className="flex justify-between py-2.5 text-[11px] text-zinc-600">
                <span>{item.serviceDate}</span><span>{item.startTime} · {item.durationHours}h</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4">
            <span className="text-xs text-zinc-500 md:text-sm">{t('sp_payment_amount')}</span>
            <span className="text-lg font-semibold text-zinc-950 md:text-xl">₩{request.total_customer_price.toLocaleString()}</span>
          </div>
        </div>

        {/* 신청서에 이미 입력한 연락처를 결제 단계에서 재사용 */}
        <div className="mb-5">
          <h3 className="mb-3 text-[13px] font-semibold text-zinc-800 md:text-sm">{t('sp_booker_info')}</h3>
          <div className="rounded-md border border-zinc-300 px-4 py-3 text-xs leading-6 text-zinc-700 md:text-[13px]">
            <p className="font-semibold text-zinc-950">{contactName}</p>
            <p>{contactPhone}</p>
            <p className="mt-1 text-[10px] text-zinc-500 md:text-[11px]">{t('sp_submitted_contact')}</p>
          </div>
        </div>

        {/* 결제 수단 선택 */}
        <div className="mb-5">
          <h3 className="mb-3 text-[13px] font-semibold text-zinc-800 md:text-sm">{t('sp_method_title')}</h3>
          {isCardReadyResolved && !isCardReady && (
            <p className="mb-3 rounded-md bg-zinc-100 px-3 py-2 text-[11px] text-zinc-700 md:text-xs">
              {cardReadyReason === 'missing_imp_code'
                ? t('sp_card_unavailable_config')
                : t('sp_card_unavailable_fallback')}
            </p>
          )}
          {isBankLockedBooking && (
            <p className="mb-3 rounded-md border border-zinc-300 px-3 py-2 text-[11px] text-zinc-700 md:text-xs">
              {t('sp_bank_locked_notice')}
            </p>
          )}
          <div className={`grid gap-3 ${isPayPalEnabled ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <button
              type="button"
              onClick={() => {
                if (!isBankLockedBooking && isCardReady) {
                  setPaymentMethod('card');
                }
              }}
              disabled={isBankLockedBooking || !isCardReadyResolved || !isCardReady}
              className={`flex flex-col items-center gap-2 rounded-md border p-4 transition-colors ${paymentMethod === 'card'
                  ? 'border-zinc-950 bg-zinc-950 text-white'
                  : isBankLockedBooking || !isCardReadyResolved || !isCardReady
                    ? 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-300'
                    : 'border-zinc-300 hover:border-zinc-950'
                }`}
            >
              <CreditCard size={20} className={paymentMethod === 'card' ? 'text-white' : 'text-zinc-400'} />
              <span className={`text-xs font-semibold md:text-[13px] ${paymentMethod === 'card' ? 'text-white' : 'text-zinc-600'}`}>{t('sp_method_card')}</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('bank')}
              className={`flex flex-col items-center gap-2 rounded-md border p-4 transition-colors ${paymentMethod === 'bank'
                  ? 'border-zinc-950 bg-zinc-950 text-white'
                  : 'border-zinc-300 hover:border-zinc-950'
                }`}
            >
              <Landmark size={20} className={paymentMethod === 'bank' ? 'text-white' : 'text-zinc-400'} />
              <span className={`text-xs font-semibold md:text-[13px] ${paymentMethod === 'bank' ? 'text-white' : 'text-zinc-600'}`}>{t('sp_method_bank')}</span>
            </button>
            {isPayPalEnabled && (
              <button
                type="button"
                onClick={() => {
                  if (!isBankLockedBooking) {
                    setPaymentMethod('paypal');
                  }
                }}
                disabled={isBankLockedBooking}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${paymentMethod === 'paypal'
                    ? 'border-slate-900 bg-slate-50'
                    : isBankLockedBooking
                      ? 'border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
              >
                <div className="rounded bg-[#0070ba] px-2 py-0.5 text-[10px] font-black text-white">PAY</div>
                <span className={`text-[12px] md:text-[13px] font-bold ${paymentMethod === 'paypal' ? 'text-slate-900' : 'text-slate-400'}`}>대체 결제</span>
              </button>
            )}
          </div>
        </div>

        {/* 무통장 계좌 안내 */}
        {paymentMethod === 'bank' && (
          <div className="mb-5 animate-in rounded-md border border-zinc-300 p-3 fade-in zoom-in-95 md:p-4">
            <p className="mb-1 text-[11px] font-semibold text-zinc-500 md:text-xs">{t('sp_bank_account')}</p>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base font-semibold text-zinc-950 md:text-lg">{bankInfo.account}</span>
              <span className="rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 md:text-xs">{bankInfo.bankName}</span>
            </div>
            <p className="mb-1 text-[11px] md:text-xs text-slate-500">
              {t('pay_complete_bank_account_holder_label')}: {bankInfo.accountHolder}
            </p>
            <p className="text-[11px] md:text-xs text-slate-400">
              {t('sp_bank_notice_1')}<span className="font-semibold text-zinc-950">{t('sp_bank_notice_hl')}</span>{t('sp_bank_notice_2')}
            </p>
          </div>
        )}

        {paymentMethod === 'paypal' && (
          <div
            ref={paypalPanelRef}
            className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:rounded-xl md:p-4 mb-5 animate-in fade-in zoom-in-95"
          >
            <div className="text-[11px] md:text-xs text-slate-500 leading-relaxed">
              {t('sp_paypal_desc')}
            </div>
            {paypalSdkError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] md:text-xs text-rose-600">
                {paypalSdkError}
              </div>
            )}
            {!isPayPalSdkReady && !paypalSdkError && (
              <div className="flex h-12 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white text-[12px] text-slate-500">
                <Loader2 size={16} className="mr-2 animate-spin" />
                {t('sp_paypal_loading')}
              </div>
            )}
            <div ref={paypalButtonRef} className={isPayPalSdkReady ? 'min-h-[48px]' : 'hidden'} />
          </div>
        )}

        {/* 약관 동의 */}
        <label className="flex items-start gap-2.5 mb-5 cursor-pointer">
          <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-0.5 accent-slate-900" />
          <span className="text-[11px] md:text-xs text-slate-500 leading-relaxed">
            {t('sp_agree_terms')}
          </span>
        </label>

        {/* 안전 결제 안내 */}
        <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-400 mb-5">
          <ShieldCheck size={13} className="shrink-0 text-zinc-600" />
          {t('sp_safe_pay')}
        </div>

        {/* 에러 */}
        {paymentError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-[12px] md:text-sm rounded-xl px-4 py-3 mb-4">
            {paymentError}
          </div>
        )}

        {/* 결제 버튼 */}
        {paymentMethod !== 'paypal' ? (
          <button
            onClick={handlePayment}
            disabled={isProcessing || (paymentMethod === 'card' && (!isCardReadyResolved || !isCardReady))}
            className="hidden w-full items-center justify-center gap-2 rounded-md bg-zinc-950 py-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 md:flex md:text-base"
          >
            {isProcessing ? (
              <><Loader2 size={18} className="animate-spin" /> {t('processing')}</>
            ) : paymentMethod === 'bank' ? (
              <><Landmark size={18} /> {t('sp_btn_bank')}</>
            ) : (
              <><CreditCard size={18} /> {(t('sp_btn_card') as string).replace('{price}', `₩${request.total_customer_price.toLocaleString()}`)}</>
            )}
          </button>
        ) : (
          <div className="w-full rounded-md border border-zinc-300 bg-white px-4 py-3 text-center text-xs text-zinc-500">
            {t('sp_paypal_hint')}
          </div>
        )}
      </div>
      <div
        data-testid="service-payment-mobile-cta"
        className="fixed left-14 right-3 z-[120] rounded-lg border border-zinc-200 bg-white p-2 shadow-[0_8px_32px_rgba(0,0,0,0.16)] md:hidden"
        style={{ bottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{t('sp_payment_amount')}</p>
            <p className="truncate text-[16px] font-black text-slate-900">₩{request.total_customer_price.toLocaleString()}</p>
          </div>
          {paymentMethod !== 'paypal' ? (
            <button
              onClick={handlePayment}
              disabled={isProcessing || (paymentMethod === 'card' && (!isCardReadyResolved || !isCardReady))}
              data-testid="service-payment-mobile-submit"
              className="min-w-[180px] rounded-md bg-zinc-950 px-4 py-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isProcessing ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> {t('processing')}
                </span>
              ) : paymentMethod === 'bank' ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Landmark size={16} /> {t('sp_btn_bank')}
                </span>
              ) : (
                <span className="inline-flex items-center justify-center gap-2">
                  <CreditCard size={16} /> {(t('sp_btn_card') as string).replace('{price}', `₩${request.total_customer_price.toLocaleString()}`)}
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={scrollToPayPalButton}
              data-testid="service-payment-mobile-paypal-jump"
              className="min-w-[180px] rounded-md bg-zinc-950 px-4 py-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              결제
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default function ServicePaymentPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-slate-300" />
        </div>
      }>
        <ServicePaymentContent />
      </Suspense>
    </div>
  );
}
