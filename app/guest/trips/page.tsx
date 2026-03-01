'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Ghost, AlertCircle, History, ArrowLeft, Briefcase, ChevronRight, Clock, MapPin, Users, Calendar, Plus } from 'lucide-react';
import Link from 'next/link';
import SiteHeader from '@/app/components/SiteHeader';
import ReviewModal from '@/app/components/ReviewModal';
import { useLanguage } from '@/app/context/LanguageContext';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { useNotification } from '@/app/context/NotificationContext';

// 분리된 컴포넌트 & 훅 import
import { useGuestTrips } from './hooks/useGuestTrips';
import TripCard from './components/TripCard';
import ReceiptModal from './components/ReceiptModal';
import PastTripCard from './components/PastTripCard';
import { getServiceRequestStatusLabel } from '@/app/constants/serviceStatus';
import type { ServiceRequestCard } from '@/app/types/service';

// 서비스 의뢰 N 배지: service_application_new 타입 알림 중 unread 여부
function useServiceUnread() {
  const { notifications } = useNotification();
  return notifications.some(
    (n) => !n.is_read && (
      n.type === 'service_application_new' ||
      n.type === 'service_host_selected' ||
      n.type === 'service_payment_confirmed' ||
      n.type === 'service_cancelled'
    )
  );
}

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-emerald-100 text-emerald-700',
  matched: 'bg-blue-100 text-blue-700',
  paid: 'bg-indigo-100 text-indigo-700',
  confirmed: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-100 text-red-600',
  expired: 'bg-slate-100 text-slate-400',
};

export default function GuestTripsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const hasServiceUnread = useServiceUnread();

  const {
    upcomingTrips,
    pastTrips,
    isLoading,
    errorMsg,
    requestCancel,
    isProcessing,
    refreshTrips
  } = useGuestTrips();

  // UI 상태 관리 (모달 등)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);

  // 맞춤 의뢰 목록
  const [serviceRequests, setServiceRequests] = useState<ServiceRequestCard[]>([]);
  const [serviceLoading, setServiceLoading] = useState(true);

  useEffect(() => {
    const loadServices = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setServiceLoading(false); return; }
      try {
        const res = await fetch('/api/services/requests?mode=my');
        const data = await res.json();
        if (data.success) setServiceRequests((data.data ?? []).slice(0, 5));
      } catch (e) {
        console.error('service requests load error:', e);
      } finally {
        setServiceLoading(false);
      }
    };
    void loadServices();
  }, [supabase]);

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

  // ─── 맞춤 의뢰 섹션 (공통, 모바일+데스크탑) ───────────────────────────
  const ServiceRequestsSection = () => (
    <section className="mt-8 md:mt-12">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h2 className="text-[15px] md:text-xl font-bold flex items-center gap-2">
          <Briefcase size={18} className="text-slate-600" />
          나의 맞춤 의뢰
          {hasServiceUnread && (
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block ml-1 animate-pulse" />
          )}
        </h2>
        <Link href="/services/my" className="flex items-center gap-1 text-[11px] md:text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors">
          전체 보기 <ChevronRight size={12} />
        </Link>
      </div>

      {serviceLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="animate-pulse h-16 bg-slate-100 rounded-xl" />)}
        </div>
      ) : serviceRequests.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-2xl py-8 text-center bg-slate-50/60">
          <Briefcase size={22} className="text-slate-300 mx-auto mb-2" />
          <p className="text-[12px] md:text-sm text-slate-500 mb-3">아직 등록한 맞춤 의뢰가 없습니다.</p>
          <Link href="/services/intro">
            <button className="inline-flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-xl text-[11px] md:text-xs font-bold hover:bg-slate-800 transition-colors">
              <Plus size={12} /> 첫 의뢰 등록하기
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {serviceRequests.map((req) => (
            <Link key={req.id} href={`/services/${req.id}`}>
              <div className="flex items-center justify-between border border-slate-100 rounded-xl px-4 py-3 md:py-3.5 bg-white hover:shadow-md transition-shadow [box-shadow:0_1px_4px_rgba(0,0,0,0.05)] cursor-pointer group">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[12px] md:text-[13px] text-slate-900 truncate">{req.title}</p>
                  <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-0.5 text-[10px] md:text-[11px] text-slate-400">
                    <span className="flex items-center gap-0.5"><MapPin size={9} />{req.city}</span>
                    <span className="flex items-center gap-0.5"><Calendar size={9} />{req.service_date}</span>
                    <span className="flex items-center gap-0.5"><Clock size={9} />{req.duration_hours}시간</span>
                    <span className="flex items-center gap-0.5"><Users size={9} />{req.guest_count}명</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className={`text-[9px] md:text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${STATUS_COLOR[req.status] ?? 'bg-slate-100 text-slate-500'}`}>
                    {getServiceRequestStatusLabel(req.status)}
                  </span>
                  <ChevronRight size={13} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                </div>
              </div>
            </Link>
          ))}
          <Link href="/services/my" className="flex items-center justify-center gap-1.5 text-[11px] md:text-xs text-slate-400 hover:text-slate-700 pt-1 transition-colors">
            <Plus size={11} /> 새 의뢰 등록 또는 전체 보기
          </Link>
        </div>
      )}
    </section>
  );

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-5 md:py-16">
        <div className="md:hidden mb-2.5">
          <button
            onClick={handleMobileBack}
            className="h-8 w-8 md:h-9 md:w-9 rounded-full border border-slate-200 bg-white text-slate-700 flex items-center justify-center active:scale-95 transition-transform"
            aria-label="뒤로가기"
          >
            <ArrowLeft className="w-[14px] h-[14px] md:w-4 md:h-4" />
          </button>
        </div>

        <h1 className="text-[18px] md:text-4xl font-extrabold mb-3 md:mb-12 mt-1.5 md:mt-0 tracking-tight leading-tight text-slate-900">{t('my_trips')}</h1>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-3 md:p-4 mb-5 md:mb-8 rounded-lg md:rounded-xl flex items-center gap-2 md:gap-3 text-[13px] md:text-sm font-medium">
            <AlertCircle className="w-[18px] h-[18px] md:w-5 md:h-5" />
            <span>{t('error_prefix')} {errorMsg}</span>
          </div>
        )}

        {/* 📱 모바일 전용: 스크롤 레이아웃 */}
        <div className="md:hidden">
          {/* ── 맞춤 의뢰 섹션 (최상단) ── */}
          <ServiceRequestsSection />

          {/* ── 구분선 ── */}
          <div className="flex items-center gap-2 my-6">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">일반 예약</span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          {/* ── 예정된 여행 ── */}
          <div className="flex flex-col gap-3 mb-6">
            {upcomingTrips.length > 0 ? (
              upcomingTrips.map((trip: any) => (
                <TripCard key={trip.id} trip={trip} onRequestCancel={requestCancel} isProcessing={isProcessing} onOpenReceipt={openReceipt} />
              ))
            ) : (
              <div className="border border-dashed border-slate-200 rounded-xl md:rounded-2xl py-10 md:py-12 text-center flex flex-col items-center justify-center bg-slate-50/50">
                <Ghost className="text-slate-300 mb-2.5 md:mb-3 w-5 h-5 md:w-6 md:h-6" />
                <p className="text-[12px] md:text-[13px] font-medium text-slate-700 mb-1">{t('trip_empty_title')}</p>
                <Link href="/" className="text-[11px] md:text-[12px] text-slate-400 hover:text-black underline underline-offset-4">{t('explore_exp')}</Link>
              </div>
            )}
          </div>

          {/* ── 지난 여행 ── */}
          {pastTrips.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 md:gap-2 mb-3">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-[10px] md:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t('trip_past')}</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <div className="space-y-2.5 md:space-y-3">
                {pastTrips.map((trip: any) => (
                  <PastTripCard key={trip.id} trip={trip} onOpenReview={openReview} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* 🖥️ 데스크탑 전용: 기존 2컬럼 레이아웃 */}
        <div className="hidden md:grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">

          {/* 1. 왼쪽 메인: 맞춤 의뢰 (최상단) + 예정된 여행 */}
          <section className="lg:col-span-7">
            {/* 맞춤 의뢰 섹션 (데스크탑 최상단) */}
            <ServiceRequestsSection />

            {/* 구분선 */}
            <div className="flex items-center gap-3 my-8">
              <div className="h-px flex-1 bg-slate-100" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">일반 예약</span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>

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
      {isReviewModalOpen && selectedTrip && (
        <ReviewModal
          trip={selectedTrip}
          onClose={() => setIsReviewModalOpen(false)}
          onReviewSubmitted={refreshTrips}
        />
      )}
    </div>
  );
}
