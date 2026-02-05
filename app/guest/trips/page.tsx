'use client';

import React, { useState } from 'react';
import { 
  Calendar, MapPin, MoreHorizontal, MessageSquare, Receipt, Ghost 
} from 'lucide-react';
import Link from 'next/link';
import SiteHeader from '@/app/components/SiteHeader';
import TripCard from '@/app/components/TripCard';     // ✅ 위에서 만든 컴포넌트
import ReviewModal from '@/app/components/ReviewModal'; // ✅ 위에서 만든 컴포넌트

export default function GuestTripsPage() {
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  // 더미 데이터 (빈 화면 테스트를 위해 비워둘 수도 있음)
  const upcomingTrips = [
    {
      id: 999,
      title: "현지인과 함께하는 시부야 이자카야 탐방",
      host: "Kenji",
      date: "2026년 10월 24일 (토) 19:00",
      location: "시부야역 하치코 동상 앞",
      image: "https://images.unsplash.com/photo-1542051841857-5f90071e7989",
      dDay: "D-3"
    }
  ];

  const pastTrips = [
    { id: 1, title: "기모노 입고 다도 체험", host: "Sakura", date: "2025년 12월", image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e", isReviewed: false },
    { id: 2, title: "홋카이도 설국 스키 레슨", host: "Yuki", date: "2025년 1월", image: "https://images.unsplash.com/photo-1551632811-561732d1e306", isReviewed: true }
  ];

  const handleOpenReview = (trip: any) => {
    setSelectedTrip(trip);
    setIsReviewModalOpen(true);
  };

  const toggleMenu = (id: number) => {
    setActiveMenuId(activeMenuId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans" onClick={() => setActiveMenuId(null)}>
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black mb-10">나의 여행</h1>

        {/* 1. 예정된 예약 섹션 */}
        <section className="mb-16">
          <h2 className="text-xl font-bold mb-6">예정된 예약</h2>
          
          {upcomingTrips.length > 0 ? (
            upcomingTrips.map(trip => (
              <div key={trip.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow flex flex-col md:flex-row relative mb-6">
                <div className="p-8 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                       <span className="bg-black text-white text-xs font-bold px-3 py-1 rounded-full">{trip.dDay}</span>
                       
                       {/* 메뉴 버튼 */}
                       <div className="relative">
                         <button 
                           onClick={(e) => { e.stopPropagation(); toggleMenu(trip.id); }} 
                           className="text-slate-400 hover:text-black p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                         >
                           <MoreHorizontal/>
                         </button>
                         {activeMenuId === trip.id && (
                           <div className="absolute right-0 top-8 w-40 bg-white border border-slate-100 rounded-xl shadow-xl z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                             <button className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 font-medium text-slate-700">예약 상세 보기</button>
                             <button className="w-full text-left px-4 py-3 text-sm hover:bg-red-50 text-red-500 font-medium">예약 취소 요청</button>
                           </div>
                         )}
                       </div>
                    </div>
                    <h3 className="text-2xl font-bold mb-2">{trip.title}</h3>
                    <p className="text-slate-500 mb-6">호스트: {trip.host}</p>
                    
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-slate-700">
                        <Calendar className="text-slate-400" size={20}/>
                        <span className="font-semibold">{trip.date}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-700">
                        <MapPin className="text-slate-400" size={20}/>
                        <span className="font-semibold">{trip.location}</span>
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
                   <img src={trip.image} alt={trip.title} className="w-full h-full object-cover"/>
                   <div className="absolute inset-0 bg-black/10"></div>
                </div>
              </div>
            ))
          ) : (
            // 🟢 예정된 예약 Empty State (빈 화면)
            <div className="border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center py-16 px-4 bg-slate-50/50 text-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                <Ghost size={32} className="text-slate-300"/>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">아직 예정된 여행이 없습니다.</h3>
              <p className="text-slate-500 text-sm mb-6">설레는 첫 여행을 계획해보세요!</p>
              <Link href="/" className="px-6 py-3 bg-black text-white rounded-xl font-bold hover:scale-105 transition-transform text-sm shadow-lg">
                체험 둘러보기
              </Link>
            </div>
          )}
        </section>

        {/* 2. 지난 여행 섹션 */}
        <section>
          <h2 className="text-xl font-bold mb-6">지난 여행</h2>
          {pastTrips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pastTrips.map(trip => (
                <TripCard 
                  key={trip.id}
                  {...trip}
                  onReviewClick={handleOpenReview}
                />
              ))}
              
              {/* 다음 여행 유도 카드 */}
              <div className="border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center p-6 text-slate-400 hover:border-slate-400 hover:bg-slate-50 transition-colors cursor-pointer min-h-[300px] group">
                 <span className="font-bold mb-1 group-hover:text-slate-600 transition-colors">다음 여행을 떠나보세요</span>
                 <Link href="/" className="text-sm underline text-black">체험 둘러보기</Link>
              </div>
            </div>
          ) : (
            // 🟢 지난 여행 Empty State
            <div className="text-slate-400 text-sm py-10">다녀온 여행이 없습니다.</div>
          )}
        </section>
      </main>

      {/* 후기 작성 모달 */}
      {isReviewModalOpen && selectedTrip && (
        <ReviewModal trip={selectedTrip} onClose={() => setIsReviewModalOpen(false)} />
      )}
    </div>
  );
}