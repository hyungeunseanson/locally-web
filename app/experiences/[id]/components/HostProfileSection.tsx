'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { User, Globe } from 'lucide-react';
import HostProfileModal from './HostProfileModal';
import { useLanguage } from '@/app/context/LanguageContext';
import { getLocalizedLanguageLabel } from '@/app/utils/languageLevels';

interface HostProfileProps {
  hostId?: string;
  name: string;
  avatarUrl?: string;
  reviewCount?: number;
  rating?: number | null;
  job?: string;
  dreamDestination?: string;
  favoriteSong?: string;
  languages?: string[];
  intro?: string;
  joinedYear?: number | null;
  category?: string;
  onMessageHost?: () => void;
}

export default function HostProfileSection(props: HostProfileProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { lang, t } = useLanguage();
  const languageLine = Array.isArray(props.languages) && props.languages.length > 0
    ? Array.from(new Set(props.languages.map((language) => getLocalizedLanguageLabel(String(language).trim(), lang)).filter(Boolean))).join(', ')
    : '';

  return (
    <>
      <div className="py-6 md:py-8">
        <h3 className="text-[18px] md:text-[27px] font-semibold tracking-[-0.01em] mb-4 md:mb-5">{t('exp_host_intro_title')}</h3>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="w-full rounded-[18px] border border-white bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(251,251,252,0.99)_100%)] p-5 text-center shadow-[0_2px_8px_rgba(255,255,255,0.92),0_10px_22px_rgba(15,23,42,0.12),0_16px_30px_rgba(148,163,184,0.22)] ring-1 ring-slate-100 transition-shadow hover:shadow-[0_2px_10px_rgba(255,255,255,0.92),0_12px_24px_rgba(15,23,42,0.14),0_18px_34px_rgba(148,163,184,0.24)] md:rounded-[22px] md:p-7"
        >
          <div className="relative w-[80px] h-[80px] md:w-[96px] md:h-[96px] rounded-full overflow-hidden bg-slate-200 border border-slate-200 mx-auto mb-3 md:mb-4 flex items-center justify-center">
            {props.avatarUrl ? (
              <Image src={props.avatarUrl} className="object-cover" alt={props.name} fill />
            ) : (
              <User className="text-slate-300 w-10 h-10 md:w-12 md:h-12" />
            )}
          </div>
          <h4 className="text-[18px] md:text-[34px] font-semibold leading-none mb-1.5 md:mb-2">{props.name}</h4>
          <p className="text-[11px] md:text-[14px] text-slate-500 font-normal">{props.job || t('exp_host_default_job')}</p>
          {languageLine && (
            <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3 py-1 text-[10px] text-slate-500 shadow-[0_4px_12px_rgba(15,23,42,0.04)] md:text-[12px]">
              <Globe size={12} className="shrink-0 md:w-[13px] md:h-[13px]" />
              <span className="truncate">{languageLine}</span>
            </div>
          )}
        </button>

        <p className="text-[11px] md:text-[15px] leading-[1.45] md:leading-[1.5] text-slate-700 mt-4 md:mt-5 whitespace-pre-wrap">
          {props.intro || t('exp_host_default_intro_short')}
        </p>

        <button
          type="button"
          onClick={props.onMessageHost}
          className="mt-4 w-full min-h-[44px] rounded-xl bg-[#e7e7e9] px-4 py-3 text-[11px] font-medium text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-colors hover:bg-[#dddddf] md:mt-5 md:py-2.5 md:text-[14px]"
        >
          {t('exp_host_message_button', { name: props.name })}
        </button>

        <p className="text-[10px] text-slate-400 text-center mt-3">
          {t('exp_host_safe_payment_notice')}
        </p>
      </div>

      <HostProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        host={{
          ...props,
          reviewCount: props.reviewCount,
          rating: props.rating,
          onContactHost: props.onMessageHost,
        }}
      />
    </>
  );
}
