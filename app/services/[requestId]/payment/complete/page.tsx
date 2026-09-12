'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, ArrowRight, Loader2, Clock, Landmark, LifeBuoy } from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';
import SiteHeader from '@/app/components/SiteHeader';
import { getPublicBankInfo } from '@/app/utils/publicBankInfo';
import { useAuth } from '@/app/context/AuthContext';
import { useLocallyMembership } from '@/app/hooks/useLocallyMembership';

function ServicePaymentCompleteContent() {
  const params = useParams<{ requestId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') ?? '';
  const isBank = searchParams.get('method') === 'bank';
  const { t } = useLanguage();
  const { user } = useAuth();
  const { membership } = useLocallyMembership(user?.id);
  const bankInfo = getPublicBankInfo();
  const detailHref = `/services/${params.requestId}`;
  const [connectionError, setConnectionError] = useState('');

  useEffect(() => {
    if (isBank) return;
    let active = true;
    const connectToSupport = async () => {
      try {
        const response = await fetch(`/api/services/${encodeURIComponent(params.requestId)}/support-thread`, {
          method: 'POST',
        });
        const result = await response.json() as { success?: boolean; redirectUrl?: string; error?: string };
        if (!active) return;
        if (response.ok && result.success && result.redirectUrl) {
          router.replace(result.redirectUrl);
          return;
        }
        setConnectionError(t('spc_connection_error'));
      } catch {
        if (active) setConnectionError(t('spc_connection_error'));
      }
    };
    void connectToSupport();
    return () => { active = false; };
  }, [isBank, params.requestId, router, t]);

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-left md:px-8 md:py-16">
      <header className="border-b border-zinc-200 pb-8">
        <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-md border border-zinc-300 text-zinc-950">
          {isBank ? <Clock size={20} /> : <CheckCircle size={20} />}
        </div>
        <h1 className="mb-3 text-3xl font-semibold tracking-[-0.035em] text-zinc-950 md:text-4xl">
          {isBank ? t('spc_bank_title') : t('spc_card_title')}
        </h1>
        <p className="text-sm leading-6 text-zinc-700 md:text-base">
          {isBank ? t('spc_bank_desc') : t('spc_card_desc')}
        </p>
        <p className="mt-2 text-xs leading-5 text-zinc-500 md:text-sm">
          {isBank ? t('spc_bank_sub') : t('spc_card_sub')}
        </p>
      </header>

      <section className="border-b border-zinc-200 py-8">
        {orderId && (
          <div className="mb-6">
            <p className="mb-1 text-[10px] text-zinc-500 md:text-xs">{t('spc_order_no')}</p>
            <p className="break-all font-mono text-[13px] font-medium text-zinc-800 md:text-sm">{orderId}</p>
          </div>
        )}

        {isBank && (
          <div className="mb-6 rounded-md border border-zinc-300 p-4">
            <div className="mb-3 flex items-center gap-2 text-zinc-800">
              <Landmark className="h-4 w-4" />
              <p className="text-xs font-semibold md:text-sm">{t('spc_bank_acc_label')}</p>
            </div>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg font-semibold text-zinc-950 md:text-xl">{bankInfo.account}</span>
              <span className="rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 md:text-xs">{bankInfo.bankName}</span>
            </div>
            <p className="text-[11px] text-zinc-600 md:text-xs">
              {t('spc_bank_account_holder_label')}: {bankInfo.accountHolder}
            </p>
            <p className="mt-2 text-[11px] font-semibold text-zinc-950 md:text-xs">{t('spc_bank_warn')}</p>
          </div>
        )}

        <div className="rounded-md bg-zinc-100 p-4 md:p-5">
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-zinc-600 md:text-xs">{t('spc_next_title')}</p>
          <p className="text-[13px] leading-6 text-zinc-700 md:text-sm">
            {isBank ? t('spc_bank_next') : t('spc_card_next')}
          </p>
        </div>
        {!isBank && (
          <div className="mt-4 border-l-2 border-zinc-950 px-4 py-2 text-xs font-medium text-zinc-700">
            {connectionError || t('spc_connecting')}
          </div>
        )}
      </section>

      {!isBank && membership && membership.status !== 'none' && (
        <section className="border-b border-zinc-200 py-7">
          <p className="text-[11px] font-medium tracking-wide text-zinc-500">{t('membership_label')}</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-zinc-950 md:text-2xl">
            {membership.status === 'circle' ? t('membership_complete_circle_title') : t('membership_complete_member_title')}
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-zinc-600 md:text-[15px]">
            {membership.status === 'circle' ? t('membership_complete_circle_desc') : t('membership_complete_member_desc')}
          </p>
        </section>
      )}

      <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Link href={detailHref} className="flex items-center justify-center gap-2 rounded-md bg-zinc-950 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 md:text-base">
          {t('spc_btn_detail')} <ArrowRight size={16} />
        </Link>
        <Link href="/guest/trips#custom-services" className="flex items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-5 py-3.5 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-950 hover:text-zinc-950 md:text-base">
          {t('spc_btn_my_req')}
        </Link>
      </div>
      <div className="mt-5 flex items-center gap-4 text-xs md:text-sm">
        <Link href="/help" className="inline-flex items-center gap-1.5 font-medium text-zinc-500 transition-colors hover:text-zinc-950">
          <LifeBuoy className="h-4 w-4" /> {t('spc_support')}
        </Link>
        <Link href="/" className="font-medium text-zinc-400 transition-colors hover:text-zinc-700">
          {t('spc_btn_home')}
        </Link>
      </div>
    </main>
  );
}

export default function ServicePaymentCompletePage() {
  return (
    <div className="min-h-screen bg-white font-sans text-zinc-950">
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
