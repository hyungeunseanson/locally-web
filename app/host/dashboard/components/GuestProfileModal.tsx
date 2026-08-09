'use client';

import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { useModalClose } from '@/app/hooks/useModalClose';
import { User, X, Star, Globe, Smile, MessageCircle, Briefcase, Users, Calendar } from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';
import { normalizeLanguageList, normalizeProfileLanguageValue } from '@/app/utils/profile';
import type { LocallyMembershipStatus } from '@/app/utils/memberStatus';
import HostGuestMembershipBadge from './HostGuestMembershipBadge';
import { formatAgeBand, formatDemographicGender, isDemographicGender } from '@/app/utils/demographics';

interface GuestModalProfile {
  id: string | number;
  full_name?: string | null;
  avatar_url?: string | null;
  nationality?: string | null;
  job?: string | null;
  gender?: string | null;
  age_band?: string | null;
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
  membershipStatus?: LocallyMembershipStatus;
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

export default function GuestProfileModal({ guest, membershipStatus = 'none', onClose }: Props) {
  const { visible, closing, requestClose } = useModalClose(!!guest, onClose);
  const { t, lang } = useLanguage();
  const [reviews, setReviews] = useState<GuestReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  useEffect(() => {
    let isActive = true;

    const fetchReviews = async () => {
      if (!guest?.id) {
        if (isActive) {
          setReviews([]);
          setLoadingReviews(false);
        }
        return;
      }

      setLoadingReviews(true);
      setReviews([]);

      try {
        const response = await fetch(`/api/host/guests/${encodeURIComponent(String(guest.id))}/reviews`, {
          cache: 'no-store',
        });
        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.error || 'Failed to load guest reviews');
        }

        if (isActive) {
          setReviews((result.data as GuestReview[] | undefined) || []);
        }
      } catch (error) {
        console.error('[GuestProfileModal] guest_reviews fetch error:', error);
        if (isActive) {
          setReviews([]);
        }
      } finally {
        if (isActive) {
          setLoadingReviews(false);
        }
      }
    };

    void fetchReviews();

    return () => {
      isActive = false;
    };
  }, [guest?.id]);

  useEffect(() => {
    if (!guest) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [guest]);

  if (!guest || !visible) return null;

  const languages = normalizeLanguageList(guest.languages);
  const joinedAt = guest.created_at
    ? t('joined_date').replace('{date}', new Date(guest.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : lang === 'ja' ? 'ja-JP' : lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long' }))
    : t('joined_date_unknown');

  const genderLabel = isDemographicGender(guest.gender)
    ? formatDemographicGender(guest.gender, lang)
    : null;
  const ageBandLabel = formatAgeBand(guest.age_band, lang);
  const ageBandHeading = lang === 'ko'
    ? '예약 대표자 연령대'
    : lang === 'ja'
      ? '予約代表者の年代'
      : lang === 'zh'
        ? '预订代表年龄段'
        : 'Booker age range';
  const languageDisplay = languages.length > 0
    ? languages.map((lang: string) => t(`lang_${normalizeProfileLanguageValue(lang)}`)).join(', ')
    : null;
  const showMembershipBadge = membershipStatus === 'member' || membershipStatus === 'circle';
  const membershipDescription =
    membershipStatus === 'circle'
      ? t('host_guest_membership_circle_desc')
      : membershipStatus === 'member'
        ? t('host_guest_membership_member_desc')
        : null;

  // 2×2 attribute grid items — only render non-empty ones
  const gridItems = [
    ageBandLabel ? { icon: <Calendar size={14} />, label: ageBandHeading, value: ageBandLabel } : null,
    genderLabel ? { icon: <Users size={14} />, label: t('label_gender'), value: genderLabel } : null,
    languageDisplay ? { icon: <Globe size={14} />, label: t('profile_lang'), value: languageDisplay } : null,
    guest.mbti ? { icon: <Smile size={14} />, label: t('label_mbti'), value: guest.mbti } : null,
    guest.job ? { icon: <Briefcase size={14} />, label: t('profile_job'), value: guest.job } : null,
  ].filter(Boolean) as Array<{ icon: React.ReactNode; label: string; value: string }>;

  return (
    <div
      className={`fixed inset-0 z-[160] flex items-center justify-center bg-black/60 px-3 py-6 md:px-4 md:py-6 backdrop-blur-sm transition-opacity duration-150 ${closing ? 'opacity-0' : 'animate-in fade-in duration-200'}`}
      onClick={requestClose}
    >
      <div
        className={`flex max-h-[82vh] md:max-h-[90vh] w-full max-w-[356px] md:max-w-[560px] flex-col overflow-hidden rounded-[28px] md:rounded-[28px] bg-white shadow-[0_18px_60px_rgba(15,23,42,0.22)] md:shadow-[0_24px_80px_rgba(15,23,42,0.28)] transition-all duration-150 ${closing ? 'opacity-0 scale-95' : 'animate-in zoom-in-95 duration-200'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 프로필 헤더 */}
        <div className="relative flex-shrink-0 border-b border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.96)_0%,#ffffff_100%)] px-5 pb-5 pt-5 md:px-6 md:pb-7 md:pt-8">
          <button
            type="button"
            onClick={requestClose}
            aria-label="프로필 모달 닫기"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-400 shadow-sm transition-colors hover:text-slate-900 md:top-4 md:h-10 md:w-10"
          >
            <X size={17} />
          </button>

          <div className="flex items-start gap-3.5 pr-12 md:gap-4 md:pr-12">
            {/* 아바타 */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-slate-200 shadow-[0_10px_24px_rgba(148,163,184,0.18)] md:h-24 md:w-24 md:border-4 md:shadow-lg">
              {guest.avatar_url ? (
                <div className="relative h-full w-full">
                  <Image
                    src={guest.avatar_url}
                    alt={guest.full_name ?? 'Guest'}
                    fill
                    sizes="(max-width: 768px) 56px, 96px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <User size={20} className="text-slate-400 md:hidden" />
              )}
              {!guest.avatar_url && <User size={32} className="text-slate-400 hidden md:block" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-bold text-white md:text-[11px]">
                  {t('tab_guest').split(' ')[0]}
                </span>
                {showMembershipBadge && (
                  <HostGuestMembershipBadge
                    testId="guest-profile-membership-badge"
                    status={membershipStatus as Extract<LocallyMembershipStatus, 'member' | 'circle'>}
                    className="border-slate-200/90 bg-white/95 shadow-sm"
                  />
                )}
              </div>
              <h2 className="flex flex-wrap items-center gap-1.5 break-words text-[18px] font-black leading-tight tracking-[-0.03em] text-slate-900 [overflow-wrap:anywhere] md:text-[24px]">
                {guest.full_name}
                {guest.nationality && (
                  <span className="text-[18px] md:text-[22px] leading-none" title={guest.nationality}>
                    {toFlagEmoji(guest.nationality)}
                  </span>
                )}
              </h2>
              <p className="mt-1.5 text-[11px] font-medium text-slate-400 md:text-[12px]">
                {joinedAt}
              </p>
              {membershipDescription && (
                <p
                  data-testid="guest-profile-membership-desc"
                  className="mt-2.5 text-[13px] font-medium leading-5 text-slate-500 md:text-[13px]"
                >
                  {membershipDescription}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 스크롤 본문 */}
        <div 
          className="custom-scrollbar flex-1 overflow-y-auto px-5 pb-6 pt-5 md:px-6 md:py-6" 
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        >

          {/* 속성 그리드 */}
          {gridItems.length > 0 && (
            <div className="mb-5 grid grid-cols-1 gap-2.5 md:mb-6 md:grid-cols-2 md:gap-3">
              {gridItems.map((item) => (
                <div key={item.label} className="rounded-[18px] border border-slate-100 bg-slate-50/90 px-3.5 py-3 md:rounded-2xl md:p-4">
                  <div className="mb-1.5 flex items-center gap-1.5 text-slate-500">
                    {item.icon}
                    <span className="text-[11px] font-semibold text-slate-500 md:text-[11px] md:font-bold md:uppercase md:tracking-[0.14em]">{item.label}</span>
                  </div>
                  <p className="break-words text-[14px] font-semibold leading-5 text-slate-800 [overflow-wrap:anywhere] md:text-sm">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* About */}
          <section className="mb-5 md:mb-8">
            <h3 className="mb-2.5 text-[11px] font-semibold tracking-[0.08em] text-slate-400 md:mb-3 md:text-[11px] md:font-bold md:uppercase md:tracking-[0.14em]">{t('profile_about')}</h3>
            <div className="rounded-[22px] bg-slate-50 px-4 py-4 text-[14px] leading-[1.65] text-slate-700 md:rounded-3xl md:p-5 md:text-[15px] md:leading-7">
              <p className="break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
                {guest.introduction || guest.bio || t('guest_modal_intro_empty')}
              </p>
            </div>
          </section>

          {/* 받은 후기 */}
          <section data-testid="guest-profile-reviews-section">
            <div className="mb-3 flex items-center gap-2">
              <Star size={14} className="text-slate-900 md:h-4 md:w-4" fill="currentColor" />
              <h3 className="text-[15px] font-black text-slate-900 md:text-[16px]">
                {t('guest_modal_reviews')} ({reviews.length})
              </h3>
            </div>

            {loadingReviews ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-[24px] bg-slate-50 md:rounded-3xl" />
                ))}
              </div>
            ) : reviews.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-7 text-center md:rounded-3xl md:py-8">
                <MessageCircle size={22} className="mx-auto mb-2 text-slate-300 md:h-6 md:w-6" />
                <p className="text-[14px] text-slate-400 md:text-sm">{t('guest_modal_no_reviews')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    data-testid="guest-profile-review-item"
                    className="rounded-[22px] border border-slate-100 px-3.5 py-3.5 transition-colors hover:border-slate-200 hover:bg-slate-50 md:rounded-3xl md:px-4 md:py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-slate-200">
                          {review.host?.avatar_url ? (
                            <div className="relative h-full w-full">
                              <Image
                                src={review.host.avatar_url}
                                alt=""
                                fill
                                sizes="28px"
                                className="object-cover"
                              />
                            </div>
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
