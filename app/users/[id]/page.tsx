'use client';

import Image from 'next/image';
import React, { use, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { User, CheckCircle2, Star } from 'lucide-react';
import ExperienceCard from '@/app/components/ExperienceCard';
import { useLanguage } from '@/app/context/LanguageContext';
import {
  isPublicHostApplicationStatus,
  pickLatestPublicHostApplication,
} from '@/app/utils/hostVisibility';

type PublicHostProfile = {
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  introduction: string | null;
  languages: string[];
};

type HostExperienceCardData = {
  id: number | string;
  title?: string | null;
  title_en?: string | null;
  title_ja?: string | null;
  title_zh?: string | null;
  category?: string | null;
  category_en?: string | null;
  category_ja?: string | null;
  category_zh?: string | null;
  city?: string | null;
  subCity?: string | null;
  country?: string | null;
  location?: string | null;
  languages?: string[] | null;
  image_url?: string | null;
  photos?: string[] | null;
  rating?: number | null;
  review_count?: number | null;
  price?: number | string | null;
};

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { t } = useLanguage();
  const [profile, setProfile] = useState<PublicHostProfile | null>(null);
  const [hostExperiences, setHostExperiences] = useState<HostExperienceCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const fetchProfile = async () => {
      // 공개 호스트 프로필은 safe projection view만 사용한다.
      const { data: hostApp } = await supabase
        .from('public_host_applications')
        .select('id, status, name, profile_photo, self_intro, languages, created_at')
        .eq('user_id', resolvedParams.id)
        .order('created_at', { ascending: false });

      const latestHostApp = pickLatestPublicHostApplication(hostApp || []);

      const isPublicHost = isPublicHostApplicationStatus(latestHostApp?.status);

      setProfile(isPublicHost && latestHostApp ? {
        full_name: latestHostApp.name,
        avatar_url: latestHostApp.profile_photo,
        bio: latestHostApp.self_intro,
        introduction: latestHostApp.self_intro,
        languages: Array.isArray(latestHostApp.languages)
          ? latestHostApp.languages.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          : [],
      } : null);

      // 공개 상태 호스트의 경우에만 운영 중인 활성 체험 가져오기
      if (isPublicHost) {
        const { data: expData } = await supabase
          .from('experiences')
          .select('*')
          .eq('host_id', resolvedParams.id)
          .eq('status', 'active');

        if (expData) setHostExperiences(expData);
      } else {
        setHostExperiences([]);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [resolvedParams.id, supabase]);

  if (loading) return <div className="min-h-screen bg-white" />;

  const displayName = profile?.full_name || t('public_host_profile_name_fallback');
  const activeExperienceCountLabel = t('public_host_profile_meta_active_count').replace('{count}', String(hostExperiences.length));

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <SiteHeader />

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-12">
        <div className="flex flex-col md:flex-row gap-6 md:gap-12">

          {/* 왼쪽: 프로필 카드 (고정) */}
          <div className="md:w-1/3">
            <div className="border border-slate-200 rounded-2xl md:rounded-3xl p-5 md:p-8 shadow-lg sticky top-24">
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden bg-slate-100 mb-4 md:mb-6">
                  {profile?.avatar_url ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={profile.avatar_url}
                        alt={profile?.full_name || 'Host profile'}
                        fill
                        sizes="(max-width: 768px) 96px, 128px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300"><User size={64} /></div>
                  )}
                </div>
                <h1 className="text-2xl md:text-3xl font-black mb-2">{displayName}</h1>
                <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                  <div className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                    <CheckCircle2 size={16} className="text-black" /> {t('verified_identity')}
                  </div>
                  <div className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600">
                    {activeExperienceCountLabel}
                  </div>
                </div>

                {profile?.languages && profile.languages.length > 0 && (
                  <div data-testid="public-host-languages" className="mb-6 w-full text-left">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                      {t('field_label_languages')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {profile.languages.map((language) => (
                        <span
                          key={language}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600"
                        >
                          {language}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <p className="mb-3 text-sm leading-relaxed text-slate-500">
                  {t('public_host_profile_verification_desc')}
                </p>

                <div className="w-full border-t border-slate-100 py-4 md:py-6 text-left space-y-3 md:space-y-4">
                  <h3 className="font-bold text-base md:text-lg">
                    {t('public_host_profile_verification_title').replace('{name}', displayName)}
                  </h3>
                  <div className="flex items-center gap-2 text-slate-600">
                    <CheckCircle2 size={18} /> <span>{t('public_host_profile_verification_id')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <CheckCircle2 size={18} /> <span>{t('public_host_profile_verification_email')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <CheckCircle2 size={18} /> <span>{t('public_host_profile_verification_phone')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 오른쪽: 상세 소개 및 체험 목록 */}
          <div className="md:w-2/3 space-y-12">

            {/* 소개글 */}
            <section>
              <h2 className="text-xl md:text-2xl font-bold mb-2 md:mb-3">{t('public_host_profile_intro_title')}</h2>
              <p className="mb-4 text-sm leading-relaxed text-slate-500 md:mb-6">
                {t('public_host_profile_intro_desc')}
              </p>
              <div className="prose prose-slate max-w-none">
                <p className="text-base md:text-lg leading-relaxed text-slate-700">
                  {profile?.introduction || profile?.bio || t('public_host_profile_intro_empty')}
                </p>
              </div>
            </section>

            {/* 운영 중인 체험 */}
            <section data-testid="public-host-experiences-section" className="pt-12 border-t border-slate-100">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold mb-2">
                    {t('public_host_profile_experiences_title').replace('{name}', displayName)}
                  </h2>
                  <p className="text-sm leading-relaxed text-slate-500">
                    {t('public_host_profile_experiences_desc')}
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                  {activeExperienceCountLabel}
                </span>
              </div>

              {hostExperiences.length > 0 ? (
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {hostExperiences.map(exp => (
                    <ExperienceCard key={exp.id} data={exp} />
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                  {t('public_host_profile_experiences_empty')}
                </div>
              )}
            </section>

            {/* 후기 (추후 구현) */}
            <section className="pt-12 border-t border-slate-100">
              <h2 className="text-xl md:text-2xl font-bold mb-2 md:mb-3 flex items-center gap-2">
                <Star className="fill-black" size={24} /> {t('public_host_profile_reviews_title')}
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-slate-500 md:mb-6">
                {t('public_host_profile_reviews_desc')}
              </p>
              <div className="p-8 bg-slate-50 rounded-2xl text-center text-slate-500">
                {t('public_host_profile_reviews_empty')}
              </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}
