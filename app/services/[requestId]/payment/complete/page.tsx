'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { CheckCircle, ArrowRight, Loader2, Clock, Landmark, LifeBuoy } from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';
import SiteHeader from '@/app/components/SiteHeader';
import { getPublicBankInfo } from '@/app/utils/publicBankInfo';
import { useAuth } from '@/app/context/AuthContext';
import { useLocallyMembership } from '@/app/hooks/useLocallyMembership';

function ServicePaymentCompleteContent() {
  const params = useParams<{ requestId: string }>();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') ?? '';
  const isBank = searchParams.get('method') === 'bank';
  const { t } = useLanguage();
  const { user } = useAuth();
  const { membership } = useLocallyMembership(user?.id);
  const bankInfo = getPublicBankInfo();
  const detailHref = `/services/${params.requestId}`;

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-16 text-center">
      <div className="mb-8 md:mb-10">
        <div className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full shadow-sm ${isBank ? 'bg-amber-100 text-amber-500' : 'bg-emerald-100 text-emerald-500'}`}>
          {isBank ? <Clock size={38} /> : <CheckCircle size={38} />}
        </div>
        <h1 className="mb-2 text-[24px] md:text-4xl font-black tracking-tight text-slate-900">
          {isBank ? t('spc_bank_title') : t('spc_card_title')}
        </h1>
        <p className="text-[14px] md:text-lg text-slate-500">
          {isBank ? t('spc_bank_desc') : t('spc_card_desc')}
        </p>
        <p className="mt-2 text-[12px] md:text-sm text-slate-400">
          {isBank ? t('spc_bank_sub') : t('spc_card_sub')}
        </p>
      </div>

      <div className="mx-auto mb-8 max-w-2xl rounded-3xl border border-slate-100 bg-slate-50 p-5 text-left shadow-sm md:p-8">
        {orderId && (
          <div className="mb-5 rounded-2xl border border-slate-100 bg-white px-4 py-3">
            <p className="mb-1 text-[10px] md:text-xs text-slate-400">{t('spc_order_no')}</p>
            <p className="font-mono text-[13px] md:text-sm font-bold text-slate-700">{orderId}</p>
          </div>
        )}

        {isBank && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-amber-800">
              <Landmark className="h-4 w-4" />
              <p className="text-[12px] md:text-sm font-bold">{t('spc_bank_acc_label')}</p>
            </div>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[18px] md:text-xl font-black text-slate-900">{bankInfo.account}</span>
              <span className="rounded bg-yellow-300 px-1.5 py-0.5 text-[10px] md:text-xs font-bold text-black">{bankInfo.bankName}</span>
            </div>
            <p className="text-[11px] md:text-xs text-slate-600">
              {t('spc_bank_account_holder_label')}: {bankInfo.accountHolder}
            </p>
            <p className="mt-2 text-[11px] md:text-xs font-semibold text-rose-500">{t('spc_bank_warn')}</p>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <p className="mb-2 text-[11px] md:text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{t('spc_next_title')}</p>
          <p className="text-[13px] md:text-sm leading-6 text-slate-600">
            {isBank ? t('spc_bank_next') : t('spc_card_next')}
          </p>
        </div>
      </div>

      {!isBank && membership && membership.status !== 'none' && (
        <div className="mx-auto mb-8 max-w-2xl rounded-3xl border border-rose-100 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(255,247,247,1))] p-5 text-left shadow-sm md:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-400">{t('membership_label')}</p>
          <h2 className="mt-2 text-[22px] font-black tracking-tight text-slate-900 md:text-[28px]">
            {membership.status === 'circle' ? t('membership_complete_circle_title') : t('membership_complete_member_title')}
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-slate-600 md:text-[15px]">
            {membership.status === 'circle' ? t('membership_complete_circle_desc') : t('membership_complete_member_desc')}
          </p>
        </div>
      )}

      <div className="mx-auto mb-3 grid max-w-2xl grid-cols-1 gap-3 md:grid-cols-2">
        <Link href={detailHref} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-[14px] md:text-base font-black text-white transition-colors hover:bg-slate-800">
          {t('spc_btn_detail')} <ArrowRight size={16} />
        </Link>
        <Link href="/services/my" className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-[14px] md:text-base font-bold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900">
          {t('spc_btn_my_req')}
        </Link>
      </div>
      <div className="mx-auto mb-10 flex max-w-2xl items-center justify-center gap-4 text-[12px] md:text-sm">
        <Link href="/help" className="inline-flex items-center gap-1.5 font-semibold text-slate-500 transition-colors hover:text-slate-900">
          <LifeBuoy className="h-4 w-4" /> {t('spc_support')}
        </Link>
        <Link href="/" className="font-semibold text-slate-400 transition-colors hover:text-slate-700">
          {t('spc_btn_home')}
        </Link>
      </div>
    </main>
  );
}

export default function ServicePaymentCompletePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
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
