'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import SiteFooter from '@/app/components/SiteFooter';
import ExperienceCard from '@/app/components/ExperienceCard';
import SearchFilter from './components/SearchFilter';
import { Map, List, Ghost } from 'lucide-react';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const supabase = createClient();
  
  const [experiences, setExperiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(true); // 모바일/태블릿에서 지도 토글

  // 검색 조건
  const location = searchParams.get('location') || '';
  const language = searchParams.get('language') || 'all';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  useEffect(() => {
    const fetchSearchResults = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('experiences')
          .select('*')
          .eq('status', 'active');

        // 1. 지역 검색 (제목, 위치, 설명에서 검색)
        if (location) {
          query = query.or(`title.ilike.%${location}%,location.ilike.%${location}%,description.ilike.%${location}%`);
        }

        // 2. 언어 필터
        if (language !== 'all') {
          // languages 배열에 해당 언어가 포함되어 있는지 확인 (Supabase array contains)
          query = query.contains('languages', [language]);
        }

        // 3. 날짜 필터 (예약 가능한 날짜 로직이 필요하지만, 여기서는 기본적으로 가져옴)
        // 실제로는 availability 테이블 조인 필요. 일단은 체험 데이터만 가져옴.

        const { data, error } = await query;
        
        if (error) throw error;
        setExperiences(data || []);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSearchResults();
  }, [location, language, startDate, endDate]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      
      <div className="pt-24 pb-12 h-[calc(100vh-80px)] flex flex-col">
        {/* 상단 필터 바 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-[80px] bg-white z-40">
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
            <SearchFilter label="가격 범위" />
            <SearchFilter label="숙소 유형" />
            <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
            <span className="text-sm font-bold text-slate-500 whitespace-nowrap">
              {experiences.length}개의 체험
            </span>
          </div>
          
          {/* 지도 토글 버튼 (PC에서는 항상 보임, 반응형 고려) */}
          <button 
            onClick={() => setShowMap(!showMap)} 
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-bold shadow-md hover:bg-black transition-colors"
          >
            {showMap ? <><List size={16}/> 리스트 보기</> : <><Map size={16}/> 지도 보기</>}
          </button>
        </div>

        {/* 메인 콘텐츠: 리스트 & 지도 분할 */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* 1. 리스트 영역 */}
          <div className={`flex-1 overflow-y-auto px-6 py-6 ${showMap ? 'lg:w-3/5 xl:w-1/2' : 'w-full'}`}>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-slate-100 aspect-[4/3] rounded-xl mb-3"></div>
                    <div className="h-4 bg-slate-100 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : experiences.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <Ghost size={48} className="text-slate-300 mb-4"/>
                <h3 className="text-lg font-bold text-slate-900 mb-2">검색 결과가 없습니다.</h3>
                <p className="text-slate-500 text-sm">다른 날짜나 키워드로 검색해보세요.</p>
              </div>
            ) : (
              <div className={`grid gap-6 ${showMap ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
                {experiences.map((item) => (
                  <ExperienceCard key={item.id} item={item} />
                ))}
              </div>
            )}
            
            <div className="mt-12">
                <SiteFooter />
            </div>
          </div>

          {/* 2. 지도 영역 (Google Map Placeholder) */}
          {showMap && (
            <div className="hidden lg:block flex-1 bg-slate-100 relative h-full border-l border-slate-200">
              <div className="absolute inset-0 flex items-center justify-center flex-col text-slate-400 bg-slate-50">
                <Map size={48} className="mb-2 opacity-50"/>
                <span className="text-sm font-medium">지도 뷰 준비 중입니다.</span>
                <span className="text-xs text-slate-400 mt-1">(Google Maps API 연동 예정)</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}