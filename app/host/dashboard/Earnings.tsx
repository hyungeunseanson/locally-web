'use client';

import React, { useEffect, useState } from 'react';
import { Settings, BookOpen, CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';

import Skeleton from '@/app/components/ui/Skeleton';
import { useLanguage } from '@/app/context/LanguageContext';
import type { HostUnifiedEarningsSummary, HostUnifiedEarningsSummaryResponse } from '@/app/types/hostEarnings';

import ExperienceEarningsPanel from './components/ExperienceEarningsPanel';
import ServiceEarningsPanel from './components/ServiceEarningsPanel';
import UnifiedEarningsBreakdownCard from './components/UnifiedEarningsBreakdownCard';
import UnifiedEarningsHeroCard from './components/UnifiedEarningsHeroCard';

export default function Earnings() {
  const router = useRouter();
  const { t } = useLanguage();

  const [showSettings, setShowSettings] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summary, setSummary] = useState<HostUnifiedEarningsSummary | null>(null);

  useEffect(() => {
    const closeMenu = () => setShowSettings(false);
    if (showSettings) {
      document.addEventListener('click', closeMenu);
    }

    return () => document.removeEventListener('click', closeMenu);
  }, [showSettings]);

  useEffect(() => {
    let cancelled = false;

    const fetchSummary = async () => {
      try {
        const response = await fetch('/api/host/earnings/summary', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        const json = (await response.json()) as
          | HostUnifiedEarningsSummaryResponse
          | { success?: false; error?: string };

        if (!response.ok || !('success' in json) || json.success !== true) {
          throw new Error('error' in json ? json.error || 'Failed to load host earnings.' : 'Failed to load host earnings.');
        }

        if (cancelled) return;
        setSummary(json.summary);
      } catch (error) {
        if (cancelled) return;
        console.error('[HOST] unified earnings summary error:', error);
        setSummaryError(error instanceof Error ? error.message : 'Failed to load host earnings.');
      } finally {
        if (!cancelled) {
          setSummaryLoading(false);
        }
      }
    };

    void fetchSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-md mx-auto md:max-w-none md:mx-0 min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-4 md:mb-6 px-1 md:px-2 relative z-50">
        <h2 className="text-lg md:text-2xl font-bold text-slate-900">{t('hp_earn_title')}</h2>
        <div className="relative">
          <button
            onClick={(event) => {
              event.stopPropagation();
              setShowSettings((current) => !current);
            }}
            className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <Settings size={20} />
          </button>

          {showSettings && (
            <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <button
                onClick={() => router.push('/host/help')}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm font-medium text-slate-700 flex items-center gap-3 border-b border-slate-50"
              >
                <BookOpen size={16} className="text-slate-400" /> {t('host_guidebook')}
              </button>
              <button
                onClick={() => router.push('/host/dashboard?tab=profile')}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm font-medium text-slate-700 flex items-center gap-3"
              >
                <CreditCard size={16} className="text-slate-400" /> {t('manage_payout_account')}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 md:space-y-5">
        {summaryLoading ? (
          <>
            <div data-testid="host-earnings-unified-hero-skeleton">
              <Skeleton className="h-[128px] w-full rounded-3xl" />
            </div>
            <div data-testid="host-earnings-breakdown-skeleton">
              <Skeleton className="h-[140px] w-full rounded-3xl" />
            </div>
          </>
        ) : summaryError || !summary ? (
          <div className="rounded-3xl border border-rose-100 bg-rose-50 px-5 py-6 text-sm font-medium text-rose-700">
            {summaryError || 'Failed to load host earnings.'}
          </div>
        ) : (
          <>
            <UnifiedEarningsHeroCard summary={summary} />
            <UnifiedEarningsBreakdownCard summary={summary} />
            <ExperienceEarningsPanel summary={summary.experience} />
            <ServiceEarningsPanel summary={summary.service} />
          </>
        )}
      </div>
    </div>
  );
}
