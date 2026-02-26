'use client';

import React, { useEffect, useState } from 'react';
import { User, X, Star, Globe, Smile, MessageCircle } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useLanguage } from '@/app/context/LanguageContext';

interface Props {
  guest: any;
  onClose: () => void;
}

export default function GuestProfileModal({ guest, onClose }: Props) {
  const { t } = useLanguage();
  const supabase = createClient();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  // 🟢 게스트가 받은 후기 불러오기
  useEffect(() => {
    const fetchReviews = async () => {
      if (!guest?.id) return;
      
      const { data } = await supabase
        .from('guest_reviews')
        .select(`
          *,
          host:profiles!guest_reviews_host_id_fkey(full_name, avatar_url)
        `)
        .eq('guest_id', guest.id)
        .order('created_at', { ascending: false });

      if (data) setReviews(data);
      setLoadingReviews(false);
    };
    fetchReviews();
  }, [guest, supabase]);

  if (!guest) return null;

  // 언어 배열 처리
  const languages = Array.isArray(guest.languages) ? guest.languages : [];
  const joinedAt = guest.created_at ? new Date(guest.created_at).toLocaleDateString() : '-';

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 md:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl md:rounded-3xl w-[92vw] max-w-[390px] md:max-w-lg overflow-hidden shadow-2xl relative flex flex-col max-h-[84vh] md:max-h-[90vh]" 
        onClick={e => e.stopPropagation()}
      >
        
        {/* 헤더 (배경 + 닫기 버튼) */}
        <div className="h-20 md:h-32 bg-slate-900 relative shrink-0">
           <button onClick={onClose} className="absolute top-3 md:top-4 right-3 md:right-4 z-10 p-1.5 md:p-2 bg-black/20 hover:bg-black/40 rounded-full text-white transition-colors">
             <X size={18} className="md:w-5 md:h-5" />
           </button>
        </div>

        {/* 프로필 정보 (스크롤 가능 영역) */}
        <div className="px-4 md:px-6 pb-5 md:pb-8 overflow-y-auto custom-scrollbar -mt-10 md:-mt-12 flex-1">
          
          {/* 아바타 & 기본 정보 */}
          <div className="flex justify-between items-end mb-3 md:mb-4">
             <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white p-1 shadow-lg">
               <div className="w-full h-full rounded-full bg-slate-100 overflow-hidden relative border border-slate-100">
                 {guest.avatar_url ? (
                   <img src={guest.avatar_url} className="w-full h-full object-cover" alt="Guest" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-slate-300"><User size={30} className="md:w-10 md:h-10"/></div>
                 )}
               </div>
             </div>
             
             {/* 가입일 등 메타 정보 */}
             <div className="text-right mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('guest_modal_joined')}</span>
                <p className="text-[11px] md:text-xs font-bold text-slate-600">
                  {joinedAt}
                </p>
             </div>
          </div>

          <div className="mb-4 md:mb-6">
            <h2 className="text-lg md:text-2xl font-black text-slate-900 flex items-center gap-2">
              {guest.full_name}
              {guest.host_nationality && (
                <span className="text-sm md:text-lg bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                  {/* 국적 코드를 이모지로 변환하는 로직이 있다면 좋음, 일단 텍스트 */}
                  {guest.host_nationality}
                </span>
              )}
            </h2>
          </div>

          {/* 🟢 [핵심] 성향/언어 배지 */}
          <div className="flex flex-wrap gap-1.5 md:gap-2 mb-4 md:mb-6">
            {/* 성별 */}
            {guest.gender && (
              <span className="inline-flex items-center gap-1 px-2.5 md:px-3 py-1.5 rounded-full text-[10px] md:text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">
                {guest.gender === 'Male' ? '🙋‍♂️ Male' : guest.gender === 'Female' ? '🙋‍♀️ Female' : '🙋 Other'}
              </span>
            )}
            
            {/* MBTI */}
            {guest.mbti && (
              <span className="inline-flex items-center gap-1 px-2.5 md:px-3 py-1.5 rounded-full text-[10px] md:text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100">
                <Smile size={12}/> {guest.mbti}
              </span>
            )}

            {/* 언어 */}
            {languages.map((lang: string) => (
              <span key={lang} className="inline-flex items-center gap-1 px-2.5 md:px-3 py-1.5 rounded-full text-[10px] md:text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                <Globe size={12}/> {t(`lang_${lang}`) || lang}
              </span>
            ))}
          </div>

          {/* 소개글 */}
          <div className="bg-slate-50 p-4 md:p-5 rounded-xl md:rounded-2xl mb-6 md:mb-8 border border-slate-100">
            <h3 className="text-[11px] md:text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Introduction</h3>
            <p className="text-[12px] md:text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {guest.introduction || t('guest_modal_intro_empty')}
            </p>
          </div>

          {/* 🟢 [핵심] 받은 후기 리스트 */}
          <div>
            <div className="flex items-center gap-2 mb-4">
               <Star size={18} fill="black" className="text-slate-900"/>
               <h3 className="font-bold text-base md:text-lg">{t('guest_modal_reviews')} ({reviews.length})</h3>
            </div>

            {loadingReviews ? (
              <div className="space-y-3">
                 {[1,2].map(i => <div key={i} className="h-20 bg-slate-50 rounded-xl animate-pulse"/>)}
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <MessageCircle size={24} className="mx-auto text-slate-300 mb-2"/>
                <p className="text-sm text-slate-400">{t('guest_modal_no_reviews')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div key={review.id} className="bg-white border border-slate-100 p-3 md:p-4 rounded-xl hover:border-slate-300 transition-colors">
                     <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                           <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden">
                              {review.host?.avatar_url ? (
                                <img src={review.host.avatar_url} className="w-full h-full object-cover"/>
                              ) : <User size={14} className="text-slate-400 m-auto mt-1"/>}
                           </div>
                           <span className="text-[12px] md:text-sm font-bold text-slate-900">
                             {review.host?.full_name || 'Host'}
                           </span>
                        </div>
                        <div className="flex items-center gap-1 text-amber-400">
                           <Star size={12} fill="currentColor"/>
                           <span className="text-xs font-bold text-slate-700">{review.rating}</span>
                        </div>
                     </div>
                     <p className="text-[12px] md:text-sm text-slate-600 leading-snug">&quot;{review.content}&quot;</p>
                     <p className="text-[10px] text-slate-400 mt-2 text-right">
                       {new Date(review.created_at).toLocaleDateString()}
                     </p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
