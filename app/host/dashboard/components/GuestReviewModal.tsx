'use client';

import React, { useState } from 'react';
import { Star, X, Loader2 } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';

interface Props {
  booking: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function GuestReviewModal({ booking, onClose, onSuccess }: Props) {
  const supabase = createClient();
  const { showToast } = useToast();
  
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) {
      showToast('후기 내용을 입력해주세요.', 'error');
      return;
    }
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      const { error } = await supabase.from('guest_reviews').insert({
        booking_id: booking.id,
        host_id: user.id,
        guest_id: booking.user_id,
        rating,
        content
      });

      if (error) throw error;

      showToast('게스트 후기가 등록되었습니다!', 'success');
      onSuccess();
      onClose();
    } catch (e: any) {
      console.error(e);
      showToast('후기 등록 실패: ' + e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        
        {/* 헤더 */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-lg">게스트 후기 작성</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
        </div>

        {/* 내용 */}
        <div className="p-6 space-y-6">
          <div className="text-center">
            <p className="text-sm text-slate-500 mb-2">
              <span className="font-bold text-slate-900">{booking.guest?.full_name}</span>님과의 시간은 어떠셨나요?
            </p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <button key={score} onClick={() => setRating(score)} className="transition-transform hover:scale-110">
                  <Star size={32} className={score <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
                </button>
              ))}
            </div>
            <p className="text-xs font-bold text-amber-500 mt-2">{rating}점</p>
          </div>

          <textarea 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="게스트에 대한 솔직한 후기를 남겨주세요. 이 내용은 다른 호스트들에게 큰 도움이 됩니다."
            className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-900 resize-none"
          />

          <button 
            onClick={handleSubmit} 
            disabled={submitting}
            className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="animate-spin" size={18}/> : '후기 등록 완료'}
          </button>
        </div>
      </div>
    </div>
  );
}