'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Info, Briefcase, Calendar, Clock } from 'lucide-react';

import Skeleton from '@/app/components/ui/Skeleton';
import { useLanguage } from '@/app/context/LanguageContext';
import type {
  HostServiceEarningsItem,
  HostServiceEarningsResponse,
  HostServiceEarningsSummary,
  HostServiceSettlementStage,
} from '@/app/types/hostEarnings';

import { formatLatestPayoutDate } from './earningsShared';

type ServiceEarningsPanelProps = {
  summary: HostServiceEarningsSummary;
};

function getSettlementStageClass(stage: HostServiceSettlementStage) {
  if (stage === 'paid') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (stage === 'pending') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border-blue-200 bg-blue-50 text-blue-700';
}

export default function ServiceEarningsPanel({ summary }: ServiceEarningsPanelProps) {
  const { t, lang } = useLanguage();
  const [serviceLoading, setServiceLoading] = useState(true);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [serviceItems, setServiceItems] = useState<HostServiceEarningsItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchServiceEarnings = async () => {
      try {
        setServiceLoading(true);

        const response = await fetch('/api/host/earnings/services', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        const json = (await response.json()) as
          | HostServiceEarningsResponse
          | { success?: false; error?: string };

        if (!response.ok || !('success' in json) || json.success !== true) {
          throw new Error('error' in json ? json.error || 'Failed to load service earnings.' : 'Failed to load service earnings.');
        }

        if (cancelled) return;

        setServiceItems(json.items);
      } catch (error) {
        if (cancelled) return;
        console.error('[HOST] service earnings panel error:', error);
        setServiceError(error instanceof Error ? error.message : 'Failed to load service earnings.');
      } finally {
        if (!cancelled) {
          setServiceLoading(false);
        }
      }
    };

    void fetchServiceEarnings();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      data-testid="host-earnings-service-section"
      className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xl shadow-slate-200/60 md:rounded-[2.5rem] md:p-8"
    >
      <div
        data-testid="host-service-earnings-scope-note"
        className="mb-5 flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-medium leading-relaxed text-slate-600 md:mb-6 md:text-xs"
      >
        <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
        <p>{t('hp_service_earn_scope_note')}</p>
      </div>

      <div className="mb-6 text-center md:mb-8">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 md:mb-2 md:text-xs">
          {t('hp_service_earn_pending')}
        </p>
        <h2
          data-testid="host-service-earnings-total-pending"
          className="text-3xl font-black tracking-tight text-slate-900 md:text-5xl"
        >
          ₩{summary.pending_payout_amount.toLocaleString()}
        </h2>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <div
            data-testid="host-service-earnings-completed-count"
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
          >
            {t('hp_service_earn_completed_count').replace('{count}', String(summary.completed_service_count))}
          </div>
          <div
            data-testid="host-service-earnings-payout-items"
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
          >
            {t('hp_service_earn_payout_items').replace('{count}', String(summary.payout_item_count))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-[11px] font-semibold text-slate-500 md:text-xs">{t('hp_service_earn_in_progress')}</p>
          <p data-testid="host-service-earnings-in-progress" className="mt-2 text-xl font-black text-slate-900 md:text-2xl">
            ₩{summary.in_progress_amount.toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-[11px] font-semibold text-slate-500 md:text-xs">{t('hp_service_earn_paid')}</p>
          <p data-testid="host-service-earnings-paid" className="mt-2 text-xl font-black text-slate-900 md:text-2xl">
            ₩{summary.paid_payout_amount.toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-[11px] font-semibold text-slate-500 md:text-xs">{t('hp_service_earn_last_paid')}</p>
          <p data-testid="host-service-earnings-last-paid" className="mt-2 text-sm font-bold text-slate-900 md:text-base">
            {formatLatestPayoutDate(summary.latest_paid_at, lang) || t('hp_service_earn_last_paid_empty')}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 md:text-lg">{t('hp_service_earn_recent_items')}</h3>
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 md:text-xs">
            {serviceItems.length}
          </span>
        </div>

        {serviceLoading ? (
          <Skeleton className="h-[240px] w-full rounded-3xl" />
        ) : serviceError ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-5 text-sm font-medium text-rose-700">
            {serviceError}
          </div>
        ) : serviceItems.length === 0 ? (
          <div
            data-testid="host-service-earnings-empty"
            className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm font-medium text-slate-500"
          >
            {t('hp_service_earn_empty')}
          </div>
        ) : (
          <div data-testid="host-service-earnings-item-list" className="space-y-3">
            {serviceItems.map((item) => {
              const cardContent = (
                <div
                  data-testid={`host-service-earnings-item-${item.id}`}
                  className={`rounded-2xl border border-slate-200 bg-white px-4 py-4 ${
                    item.request_id ? 'transition-colors hover:bg-slate-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Briefcase size={14} className="shrink-0" />
                        <p className="truncate text-sm font-semibold text-slate-900 md:text-[15px]">{item.title}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 md:text-xs">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {item.service_date || '-'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {item.start_time || '-'}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span
                        data-testid={`host-service-earnings-stage-${item.id}`}
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold md:text-[11px] ${getSettlementStageClass(item.settlement_stage)}`}
                      >
                        {t(`hp_service_earn_status_${item.settlement_stage}`)}
                      </span>
                      <p className="mt-2 text-base font-black text-slate-900 md:text-lg">
                        ₩{item.host_payout_amount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              );

              if (!item.request_id) {
                return (
                  <div key={item.id} className="block" aria-disabled="true">
                    {cardContent}
                  </div>
                );
              }

              return (
                <Link key={item.id} href={`/services/${item.request_id}`} className="block">
                  {cardContent}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
