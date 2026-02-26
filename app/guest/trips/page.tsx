'use client';

import React, { useState } from 'react';
import { Loader2, Ghost, AlertCircle, History, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import SiteHeader from '@/app/components/SiteHeader';
import ReviewModal from '@/app/components/ReviewModal';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 추가
import { useRouter } from 'next/navigation';

// 분리된 컴포넌트 & 훅 import
import { useGuestTrips } from './hooks/useGuestTrips'; // ✅ 로직은 여기서 가져옴
import TripCard from './components/TripCard';
import ReceiptModal from './components/ReceiptModal';
import PastTripCard from './components/PastTripCard';

export default function GuestTripsPage() {
  const { t } = useLanguage(); // 🟢 추가
  const router = useRouter();
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
  const handleMobileBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/account');
  };

  if (isLoading) return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-16">
        <div className="md:hidden mb-3">
          <button
            onClick={handleMobileBack}
            className="h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-700 flex items-center justify-center active:scale-95 transition-transform"
            aria-label="뒤로가기"
          >
            <ArrowLeft size={16} />
          </button>
        </div>

        <h1 className="text-[20px] md:text-4xl font-extrabold mb-4 md:mb-12 mt-2 md:mt-0 tracking-tight leading-tight text-slate-900">{t('my_trips')}</h1>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-4 mb-6 md:mb-8 rounded-xl flex items-center gap-3 text-sm font-medium">
            <AlertCircle size={20} />
            <span>{t('error_prefix')} {errorMsg}</span>
          </div>
        )}

        {/* 📱 모바일 전용: 스크롤 레이아웃 (예정 위, 지난 여행 아래) */}
        <div className="md:hidden">
          {/* ── 예정된 여행 ── */}
          <div className="flex flex-col gap-4 mb-8">
            {upcomingTrips.length > 0 ? (
              upcomingTrips.map((trip: any) => (
                <TripCard key={trip.id} trip={trip} onRequestCancel={requestCancel} isProcessing={isProcessing} onOpenReceipt={openReceipt} />
              ))
            ) : (
              <div className="border border-dashed border-slate-200 rounded-2xl py-12 text-center flex flex-col items-center justify-center bg-slate-50/50">
                <Ghost className="text-slate-300 mb-3" size={24} />
                <p className="text-[13px] font-medium text-slate-700 mb-1">{t('trip_empty_title')}</p>
                <Link href="/" className="text-[12px] text-slate-400 hover:text-black underline underline-offset-4">{t('explore_exp')}</Link>
              </div>
            )}
          </div>

          {/* ── 지난 여행 ── */}
          {pastTrips.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t('trip_past')}</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <div className="space-y-3">
                {pastTrips.map((trip: any) => (
                  <PastTripCard key={trip.id} trip={trip} onOpenReview={openReview} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* 🖥️ 데스크탑 전용: 기존 2컬럼 레이아웃 */}
        <div className="hidden md:grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">

          {/* 1. 왼쪽 메인: 예정된 여행 */}
          <section className="lg:col-span-7">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              {t('trip_upcoming')} <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full">{upcomingTrips.length}</span>
            </h2>

            <div className="flex flex-col gap-8">
              {upcomingTrips.length > 0 ? (
                upcomingTrips.map((trip: any) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    onRequestCancel={requestCancel}
                    isProcessing={isProcessing}
                    onOpenReceipt={openReceipt}
                  />
                ))
              ) : (
                <div className="border border-dashed border-slate-200 rounded-3xl py-24 text-center flex flex-col items-center justify-center bg-slate-50/50">
                  <Ghost className="text-slate-300 mb-4" size={32} />
                  <p className="text-lg font-medium text-slate-900 mb-1">{t('trip_empty_title')}</p>
                  <Link href="/" className="text-sm text-slate-500 hover:text-black underline underline-offset-4 transition-colors">
                    {t('explore_exp')}
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* 2. 오른쪽 사이드: 지난 여행 */}
          <aside className="lg:col-span-5">
            <div className="sticky top-24">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-400">
                <History size={20} /> {t('trip_past')}
              </h2>

              {pastTrips.length > 0 ? (
                <div className="space-y-4">
                  {pastTrips.map((trip: any) => (
                    <PastTripCard key={trip.id} trip={trip} onOpenReview={openReview} />
                  ))}
                </div>
              ) : (
                <div className="text-slate-400 text-sm py-4">{t('trip_past_empty')}</div>
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
