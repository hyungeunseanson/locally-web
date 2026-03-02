'use client';

import React, { useEffect, useState } from 'react';
import { Star, Trash2, Search, RefreshCw } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';

interface AdminReview {
  id: number;
  rating: number;
  content: string;
  reply: string | null;
  created_at: string;
  photos: string[];
  user_id: string;
  experience_id: number;
  guest: { full_name: string | null; avatar_url: string | null } | null;
  experiences: { title: string | null; host_id: string | null } | null;
}

export default function ReviewsTab() {
  const supabase = createClient();
  const { showToast } = useToast();

  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id, rating, content, reply, created_at, photos, user_id, experience_id,
          guest:profiles!reviews_user_id_fkey ( full_name, avatar_url ),
          experiences ( title, host_id )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews((data as any[]) || []);
    } catch (err) {
      console.error(err);
      showToast('리뷰 목록 로드 실패', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleDelete = async (reviewId: number) => {
    if (!confirm('이 후기를 삭제하시겠습니까? 취소할 수 없습니다.')) return;
    setDeletingId(reviewId);
    try {
      const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
      if (error) throw error;
      setReviews(prev => prev.filter(r => r.id !== reviewId));
      showToast('후기가 삭제되었습니다.', 'success');
    } catch (err) {
      console.error(err);
      showToast('삭제 실패', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = reviews.filter(r => {
    const matchRating = ratingFilter === null || Math.floor(r.rating) === ratingFilter;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q
      || r.content?.toLowerCase().includes(q)
      || r.guest?.full_name?.toLowerCase().includes(q)
      || r.experiences?.title?.toLowerCase().includes(q);
    return matchRating && matchSearch;
  });

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  return (
    <div className="p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-slate-900 flex items-center gap-2">
            <Star size={20} className="text-amber-400" fill="currentColor" />
            Review Management
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            전체 {reviews.length}개 · 평균 {avgRating}점
          </p>
        </div>
        <button
          onClick={fetchReviews}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
          title="새로고침"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex flex-col md:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400"
            placeholder="게스트명, 체험명, 내용 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          {[null, 5, 4, 3, 2, 1].map(r => (
            <button
              key={String(r)}
              onClick={() => setRatingFilter(r)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${ratingFilter === r ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {r === null ? '전체' : `${r}★`}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse h-24 bg-slate-100 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">검색 결과가 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(review => (
            <div key={review.id} className="border border-slate-100 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-3">
                {/* 게스트 아바타 */}
                <div className="w-9 h-9 rounded-full bg-slate-200 overflow-hidden shrink-0 border border-slate-100">
                  {review.guest?.avatar_url
                    ? <img src={review.guest.avatar_url} className="w-full h-full object-cover" alt="" />
                    : <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-bold">
                        {review.guest?.full_name?.[0] || '?'}
                      </div>
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-slate-900">
                        {review.guest?.full_name || '(삭제된 사용자)'}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs text-slate-500 truncate max-w-[160px]">
                        {review.experiences?.title || '(삭제된 체험)'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(review.id)}
                      disabled={deletingId === review.id}
                      className="shrink-0 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                      title="후기 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* 별점 */}
                  <div className="flex items-center gap-0.5 mb-1.5">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        size={12}
                        fill={review.rating >= star ? '#FBBF24' : 'none'}
                        className={review.rating >= star ? 'text-amber-400' : 'text-slate-300'}
                      />
                    ))}
                    <span className="text-xs text-slate-500 ml-1">{review.rating}</span>
                  </div>

                  {/* 내용 */}
                  <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">{review.content}</p>

                  {/* 사진 */}
                  {review.photos && review.photos.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {review.photos.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-100 hover:opacity-80 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* 호스트 답글 */}
                  {review.reply && (
                    <div className="mt-2 pl-3 border-l-2 border-slate-200 text-xs text-slate-500 italic line-clamp-2">
                      답글: {review.reply}
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400 mt-2">
                    {new Date(review.created_at).toLocaleDateString('ko-KR')}
                    {!review.reply && <span className="ml-2 text-amber-500 font-semibold">미답변</span>}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
