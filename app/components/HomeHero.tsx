'use client';

import React from 'react';
import { Search } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';
import MainSearchBar from '@/app/components/MainSearchBar';
import { CATEGORIES } from '@/app/constants';

interface HomeHeroProps {
  activeTab: 'experience' | 'service';
  setActiveTab: (tab: 'experience' | 'service') => void;
  selectedCategory: string;
  setSelectedCategory: (id: string) => void;
  isScrolled: boolean;
  activeSearchField: 'location' | 'date' | null;
  setActiveSearchField: (field: 'location' | 'date' | null) => void;
  locationInput: string;
  setLocationInput: (val: string) => void;
  dateRange: { start: Date | null, end: Date | null };
  setDateRange: (range: any) => void;
  searchRef: React.RefObject<HTMLDivElement | null>;
  onSearch: () => void; // ✅ 검색 함수 Props 추가
}

export default function HomeHero({
  activeTab, setActiveTab,
  selectedCategory, setSelectedCategory,
  isScrolled,
  activeSearchField, setActiveSearchField,
  locationInput, setLocationInput,
  dateRange, setDateRange,
  searchRef,
  onSearch // ✅ 받아오기
}: HomeHeroProps) {

  return (
    <>
      {/* 🟢 1. 상단 고정 헤더 & Sticky 캡슐 검색바 */}
      <div className={`fixed top-0 left-0 right-0 z-50 bg-white transition-shadow duration-300 ${isScrolled ? 'shadow-sm' : ''} h-20`}>
        <SiteHeader />
        
        {/* 스크롤 시 나타나는 작은 검색바 */}
        <div 
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center bg-white border border-slate-300 rounded-full shadow-sm hover:shadow-md h-12 px-2 cursor-pointer z-[100] transition-all duration-300 ease-in-out ${isScrolled ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-75 pointer-events-none'}`}
          onClick={() => { window.scrollTo({top: 0, behavior: 'smooth'}); setActiveSearchField('location'); }}
        >
          <div className="px-4 text-sm font-bold text-slate-900 border-r border-slate-300">어디든지</div>
          <div className="px-4 text-sm font-bold text-slate-900 border-r border-slate-300">언제든지</div>
          <div className="px-4 text-sm font-bold text-slate-500">검색</div>
          <button className="w-8 h-8 bg-[#FF385C] rounded-full flex items-center justify-center text-white ml-2">
            <Search size={14} strokeWidth={3}/>
          </button>
        </div>
      </div>

      {/* 🟢 2. 메인 확장 검색바 & 탭 영역 */}
      <div className="pt-24 pb-6 px-6 relative z-40 bg-white" ref={searchRef}>
        <div className="flex flex-col items-center relative">
          
          {/* 탭 버튼 */}
          <div className={`flex gap-8 mb-4 transition-all duration-300 ${isScrolled ? 'opacity-0 -translate-y-4 pointer-events-none h-0 mb-0 overflow-hidden' : 'opacity-100 translate-y-0 h-auto'}`}>
            <button onClick={() => setActiveTab('experience')} className={`pb-2 text-base font-bold flex items-center gap-2 transition-all ${activeTab === 'experience' ? 'text-black border-b-[3px] border-black' : 'text-slate-500 hover:text-slate-800 border-b-[3px] border-transparent'}`}>
              <span className="text-xl">🎈</span> 체험
            </button>
            <button onClick={() => setActiveTab('service')} className={`pb-2 text-base font-bold flex items-center gap-2 transition-all ${activeTab === 'service' ? 'text-black border-b-[3px] border-black' : 'text-slate-500 hover:text-slate-800 border-b-[3px] border-transparent'}`}>
              <span className="text-xl">🛎️</span> 서비스
            </button>
          </div>

          <MainSearchBar 
            activeSearchField={activeSearchField}
            setActiveSearchField={setActiveSearchField}
            locationInput={locationInput}
            setLocationInput={setLocationInput}
            dateRange={dateRange}
            setDateRange={setDateRange}
            onCategorySelect={setSelectedCategory}
            isVisible={!isScrolled} 
            onSearch={onSearch} // ✅ 넘겨주기
          />
        </div>
      </div>

      {/* 🟢 3. 카테고리 필터 */}
      {activeTab === 'experience' && (
        <div className="bg-white pb-4 pt-2 border-b border-slate-100 relative z-30">
          <div className="max-w-[1760px] mx-auto px-6 md:px-12 flex justify-center">
            <div className="flex items-center gap-8 overflow-x-auto no-scrollbar pb-2 w-full justify-start md:justify-center">
              {CATEGORIES.map((cat) => (
                <button 
                  key={cat.id} 
                  onClick={() => setSelectedCategory(cat.id)} 
                  className={`flex flex-col items-center gap-2 min-w-fit pb-2 transition-all border-b-2 cursor-pointer group ${selectedCategory === cat.id ? 'border-black opacity-100' : 'border-transparent opacity-60 hover:opacity-100 hover:border-slate-200'}`}
                >
                  <span className="text-2xl transition-transform group-hover:scale-110">{cat.icon}</span>
                  <span className={`text-xs font-bold whitespace-nowrap ${selectedCategory === cat.id ? 'text-black' : 'text-slate-600'}`}>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}