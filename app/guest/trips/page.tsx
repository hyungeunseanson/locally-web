'use client';

import React, { useState } from 'react';
import { 
  Calendar, MapPin, MoreHorizontal, MessageSquare, 
  CheckCircle2, Receipt, Star, X, PenTool 
} from 'lucide-react';
import Link from 'next/link';
import SiteHeader from '@/app/components/SiteHeader';

export default function GuestTripsPage() {
  // 후기 모달 상태
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);

  const handleOpenReview = (trip: any) => {
    setSelectedTrip(trip);
    setIsReviewModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black mb-10">나의 여행</h1>

        {/* 예정된 예약 */}
        <section className="mb-16">
          <h2 className="text-xl font-bold mb-6">예정된 예약</h2>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow flex flex-col md:flex-row">
            <div className="p-8 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                   <span className="bg-black text-white text-xs font-bold px-3 py-1 rounded-full">D-3</span>
                   <button className="text-slate-400 hover:text-black"><MoreHorizontal/></button>
                </div>
                <h3 className="text-2xl font-bold mb-2">현지인과 함께하는 시부야 이자카야 탐방</h3>
                <p className="text-slate-500 mb-6">호스트: Kenji</p>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-slate-700">
                    <Calendar className="text-slate-400" size={20}/>
                    <span className="font-semibold">2026년 10월 24일 (토) 19:00</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-700">
                    <MapPin className="text-slate-400" size={20}/>
                    <span className="font-semibold">시부야역 하치코 동상 앞</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8 pt-8 border-t border-slate-100">
                <Link href="/guest/inbox" className="flex-1">
                  <button className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors">
                    <MessageSquare size={16}/> 호스트에게 메시지
                  </button>
                </Link>
                <button className="flex-1 border border-slate-200 hover:border-black text-slate-900 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors">
                  <Receipt size={16}/> 영수증 보기
                </button>
              </div>
            </div>

            <div className="w-full md:w-80 bg-slate-100 relative min-h-[300px]">
               <img src="https://images.unsplash.com/photo-1542051841857-5f90071e7989" className="w-full h-full object-cover"/>
               <div className="absolute inset-0 bg-black/10"></div>
            </div>
          </div>
        </section>

        {/* 지난 여행 */}
        <section>
          <h2 className="text-xl font-bold mb-6">지난 여행</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <TripCard 
              id={1}
              image="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e" 
              title="기모노 입고 다도 체험" 
              date="2025년 12월" 
              host="Sakura"
              onReviewClick={handleOpenReview}
            />
            <TripCard 
              id={2}
              image="https://images.unsplash.com/photo-1551632811-561732d1e306" 
              title="홋카이도 설국 스키 레슨" 
              date="2025년 1월" 
              host="Yuki"
              isReviewed={true} // 이미 작성한 경우
              onReviewClick={handleOpenReview}
            />
            
            {/* 빈 카드 (탐색 유도) */}
            <div className="border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center p-6 text-slate-400 hover:border-slate-400 hover:bg-slate-50 transition-colors cursor-pointer min-h-[300px]">
               <span className="font-bold mb-1">다음 여행을 떠나보세요</span>
               <Link href="/" className="text-sm underline text-black">체험 둘러보기</Link>
            </div>
          </div>
        </section>
      </main>

      {/* ⭐ 후기 작성 모달 */}
      {isReviewModalOpen && selectedTrip && (
        <ReviewModal 
          trip={selectedTrip} 
          onClose={() => setIsReviewModalOpen(false)} 
        />
      )}
    </div>
  );
}

// 🎟️ 지난 여행 카드 컴포넌트
function TripCard({ id, image, title, date, host, isReviewed, onReviewClick }: any) {
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
      <div className="aspect-[4/3] bg-slate-100 relative">
        <img src={image} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"/>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <h4 className="font-bold text-lg mb-1 truncate">{title}</h4>
        <p className="text-xs text-slate-500 mb-3">{date} · {host}</p>
        
        <div className="mt-auto pt-3 border-t border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-1 text-green-600 text-xs font-bold">
            <CheckCircle2 size={14}/> 이용 완료
          </div>
          
          {isReviewed ? (
            <button disabled className="text-xs font-bold text-slate-400 px-3 py-1.5 bg-slate-100 rounded-lg cursor-default">
              작성 완료
            </button>
          ) : (
            <button 
              onClick={() => onReviewClick({ id, title, host, image })}
              className="text-xs font-bold text-white px-3 py-1.5 bg-black rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1"
            >
              <PenTool size={12}/> 후기 작성
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ⭐ 별점 및 리뷰 작성 모달
function ReviewModal({ trip, onClose }: any) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');

  const handleSubmit = () => {
    if (rating === 0) return alert("별점을 선택해주세요!");
    if (reviewText.length < 10) return alert("후기는 10자 이상 작성해주세요.");
    
    // TODO: 실제 Supabase 저장 로직 연결
    alert("소중한 후기가 등록되었습니다! 적립금이 지급되었습니다.");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-lg">후기 작성</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20}/>
          </button>
        </div>

        <div className="p-8">
          {/* 상품 정보 */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-xl bg-slate-200 overflow-hidden shrink-0">
              <img src={trip.image} className="w-full h-full object-cover"/>
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 line-clamp-1">{trip.title}</h4>
              <p className="text-xs text-slate-500 mt-1">{trip.host} 호스트님과의 만남은 어떠셨나요?</p>
            </div>
          </div>

          {/* 별점 입력 */}
          <div className="flex justify-center gap-2 mb-8">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
                className="transition-transform hover:scale-110 p-1"
              >
                <Star 
                  size={32} 
                  fill={(hoverRating || rating) >= star ? "#FBBF24" : "none"} 
                  className={(hoverRating || rating) >= star ? "text-amber-400" : "text-slate-300"}
                />
              </button>
            ))}
          </div>
          <p className="text-center text-sm font-bold text-slate-700 mb-6">
            {rating === 5 ? "최고였어요! 😍" : 
             rating === 4 ? "좋았어요! 😊" :
             rating === 3 ? "보통이에요 🙂" : 
             rating === 2 ? "아쉬웠어요 🙁" : 
             rating === 1 ? "별로였어요 😫" : "별점을 눌러 평가해주세요"}
          </p>

          {/* 텍스트 입력 */}
          <textarea 
            className="w-full h-32 p-4 border border-slate-300 rounded-xl resize-none focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all text-sm"
            placeholder="다른 게스트들에게 도움이 되도록 솔직한 후기를 남겨주세요. (최소 10자 이상)"
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
          />

          <button 
            onClick={handleSubmit}
            className="w-full bg-black text-white font-bold py-4 rounded-xl mt-6 hover:bg-slate-800 transition-colors shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={rating === 0 || reviewText.length < 10}
          >
            후기 등록하기
          </button>
        </div>
      </div>
    </div>
  );
}