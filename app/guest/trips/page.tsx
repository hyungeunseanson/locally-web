'use client';

import React, { useState } from 'react';
import { Loader2, Ghost, AlertCircle, History } from 'lucide-react';
import Link from 'next/link';
import SiteHeader from '@/app/components/SiteHeader';
import ReviewModal from '@/app/components/ReviewModal';

// 분리된 컴포넌트 & 훅 import
import { useGuestTrips } from './hooks/useGuestTrips'; // ✅ 로직은 여기서 가져옴
import TripCard from './components/TripCard';     
import ReceiptModal from './components/ReceiptModal'; 
import PastTripCard from './components/PastTripCard'; 

export default function GuestTripsPage() {
  // ✅ [수정] 훅에서 가져오는 변수 이름 변경 (cancelBooking -> requestCancellation)
  const { 
    upcomingTrips, 
    pastTrips, 
    isLoading, 
    errorMsg, 
    requestCancel, // 🟢 [수정] 훅에서 반환하는 정확한 이름으로 변경
    isProcessing,  // 🟢 콤마(,) 확인 완료
    refreshTrips   // 🟢 콤마(,) 확인 완료
  } = useGuestTrips();

  // UI 상태 관리 (모달 등)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);

  const openReceipt = (trip: any) => { setSelectedTrip(trip); setIsReceiptModalOpen(true); };
  const openReview = (trip: any) => { setSelectedTrip(trip); setIsReviewModalOpen(true); };

  if (isLoading) return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      
      <main className="max-w-7xl mx-auto px-6 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-12 tracking-tight text-slate-900">여행</h1>
        
        {errorMsg && (
            <div className="bg-red-50 text-red-600 p-4 mb-8 rounded-xl flex items-center gap-3 text-sm font-medium">
                <AlertCircle size={20}/>
                <span>오류: {errorMsg}</span>
            </div>
        )}

        {/* 2컬럼 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          
          {/* 1. 왼쪽 메인: 예정된 여행 */}
          <section className="lg:col-span-7">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              예정된 일정 <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full">{upcomingTrips.length}</span>
            </h2>
            
            <div className="flex flex-col gap-8">
              {upcomingTrips.length > 0 ? (
                upcomingTrips.map(trip => (
                  <TripCard 
                    key={trip.id} 
                    trip={trip} 
                    onRequestCancel={requestCancel} // 🟢 [수정] 올바른 함수 전달
                    isProcessing={isProcessing}        // 추가됨
                    onOpenReceipt={openReceipt}
                  />
                ))
              ) : (
                <div className="border border-dashed border-slate-200 rounded-3xl py-24 text-center flex flex-col items-center justify-center bg-slate-50/50">
                  <Ghost className="text-slate-300 mb-4" size={32}/>
                  <p className="text-lg font-medium text-slate-900 mb-1">예정된 여행이 없습니다</p>
                  <Link href="/" className="text-sm text-slate-500 hover:text-black underline underline-offset-4 transition-colors">
                    새로운 체험 찾아보기
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* 2. 오른쪽 사이드: 지난 여행 */}
          <aside className="lg:col-span-5">
            <div className="sticky top-24">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-400">
                <History size={20}/> 지난 여행
              </h2>
              
              {pastTrips.length > 0 ? (
                <div className="space-y-4">
                  {pastTrips.map(trip => (
                    <PastTripCard key={trip.id} trip={trip} onOpenReview={openReview} />
                  ))}
                </div>
              ) : (
                <div className="text-slate-400 text-sm py-4">다녀온 여행 내역이 없습니다.</div>
              )}
            </div>
          </aside>

        </div>
      </main>

      {/* 모달 */}
      {isReceiptModalOpen && selectedTrip && <ReceiptModal trip={selectedTrip} onClose={() => setIsReceiptModalOpen(false)} />}
{/* 후기 작성 모달 */}
{isReviewModalOpen && selectedTrip && (
        <ReviewModal 
          trip={selectedTrip} 
          onClose={() => setIsReviewModalOpen(false)}
          // 🟢 [핵심] 후기 작성 완료 시 목록 새로고침 연결
          onReviewSubmitted={refreshTrips} 
        />
      )}
    </div>
  );
}