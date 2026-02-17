import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { CATEGORIES } from '../constants';
import { Experience } from '../types';

// 🟢 [추가] 통역기: 영어 ID가 들어오면 한글 DB 이름으로 바꿔주는 역할
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
  const [allExperiences, setAllExperiences] = useState<Experience[]>([]);
  const [filteredExperiences, setFilteredExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);

  // 필터 상태
  const [locationInput, setLocationInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  // 🟢 [수정] '전체' -> 'all'로 변경해야 번역 작동함
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });

  const supabase = createClient();

  useEffect(() => {
    const fetchExperiences = async () => {
      setLoading(true);
      try {
        let { data: expData, error } = await supabase
          .from('experiences')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (expData && expData.length > 0) {
          const expIds = expData.map((e: any) => e.id);
          const { data: dateData } = await supabase
            .from('experience_availability')
            .select('experience_id, date')
            .in('experience_id', expIds);

          const mergedData = expData.map((exp: any) => ({
            ...exp,
            available_dates: dateData
              ?.filter((d: any) => d.experience_id === exp.id)
              .map((d: any) => d.date) || [],
          }));

          setAllExperiences(mergedData);
          setFilteredExperiences(mergedData);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchExperiences();
  }, []);

  const applyFilters = () => {
    let result = allExperiences;

    if (locationInput.trim()) {
      const searchTerms = locationInput.replace(/[·,.]/g, ' ').toLowerCase().split(/\s+/).filter(t => t.length > 0);
      result = result.filter(item => {
        const targetString = `${item.title} ${item.city} ${item.description} ${item.category} ${item.tags?.join(' ')}`.toLowerCase();
        return searchTerms.every(term => targetString.includes(term));
      });
    }

// 🟢 [수정] 언어 필터: 'all'이 아닐 때 작동하도록 변경
if (selectedLanguage !== 'all' && selectedLanguage !== '전체') {
  result = result.filter(item => item.languages?.includes(selectedLanguage));
}

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

// 🟢 [수정] 카테고리 필터: cityMap(통역기)를 사용해 영어ID를 한글로 변환
if (selectedCategory !== 'all') {
  const targetCity = cityMap[selectedCategory] || selectedCategory;
  // 검색어 입력 여부와 상관없이 카테고리 누르면 필터링 되도록 변경
  result = result.filter(item => item.city === targetCity);
}
    

    setFilteredExperiences(result);
  };

  useEffect(() => {
    if (!locationInput) applyFilters();
  }, [selectedCategory, selectedLanguage, dateRange]);

  return {
    loading, filteredExperiences, allExperiences,
    locationInput, setLocationInput,
    selectedCategory, setSelectedCategory,
    selectedLanguage, setSelectedLanguage,
    dateRange, setDateRange,
    setFilteredExperiences, applyFilters
  };
}