'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
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
  }
}

type PendingBooking = {
  order_id: string;
  amount: number;
  status: string;
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
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank'>('card');

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
      .select('order_id, amount, status')
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

  const handlePayment = async () => {
    setPaymentError('');

    if (!contactName.trim() || !contactPhone.trim()) {
      showToast(t('sp_err_empty') as string, 'error');
      return;
    }
    if (!agreeTerms) {
      showToast(t('sp_err_terms') as string, 'error');
      return;
    }
    if (!request || !pendingBooking) {
      showToast(t('sp_err_info') as string, 'error');
      return;
    }

    setIsProcessing(true);
    try {
      // 무통장 입금: IMP 호출 없이 결제수단 저장 후 완료 페이지로 이동
      if (paymentMethod === 'bank') {
        const markRes = await fetch('/api/services/payment/mark-bank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: pendingBooking.order_id }),
        });
        if (!markRes.ok) {
          setPaymentError(t('sp_err_bank_fail') as string);
          setIsProcessing(false);
          return;
        }
        router.push(`/services/${requestId}/payment/complete?orderId=${pendingBooking.order_id}&method=bank`);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!window.IMP) {
        setPaymentError(t('sp_err_module') as string);
        setIsProcessing(false);
        return;
      }

      // v2 에스크로: 사전 생성된 orderId 사용 (새 예약 생성 불필요)
      const { order_id: orderId, amount } = pendingBooking;

      window.IMP.init('imp44607000');
      window.IMP.request_pay(
        {
          pg: 'nice_v2',
          pay_method: 'card',
          merchant_uid: orderId,
          name: request.title,
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
              merchant_uid: orderId,
              imp_uid: rsp.imp_uid,
              paid_amount: amount,
              orderId,
              amount,
              resCode: '0000',
              signData: '',
              ediDate: '',
            }),
          });

          if (!callbackRes.ok) {
            setPaymentError(t('sp_err_verify') as string);
            setIsProcessing(false);
            return;
          }

          router.push(`/services/${requestId}/payment/complete?orderId=${orderId}`);
        }
      );
    } catch {
      setPaymentError(t('sp_err_process') as string);
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
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaymentMethod('card')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${paymentMethod === 'card'
                  ? 'border-slate-900 bg-slate-50'
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
        <button
          onClick={handlePayment}
          disabled={isProcessing}
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
