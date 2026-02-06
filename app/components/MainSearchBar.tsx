'use client';

import React from 'react';
import { Search, MapPin, Globe } from 'lucide-react';
import { CATEGORIES } from '@/app/constants';
import DatePicker from './DatePicker';

interface MainSearchBarProps {
  activeSearchField: 'location' | 'date' | 'language' | null; // 'language' 추가
  setActiveSearchField: (field: 'location' | 'date' | 'language' | null) => void;
  locationInput: string;
  setLocationInput: (val: string) => void;
  dateRange: { start: Date | null, end: Date | null };
  setDateRange: (range: any) => void;
  selectedLanguage: string; // [신규] 선택된 언어
  setSelectedLanguage: (lang: string) => void; // [신규] 언어 변경 함수
  onCategorySelect: (id: string) => void;
  isVisible: boolean;
  onSearch: () => void;
}

export default function MainSearchBar({
  activeSearchField, setActiveSearchField,
  locationInput, setLocationInput,
  dateRange, setDateRange,
  selectedLanguage, setSelectedLanguage, // [신규] Props
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
    <div 
      className={`relative w-full max-w-4xl h-[66px] transition-all duration-300 ease-in-out ${isVisible ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' : 'opacity-0 -translate-y-4 scale-95 pointer-events-none'}`}
    >
      <div className={`absolute inset-0 flex items-center bg-white border ${activeSearchField ? 'border-transparent bg-slate-100' : 'border-slate-200'} rounded-full shadow-[0_6px_16px_rgba(0,0,0,0.08)] transition-all`}>
        
        {/* 여행지 입력 */}
        <div 
          className={`flex-[1.5] px-6 h-full flex flex-col justify-center rounded-full cursor-pointer transition-colors relative z-10 ${activeSearchField === 'location' ? 'bg-white shadow-lg' : 'hover:bg-slate-100'}`} 
          onClick={() => setActiveSearchField('location')}
        >
          <label className="text-[11px] font-bold text-slate-800">여행지 / 검색</label>
          <input 
            type="text" 
            placeholder="어디로 떠나시나요?" 
            value={locationInput} 
            onChange={(e) => setLocationInput(e.target.value)} 
            onKeyDown={handleKeyDown} 
            className="w-full text-sm outline-none bg-transparent placeholder:text-slate-500 text-black font-semibold truncate cursor-text" 
          />
        </div>
        
        {/* 날짜 입력 */}
        <div 
          className={`flex-[1] px-6 h-full flex flex-col justify-center rounded-full cursor-pointer transition-colors relative z-10 ${activeSearchField === 'date' ? 'bg-white shadow-lg' : 'hover:bg-slate-100'}`} 
          onClick={() => setActiveSearchField('date')}
        >
          <label className="text-[11px] font-bold text-slate-800">날짜</label>
          <input type="text" placeholder="날짜 선택" value={formatDateRange()} readOnly className="w-full text-sm outline-none bg-transparent placeholder:text-slate-500 text-black font-semibold truncate cursor-pointer"/>
        </div>

        {/* ✅ [신규] 언어 선택 */}
        <div 
          className={`flex-[1] px-6 h-full flex flex-col justify-center rounded-full cursor-pointer transition-colors relative z-10 ${activeSearchField === 'language' ? 'bg-white shadow-lg' : 'hover:bg-slate-100'}`} 
          onClick={() => setActiveSearchField('language')}
        >
          <label className="text-[11px] font-bold text-slate-800">진행 언어</label>
          <div className="w-full text-sm font-semibold truncate text-black flex items-center gap-1">
             {selectedLanguage === 'all' ? <span className="text-slate-500">언어 선택</span> : selectedLanguage}
          </div>
        </div>
        
        {/* 검색 버튼 */}
        <div className="pl-4 pr-2 h-full flex items-center justify-end rounded-full z-10">
          <button 
            onClick={onSearch} 
            className="w-12 h-12 bg-[#FF385C] hover:bg-[#E00B41] rounded-full flex items-center justify-center text-white transition-transform active:scale-95 shadow-md"
          >
            <Search size={22} strokeWidth={2.5}/>
          </button>
        </div>
      </div>

      {/* 팝업: 지역 선택 */}
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

      {/* 팝업: 날짜 선택 */}
      {activeSearchField === 'date' && (
        <div className="absolute top-[80px] left-1/3 w-[360px] bg-white rounded-[32px] shadow-[0_8px_28px_rgba(0,0,0,0.12)] p-6 z-50 animate-in fade-in slide-in-from-top-5 duration-300 ease-out">
          <DatePicker selectedRange={dateRange} onChange={(range) => { setDateRange(range); if (range.start && range.end) setActiveSearchField('language'); }} />
        </div>
      )}

      {/* ✅ [신규] 팝업: 언어 선택 */}
      {activeSearchField === 'language' && (
        <div className="absolute top-[80px] right-0 w-[240px] bg-white rounded-[32px] shadow-[0_8px_28px_rgba(0,0,0,0.12)] p-6 z-50 animate-in fade-in slide-in-from-top-5 duration-300 ease-out">
          <h4 className="text-xs font-bold text-slate-500 mb-3 px-2">어떤 언어로 진행할까요?</h4>
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