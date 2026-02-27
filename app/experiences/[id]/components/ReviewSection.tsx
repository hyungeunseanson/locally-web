'use client';

import React, { useState, useEffect } from 'react';
import { Star, X, Reply } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import Image from 'next/image';

interface ReviewSectionProps {
  experienceId: number;
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
  const [reviews, setReviews] = useState<ReviewView[]>([]);
  const [isReviewsExpanded, setIsReviewsExpanded] = useState(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
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
          
          let displayName = '익명 게스트';
          let avatarUrl = null;

          if (userProfile) {
             displayName = userProfile.full_name || userProfile.name || userProfile.username || userProfile.email?.split('@')[0] || '게스트';
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
  }, [experienceId, supabase]);

  if (loading) return <div className="py-10 text-center text-slate-400">후기를 불러오는 중...</div>;

  return (
    <div id="reviews" className="border-b border-slate-200 pb-8 md:pb-10 scroll-mt-24">
      <h3 className="text-[18px] md:text-[28px] font-semibold tracking-[-0.01em] mb-5 flex items-center gap-1.5">
        <Star size={15} fill="black"/> {averageRating} · 후기 {reviews.length}개
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
                        <div className="text-[11px] font-bold text-slate-800 mb-1">호스트 답글</div>
                        <p className="text-[11px] text-slate-600 line-clamp-2">{review.reply}</p>
                      </div>
                    )}
                    <button onClick={() => setIsReviewsExpanded(true)} className="text-[12px] font-semibold underline underline-offset-2 mt-2">
                      더 보기
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
          아직 작성된 후기가 없습니다. {hostName} 체험의 첫 후기를 남겨보세요.
        </div>
      )}
      
      {reviews.length > 0 && (
        <button onClick={() => setIsReviewsExpanded(true)} className="mt-5 w-full rounded-2xl bg-[#ececec] py-3 text-[13px] md:text-[15px] font-medium text-slate-700 hover:bg-[#e5e5e5] transition-colors">
          모든 후기 보기
        </button>
      )}
      <button onClick={() => setIsPolicyOpen(true)} className="w-full text-center text-[11px] text-slate-400 mt-3 underline underline-offset-2">후기 운영 방식 알아보기</button>

      {isReviewsExpanded && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsReviewsExpanded(false)}>
          <div className="bg-white w-full max-w-[760px] h-[74vh] md:h-[82vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <h3 className="font-semibold text-[14px] md:text-base flex items-center gap-2">
                <Star size={15} fill="black"/> {averageRating} (후기 {reviews.length}개)
              </h3>
              <button onClick={() => setIsReviewsExpanded(false)} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"><X size={18}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
              <div className="grid grid-cols-1 gap-4">
                {reviews.map((review) => {
                  const avatarUrl = secureUrl(review.user?.avatar_url);

                  return (
                    <div key={review.id} className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex gap-3">
                        <div className="w-8 h-8 md:w-9 md:h-9 bg-slate-200 rounded-full overflow-hidden relative shrink-0 border border-slate-100">
                           {avatarUrl ? (
                             <Image src={avatarUrl} alt="user" fill className="object-cover"/>
                           ) : <div className="w-full h-full bg-slate-300 flex items-center justify-center text-xs text-slate-500">?</div>}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1.5">
                            <div>
                              <div className="font-semibold text-[12px] md:text-sm text-slate-900">{review.user.name}</div>
                              <div className="text-[10px] md:text-xs text-slate-500">{formatDate(review.created_at)}</div>
                            </div>
                            <div className="flex text-amber-400">
                              {[...Array(5)].map((_, idx) => (
                                <Star key={idx} size={11} fill={idx < review.rating ? "currentColor" : "none"} className={idx < review.rating ? "" : "text-slate-200"}/>
                              ))}
                            </div>
                          </div>

                          <p className="text-[12px] md:text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap mb-3">
                            {review.content}
                          </p>

                          {review.photos && review.photos.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                              {review.photos.map((photo: string, idx: number) => (
                                <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                                  <Image src={secureUrl(photo) || photo} alt={`review-img-${idx}`} fill className="object-cover"/>
                                </div>
                              ))}
                            </div>
                          )}

                          {review.reply && (
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex gap-2.5">
                               <div className="shrink-0 mt-0.5">
                                 <Reply size={14} className="text-slate-400 -scale-x-100" />
                               </div>
                               <div>
                                 <div className="flex items-center gap-2 mb-1">
                                   <span className="text-[11px] md:text-xs font-semibold text-slate-900">호스트의 답글</span>
                                   <span className="text-[10px] md:text-xs text-slate-400">
                                     {review.reply_at ? formatDate(review.reply_at) : ''}
                                   </span>
                                 </div>
                                 <p className="text-[11px] md:text-xs text-slate-600 leading-relaxed">{review.reply}</p>
                               </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
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
            <h4 className="text-[15px] font-semibold mb-3">후기 운영 방식</h4>
            <div className="space-y-2 text-[12px] text-slate-600 leading-relaxed">
              <p>체험에 실제 참여한 게스트만 후기를 작성할 수 있습니다.</p>
              <p>후기는 자동 필터와 운영 정책 검수를 거쳐 노출됩니다.</p>
              <p>욕설, 혐오 표현, 광고성 문구는 노출이 제한될 수 있습니다.</p>
              <p>호스트는 후기에 답글을 달 수 있지만 원문을 수정할 수는 없습니다.</p>
            </div>
            <button onClick={() => setIsPolicyOpen(false)} className="mt-4 w-full rounded-xl bg-slate-100 py-2.5 text-[12px] font-medium text-slate-700 hover:bg-slate-200">
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
