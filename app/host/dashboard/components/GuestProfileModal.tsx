'use client';

import React, { useEffect, useState } from 'react';
import { User, X, Star, Globe, Smile, MessageCircle, Briefcase, Users } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useLanguage } from '@/app/context/LanguageContext';
import { formatGenderLabel, normalizeLanguageList, normalizeProfileLanguageValue } from '@/app/utils/profile';

interface GuestModalProfile {
  id: string | number;
  full_name?: string | null;
  avatar_url?: string | null;
  nationality?: string | null;
  job?: string | null;
  gender?: string | null;
  mbti?: string | null;
  languages?: string[] | string | null;
  introduction?: string | null;
  bio?: string | null;
  created_at?: string | null;
}

interface GuestReview {
  id: string | number;
  rating?: number | null;
  content?: string | null;
  created_at: string;
  host?: {
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

interface Props {
  guest: GuestModalProfile | null;
  onClose: () => void;
}

export default function GuestProfileModal({ guest, onClose }: Props) {
  const { t } = useLanguage();
  const supabase = createClient();
  const [reviews, setReviews] = useState<GuestReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      if (!guest?.id) return;

      const { data } = await supabase
        .from('guest_reviews')
        .select(`
          *,
          host:profiles!guest_reviews_host_id_fkey(full_name, avatar_url)
        `)
        .eq('guest_id', guest.id)
        .order('created_at', { ascending: false });

      if (data) setReviews(data);
      setLoadingReviews(false);
    };
    fetchReviews();
  }, [guest, supabase]);

  useEffect(() => {
    if (!guest) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [guest]);

  if (!guest) return null;

  const languages = normalizeLanguageList(guest.languages);
  const joinedAt = guest.created_at
    ? new Date(guest.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })
    : '가입일 정보 없음';

  const genderLabel = guest.gender ? formatGenderLabel(guest.gender) : null;
  const languageDisplay = languages.length > 0
    ? languages.map((lang: string) => t(`lang_${normalizeProfileLanguageValue(lang)}`)).join(', ')
    : null;

  // 2×2 attribute grid items — only render non-empty ones
  const gridItems = [
    genderLabel ? { icon: <Users size={14} />, label: 'Gender', value: genderLabel } : null,
    languageDisplay ? { icon: <Globe size={14} />, label: 'Languages', value: languageDisplay } : null,
    guest.mbti ? { icon: <Smile size={14} />, label: 'MBTI', value: guest.mbti } : null,
    guest.job ? { icon: <Briefcase size={14} />, label: 'Job', value: guest.job } : null,
  ].filter(Boolean) as Array<{ icon: React.ReactNode; label: string; value: string }>;

  return (
    <div
      className="fixed inset-0 z-[160] flex items-end md:items-center justify-center bg-black/60 md:px-4 md:py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] md:max-h-[90vh] w-full md:max-w-[560px] flex-col overflow-hidden rounded-t-[28px] md:rounded-[28px] bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.18)] md:shadow-[0_24px_80px_rgba(15,23,42,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모바일 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-1 md:hidden flex-shrink-0">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* 프로필 헤더 */}
        <div className="relative border-b border-slate-100 bg-slate-50 px-5 pb-5 pt-4 md:px-6 md:pb-7 md:pt-8 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-3 md:top-4 inline-flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full bg-white/90 text-slate-500 transition-colors hover:text-slate-900"
          >
            <X size={17} />
          </button>

          <div className="flex items-center gap-3 md:gap-4">
            {/* 아바타 */}
            <div className="h-16 w-16 md:h-24 md:w-24 shrink-0 overflow-hidden rounded-full border-4 border-white bg-slate-200 shadow-lg flex items-center justify-center">
              {guest.avatar_url ? (
                <img src={guest.avatar_url} className="h-full w-full object-cover" alt={guest.full_name ?? 'Guest'} />
              ) : (
                <User size={24} className="text-slate-400 md:hidden" />
              )}
              {!guest.avatar_url && <User size={32} className="text-slate-400 hidden md:block" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] md:text-[11px] font-bold text-white">
                  Guest
                </span>
                <span className="text-[11px] md:text-[12px] font-medium text-slate-400">
                  {joinedAt}
                </span>
              </div>
              <h2 className="break-words text-[20px] md:text-[24px] font-black text-slate-900 [overflow-wrap:anywhere]">
                {guest.full_name}
                {guest.nationality && (
                  <span className="ml-2 text-[15px] md:text-[17px] font-medium text-slate-500">
                    {guest.nationality}
                  </span>
                )}
              </h2>
            </div>
          </div>
        </div>

        {/* 스크롤 본문 */}
        <div className="overflow-y-auto px-4 py-5 md:px-6 md:py-6 custom-scrollbar flex-1">

          {/* 속성 그리드 */}
          {gridItems.length > 0 && (
            <div className="mb-6 grid grid-cols-2 gap-3">
              {gridItems.map((item) => (
                <div key={item.label} className="rounded-2xl bg-slate-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-slate-500">
                    {item.icon}
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em]">{item.label}</span>
                  </div>
                  <p className="break-words text-[13px] md:text-sm font-semibold text-slate-800 [overflow-wrap:anywhere]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* About */}
          <section className="mb-8">
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">About</h3>
            <div className="rounded-3xl bg-slate-50 p-5 text-[15px] leading-7 text-slate-700">
              <p className="break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
                {guest.introduction || guest.bio || t('guest_modal_intro_empty')}
              </p>
            </div>
          </section>

          {/* 받은 후기 */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Star size={16} className="text-slate-900" fill="currentColor" />
              <h3 className="text-[16px] font-bold text-slate-900">
                {t('guest_modal_reviews')} ({reviews.length})
              </h3>
            </div>

            {loadingReviews ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-24 rounded-3xl bg-slate-50 animate-pulse" />
                ))}
              </div>
            ) : reviews.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center">
                <MessageCircle size={24} className="mx-auto text-slate-300 mb-2" />
                <p className="text-[13px] md:text-sm text-slate-400">{t('guest_modal_no_reviews')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-3xl border border-slate-100 px-4 py-4 transition-colors hover:border-slate-200 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-slate-200">
                          {review.host?.avatar_url ? (
                            <img src={review.host.avatar_url} className="h-full w-full object-cover" alt="" />
                          ) : (
                            <User size={14} className="text-slate-400 m-auto mt-1.5" />
                          )}
                        </div>
                        <span className="text-[13px] md:text-sm font-bold text-slate-900">
                          {review.host?.full_name || 'Host'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Star size={11} fill="currentColor" className="text-amber-400" />
                        <span className="text-[12px] font-bold text-slate-700">{review.rating}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-[13px] md:text-[14px] text-slate-600 leading-relaxed">
                      &ldquo;{review.content}&rdquo;
                    </p>
                    <p className="mt-2 text-[11px] text-slate-400 text-right">
                      {new Date(review.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
