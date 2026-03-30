'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle, Calendar, MapPin, Share2, Copy, Home, ArrowRight, MessageCircle, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext';
import Spinner from '@/app/components/ui/Spinner';
import confetti from 'canvas-confetti'; // 🎉 폭죽 효과
import { isPendingBookingStatus, isConfirmedBookingStatus, isCancelledBookingStatus } from '@/app/constants/bookingStatus';
import { sendAnalyticsEvent } from '@/app/utils/analytics/client';
import { getPublicBankInfo } from '@/app/utils/publicBankInfo';
import { getContent } from '@/app/utils/contentHelper';
import { useAuth } from '@/app/context/AuthContext';
import { useLocallyMembership } from '@/app/hooks/useLocallyMembership';

type BookingExperience = {
  id?: string | number;
  host_id?: string | null;
  title?: string;
  title_ko?: string | null;
  title_en?: string | null;
  title_ja?: string | null;
  title_zh?: string | null;
  location?: string;
  duration?: number;
  photos?: string[] | null;
  image_url?: string | null;
};

type BookingData = {
  status?: string;
  date: string;
  time: string;
  order_id?: string;
  user_id?: string | null;
  experiences?: BookingExperience | null;
};

function PaymentCompleteContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { membership } = useLocallyMembership(user?.id);

  const orderId = searchParams.get('orderId');
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const bankInfo = getPublicBankInfo();

  // 🎉 폭죽 효과 함수
  const fireConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const random = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: random(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: random(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  // 1. 예약 정보 조회
  useEffect(() => {
    const fetchBooking = async () => {
      if (!orderId) return;

      // [Security] 본인 예약만 조회 — user_id 필터로 타인 orderId 탈취 방어
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('bookings')
        .select('*, experiences(*)')
        .eq('order_id', orderId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) {
        console.error('Booking fetch error:', error);
        showToast(t('pay_complete_fetch_error'), 'error');
      } else {
        setBooking(data);
        // 🎉 결제 완료(PAID/confirmed) 상태일 때만 폭죽 + analytics 발사
        // — 무통장 대기(PENDING) 또는 취소 상태에서 재방문 시 중복 이벤트 방지
        if (isConfirmedBookingStatus(data.status || '')) {
          fireConfetti();
          const experienceId = data.experiences?.id;
          if (experienceId) {
            sendAnalyticsEvent('booking_confirmed', String(experienceId));
          }
        }
      }
      setLoading(false);
    };
    fetchBooking();
  }, [orderId, supabase, showToast, t]);

  // 📅 구글 캘린더 링크 생성
  const handleAddToCalendar = () => {
    if (!booking) return;
    const { date, time, experiences } = booking;
    const title = getContent(experiences, 'title', lang) || experiences?.title || t('pay_complete_fallback_title');
    const location = experiences?.location || '';
    const durationHours = experiences?.duration || 2;

    // 날짜/시간 포맷팅 (YYYYMMDDTHHMMSSZ)
    const startTime = `${date.replace(/-/g, '')}T${time.replace(/:/g, '')}00`;
    const endDate = new Date(new Date(`${date}T${time}`).getTime() + durationHours * 60 * 60 * 1000);
    const endTime = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'; // 대략적인 종료 시간 (2시간 후로 가정)

    const details = `${t('pay_complete_fallback_title')}: ${title}${location ? `\n${location}` : ''}`;
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startTime}/${endTime}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;

    window.location.href = url;
  };

  // 💌 링크 공유
  const handleShare = () => {
    const url = `${window.location.origin}/experiences/${params.id}`;
    navigator.clipboard.writeText(url);
    showToast(t('pay_complete_share_copied'), 'success');
  };

  if (loading) return <Spinner fullScreen />;
  if (!booking) return <div className="min-h-screen bg-white flex items-center justify-center">{t('pay_complete_missing_booking')}</div>;
  const localizedExperienceTitle = getContent(booking.experiences, 'title', lang) || booking.experiences?.title || t('pay_complete_fallback_title');
  const bookingImage = booking.experiences?.photos?.[0] || booking.experiences?.image_url || '/images/logo.png';
  const messageParams = new URLSearchParams();
  if (booking.experiences?.host_id) {
    messageParams.set('hostId', String(booking.experiences.host_id));
  }
  if (booking.experiences?.id) {
    messageParams.set('expId', String(booking.experiences.id));
  }
  if (localizedExperienceTitle) {
    messageParams.set('expTitle', localizedExperienceTitle);
  }
  const messageQuery = messageParams.toString();
  const messageHref = messageQuery
    ? `/guest/inbox?${messageQuery}`
    : '/guest/inbox';

  return (
    <div className="min-h-screen bg-white font-sans">
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-20 text-center">

        {/* 1. 성공 메시지 (상태별 분기) */}
        <div className="mb-8 md:mb-10 animate-in zoom-in duration-500">
          {isPendingBookingStatus(booking.status || '') ? (
            <>
              <div className="w-16 h-16 md:w-20 md:h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 text-yellow-600 shadow-sm animate-pulse">
                <AlertCircle className="w-7 h-7 md:w-10 md:h-10" strokeWidth={3} />
              </div>
              <h1 className="text-[26px] md:text-4xl font-black text-slate-900 mb-2 md:mb-3 tracking-tight">{t('pay_complete_pending_title')}</h1>
              <p className="text-slate-500 text-[14px] md:text-lg mb-4 md:mb-6">{t('pay_complete_pending_desc')}</p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-4 md:p-6 max-w-xs md:max-w-sm mx-auto">
                <p className="text-[11px] md:text-xs font-bold text-slate-400 mb-2 uppercase">{t('pay_complete_bank_info_label')}</p>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="font-black text-[20px] md:text-2xl text-slate-900">{bankInfo.account}</span>
                  <Copy className="w-4 h-4 text-slate-400 cursor-pointer hover:text-black" onClick={() => { navigator.clipboard.writeText(bankInfo.accountDigits); showToast(t('pay_complete_bank_copied'), 'success'); }} />
                </div>
                <p className="font-bold text-slate-700 text-[13px] md:text-base">{bankInfo.bankName} ({t('pay_complete_bank_account_holder_label')}: {bankInfo.accountHolder})</p>
                <p className="text-[11px] md:text-xs text-rose-500 mt-1.5 md:mt-2 font-bold">{t('pay_complete_bank_timeout_hint')}</p>
              </div>
            </>
          ) : isCancelledBookingStatus(booking.status || '') ? (
            <>
              <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 text-slate-400 shadow-sm">
                <AlertCircle className="w-7 h-7 md:w-10 md:h-10" strokeWidth={3} />
              </div>
              <h1 className="text-[26px] md:text-4xl font-black text-slate-900 mb-2 md:mb-3 tracking-tight">{t('pay_complete_cancelled_title')}</h1>
              <p className="text-slate-500 text-[14px] md:text-lg">{t('pay_complete_cancelled_desc')}</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 md:w-20 md:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 text-green-600 shadow-sm animate-in zoom-in-50 duration-700" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
                <CheckCircle className="w-7 h-7 md:w-10 md:h-10" strokeWidth={3} />
              </div>
              <h1 className="text-[26px] md:text-4xl font-black text-slate-900 mb-2 md:mb-3 tracking-tight">{t('pay_complete_confirmed_title')}</h1>
              <p className="text-slate-500 text-[14px] md:text-lg">{t('pay_complete_confirmed_desc')}</p>
            </>
          )}
        </div>

        {/* 2. 예약 정보 카드 */}
        <div className="bg-slate-50 rounded-2xl md:rounded-3xl p-4 md:p-10 border border-slate-100 shadow-sm text-left mb-8 md:mb-10 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
            {/* 이미지 */}
            <div className="w-full md:w-32 h-28 md:h-32 bg-slate-200 rounded-xl md:rounded-2xl relative overflow-hidden shrink-0 shadow-inner">
              <Image src={bookingImage} alt={t('pay_complete_image_alt')} fill className="object-cover" />
            </div>

            {/* 텍스트 정보 */}
            <div className="flex-1 space-y-3 md:space-y-4 w-full">
              <h3 className="font-bold text-[17px] md:text-xl text-slate-900 leading-snug">{localizedExperienceTitle}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 text-[12px] md:text-sm">
                <div className="flex items-center gap-2 md:gap-3 text-slate-600 bg-white p-2.5 md:p-3 rounded-lg md:rounded-xl border border-slate-100">
                  <Calendar className="text-rose-500 w-4 h-4 md:w-[18px] md:h-[18px]" />
                  <span className="font-bold">{booking.date}</span>
                </div>
                <div className="flex items-center gap-2 md:gap-3 text-slate-600 bg-white p-2.5 md:p-3 rounded-lg md:rounded-xl border border-slate-100">
                  <Clock className="text-rose-500 w-4 h-4 md:w-[18px] md:h-[18px]" />
                  <span className="font-bold">{booking.time}</span>
                </div>
                <div className="flex items-center gap-2 md:gap-3 text-slate-600 bg-white p-2.5 md:p-3 rounded-lg md:rounded-xl border border-slate-100 md:col-span-2">
                  <MapPin className="text-rose-500 w-4 h-4 md:w-[18px] md:h-[18px]" />
                  <span className="font-medium line-clamp-1">{booking.experiences?.location}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 md:mt-8 pt-5 md:pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-2 md:gap-4">
            <div className="text-[12px] md:text-sm text-slate-500">
              {t('pay_complete_booking_number_label')} <span className="font-mono font-bold text-slate-900 ml-2">{orderId}</span>
            </div>
            <Link href={`/guest/trips`} className="text-[12px] md:text-sm font-bold text-rose-500 hover:underline flex items-center gap-1">
              {t('pay_complete_view_detail')} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {isConfirmedBookingStatus(booking.status || '') && membership && membership.status !== 'none' && (
          <div className="mb-8 md:mb-10 rounded-3xl border border-rose-100 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(255,247,247,1))] p-5 text-left shadow-sm max-w-2xl mx-auto">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-400">{t('membership_label')}</p>
            <h2 className="mt-2 text-[22px] font-black tracking-tight text-slate-900 md:text-[28px]">
              {membership.status === 'circle' ? t('membership_complete_circle_title') : t('membership_complete_member_title')}
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-slate-600 md:text-[15px]">
              {membership.status === 'circle' ? t('membership_complete_circle_desc') : t('membership_complete_member_desc')}
            </p>
          </div>
        )}

        {/* 3. 액션 버튼들 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 max-w-2xl mx-auto mb-3 md:mb-4 animate-in fade-in duration-500" style={{ animationDelay: '500ms', animationFillMode: 'both' }}>
          <Link href="/guest/trips" className="flex items-center justify-center gap-2 py-3 md:py-4 px-4 md:px-6 bg-slate-900 text-white hover:bg-black hover:shadow-lg rounded-xl md:rounded-2xl transition-all font-bold text-[13px] md:text-base">
            <ArrowRight className="w-4 h-4 md:w-[18px] md:h-[18px]" /> {t('pay_complete_view_detail')}
          </Link>
          <Link href={messageHref} className="flex items-center justify-center gap-2 py-3 md:py-4 px-4 md:px-6 bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg rounded-xl md:rounded-2xl transition-all font-bold text-[13px] md:text-base">
            <MessageCircle className="w-4 h-4 md:w-[18px] md:h-[18px]" /> {t('pay_complete_message_cta')}
          </Link>
          <button onClick={handleAddToCalendar} className="flex items-center justify-center gap-2 py-3 md:py-4 px-4 md:px-6 bg-white border border-slate-200 hover:border-black hover:shadow-md rounded-xl md:rounded-2xl transition-all font-bold text-[13px] md:text-base text-slate-700">
            <Calendar className="w-4 h-4 md:w-[18px] md:h-[18px]" /> {t('pay_complete_action_add_calendar')}
          </button>
          <Link href="/" className="flex items-center justify-center gap-2 py-3 md:py-4 px-4 md:px-6 bg-white border border-slate-200 hover:border-black hover:shadow-md rounded-xl md:rounded-2xl transition-all font-bold text-[13px] md:text-base text-slate-700">
            <Home className="w-4 h-4 md:w-[18px] md:h-[18px]" /> {t('pay_complete_action_home')}
          </Link>
        </div>
        <div className="mb-10 md:mb-16 text-center">
          <button onClick={handleShare} className="inline-flex items-center gap-2 text-[12px] md:text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900">
            <Share2 className="w-4 h-4" /> {t('pay_complete_action_share')}
          </button>
        </div>

        {/* 4. 하단 안내 */}
        <div className="bg-blue-50 text-blue-800 p-4 md:p-6 rounded-xl md:rounded-2xl text-[12px] md:text-sm max-w-2xl mx-auto flex items-start gap-2.5 md:gap-3">
          <MessageCircle className="shrink-0 mt-0.5 w-4 h-4 md:w-[18px] md:h-[18px]" />
          <div className="text-left">
            <p className="font-bold text-[13px] md:text-base mb-1">{t('pay_complete_message_title')}</p>
            <p className="text-blue-600/80">{t('pay_complete_message_desc')}</p>
            <p className="mt-2.5 md:mt-3 text-[11px] md:text-xs font-semibold text-blue-700/90">
              {t('pay_complete_message_followup')}
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}

export default function PaymentCompletePage() {
  return (
    <Suspense fallback={<Spinner fullScreen />}>
      <PaymentCompleteContent />
    </Suspense>
  );
}
