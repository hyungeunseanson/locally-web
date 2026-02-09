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

  // 평점 계산
  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc, cur) => acc + cur.rating, 0) / reviews.length).toFixed(2) 
    : "0.0";

  useEffect(() => {
    const fetchReviews = async () => {
      if (!experienceId) return;
      
      // 🟢 [복원] 기존의 정확한 외래키 명시 쿼리 사용 (가장 안전함)
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          user:profiles!reviews_user_id_fkey(name, avatar_url) 
        `)
        .eq('experience_id', experienceId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("후기 로딩 실패:", error);
      } else {
        setReviews(data || []);
      }
      setLoading(false);
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
          {reviews.slice(0, 4).map((review) => (
            <div key={review.id} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden relative">
                   {review.user?.avatar_url ? (
                     <Image src={review.user.avatar_url} alt="user" fill className="object-cover"/>
                   ) : (
                     <div className="w-full h-full bg-slate-300"/>
                   )}
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900">{review.user?.name || '익명'}</div>
                  <div className="text-xs text-slate-500">{new Date(review.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                {review.content}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-slate-400 text-sm py-4">아직 작성된 후기가 없습니다. 첫 후기를 남겨보세요!</div>
      )}
      
      {/* 2. 모달 열기 버튼 */}
      {reviews.length > 4 && (
        <button onClick={() => setIsReviewsExpanded(true)} className="mt-8 px-6 py-3 border border-black rounded-xl font-bold hover:bg-slate-50 transition-colors">
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
                {reviews.map((review) => (
                  <div key={review.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden relative shrink-0">
                         {review.user?.avatar_url ? (
                           <Image src={review.user.avatar_url} alt="user" fill className="object-cover"/>
                         ) : <div className="w-full h-full bg-slate-300"/>}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <div className="font-bold text-sm text-slate-900">{review.user?.name || '익명'}</div>
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
                        {review.photos && review.photos.length > 0 && (
                          <div className="flex gap-2 mt-3">
                            {review.photos.map((photo: string, idx: number) => (
                              <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-100">
                                <Image src={photo} alt="review img" fill className="object-cover"/>
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
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}