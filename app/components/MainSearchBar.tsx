'use client';

import React, { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';
import {
  getLocalizedSearchLocationLabel,
  matchSearchPreset,
  RECOMMENDED_SEARCH_PRESETS,
} from '@/app/utils/searchLocationCatalog';
import DatePicker from './DatePicker';

const PlaceIcon = ({ type }: { type: string }) => {
  const colors: Record<string, string> = {
    tokyo: '#EE7B7B', osaka: '#F2A15A', seoul: '#7CB0ED', izakaya: '#D5AE3D',
  };
  const stroke = colors[type] || '#6B7280';
  const sw = 1.0;
  const blurId = `icon-soft-desktop-${type}`;
  const paths = () => {
    if (type === 'tokyo') return (<>
      <path d="M13 3V6.2" stroke={stroke} strokeWidth={sw} />
      <path d="M11.1 6.2H14.9" stroke={stroke} strokeWidth={sw} />
      <path d="M10.8 6.2L9.7 10.5H16.3L15.2 6.2" stroke={stroke} strokeWidth={sw} />
      <path d="M8.7 12H17.3" stroke={stroke} strokeWidth={sw} />
      <path d="M9.4 12V15.4" stroke={stroke} strokeWidth={sw} />
      <path d="M16.6 12V15.4" stroke={stroke} strokeWidth={sw} />
      <path d="M7.5 17.3H18.5" stroke={stroke} strokeWidth={sw} />
      <path d="M6.2 22H19.8" stroke={stroke} strokeWidth={sw} />
      <path d="M7.5 22L10.8 17.3" stroke={stroke} strokeWidth={sw} />
      <path d="M18.5 22L15.2 17.3" stroke={stroke} strokeWidth={sw} />
      <path d="M10.8 15.4H15.2" stroke={stroke} strokeWidth={sw} />
    </>);
    if (type === 'osaka') return (<>
      <path d="M4.5 7.8C9.2 9.2 16.8 9.2 21.5 7.8" stroke={stroke} strokeWidth={sw} />
      <path d="M5.4 10.2H20.6" stroke={stroke} strokeWidth={sw} />
      <path d="M7.2 10.2V21.5" stroke={stroke} strokeWidth={sw} />
      <path d="M18.8 10.2V21.5" stroke={stroke} strokeWidth={sw} />
      <path d="M9.8 12.6H16.2" stroke={stroke} strokeWidth={sw} />
      <path d="M8.5 15.8H17.5" stroke={stroke} strokeWidth={sw} />
      <path d="M6.2 21.5H9.4" stroke={stroke} strokeWidth={sw} />
      <path d="M16.6 21.5H19.8" stroke={stroke} strokeWidth={sw} />
    </>);
    if (type === 'seoul') return (<>
      <path d="M13 2.8V6.1" stroke={stroke} strokeWidth={sw} />
      <path d="M11.9 6.1H14.1" stroke={stroke} strokeWidth={sw} />
      <path d="M11.3 6.1V9.2H14.7V6.1" stroke={stroke} strokeWidth={sw} />
      <rect x="9.6" y="9.9" width="6.8" height="3.9" rx="0.8" stroke={stroke} strokeWidth={sw} />
      <path d="M13 13.8V20.1" stroke={stroke} strokeWidth={sw} />
      <path d="M10.3 16.6H15.7" stroke={stroke} strokeWidth={sw} />
      <path d="M9.8 20.1H16.2" stroke={stroke} strokeWidth={sw} />
      <path d="M7.7 22H18.3" stroke={stroke} strokeWidth={sw} />
    </>);
    if (type === 'izakaya') return (<>
      <rect x="8" y="6.2" width="8.8" height="13.5" rx="2.2" stroke={stroke} strokeWidth={sw} />
      <path d="M16.8 9.2H18.6C19.7 9.2 20.5 10 20.5 11.1V15.4C20.5 16.5 19.7 17.3 18.6 17.3H16.8" stroke={stroke} strokeWidth={sw} />
      <path d="M10.4 10V16.8" stroke={stroke} strokeWidth={sw} />
      <path d="M12.4 10V16.8" stroke={stroke} strokeWidth={sw} />
      <path d="M14.4 10V16.8" stroke={stroke} strokeWidth={sw} />
      <path d="M9 5.3C9.6 4.3 10.8 4.3 11.4 5.3C12 6.3 13.2 6.3 13.8 5.3C14.4 4.3 15.6 4.3 16.2 5.3" stroke={stroke} strokeWidth={sw} />
    </>);
    return (<>
      <path d="M13 22C13 22 19 15.9 19 11.5C19 8.2 16.3 5.5 13 5.5C9.7 5.5 7 8.2 7 11.5C7 15.9 13 22 13 22Z" stroke={stroke} strokeWidth={sw} />
      <circle cx="13" cy="11.5" r="2.2" stroke={stroke} strokeWidth={sw} />
    </>);
  };
  return (
    <svg width="24" height="24" viewBox="0 0 26 26" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <filter id={blurId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="0.4" />
        </filter>
      </defs>
      <g opacity="0.2" filter={`url(#${blurId})`} transform="translate(0 0.5)">{paths()}</g>
      <g>{paths()}</g>
    </svg>
  );
};

const PlaceBadge = ({ type }: { type: string }) => {
  const styles: Record<string, { bg: string; border: string }> = {
    tokyo:   { bg: 'linear-gradient(135deg, #FDF0F0 0%, #FFF8F8 100%)', border: '#F3DFDF' },
    osaka:   { bg: 'linear-gradient(135deg, #FEF3E8 0%, #FFF9F2 100%)', border: '#F4E3D1' },
    seoul:   { bg: 'linear-gradient(135deg, #EEF5FD 0%, #F7FBFF 100%)', border: '#DBE8F6' },
    izakaya: { bg: 'linear-gradient(135deg, #FCF7E7 0%, #FFFBEF 100%)', border: '#EEE4C4' },
    custom:  { bg: 'linear-gradient(135deg, #F1F4F8 0%, #FBFCFE 100%)', border: '#DEE5EE' },
  };
  const style = styles[type] || styles.custom;
  return (
    <div
      className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center shrink-0"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), 0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      <div style={{ filter: 'contrast(104%) saturate(98%)' }}>
        <PlaceIcon type={type} />
      </div>
    </div>
  );
};

interface MainSearchBarProps {
  activeSearchField: 'location' | 'date' | 'language' | null;
  setActiveSearchField: (field: 'location' | 'date' | 'language' | null) => void;
  locationInput: string;
  setLocationInput: (val: string) => void;
  dateRange: { start: Date | null, end: Date | null };
  setDateRange: (range: { start: Date | null; end: Date | null }) => void;
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
  onCategorySelect?: (id: string) => void;
  isVisible: boolean;
  onSearch: (locationOverride?: string) => void;
}

export default function MainSearchBar({
  activeSearchField, setActiveSearchField,
  locationInput, setLocationInput,
  dateRange, setDateRange,
  selectedLanguage, setSelectedLanguage,
  onCategorySelect, isVisible,
  onSearch
}: MainSearchBarProps) {
  const { t, lang } = useLanguage();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeSearchField) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setActiveSearchField(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveSearchField(null);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeSearchField, setActiveSearchField]);

  const formatDateRange = () => {
    if (dateRange.start && dateRange.end) {
      return `${dateRange.start.getMonth() + 1}월 ${dateRange.start.getDate()}일 - ${dateRange.end.getMonth() + 1}월 ${dateRange.end.getDate()}일`;
    }
    if (dateRange.start) return `${dateRange.start.getMonth() + 1}월 ${dateRange.start.getDate()}일`;
    return '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch();
      setActiveSearchField(null);
    }
  };

  const languages = [
    { label: t('lang_all'), value: 'all', icon: '🌐' },
    { label: t('lang_ko'), value: '한국어', code: 'kr' },
    { label: t('lang_en'), value: '영어', code: 'us' },
    { label: t('lang_ja'), value: '일본어', code: 'jp' },
    { label: t('lang_zh'), value: '중국어', code: 'cn' },
  ];
  const recommendedPlaces = RECOMMENDED_SEARCH_PRESETS.map((preset) => ({
    ...preset,
    name: t(preset.labelKey),
    desc: t(preset.descKey),
  }));
  const displayLocationInput =
    locationInput && matchSearchPreset(locationInput, lang, t)
      ? getLocalizedSearchLocationLabel(locationInput, lang, t)
      : locationInput;

  return (
    <div
      ref={rootRef}
      className={`relative w-full max-w-[850px] h-[66px] transition-all duration-300 ease-in-out ${isVisible ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' : 'opacity-0 -translate-y-4 scale-95 pointer-events-none'}`}
    >
      <div className={`absolute inset-0 flex items-center bg-white border ${activeSearchField ? 'border-transparent bg-slate-100/50' : 'border-slate-200'} rounded-full shadow-[var(--shadow-card)] transition-all duration-500`}>

        {/* 1. 여행지 입력 */}
        <div
          data-testid="home-desktop-search-location-field"
          className={`flex-1 relative h-full flex flex-col justify-center px-8 rounded-full cursor-pointer transition-all duration-300 z-10 group
            ${activeSearchField === 'location' ? 'bg-white shadow-[var(--shadow-floating)]' : 'hover:bg-slate-100/80'}`}
          onClick={() => setActiveSearchField('location')}
        >
          <label className="text-[11px] font-bold text-slate-800">{t('label_destination')}</label>
          <input
            type="text"
            placeholder={t('search_placeholder')}
            value={displayLocationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full text-sm outline-none bg-transparent placeholder:text-slate-500 text-black font-semibold truncate cursor-pointer"
          />
          <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-[1px] h-8 bg-slate-200 transition-opacity 
            ${activeSearchField === 'location' || activeSearchField === 'date' ? 'opacity-0' : 'group-hover:opacity-0'}`}></div>
        </div>

        {/* 2. 날짜 입력 */}
        <div
          className={`flex-1 relative h-full flex flex-col justify-center px-6 rounded-full cursor-pointer transition-all duration-300 z-10 group
            ${activeSearchField === 'date' ? 'bg-white shadow-[var(--shadow-floating)]' : 'hover:bg-slate-100/80'}`}
          onClick={() => setActiveSearchField('date')}
        >
          <label className="text-[11px] font-bold text-slate-800">{t('label_date')}</label> {/* 🟢 교체 */}
          <input
            type="text"
            placeholder={t('add_dates')} // 🟢 교체
            value={formatDateRange()}
            readOnly
            className="w-full text-sm outline-none bg-transparent placeholder:text-slate-500 text-black font-semibold truncate cursor-pointer"
          />
          <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-[1px] h-8 bg-slate-200 transition-opacity 
            ${activeSearchField === 'date' || activeSearchField === 'language' ? 'opacity-0' : 'group-hover:opacity-0'}`}></div>
        </div>

        {/* 3. 언어 선택 */}
        <div
          className={`flex-1 relative h-full flex flex-col justify-center px-6 rounded-full cursor-pointer transition-all duration-300 z-10 group
            ${activeSearchField === 'language' ? 'bg-white shadow-[var(--shadow-floating)]' : 'hover:bg-slate-100/80'}`}
          onClick={() => setActiveSearchField('language')}
        >
          <label className="text-[11px] font-bold text-slate-800">{t('label_progress_language')}</label>
          <div className="flex justify-between items-center w-full">
            <input
              type="text"
              placeholder={t('add_language')}
              // 🟢 선택된 언어에 따라 번역된 라벨 보여주기
              value={
                selectedLanguage === 'all' ? t('lang_all') :
                  languages.find(l => l.value === selectedLanguage)?.label || selectedLanguage
              }
              readOnly
              className="w-full text-sm outline-none bg-transparent placeholder:text-slate-500 text-black font-semibold truncate cursor-pointer"
            />
          </div>
        </div>

        {/* 4. 검색 버튼 */}
        <div className="pl-2 pr-2 h-full flex items-center justify-end rounded-full z-10">
          <button
            data-testid="home-desktop-search-submit"
            onClick={(e) => {
              e.stopPropagation();
              onSearch();
              setActiveSearchField(null);
            }}
            className="w-12 h-12 bg-slate-900 hover:bg-slate-800 rounded-full flex items-center justify-center text-white transition-transform active:scale-95 shadow-md"
          >
            <Search size={20} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* 여행지 선택 팝업 */}
      {activeSearchField === 'location' && (
        <div
          data-testid="home-desktop-location-popover"
          className="absolute top-[80px] left-0 w-[360px] bg-white p-5 z-50 animate-in fade-in slide-in-from-left-2 duration-200 ease-out"
          style={{
            borderRadius: '22px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.05), 0 8px 18px rgba(0,0,0,0.06)',
            border: '0.5px solid #E6E6E6',
          }}
        >
          <h4 className="text-[15px] font-extrabold text-[#222222] mb-4">{t('label_destination')}</h4>
          <div className="space-y-0.5">
            {recommendedPlaces.map((place) => (
              <button
                key={place.id}
                data-testid={`home-desktop-location-option-${place.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setLocationInput(place.queryValue);
                  setActiveSearchField(null);
                  onSearch(place.queryValue);
                }}
                className="flex items-center gap-3 w-full py-2.5 px-2 rounded-xl hover:bg-[#F7F7F7] transition-colors text-left"
              >
                <PlaceBadge type={place.id} />
                <div>
                  <p className="text-[13px] font-semibold text-[#222222] leading-tight">{place.name}</p>
                  <p className="text-[11px] text-[#8B8B8B] mt-0.5">{place.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 날짜 팝업 */}
      {activeSearchField === 'date' && (
        <div className="absolute top-[80px] left-1/2 -translate-x-1/2 w-[360px] bg-white rounded-[32px] shadow-[0_8px_28px_rgba(0,0,0,0.12)] p-6 z-50 animate-in fade-in duration-200 ease-out">
          <DatePicker selectedRange={dateRange} onChange={(range) => { setDateRange(range); }} />
        </div>
      )}

      {/* 언어 팝업 */}
      {activeSearchField === 'language' && (
        <div className="absolute top-[80px] right-0 w-[240px] bg-white rounded-[32px] shadow-[0_8px_28px_rgba(0,0,0,0.12)] p-6 z-50 animate-in fade-in slide-in-from-right-2 duration-200 ease-out">
          <h4 className="text-xs font-bold text-slate-500 mb-3 px-2">{t('mobile_language_select')}</h4>
          <div className="grid grid-cols-1 gap-1">
            {languages.map((lang) => (
              <button
                key={lang.label}
                onClick={(e) => {
                  e.stopPropagation();
                  // 🟢 값은 내부 코드(all)나 한국어로 저장하고, 보여주는 건 렌더링 때 처리
                  setSelectedLanguage(lang.value || lang.label);
                  setActiveSearchField(null);
                }}
                className={`flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors text-left w-full
                  ${selectedLanguage === lang.value ? 'bg-slate-100 ring-1 ring-slate-200' : ''}`}
              >
                <div className="w-8 h-6 flex items-center justify-center overflow-hidden rounded shadow-sm border border-slate-100 bg-white">
                  {lang.icon ? (
                    <span className="text-lg">{lang.icon}</span>
                  ) : (
                    <img
                      src={`https://flagcdn.com/w40/${lang.code}.png`}
                      alt={lang.label}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <span className="text-sm font-bold text-slate-700">{lang.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
