'use client';

import React, { useState, useEffect } from 'react';
import { Star, MessageCircle, Filter, CheckCircle, Reply, MoreHorizontal } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import Image from 'next/image';
import { useToast } from '@/app/context/ToastContext';
import Skeleton from '@/app/components/ui/Skeleton';

export default function HostReviews() {
  const supabase = createClient();
  const { showToast } = useToast();
  
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unreplied'>('all');
  
  // 답글 작성 상태
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. 내 체험에 달린 리뷰 가져오기 (관계형 쿼리)
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          experiences!inner ( id, title, host_id ),
          guest:profiles!reviews_user_id_fkey ( full_name, avatar_url )
        `)
        .eq('experiences.host_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);

    } catch (error) {
      console.error(error);
      showToast('리뷰를 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReply = async (reviewId: number) => {
    if (!replyText.trim()) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('reviews')
        .update({ 
            reply: replyText,
            reply_at: new Date().toISOString() 
        })
        .eq('id', reviewId);

      if (error) throw error;

      showToast('답글이 등록되었습니다!', 'success');
      
      // 🟢 [핵심] UI 강제 업데이트 (서버 다시 부르지 않고 로컬 상태 즉시 변경)
      setReviews(prev => prev.map(r => 
        r.id === reviewId 
          ? { ...r, reply: replyText, reply_at: new Date().toISOString() } 
          : r
      ));

      setReplyingId(null);
      setReplyText('');
      
    } catch (error) {
      console.error(error);
      showToast('답글 등록 실패', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 📊 통계 계산
  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1) 
    : '0.0';
  
  const ratingCounts = [5, 4, 3, 2, 1].map(score => ({
    score,
    count: reviews.filter(r => Math.floor(r.rating) === score).length,
    percent: totalReviews > 0 ? (reviews.filter(r => Math.floor(r.rating) === score).length / totalReviews) * 100 : 0
  }));

  const unrepliedCount = reviews.filter(r => !r.reply).length;
  
  // 필터링
  const filteredReviews = filter === 'unreplied' 
    ? reviews.filter(r => !r.reply) 
    : reviews;

  if (loading) return <Skeleton className="w-full h-96 rounded-3xl" />;

  if (totalReviews === 0) {
    return (
      <div className="text-center py-32 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
           <Star size={32} className="text-slate-300" fill="#cbd5e1" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">아직 작성된 후기가 없습니다</h3>
        <p className="text-slate-500 mt-2 text-sm">첫 게스트를 맞이하고 멋진 후기를 받아보세요!</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. 상단 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 평점 요약 */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
           <div>
             <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">평균 평점</div>
             <div className="text-4xl font-black text-slate-900 flex items-center gap-2">
               {averageRating} <Star size={24} className="text-amber-400" fill="#fbbf24"/>
             </div>
             <div className="text-xs text-slate-400 mt-2 font-medium">전체 후기 {totalReviews}개</div>
           </div>
           <div className="w-32 space-y-1">
             {ratingCounts.map((rc) => (
               <div key={rc.score} className="flex items-center gap-2 text-[10px]">
                 <span className="w-3 font-bold text-slate-400">{rc.score}</span>
                 <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                   <div className="h-full bg-slate-800 rounded-full" style={{ width: `${rc.percent}%` }}></div>
                 </div>
               </div>
             ))}
           </div>
        </div>

        {/* 미답변 현황 */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between cursor-pointer hover:border-rose-200 transition-colors" onClick={() => setFilter('unreplied')}>
           <div className="flex justify-between items-start">
             <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">미답변 후기</div>
             <div className="bg-rose-100 text-rose-600 p-2 rounded-full"><MessageCircle size={20}/></div>
           </div>
           <div>
             <div className="text-3xl font-black text-slate-900">{unrepliedCount}건</div>
             <div className="text-xs text-slate-400 mt-1 font-medium">답글을 기다리고 있어요!</div>
           </div>
        </div>

        {/* 팁 카드 */}
        <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-lg flex flex-col justify-center relative overflow-hidden">
           <div className="relative z-10">
             <h4 className="font-bold text-lg mb-2">답글의 힘! 💪</h4>
             <p className="text-xs text-slate-300 leading-relaxed">
               후기에 정성스러운 답글을 남기면<br/>
               예약률이 평균 <span className="text-amber-400 font-bold">20% 이상 상승</span>합니다.
             </p>
           </div>
           <Star className="absolute -right-4 -bottom-4 text-white/10 w-32 h-32 rotate-12" fill="currentColor"/>
        </div>
      </div>

      {/* 2. 필터 및 리스트 */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-2 bg-slate-50">
          <button 
            onClick={() => setFilter('all')} 
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${filter === 'all' ? 'bg-white shadow text-black' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <Filter size={14}/> 전체 보기
          </button>
          <button 
            onClick={() => setFilter('unreplied')} 
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${filter === 'unreplied' ? 'bg-white shadow text-rose-500' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <MessageCircle size={14}/> 미답변만 ({unrepliedCount})
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredReviews.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">
              {filter === 'unreplied' ? '모든 후기에 답글을 남기셨습니다! 🎉' : '후기가 없습니다.'}
            </div>
          ) : (
            filteredReviews.map((review) => (
              <div key={review.id} className="p-6 md:p-8 hover:bg-slate-50 transition-colors">
                <div className="flex gap-4">
                  
                  {/* 게스트 프로필 */}
                  <div className="shrink-0">
                    <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden relative border border-slate-100">
                      <Image 
                        src={review.guest?.avatar_url || 'https://via.placeholder.com/150'} 
                        alt="Guest" 
                        fill 
                        className="object-cover"
                      />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* 헤더 */}
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{review.guest?.full_name || '익명 게스트'}</h4>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                           <span>{new Date(review.created_at).toLocaleDateString()}</span>
                           <span className="w-0.5 h-0.5 bg-slate-300 rounded-full"></span>
                           <span className="truncate max-w-[150px]">{review.experiences?.title}</span>
                        </div>
                      </div>
                      <div className="flex text-amber-400">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={14} fill={i < review.rating ? "currentColor" : "none"} className={i < review.rating ? "" : "text-slate-200"}/>
                        ))}
                      </div>
                    </div>

                    {/* 내용 */}
                    <p className="text-sm text-slate-700 leading-relaxed mb-4 whitespace-pre-wrap">{review.content}</p>

                    {/* 사진 */}
                    {review.photos && review.photos.length > 0 && (
                      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                        {review.photos.map((photo: string, idx: number) => (
                          <div key={idx} className="w-20 h-20 rounded-lg overflow-hidden relative shrink-0 border border-slate-200">
                            <Image src={photo} alt="Review" fill className="object-cover" />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 답글 영역 */}
                    {review.reply ? (
                      <div className="bg-slate-100 rounded-2xl p-4 mt-4 flex gap-3">
                        <Reply size={16} className="text-slate-400 shrink-0 mt-1 rotate-180" />
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-slate-900">호스트님의 답글</span>
                            <span className="text-[10px] text-slate-400">{new Date(review.reply_at || Date.now()).toLocaleDateString()}</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{review.reply}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4">
                        {replyingId === review.id ? (
                          <div className="animate-in fade-in slide-in-from-top-2">
                            <textarea 
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:border-black focus:ring-0 transition-all min-h-[100px]"
                              placeholder="게스트에게 감사의 인사를 전해보세요."
                              autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <button 
                                onClick={() => setReplyingId(null)}
                                className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                              >
                                취소
                              </button>
                              <button 
                                onClick={() => handleSubmitReply(review.id)}
                                disabled={isSubmitting}
                                className="px-4 py-2 text-xs font-bold bg-black text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                              >
                                {isSubmitting ? '등록 중...' : '답글 등록'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button 
                            onClick={() => { setReplyingId(review.id); setReplyText(''); }}
                            className="text-xs font-bold text-slate-500 hover:text-rose-500 flex items-center gap-1.5 transition-colors border border-slate-200 px-3 py-1.5 rounded-lg hover:border-rose-200 hover:bg-rose-50"
                          >
                            <MessageCircle size={14}/> 답글 달기
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}