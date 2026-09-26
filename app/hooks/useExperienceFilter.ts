import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchActiveExperiences } from '../utils/api/experiences';
import type { PublicHomeExperience } from '@/app/home/homeExperienceTypes';
import { sendSearchLog } from '@/app/utils/analytics/client';
import { buildSearchHaystack, tokenizeSearchInput } from '@/app/search/searchText';

// Keep the Home city shortcuts aligned with the Korean city values in the public data.
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

const EMPTY_EXPERIENCES: PublicHomeExperience[] = [];
const HOME_EXPERIENCES_QUERY_KEY = ['home-experiences', 'active'] as const;
// Keep the date state and filtering path for a future return of the home date UI.
const HOME_SEARCH_DATE_ENABLED = false;
type DateRange = { start: Date | null; end: Date | null };

type InitialHomeExperiences = {
  initialExperiences?: PublicHomeExperience[];
  initialExperiencesUpdatedAt?: number;
};

function filterExperiences(
  experiences: PublicHomeExperience[],
  searchTerm: string,
  selectedCategory: string,
  selectedLanguage: string,
  dateRange: DateRange
) {
  let result = experiences;

  if (searchTerm.trim()) {
    const searchTerms = tokenizeSearchInput(searchTerm);
    result = result.filter((item) => {
      const haystack = buildSearchHaystack(item);
      return searchTerms.every((term) => haystack.includes(term));
    });
  }

  if (selectedLanguage !== 'all' && selectedLanguage !== '전체') {
    result = result.filter((item) => item.languages?.includes(selectedLanguage));
  }

  if (HOME_SEARCH_DATE_ENABLED && dateRange.start) {
    const start = new Date(dateRange.start); start.setHours(0, 0, 0, 0);
    const end = dateRange.end ? new Date(dateRange.end) : new Date(dateRange.start); end.setHours(23, 59, 59, 999);

    result = result.filter((item) =>
      item.available_dates?.some((date) => {
        const time = new Date(date).getTime();
        return time >= start.getTime() && time <= end.getTime();
      })
    );
  }

  if (selectedCategory !== 'all') {
    const targetCity = cityMap[selectedCategory] || selectedCategory;
    result = result.filter((item) => item.city === targetCity);
  }

  return result;
}

export function useExperienceFilter({ initialExperiences, initialExperiencesUpdatedAt }: InitialHomeExperiences = {}) {
  const queryClient = useQueryClient();
  const {
    data: allExperiences = EMPTY_EXPERIENCES,
    dataUpdatedAt,
    isLoading: loading,
    isError,
    refetch,
  } = useQuery({
    queryKey: HOME_EXPERIENCES_QUERY_KEY,
    queryFn: fetchActiveExperiences,
    initialData: initialExperiences,
    initialDataUpdatedAt: initialExperiencesUpdatedAt,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const [locationInput, setLocationInputState] = useState('');
  const [committedLocation, setCommittedLocation] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });

  const setLocationInput = (value: string) => {
    setLocationInputState(value);
    if (!value) setCommittedLocation('');
  };

  // Render the server snapshot from the first frame. initialData does not replace
  // an existing Query entry on a client-side return, so merge a newer snapshot.
  const hasNewServerSnapshot = Boolean(
    initialExperiences && initialExperiencesUpdatedAt && dataUpdatedAt < initialExperiencesUpdatedAt
  );
  const currentExperiences = hasNewServerSnapshot && initialExperiences ? initialExperiences : allExperiences;
  const filteredExperiences = useMemo(() => filterExperiences(
    currentExperiences, committedLocation, selectedCategory, selectedLanguage, dateRange
  ), [currentExperiences, committedLocation, selectedCategory, selectedLanguage, dateRange]);

  useEffect(() => {
    if (hasNewServerSnapshot && initialExperiences && initialExperiencesUpdatedAt) {
      queryClient.setQueryData(HOME_EXPERIENCES_QUERY_KEY, initialExperiences, {
        updatedAt: initialExperiencesUpdatedAt,
      });
    }
  }, [hasNewServerSnapshot, initialExperiences, initialExperiencesUpdatedAt, queryClient]);

  const applyFilters = (locationOverride?: string) => {
    const searchTerm = locationOverride !== undefined ? locationOverride : locationInput;
    if (searchTerm.trim()) sendSearchLog(searchTerm.trim(), 'main');
    setCommittedLocation(searchTerm);
  };

  return {
    loading: loading && !hasNewServerSnapshot,
    loadError: isError && !hasNewServerSnapshot,
    refetchExperiences: refetch,
    filteredExperiences,
    allExperiences: currentExperiences,
    locationInput, setLocationInput,
    selectedCategory, setSelectedCategory,
    selectedLanguage, setSelectedLanguage,
    dateRange, setDateRange,
    applyFilters
  };
}
