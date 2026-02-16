'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import ExperienceCard from '@/app/components/ExperienceCard';
import { ExperienceCardSkeleton } from '@/app/components/skeletons/ExperienceCardSkeleton';

import EmptyState from '@/app/components/EmptyState';
import { useLanguage } from '@/app/context/LanguageContext';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { t } = useLanguage(); 

  const location = searchParams.get('location');
  const date = searchParams.get('date');
  const category = searchParams.get('category');

  const [experiences, setExperiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExperiences = async () => {
      setLoading(true);
      
      try {
        let query = supabase
          .from('experiences')
          .select(`
            *,
            host:profiles!experiences_host_id_fkey (
              id, full_name, avatar_url, username
            )
          `)
          .eq('status', 'active');

        // 🔴 [삭제됨] 언어 필터링 로직 제거! (모든 언어 다 보여줌)
        // if (lang) { query = query.contains('languages', [lang]); } 

        // 3. 위치 검색
        if (location) {
          query = query.or(`title.ilike.%${location}%,description.ilike.%${location}%,location_city.ilike.%${location}%`);
        }

        // 4. 카테고리 필터
        if (category && category !== 'all') {
          query = query.eq('category', category);
        }

        const { data, error } = await query;

        if (error) throw error;
        setExperiences(data || []);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchExperiences();
  }, [location, category, date]); // lang 의존성 제거

  return (
    <div className="max-w-[1760px] mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          {location ? `"${location}" ${t('search_results') || '검색 결과'}` : (t('all_experiences') || '전체 체험')}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
           {/* 안내 문구 변경 */}
           {t('no_exp_subtitle') || "전 세계의 다양한 호스트를 만나보세요."}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <ExperienceCardSkeleton key={i} />)}
        </div>
      ) : experiences.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {experiences.map((exp) => (
            <ExperienceCard key={exp.id} data={exp} />
          ))}
        </div>
      ) : (
        <EmptyState 
          title={t('no_exp') || "조건에 맞는 체험이 없습니다."}
          subtitle="다른 날짜나 지역으로 검색해보세요."
          showReset
        />
      )}
    </div>
  );
}