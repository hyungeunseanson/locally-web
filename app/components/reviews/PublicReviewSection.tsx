'use client';

import Image from 'next/image';
import React, { useEffect, useMemo, useState } from 'react';
import { Star, X } from 'lucide-react';

import { useLanguage } from '@/app/context/LanguageContext';
import { createClient } from '@/app/utils/supabase/client';

type ReviewSourceProps =
  | {
      experienceId: number | string;
      hostId?: never;
    }
  | {
      hostId: string;
      experienceId?: never;
    };

type ReviewSectionProps = ReviewSourceProps & {
  hostName: string;
  sectionId?: string;
  testId?: string;
};

type ProfileRow = {
  id: string;
  full_name?: string | null;
  name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

type ReviewRow = {
  id: number;
  user_id: string | null;
  rating: number;
  content: string | null;
  created_at: string;
  reply?: string | null;
  reply_at?: string | null;
  photos?: string[] | null;
};

type PublicReviewView = ReviewRow & {
  user: {
    name: string;
    avatar_url: string | null;
  };
};

type PublicReviewPayload = {
  success?: boolean;
  data?: ReviewRow[];
  error?: string;
};

function secureUrl(url: string | null) {
  if (!url) return null;
  if (url.startsWith('http://')) return url.replace('http://', 'https://');
  return url;
}

function formatDate(dateString: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}.`;
}

function getProfileDisplayName(profile: ProfileRow | undefined, fallbackLabel: string) {
  if (!profile) return fallbackLabel;

  return profile.full_name || profile.name || profile.username || fallbackLabel;
}

export default function PublicReviewSection(props: ReviewSectionProps) {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useLanguage();
  const guestLabel = t('exp_review_guest_label');
  const reviewHostId = 'hostId' in props ? props.hostId : null;
  const reviewExperienceId = 'experienceId' in props ? props.experienceId : null;
  const [reviews, setReviews] = useState<PublicReviewView[]>([]);
  const [isReviewsExpanded, setIsReviewsExpanded] = useState(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const fetchReviews = async () => {
      try {
        setLoading(true);

        let reviewRows: ReviewRow[] = [];

        if (reviewHostId) {
          const response = await fetch(`/api/public/hosts/${encodeURIComponent(reviewHostId)}/reviews`, {
            cache: 'no-store',
          });

          const result = (await response.json()) as PublicReviewPayload;
          if (!response.ok) {
            if (response.status === 404) {
              reviewRows = [];
            } else {
              throw new Error(result.error || 'Failed to load public host reviews.');
            }
          } else {
            reviewRows = result.data || [];
          }
        } else if (reviewExperienceId) {
          const { data, error } = await supabase
            .from('reviews')
            .select('id, user_id, rating, content, created_at, reply, reply_at, photos')
            .eq('experience_id', reviewExperienceId)
            .order('created_at', { ascending: false });

          if (error) throw error;
          reviewRows = (data as ReviewRow[] | null) || [];
        }

        if (!isActive) return;

        if (reviewRows.length === 0) {
          setReviews([]);
          return;
        }

        const userIds = Array.from(
          new Set(reviewRows.map((review) => review.user_id).filter((userId): userId is string => Boolean(userId)))
        );

        const { data: profilesData, error: profileError } = userIds.length > 0
          ? await supabase
              .from('profiles')
              .select('id, full_name, name, username, avatar_url')
              .in('id', userIds)
          : { data: [], error: null };

        if (profileError) {
          console.error('[PublicReviewSection] profile lookup failed:', profileError);
        }

        if (!isActive) return;

        const profileMap = new Map<string, ProfileRow>(
          ((profilesData as ProfileRow[] | null) || []).map((profile) => [profile.id, profile])
        );

        const combinedReviews: PublicReviewView[] = reviewRows.map((review) => {
          const profile = review.user_id ? profileMap.get(review.user_id) : undefined;
          return {
            ...review,
            user: {
              name: getProfileDisplayName(profile, guestLabel),
              avatar_url: profile?.avatar_url || null,
            },
          };
        });

        setReviews(combinedReviews);
      } catch (error) {
        console.error('[PublicReviewSection] review lookup failed:', error);
        if (isActive) setReviews([]);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    void fetchReviews();

    return () => {
      isActive = false;
    };
  }, [guestLabel, reviewExperienceId, reviewHostId, supabase]);

  const averageRating = reviews.length > 0
    ? (reviews.reduce((acc, cur) => acc + cur.rating, 0) / reviews.length).toFixed(2)
    : '0.0';
  const sortedReviews = [...reviews].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    return sortOrder === 'latest' ? timeB - timeA : timeA - timeB;
  });

  if (loading) {
    return <div className="py-10 text-center text-slate-400">{t('exp_review_loading')}</div>;
  }

  return (
    <div id={props.sectionId} data-testid={props.testId} className="pb-8 md:pb-10 scroll-mt-24">
      <h3 className="mb-5 flex items-center gap-1.5 text-[18px] font-semibold tracking-[-0.01em] md:text-[28px]">
        <Star size={15} fill="black" /> {averageRating} · {t('exp_review_count', { count: reviews.length })}
      </h3>

      {reviews.length > 0 ? (
        <>
          <div className="-mx-1 overflow-x-auto pb-2 md:hidden">
            <div className="flex min-w-max gap-3 px-1">
              {reviews.slice(0, 4).map((review) => {
                const avatarUrl = secureUrl(review.user.avatar_url);
                return (
                  <article key={review.id} className="w-[250px] border-r border-slate-200 pr-3">
                    <div className="mb-2.5 flex items-center gap-2.5">
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-200">
                        {avatarUrl ? (
                          <Image src={avatarUrl} alt="user" fill sizes="36px" className="object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-slate-300 text-xs text-slate-500">?</div>
                        )}
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-slate-900">{review.user.name}</div>
                        <div className="text-[11px] text-slate-500">{formatDate(review.created_at)}</div>
                      </div>
                    </div>
                    <div className="mb-1.5 flex items-center gap-1 text-slate-700">
                      {[...Array(5)].map((_, idx) => (
                        <Star
                          key={idx}
                          size={11}
                          fill={idx < review.rating ? 'currentColor' : 'none'}
                          className={idx < review.rating ? '' : 'text-slate-300'}
                        />
                      ))}
                      <span className="ml-1 text-[11px]">{review.rating}.0</span>
                    </div>
                    <p className="mb-1.5 line-clamp-4 text-[12px] leading-[1.4] text-slate-700">{review.content || ''}</p>
                    {review.reply && (
                      <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <div className="mb-1 text-[11px] font-bold text-slate-800">{t('hr_host_reply')}</div>
                        <p className="line-clamp-2 text-[11px] text-slate-600">{review.reply}</p>
                      </div>
                    )}
                    <button
                      onClick={() => setIsReviewsExpanded(true)}
                      className="mt-2 text-[12px] font-semibold underline underline-offset-2"
                    >
                      {t('exp_review_more')}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="hidden grid-cols-2 gap-8 md:grid">
            {reviews.slice(0, 4).map((review) => {
              const avatarUrl = secureUrl(review.user.avatar_url);
              return (
                <article key={review.id} className="border-r border-slate-200 pr-6">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-slate-200">
                      {avatarUrl ? (
                        <Image src={avatarUrl} alt="user" fill sizes="44px" className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-300 text-xs text-slate-500">?</div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{review.user.name}</div>
                      <div className="text-xs text-slate-500">{formatDate(review.created_at)}</div>
                    </div>
                  </div>
                  <p className="line-clamp-4 text-sm leading-relaxed text-slate-600">{review.content || ''}</p>
                  {review.reply && (
                    <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="mb-1 text-xs font-bold text-slate-800">{t('hr_host_reply')}</div>
                      <p className="text-xs leading-relaxed text-slate-600">{review.reply}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-5 text-center text-[12px] text-slate-400">
          {t('exp_review_empty_title')}
          <br />
          {t('exp_review_empty_body', { hostName: props.hostName })}
        </div>
      )}

      {reviews.length > 0 && (
        <button
          onClick={() => setIsReviewsExpanded(true)}
          className="mt-5 w-full rounded-2xl bg-[#ececec] py-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-[#e5e5e5] md:text-[15px]"
        >
          {t('exp_review_view_all')}
        </button>
      )}
      <button
        onClick={() => setIsPolicyOpen(true)}
        className="mt-3 w-full text-center text-[11px] text-slate-400 underline underline-offset-2"
      >
        {t('exp_review_policy_link')}
      </button>

      {isReviewsExpanded && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsReviewsExpanded(false)}
        >
          <div
            className="flex h-[86dvh] w-full max-w-[380px] flex-col overflow-hidden rounded-[30px] bg-[#fcfcfc] shadow-2xl animate-in zoom-in-95 duration-200 md:h-[82vh] md:max-w-[760px] md:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-start px-5 pb-2 pt-4">
              <button
                onClick={() => setIsReviewsExpanded(false)}
                className="rounded-full p-1.5 text-slate-600 transition-colors hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 pb-2">
              <h3 className="flex items-center gap-1.5 text-[24px] font-semibold tracking-[-0.02em] md:text-[22px]">
                <Star size={18} fill="black" className="mb-0.5" />
                {averageRating}
              </h3>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[14px] font-medium tracking-[-0.01em]">
                  {t('exp_review_count', { count: reviews.length })}
                </p>
                <div className="relative">
                  <select
                    value={sortOrder}
                    onChange={(event) => setSortOrder(event.target.value as 'latest' | 'oldest')}
                    className="appearance-none rounded-full border border-slate-300 bg-white py-1.5 pl-3.5 pr-7 text-[10px] font-normal text-slate-700"
                  >
                    <option value="latest">{t('exp_review_sort_latest')}</option>
                    <option value="oldest">{t('exp_review_sort_oldest')}</option>
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                    ⌄
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-6">
              <div className="space-y-0">
                {sortedReviews.map((review) => {
                  const avatarUrl = secureUrl(review.user.avatar_url);

                  return (
                    <article key={review.id} className="border-b border-slate-200 py-4">
                      <div className="flex gap-3">
                        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-slate-100 bg-slate-200">
                          {avatarUrl ? (
                            <Image src={avatarUrl} alt="user" fill sizes="36px" className="object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-slate-300 text-xs text-slate-500">?</div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] leading-none text-slate-900 md:text-[11px]">
                            <div className="font-medium">{review.user.name}</div>
                            <div className="mt-1 text-[10px] text-slate-500 md:text-[10px]">
                              {t('exp_review_guest_label')}
                            </div>
                            <div className="mb-2 mt-2 flex items-center gap-1 text-slate-700">
                              {[...Array(5)].map((_, idx) => (
                                <Star
                                  key={idx}
                                  size={10}
                                  fill={idx < review.rating ? 'currentColor' : 'none'}
                                  className={idx < review.rating ? '' : 'text-slate-300'}
                                />
                              ))}
                              <span className="ml-1 text-[10px] text-slate-500">
                                {review.created_at
                                  ? t('exp_review_days_ago', {
                                      days: Math.max(
                                        1,
                                        Math.floor(
                                          (Date.now() - new Date(review.created_at).getTime()) / (1000 * 60 * 60 * 24)
                                        )
                                      ),
                                    })
                                  : ''}
                              </span>
                            </div>
                            <p className="mb-1.5 whitespace-pre-wrap text-[10px] font-normal leading-[1.45] text-slate-700 md:text-[10px]">
                              {review.content || ''}
                            </p>
                            {review.reply && (
                              <div className="mt-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                                <div className="mb-1 text-[10px] font-bold text-slate-800">{t('hr_host_reply')}</div>
                                <p className="whitespace-pre-wrap text-[10px] leading-[1.45] text-slate-600">
                                  {review.reply}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {isPolicyOpen && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onClick={() => setIsPolicyOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 className="mb-3 text-[15px] font-semibold">{t('exp_review_policy_title')}</h4>
            <div className="space-y-2 text-[12px] leading-relaxed text-slate-600">
              <p>{t('exp_review_policy_line_1')}</p>
              <p>{t('exp_review_policy_line_2')}</p>
              <p>{t('exp_review_policy_line_3')}</p>
              <p>{t('exp_review_policy_line_4')}</p>
            </div>
            <button
              onClick={() => setIsPolicyOpen(false)}
              className="mt-4 w-full rounded-xl bg-slate-100 py-2.5 text-[12px] font-medium text-slate-700 hover:bg-slate-200"
            >
              {t('common_close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
