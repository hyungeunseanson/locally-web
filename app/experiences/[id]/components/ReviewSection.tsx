'use client';

import React, { useState, useEffect } from 'react';
import { Star, X } from 'lucide-react';
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

  // 평점 계산
  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc, cur) => acc + cur.rating, 0) / reviews.length).toFixed(2) 
    : "0.0";

  useEffect(() => {
    const fetchReviews = async () => {
      if (!experienceId) return;
      
      try {
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

        // 2. 작성자 ID 추출 및 프로필 정보 가져오기
        const userIds = Array.from(new Set(reviewsData.map((r: any) => r.user_id)));
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, full_name') // 필요한 정보만 쏙
          .in('id', userIds);

        // 3. 데이터 합치기
        const profileMap = new Map(profilesData?.map((p: any) => [p.id, p]));

        const combinedReviews = reviewsData.map((review: any) => ({
          ...review,
          user: profileMap.get(review.user_id) || { name: '알 수 없음', avatar_url: null }
        }));

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
          {reviews.slice(0, 4).map((review) => {
            const avatarUrl = secureUrl(review.user?.avatar_url);
            // 이름 우선순위: name -> full_name -> '익명'
            const userName = review.user?.name || review.user?.full_name || '익명';
            
            return (
              <div key={review.id} className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden relative shrink-0">
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt="user" fill className="object-cover"/>
                    ) : (
                      <div className="w-full h-full bg-slate-300"/>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900">{userName}</div>
                    <div className="text-xs text-slate-500">{new Date(review.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                  {review.content}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-slate-400 text-sm py-4">아직 작성된 후기가 없습니다. 첫 후기를 남겨보세요!</div>
      )}
      
      {/* 2. 모달 열기 버튼 (🟢 수정됨: 1개라도 있으면 무조건 보임) */}
      {reviews.length > 0 && (
        <button onClick={() => setIsReviewsExpanded(true)} className="mt-8 px-6 py-3 border border-black rounded-xl font-bold hover:bg-slate-50 transition-colors w-full md:w-auto">
          후기 {reviews.length}개 모두 보기
        </button>
      )}

      {/* 3. 후기 전체보기 모달 */}
      {isReviewsExpanded && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsReviewsExpanded(false)}>
          <div className="bg-white w-full max-w-4xl h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <h3 className="font-bold text-lg flex items-center gap-2"><Star size={18} fill="black"/> {averageRating} (후기 {reviews.length}개)</h3>
              <button onClick={() => setIsReviewsExpanded(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
              <div className="grid grid-cols-1 gap-8">
                {reviews.map((review) => {
                  const avatarUrl = secureUrl(review.user?.avatar_url);
                  const userName = review.user?.name || review.user?.full_name || '익명';

                  return (
                    <div key={review.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden relative shrink-0">
                           {avatarUrl ? (
                             <Image src={avatarUrl} alt="user" fill className="object-cover"/>
                           ) : <div className="w-full h-full bg-slate-300"/>}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <div>
                              <div className="font-bold text-sm text-slate-900">{userName}</div>
                              <div className="text-xs text-slate-500">{new Date(review.created_at).toLocaleDateString()}</div>
                            </div>
                            <div className="flex text-amber-400">
                              {[...Array(5)].map((_, idx) => (
                                <Star key={idx} size={12} fill={idx < review.rating ? "currentColor" : "none"} className={idx < review.rating ? "" : "text-slate-200"}/>
                              ))}
                            </div>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {review.content}
                          </p>
                          {/* 사진 렌더링 */}
                          {review.photos && review.photos.length > 0 && (
                            <div className="flex gap-2 mt-3">
                              {review.photos.map((photo: string, idx: number) => (
                                <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-100">
                                  <Image src={secureUrl(photo) || photo} alt="review img" fill className="object-cover"/>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {review.reply && (
                        <div className="ml-14 bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-3 items-start">
                           <div className="font-bold text-xs text-slate-900 mb-1 flex items-center gap-1">
                              호스트 {hostName}님 <span className="bg-black text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">Host</span>
                           </div>
                           <p className="text-xs text-slate-600 leading-relaxed">{review.reply}</p>
                        </div>
                      )}
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