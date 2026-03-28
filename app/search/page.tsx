'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import SiteHeader from '@/app/components/SiteHeader';
import SiteFooter from '@/app/components/SiteFooter';
import ExperienceCard from '@/app/components/ExperienceCard';
import SearchFilter from './components/SearchFilter';
import {
  Map,
  List,
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
import { formatLocalizedExperienceLocation } from '@/app/utils/locationLocalization';
import { getExperienceLanguageBadges, getExperiencePriceParts } from '@/app/utils/experienceCardDisplay';
import { normalizeProfileLanguageValue } from '@/app/utils/profile';
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

const SEARCH_LOCALE_MAP: Record<string, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
  zh: 'zh-CN',
};

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

  const normalized = normalizeProfileLanguageValue(value);
  if (normalized === 'Korean') return t('lang_ko');
  if (normalized === 'English') return t('lang_en');
  if (normalized === 'Japanese') return t('lang_ja');
  if (normalized === 'Chinese') return t('lang_zh');
  return value;
}

function getSearchLocationLabel(value: string, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (!value) return '';

  const normalized = value.trim().toLowerCase();
  if (normalized === '도쿄' || normalized === 'tokyo') return t('search_place_tokyo');
  if (normalized === '오사카' || normalized === 'osaka') return t('search_place_osaka');
  if (normalized === '이자카야' || normalized === 'izakaya') return t('search_place_izakaya');
  if (normalized === '서울' || normalized === 'seoul') return t('search_place_seoul');
  return value;
}

function SearchResults() {
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { lang, t } = useLanguage();

  const [experiences, setExperiences] = useState<SearchExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(true);
  const requestSeqRef = useRef(0);

  const [activeSheet, setActiveSheet] = useState<'type' | 'time' | 'filter' | null>(null);
  const [selectedTimes, setSelectedTimes] = useState<SearchTimeId[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<SearchTypeId[]>([]);

  const location = searchParams.get('location') || '';
  const language = searchParams.get('language') || 'all';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  const displayLocation = getSearchLocationLabel(location, t);
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
  const searchSignature = `${location}|${language}|${startDate || ''}|${endDate || ''}|${selectedTimesKey}|${selectedTypesKey}`;

  useLayoutEffect(() => {
    // 쿼리 변경 직후 이전 결과가 한 프레임 노출되는 현상을 방지
    setLoading(true);
    setExperiences([]);
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
  }, [location, language, startDate, endDate, selectedTimesKey, selectedTypesKey, showToast, searchSignature]);

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
  };

  const hasSheetSelection =
    activeSheet === 'time'
      ? selectedTimes.length > 0
      : activeSheet === 'type'
        ? selectedTypes.length > 0
        : selectedTypes.length > 0 || selectedTimes.length > 0;

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
      <Link key={item.id} href={`/experiences/${item.id}`} className="w-[168px] shrink-0">
        <div className="relative w-full aspect-[0.95] rounded-[16px] overflow-hidden bg-slate-200">
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="168px"
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

            <div className="flex-1 h-[56px] rounded-full bg-white border border-[#E6E6E6] px-4 text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center">
              <div className="text-[12px] font-semibold text-[#202020] leading-tight">{headerTitle}</div>
              {headerSub && <div className="text-[10px] text-[#787878] leading-tight mt-[1px]">{headerSub}</div>}
            </div>

            <button onClick={() => setActiveSheet('filter')} className="w-9 h-9 flex items-center justify-center text-[#222]">
              <SlidersHorizontal size={18} />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              onClick={() => setActiveSheet('type')}
              className={`h-8 px-3.5 rounded-full border flex items-center gap-1 text-[11px] font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.95] ${
                selectedTypes.length > 0 ? 'bg-white border-[#222] text-[#222]' : 'bg-white border-[#D8D8D8] text-[#444]'
              }`}
            >
              {t('search_filter_type')}
              <ChevronDown size={12} />
            </button>
            <button
              onClick={() => setActiveSheet('time')}
              className={`h-8 px-3.5 rounded-full border flex items-center gap-1 text-[11px] font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.95] ${
                selectedTimes.length > 0 ? 'bg-white border-[#222] text-[#222]' : 'bg-white border-[#D8D8D8] text-[#444]'
              }`}
            >
              {t('search_filter_time_slot')}
              <ChevronDown size={12} />
            </button>
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

      <div className="hidden md:flex pt-0 md:pt-24 pb-12 h-[calc(100vh-80px)] flex-col">
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex items-center justify-between sticky top-[80px] bg-white z-40">
          <div className="flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar">
            <SearchFilter label="가격 범위" />
            <SearchFilter label="숙소 유형" />
            <div className="h-8 w-[1px] bg-slate-200 mx-2 shrink-0"></div>
            <span className="text-sm font-bold text-slate-500 whitespace-nowrap">{experiences.length}개의 체험</span>
          </div>

          <button
            onClick={() => setShowMap(!showMap)}
            className="hidden md:flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-bold shadow-md hover:bg-black transition-colors"
          >
            {showMap ? (
              <>
                <List size={16} /> 리스트 보기
              </>
            ) : (
              <>
                <Map size={16} /> 지도 보기
              </>
            )}
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className={`flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-6 ${showMap ? 'lg:w-3/5 xl:w-1/2' : 'w-full'}`}>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <div data-testid="search-flow-hint" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-black text-slate-900">{t('search_flow_hint_title')}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{t('search_flow_hint_desc')}</p>
                </div>
                <div className={`grid gap-6 ${showMap ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
                  {experiences.map((item, index) => (
                    <div key={item.id} className="animate-in fade-in duration-500" style={{ animationDelay: `${Math.min(index * 60, 600)}ms`, animationFillMode: 'both' }}>
                      <ExperienceCard data={item} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-12">
              <SiteFooter />
            </div>
          </div>

          {showMap && (
            <div className="hidden lg:block flex-1 bg-slate-100 relative h-full border-l border-slate-200">
              <div className="absolute inset-0 flex items-center justify-center flex-col text-slate-400 bg-slate-50">
                <Map size={48} className="mb-2 opacity-50" />
                <span className="text-sm font-medium">지도 뷰 준비 중입니다.</span>
                <span className="text-xs text-slate-400 mt-1">(Google Maps API 연동 예정)</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeSheet && (
        <div className="fixed inset-0 z-[190] md:hidden">
          <button className="absolute inset-0 bg-black/35 animate-in fade-in duration-200" onClick={() => setActiveSheet(null)} aria-label={t('button_close')} />

          <div
            className={`absolute inset-x-0 bottom-0 bg-white rounded-t-[28px] shadow-[0_-12px_32px_rgba(0,0,0,0.16)] flex flex-col animate-in slide-in-from-bottom-8 duration-300 ${
              activeSheet === 'time' ? 'h-[42dvh]' : activeSheet === 'type' ? 'h-[54dvh]' : 'h-[84dvh]'
            }`}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <h3 className="text-[20px] font-bold text-[#1F1F1F] leading-tight">
                {activeSheet === 'time' ? t('search_filter_time_slot') : activeSheet === 'type' ? t('search_filter_experience_type') : t('filter')}
              </h3>
              <button onClick={() => setActiveSheet(null)} className="p-1 text-[#444]" aria-label={t('button_close')}>
                <X size={20} />
              </button>
            </div>

            <div className="px-6 overflow-y-auto">
              {activeSheet === 'time' && (
                <div className="pt-1 space-y-3">
                  {([{id:'morning' as SearchTimeId,lk:'search_time_morning',dk:'search_time_morning_desc'},{id:'afternoon' as SearchTimeId,lk:'search_time_afternoon',dk:'search_time_afternoon_desc'},{id:'evening' as SearchTimeId,lk:'search_time_evening',dk:'search_time_evening_desc'}]).map((option) => (
                    <button key={option.id} onClick={() => toggleTime(option.id)} className="w-full flex items-center justify-between text-left">
                      <div>
                        <p className="text-[15px] font-semibold text-[#222] leading-tight">{t(option.lk)}</p>
                        <p className="mt-1 text-[11px] text-[#8A8A8A] leading-tight">{t(option.dk)}</p>
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
                    const labelKey = `search_type_${option.id === 'cafe_dessert' ? 'cafe' : option.id === 'walking_healing' ? 'walking' : option.id}`;
                    return (
                      <button
                        key={option.id}
                        onClick={() => toggleType(option.id)}
                        className={`h-9 px-3 rounded-full border flex items-center gap-1.5 text-[12px] font-medium transition-all duration-150 active:scale-[0.95] ${
                          selected ? 'border-[#222] bg-[#F8F8F8] text-[#222]' : 'border-[#D8D8D8] text-[#454545]'
                        }`}
                      >
                        <Icon size={13} strokeWidth={1.8} />
                        {t(labelKey)}
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
                      const labelKey = `search_type_${option.id === 'cafe_dessert' ? 'cafe' : option.id === 'walking_healing' ? 'walking' : option.id}`;
                      return (
                        <button
                          key={option.id}
                          onClick={() => toggleType(option.id)}
                          className={`h-9 px-3 rounded-full border flex items-center gap-1.5 text-[12px] font-medium transition-all duration-150 active:scale-[0.95] ${
                            selected ? 'border-[#222] bg-[#F8F8F8] text-[#222]' : 'border-[#D8D8D8] text-[#454545]'
                          }`}
                        >
                          <Icon size={13} strokeWidth={1.8} />
                          {t(labelKey)}
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t border-[#ECECEC] my-1" />

                  <h4 className="text-[15px] font-semibold text-[#1F1F1F] mt-5 mb-3">{t('search_filter_time_slot')}</h4>
                  <div className="flex flex-wrap gap-3 pb-2">
                    {([{id:'morning' as SearchTimeId,lk:'search_time_morning'},{id:'afternoon' as SearchTimeId,lk:'search_time_afternoon'},{id:'evening' as SearchTimeId,lk:'search_time_evening'}]).map((option) => {
                      const selected = selectedTimes.includes(option.id);
                      return (
                        <button
                          key={`filter-${option.id}`}
                          onClick={() => toggleTime(option.id)}
                          className={`h-9 px-4 rounded-full border text-[12px] font-medium transition-all duration-150 active:scale-[0.95] ${
                            selected ? 'border-[#222] bg-[#F8F8F8] text-[#222]' : 'border-[#D8D8D8] text-[#454545]'
                          }`}
                        >
                          {t(option.lk)}
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
                onClick={() => setActiveSheet(null)}
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
