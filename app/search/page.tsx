'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import SiteFooter from '@/app/components/SiteFooter';
import ExperienceCard from '@/app/components/ExperienceCard';
import SearchFilter from './components/SearchFilter';
import { Map, List, Ghost, ArrowLeft, Search } from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';

// 🟢 검색 로직 컴포넌트
function SearchResults() {
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { showToast } = useToast();

  const [experiences, setExperiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(true); // 기본값은 지도 보기 활성화 (기존 유지)

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
          .eq('status', 'active'); // 활성화된 체험만 검색

        // 🟢 [업그레이드] 다국어 검색 로직 적용
        if (location) {
          // 검색 대상 컬럼 목록 (기존 + 다국어)
          const searchFields = [
            'title', 'description', 'city', 'country', // 기본(한국어) 및 공통
            'title_en', 'description_en', 'category_en', // 영어
            'title_ja', 'description_ja', 'category_ja', // 일본어
            'title_zh', 'description_zh', 'category_zh'  // 중국어
          ];

          // "컬럼명.ilike.%검색어%" 형태의 문자열을 쉼표로 연결하여 OR 조건 생성
          const orQuery = searchFields.map(field => `${field}.ilike.%${location}%`).join(',');

          query = query.or(orQuery);
        }

        // 언어 필터 (호스트가 진행 가능한 언어)
        if (language !== 'all') {
          query = query.contains('languages', [language]);
        }

        // 날짜 필터 (예약 가능한 날짜가 있는지 확인하는 로직이 필요하다면 추가)
        // 현재는 메타데이터 검색 위주이므로 패스

        const { data, error } = await query;
        if (error) throw error;
        setExperiences(data || []);
      } catch (error) {
        console.error('Search error:', error);
        showToast('검색 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchSearchResults();
  }, [location, language, startDate, endDate]);

  return (
    <div className="pt-0 md:pt-24 pb-12 h-[calc(100vh-60px)] md:h-[calc(100vh-80px)] flex flex-col">
      {/* 📱 모바일 전용: 검색 헤더 캡슐 */}
      <div className="md:hidden flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top,0px)+8px)] pb-3 bg-white border-b border-slate-100 sticky top-0 z-40">
        <button onClick={() => window.history.back()} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors shrink-0">
          <ArrowLeft size={20} className="text-slate-900" />
        </button>
        <div className="flex-1 flex items-center gap-2 bg-slate-50 rounded-full px-4 py-2.5 border border-slate-200">
          <Search size={16} className="text-slate-400 shrink-0" />
          <span className="text-[14px] text-slate-800 font-medium truncate">{location || '검색 결과'}</span>
        </div>
      </div>

      {/* 상단 필터 바 */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 md:top-[80px] bg-white z-40">
        <div className="flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar">
          <SearchFilter label="가격 범위" />
          <SearchFilter label="숙소 유형" />
          <div className="h-6 md:h-8 w-[1px] bg-slate-200 mx-1 md:mx-2 shrink-0"></div>
          <span className="text-xs md:text-sm font-bold text-slate-500 whitespace-nowrap">
            {experiences.length}개의 체험
          </span>
        </div>

        {/* 지도 토글 - 데스크탑 전용 */}
        <button
          onClick={() => setShowMap(!showMap)}
          className="hidden md:flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-bold shadow-md hover:bg-black transition-colors"
        >
          {showMap ? <><List size={16} /> 리스트 보기</> : <><Map size={16} /> 지도 보기</>}
        </button>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 리스트 영역 */}
        <div className={`flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-6 ${showMap ? 'lg:w-3/5 xl:w-1/2' : 'w-full'}`}>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="bg-slate-100 aspect-[4/3] rounded-xl mb-3"></div>
                  <div className="h-4 bg-slate-100 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : experiences.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <Ghost size={48} className="text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">이 조건에 맞는 체험이 없어요</h3>
              <p className="text-slate-500 text-sm">다른 날짜나 키워드로 검색해보시거나, 메인에서 전체 체험을 둘러보세요.</p>
            </div>
          ) : (
            <div className={`grid gap-6 ${showMap ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
              {experiences.map((item) => (
                // 🟢 [확인완료] data={item} 사용 (ExperienceCard 최신 스펙 준수)
                <ExperienceCard key={item.id} data={item} />
              ))}
            </div>
          )}
          <div className="mt-12">
            <SiteFooter />
          </div>
        </div>

        {/* 지도 영역 (기존 디자인 유지) */}
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
  );
}

// 🟢 메인 페이지 컴포넌트 (Suspense 적용 유지)
export default function SearchPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <Suspense fallback={<div className="pt-32 text-center">검색 중...</div>}>
        <SearchResults />
      </Suspense>
    </div>
  );
}