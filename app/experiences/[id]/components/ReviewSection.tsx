'use client';

import React, { useState, useEffect } from 'react';
import { Star, X, Reply } from 'lucide-react'; // Reply 아이콘 추가
import { createClient } from '@/app/utils/supabase/client';
import Image from 'next/image';

interface ReviewSectionProps {
  experienceId: number;
  hostName: string;
}

export default function ReviewSection({ experienceId, hostName }: ReviewSectionProps) {
  const supabase = createClient();
  const [reviews, setReviews] = useState<any[]>([]);
  const [isReviewsExpanded, setIsReviewsExpanded] = useState(false);
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
        const userIds = Array.from(new Set(reviewsData.map((r: any) => r.user_id)));

        // 3. 프로필 가져오기
        const { data: profilesData, error: profileError } = await supabase
          .from('profiles')
          .select('*') 
          .in('id', userIds);

        if (profileError) console.error("프로필 조회 에러:", profileError);

        // 4. 데이터 합치기
        const profileMap = new Map(profilesData?.map((p: any) => [p.id, p]));

        const combinedReviews = reviewsData.map((review: any) => {
          const userProfile = profileMap.get(review.user_id);
          
          let displayName = '익명 게스트';
          let avatarUrl = null;

          if (userProfile) {
             displayName = userProfile.full_name || userProfile.name || userProfile.username || userProfile.email?.split('@')[0] || '게스트';
             avatarUrl = userProfile.avatar_url;
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
    <div id="reviews" className="border-b border-slate-200 pb-8 scroll-mt-24">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <Star size={20} fill="black"/> {averageRating} · 후기 {reviews.length}개
      </h3>
      
      {/* 1. 요약 리스트 (최대 4개) */}
      {reviews.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
          {reviews.slice(0, 4).map((review) => {
            const avatarUrl = secureUrl(review.user?.avatar_url);
            
            return (
              <div key={review.id} className="flex flex-col h-full">
                {/* 유저 정보 */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden relative shrink-0">
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

                {/* 리뷰 내용 */}
                <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mb-3">
                  {review.content}
                </p>

                {/* 🟢 [추가됨] 요약 리스트에서도 답글 표시 */}
                {review.reply && (
                  <div className="mt-auto pt-3 border-t border-slate-100">
                    <div className="flex gap-2 items-start bg-slate-50 p-3 rounded-lg">
                      <Reply size={14} className="text-slate-400 shrink-0 mt-0.5 -scale-x-100"/>
                      <div>
                        <div className="font-bold text-xs text-slate-900 mb-0.5">호스트의 답글</div>
                        <p className="text-xs text-slate-600 line-clamp-2">{review.reply}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-slate-400 text-sm py-4 bg-slate-50 rounded-xl text-center border border-dashed border-slate-200">
          아직 작성된 후기가 없습니다. 첫 후기를 남겨보세요!
        </div>
      )}
      
      {/* 2. 모달 열기 버튼 */}
      {reviews.length > 4 && (
        <button onClick={() => setIsReviewsExpanded(true)} className="mt-8 px-6 py-3 border border-black rounded-xl font-bold hover:bg-slate-50 transition-colors w-full md:w-auto">
          후기 {reviews.length}개 모두 보기
        </button>
      )}

      {/* 3. 후기 전체보기 모달 */}
      {isReviewsExpanded && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsReviewsExpanded(false)}>
          <div className="bg-white w-full max-w-4xl h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            {/* 모달 헤더 */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Star size={18} fill="black"/> {averageRating} (후기 {reviews.length}개)
              </h3>
              <button onClick={() => setIsReviewsExpanded(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
            </div>

            {/* 모달 내용 (스크롤) */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50">
              <div className="grid grid-cols-1 gap-6">
                {reviews.map((review) => {
                  const avatarUrl = secureUrl(review.user?.avatar_url);

                  return (
                    <div key={review.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <div className="flex gap-4">
                        {/* 유저 아바타 */}
                        <div className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden relative shrink-0 border border-slate-100">
                           {avatarUrl ? (
                             <Image src={avatarUrl} alt="user" fill className="object-cover"/>
                           ) : <div className="w-full h-full bg-slate-300 flex items-center justify-center text-xs text-slate-500">?</div>}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* 유저 이름 & 날짜 & 별점 */}
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-bold text-sm text-slate-900">{review.user.name}</div>
                              <div className="text-xs text-slate-500">{formatDate(review.created_at)}</div>
                            </div>
                            <div className="flex text-amber-400">
                              {[...Array(5)].map((_, idx) => (
                                <Star key={idx} size={14} fill={idx < review.rating ? "currentColor" : "none"} className={idx < review.rating ? "" : "text-slate-200"}/>
                              ))}
                            </div>
                          </div>

                          {/* 리뷰 본문 */}
                          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap mb-4">
                            {review.content}
                          </p>

                          {/* 사진 갤러리 */}
                          {review.photos && review.photos.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                              {review.photos.map((photo: string, idx: number) => (
                                <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                                  <Image src={secureUrl(photo) || photo} alt={`review-img-${idx}`} fill className="object-cover"/>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 🟢 [추가됨] 답글 표시 영역 */}
                          {review.reply && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-3">
                               <div className="shrink-0 mt-0.5">
                                 <Reply size={16} className="text-slate-400 -scale-x-100" />
                               </div>
                               <div>
                                 <div className="flex items-center gap-2 mb-1">
                                   <span className="text-sm font-bold text-slate-900">호스트의 답글</span>
                                   <span className="text-xs text-slate-400">
                                     {review.reply_at ? formatDate(review.reply_at) : ''}
                                   </span>
                                 </div>
                                 <p className="text-sm text-slate-600 leading-relaxed">{review.reply}</p>
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
    </div>
  );
}