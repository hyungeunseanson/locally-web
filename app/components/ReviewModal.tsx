'use client';

import React, { useState } from 'react';
import { Star, X, Camera } from 'lucide-react';

interface ReviewModalProps {
  trip: any;
  onClose: () => void;
}

export default function ReviewModal({ trip, onClose }: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [images, setImages] = useState<string[]>([]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (images.length >= 2) return alert("사진은 최대 2장까지 첨부 가능합니다.");
      const file = e.target.files[0];
      const imageUrl = URL.createObjectURL(file);
      setImages([...images, imageUrl]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (rating === 0) return alert("별점을 선택해주세요!");
    if (reviewText.length < 10) return alert("후기는 10자 이상 작성해주세요.");
    
    alert("소중한 후기가 등록되었습니다! 포인트가 지급되었습니다.");
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-lg text-slate-900">후기 작성</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-900">
            <X size={20}/>
          </button>
        </div>

        <div className="p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-xl bg-slate-200 overflow-hidden shrink-0 border border-slate-100">
              <img src={trip.image} alt={trip.title} className="w-full h-full object-cover"/>
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 line-clamp-1">{trip.title}</h4>
              <p className="text-xs text-slate-500 mt-1">{trip.host} 호스트님과의 만남은 어떠셨나요?</p>
            </div>
          </div>

          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button 
                key={star} 
                onMouseEnter={() => setHoverRating(star)} 
                onMouseLeave={() => setHoverRating(0)} 
                onClick={() => setRating(star)} 
                className="transition-transform hover:scale-110 p-1 focus:outline-none"
              >
                <Star 
                  size={32} 
                  fill={(hoverRating || rating) >= star ? "#FBBF24" : "none"} 
                  className={(hoverRating || rating) >= star ? "text-amber-400" : "text-slate-300"} 
                />
              </button>
            ))}
          </div>
          <p className="text-center text-sm font-bold text-slate-700 mb-8 h-5">
            {rating === 5 ? "최고였어요! 😍" : 
             rating === 4 ? "좋았어요! 😊" : 
             rating === 3 ? "보통이에요 🙂" : 
             rating === 2 ? "아쉬웠어요 🙁" : 
             rating === 1 ? "별로였어요 😫" : 
             "별점을 눌러 평가해주세요"}
          </p>

          <textarea 
            className="w-full h-32 p-4 border border-slate-300 rounded-xl resize-none focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all text-sm mb-4 placeholder:text-slate-400" 
            placeholder="솔직한 후기를 남겨주세요. (최소 10자 이상)" 
            value={reviewText} 
            onChange={(e) => setReviewText(e.target.value)}
          />
          
          <div className="flex gap-3 mb-6">
            {images.map((img, idx) => (
              <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 group">
                <img src={img} alt="review" className="w-full h-full object-cover"/>
                <button 
                  onClick={() => removeImage(idx)} 
                  className="absolute top-0 right-0 bg-black/50 text-white p-0.5 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12}/>
                </button>
              </div>
            ))}
            {images.length < 2 && (
              <label className="w-16 h-16 rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-slate-500 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100">
                <Camera size={20}/>
                <span className="text-[10px] mt-1 font-medium">사진 추가</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload}/>
              </label>
            )}
          </div>

          <button 
            onClick={handleSubmit} 
            className="w-full bg-black text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100" 
            disabled={rating === 0 || reviewText.length < 10}
          >
            후기 등록하기
          </button>
        </div>
      </div>
    </div>
  );
}