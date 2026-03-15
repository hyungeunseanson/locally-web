'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MoreHorizontal, MapPin, Clock, Calendar, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, MessageSquare, Map, Receipt, Lock, Share2, Mountain } from 'lucide-react';
import { useRouter } from 'next/navigation';
import CancellationModal from './CancellationModal';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 추가
import { isCancelledBookingStatus } from '@/app/constants/bookingStatus';
import { getLocalizedExperienceText } from '@/app/utils/experienceTranslation';

export interface GuestTrip {
  id: number;
  orderId?: string | number;
  expId: string | number;
  hostId: string;
  title: string;
  date: string;
  time: string;
  location?: string;
  meetingPoint?: string;
  meetingPointI18n?: Record<string, string> | null;
  address?: string;
  image?: string;
  photos?: string[];
  isPrivate?: boolean;
  status?: string;
  guests?: number;
  paymentDate?: string;
  created_at?: string;
  amount?: number;
  totalPrice?: number;
  total_price?: number;
  price?: number;
  hostName?: string;
  hostAvatarUrl?: string | null;
}

interface TripCardProps {
  trip: GuestTrip;
  onRequestCancel: (id: number, reason: string, hostId: string) => Promise<boolean>;
  onOpenReceipt: (trip: GuestTrip) => void;
  isProcessing: boolean;
}

export default function TripCard({ trip, onRequestCancel, onOpenReceipt, isProcessing }: TripCardProps) {
  const { t, lang } = useLanguage(); // 🟢 lang 추가
  const router = useRouter();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 🟢 [추가] 환불 예상 정보 상태
  const [refundInfo, setRefundInfo] = useState({ percent: 0, amount: 0, reason: '' });
  const localizedMeetingPoint =
    getLocalizedExperienceText(
      {
        meeting_point: trip.meetingPoint,
        meeting_point_i18n: trip.meetingPointI18n,
      },
      'meeting_point',
      lang
    ) || trip.location || 'SEOUL';

  const openExternalLink = (url: string) => {
    window.location.href = url;
  };

  const shareTrip = async () => {
    const tripUrl = `${window.location.origin}/experiences/${trip.expId}`;
    const shareText = `[Locally] ${trip.title}\n${trip.date} ${trip.time}\n${tripUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Locally #${trip.orderId || trip.id}`,
          text: shareText,
          url: tripUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
      }
      alert(t('trip_share_done'));
    } catch {
      // 공유창 닫힘은 에러로 간주하지 않고 무시
    } finally {
      setIsMenuOpen(false);
    }
  };

  // 사진 슬라이더 상태
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const photos = trip.photos && trip.photos.length > 0
    ? trip.photos
    : (trip.image ? [trip.image] : []);

  const nextPhoto = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (currentPhotoIndex < photos.length - 1) setCurrentPhotoIndex(prev => prev + 1);
  };
  const prevPhoto = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (currentPhotoIndex > 0) setCurrentPhotoIndex(prev => prev - 1);
  };

  const formatPaymentDate = (dateStr: string) => {
    if (!dateStr) return '';
    // 🟢 언어별 시간 표기법 자동 적용 (AM/PM 등)
    const localeMap: Record<string, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN' };
    return new Date(dateStr).toLocaleString(localeMap[lang] || 'en-US', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    });
  };

  // 🟢 [환불 계산기] 프론트엔드용 (API 로직과 동일하게 유지)
  // TripCard.tsx 내부 calculateRefundFront 함수 교체

  const calculateRefundFront = () => {
    const now = new Date();
    // 날짜 형식이 안맞을 경우를 대비한 방어 코드
    const dateString = trip.date || new Date().toISOString().split('T')[0];
    const timeString = trip.time || '00:00';
    const tourDate = new Date(`${dateString}T${timeString}:00`);

    // paymentDate가 없으면 created_at 사용
    const payDateString = trip.paymentDate || trip.created_at || new Date().toISOString();
    const paymentDate = new Date(payDateString);

    const diffTime = tourDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const hoursSincePayment = (now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60);

    // 🟢 [핵심 수정] 금액 변수명 전부 체크 (문자열일 경우 숫자로 변환)
    const rawPrice = trip.amount || trip.totalPrice || trip.total_price || trip.price || 0;
    const totalAmount = Number(rawPrice);

    // 1. 결제 후 24시간 이내 철회 (단, 투어일 2일 전까지만 - 규정 재확인)
    if (hoursSincePayment <= 24 && diffDays > 1) {
      return { percent: 100, amount: totalAmount, reason: '결제 후 24시간 이내 철회 (전액 환불)' };
    }

    // 2. 날짜별 규정
    if (diffDays <= 0) return { percent: 0, amount: 0, reason: '투어 당일/경과 (환불 불가)' };
    if (diffDays === 1) return { percent: 40, amount: Math.floor(totalAmount * 0.4), reason: '1일 전 취소 (40% 환불)' };
    if (diffDays >= 2 && diffDays <= 7) return { percent: 70, amount: Math.floor(totalAmount * 0.7), reason: '2~7일 전 취소 (70% 환불)' };
    if (diffDays >= 8 && diffDays <= 19) return { percent: 80, amount: Math.floor(totalAmount * 0.8), reason: '8~19일 전 취소 (80% 환불)' };

    return { percent: 100, amount: totalAmount, reason: '20일 전 취소 (전액 환불)' };
  };

  // 취소 버튼 클릭 시 계산 수행
  const handleCancelClick = () => {
    const info = calculateRefundFront();
    setRefundInfo(info);
    setIsMenuOpen(false);
    setShowCancelModal(true);
  };

  // 상태 뱃지 로직
  const getStatusInfo = () => {
    const normalizedStatus = (trip.status || '').toLowerCase();

    // 🟢 [추가] 입금 대기 상태
    if (normalizedStatus === 'pending') {
      return { label: '입금 확인 중', color: 'bg-yellow-100 text-yellow-700 animate-pulse', icon: <Receipt size={12} /> };
    }

    if (normalizedStatus === 'cancellation_requested') return { label: '취소 요청중', color: 'bg-orange-100 text-orange-600', icon: <AlertCircle size={12} /> };
    if (isCancelledBookingStatus(normalizedStatus)) return { label: '취소됨', color: 'bg-red-100 text-red-600', icon: <AlertCircle size={12} /> };

    const today = new Date();
    const tripDate = new Date(trip.date);
    const diffTime = tripDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // 🟢 [수정] D-Day 및 날짜 카운트 번역
    if (diffDays === 0) return { label: 'D-Day', color: 'bg-rose-500 text-white', icon: <Clock size={12} /> };
    if (diffDays > 0 && diffDays <= 7) return { label: `${diffDays} ${t('trip_start_in')}`, color: 'bg-green-500 text-white', icon: <Calendar size={12} /> };

    return { label: '예약 확정', color: 'bg-white/90 text-slate-800', icon: <CheckCircle size={12} /> };
  };

  const { label, color, icon } = getStatusInfo();

  const addToCalendar = () => {
    const text = encodeURIComponent(`[Locally] ${trip.title}`);
    const safeLocation = trip.location || '';
    const details = encodeURIComponent(`예약번호: ${trip.orderId}\n장소: ${safeLocation}`);
    const location = encodeURIComponent(safeLocation);
    const dateStr = trip.date.replace(/-/g, "");
    const dates = `${dateStr}/${dateStr}`;
    openExternalLink(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`);
    setIsMenuOpen(false);
  };

  return (
    <>
      <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col md:flex-row h-auto md:h-64 relative">

        {/* 왼쪽: 이미지 섹션 */}
        <div className="w-full md:w-72 h-48 md:h-full relative bg-slate-200 shrink-0 cursor-pointer overflow-hidden group/slide flex items-center justify-center">
          <Link href={`/experiences/${trip.expId}`} className="block w-full h-full relative">
            {photos.length > 0 ? (
              <Image
                src={photos[currentPhotoIndex]}
                alt={trip.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-200">
                <Mountain className="w-8 h-8 text-slate-300" />
              </div>
            )}
          </Link>

          {trip.isPrivate && (
            <div className="absolute top-2.5 md:top-3 right-2.5 md:right-3 z-10 bg-black/80 text-white text-[10px] md:text-[10px] font-bold px-1.5 md:px-2 py-0.5 md:py-1 rounded-full flex items-center gap-1 backdrop-blur-sm">
              <Lock className="w-[10px] h-[10px]" /> PRIVATE
            </div>
          )}

          <div className={`absolute top-2.5 md:top-3 left-2.5 md:left-3 px-2 md:px-2.5 py-0.5 md:py-1 rounded-full text-[11px] md:text-xs font-bold flex items-center gap-1 md:gap-1.5 shadow-sm backdrop-blur-md ${color}`}>
            {icon} {label}
          </div>

          {photos.length > 1 && (
            <>
              <button onClick={prevPhoto} disabled={currentPhotoIndex === 0} className="absolute left-2 top-1/2 -translate-y-1/2 p-1 md:p-1.5 rounded-full bg-white/80 hover:bg-white text-slate-800 disabled:opacity-0 transition-all opacity-0 group-hover/slide:opacity-100 shadow-sm"><ChevronLeft className="w-[14px] h-[14px] md:w-4 md:h-4" /></button>
              <button onClick={nextPhoto} disabled={currentPhotoIndex === photos.length - 1} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 md:p-1.5 rounded-full bg-white/80 hover:bg-white text-slate-800 disabled:opacity-0 transition-all opacity-0 group-hover/slide:opacity-100 shadow-sm"><ChevronRight className="w-[14px] h-[14px] md:w-4 md:h-4" /></button>
            </>
          )}
        </div>

        {/* 오른쪽: 정보 섹션 */}
        <div className="flex-1 p-4 md:p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-1.5 md:mb-2">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 md:gap-2 text-[10px] text-slate-400">
                  <span className="font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">#{trip.orderId}</span>
                  <span>{t('paid_label')} {formatPaymentDate(trip.paymentDate || trip.created_at || '')}</span>
                </div>

                <div className="text-[11px] md:text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 md:gap-2 mt-0.5 md:mt-1">
                  <MapPin className="w-[11px] h-[11px] md:w-3 md:h-3" /> {localizedMeetingPoint}
                </div>
              </div>

              {/* 🟢 더보기 메뉴 */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                  className="p-1.5 md:p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-colors"
                >
                  <MoreHorizontal className="w-[18px] h-[18px] md:w-5 md:h-5" />
                </button>

                {isMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsMenuOpen(false)}></div>
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-xl py-2 z-40 animate-in fade-in zoom-in-95 origin-top-right">
                      <button onClick={addToCalendar} className="w-full text-left px-4 py-2.5 text-[13px] md:text-sm hover:bg-slate-50 text-slate-700 font-medium">{t('trip_add_calendar')}</button> {/* 🟢 교체 */}
                      <button onClick={shareTrip} className="hidden md:flex w-full text-left px-4 py-2.5 text-[13px] md:text-sm hover:bg-slate-50 text-slate-700 font-medium items-center gap-2"><Share2 className="w-3.5 h-3.5" />{t('trip_share')}</button>
                      <div className="h-px bg-slate-100 my-1"></div>

                      {!isCancelledBookingStatus(trip.status || '') ? (
                        <button
                          onClick={handleCancelClick} // 🟢 클릭 시 환불 계산 후 모달 오픈
                          className="w-full text-left px-4 py-2.5 text-[13px] md:text-sm hover:bg-red-50 text-red-500 font-medium"
                        >
                          {t('trip_cancel_req')} {/* 🟢 교체 */}
                        </button>
                      ) : (
                        <button disabled className="w-full text-left px-4 py-2.5 text-xs text-slate-400 cursor-not-allowed">
                          {(trip.status || '').toLowerCase() === 'cancellation_requested' ? '취소 요청중' : '취소 완료됨'}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <Link href={`/experiences/${trip.expId}`} className="block group-hover:text-rose-500 transition-colors mt-1.5 md:mt-2">
              <h3 className="text-[15px] md:text-xl font-bold text-slate-900 mb-1.5 md:mb-2 leading-tight line-clamp-2">{trip.title}</h3>
            </Link>

            <div className="flex flex-wrap gap-2 md:gap-3 text-[12px] md:text-sm text-slate-600 mt-1.5 md:mt-2">
              <div className="flex items-center gap-1.5 bg-slate-50 px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg border border-slate-100">
                <Calendar className="w-[13px] h-[13px] md:w-[14px] md:h-[14px] text-slate-400" />
                <span className="font-semibold text-slate-900">{trip.date}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg border border-slate-100">
                <Clock className="w-[13px] h-[13px] md:w-[14px] md:h-[14px] text-slate-400" />
                <span className="font-semibold text-slate-900">{trip.time}</span>
              </div>
            </div>
          </div>

          {/* 하단 3버튼 */}
          <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-slate-100 grid grid-cols-3 gap-1.5 md:gap-2">
            <button
              onClick={() => {
                const messageParams = new URLSearchParams({
                  hostId: String(trip.hostId),
                  expId: String(trip.expId),
                  expTitle: trip.title,
                });

                if (trip.hostName) {
                  messageParams.set('hostName', trip.hostName);
                }
                if (trip.hostAvatarUrl) {
                  messageParams.set('hostAvatar', trip.hostAvatarUrl);
                }

                router.push(`/guest/inbox?${messageParams.toString()}`);
              }}
              className="py-2 rounded-lg md:rounded-xl border border-slate-200 font-bold text-[11px] md:text-xs text-slate-600 hover:border-black hover:text-black hover:bg-slate-50 transition-all flex items-center justify-center gap-1"
            >
              <MessageSquare className="w-[13px] h-[13px] md:w-[14px] md:h-[14px]" /> {t('messages')} {/* 🟢 교체 */}
            </button>
            <button
              onClick={() => openExternalLink(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(localizedMeetingPoint || '')}`)}
              className="py-2 rounded-lg md:rounded-xl border border-slate-200 font-bold text-[11px] md:text-xs text-slate-600 hover:border-black hover:text-black hover:bg-slate-50 transition-all flex items-center justify-center gap-1"
            >
              <Map className="w-[13px] h-[13px] md:w-[14px] md:h-[14px]" /> {t('trip_map')} {/* 🟢 교체 */}
            </button>
            <button
              onClick={() => onOpenReceipt(trip)}
              className="py-2 rounded-lg md:rounded-xl border border-slate-200 font-bold text-[11px] md:text-xs text-slate-600 hover:border-black hover:text-black hover:bg-slate-50 transition-all flex items-center justify-center gap-1"
            >
              <Receipt className="w-[13px] h-[13px] md:w-[14px] md:h-[14px]" /> {t('receipt')} {/* 🟢 교체 */}
            </button>
          </div>
        </div>
      </div>

      <CancellationModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        isProcessing={isProcessing}
        // 🟢 [추가] 환불 정보 전달
        refundInfo={refundInfo}
        onConfirm={async (reason) => {
          const success = await onRequestCancel(trip.id, reason, trip.hostId);
          if (success) setShowCancelModal(false);
        }}
      />
    </>
  );
}
