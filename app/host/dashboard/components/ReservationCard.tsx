'use client';

import React from 'react';
import {
  Clock, User, CheckCircle2, MessageSquare,
  Phone, Mail, XCircle, AlertTriangle, Loader2, CalendarPlus
} from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';

interface ReservationCardProps {
  res: any;
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

    if (status === 'cancellation_requested')
      return <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-1 rounded-full font-bold animate-pulse flex items-center gap-1"><AlertTriangle size={10} /> {t('res_status_req')}</span>;

    if (status === 'cancelled')
      return <span className="bg-red-100 text-red-700 text-[10px] px-2 py-1 rounded-full font-bold">{t('res_status_cancelled')}</span>;

    // 🟢 [수정] 입금 대기(PENDING) 상태 별도 처리 (반짝임 효과)
    if (status === 'PENDING') {
      return (
        <span className="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1 animate-pulse">
          <div className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></div>
          입금 확인 중
        </span>
      );
    }

    // 🟢 [수정] PENDING 제거됨 (확정된 상태만 남김)
    if (['PAID', 'confirmed', 'completed'].includes(status)) {
      return isPast
        ? <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-1 rounded-full font-bold">{t('res_status_completed')}</span> // 이용 완료
        : <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1"><CheckCircle2 size={10} /> {t('res_status_paid')}</span>; // 예약 확정
    }

    return <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-1 rounded-full">{status}</span>;
  };

  const dDay = getDDay(res.date);
  const isConfirmed = res.status === 'confirmed' || res.status === 'PAID';

  // 🟢 결제 시간 다국어 포맷팅
  const localeMap: Record<string, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN' };

  const paymentTime = res.created_at ? new Date(res.created_at).toLocaleString(localeMap[lang], {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : '';

  // 🟢 월(Month) 이름도 언어에 맞게 변환
  const monthName = new Date(res.date).toLocaleString(localeMap[lang], { month: 'short' });

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all relative overflow-hidden group cursor-pointer
        ${isNew ? 'border-blue-200 ring-1 ring-blue-100' : 'border-slate-200'}
      `}
      onClick={onCheck}
    >
      {/* 상태 표시 컬러바 */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${res.status === 'cancellation_requested' ? 'bg-orange-400 animate-pulse' :
        isConfirmed ? 'bg-green-500' :
          res.status === 'cancelled' ? 'bg-red-400' : 'bg-slate-200'
        }`} />

      {/* 핵심: 모바일에서도 한 줄 가로 배치 */}
      <div className="flex items-center gap-2 pl-3 pr-2 py-3">

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
            <div className="w-5 h-5 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
              {res.guest?.avatar_url ? (
                <img src={secureUrl(res.guest.avatar_url)!} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><User size={10} className="text-slate-400" /></div>
              )}
            </div>
            <span className="text-[12px] font-bold text-slate-900 truncate">{res.guest?.full_name || '게스트'}</span>
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

        {/* 메시지 버튼 */}
        <button
          onClick={(e) => { e.stopPropagation(); onMessage(); }}
          className="ml-1 shrink-0 w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center hover:bg-black transition-colors"
        >
          <MessageSquare size={14} />
        </button>
      </div>

      {/* 확정된 예약: 연락처 정보 (접히는 방식 – 항상 표시) */}
      {isConfirmed && (
        <div className="border-t border-slate-100 px-3 py-2 flex items-center gap-4 bg-slate-50/50">
          <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
            <Phone size={11} className="shrink-0 text-slate-400" />{res.guest?.phone || '-'}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
            <Mail size={11} className="shrink-0 text-slate-400" />{res.guest?.email || '-'}
          </div>
          {isConfirmed && (
            <button
              onClick={(e) => { e.stopPropagation(); onCalendar(); }}
              className="ml-auto shrink-0 text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-slate-100 hover:text-blue-600 transition-colors"
            >
              <CalendarPlus size={11} /> 캘린더
            </button>
          )}
        </div>
      )}

      {/* 액션 버튼 (후기 – 모바일 숨김, 데스크탑만) */}
      <div className="hidden md:flex flex-col gap-2 justify-end border-l border-slate-100 pt-0 pl-6 min-w-[100px]">
        <button
          onClick={(e) => { e.stopPropagation(); onMessage(); }}
          className="w-full bg-slate-900 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <MessageSquare size={16} /> {t('res_message_btn')}
        </button>

        {(() => {
          const targetDate = new Date(res.date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const isPast = targetDate < today;
          const isValid = !['cancelled', 'cancellation_requested', 'declined'].includes(res.status);

          return isPast && isValid && (
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
          );
        })()}
      </div>

      {/* 취소 요청 승인 박스 */}
      {res.status === 'cancellation_requested' && (
        <div className="mx-3 mb-3 bg-orange-50 border border-orange-100 rounded-xl p-3 animate-in fade-in slide-in-from-top-2">
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
            </div>
          </div>
        </div>
      )}

      {/* 취소 완료 사유 박스 */}
      {res.status === 'cancelled' && (
        <div className="mx-3 mb-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
          <div className="text-[11px] text-slate-500">
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