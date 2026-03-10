'use client';

import React from 'react';
import Image from 'next/image';
import { X, Star, Briefcase, Globe, Music, MessageCircle, User } from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';
import { formatLanguageLevelLabel, getLocalizedLanguageLabel } from '@/app/utils/languageLevels';

type HostModalData = {
  name: string;
  avatarUrl?: string;
  reviewCount?: number;
  rating?: number | null;
  joinedYear?: number | null;
  job?: string;
  dreamDestination?: string;
  favoriteSong?: string;
  languages?: string[];
  languageLevel?: number | null;
  intro?: string;
  onContactHost?: () => void;
};

type HostProfileModalProps = {
  isOpen: boolean;
  onClose: () => void;
  host: HostModalData;
};

export default function HostProfileModal({ isOpen, onClose, host }: HostProfileModalProps) {
  const { lang, t } = useLanguage();
  if (!isOpen) return null;
  const hasStats = host.reviewCount !== undefined || host.rating !== undefined;
  const hasInterestingFacts = Boolean(
    host.job || host.dreamDestination || host.favoriteSong || (host.languages && host.languages.length > 0)
  );
  const languageLevelLabel = formatLanguageLevelLabel(host.languageLevel, lang);
  const localizedLanguages = Array.isArray(host.languages)
    ? host.languages.map((language) => getLocalizedLanguageLabel(String(language), lang)).filter(Boolean)
    : [];

  const handleContactHost = () => {
    onClose();
    if (host.onContactHost) {
      setTimeout(() => host.onContactHost?.(), 0);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center p-0 md:p-4">
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      {/* 모달 컨텐츠 */}
      <div className="bg-white w-full max-w-full md:max-w-5xl max-h-[88dvh] md:max-h-[85vh] rounded-t-[28px] md:rounded-3xl overflow-hidden shadow-2xl relative z-10 flex flex-col md:flex-row animate-in zoom-in-95 duration-200">

        {/* 닫기 버튼 */}
        <button onClick={onClose} className="absolute top-3 md:top-4 left-3 md:left-4 p-1.5 md:p-2 bg-white rounded-full hover:bg-slate-100 transition-colors z-20 shadow-sm border border-slate-100">
          <X size={18} className="md:w-5 md:h-5" />
        </button>

        {/* 🟢 왼쪽: 호스트 카드 (고정 영역) */}
        <div className="w-full md:w-[360px] bg-white p-5 md:p-10 flex flex-col items-start border-b md:border-b-0 md:border-r border-slate-100 overflow-y-auto shadow-none md:shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
          <div className="flex flex-col items-center w-full text-center mb-5 md:mb-8">
            <div className="relative mb-3 md:mb-4">
              <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden shadow-lg border-4 border-white">
                {host.avatarUrl ? (
                  <Image
                    src={host.avatarUrl}
                    className="object-cover"
                    fill
                    alt={`${host.name} ${t('exp_host_modal_title')}`}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-300">
                    <User className="h-10 w-10 md:h-12 md:w-12" />
                  </div>
                )}
              </div>
            </div>
            <h2 className="text-[22px] md:text-3xl font-black text-slate-900 mb-1">{host.name}</h2>
            <div className="flex items-center gap-2 text-[12px] md:text-sm font-bold text-slate-500">
              <span>{host.joinedYear ? t('exp_host_active_since', { year: host.joinedYear }) : t('exp_host_default_status')}</span>
            </div>
          </div>

          {hasStats && (
            <div className="flex justify-around w-full border-y border-slate-100 py-4 md:py-6 mb-5 md:mb-8">
              {host.reviewCount !== undefined && (
                <div className="text-center">
                  <div className="font-black text-[16px] md:text-lg">{host.reviewCount}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{t('exp_host_reviews_label')}</div>
                </div>
              )}
              {host.reviewCount !== undefined && host.rating !== undefined && (
                <div className="w-[1px] bg-slate-100"></div>
              )}
              {host.rating !== undefined && (
                <div className="text-center">
                  <div className="font-black text-[16px] md:text-lg flex items-center gap-1">
                    {host.rating != null ? Number(host.rating).toFixed(2) : '-'}
                    {host.rating != null ? <Star size={12} fill="black" /> : null}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{t('exp_host_rating_label')}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 🟢 오른쪽: 상세 소개 (스크롤 영역) */}
        <div className="flex-1 p-5 md:p-12 overflow-y-auto bg-white">
          <h3 className="text-[20px] md:text-2xl font-bold mb-6 md:mb-8">{t('exp_host_modal_title')}</h3>

          {hasInterestingFacts && (
            <div className="bg-slate-50 p-4 md:p-6 rounded-xl md:rounded-2xl mb-6 md:mb-8">
              <h4 className="font-bold text-[14px] md:text-base mb-3 md:mb-4 text-slate-900 flex items-center gap-2">{t('exp_host_fun_facts_title', { name: host.name })}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 md:gap-y-4 gap-x-4 md:gap-x-8">
                {host.job && (
                  <div className="flex items-start gap-3">
                    <Briefcase className="text-slate-400 mt-0.5" size={18} />
                    <div className="text-[13px] md:text-sm">{t('exp_host_fact_job')}: <span className="font-bold text-slate-900">{host.job}</span></div>
                  </div>
                )}
                {host.dreamDestination && (
                  <div className="flex items-start gap-3">
                    <Globe className="text-slate-400 mt-0.5" size={18} />
                    <div className="text-[13px] md:text-sm">{t('exp_host_fact_dream_destination')}: <span className="font-bold text-slate-900">{host.dreamDestination}</span></div>
                  </div>
                )}
                {host.favoriteSong && (
                  <div className="flex items-start gap-3">
                    <Music className="text-slate-400 mt-0.5" size={18} />
                    <div className="text-[13px] md:text-sm">{t('exp_host_fact_favorite_song')}: <span className="font-bold text-slate-900">{host.favoriteSong}</span></div>
                  </div>
                )}
                {!!localizedLanguages.length && (
                  <div className="flex items-start gap-3">
                    <MessageCircle className="text-slate-400 mt-0.5" size={18} />
                    <div className="text-[13px] md:text-sm">
                      {t('exp_host_fact_languages')}: <span className="font-bold text-slate-900">{localizedLanguages.join(', ')}</span>
                      {languageLevelLabel ? <span className="text-slate-500 font-medium"> · {languageLevelLabel}</span> : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3 md:space-y-4">
            <h4 className="font-bold text-[15px] md:text-lg">{t('exp_host_about_title')}</h4>
            <p className="text-slate-600 leading-relaxed md:leading-loose text-[13px] md:text-base whitespace-pre-wrap">
              {host.intro || t('exp_host_default_intro_long')}
            </p>
          </div>

          <div className="mt-8 md:mt-12 pt-5 md:pt-8 border-t border-slate-100">
            <button onClick={handleContactHost} className="w-full md:w-auto bg-black text-white px-6 md:px-8 py-3 md:py-4 rounded-lg md:rounded-xl text-[14px] md:text-base font-bold hover:scale-105 transition-transform shadow-lg">
              {t('exp_host_contact_button')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
