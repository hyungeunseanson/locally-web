import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchActiveExperiences } from '../utils/api/experiences';
import { Experience } from '../types';

// 🟢 통역기: 영어 ID가 들어오면 한글 DB 이름으로 바꿔주는 역할 (유지)
const cityMap: Record<string, string> = {
  tokyo: '도쿄',
  osaka: '오사카',
  fukuoka: '후쿠오카',
  sapporo: '삿포로',
  nagoya: '나고야',
  seoul: '서울',
  busan: '부산',
  jeju: '제주'
};

export function useExperienceFilter() {
  // 🟢 1. React Query를 이용한 데이터 패칭 및 캐싱 (로딩 상태 자동 관리)
  const { 
    data: allExperiences = [], // 기본값 빈 배열
    isLoading: loading,
    isSuccess
  } = useQuery({
    queryKey: ['experiences', 'active'], // 캐시 키
    queryFn: fetchActiveExperiences,     // API 호출 함수
  });

  // 필터링된 결과 상태
  const [filteredExperiences, setFilteredExperiences] = useState<Experience[]>([]);

  // 필터 컨트롤 상태 (유지)
  const [locationInput, setLocationInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });

  // 🟢 2. React Query로 데이터를 성공적으로 불러오면 초기 필터링 결과에 세팅
  useEffect(() => {
    if (isSuccess) {
      setFilteredExperiences(allExperiences);
    }
  }, [allExperiences, isSuccess]);

  // 🟢 3. 필터 적용 로직 (기존 로직 100% 유지)
  const applyFilters = () => {
    let result = allExperiences;

    // 검색어 필터
    if (locationInput.trim()) {
      const searchTerms = locationInput.replace(/[·,.]/g, ' ').toLowerCase().split(/\s+/).filter(t => t.length > 0);
      result = result.filter(item => {
        const targetString = `${item.title} ${item.city} ${item.description} ${item.category} ${item.tags?.join(' ')}`.toLowerCase();
        return searchTerms.every(term => targetString.includes(term));
      });
    }

    // 언어 필터
    if (selectedLanguage !== 'all' && selectedLanguage !== '전체') {
      result = result.filter(item => item.languages?.includes(selectedLanguage));
    }

    // 날짜 필터
    if (dateRange.start) {
      const start = new Date(dateRange.start); start.setHours(0,0,0,0);
      const end = dateRange.end ? new Date(dateRange.end) : new Date(dateRange.start); end.setHours(23,59,59,999);
      
      result = result.filter(item => 
        item.available_dates?.some(d => {
          const t = new Date(d).getTime();
          return t >= start.getTime() && t <= end.getTime();
        })
      );
    }

    // 카테고리(도시) 필터
    if (selectedCategory !== 'all') {
      const targetCity = cityMap[selectedCategory] || selectedCategory;
      result = result.filter(item => item.city === targetCity);
    }

    setFilteredExperiences(result);
  };

  // 🟢 4. 카테고리, 언어, 날짜 변경 시 자동 필터 적용 (유지)
  useEffect(() => {
    // 검색어가 비어있을 때만 자동 필터 적용 (검색 버튼 클릭 시나리오 유지)
    if (!locationInput) applyFilters();
  }, [selectedCategory, selectedLanguage, dateRange, allExperiences]); // allExperiences 변경 시 재실행 추가

  return {
    loading, 
    filteredExperiences, 
    allExperiences,
    locationInput, setLocationInput,
    selectedCategory, setSelectedCategory,
    selectedLanguage, setSelectedLanguage,
    dateRange, setDateRange,
    setFilteredExperiences, 
    applyFilters
  };
}