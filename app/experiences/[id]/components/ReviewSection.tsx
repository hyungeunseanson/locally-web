'use client';

import React, { useState, useEffect } from 'react';
import { Star, X } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import Image from 'next/image';
import { useLanguage } from '@/app/context/LanguageContext';

interface ReviewSectionProps {
  experienceId: number | string;
  hostName: string;
}

type ProfileRow = {
  id: string;
  full_name?: string | null;
  name?: string | null;
  username?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

type ReviewRow = {
  id: number;
  user_id: string;
  rating: number;
  content: string;
  created_at: string;
  reply?: string | null;
  reply_at?: string | null;
  photos?: string[] | null;
};

type ReviewView = ReviewRow & {
  user: {
    name: string;
    avatar_url: string | null;
  };
};

export default function ReviewSection({ experienceId, hostName }: ReviewSectionProps) {
  const supabase = createClient();
  const { t } = useLanguage();
  const guestLabel = t('exp_review_guest_label');
  const [reviews, setReviews] = useState<ReviewView[]>([]);
  const [isReviewsExpanded, setIsReviewsExpanded] = useState(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest');
  const [loading, setLoading] = useState(true);

  // 🟢 [보안] http 이미지를 https로 강제 변환
  const secureUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith('http://')) return url.replace('http://', 'https://');
    return url;
  };

  // 날짜 포맷터
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}.`;
  };

  // 평점 계산
  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc, cur) => acc + cur.rating, 0) / reviews.length).toFixed(2) 
    : "0.0";
  const sortedReviews = [...reviews].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    return sortOrder === 'latest' ? timeB - timeA : timeA - timeB;
  });

  useEffect(() => {
    const fetchReviews = async () => {
      if (!experienceId) return;
      
      try {
        setLoading(true);
        // 1. 후기 데이터 가져오기
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select('*')
          .eq('experience_id', experienceId)
          .order('created_at', { ascending: false });

        if (reviewsError) throw reviewsError;

        if (!reviewsData || reviewsData.length === 0) {
          setReviews([]);
          setLoading(false);
          return;
        }

        // 2. 작성자 ID 추출
        const typedReviews = (reviewsData || []) as ReviewRow[];
        const userIds = Array.from(new Set(typedReviews.map((r) => r.user_id)));

        // 3. 프로필 가져오기
        const { data: profilesData, error: profileError } = await supabase
          .from('profiles')
          .select('*') 
          .in('id', userIds);

        if (profileError) console.error("프로필 조회 에러:", profileError);

        // 4. 데이터 합치기
        const profileMap = new Map((profilesData as ProfileRow[] | null)?.map((p) => [p.id, p]));

        const combinedReviews: ReviewView[] = typedReviews.map((review) => {
          const userProfile = profileMap.get(review.user_id);
          
          let displayName = guestLabel;
          let avatarUrl = null;

          if (userProfile) {
             displayName = userProfile.full_name || userProfile.name || userProfile.username || userProfile.email?.split('@')[0] || guestLabel;
             avatarUrl = userProfile.avatar_url || null;
          }

          return {
            ...review,
            user: {
              name: displayName,
              avatar_url: avatarUrl
            }
          };
        });

        setReviews(combinedReviews);

      } catch (err) {
        console.error("후기 로딩 실패:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [experienceId, guestLabel, supabase]);

  if (loading) return <div className="py-10 text-center text-slate-400">{t('exp_review_loading')}</div>;

  return (
    <div id="reviews" className="border-b border-slate-200 pb-8 md:pb-10 scroll-mt-24">
      <h3 className="text-[18px] md:text-[28px] font-semibold tracking-[-0.01em] mb-5 flex items-center gap-1.5">
        <Star size={15} fill="black"/> {averageRating} · {t('exp_review_count', { count: reviews.length })}
      </h3>
      
      {reviews.length > 0 ? (
        <>
          <div className="md:hidden -mx-1 overflow-x-auto pb-2">
            <div className="flex gap-3 px-1 min-w-max">
              {reviews.slice(0, 4).map((review) => {
                const avatarUrl = secureUrl(review.user?.avatar_url);
                return (
                  <article key={review.id} className="w-[250px] border-r border-slate-200 pr-3">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="w-9 h-9 bg-slate-200 rounded-full overflow-hidden relative shrink-0">
                        {avatarUrl ? (
                          <Image src={avatarUrl} alt="user" fill className="object-cover"/>
                        ) : (
                          <div className="w-full h-full bg-slate-300 flex items-center justify-center text-xs text-slate-500">?</div>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-[13px] text-slate-900">{review.user.name}</div>
                        <div className="text-[11px] text-slate-500">{formatDate(review.created_at)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-slate-700 mb-1.5">
                      {[...Array(5)].map((_, idx) => (
                        <Star key={idx} size={11} fill={idx < review.rating ? "currentColor" : "none"} className={idx < review.rating ? "" : "text-slate-300"} />
                      ))}
                      <span className="text-[11px] ml-1">{review.rating}.0</span>
                    </div>
                    <p className="text-[12px] text-slate-700 leading-[1.4] line-clamp-4 mb-1.5">{review.content}</p>
                    {review.reply && (
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2">
                        <div className="text-[11px] font-bold text-slate-800 mb-1">{t('hr_host_reply')}</div>
                        <p className="text-[11px] text-slate-600 line-clamp-2">{review.reply}</p>
                      </div>
                    )}
                    <button onClick={() => setIsReviewsExpanded(true)} className="text-[12px] font-semibold underline underline-offset-2 mt-2">
                      {t('exp_review_more')}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="hidden md:grid grid-cols-2 gap-8">
            {reviews.slice(0, 4).map((review) => {
              const avatarUrl = secureUrl(review.user?.avatar_url);
              return (
                <article key={review.id} className="border-r border-slate-200 pr-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 bg-slate-200 rounded-full overflow-hidden relative shrink-0">
                      {avatarUrl ? (
                        <Image src={avatarUrl} alt="user" fill className="object-cover"/>
                      ) : (
                        <div className="w-full h-full bg-slate-300 flex items-center justify-center text-xs text-slate-500">?</div>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900">{review.user.name}</div>
                      <div className="text-xs text-slate-500">{formatDate(review.created_at)}</div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed line-clamp-4">{review.content}</p>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className="text-slate-400 text-[12px] py-5 bg-slate-50 rounded-xl text-center border border-dashed border-slate-200">
          {t('exp_review_empty_title')}
          <br />
          {t('exp_review_empty_body', { hostName })}
        </div>
      )}
      
      {reviews.length > 0 && (
        <button onClick={() => setIsReviewsExpanded(true)} className="mt-5 w-full rounded-2xl bg-[#ececec] py-3 text-[13px] md:text-[15px] font-medium text-slate-700 hover:bg-[#e5e5e5] transition-colors">
          {t('exp_review_view_all')}
        </button>
      )}
      <button onClick={() => setIsPolicyOpen(true)} className="w-full text-center text-[11px] text-slate-400 mt-3 underline underline-offset-2">{t('exp_review_policy_link')}</button>

      {isReviewsExpanded && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsReviewsExpanded(false)}>
          <div className="w-full max-w-[380px] md:max-w-[760px] h-[86dvh] md:h-[82vh] bg-[#fcfcfc] rounded-[30px] md:rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-4 pb-2 flex justify-start">
              <button onClick={() => setIsReviewsExpanded(false)} className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-full transition-colors"><X size={18}/></button>
            </div>

            <div className="px-5 pb-2">
              <h3 className="text-[24px] md:text-[22px] font-semibold tracking-[-0.02em] flex items-center gap-1.5">
                <Star size={18} fill="black" className="mb-0.5" />
                {averageRating}
              </h3>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[14px] md:text-[14px] font-medium tracking-[-0.01em]">{t('exp_review_count', { count: reviews.length })}</p>
                <div className="relative">
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'latest' | 'oldest')}
                    className="appearance-none rounded-full border border-slate-300 bg-white pl-3.5 pr-7 py-1.5 text-[10px] font-normal text-slate-700"
                  >
                    <option value="latest">{t('exp_review_sort_latest')}</option>
                    <option value="oldest">{t('exp_review_sort_oldest')}</option>
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">⌄</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-6">
              <div className="space-y-0">
                {sortedReviews.map((review) => {
                  const avatarUrl = secureUrl(review.user?.avatar_url);

                  return (
                    <article key={review.id} className="border-b border-slate-200 py-4">
                      <div className="flex gap-3">
                        <div className="w-9 h-9 bg-slate-200 rounded-full overflow-hidden relative shrink-0 border border-slate-100">
                           {avatarUrl ? (
                             <Image src={avatarUrl} alt="user" fill className="object-cover"/>
                           ) : <div className="w-full h-full bg-slate-300 flex items-center justify-center text-xs text-slate-500">?</div>}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div>
                            <div className="font-medium text-[11px] md:text-[11px] text-slate-900 leading-none">{review.user.name}</div>
                            <div className="text-[10px] md:text-[10px] text-slate-500 mt-1">{t('exp_review_guest_label')}</div>
                            <div className="flex items-center gap-1 text-slate-700 mt-2 mb-2">
                              {[...Array(5)].map((_, idx) => (
                                <Star key={idx} size={10} fill={idx < review.rating ? "currentColor" : "none"} className={idx < review.rating ? "" : "text-slate-300"} />
                              ))}
                              <span className="text-[10px] text-slate-500 ml-1">
                                {review.created_at
                                  ? t('exp_review_days_ago', {
                                      days: Math.max(1, Math.floor((Date.now() - new Date(review.created_at).getTime()) / (1000 * 60 * 60 * 24))),
                                    })
                                  : ''}
                              </span>
                            </div>
                            <p className="text-[10px] md:text-[10px] font-normal text-slate-700 leading-[1.45] whitespace-pre-wrap mb-1.5">
                              {review.content}
                            </p>
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
        <div className="fixed inset-0 z-[210] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsPolicyOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-[15px] font-semibold mb-3">{t('exp_review_policy_title')}</h4>
            <div className="space-y-2 text-[12px] text-slate-600 leading-relaxed">
              <p>{t('exp_review_policy_line_1')}</p>
              <p>{t('exp_review_policy_line_2')}</p>
              <p>{t('exp_review_policy_line_3')}</p>
              <p>{t('exp_review_policy_line_4')}</p>
            </div>
            <button onClick={() => setIsPolicyOpen(false)} className="mt-4 w-full rounded-xl bg-slate-100 py-2.5 text-[12px] font-medium text-slate-700 hover:bg-slate-200">
              {t('common_close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
