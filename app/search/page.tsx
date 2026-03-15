'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
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

interface SearchExperience {
  id: string;
  title?: string;
  category?: string;
  city?: string;
  country?: string;
  languages?: string[];
  image_url?: string;
  photos?: string[];
  rating?: number;
  price?: number | string;
  [key: string]: unknown;
}

const SEARCH_EXPERIENCE_SELECT = [
  'id',
  'title',
  'description',
  'city',
  'country',
  'category',
  'title_ko',
  'description_ko',
  'title_en',
  'description_en',
  'category_en',
  'title_ja',
  'description_ja',
  'category_ja',
  'title_zh',
  'description_zh',
  'category_zh',
  'languages',
  'image_url',
  'photos',
  'rating',
  'review_count',
  'price',
  'location',
].join(', ');

const TIME_OPTIONS = [
  { id: 'morning', label: '오전', desc: '낮 12시 이전' },
  { id: 'afternoon', label: '오후', desc: '오후 12시~오후 5시' },
  { id: 'evening', label: '저녁', desc: '오후 5시 이후' },
] as const;

const TIME_KEYWORDS: Record<string, string[]> = {
  morning: ['오전', '아침', 'morning', 'am'],
  afternoon: ['오후', '낮', 'afternoon', 'pm'],
  evening: ['저녁', '밤', '야간', 'evening', 'night'],
};

const TYPE_OPTIONS = [
  { id: 'food_tour', label: '맛집 탐방', icon: Utensils, keywords: ['맛집 탐방', '맛집', '음식', 'food'] },
  { id: 'cafe_dessert', label: '카페/디저트', icon: Coffee, keywords: ['카페/디저트', '카페', '디저트', 'cafe', 'dessert'] },
  { id: 'walking_healing', label: '산책/힐링', icon: TreePine, keywords: ['산책/힐링', '산책', '힐링', 'walk', 'healing'] },
  { id: 'shopping', label: '쇼핑', icon: ShoppingBag, keywords: ['쇼핑', 'shopping'] },
  { id: 'culture', label: '문화 체험', icon: Landmark, keywords: ['문화 체험', '문화', 'culture'] },
  { id: 'activity', label: '액티비티', icon: Dumbbell, keywords: ['액티비티', 'activity'] },
  { id: 'nightlife', label: '나이트라이프', icon: MoonStar, keywords: ['나이트라이프', 'nightlife'] },
  { id: 'architecture', label: '건축', icon: Building2, keywords: ['건축', 'architecture'] },
  { id: 'show_sports', label: '공연/경기', icon: Ticket, keywords: ['공연/경기', '공연', '경기', 'show', 'sports'] },
  { id: 'landmark', label: '랜드마크', icon: Flag, keywords: ['랜드마크', '명소', 'landmark'] },
  { id: 'one_day_class', label: '원데이 클래스', icon: Palette, keywords: ['원데이 클래스', '클래스', 'class'] },
] as const;

function formatShortDate(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function normalizeSearchInput(value: string) {
  return value
    .replace(/[(),'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokenizeSearchInput(value: string) {
  const normalized = normalizeSearchInput(value);
  return normalized ? normalized.split(' ').filter(Boolean) : [];
}

function asString(value: unknown) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function arrayToText(value: unknown) {
  if (!Array.isArray(value)) return '';
  return value
    .map((entry) => {
      if (typeof entry === 'string' || typeof entry === 'number') return String(entry);
      if (entry && typeof entry === 'object') {
        const record = entry as Record<string, unknown>;
        return [record.time, record.start, record.label, record.name].map(asString).join(' ');
      }
      return '';
    })
    .join(' ');
}

function buildSearchHaystack(item: SearchExperience) {
  const record = item as Record<string, unknown>;
  return [
    item.title,
    item.description,
    item.city,
    item.country,
    item.category,
    record.title_ko,
    record.description_ko,
    record.title_en,
    record.description_en,
    record.category_en,
    record.title_ja,
    record.description_ja,
    record.category_ja,
    record.title_zh,
    record.description_zh,
    record.category_zh,
    arrayToText(record.tags),
  ]
    .map(asString)
    .join(' ')
    .toLowerCase();
}

function parseSearchDate(iso: string | null) {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getExperienceDates(item: SearchExperience) {
  const record = item as Record<string, unknown>;
  const candidates = [record.available_dates, record.availableDates];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.map((value) => asString(value)).filter(Boolean);
    }
  }
  return [];
}

function matchesDateRange(item: SearchExperience, startDate: string | null, endDate: string | null) {
  const start = parseSearchDate(startDate);
  if (!start) return true;

  const end = parseSearchDate(endDate) || start;
  const startBoundary = new Date(start);
  const endBoundary = new Date(end);
  startBoundary.setHours(0, 0, 0, 0);
  endBoundary.setHours(23, 59, 59, 999);

  const availableDates = getExperienceDates(item);
  if (availableDates.length === 0) return false;

  return availableDates.some((dateValue) => {
    const timestamp = new Date(dateValue).getTime();
    return Number.isFinite(timestamp) && timestamp >= startBoundary.getTime() && timestamp <= endBoundary.getTime();
  });
}

function getTimeHaystack(item: SearchExperience) {
  const record = item as Record<string, unknown>;
  return [
    record.start_time,
    record.startTime,
    record.time_slot,
    record.timeSlot,
    record.time_of_day,
    record.timeOfDay,
    record.session,
    record.schedule_text,
    record.scheduleText,
    arrayToText(record.available_times),
    arrayToText(record.availableTimes),
    arrayToText(record.time_slots),
    arrayToText(record.timeSlots),
    arrayToText(record.schedules),
  ]
    .map(asString)
    .join(' ')
    .toLowerCase();
}

function matchesTimeSelection(item: SearchExperience, selectedTimes: string[]) {
  if (selectedTimes.length === 0) return true;
  const haystack = getTimeHaystack(item);
  if (!haystack) return true;

  return selectedTimes.some((timeId) => (TIME_KEYWORDS[timeId] || []).some((keyword) => haystack.includes(keyword)));
}

function SearchResults() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const { lang, t } = useLanguage();

  const [experiences, setExperiences] = useState<SearchExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(true);
  const requestSeqRef = useRef(0);

  const [activeSheet, setActiveSheet] = useState<'type' | 'time' | 'filter' | null>(null);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const location = searchParams.get('location') || '';
  const language = searchParams.get('language') || 'all';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  const headerTitle = location ? `${location}의 체험` : '체험 검색';
  const headerSub = [
    startDate ? formatShortDate(startDate) : '',
    endDate ? formatShortDate(endDate) : '',
    language && language !== 'all' ? language : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const searchSignature = `${location}|${language}|${startDate || ''}|${endDate || ''}`;

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
        let query = supabase
          .from('experiences')
          .select(SEARCH_EXPERIENCE_SELECT)
          .eq('status', 'active');

        if (location) {
          const searchTerms = tokenizeSearchInput(location);
          if (searchTerms.length === 0) {
            if (requestId === requestSeqRef.current) {
              setExperiences([]);
              setLoading(false);
            }
            return;
          }

          const searchFields = [
            'title',
            'description',
            'city',
            'country',
            'category',
            'title_ko',
            'description_ko',
            'title_en',
            'description_en',
            'category_en',
            'title_ja',
            'description_ja',
            'category_ja',
            'title_zh',
            'description_zh',
            'category_zh',
          ];

          const seedTerm = searchTerms[0].replace(/[%_]/g, '');
          if (seedTerm) {
            const orQuery = searchFields.map((field) => `${field}.ilike.%${seedTerm}%`).join(',');
            query = query.or(orQuery);
          }
        }

        if (language !== 'all') {
          query = query.contains('languages', [language]);
        }

        const { data, error } = await query;
        if (error) throw error;

        const searchTerms = tokenizeSearchInput(location);
        let nextData = (data ?? []) as unknown as SearchExperience[];

        if (searchTerms.length > 0) {
          nextData = nextData.filter((item) => {
            const haystack = buildSearchHaystack(item);
            return searchTerms.every((term) => haystack.includes(term));
          });
        }

        nextData = nextData.filter((item) => matchesDateRange(item, startDate, endDate));
        if (requestId === requestSeqRef.current) {
          setExperiences(nextData);
        }
      } catch (error) {
        console.error('Search error:', error);
        if (requestId === requestSeqRef.current) {
          showToast('검색 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.', 'error');
        }
      } finally {
        if (requestId === requestSeqRef.current) {
          setLoading(false);
        }
      }
    };

    fetchSearchResults();
  }, [location, language, startDate, endDate, showToast, supabase, searchSignature]);

  const filteredExperiences = useMemo(() => {
    let nextItems = experiences;

    if (selectedTypes.length > 0) {
      const selectedTypeConfig = TYPE_OPTIONS.filter((option) => selectedTypes.includes(option.id));
      nextItems = nextItems.filter((item) => {
        const haystack = `${getContent(item, 'title', lang) || ''} ${getContent(item, 'category', lang) || ''} ${item.city || ''}`.toLowerCase();
        return selectedTypeConfig.some((option) => option.keywords.some((keyword) => haystack.includes(keyword.toLowerCase())));
      });
    }

    nextItems = nextItems.filter((item) => matchesTimeSelection(item, selectedTimes));
    return nextItems;
  }, [experiences, selectedTypes, selectedTimes, lang]);

  const mobileSections = useMemo(() => {
    const cityName = location || '도쿄';
    const sectionBase = filteredExperiences;

    return [
      { id: 'izakaya', title: `${cityName} 이자카야 투어`, items: sectionBase.slice(0, 12) },
      { id: 'alley', title: `${cityName} 로컬 골목 체험`, items: [...sectionBase.slice(2), ...sectionBase].slice(0, 12) },
      { id: 'japanese', title: `${cityName} 일본어 투어`, items: [...sectionBase.slice(5), ...sectionBase].slice(0, 12) },
    ];
  }, [filteredExperiences, location]);

  const toggleTime = (id: string) => {
    setSelectedTimes((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const toggleType = (id: string) => {
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
          <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
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
            <button onClick={() => window.history.back()} className="w-9 h-9 flex items-center justify-center text-[#222]">
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
              className={`h-7 px-3.5 rounded-full border flex items-center gap-1 text-[11px] font-medium whitespace-nowrap ${
                selectedTypes.length > 0 ? 'bg-white border-[#222] text-[#222]' : 'bg-white border-[#D8D8D8] text-[#444]'
              }`}
            >
              유형
              <ChevronDown size={12} />
            </button>
            <button
              onClick={() => setActiveSheet('time')}
              className={`h-7 px-3.5 rounded-full border flex items-center gap-1 text-[11px] font-medium whitespace-nowrap ${
                selectedTimes.length > 0 ? 'bg-white border-[#222] text-[#222]' : 'bg-white border-[#D8D8D8] text-[#444]'
              }`}
            >
              시간대
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
          ) : filteredExperiences.length === 0 ? (
            <div className="min-h-[66vh] flex flex-col items-center justify-center text-center">
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
              <h3 className="text-[24px] font-bold text-[#212121] leading-tight">일치하는 결과 없음</h3>
              <p className="mt-2 text-[13px] text-[#7A7A7A] leading-snug">날짜나 위치를 변경해 다시 검색해 보세요.</p>
            </div>
          ) : (
            <div className="space-y-8 pb-6">
              {mobileSections.map((section) => (
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
            <span className="text-sm font-bold text-slate-500 whitespace-nowrap">{filteredExperiences.length}개의 체험</span>
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
            ) : filteredExperiences.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <Ghost size={48} className="text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-900 mb-2">이 조건에 맞는 체험이 없어요</h3>
                <p className="text-slate-500 text-sm">다른 날짜나 키워드로 검색해보시거나, 메인에서 전체 체험을 둘러보세요.</p>
              </div>
            ) : (
              <div className={`grid gap-6 ${showMap ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
                {filteredExperiences.map((item) => (
                  <ExperienceCard key={item.id} data={item} />
                ))}
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
          <button className="absolute inset-0 bg-black/35" onClick={() => setActiveSheet(null)} aria-label="close-overlay" />

          <div
            className={`absolute inset-x-0 bottom-0 bg-white rounded-t-[28px] shadow-[0_-12px_32px_rgba(0,0,0,0.16)] flex flex-col ${
              activeSheet === 'time' ? 'h-[42dvh]' : activeSheet === 'type' ? 'h-[54dvh]' : 'h-[84dvh]'
            }`}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <h3 className="text-[20px] font-bold text-[#1F1F1F] leading-tight">
                {activeSheet === 'time' ? '시간대' : activeSheet === 'type' ? '체험 유형' : '필터'}
              </h3>
              <button onClick={() => setActiveSheet(null)} className="p-1 text-[#444]">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 overflow-y-auto">
              {activeSheet === 'time' && (
                <div className="pt-1 space-y-3">
                  {TIME_OPTIONS.map((option) => (
                    <button key={option.id} onClick={() => toggleTime(option.id)} className="w-full flex items-center justify-between text-left">
                      <div>
                        <p className="text-[15px] font-semibold text-[#222] leading-tight">{option.label}</p>
                        <p className="mt-1 text-[11px] text-[#8A8A8A] leading-tight">{option.desc}</p>
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
                  {TYPE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const selected = selectedTypes.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        onClick={() => toggleType(option.id)}
                        className={`h-9 px-3 rounded-full border flex items-center gap-1.5 text-[12px] font-medium ${
                          selected ? 'border-[#222] bg-[#F8F8F8] text-[#222]' : 'border-[#D8D8D8] text-[#454545]'
                        }`}
                      >
                        <Icon size={13} strokeWidth={1.8} />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {activeSheet === 'filter' && (
                <div className="pt-1 pb-4">
                  <h4 className="text-[15px] font-semibold text-[#1F1F1F] mb-3">체험 유형</h4>
                  <div className="flex flex-wrap gap-3 pb-5">
                    {TYPE_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const selected = selectedTypes.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          onClick={() => toggleType(option.id)}
                          className={`h-9 px-3 rounded-full border flex items-center gap-1.5 text-[12px] font-medium ${
                            selected ? 'border-[#222] bg-[#F8F8F8] text-[#222]' : 'border-[#D8D8D8] text-[#454545]'
                          }`}
                        >
                          <Icon size={13} strokeWidth={1.8} />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t border-[#ECECEC] my-1" />

                  <h4 className="text-[15px] font-semibold text-[#1F1F1F] mt-5 mb-3">시간대</h4>
                  <div className="flex flex-wrap gap-3 pb-2">
                    {TIME_OPTIONS.map((option) => {
                      const selected = selectedTimes.includes(option.id);
                      return (
                        <button
                          key={`filter-${option.id}`}
                          onClick={() => toggleTime(option.id)}
                          className={`h-9 px-4 rounded-full border text-[12px] font-medium ${
                            selected ? 'border-[#222] bg-[#F8F8F8] text-[#222]' : 'border-[#D8D8D8] text-[#454545]'
                          }`}
                        >
                          {option.label}
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
                전체 해제
              </button>
              <button
                onClick={() => setActiveSheet(null)}
                className="h-[44px] px-6 rounded-[10px] bg-[#222429] text-white text-[14px] font-semibold"
              >
                결과 보기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="hidden md:block">
        <SiteHeader />
      </div>
      <Suspense fallback={<div className="pt-32 text-center">검색 중...</div>}>
        <SearchResults />
      </Suspense>
    </div>
  );
}
