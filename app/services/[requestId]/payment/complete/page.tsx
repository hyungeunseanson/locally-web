'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, ArrowRight, Loader2, Clock } from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';

function ServicePaymentCompleteContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') ?? '';
  const isBank = searchParams.get('method') === 'bank';
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      {isBank ? (
        <>
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-5">
            <Clock size={40} className="text-amber-500" />
          </div>
          <h1 className="text-[22px] md:text-3xl font-black text-slate-900 mb-2">{t('spc_bank_title')}</h1>
          <p className="text-[13px] md:text-base text-slate-500 mb-1">
            {t('spc_bank_desc')}
          </p>
          <div className="bg-slate-50 rounded-xl px-5 py-4 mb-6 w-full max-w-xs text-left">
            <p className="text-[10px] md:text-xs font-bold text-slate-500 mb-1">{t('spc_bank_acc_label')}</p>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-black text-[16px] md:text-lg text-slate-900">{process.env.NEXT_PUBLIC_BANK_ACCOUNT || '3333-14-0254739'}</span>
              <span className="text-[10px] md:text-xs font-bold bg-yellow-300 px-1.5 py-0.5 rounded text-black">{process.env.NEXT_PUBLIC_BANK_NAME || '카카오뱅크'}</span>
            </div>
            <p className="text-[11px] md:text-xs text-rose-500 font-bold">
              {t('spc_bank_warn')}
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-5">
            <CheckCircle size={40} className="text-emerald-500" />
          </div>
          <h1 className="text-[22px] md:text-3xl font-black text-slate-900 mb-2">{t('spc_card_title')}</h1>
          <p className="text-[13px] md:text-base text-slate-500 mb-1">
            {t('spc_card_desc')}
          </p>
          <p className="text-[12px] md:text-sm text-slate-400 mb-6">
            {t('spc_card_sub')}
          </p>
        </>
      )}

      {orderId && (
        <div className="bg-slate-50 rounded-xl px-5 py-3 mb-8">
          <p className="text-[10px] md:text-xs text-slate-400 mb-0.5">{t('spc_order_no')}</p>
          <p className="text-[12px] md:text-sm font-mono font-bold text-slate-700">{orderId}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link href="/services/my">
          <button className="w-full bg-slate-900 text-white py-3.5 rounded-2xl font-black text-[14px] md:text-base hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
            {t('spc_btn_my_req')} <ArrowRight size={16} />
          </button>
        </Link>
        <Link href="/">
          <button className="w-full text-slate-500 text-[13px] md:text-sm hover:text-slate-900 transition-colors">
            {t('spc_btn_home')}
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
