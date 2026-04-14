import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchActiveExperiences } from '../utils/api/experiences';
import { Experience } from '../types';
import { sendSearchLog } from '@/app/utils/analytics/client';
import { buildSearchHaystack, tokenizeSearchInput } from '@/app/search/searchText';

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
  const {
    data: allExperiences = [],
    isLoading: loading,
    isSuccess,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['home-experiences', 'active'],
    queryFn: fetchActiveExperiences,
    staleTime: 60 * 1000,
    retry: false,
  });

  const [filteredExperiences, setFilteredExperiences] = useState<Experience[]>([]);
  const [locationInput, setLocationInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });

  useEffect(() => {
    if (isSuccess) {
      setFilteredExperiences(allExperiences);
    }
  }, [allExperiences, isSuccess]);

  const applyFilters = (locationOverride?: string) => {
    let result = allExperiences;
    const searchTerm = locationOverride !== undefined ? locationOverride : locationInput;

    if (searchTerm.trim()) {
      sendSearchLog(searchTerm.trim(), 'main');

      const searchTerms = tokenizeSearchInput(searchTerm);
      result = result.filter(item => {
        const haystack = buildSearchHaystack(item);
        return searchTerms.every(term => haystack.includes(term));
      });
    }

    if (selectedLanguage !== 'all' && selectedLanguage !== '전체') {
      result = result.filter(item => item.languages?.includes(selectedLanguage));
    }

    if (dateRange.start) {
      const start = new Date(dateRange.start); start.setHours(0, 0, 0, 0);
      const end = dateRange.end ? new Date(dateRange.end) : new Date(dateRange.start); end.setHours(23, 59, 59, 999);

      result = result.filter(item =>
        item.available_dates?.some(d => {
          const t = new Date(d).getTime();
          return t >= start.getTime() && t <= end.getTime();
        })
      );
    }

    if (selectedCategory !== 'all') {
      const targetCity = cityMap[selectedCategory] || selectedCategory;
      result = result.filter(item => item.city === targetCity);
    }

    setFilteredExperiences(result);
  };

  useEffect(() => {
    if (!locationInput) applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, selectedLanguage, dateRange, allExperiences]);

  return {
    loading,
    loadError: isError,
    refetchExperiences: refetch,
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
