'use client';

import React from 'react';
import { Search, MapPin, Globe } from 'lucide-react';
import { CATEGORIES } from '@/app/constants';
import DatePicker from './DatePicker';

interface MainSearchBarProps {
  activeSearchField: 'location' | 'date' | 'language' | null;
  setActiveSearchField: (field: 'location' | 'date' | 'language' | null) => void;
  locationInput: string;
  setLocationInput: (val: string) => void;
  dateRange: { start: Date | null, end: Date | null };
  setDateRange: (range: any) => void;
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
  onCategorySelect: (id: string) => void;
  isVisible: boolean;
  onSearch: () => void;
}

export default function MainSearchBar({
  activeSearchField, setActiveSearchField,
  locationInput, setLocationInput,
  dateRange, setDateRange,
  selectedLanguage, setSelectedLanguage,
  onCategorySelect, isVisible,
  onSearch
}: MainSearchBarProps) {

  const formatDateRange = () => {
    if (dateRange.start && dateRange.end) {
      return `${dateRange.start.getMonth()+1}월 ${dateRange.start.getDate()}일 - ${dateRange.end.getMonth()+1}월 ${dateRange.end.getDate()}일`;
    }
    if (dateRange.start) return `${dateRange.start.getMonth()+1}월 ${dateRange.start.getDate()}일`;
    return '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch();
      setActiveSearchField(null);
    }
  };

  const languages = ['전체', '한국어', '영어', '일본어', '중국어'];

  return (
    // ✨ 수정 1: 전체 너비를 850px로 줄여서 더 단단한 느낌을 줌
    <div 
      className={`relative w-full max-w-[850px] h-[66px] transition-all duration-300 ease-in-out ${isVisible ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' : 'opacity-0 -translate-y-4 scale-95 pointer-events-none'}`}
    >
      <div className={`absolute inset-0 flex items-center bg-white border ${activeSearchField ? 'border-transparent bg-slate-100' : 'border-slate-200'} rounded-full shadow-[0_6px_16px_rgba(0,0,0,0.08)] transition-all`}>
        
        {/* 1. 여행지 입력 (비율 1.3) */}
        <div 
          className={`flex-[1.3] relative h-full flex flex-col justify-center px-8 rounded-full cursor-pointer transition-all z-10 group
            ${activeSearchField === 'location' ? 'bg-white shadow-lg' : 'hover:bg-slate-100'}`} 
          onClick={() => setActiveSearchField('location')}
        >
          <label className="text-[11px] font-bold text-slate-800">여행지</label>
          <input 
            type="text" 
            placeholder="여행지 검색" 
            value={locationInput} 
            onChange={(e) => setLocationInput(e.target.value)} 
            onKeyDown={handleKeyDown} 
            className="w-full text-sm outline-none bg-transparent placeholder:text-slate-500 text-black font-semibold truncate cursor-pointer" 
          />
          
          {/* 구분선 (오른쪽) - 호버되거나 활성화되면 숨김 */}
          <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-[1px] h-8 bg-slate-200 transition-opacity 
            ${activeSearchField === 'location' || activeSearchField === 'date' ? 'opacity-0' : 'group-hover:opacity-0'}`}></div>
        </div>
        
        {/* 2. 날짜 입력 (비율 1) */}
        <div 
          className={`flex-1 relative h-full flex flex-col justify-center px-6 rounded-full cursor-pointer transition-all z-10 group
            ${activeSearchField === 'date' ? 'bg-white shadow-lg' : 'hover:bg-slate-100'}`} 
          onClick={() => setActiveSearchField('date')}
        >
          <label className="text-[11px] font-bold text-slate-800">날짜</label>
          <input 
            type="text" 
            placeholder="날짜 선택" 
            value={formatDateRange()} 
            readOnly 
            className="w-full text-sm outline-none bg-transparent placeholder:text-slate-500 text-black font-semibold truncate cursor-pointer"
          />

          {/* 구분선 (오른쪽) */}
          <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-[1px] h-8 bg-slate-200 transition-opacity 
            ${activeSearchField === 'date' || activeSearchField === 'language' ? 'opacity-0' : 'group-hover:opacity-0'}`}></div>
        </div>

        {/* 3. 언어 선택 (비율 0.8 - 내용이 짧으므로) */}
        <div 
          className={`flex-[0.8] relative h-full flex flex-col justify-center px-6 rounded-full cursor-pointer transition-all z-10 group
            ${activeSearchField === 'language' ? 'bg-white shadow-lg' : 'hover:bg-slate-100'}`} 
          onClick={() => setActiveSearchField('language')}
        >
          <label className="text-[11px] font-bold text-slate-800">언어</label>
          <div className="flex justify-between items-center w-full">
            <input 
              type="text" 
              placeholder="언어 추가" 
              value={selectedLanguage === 'all' ? '' : selectedLanguage} 
              readOnly 
              className="w-full text-sm outline-none bg-transparent placeholder:text-slate-500 text-black font-semibold truncate cursor-pointer"
            />
          </div>
        </div>
        
        {/* 4. 검색 버튼 (아이콘만 깔끔하게) */}
        <div className="pl-2 pr-2 h-full flex items-center justify-end rounded-full z-10">
          <button 
            onClick={onSearch} 
            className="w-12 h-12 bg-[#FF385C] hover:bg-[#E00B41] rounded-full flex items-center justify-center text-white transition-transform active:scale-95 shadow-md"
          >
            <Search size={20} strokeWidth={2.5}/>
          </button>
        </div>
      </div>

      {/* 🟢 팝업: 지역 선택 */}
      {activeSearchField === 'location' && (
        <div className="absolute top-[80px] left-0 w-[360px] bg-white rounded-[32px] shadow-[0_8px_28px_rgba(0,0,0,0.12)] p-6 z-50 animate-in fade-in slide-in-from-top-5 duration-300 ease-out">
          <h4 className="text-xs font-bold text-slate-500 mb-3 px-2">지역으로 검색하기</h4>
          <div className="grid grid-cols-1 gap-1">
            {CATEGORIES.filter(c => c.id !== 'all').map((city) => (
              <button key={city.id} onClick={() => { setLocationInput(city.label); setActiveSearchField('date'); onCategorySelect(city.id); }} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors text-left group">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-sm transition-all"><MapPin size={20} /></div>
                <span className="font-bold text-slate-700">{city.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 🟢 팝업: 날짜 선택 */}
      {activeSearchField === 'date' && (
        <div className="absolute top-[80px] left-[20%] w-[360px] bg-white rounded-[32px] shadow-[0_8px_28px_rgba(0,0,0,0.12)] p-6 z-50 animate-in fade-in slide-in-from-top-5 duration-300 ease-out">
          <DatePicker selectedRange={dateRange} onChange={(range) => { setDateRange(range); if (range.start && range.end) setActiveSearchField('language'); }} />
        </div>
      )}

      {/* 🟢 팝업: 언어 선택 */}
      {activeSearchField === 'language' && (
        <div className="absolute top-[80px] right-0 w-[200px] bg-white rounded-[32px] shadow-[0_8px_28px_rgba(0,0,0,0.12)] p-6 z-50 animate-in fade-in slide-in-from-top-5 duration-300 ease-out">
          <h4 className="text-xs font-bold text-slate-500 mb-3 px-2">언어 선택</h4>
          <div className="grid grid-cols-1 gap-1">
            {languages.map((lang) => (
              <button 
                key={lang} 
                onClick={() => { setSelectedLanguage(lang === '전체' ? 'all' : lang); setActiveSearchField(null); }} 
                className={`flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors text-left ${selectedLanguage === lang || (selectedLanguage === 'all' && lang === '전체') ? 'bg-slate-100 font-bold' : ''}`}
              >
                <Globe size={18} className="text-slate-400"/>
                <span className="text-sm text-slate-700">{lang}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}