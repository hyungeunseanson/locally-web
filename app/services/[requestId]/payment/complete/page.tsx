'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react';

function ServicePaymentCompleteContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') ?? '';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-5">
        <CheckCircle size={40} className="text-emerald-500" />
      </div>

      <h1 className="text-[22px] md:text-3xl font-black text-slate-900 mb-2">결제 완료!</h1>
      <p className="text-[13px] md:text-base text-slate-500 mb-1">
        매칭이 확정되었습니다.
      </p>
      <p className="text-[12px] md:text-sm text-slate-400 mb-6">
        호스트가 연락드릴 예정이니 연락처를 확인해 주세요.
      </p>

      {orderId && (
        <div className="bg-slate-50 rounded-xl px-5 py-3 mb-8">
          <p className="text-[10px] md:text-xs text-slate-400 mb-0.5">주문번호</p>
          <p className="text-[12px] md:text-sm font-mono font-bold text-slate-700">{orderId}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link href="/services/my">
          <button className="w-full bg-slate-900 text-white py-3.5 rounded-2xl font-black text-[14px] md:text-base hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
            내 의뢰 확인하기 <ArrowRight size={16} />
          </button>
        </Link>
        <Link href="/">
          <button className="w-full text-slate-500 text-[13px] md:text-sm hover:text-slate-900 transition-colors">
            홈으로 돌아가기
          </button>
        </Link>
      </div>
    </div>
  );
}

export default function ServicePaymentCompletePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-slate-300" />
        </div>
      }>
        <ServicePaymentCompleteContent />
      </Suspense>
    </div>
  );
}
