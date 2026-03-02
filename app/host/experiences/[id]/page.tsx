'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { useRouter, useParams } from 'next/navigation';
import { MapPin, Star, Calendar, Edit, ChevronLeft, Trash2 } from 'lucide-react';
import Spinner from '@/app/components/ui/Spinner';
import Link from 'next/link';
import { useLanguage } from '@/app/context/LanguageContext';

export default function HostExperienceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = useMemo(() => createClient(), []);
  const [experience, setExperience] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const fetchExperience = async () => {
      // 내 체험인지 확인하기 위해 세션 체크
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }

      const { data: exp, error } = await supabase
        .from('experiences')
        .select('*')
        .eq('id', params.id)
        .eq('host_id', user.id) // 내 것만 조회 가능
        .maybeSingle();

      if (error) {
        console.error(error);
        router.push('/host/dashboard'); // 에러나면 대시보드로
      } else {
        setExperience(exp);
      }
      setLoading(false);
    };
    fetchExperience();
  }, [params.id, router, supabase]);

  const handleDelete = async () => {
    if (!confirm(t('exp_del_confirm') as string)) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("로그인이 필요합니다.");
      return;
    }

    const { error } = await supabase
      .from('experiences')
      .delete()
      .eq('id', experience.id)
      .eq('host_id', user.id);
    if (error) alert(t('exp_del_fail'));
    else {
      alert(t('exp_del_success'));
      router.push('/host/dashboard');
    }
  };

  if (loading) return <Spinner fullScreen />;
  if (!experience) return <div className="min-h-screen bg-white flex items-center justify-center">{t('exp_not_found')}</div>;

  const previewImage = experience.photos?.[0] || experience.image_url;
  const locationText = experience.location || experience.meeting_point || [experience.country, experience.city].filter(Boolean).join(' ');
  const ratingText = typeof experience.rating === 'number' ? experience.rating.toFixed(1) : '-';
  const statusLabel = experience.status === 'active'
    ? '공개 중'
    : experience.status === 'pending'
      ? '승인 대기'
      : experience.status === 'revision'
        ? '수정 요청'
        : experience.status === 'rejected'
          ? '반려'
          : '비공개';
  const statusColor = experience.status === 'active' ? 'text-green-600' : 'text-slate-500';

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-20 md:pb-0">
      <SiteHeader />

      <main className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/host/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-black mb-6 font-bold text-sm">
          <ChevronLeft size={16} /> 대시보드로 돌아가기
        </Link>

        {/* 상단 액션 버튼 */}
        <div className="flex justify-between items-start mb-6">
          <h1 className="text-3xl font-black">{experience.title}</h1>
          <div className="flex gap-2">
            <Link href={`/host/experiences/${experience.id}/dates`}>
              <button className="px-4 py-2 border rounded-lg text-sm font-bold hover:bg-slate-50 flex items-center gap-2">
                <Calendar size={16} /> 일정 관리
              </button>
            </Link>
            <Link href={`/host/experiences/${experience.id}/edit`}>
              <button className="px-4 py-2 border rounded-lg text-sm font-bold hover:bg-slate-50 flex items-center gap-2">
                <Edit size={16} /> 수정
              </button>
            </Link>
            <button onClick={handleDelete} className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 flex items-center gap-2">
              <Trash2 size={16} /> 삭제
            </button>
          </div>
        </div>

        {/* 이미지 섹션 */}
        <div className="relative aspect-video rounded-3xl overflow-hidden mb-8 bg-slate-100 border border-slate-200">
          {previewImage ? (
            <img src={previewImage} className="w-full h-full object-cover" alt={experience.title} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">{t('exp_no_img')}</div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* 상세 정보 */}
          <div className="md:col-span-2 space-y-8">
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1"><MapPin size={16} /> {locationText || '위치 정보 없음'}</span>
              <span className="flex items-center gap-1"><Star size={16} className="text-black fill-black" /> {ratingText}</span>
            </div>

            <div>
              <h3 className="text-xl font-bold mb-4">체험 소개</h3>
              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{experience.description}</p>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <h3 className="font-bold mb-2">{t('exp_host_tip')}</h3>
              <p className="text-sm text-slate-500 whitespace-pre-line">
                {t('exp_host_tip_desc')}
              </p>
            </div>
          </div>

          {/* 오른쪽: 요약 카드 */}
          <div className="md:col-span-1">
            <div className="border border-slate-200 rounded-2xl p-6 shadow-sm bg-white">
              <h3 className="font-bold text-lg mb-4">{t('exp_setting_info')}</h3>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">가격</span>
                  <span className="font-bold">₩{Number(experience.price).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">카테고리</span>
                  <span className="font-bold">{experience.category || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">상태</span>
                  <span className={`font-bold ${statusColor}`}>{statusLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
