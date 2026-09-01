'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Star, Briefcase, Globe, Music, MessageCircle, User } from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';
import { formatLanguageLevelLabel, getLocalizedLanguageLabel } from '@/app/utils/languageLevels';
import SuperhostBadgeTrigger from '@/app/components/SuperhostBadgeTrigger';
import { formatAgeBand, formatDemographicGender } from '@/app/utils/demographics';
import { fetchPublicDemographics, type PublicDemographics } from '@/app/utils/publicDemographicsClient';
import PublicHostProfileImage from '@/app/components/PublicHostProfileImage';

type HostModalData = {
  hostId?: string;
  name: string;
  avatarUrl?: string;
  nationality?: string;
  reviewCount?: number;
  rating?: number | null;
  joinedYear?: number | null;
  job?: string;
  dreamDestination?: string;
  favoriteSong?: string;
  isSuperhost?: boolean;
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

const NATIONALITY_DISPLAY: Record<string, { code: string; labels: Record<'ko' | 'en' | 'ja' | 'zh', string> }> = {
  kr: {
    code: 'KR',
    labels: { ko: '한국', en: 'Korea', ja: '韓国', zh: '韩国' },
  },
  jp: {
    code: 'JP',
    labels: { ko: '일본', en: 'Japan', ja: '日本', zh: '日本' },
  },
  us: {
    code: 'US',
    labels: { ko: '미국', en: 'United States', ja: 'アメリカ', zh: '美国' },
  },
  cn: {
    code: 'CN',
    labels: { ko: '중국', en: 'China', ja: '中国', zh: '中国' },
  },
  tw: {
    code: 'TW',
    labels: { ko: '대만', en: 'Taiwan', ja: '台湾', zh: '台湾' },
  },
  hk: {
    code: 'HK',
    labels: { ko: '홍콩', en: 'Hong Kong', ja: '香港', zh: '香港' },
  },
  sg: {
    code: 'SG',
    labels: { ko: '싱가포르', en: 'Singapore', ja: 'シンガポール', zh: '新加坡' },
  },
  my: {
    code: 'MY',
    labels: { ko: '말레이시아', en: 'Malaysia', ja: 'マレーシア', zh: '马来西亚' },
  },
};

const NATIONALITY_ALIAS_TO_KEY: Record<string, keyof typeof NATIONALITY_DISPLAY> = {
  kr: 'kr',
  korea: 'kr',
  'south korea': 'kr',
  korean: 'kr',
  '대한민국': 'kr',
  '한국': 'kr',
  '한국인': 'kr',
  jp: 'jp',
  japan: 'jp',
  japanese: 'jp',
  '일본': 'jp',
  '일본인': 'jp',
  '日本': 'jp',
  us: 'us',
  usa: 'us',
  america: 'us',
  'united states': 'us',
  '미국': 'us',
  cn: 'cn',
  china: 'cn',
  chinese: 'cn',
  '중국': 'cn',
  '中国': 'cn',
  tw: 'tw',
  taiwan: 'tw',
  '대만': 'tw',
  '台湾': 'tw',
  hk: 'hk',
  'hong kong': 'hk',
  hongkong: 'hk',
  '홍콩': 'hk',
  '香港': 'hk',
  sg: 'sg',
  singapore: 'sg',
  '싱가포르': 'sg',
  my: 'my',
  malaysia: 'my',
  '말레이시아': 'my',
};

function normalizeHostModalLocale(locale: string): 'ko' | 'en' | 'ja' | 'zh' {
  if (locale === 'en' || locale === 'ja' || locale === 'zh') return locale;
  return 'ko';
}

function toFlagEmoji(countryCode: string): string {
  return [...countryCode.toUpperCase()]
    .map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))
    .join('');
}

function getNationalityDisplay(nationality: string | undefined, locale: string) {
  const trimmed = String(nationality || '').trim();
  if (!trimmed) return null;

  const normalizedLocale = normalizeHostModalLocale(locale);
  const normalizedKey = NATIONALITY_ALIAS_TO_KEY[trimmed.toLowerCase()];
  if (normalizedKey) {
    const match = NATIONALITY_DISPLAY[normalizedKey];
    return {
      flag: toFlagEmoji(match.code),
      label: match.labels[normalizedLocale],
    };
  }

  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return {
      flag: toFlagEmoji(trimmed.toUpperCase()),
      label: trimmed.toUpperCase(),
    };
  }

  return {
    flag: null,
    label: trimmed,
  };
}

export default function HostProfileModal({ isOpen, onClose, host }: HostProfileModalProps) {
  const { lang, t } = useLanguage();
  const [demographicsResult, setDemographicsResult] = useState<{
    userId: string;
    value: PublicDemographics | null;
  } | null>(null);

  useEffect(() => {
    if (!isOpen || !host.hostId) return;

    let cancelled = false;
    void fetchPublicDemographics(host.hostId).then((value) => {
      if (!cancelled && host.hostId) {
        setDemographicsResult({ userId: host.hostId, value });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [host.hostId, isOpen]);

  if (!isOpen) return null;
  const demographics = demographicsResult && demographicsResult.userId === host.hostId
    ? demographicsResult.value
    : null;
  const hasStats = host.reviewCount !== undefined || host.rating !== undefined;
  const hasInterestingFacts = Boolean(
    host.job || host.dreamDestination || host.favoriteSong || (host.languages && host.languages.length > 0)
  );
  const languageLevelLabel = formatLanguageLevelLabel(host.languageLevel, lang);
  const localizedLanguages = Array.isArray(host.languages)
    ? Array.from(
        new Set(
          host.languages
            .map((language) => getLocalizedLanguageLabel(String(language).trim(), lang))
            .filter(Boolean)
        )
      )
    : [];
  const nationalityDisplay = getNationalityDisplay(host.nationality, lang);
  const ageBandLabel = formatAgeBand(demographics?.age_band, lang);
  const genderLabel = formatDemographicGender(demographics?.gender, lang);
  const demographicsLabel = [ageBandLabel, genderLabel].filter(Boolean).join(' · ');

  const handleContactHost = () => {
    onClose();
    if (host.onContactHost) {
      setTimeout(() => host.onContactHost?.(), 0);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-4 md:items-center md:p-4">
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      {/* 모달 컨텐츠 */}
      <div className="bg-white w-full max-w-[366px] md:max-w-5xl max-h-[80dvh] md:max-h-[85vh] rounded-[24px] md:rounded-3xl overflow-hidden shadow-2xl relative z-10 flex flex-col md:flex-row animate-in zoom-in-95 duration-200">

        {/* 닫기 버튼 */}
        <button onClick={onClose} className="absolute top-3 md:top-4 left-3 md:left-4 p-1.5 md:p-2 bg-white rounded-full hover:bg-slate-100 transition-colors z-20 shadow-sm border border-slate-100">
          <X size={18} className="md:w-5 md:h-5" />
        </button>

        {/* 🟢 왼쪽: 호스트 카드 (고정 영역) */}
        <div className="w-full md:w-[360px] bg-white p-4 md:p-10 flex flex-col items-start border-b md:border-b-0 md:border-r border-slate-100 overflow-y-auto shadow-none md:shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
          <div className={`flex flex-col items-center w-full text-center ${nationalityDisplay ? 'mb-3 md:mb-6' : 'mb-3 md:mb-8'}`}>
            <div className="relative mb-2.5 md:mb-4">
              <div className="relative w-20 h-20 md:w-32 md:h-32 rounded-full overflow-hidden shadow-lg border-4 border-white">
                {host.avatarUrl ? (
                  <PublicHostProfileImage
                    hostId={host.hostId}
                    originImageUrl={host.avatarUrl}
                    className="object-cover"
                    sizes="(max-width: 768px) 96px, 128px"
                    alt={`${host.name} ${t('exp_host_modal_title')}`}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-300">
                    <User className="h-10 w-10 md:h-12 md:w-12" />
                  </div>
                )}
              </div>
            </div>
            <div className="mb-1 flex items-center justify-center gap-1.5">
              <h2 className="text-[20px] md:text-3xl font-black text-slate-900">{host.name}</h2>
              {host.isSuperhost ? (
                <SuperhostBadgeTrigger
                  iconSize={20}
                  showLabel={false}
                  testIdPrefix="host-profile-modal-superhost-badge"
                />
              ) : null}
            </div>
            <div className="flex items-center gap-2 text-[12px] md:text-sm font-bold text-slate-500">
              <span>{host.joinedYear ? t('exp_host_active_since', { year: host.joinedYear }) : t('exp_host_default_status')}</span>
            </div>
            {nationalityDisplay && (
              <div
                data-testid="host-profile-nationality-chip"
                className="mt-2 md:mt-3 inline-flex h-[26px] md:h-[30px] items-center gap-1.5 md:gap-[7px] rounded-full border border-slate-200/80 bg-slate-50/95 px-2.5 md:px-3 text-[12px] md:text-[13px] font-medium md:font-semibold text-slate-600 shadow-sm"
              >
                {nationalityDisplay.flag ? (
                  <span className="text-[14px] md:text-[16px] leading-none" aria-hidden="true">
                    {nationalityDisplay.flag}
                  </span>
                ) : null}
                <span className="leading-none">{nationalityDisplay.label}</span>
              </div>
            )}
            {demographicsLabel && (
              <div
                data-testid="host-profile-demographics"
                className="mt-2 inline-flex h-[26px] items-center rounded-full border border-slate-200/80 bg-slate-50/95 px-3 text-[12px] font-semibold text-slate-600 shadow-sm md:h-[30px] md:text-[13px]"
              >
                {demographicsLabel}
              </div>
            )}
          </div>

          {hasStats && (
            <div className="flex justify-around w-full border-y border-slate-100 py-2 md:py-6 mb-2 md:mb-8">
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
        <div className="flex-1 p-4 md:p-12 overflow-y-auto bg-white">
          <h3 className="text-[18px] md:text-2xl font-bold mb-4 md:mb-8">{t('exp_host_modal_title')}</h3>

          {hasInterestingFacts && (
            <div className="bg-slate-50 p-3.5 md:p-6 rounded-xl md:rounded-2xl mb-5 md:mb-8">
              <h4 className="font-bold text-[13px] md:text-base mb-3 md:mb-4 text-slate-900 flex items-center gap-2">{t('exp_host_fun_facts_title', { name: host.name })}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2.5 md:gap-y-4 gap-x-4 md:gap-x-8">
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

          <div className="space-y-2.5 md:space-y-4">
            <h4 className="font-bold text-[15px] md:text-lg">{t('exp_host_about_title')}</h4>
            <p className="text-slate-600 leading-relaxed md:leading-loose text-[12px] md:text-base whitespace-pre-wrap">
              {host.intro || t('exp_host_default_intro_long')}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 md:mt-12 md:flex-row md:items-center md:pt-8">
            <button onClick={handleContactHost} className="w-full md:w-auto bg-black text-white px-6 md:px-8 py-3 md:py-4 rounded-lg md:rounded-xl text-[14px] md:text-base font-bold hover:scale-105 transition-transform shadow-lg">
              {t('exp_host_contact_button')}
            </button>
            {host.hostId ? (
              <Link
                href={`/users/${host.hostId}`}
                data-testid="host-profile-full-link"
                className="w-full rounded-lg border border-slate-300 bg-white px-6 py-3 text-center text-[14px] font-bold text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 md:w-auto md:rounded-xl md:px-8 md:py-4 md:text-base"
              >
                {t('exp_host_full_profile_link')}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
