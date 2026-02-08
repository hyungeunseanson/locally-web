import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { CATEGORIES } from '../constants';
import { Experience } from '../types';

export function useExperienceFilter() {
  const [allExperiences, setAllExperiences] = useState<Experience[]>([]);
  const [filteredExperiences, setFilteredExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);

  // 필터 상태
  const [locationInput, setLocationInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('전체');
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

    if (selectedLanguage !== '전체') {
        const langMap: Record<string, string> = { '한국어': 'ko', '영어': 'en', '일본어': 'ja', '중국어': 'zh' };
        const langCode = langMap[selectedLanguage] || selectedLanguage;
        result = result.filter(item => item.languages?.includes(selectedLanguage) || item.languages?.includes(langCode));
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

    if (selectedCategory !== 'all' && !locationInput) {
      const label = CATEGORIES.find(c => c.id === selectedCategory)?.label;
      if (label) {
        result = result.filter(item => item.city === label || item.title.includes(label));
      }
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