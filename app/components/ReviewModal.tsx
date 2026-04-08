'use client';

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Star, X, Loader2 } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client'; // 🟢 Supabase 클라이언트 추가
import { useToast } from '@/app/context/ToastContext'; // 🟢 토스트 알림 추가
import { useLanguage } from '@/app/context/LanguageContext';
import type { GuestTrip } from '@/app/guest/trips/components/TripCard';

type EditableReview = {
  id?: number | string | null;
  rating?: number | null;
  content?: string | null;
};

type ReviewTrip = GuestTrip & {
  host?: string | null;
  review?: EditableReview | null;
};

interface ReviewModalProps {
  trip: ReviewTrip;
  onClose: () => void;
  onReviewSubmitted?: () => void; // 🟢 후기 작성/수정 완료 후 목록 새로고침용 콜백
}

function secureUrl(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith('http://')) return url.replace('http://', 'https://');
  return url;
}

export default function ReviewModal({ trip, onClose, onReviewSubmitted }: ReviewModalProps) {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const { t } = useLanguage();

  // 닫힘 애니메이션
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);
  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    closeTimerRef.current = setTimeout(onClose, 150);
  }, [closing, onClose]);

  // [R5] 수정 모드 감지: trip.review가 있으면 수정 모드
  const isEditMode = !!(trip.review?.id);
  const existingReview: EditableReview = trip.review || {};

  const [rating, setRating] = useState(isEditMode ? (existingReview.rating || 0) : 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState(isEditMode ? (existingReview.content || '') : '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const contextImageSrc = secureUrl(trip.photos?.[0] || trip.image || null);

  const handleSubmit = async () => {
    if (rating === 0) return showToast(t('rv_select_rating') as string, 'error');
    if (reviewText.length < 10) return showToast(t('rv_min_length') as string, 'error');

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('error_login_required') as string);

      if (isEditMode) {
        // [R5] 수정 모드: PATCH API 호출
        const res = await fetch(`/api/reviews/${existingReview.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating, content: reviewText })
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || (t('rv_edit_fail') as string));
        }

        showToast(t('rv_edit_success') as string, 'success');
      } else {
        // 신규 작성: POST API 호출
        const res = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            experienceId: trip.expId,
            bookingId: trip.id,
            rating,
            content: reviewText
          })
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || (t('rv_save_fail') as string));
        }

        showToast(t('rv_save_success') as string, 'success');
      }

      // 🟢 목록 새로고침 요청 후 모달 닫기
      if (onReviewSubmitted) onReviewSubmitted();
      onClose();

    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      showToast((isEditMode ? `${t('rv_edit_fail')} ` : `${t('rv_save_fail')} `) + message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-150 ${closing ? 'opacity-0' : 'animate-in fade-in duration-200'}`}
      onClick={requestClose}
    >
      <div
        className={`bg-white w-full max-w-lg rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl transition-all duration-150 max-h-[88dvh] md:max-h-[90vh] flex flex-col ${closing ? 'opacity-0 scale-95' : 'animate-in zoom-in-95 duration-200'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 md:px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-base md:text-lg text-slate-900">
            {isEditMode ? t('rv_title_edit') : t('rv_title_new')}
          </h3>
          <button onClick={requestClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-900">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 md:p-8 overflow-y-auto">
          <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-slate-200 overflow-hidden shrink-0 border border-slate-100">
              {contextImageSrc ? (
                /* eslint-disable-next-line @next/next/no-img-element -- review modal cover renders arbitrary public trip image URLs */
                <img
                  data-testid="review-modal-context-image"
                  src={contextImageSrc}
                  alt={trip.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="bg-slate-200 w-full h-full" />
              )}
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 line-clamp-1">{trip.title}</h4>
              <p className="text-xs text-slate-500 mt-1">{trip.hostName || trip.host} {t('rv_host_ask')}</p>
            </div>
          </div>

          <div className="flex justify-center gap-1.5 md:gap-2 mb-3 md:mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
                className="transition-transform hover:scale-110 p-1 focus:outline-none"
              >
                <Star
                  size={28}
                  fill={(hoverRating || rating) >= star ? "#FBBF24" : "none"}
                  className={(hoverRating || rating) >= star ? "text-amber-400" : "text-slate-300"}
                />
              </button>
            ))}
          </div>
          <p className="text-center text-xs md:text-sm font-bold text-slate-700 mb-5 md:mb-8 h-5">
            {rating === 5 ? t('rv_rating_5') :
              rating === 4 ? t('rv_rating_4') :
                rating === 3 ? t('rv_rating_3') :
                  rating === 2 ? t('rv_rating_2') :
                    rating === 1 ? t('rv_rating_1') :
                      t('rv_rating_0')}
          </p>

          <textarea
            className="w-full h-28 md:h-32 p-3.5 md:p-4 border border-slate-300 rounded-xl resize-none focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all text-sm mb-4 placeholder:text-slate-400"
            placeholder={t('rv_placeholder') as string}
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
          />

          {isEditMode && (
            <p className="text-[11px] text-slate-400 text-center mb-3">
              {t('rv_edit_rule')}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={rating === 0 || reviewText.length < 10 || isSubmitting}
            className="w-full bg-black text-white font-bold py-3.5 md:py-4 rounded-xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2 text-sm md:text-base"
          >
            {isSubmitting ? <><Loader2 className="animate-spin" size={20} /> {t('rv_btn_saving')}</> : (isEditMode ? t('rv_btn_edit') : t('rv_btn_submit'))}
          </button>
        </div>
      </div>
    </div>
  );
}
