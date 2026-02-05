'use client';

import React, { useState } from 'react';
import { Star, X } from 'lucide-react';

export default function ReviewSection({ hostName }: { hostName: string }) {
  const [isReviewsExpanded, setIsReviewsExpanded] = useState(false);

  return (
    <div id="reviews" className="border-b border-slate-200 pb-8 scroll-mt-24">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <Star size={20} fill="black"/> 4.98 · 후기 15개
      </h3>
      
      {/* 1. 요약 리스트 (최대 4개) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
        {[1,2,3,4].map(i => (
          <div key={i} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-200 rounded-full bg-cover bg-center" style={{backgroundImage: `url('https://i.pravatar.cc/150?u=${i}')`}}></div>
              <div><div className="font-bold text-sm text-slate-900">Guest {i}</div><div className="text-xs text-slate-500">2026년 1월</div></div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
              호스트님이 정말 친절하셨고, 코스도 완벽했습니다. 현지인만 아는 맛집을 알게 되어 너무 좋았어요! 사진도 예쁘게 찍어주셔서 인생샷 건졌습니다.
            </p>
          </div>
        ))}
      </div>
      
      {/* 2. 모달 열기 버튼 */}
      <button onClick={() => setIsReviewsExpanded(true)} className="mt-8 px-6 py-3 border border-black rounded-xl font-bold hover:bg-slate-50 transition-colors">
        후기 15개 모두 보기
      </button>

      {/* 3. 후기 전체보기 모달 */}
      {isReviewsExpanded && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsReviewsExpanded(false)}>
          <div className="bg-white w-full max-w-4xl h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <h3 className="font-bold text-lg flex items-center gap-2"><Star size={18} fill="black"/> 4.98 (후기 15개)</h3>
              <button onClick={() => setIsReviewsExpanded(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
              <div className="grid grid-cols-1 gap-8">
                {[1,2,3,4,5,6,7,8].map(i => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-slate-200 rounded-full bg-cover bg-center shrink-0" style={{backgroundImage: `url('https://i.pravatar.cc/150?u=${i}')`}}></div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <div><div className="font-bold text-sm text-slate-900">Guest {i}</div><div className="text-xs text-slate-500">2026년 1월</div></div>
                          <div className="flex text-amber-400">{[...Array(5)].map((_, idx) => <Star key={idx} size={12} fill="currentColor"/>)}</div>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">
                          정말 잊지 못할 경험이었습니다. 호스트님이 너무 친절하게 대해주셔서 편안하게 여행할 수 있었어요.
                        </p>
                      </div>
                    </div>
                    {/* 호스트 답글 */}
                    {i % 2 !== 0 && (
                      <div className="ml-14 bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-3 items-start">
                        <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0 border border-white shadow-sm">
                          <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde" className="w-full h-full object-cover"/>
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-900 mb-1 flex items-center gap-1">
                            호스트 {hostName}님 <span className="bg-black text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">Host</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">소중한 후기 감사합니다! 😊</p>
                        </div>
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