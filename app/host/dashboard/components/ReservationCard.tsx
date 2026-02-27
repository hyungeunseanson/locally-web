'use client';

import React from 'react';
import {
  Clock, User, CheckCircle2, MessageSquare,
  Phone, Mail, XCircle, AlertTriangle, Loader2, CalendarPlus
} from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';
import {
  isCancellationRequestedBookingStatus,
  isCancelledBookingStatus,
  isCancelledOnlyBookingStatus,
  isConfirmedBookingStatus,
  isPendingBookingStatus,
} from '@/app/constants/bookingStatus';

interface ReservationCardProps {
  res: {
    id: number | string;
    order_id?: number | string | null;
    status: string;
    date: string;
    time: string;
    guests: number;
    amount?: number | null;
    created_at?: string | null;
    cancel_reason?: string | null;
    refund_amount?: number | null;
    host_payout_amount?: number | null;
    guest?: {
      full_name?: string | null;
      avatar_url?: string | null;
      phone?: string | null;
      email?: string | null;
    } | null;
    experiences?: {
      title?: string | null;
    } | null;
  };
  isNew: boolean;
  isProcessing: boolean;
  onApproveCancel: () => void;
  onShowProfile: () => void;
  onCheck: () => void;
  onMessage: () => void;
  onCalendar: () => void;
  onCancelQuery: () => void;
  hasReview: boolean; // 🟢 추가
  onReview: () => void; // 🟢 추가
}

export default function ReservationCard({
  res, isNew, isProcessing,
  onApproveCancel, onShowProfile, onCheck, onMessage, onCalendar, onCancelQuery,
  hasReview, onReview // 🟢 추가
}: ReservationCardProps) {
  const { t, lang } = useLanguage(); // 🟢 2. 훅 사용
  const secureUrl = (url: string | null) => {
    if (!url) return null;
    return url.replace('http://', 'https://');
  };

  const getDDay = (dateString: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateString);
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) return t('res_card_ended'); // 🟢 번역
    if (diff === 0) return t('res_card_today'); // 🟢 번역
    return `D-${diff}`;
  };

  const renderStatusBadge = (status: string, date: string) => {
    // 🟢 날짜 비교 (오늘 자정 기준)
    const targetDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPast = targetDate < today;

    if (isCancellationRequestedBookingStatus(status))
      return <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-1 rounded-full font-bold animate-pulse flex items-center gap-1"><AlertTriangle size={10} /> {t('res_status_req')}</span>;

    if (isCancelledOnlyBookingStatus(status))
      return <span className="bg-red-100 text-red-700 text-[10px] px-2 py-1 rounded-full font-bold">{t('res_status_cancelled')}</span>;

    // 🟢 [수정] 입금 대기(PENDING) 상태 별도 처리 (반짝임 효과)
    if (isPendingBookingStatus(status)) {
      return (
        <span className="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1 animate-pulse">
          <div className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></div>
          입금 확인 중
        </span>
      );
    }

    // 🟢 [수정] PENDING 제거됨 (확정된 상태만 남김)
    if (isConfirmedBookingStatus(status)) {
      return isPast
        ? <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-1 rounded-full font-bold">{t('res_status_completed')}</span> // 이용 완료
        : <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1"><CheckCircle2 size={10} /> {t('res_status_paid')}</span>; // 예약 확정
    }

    return <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-1 rounded-full">{status}</span>;
  };

  const dDay = getDDay(res.date);
  const isConfirmed = isConfirmedBookingStatus(res.status);
  const targetDate = new Date(res.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = targetDate < today;
  const canReview = isPast && !isCancelledBookingStatus(res.status);
  const orderDisplay = String(res.order_id || res.id);

  // 🟢 결제 시간 다국어 포맷팅
  const localeMap: Record<string, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN' };

  const paymentTime = res.created_at ? new Date(res.created_at).toLocaleString(localeMap[lang], {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : '';

  // 🟢 월(Month) 이름도 언어에 맞게 변환
  const monthName = new Date(res.date).toLocaleString(localeMap[lang], { month: 'short' });

  return (
    <div
      className={`bg-white rounded-xl md:rounded-2xl border shadow-sm hover:shadow-md transition-all relative overflow-hidden group cursor-pointer
        ${isNew ? 'border-blue-200 ring-1 ring-blue-100' : 'border-slate-200'}
      `}
      onClick={onCheck}
    >
      {/* 상태 표시 컬러바 */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${isCancellationRequestedBookingStatus(res.status) ? 'bg-orange-400 animate-pulse' :
        isConfirmed ? 'bg-green-500' :
          isCancelledOnlyBookingStatus(res.status) ? 'bg-red-400' : 'bg-slate-200'
        }`} />

      {/* 모바일 레이아웃 (기존 유지) */}
      <div className="flex md:hidden items-center gap-2 pl-3 pr-2 py-3">

        {/* 날짜 미니 박스 */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center bg-slate-50 rounded-lg px-2 py-1.5 border border-slate-100 min-w-[44px]">
          <div className="text-[10px] font-bold text-slate-500 uppercase">{monthName}</div>
          <div className="text-base font-black text-slate-900 leading-none">{new Date(res.date).getDate()}</div>
          <div className="text-[9px] text-slate-400 mt-0.5">{res.time}</div>
        </div>

        {/* 메인 정보 영역 */}
        <div className="flex-1 min-w-0">
          {/* 이름 + 체험명 */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onShowProfile(); }}
              className="flex items-center gap-1.5 min-w-0 text-left"
            >
              <div className="w-5 h-5 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                {res.guest?.avatar_url ? (
                  <img src={secureUrl(res.guest.avatar_url)!} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><User size={10} className="text-slate-400" /></div>
                )}
              </div>
              <span className="text-[12px] font-bold text-slate-900 truncate">{res.guest?.full_name || '게스트'}</span>
            </button>
            <span className="text-[10px] text-slate-400 shrink-0">{res.guests}명</span>
            {isNew && <span className="bg-blue-500 text-white text-[9px] w-3.5 h-3.5 flex items-center justify-center rounded-full font-bold animate-pulse shrink-0">N</span>}
          </div>
          {/* 체험명 */}
          <p className="text-[10px] text-slate-400 truncate">{res.experiences?.title}</p>
        </div>

        {/* 우측: 상태 + 금액 + D-Day */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <span className={`text-[10px] font-black ${dDay === t('res_card_today') ? 'text-rose-600' : isConfirmed ? 'text-green-600' : 'text-slate-400'
            }`}>{dDay}</span>
          {renderStatusBadge(res.status, res.date)}
          <p className="text-[12px] font-black text-slate-900">₩{res.amount?.toLocaleString()}</p>
        </div>

        {/* 모바일: 메시지/캘린더 아이콘 스택 */}
        <div className="ml-1 shrink-0 flex flex-col gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onMessage(); }}
            className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center hover:bg-black transition-colors"
          >
            <MessageSquare size={14} />
          </button>
          {isConfirmed && (
            <button
              onClick={(e) => { e.stopPropagation(); onCalendar(); }}
              className="w-8 h-8 bg-white border border-slate-200 text-slate-600 rounded-lg flex items-center justify-center hover:bg-slate-50 transition-colors"
              aria-label="캘린더"
            >
              <CalendarPlus size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 데스크탑 레이아웃 (d1a622f 구조 복원 + 최신 로직 유지) */}
      <div className="hidden md:flex gap-6 pl-2 pr-6 py-6">
        {/* 좌측 날짜 패널 */}
        <div className="w-32 flex-shrink-0 flex flex-col items-center justify-center bg-slate-50 rounded-xl p-4 border border-slate-100">
          <span className={`text-xs font-bold px-2 py-1 rounded-full mb-2 ${dDay === t('res_card_today')
            ? 'bg-rose-100 text-rose-600'
            : isConfirmed
              ? 'bg-green-100 text-green-700'
              : 'bg-slate-200 text-slate-600'
            }`}>
            {dDay}
          </span>
          <div className="text-[30px] font-black text-slate-900 leading-none">{new Date(res.date).getDate()}</div>
          <div className="text-sm font-bold text-slate-500 uppercase mt-1">{monthName}</div>
          <div className="mt-2 text-xs font-medium text-slate-400 flex items-center gap-1">
            <Clock size={12} /> {res.time}
          </div>

          <div className="mt-2 pt-2 border-t border-slate-200 w-full text-center">
            <p className="text-[10px] text-slate-400">{t('res_payment_time')}</p>
            <p className="text-[10px] font-bold text-slate-600">{paymentTime || '-'}</p>
          </div>

          {isConfirmed && (
            <button
              onClick={(e) => { e.stopPropagation(); onCalendar(); }}
              className="mt-3 w-full text-[10px] bg-white border border-slate-200 py-1.5 rounded-lg flex items-center justify-center gap-1 hover:bg-slate-100 hover:text-blue-600 transition-colors"
            >
              <CalendarPlus size={12} /> {t('res_add_calendar')}
            </button>
          )}
        </div>

        {/* 중앙 상세 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-4 gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-400 mb-1 truncate">{res.experiences?.title || '-'}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-slate-400 uppercase tracking-wide">{t('res_order_number')}</span>
                <h4 className="text-[18px] font-bold text-slate-900 font-mono">#{orderDisplay}</h4>
                {isNew && (
                  <span className="bg-blue-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold animate-pulse">
                    N
                  </span>
                )}
                {renderStatusBadge(res.status, res.date)}
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-xs text-slate-400 font-bold mb-1">{t('res_expected_income')}</p>
              <p className="text-xl font-black text-slate-900">₩{res.amount?.toLocaleString()}</p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 flex flex-col lg:flex-row gap-6">
            <button
              onClick={(e) => { e.stopPropagation(); onShowProfile(); }}
              className="flex items-center gap-4 text-left cursor-pointer group/profile"
            >
              <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden border border-slate-200 group-hover/profile:ring-2 ring-slate-900 transition-all shrink-0">
                {res.guest?.avatar_url ? (
                  <img src={secureUrl(res.guest.avatar_url)!} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={20} /></div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-slate-900 group-hover/profile:underline underline-offset-2 decoration-2 truncate max-w-[160px]">
                    {res.guest?.full_name || '게스트'}
                  </p>
                  <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 shrink-0">{t('res_profile_btn')}</span>
                </div>
                <p className="text-xs text-slate-500">{res.guests}{t('res_people_count')}</p>
              </div>
            </button>

            {isConfirmed && (
              <div className="flex flex-col justify-center gap-2 text-sm text-slate-600 lg:border-l lg:border-slate-100 lg:pl-6 min-w-0">
                <div className="flex items-center gap-2 truncate">
                  <Phone size={14} className="text-slate-400 shrink-0" />
                  {res.guest?.phone || t('res_phone_none')}
                </div>
                <div className="flex items-center gap-2 truncate">
                  <Mail size={14} className="text-slate-400 shrink-0" />
                  {res.guest?.email || t('res_email_none')}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 우측 액션 영역 */}
        <div className="min-w-[140px] flex flex-col gap-2 justify-end border-l border-slate-100 pl-6">
          <button
            onClick={(e) => { e.stopPropagation(); onMessage(); }}
            className="w-full bg-slate-900 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <MessageSquare size={16} /> {t('res_message_btn')}
          </button>

          {canReview && (
            <button
              onClick={(e) => { e.stopPropagation(); if (!hasReview) onReview(); }}
              disabled={hasReview}
              className={`w-full px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors ${hasReview
                ? 'bg-slate-100 text-slate-400 cursor-default'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-900 hover:text-slate-900'
                }`}
            >
              <CheckCircle2 size={16} className={hasReview ? "text-slate-400" : "text-blue-500"} />
              {hasReview ? '후기 작성됨' : '게스트 후기'}
            </button>
          )}
        </div>
      </div>

      {/* 취소 요청 승인 박스 */}
      {isCancellationRequestedBookingStatus(res.status) && (
        <div className="mx-3 md:mx-2 mb-3 md:mb-4 bg-orange-50 border border-orange-100 rounded-xl p-3 md:p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={16} />
            <div className="flex-1">
              <p className="font-bold text-orange-900 text-[12px]">{t('res_cancel_req_title')}</p>
              <p className="text-[11px] text-orange-700 mt-0.5 mb-2">{t('res_cancel_reason')}: {res.cancel_reason || t('res_reason_none')}</p>
              <button
                onClick={(e) => { e.stopPropagation(); onApproveCancel(); }}
                disabled={isProcessing}
                className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-orange-700 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={12} /> : <CheckCircle2 size={12} />}
                {t('res_approve_btn')}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onCancelQuery(); }}
                className="mt-2 bg-white border border-orange-200 text-orange-700 px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-orange-100 transition-colors"
              >
                취소 사유 문의
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 취소 완료 사유 박스 */}
      {isCancelledOnlyBookingStatus(res.status) && (
        <div className="mx-3 md:mx-2 mb-3 md:mb-4 bg-slate-50 border border-slate-100 rounded-xl p-3 md:p-4">
          <div className="text-[11px] md:text-xs text-slate-500">
            <span className="font-bold block mb-0.5 text-slate-700">{t('res_cancel_detail_title')}</span>
            <p className="mb-0.5">{t('res_cancel_reason')}: {res.cancel_reason || '-'}</p>
            <div className="flex gap-3 font-mono text-[10px] text-slate-400">
              <span>{t('res_refund_amount')}: {res.refund_amount?.toLocaleString()}</span>
              <span>{t('res_penalty_profit')}: {res.host_payout_amount?.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
