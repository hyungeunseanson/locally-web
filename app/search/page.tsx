'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import SiteHeader from '@/app/components/SiteHeader';
import SiteFooter from '@/app/components/SiteFooter';
import ExperienceCard from '@/app/components/ExperienceCard';
import {
  Map,
  List,
  MapPin,
  ExternalLink,
  Ghost,
  ArrowLeft,
  SlidersHorizontal,
  ChevronDown,
  X,
  Heart,
  Coffee,
  Building2,
  Ticket,
  Utensils,
  Flag,
  Landmark,
  ShoppingBag,
  TreePine,
  Palette,
  Dumbbell,
  MoonStar,
} from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { getContent } from '@/app/utils/contentHelper';
import { getLocalizedExperienceText } from '@/app/utils/experienceTranslation';
import { formatLocalizedExperienceLocation, getLocalizedCityLabel } from '@/app/utils/locationLocalization';
import { getLocalizedSearchLocationLabel } from '@/app/utils/searchLocationCatalog';
import { getExperienceLanguageBadges, getExperiencePriceParts } from '@/app/utils/experienceCardDisplay';
import { normalizeProfileLanguageValue } from '@/app/utils/profile';
import { normalizeServiceCity } from '@/app/utils/serviceRequestLocation';
import type {
  SearchExperience,
  SearchExperiencesResponse,
  SearchTimeId,
  SearchTypeId,
} from './searchContract';

const TYPE_OPTION_IDS: Array<{ id: SearchTypeId; icon: typeof Utensils }> = [
  { id: 'food_tour', icon: Utensils },
  { id: 'cafe_dessert', icon: Coffee },
  { id: 'walking_healing', icon: TreePine },
  { id: 'shopping', icon: ShoppingBag },
  { id: 'culture', icon: Landmark },
  { id: 'activity', icon: Dumbbell },
  { id: 'nightlife', icon: MoonStar },
  { id: 'architecture', icon: Building2 },
  { id: 'show_sports', icon: Ticket },
  { id: 'landmark', icon: Flag },
  { id: 'one_day_class', icon: Palette },
] as const;

const CITY_FILTER_OPTIONS = ['도쿄', '오사카', '후쿠오카', '삿포로', '나고야', '서울', '부산', '제주'] as const;

const SEARCH_LOCALE_MAP: Record<string, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
  zh: 'zh-CN',
};

const TIME_OPTION_IDS = [
  { id: 'morning' as SearchTimeId, labelKey: 'search_time_morning', descKey: 'search_time_morning_desc' },
  { id: 'afternoon' as SearchTimeId, labelKey: 'search_time_afternoon', descKey: 'search_time_afternoon_desc' },
  { id: 'evening' as SearchTimeId, labelKey: 'search_time_evening', descKey: 'search_time_evening_desc' },
] as const;

function formatShortDate(iso: string | null, lang: string) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(SEARCH_LOCALE_MAP[lang] || 'en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function getSearchLanguageLabel(value: string, t: (key: string) => string) {
  if (!value || value === 'all') return '';

  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === 'ko') return t('lang_ko');
  if (normalizedValue === 'en') return t('lang_en');
  if (normalizedValue === 'ja') return t('lang_ja');
  if (normalizedValue === 'zh') return t('lang_zh');

  const normalized = normalizeProfileLanguageValue(value);
  if (normalized === 'Korean') return t('lang_ko');
  if (normalized === 'English') return t('lang_en');
  if (normalized === 'Japanese') return t('lang_ja');
  if (normalized === 'Chinese') return t('lang_zh');
  return value;
}

function getTypeLabelKey(id: SearchTypeId) {
  return `search_type_${id === 'cafe_dessert' ? 'cafe' : id === 'walking_healing' ? 'walking' : id}`;
}

function formatDesktopDateRange(startDate: string | null, endDate: string | null, lang: string) {
  const startLabel = formatShortDate(startDate, lang);
  const endLabel = formatShortDate(endDate, lang);

  if (startLabel && endLabel && startLabel !== endLabel) {
    return `${startLabel} - ${endLabel}`;
  }

  return startLabel || endLabel;
}

function getExperienceCountLabel(count: number, lang: string) {
  if (lang === 'en') return `${count} experiences`;
  if (lang === 'ja') return `${count}件の体験`;
  if (lang === 'zh') return `${count}个体验`;
  return `${count}개의 체험`;
}

function normalizeMapValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getSearchExperienceMeetingPoint(item: SearchExperience, lang: string) {
  return getLocalizedExperienceText(item as Record<string, unknown>, 'meeting_point', lang).trim();
}

function getSearchExperienceMapQuery(item: SearchExperience, lang: string) {
  const meetingPoint = getSearchExperienceMeetingPoint(item, lang);
  const addressLine = normalizeMapValue(item.location);
  const city = normalizeMapValue(item.city);
  const country = normalizeMapValue(item.country);
  const primary = meetingPoint || addressLine || formatLocalizedExperienceLocation(item, lang);

  return Array.from(new Set([primary, city, country].map(normalizeMapValue).filter(Boolean))).join(', ');
}

function SearchResults() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { lang, t } = useLanguage();

  const [experiences, setExperiences] = useState<SearchExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExperienceId, setSelectedExperienceId] = useState<string | null>(null);
  const [desktopPopover, setDesktopPopover] = useState<'city' | 'type' | 'time' | null>(null);
  const requestSeqRef = useRef(0);
  const desktopPopoverRef = useRef<HTMLDivElement | null>(null);

  const [activeSheet, setActiveSheet] = useState<'city' | 'type' | 'time' | 'filter' | null>(null);
  const [mobileCitySheetMode, setMobileCitySheetMode] = useState<'filter' | 'header' | null>(null);
  const [selectedTimes, setSelectedTimes] = useState<SearchTimeId[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<SearchTypeId[]>([]);

  const location = searchParams.get('location') || '';
  const language = searchParams.get('language') || 'all';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const selectedCity = normalizeServiceCity(searchParams.get('city') || '');

  const displayLocation = getLocalizedSearchLocationLabel(location, lang, t);
  const headerTitle = location
    ? t('search_mobile_header_title_with_location', { location: displayLocation })
    : t('search_mobile_header_title');
  const headerSub = [
    startDate ? formatShortDate(startDate, lang) : '',
    endDate ? formatShortDate(endDate, lang) : '',
    getSearchLanguageLabel(language, t),
  ]
    .filter(Boolean)
    .join(' · ');

  const selectedTimesKey = useMemo(() => [...selectedTimes].sort().join(','), [selectedTimes]);
  const selectedTypesKey = useMemo(() => [...selectedTypes].sort().join(','), [selectedTypes]);
  const searchSignature = `${location}|${language}|${startDate || ''}|${endDate || ''}|${selectedCity}|${selectedTimesKey}|${selectedTypesKey}`;

  const replaceSearchParams = (mutator: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    mutator(nextParams);
    const queryString = nextParams.toString();

    if (!queryString) {
      window.history.replaceState(null, '', pathname);
      return;
    }

    router.replace(`${pathname}?${queryString}`, { scroll: false });
  };

  const closeSheet = () => {
    setActiveSheet(null);
    setMobileCitySheetMode(null);
  };

  const openMobileCitySheet = (mode: 'filter' | 'header') => {
    setMobileCitySheetMode(mode);
    setActiveSheet('city');
  };

  useLayoutEffect(() => {
    // 쿼리 변경 직후 이전 결과가 한 프레임 노출되는 현상을 방지
    setLoading(true);
    setExperiences([]);
    setSelectedExperienceId(null);
  }, [searchSignature]);

  useEffect(() => {
    const requestId = ++requestSeqRef.current;

    const fetchSearchResults = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (location) params.set('location', location);
        if (language) params.set('language', language);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        if (selectedCity) params.set('city', selectedCity);
        if (selectedTimesKey) params.set('times', selectedTimesKey);
        if (selectedTypesKey) params.set('types', selectedTypesKey);

        const response = await fetch(`/api/search/experiences?${params.toString()}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || t('search_results_load_error'));
        }

        const nextData = ((payload as SearchExperiencesResponse).data ?? []) as SearchExperience[];
        if (requestId === requestSeqRef.current) {
          setExperiences(nextData);
        }
      } catch (error) {
        console.error('Search error:', error);
        if (requestId === requestSeqRef.current) {
          showToast(t('search_results_load_error'), 'error');
        }
      } finally {
        if (requestId === requestSeqRef.current) {
          setLoading(false);
        }
      }
    };

    fetchSearchResults();
  }, [location, language, startDate, endDate, selectedCity, selectedTimesKey, selectedTypesKey, showToast, searchSignature]);

  useEffect(() => {
    if (!selectedExperienceId) return;
    if (!experiences.some((item) => String(item.id) === selectedExperienceId)) {
      setSelectedExperienceId(null);
    }
  }, [experiences, selectedExperienceId]);

  useEffect(() => {
    if (!desktopPopover) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!desktopPopoverRef.current?.contains(event.target as Node)) {
        setDesktopPopover(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [desktopPopover]);

  const mobileSections = useMemo(() => {
    const cityName = displayLocation || t('search_place_tokyo');
    const sectionBase = experiences;

    return [
      { id: 'izakaya', title: t('search_mobile_section_izakaya', { city: cityName }), items: sectionBase.slice(0, 12) },
      { id: 'alley', title: t('search_mobile_section_alley', { city: cityName }), items: [...sectionBase.slice(2), ...sectionBase].slice(0, 12) },
      { id: 'japanese', title: t('search_mobile_section_japanese', { city: cityName }), items: [...sectionBase.slice(5), ...sectionBase].slice(0, 12) },
    ];
  }, [displayLocation, experiences, t]);

  const toggleTime = (id: SearchTimeId) => {
    setSelectedTimes((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const toggleType = (id: SearchTypeId) => {
    setSelectedTypes((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const clearSheetFilters = () => {
    if (activeSheet === 'city') {
      if (mobileCitySheetMode === 'header') {
        handleHeaderCitySelection('');
      } else {
        handleCityFilterChange('');
      }
    }
    if (activeSheet === 'time') setSelectedTimes([]);
    if (activeSheet === 'type') setSelectedTypes([]);
    if (activeSheet === 'filter') {
      setSelectedTimes([]);
      setSelectedTypes([]);
    }
  };

  const clearAllSearchFilters = () => {
    setSelectedTimes([]);
    setSelectedTypes([]);
    if (selectedCity) {
      replaceSearchParams((params) => {
        params.delete('city');
      });
    }
  };

  const getActiveCitySelection = () => (
    mobileCitySheetMode === 'header'
      ? normalizeServiceCity(location)
      : selectedCity
  );

  const activeCitySelection = getActiveCitySelection();

  const hasSheetSelection =
    activeSheet === 'city'
      ? Boolean(activeCitySelection)
      : activeSheet === 'time'
      ? selectedTimes.length > 0
      : activeSheet === 'type'
        ? selectedTypes.length > 0
        : selectedTypes.length > 0 || selectedTimes.length > 0;
  const hasDesktopFilters = selectedTypes.length > 0 || selectedTimes.length > 0 || Boolean(selectedCity);

  const desktopSummaryPills = useMemo(() => {
    const nextPills: Array<{ id: 'location' | 'date' | 'language'; label: string }> = [];

    if (displayLocation) {
      nextPills.push({ id: 'location', label: displayLocation });
    }

    const dateLabel = formatDesktopDateRange(startDate, endDate, lang);
    if (dateLabel) {
      nextPills.push({ id: 'date', label: dateLabel });
    }

    const languageLabel = getSearchLanguageLabel(language, t);
    if (languageLabel) {
      nextPills.push({ id: 'language', label: languageLabel });
    }

    return nextPills;
  }, [displayLocation, endDate, lang, language, startDate, t]);

  const handleCityFilterChange = (value: string) => {
    setDesktopPopover(null);
    replaceSearchParams((params) => {
      if (!value) {
        params.delete('city');
        return;
      }

      params.set('city', value);
    });
  };

  const handleHeaderCitySelection = (value: string) => {
    replaceSearchParams((params) => {
      if (!value) {
        params.delete('location');
        params.delete('city');
        return;
      }

      params.set('location', value);
      params.set('city', value);
    });
  };

  const toggleSelectedExperience = (experienceId: string) => {
    setSelectedExperienceId((prev) => (prev === experienceId ? null : experienceId));
  };

  const handleDesktopCardClickCapture = (event: React.MouseEvent<HTMLDivElement>, experienceId: string) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    toggleSelectedExperience(experienceId);
  };

  const handleDesktopCardKeyDownCapture = (event: React.KeyboardEvent<HTMLDivElement>, experienceId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    toggleSelectedExperience(experienceId);
  };

  const selectedExperience = useMemo(() => {
    if (!selectedExperienceId) return null;
    return experiences.find((item) => String(item.id) === selectedExperienceId) ?? null;
  }, [experiences, selectedExperienceId]);

  const activeMapTitle = selectedExperience
    ? getContent(selectedExperience, 'title', lang) || t('exp_card_title_fallback')
    : '';

  const activeMapLocation = selectedExperience
    ? getSearchExperienceMeetingPoint(selectedExperience, lang)
      || normalizeMapValue(selectedExperience.location)
      || formatLocalizedExperienceLocation(selectedExperience, lang)
      || t('exp_card_location_fallback')
    : '';

  const activeMapQuery = selectedExperience ? getSearchExperienceMapQuery(selectedExperience, lang) : '';
  const activeMapEmbedUrl = activeMapQuery
    ? `https://maps.google.com/maps?q=${encodeURIComponent(activeMapQuery)}&t=&z=15&ie=UTF8&iwloc=&output=embed`
    : '';
  const activeMapExternalUrl = activeMapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeMapQuery)}`
    : '';
  const desktopGridClassName = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4';

  const renderMobileCard = (item: SearchExperience) => {
    const imageUrl =
      item.photos?.[0] ||
      item.image_url ||
      'https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=800&q=80';
    const title = getContent(item, 'title', lang) || t('exp_card_title_fallback');
    const city =
      formatLocalizedExperienceLocation(
        { city: item.city, country: item.country, location: location || undefined },
        lang
      ) || t('exp_card_location_fallback');
    const languageBadges = getExperienceLanguageBadges(item.languages, lang);
    const { prefix: pricePrefix, suffix: priceSuffix } = getExperiencePriceParts(lang);
    const rating = item.rating && item.rating > 0 ? item.rating.toFixed(2) : t('exp_card_new');
    const rawPrice = typeof item.price === 'number' ? item.price : Number(item.price);
    const price = Number.isFinite(rawPrice) ? Number(rawPrice).toLocaleString() : '45,000';

    return (
      <Link key={item.id} href={`/experiences/${item.id}`} data-testid={`search-mobile-result-card-${item.id}`} className="w-[168px] shrink-0">
        <div className="relative w-full aspect-[0.95] rounded-[16px] overflow-hidden bg-slate-200">
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="168px"
            unoptimized
            className="object-cover"
          />
          <button
            className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/20 backdrop-blur-[1px] border border-white/70 flex items-center justify-center"
            aria-label={t('exp_card_wishlist_toggle')}
          >
            <Heart size={16} className="text-white" />
          </button>
        </div>
        <div className="pt-2">
          <p className="text-[11px] font-semibold text-[#222] leading-[1.35] line-clamp-2">{title}</p>
          <div className="mt-0.5 flex items-center gap-1 overflow-hidden text-[10px] text-[#6B6B6B]">
            <span className="truncate leading-none">{city}</span>
            {languageBadges.visible.map((label) => (
              <span key={label} className="inline-flex h-[14px] shrink-0 items-center self-center rounded-full border border-slate-200 bg-slate-50 px-1.5 text-[8px] font-medium leading-none text-slate-600">
                {label}
              </span>
            ))}
            {languageBadges.hiddenCount > 0 && (
              <span className="inline-flex h-[14px] shrink-0 items-center self-center rounded-full border border-slate-200 bg-slate-50 px-1.5 text-[8px] font-medium leading-none text-slate-600">
                {t('exp_card_languages_more', { count: languageBadges.hiddenCount })}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-[#3E3E3E]">
            {pricePrefix}<span className="font-semibold">₩{price}{priceSuffix}</span> · ★ {rating}
          </p>
        </div>
      </Link>
    );
  };

  return (
    <>
      <div className="md:hidden min-h-screen bg-[#F7F7F7] pb-[88px]">
        <div className="sticky top-0 z-40 bg-[#F7F7F7] px-4 pt-[calc(env(safe-area-inset-top,0px)+8px)] pb-2">
          <div className="flex items-center gap-2">
            <button onClick={() => window.history.back()} className="w-9 h-9 flex items-center justify-center text-[#222]" aria-label={t('button_back')}>
              <ArrowLeft size={20} />
            </button>

            <button
              type="button"
              data-testid="search-mobile-header-trigger"
              aria-haspopup="dialog"
              aria-expanded={activeSheet === 'city' && mobileCitySheetMode === 'header'}
              onClick={() => openMobileCitySheet('header')}
              className="flex-1 h-[56px] rounded-full bg-white border border-[#E6E6E6] px-4 text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center"
            >
              <span className="inline-flex items-center gap-1">
                <span data-testid="search-mobile-header-title" className="text-[12px] font-semibold text-[#202020] leading-tight">{headerTitle}</span>
                <ChevronDown size={13} className="text-[#7C7C7C]" />
              </span>
              {headerSub && <span className="text-[10px] text-[#787878] leading-tight mt-[1px]">{headerSub}</span>}
            </button>

            <button onClick={() => { setMobileCitySheetMode(null); setActiveSheet('filter'); }} className="w-9 h-9 flex items-center justify-center text-[#222]">
              <SlidersHorizontal size={18} />
            </button>
          </div>

          <div className="mt-3 -mx-1 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 px-1">
              <button
                type="button"
                data-testid="search-mobile-type-chip"
                onClick={() => { setMobileCitySheetMode(null); setActiveSheet('type'); }}
                className={`h-8 shrink-0 rounded-full border px-3.5 text-[11px] font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.95] ${
                  selectedTypes.length > 0 ? 'bg-white border-[#222] text-[#222]' : 'bg-white border-[#D8D8D8] text-[#444]'
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {t('search_filter_type')}
                  <ChevronDown size={12} />
                </span>
              </button>
              <button
                type="button"
                data-testid="search-mobile-time-chip"
                onClick={() => { setMobileCitySheetMode(null); setActiveSheet('time'); }}
                className={`h-8 shrink-0 rounded-full border px-3.5 text-[11px] font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.95] ${
                  selectedTimes.length > 0 ? 'bg-white border-[#222] text-[#222]' : 'bg-white border-[#D8D8D8] text-[#444]'
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {t('search_filter_time_slot')}
                  <ChevronDown size={12} />
                </span>
              </button>
              <button
                type="button"
                data-testid="search-mobile-city-chip"
                onClick={() => openMobileCitySheet('filter')}
                className={`h-8 shrink-0 rounded-full border px-3.5 text-[11px] font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.95] ${
                  selectedCity ? 'bg-white border-[#222] text-[#222]' : 'bg-white border-[#D8D8D8] text-[#444]'
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {selectedCity ? getLocalizedCityLabel(selectedCity, lang) : t('search_filter_city')}
                  <ChevronDown size={12} />
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 pt-3">
          {loading ? (
            <div className="space-y-6">
              {[1, 2].map((row) => (
                <div key={row}>
                  <div className="h-5 w-52 bg-slate-200 rounded mb-3 animate-pulse" />
                  <div className="flex gap-3 overflow-hidden">
                    {[1, 2, 3].map((card) => (
                      <div key={card} className="w-[168px] shrink-0 animate-pulse">
                        <div className="aspect-[0.95] rounded-[16px] bg-slate-200 mb-2" />
                        <div className="h-3 bg-slate-200 rounded mb-1" />
                        <div className="h-3 w-2/3 bg-slate-200 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : experiences.length === 0 ? (
            <div data-testid="search-empty-state" className="min-h-[66vh] flex flex-col items-center justify-center text-center">
              <div className="relative w-[154px] h-[112px] mb-5">
                <img
                  src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=480&q=80"
                  alt="thumb1"
                  className="absolute top-0 left-[42px] w-[84px] h-[60px] object-cover rounded-[10px] rotate-[7deg]"
                />
                <img
                  src="https://images.unsplash.com/photo-1528715471579-d1bcf0ba5e83?auto=format&fit=crop&w=480&q=80"
                  alt="thumb2"
                  className="absolute top-[18px] left-[14px] w-[92px] h-[66px] object-cover rounded-[12px] -rotate-[14deg]"
                />
                <img
                  src="https://images.unsplash.com/photo-1480796927426-f609979314bd?auto=format&fit=crop&w=480&q=80"
                  alt="thumb3"
                  className="absolute top-[24px] left-[60px] w-[98px] h-[70px] object-cover rounded-[12px] rotate-[2deg]"
                />
              </div>
              <h3 className="text-[24px] font-bold text-[#212121] leading-tight">{t('search_empty_title')}</h3>
              <p className="mt-2 text-[13px] text-[#7A7A7A] leading-snug">{t('search_empty_desc')}</p>
              <div className="mt-5 flex flex-col gap-2 w-full max-w-[220px]">
                <button
                  type="button"
                  onClick={clearAllSearchFilters}
                  className="h-11 rounded-full border border-[#222] text-[13px] font-semibold text-[#222] bg-white"
                >
                  {t('search_empty_clear_filters')}
                </button>
                <Link
                  href="/search"
                  className="h-11 rounded-full bg-[#222429] text-white text-[13px] font-semibold flex items-center justify-center"
                >
                  {t('search_empty_browse_all')}
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-8 pb-6">
              <div data-testid="search-flow-hint-mobile" className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                <p className="text-[13px] font-bold text-[#202020]">{t('search_flow_hint_title')}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#6B6B6B]">{t('search_flow_hint_desc')}</p>
              </div>
              {mobileSections.filter((section) => section.items.length > 0).map((section) => (
                <section key={section.id}>
                  <h3 className="text-[17px] font-semibold text-[#202020] tracking-[-0.01em] leading-tight mb-3">{section.title}</h3>
                  <div className="flex gap-3 overflow-x-auto no-scrollbar pr-4">{section.items.map((item) => renderMobileCard(item))}</div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hidden md:flex pb-12 flex-col">
        <div data-testid="search-desktop-toolbar" className="z-30 px-5 md:px-6 xl:px-8 2xl:px-10 py-3 md:py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex flex-1 flex-wrap items-center gap-2 md:gap-3">
              {desktopSummaryPills.map((pill) => (
                <span
                  key={pill.id}
                  data-testid={`search-summary-pill-${pill.id}`}
                  className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700"
                >
                  {pill.label}
                </span>
              ))}

              <div ref={desktopPopoverRef} className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    data-testid="search-desktop-city-chip"
                    onClick={() => setDesktopPopover((prev) => (prev === 'city' ? null : 'city'))}
                    className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
                      selectedCity
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {selectedCity ? getLocalizedCityLabel(selectedCity, lang) : t('search_filter_city')}
                    <ChevronDown size={14} className={desktopPopover === 'city' ? 'rotate-180 transition-transform' : 'transition-transform'} />
                  </button>

                  {desktopPopover === 'city' && (
                    <div className="absolute left-0 top-full z-40 mt-3 w-[240px] rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
                      <div className="flex items-center justify-between gap-3 px-1">
                        <h3 className="text-sm font-bold text-slate-900">{t('search_filter_city')}</h3>
                        {selectedCity ? (
                          <button
                            type="button"
                            onClick={() => handleCityFilterChange('')}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                          >
                            {t('lang_all')}
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-3 space-y-1.5">
                        <button
                          type="button"
                          data-testid="search-city-option-all"
                          onClick={() => handleCityFilterChange('')}
                          className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                            !selectedCity ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {t('lang_all')}
                        </button>
                        {CITY_FILTER_OPTIONS.map((option) => {
                          const selected = selectedCity === option;
                          return (
                            <button
                              key={option}
                              type="button"
                              data-testid={`search-city-option-${option}`}
                              onClick={() => handleCityFilterChange(option)}
                              className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                                selected ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {getLocalizedCityLabel(option, lang)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    data-testid="search-desktop-type-chip"
                    onClick={() => setDesktopPopover((prev) => (prev === 'type' ? null : 'type'))}
                    className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
                      selectedTypes.length > 0
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {t('search_filter_experience_type')}
                    <ChevronDown size={14} className={desktopPopover === 'type' ? 'rotate-180 transition-transform' : 'transition-transform'} />
                  </button>

                  {desktopPopover === 'type' && (
                    <div className="absolute left-0 top-full z-40 mt-3 w-[340px] rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-bold text-slate-900">{t('search_filter_experience_type')}</h3>
                        {selectedTypes.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setSelectedTypes([])}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                          >
                            {t('search_filter_clear_all')}
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2.5">
                        {TYPE_OPTION_IDS.map((option) => {
                          const Icon = option.icon;
                          const selected = selectedTypes.includes(option.id);

                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => toggleType(option.id)}
                              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[12px] font-medium transition-colors ${
                                selected
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <Icon size={13} strokeWidth={1.8} />
                              {t(getTypeLabelKey(option.id))}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    data-testid="search-desktop-time-chip"
                    onClick={() => setDesktopPopover((prev) => (prev === 'time' ? null : 'time'))}
                    className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
                      selectedTimes.length > 0
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {t('search_filter_time_slot')}
                    <ChevronDown size={14} className={desktopPopover === 'time' ? 'rotate-180 transition-transform' : 'transition-transform'} />
                  </button>

                  {desktopPopover === 'time' && (
                    <div className="absolute left-0 top-full z-40 mt-3 w-[320px] rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-bold text-slate-900">{t('search_filter_time_slot')}</h3>
                        {selectedTimes.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setSelectedTimes([])}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                          >
                            {t('search_filter_clear_all')}
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-4 space-y-2.5">
                        {TIME_OPTION_IDS.map((option) => {
                          const selected = selectedTimes.includes(option.id);

                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => toggleTime(option.id)}
                              className={`flex w-full items-start justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                                selected
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <div>
                                <p className="text-sm font-semibold leading-tight">{t(option.labelKey)}</p>
                                <p className={`mt-1 text-xs leading-relaxed ${selected ? 'text-white/80' : 'text-slate-500'}`}>
                                  {t(option.descKey)}
                                </p>
                              </div>
                              <span
                                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                  selected ? 'border-white bg-white text-slate-900' : 'border-slate-300 text-transparent'
                                }`}
                              >
                                •
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {hasDesktopFilters ? (
                  <button
                    type="button"
                    onClick={clearAllSearchFilters}
                    className="inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  >
                    {t('search_filter_clear_all')}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <span className="text-sm font-bold text-slate-500 whitespace-nowrap">{getExperienceCountLabel(experiences.length, lang)}</span>
              <button
                type="button"
                data-testid="search-selected-experience-cta"
                disabled={!selectedExperienceId}
                onClick={() => {
                  if (!selectedExperienceId) return;
                  router.push(`/experiences/${selectedExperienceId}`);
                }}
                className={`hidden md:flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-md transition-colors ${
                  selectedExperienceId
                    ? 'bg-slate-900 text-white hover:bg-black'
                    : 'cursor-not-allowed bg-slate-200 text-slate-500 shadow-none'
                }`}
              >
                <List size={16} /> {t('search_selected_experience_cta')}
              </button>
            </div>
          </div>
        </div>

        <div className="w-full px-5 md:px-6 xl:px-8 2xl:px-10 py-4 md:py-5 xl:py-6 lg:grid lg:grid-cols-[minmax(0,1fr)_520px] xl:grid-cols-[minmax(0,1fr)_620px] 2xl:grid-cols-[minmax(0,1fr)_700px] lg:gap-6 xl:gap-8 lg:items-start">
          <div className="min-w-0">
            {loading ? (
              <div className={`grid gap-3 xl:gap-4 ${desktopGridClassName}`}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-slate-100 aspect-[4/3] rounded-xl mb-3"></div>
                    <div className="h-4 bg-slate-100 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : experiences.length === 0 ? (
              <div data-testid="search-empty-state" className="flex flex-col items-center justify-center h-full text-center py-20">
                <Ghost size={48} className="text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-900 mb-2">{t('search_empty_title')}</h3>
                <p className="text-slate-500 text-sm">{t('search_empty_desc')}</p>
                <div className="mt-5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={clearAllSearchFilters}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {t('search_empty_clear_filters')}
                  </button>
                  <Link
                    href="/search"
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-black"
                  >
                    {t('search_empty_browse_all')}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div data-testid="search-flow-hint" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                  <p className="text-sm font-black text-slate-900">{t('search_flow_hint_title')}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{t('search_flow_hint_desc')}</p>
                </div>
                <div data-testid="search-desktop-results-grid" className={`relative z-0 grid gap-3 xl:gap-4 ${desktopGridClassName}`}>
                  {experiences.map((item, index) => (
                    <div
                      key={item.id}
                      data-testid={`search-result-card-${item.id}`}
                      data-selected={selectedExperienceId === String(item.id) ? 'true' : 'false'}
                      className={`animate-in fade-in duration-500 rounded-2xl transition-all [&>a>div:first-child]:aspect-[4/4.45] ${
                        selectedExperienceId === String(item.id)
                          ? 'ring-2 ring-slate-900/70 shadow-[0_14px_36px_rgba(15,23,42,0.12)]'
                          : 'shadow-none'
                      }`}
                      style={{ animationDelay: `${Math.min(index * 60, 600)}ms`, animationFillMode: 'both' }}
                      onClickCapture={(event) => handleDesktopCardClickCapture(event, String(item.id))}
                      onKeyDownCapture={(event) => handleDesktopCardKeyDownCapture(event, String(item.id))}
                    >
                      <ExperienceCard data={item} showImageCategoryBadge />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="hidden lg:flex self-start lg:sticky lg:top-[104px] h-[calc(100vh-128px)] rounded-[28px] border border-slate-200 bg-white overflow-hidden">
            {selectedExperience && activeMapEmbedUrl ? (
              <div data-testid="search-map-panel" className="flex h-full w-full flex-col bg-white">
                <div className="border-b border-slate-200 px-5 py-5 xl:px-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {t('trip_map')}
                      </p>
                      <h3 data-testid="search-map-title" className="mt-2 text-lg font-bold leading-tight text-slate-900 line-clamp-2">
                        {activeMapTitle}
                      </h3>
                    </div>
                    {activeMapExternalUrl ? (
                      <Link
                        data-testid="search-map-external-link"
                        href={activeMapExternalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        Google Maps <ExternalLink size={13} />
                      </Link>
                    ) : null}
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {t('label_meeting_point')}
                    </p>
                    <div className="mt-2 flex items-start gap-2 text-slate-700">
                      <MapPin size={16} className="mt-0.5 shrink-0 text-slate-500" />
                      <p data-testid="search-map-meeting-point" className="text-sm font-medium leading-relaxed">
                        {activeMapLocation}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 items-center justify-center px-5 pb-6 pt-5 xl:px-6">
                  <div
                    data-testid="search-map-frame"
                    className="relative aspect-square w-full max-w-[380px] overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 shadow-[0_18px_50px_rgba(15,23,42,0.10)] xl:max-w-[450px] 2xl:max-w-[500px]"
                  >
                    <iframe
                      data-testid="search-map-iframe"
                      title={`${activeMapTitle} ${t('trip_map')}`}
                      src={activeMapEmbedUrl}
                      className="absolute inset-0 h-full w-full"
                      loading="lazy"
                      style={{ border: 0 }}
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div
                data-testid="search-map-empty-state"
                className="flex h-full w-full flex-col items-center justify-center bg-slate-50 px-8 text-center"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
                  <Map size={28} className="text-slate-400" />
                </div>
                <p className="mt-5 text-lg font-bold text-slate-900">{t('search_map_empty_title')}</p>
                <p className="mt-2 max-w-[320px] text-sm leading-relaxed text-slate-500">{t('search_map_empty_desc')}</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 md:px-6 xl:px-8 2xl:px-10 pt-4">
          <SiteFooter />
        </div>
      </div>

      {activeSheet && (
        <div className="fixed inset-0 z-[190] md:hidden">
          <button className="absolute inset-0 bg-black/35 animate-in fade-in duration-200" onClick={closeSheet} aria-label={t('button_close')} />

          <div
            className={`absolute inset-x-0 bottom-0 bg-white rounded-t-[28px] shadow-[0_-12px_32px_rgba(0,0,0,0.16)] flex flex-col animate-in slide-in-from-bottom-8 duration-300 ${
              activeSheet === 'time'
                ? 'h-[42dvh]'
                : activeSheet === 'city'
                  ? 'h-[54dvh]'
                  : activeSheet === 'type'
                    ? 'h-[54dvh]'
                    : 'h-[84dvh]'
            }`}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <h3 className="text-[20px] font-bold text-[#1F1F1F] leading-tight">
                {activeSheet === 'time'
                  ? t('search_filter_time_slot')
                  : activeSheet === 'city'
                    ? t('search_filter_city')
                    : activeSheet === 'type'
                      ? t('search_filter_experience_type')
                      : t('filter')}
              </h3>
              <button onClick={closeSheet} className="p-1 text-[#444]" aria-label={t('button_close')}>
                <X size={20} />
              </button>
            </div>

            <div className="px-6 overflow-y-auto">
              {activeSheet === 'city' && (
                <div data-testid="search-mobile-city-sheet" className="pt-1 space-y-2 pb-3">
                  <button
                    type="button"
                    data-testid="search-mobile-city-option-all"
                    onClick={() => {
                      if (mobileCitySheetMode === 'header') {
                        handleHeaderCitySelection('');
                        return;
                      }
                      handleCityFilterChange('');
                    }}
                    className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-[14px] font-medium transition-colors ${
                      !activeCitySelection ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {t('lang_all')}
                  </button>
                  {CITY_FILTER_OPTIONS.map((option) => {
                    const selected = activeCitySelection === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        data-testid={`search-mobile-city-option-${option}`}
                        onClick={() => {
                          if (mobileCitySheetMode === 'header') {
                            handleHeaderCitySelection(option);
                            return;
                          }
                          handleCityFilterChange(option);
                        }}
                        className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-[14px] font-medium transition-colors ${
                          selected ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {getLocalizedCityLabel(option, lang)}
                      </button>
                    );
                  })}
                </div>
              )}

              {activeSheet === 'time' && (
                <div className="pt-1 space-y-3">
                  {TIME_OPTION_IDS.map((option) => (
                    <button key={option.id} onClick={() => toggleTime(option.id)} className="w-full flex items-center justify-between text-left">
                      <div>
                        <p className="text-[15px] font-semibold text-[#222] leading-tight">{t(option.labelKey)}</p>
                        <p className="mt-1 text-[11px] text-[#8A8A8A] leading-tight">{t(option.descKey)}</p>
                      </div>
                      <div
                        className={`w-[24px] h-[24px] rounded-[7px] border-2 flex items-center justify-center ${
                          selectedTimes.includes(option.id) ? 'border-[#222] bg-[#222]' : 'border-[#B8B8B8] bg-white'
                        }`}
                      >
                        {selectedTimes.includes(option.id) && <div className="w-2.5 h-2.5 rounded-[3px] bg-white" />}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {activeSheet === 'type' && (
                <div className="pt-2 flex flex-wrap gap-3 pb-3">
                  {TYPE_OPTION_IDS.map((option) => {
                    const Icon = option.icon;
                    const selected = selectedTypes.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        onClick={() => toggleType(option.id)}
                        className={`h-9 px-3 rounded-full border flex items-center gap-1.5 text-[12px] font-medium transition-all duration-150 active:scale-[0.95] ${
                          selected ? 'border-[#222] bg-[#F8F8F8] text-[#222]' : 'border-[#D8D8D8] text-[#454545]'
                        }`}
                      >
                        <Icon size={13} strokeWidth={1.8} />
                        {t(getTypeLabelKey(option.id))}
                      </button>
                    );
                  })}
                </div>
              )}

              {activeSheet === 'filter' && (
                <div className="pt-1 pb-4">
                  <h4 className="text-[15px] font-semibold text-[#1F1F1F] mb-3">{t('search_filter_experience_type')}</h4>
                  <div className="flex flex-wrap gap-3 pb-5">
                    {TYPE_OPTION_IDS.map((option) => {
                      const Icon = option.icon;
                      const selected = selectedTypes.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          onClick={() => toggleType(option.id)}
                          className={`h-9 px-3 rounded-full border flex items-center gap-1.5 text-[12px] font-medium transition-all duration-150 active:scale-[0.95] ${
                            selected ? 'border-[#222] bg-[#F8F8F8] text-[#222]' : 'border-[#D8D8D8] text-[#454545]'
                          }`}
                        >
                          <Icon size={13} strokeWidth={1.8} />
                          {t(getTypeLabelKey(option.id))}
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t border-[#ECECEC] my-1" />

                  <h4 className="text-[15px] font-semibold text-[#1F1F1F] mt-5 mb-3">{t('search_filter_time_slot')}</h4>
                  <div className="flex flex-wrap gap-3 pb-2">
                    {TIME_OPTION_IDS.map((option) => {
                      const selected = selectedTimes.includes(option.id);
                      return (
                        <button
                          key={`filter-${option.id}`}
                          onClick={() => toggleTime(option.id)}
                          className={`h-9 px-4 rounded-full border text-[12px] font-medium transition-all duration-150 active:scale-[0.95] ${
                            selected ? 'border-[#222] bg-[#F8F8F8] text-[#222]' : 'border-[#D8D8D8] text-[#454545]'
                          }`}
                        >
                          {t(option.labelKey)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-auto border-t border-[#EEEEEE] px-5 py-4 flex items-center justify-between" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}>
              <button
                onClick={clearSheetFilters}
                disabled={!hasSheetSelection}
                className={`text-[14px] font-semibold ${hasSheetSelection ? 'text-[#333]' : 'text-[#D2D2D2]'}`}
              >
                {t('search_filter_clear_all')}
              </button>
              <button
                onClick={closeSheet}
                className="h-[44px] px-6 rounded-[10px] bg-[#222429] text-white text-[14px] font-semibold transition-all duration-150 active:scale-[0.97]"
              >
                {t('search_filter_show_results')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function SearchPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="hidden md:block">
        <SiteHeader />
      </div>
      <Suspense fallback={<div className="pt-32 text-center">{t('loading')}</div>}>
        <SearchResults />
      </Suspense>
    </div>
  );
}
