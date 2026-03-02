'use client';

import React, { useState } from 'react';
import { Star, X, Camera, Loader2 } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client'; // 🟢 Supabase 클라이언트 추가
import { useToast } from '@/app/context/ToastContext'; // 🟢 토스트 알림 추가
import { useLanguage } from '@/app/context/LanguageContext';

interface ReviewModalProps {
  trip: any;
  onClose: () => void;
  onReviewSubmitted?: () => void; // 🟢 후기 작성/수정 완료 후 목록 새로고침용 콜백
}

export default function ReviewModal({ trip, onClose, onReviewSubmitted }: ReviewModalProps) {
  const supabase = createClient();
  const { showToast } = useToast();
  const { t } = useLanguage();

  // [R5] 수정 모드 감지: trip.review가 있으면 수정 모드
  const isEditMode = !!(trip.review?.id);
  const existingReview = trip.review || null;

  const [rating, setRating] = useState(isEditMode ? (existingReview.rating || 0) : 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState(isEditMode ? (existingReview.content || '') : '');

  // 이미지 관리
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>(isEditMode ? (existingReview.photos || []) : []);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const totalImages = existingPhotoUrls.length + imageFiles.length;
      if (totalImages >= 2) return showToast(t('rv_max_photos') as string, 'error');

      const file = e.target.files[0];
      const imageUrl = URL.createObjectURL(file);

      setNewImagePreviews(prev => [...prev, imageUrl]);
      setImageFiles(prev => [...prev, file]);
    }
  };

  const removeExistingPhoto = (index: number) => {
    setExistingPhotoUrls(prev => prev.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    setNewImagePreviews(prev => prev.filter((_, i) => i !== index));
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (rating === 0) return showToast(t('rv_select_rating') as string, 'error');
    if (reviewText.length < 10) return showToast(t('rv_min_length') as string, 'error');

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다.");

      // 새 이미지 업로드
      const uploadedUrls: string[] = [];
      for (const file of imageFiles) {
        const fileName = `reviews/${user.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const { error: uploadError } = await supabase.storage.from('images').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }

      // 최종 사진 배열: 기존 유지 + 새 업로드
      const finalPhotos = [...existingPhotoUrls, ...uploadedUrls];

      if (isEditMode) {
        // [R5] 수정 모드: PATCH API 호출
        const res = await fetch(`/api/reviews/${existingReview.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating, content: reviewText, photos: finalPhotos })
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
            content: reviewText,
            photos: finalPhotos
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

    } catch (error: any) {
      console.error(error);
      showToast((isEditMode ? `${t('rv_edit_fail')} ` : `${t('rv_save_fail')} `) + error.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[88dvh] md:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 md:px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-base md:text-lg text-slate-900">
            {isEditMode ? t('rv_title_edit') : t('rv_title_new')}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-900">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 md:p-8 overflow-y-auto">
          <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-slate-200 overflow-hidden shrink-0 border border-slate-100">
              {trip.image ? <img src={trip.image} alt={trip.title} className="w-full h-full object-cover" /> : <div className="bg-slate-200 w-full h-full" />}
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

          <div className="flex gap-2.5 md:gap-3 mb-5 md:mb-6 flex-wrap">
            {/* 기존 사진 (수정 모드) */}
            {existingPhotoUrls.map((url, idx) => (
              <div key={`existing-${idx}`} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 group">
                <img src={url} alt="review" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeExistingPhoto(idx)}
                  className="absolute top-0 right-0 bg-black/50 text-white p-0.5 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {/* 새로 추가된 사진 */}
            {newImagePreviews.map((url, idx) => (
              <div key={`new-${idx}`} className="relative w-16 h-16 rounded-lg overflow-hidden border border-blue-200 group">
                <img src={url} alt="new review" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeNewImage(idx)}
                  className="absolute top-0 right-0 bg-black/50 text-white p-0.5 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {/* 사진 추가 버튼 */}
            {existingPhotoUrls.length + imageFiles.length < 2 && (
              <label className="w-16 h-16 rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-slate-500 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100">
                <Camera size={20} />
                <span className="text-[10px] mt-1 font-medium">{t('rv_add_photo')}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            )}
          </div>

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
