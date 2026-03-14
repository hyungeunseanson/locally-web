'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, CreditCard, Landmark, Loader2, Clock, Users, ShieldCheck, Lock } from 'lucide-react';
import Script from 'next/script';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext';
import type { ServiceRequest } from '@/app/types/service';

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

declare global {
  interface Window {
    IMP?: {
      init: (merchantCode: string) => void;
      request_pay: (data: ImpRequestData, callback: (rsp: ImpResponse) => void) => void;
    };
    paypal?: PayPalNamespace;
  }
}

type PendingBooking = {
  id: string;
  order_id: string;
  amount: number;
  status: string;
};

type PaymentMethod = 'card' | 'bank' | 'paypal';

type ServiceCardReadyReason = 'missing_portone_credentials' | 'missing_imp_code';

type ServiceCardReadyResponse = {
  ready: boolean;
  reason?: ServiceCardReadyReason;
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
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [pendingBooking, setPendingBooking] = useState<PendingBooking | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [isCardReady, setIsCardReady] = useState(false);
  const [isCardReadyResolved, setIsCardReadyResolved] = useState(false);
  const [cardReadyReason, setCardReadyReason] = useState<ServiceCardReadyReason | ''>('');
  const [isPayPalSdkReady, setIsPayPalSdkReady] = useState(false);
  const [paypalSdkError, setPaypalSdkError] = useState('');
  const paypalButtonRef = useRef<HTMLDivElement | null>(null);
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';
  const isPayPalEnabled = Boolean(paypalClientId);
  const portOneImpCode = process.env.NEXT_PUBLIC_PORTONE_IMP_CODE || '';

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

    // 의뢰 정보 조회
    const { data: req } = await supabase
      .from('service_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    if (!req) { router.push('/services/my'); return; }
    setRequest(req as ServiceRequest);

    // v2 에스크로: 사전 생성된 PENDING 예약 조회
    const { data: booking } = await supabase
      .from('service_bookings')
      .select('id, order_id, amount, status')
      .eq('request_id', requestId)
      .eq('customer_id', user.id)
      .eq('status', 'PENDING')
      .maybeSingle();

    if (!booking) {
      // 이미 결제 완료 혹은 취소된 경우
      router.push(`/services/${requestId}`);
      return;
    }
    setPendingBooking(booking as PendingBooking);

    // 연락처 자동 완성
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.full_name) setContactName(profile.full_name);
    if (profile?.phone) setContactPhone(profile.phone);
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
      setPaymentMethod('card');
    }
  }, [isPayPalEnabled, paymentMethod]);

  useEffect(() => {
    if (!isCardReadyResolved || isCardReady || paymentMethod !== 'card') {
      return;
    }

    if (isPayPalEnabled) {
      setPaymentMethod('paypal');
      return;
    }

    setPaymentMethod('bank');
  }, [isCardReady, isCardReadyResolved, isPayPalEnabled, paymentMethod]);

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

      const response = await fetch('/api/services/payment/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: pendingBooking.id }),
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
  }, [getCheckoutValidationError, pendingBooking, showToast, t]);

  const handlePayPalApprove = useCallback(async (data: PayPalApproveData) => {
    setPaymentError('');
    setIsProcessing(true);

    try {
      if (!pendingBooking) {
        throw new Error('PayPal 결제 세션을 찾을 수 없습니다. 다시 시도해주세요.');
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
        const message = result.error || 'PayPal 결제 승인 처리에 실패했습니다.';
        setPaymentError(message);
        showToast(message, 'error');
        return;
      }

      router.push(`/services/${requestId}/payment/complete?orderId=${pendingBooking.order_id}&method=paypal`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'PayPal 결제 승인 처리 중 오류가 발생했습니다.';
      setPaymentError(message);
      showToast(message, 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [pendingBooking, requestId, router, showToast]);

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
          console.error('[PAYPAL][SERVICE] client button error:', error);
          setPaymentError(message);
          setIsProcessing(false);
          showToast(message, 'error');
        },
      })
      .render(container)
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'PayPal 버튼을 불러오지 못했습니다.';
        console.error('[PAYPAL][SERVICE] button render error:', error);
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
      if (!isCardReady || !portOneImpCode) {
        const message = '카드 결제를 지금 사용할 수 없습니다. 무통장 또는 PayPal을 이용해주세요.';
        setPaymentError(message);
        showToast(message, 'error');
        setIsProcessing(false);
        return;
      }

      if (!window.IMP) {
        setPaymentError(t('sp_err_module') as string);
        setIsProcessing(false);
        return;
      }

      // v2 에스크로: 사전 생성된 orderId 사용 (새 예약 생성 불필요)
      const { order_id: orderId, amount } = currentBooking;

      window.IMP.init(portOneImpCode);
      window.IMP.request_pay(
        {
          pg: 'nice_v2',
          pay_method: 'card',
          merchant_uid: orderId,
          name: currentRequest.title,
          amount,
          buyer_email: user?.email,
          buyer_name: contactName.trim(),
          buyer_tel: contactPhone.trim(),
          m_redirect_url: `${window.location.origin}/services/${requestId}/payment/complete`,
        },
        async (rsp: ImpResponse) => {
          if (!rsp.success) {
            setPaymentError(rsp.error_msg || (t('sp_err_cancel') as string));
            setIsProcessing(false);
            return;
          }

          // 서버 검증 (서비스 전용 callback 엔드포인트)
          const callbackRes = await fetch('/api/services/payment/nicepay-callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imp_uid: rsp.imp_uid,
              merchant_uid: orderId,
              orderId,
            }),
          });

          const callbackResult = (await callbackRes.json()) as { success?: boolean; error?: string };

          if (!callbackRes.ok || !callbackResult.success) {
            setPaymentError(callbackResult.error || (t('sp_err_verify') as string));
            setIsProcessing(false);
            return;
          }

          router.push(`/services/${requestId}/payment/complete?orderId=${orderId}`);
        }
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : (t('sp_err_process') as string);
      setPaymentError(message);
      setIsProcessing(false);
    }
  };

  if (!request || !pendingBooking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <>
      <Script src="https://cdn.iamport.kr/v1/iamport.js" strategy="lazyOnload" />
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
            const message = 'PayPal 결제 모듈을 불러오지 못했습니다.';
            setPaypalSdkError(message);
            setIsPayPalSdkReady(false);
          }}
        />
      )}
      <div className="max-w-lg mx-auto px-4 py-6 md:py-10 pb-28 md:pb-12">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50">
            <ChevronLeft size={18} />
          </button>
          <h1 className="text-[18px] md:text-xl font-black">{t('sp_title')}</h1>
        </div>

        {/* 에스크로 안내 */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5 mb-5 flex items-start gap-3">
          <Lock size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] md:text-[13px] font-bold text-amber-800 mb-0.5">{t('sp_escrow_badge')}</p>
            <p className="text-[11px] md:text-[12px] text-amber-700 leading-relaxed">
              {t('sp_escrow_desc')}
            </p>
          </div>
        </div>

        {/* 서비스 요약 */}
        <div className="bg-slate-50 rounded-2xl p-4 md:p-5 mb-5">
          <h2 className="font-bold text-[14px] md:text-[15px] mb-2 line-clamp-2">{request.title}</h2>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] md:text-[13px] text-slate-500">
            <span className="flex items-center gap-1"><Clock size={11} />{request.duration_hours}{t('req_duration_hours')}</span>
            <span className="flex items-center gap-1"><Users size={11} />{request.guest_count}{t('req_guest_count')}</span>
            <span>{request.service_date} {request.start_time}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center">
            <span className="text-[12px] md:text-sm text-slate-500">{t('sp_payment_amount')}</span>
            <span className="font-black text-[18px] md:text-xl text-slate-900">₩{request.total_customer_price.toLocaleString()}</span>
          </div>
        </div>

        {/* 예약자 정보 */}
        <div className="mb-5">
          <h3 className="text-[13px] md:text-sm font-bold text-slate-700 mb-3">{t('sp_booker_info')}</h3>
          <div className="space-y-3">
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder={t('sp_booker_name_ph') as string}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder={t('sp_booker_phone_ph') as string}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        {/* 결제 수단 선택 */}
        <div className="mb-5">
          <h3 className="text-[13px] md:text-sm font-bold text-slate-700 mb-3">{t('sp_method_title')}</h3>
          {isCardReadyResolved && !isCardReady && (
            <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 md:text-[12px]">
              {cardReadyReason === 'missing_imp_code'
                ? '카드 결제 설정이 아직 완료되지 않아 무통장 또는 PayPal만 사용할 수 있습니다.'
                : '카드 결제 검증 준비가 완료되지 않아 무통장 또는 PayPal만 사용할 수 있습니다.'}
            </p>
          )}
          <div className={`grid gap-3 ${isPayPalEnabled ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <button
              type="button"
              onClick={() => {
                if (isCardReady) {
                  setPaymentMethod('card');
                }
              }}
              disabled={!isCardReadyResolved || !isCardReady}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${paymentMethod === 'card'
                  ? 'border-slate-900 bg-slate-50'
                  : !isCardReadyResolved || !isCardReady
                    ? 'border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
            >
              <CreditCard size={20} className={paymentMethod === 'card' ? 'text-slate-900' : 'text-slate-400'} />
              <span className={`text-[12px] md:text-[13px] font-bold ${paymentMethod === 'card' ? 'text-slate-900' : 'text-slate-400'}`}>{t('sp_method_card')}</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('bank')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${paymentMethod === 'bank'
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-200 hover:border-slate-300'
                }`}
            >
              <Landmark size={20} className={paymentMethod === 'bank' ? 'text-slate-900' : 'text-slate-400'} />
              <span className={`text-[12px] md:text-[13px] font-bold ${paymentMethod === 'bank' ? 'text-slate-900' : 'text-slate-400'}`}>{t('sp_method_bank')}</span>
            </button>
            {isPayPalEnabled && (
              <button
                type="button"
                onClick={() => setPaymentMethod('paypal')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${paymentMethod === 'paypal'
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-300'
                  }`}
              >
                <div className="rounded bg-[#0070ba] px-2 py-0.5 text-[10px] font-black text-white">PayPal</div>
                <span className={`text-[12px] md:text-[13px] font-bold ${paymentMethod === 'paypal' ? 'text-slate-900' : 'text-slate-400'}`}>PayPal</span>
              </button>
            )}
          </div>
        </div>

        {/* 무통장 계좌 안내 */}
        {paymentMethod === 'bank' && (
          <div className="bg-slate-50 p-3 md:p-4 rounded-lg md:rounded-xl border border-slate-200 mb-5 animate-in fade-in zoom-in-95">
            <p className="text-[11px] md:text-xs font-bold text-slate-500 mb-1">{t('sp_bank_account')}</p>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-black text-[16px] md:text-lg text-slate-900">{process.env.NEXT_PUBLIC_BANK_ACCOUNT || '3333-14-0254739'}</span>
              <span className="text-[10px] md:text-xs font-bold bg-yellow-300 px-1 md:px-1.5 py-0.5 rounded text-black">{process.env.NEXT_PUBLIC_BANK_NAME || '카카오뱅크'}</span>
            </div>
            <p className="text-[11px] md:text-xs text-slate-400">
              {t('sp_bank_notice_1')}<span className="text-rose-500 font-bold">{t('sp_bank_notice_hl')}</span>{t('sp_bank_notice_2')}
            </p>
          </div>
        )}

        {paymentMethod === 'paypal' && (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:rounded-xl md:p-4 mb-5 animate-in fade-in zoom-in-95">
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
                <Loader2 size={16} className="mr-2 animate-spin" />
                PayPal 버튼을 불러오는 중입니다.
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
          <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
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
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[14px] md:text-base hover:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
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
          <div className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-[12px] text-slate-500">
            위 PayPal 버튼에서 승인하면 결제가 완료됩니다.
          </div>
        )}
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
