'use client';

import Image from 'next/image';
import React, { useEffect, useRef, useState } from 'react';
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

// ISO 2-letter country code → flag emoji
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  korea: 'KR', 'south korea': 'KR', japan: 'JP', china: 'CN', usa: 'US',
  'united states': 'US', america: 'US', taiwan: 'TW', hongkong: 'HK',
  'hong kong': 'HK', singapore: 'SG', thailand: 'TH', vietnam: 'VN',
  philippines: 'PH', indonesia: 'ID', malaysia: 'MY', india: 'IN',
  australia: 'AU', canada: 'CA', uk: 'GB', 'united kingdom': 'GB',
  france: 'FR', germany: 'DE', italy: 'IT', spain: 'ES', brazil: 'BR',
  mexico: 'MX', russia: 'RU', netherlands: 'NL', sweden: 'SE', norway: 'NO',
  denmark: 'DK', finland: 'FI', switzerland: 'CH', austria: 'AT',
  portugal: 'PT', greece: 'GR', turkey: 'TR', 'new zealand': 'NZ',
  한국: 'KR', 일본: 'JP', 중국: 'CN', 미국: 'US', 대만: 'TW', 홍콩: 'HK',
  싱가포르: 'SG', 태국: 'TH', 베트남: 'VN', 필리핀: 'PH', 인도네시아: 'ID',
  말레이시아: 'MY', 인도: 'IN', 호주: 'AU', 캐나다: 'CA', 영국: 'GB',
  프랑스: 'FR', 독일: 'DE', 이탈리아: 'IT', 스페인: 'ES', 브라질: 'BR',
  러시아: 'RU',
};

function toFlagEmoji(nationality: string): string {
  const trimmed = nationality.trim();
  let code = '';
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    code = trimmed.toUpperCase();
  } else {
    code = COUNTRY_NAME_TO_CODE[trimmed.toLowerCase()] ?? '';
  }
  if (!code) return trimmed; // fallback to original text
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

export default function GuestProfileModal({ guest, onClose }: Props) {
  const { t, lang } = useLanguage();
  // [Fix] supabase 인스턴스를 ref로 안정화 — 매 렌더마다 새 객체가 생성되어 useEffect가 반복 실행되는 버그 방지
  const supabaseRef = useRef(createClient());
  const [reviews, setReviews] = useState<GuestReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      if (!guest?.id) return;

      const { data, error } = await supabaseRef.current
        .from('guest_reviews')
        .select(`
          *,
          host:profiles!guest_reviews_host_id_fkey(full_name, avatar_url)
        `)
        .eq('guest_id', guest.id)
        .order('created_at', { ascending: false });

      // [Fix] 에러 무시 방지 — RLS 설정 문제로 데이터 없을 때 빈 후기로 오표시
      if (error) console.error('[GuestProfileModal] guest_reviews fetch error:', error);
      if (data) setReviews(data);
      setLoadingReviews(false);
    };
    fetchReviews();
  }, [guest]);

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
    ? t('joined_date').replace('{date}', new Date(guest.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : lang === 'ja' ? 'ja-JP' : lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long' }))
    : t('joined_date_unknown');

  const genderLabel = guest.gender ? formatGenderLabel(guest.gender) : null;
  const languageDisplay = languages.length > 0
    ? languages.map((lang: string) => t(`lang_${normalizeProfileLanguageValue(lang)}`)).join(', ')
    : null;

  // 2×2 attribute grid items — only render non-empty ones
  const gridItems = [
    genderLabel ? { icon: <Users size={14} />, label: t('label_gender'), value: genderLabel } : null,
    languageDisplay ? { icon: <Globe size={14} />, label: t('profile_lang'), value: languageDisplay } : null,
    guest.mbti ? { icon: <Smile size={14} />, label: t('label_mbti'), value: guest.mbti } : null,
    guest.job ? { icon: <Briefcase size={14} />, label: t('profile_job'), value: guest.job } : null,
  ].filter(Boolean) as Array<{ icon: React.ReactNode; label: string; value: string }>;

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 px-4 py-8 md:px-4 md:py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[78vh] md:max-h-[90vh] w-full max-w-[340px] md:max-w-[560px] flex-col overflow-hidden rounded-[24px] md:rounded-[28px] bg-white shadow-[0_8px_40px_rgba(15,23,42,0.22)] md:shadow-[0_24px_80px_rgba(15,23,42,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 프로필 헤더 */}
        <div className="relative border-b border-slate-100 bg-slate-50 px-4 pb-4 pt-4 md:px-6 md:pb-7 md:pt-8 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-3 md:top-4 inline-flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full bg-white/90 text-slate-500 transition-colors hover:text-slate-900"
          >
            <X size={17} />
          </button>

          <div className="flex items-center gap-3 md:gap-4">
            {/* 아바타 */}
            <div className="h-12 w-12 md:h-24 md:w-24 shrink-0 overflow-hidden rounded-full border-4 border-white bg-slate-200 shadow-lg flex items-center justify-center">
              {guest.avatar_url ? (
                <div className="relative h-full w-full">
                  <Image
                    src={guest.avatar_url}
                    alt={guest.full_name ?? 'Guest'}
                    fill
                    sizes="(max-width: 768px) 48px, 96px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <User size={18} className="text-slate-400 md:hidden" />
              )}
              {!guest.avatar_url && <User size={32} className="text-slate-400 hidden md:block" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] md:text-[11px] font-bold text-white">
                  {t('tab_guest').split(' ')[0]}
                </span>
                <span className="text-[10px] md:text-[12px] font-medium text-slate-400">
                  {joinedAt}
                </span>
              </div>
              <h2 className="break-words text-[17px] md:text-[24px] font-black text-slate-900 [overflow-wrap:anywhere] flex items-center gap-1.5 flex-wrap">
                {guest.full_name}
                {guest.nationality && (
                  <span className="text-[18px] md:text-[22px] leading-none" title={guest.nationality}>
                    {toFlagEmoji(guest.nationality)}
                  </span>
                )}
              </h2>
            </div>
          </div>
        </div>

        {/* 스크롤 본문 */}
        <div className="overflow-y-auto px-3 py-4 md:px-6 md:py-6 custom-scrollbar flex-1">

          {/* 속성 그리드 */}
          {gridItems.length > 0 && (
            <div className="mb-6 grid grid-cols-2 gap-3">
              {gridItems.map((item) => (
                <div key={item.label} className="rounded-xl md:rounded-2xl bg-slate-50 p-3 md:p-4">
                  <div className="mb-1.5 flex items-center gap-1.5 text-slate-500">
                    {item.icon}
                    <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.14em]">{item.label}</span>
                  </div>
                  <p className="break-words text-[12px] md:text-sm font-semibold text-slate-800 [overflow-wrap:anywhere]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* About */}
          <section className="mb-6 md:mb-8">
            <h3 className="mb-2 md:mb-3 text-[10px] md:text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{t('profile_about')}</h3>
            <div className="rounded-2xl md:rounded-3xl bg-slate-50 p-4 md:p-5 text-[13px] md:text-[15px] leading-6 md:leading-7 text-slate-700">
              <p className="break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
                {guest.introduction || guest.bio || t('guest_modal_intro_empty')}
              </p>
            </div>
          </section>

          {/* 받은 후기 */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Star size={14} className="text-slate-900 md:w-4 md:h-4" fill="currentColor" />
              <h3 className="text-[14px] md:text-[16px] font-bold text-slate-900">
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
                  <div key={review.id} className="rounded-2xl md:rounded-3xl border border-slate-100 px-3 py-3 md:px-4 md:py-4 transition-colors hover:border-slate-200 hover:bg-slate-50">
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
                      {new Date(review.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : lang === 'ja' ? 'ja-JP' : lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
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
