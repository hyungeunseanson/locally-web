'use client';

import React, { useEffect, useState } from 'react';
import { Settings, BookOpen, CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useLanguage } from '@/app/context/LanguageContext';

import ExperienceEarningsPanel from './components/ExperienceEarningsPanel';
import ServiceEarningsPanel from './components/ServiceEarningsPanel';

type EarningsTab = 'experience' | 'service';

export default function Earnings() {
  const router = useRouter();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<EarningsTab>('experience');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const closeMenu = () => setShowSettings(false);
    if (showSettings) {
      document.addEventListener('click', closeMenu);
    }

    return () => document.removeEventListener('click', closeMenu);
  }, [showSettings]);

  const tabClass = (tab: EarningsTab) =>
    `inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-bold transition-colors md:px-5 md:text-sm ${
      activeTab === tab
        ? 'bg-slate-900 text-white shadow-sm'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    }`;

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

      <div className="mb-4 md:mb-5">
        <div
          data-testid="host-earnings-tabs"
          className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm"
        >
          <button
            type="button"
            data-testid="host-earnings-tab-experience"
            className={tabClass('experience')}
            onClick={() => setActiveTab('experience')}
          >
            {t('hp_earn_tab_experience')}
          </button>
          <button
            type="button"
            data-testid="host-earnings-tab-service"
            className={tabClass('service')}
            onClick={() => setActiveTab('service')}
          >
            {t('hp_earn_tab_service')}
          </button>
        </div>
      </div>

      {activeTab === 'experience' ? <ExperienceEarningsPanel /> : <ServiceEarningsPanel />}
    </div>
  );
}
