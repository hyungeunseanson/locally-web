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
    today.setHours(0,0,0,0);
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
      return <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-1 rounded-full font-bold animate-pulse flex items-center gap-1"><AlertTriangle size={10}/> {t('res_status_req')}</span>;
    
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
        : <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1"><CheckCircle2 size={10}/> {t('res_status_paid')}</span>; // 예약 확정
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
      className={`bg-white rounded-2xl p-6 border shadow-sm hover:shadow-md transition-all relative overflow-hidden group cursor-pointer
        ${isNew ? 'border-blue-200 ring-1 ring-blue-100' : 'border-slate-200'}
      `}
      onClick={onCheck} // 카드 클릭 시 읽음 처리
    >
      
      {/* 상태 표시 컬러바 */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
        res.status === 'cancellation_requested' ? 'bg-orange-400 animate-pulse' :
        isConfirmed ? 'bg-green-500' : 
        res.status === 'cancelled' ? 'bg-red-400' : 'bg-slate-300'
      }`}/>

      <div className="flex flex-col md:flex-row gap-6 pl-2">
        
        {/* 날짜 박스 */}
        <div className="md:w-32 flex-shrink-0 flex flex-col items-center justify-center bg-slate-50 rounded-xl p-4 border border-slate-100">
          <span className={`text-xs font-bold px-2 py-1 rounded-full mb-2 ${
            dDay === 'Today' ? 'bg-rose-100 text-rose-600' : 
            isConfirmed ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
          }`}>
            {dDay}
          </span>
          <div className="text-2xl font-black text-slate-900">{new Date(res.date).getDate()}</div>
          <div className="text-sm font-bold text-slate-500 uppercase">
            {monthName} {/* 🟢 다국어 월 표시 */}
          </div>
          <div className="mt-2 text-xs font-medium text-slate-400 flex items-center gap-1">
            <Clock size={12}/> {res.time}
          </div>
          
          <div className="mt-2 pt-2 border-t border-slate-200 w-full text-center">
          <p className="text-[10px] text-slate-400">{t('res_paid_at')}</p> {/* 🟢 번역 */}
            <p className="text-[10px] font-bold text-slate-600">{paymentTime}</p>
          </div>

          {isConfirmed && (
            <button 
              onClick={(e) => { e.stopPropagation(); onCalendar(); }}
              className="mt-3 w-full text-[10px] bg-white border border-slate-200 py-1.5 rounded-lg flex items-center justify-center gap-1 hover:bg-slate-100 hover:text-blue-600 transition-colors"
              title={t('res_add_calendar')}
              >
                <CalendarPlus size={12}/> {t('res_add_calendar')} {/* 🟢 번역 */}
            </button>
          )}
        </div>

        {/* 상세 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold text-slate-400 mb-1 truncate">{res.experiences?.title}</p>
              <div className="flex items-center gap-2 flex-wrap">
                 {/* 🟢 오더번호 전체 표시 (수정됨) */}
                 <h4 className="text-sm md:text-lg font-bold text-slate-900 font-mono">
                   {res.order_id || res.id}
                 </h4>
                 
                 {isNew && (
                   <span className="bg-blue-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold animate-pulse">
                     N
                   </span>
                 )}
                 
                 {renderStatusBadge(res.status, res.date)}
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
            <p className="text-xs text-slate-400 font-bold mb-1">{t('res_income')}</p> {/* 🟢 번역 */}
              <p className="text-lg md:text-xl font-black text-slate-900">₩{res.amount?.toLocaleString()}</p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row gap-6">
            
            {/* 게스트 프로필 */}
            <div 
              className="flex items-center gap-4 cursor-pointer group/profile"
              onClick={(e) => { e.stopPropagation(); onShowProfile(); }}
            >
              <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden border border-slate-200 group-hover/profile:ring-2 ring-slate-900 transition-all shrink-0">
                {res.guest?.avatar_url ? (
                  <img src={secureUrl(res.guest.avatar_url)!} className="w-full h-full object-cover" alt="Guest" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={20}/></div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <p className="font-bold text-slate-900 group-hover/profile:underline underline-offset-2 decoration-2 truncate max-w-[120px]">
                    {res.guest?.full_name || '게스트'}
                  </p>
                  <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 shrink-0">{t('res_profile_btn')}</span> {/* 🟢 번역 */}
                </div>
                <p className="text-xs text-slate-500">{res.guests}{t('res_people_count')}</p> {/* 🟢 번역 */}
              </div>
            </div>

            {/* 연락처 정보 */}
            {isConfirmed && (
              <div className="flex flex-col justify-center gap-2 text-sm text-slate-600 sm:border-l sm:border-slate-100 sm:pl-6">
                  <div className="flex items-center gap-2 truncate">
                  <Phone size={14} className="text-slate-400 shrink-0"/> {res.guest?.phone || t('res_phone_none')} {/* 🟢 번역 */}
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <Mail size={14} className="text-slate-400 shrink-0"/> {res.guest?.email || t('res_email_none')} {/* 🟢 번역 */}
                  </div>
                  {res.guest?.kakao_id && (
                    <div className="flex items-center gap-2 text-slate-600 truncate">
                      <div className="w-3.5 h-3.5 bg-yellow-400 rounded-sm flex items-center justify-center shrink-0">
                        <MessageSquare size={8} className="text-yellow-900" fill="currentColor"/>
                      </div>
                      {res.guest.kakao_id}
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>

{/* 액션 버튼 */}
<div className="flex flex-row md:flex-col gap-2 justify-end border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 min-w-[100px]">
          <button 
            onClick={(e) => { e.stopPropagation(); onMessage(); }}
            className="w-full h-full bg-slate-900 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <MessageSquare size={16}/> {t('res_message_btn')} {/* 🟢 번역 */}
          </button>

          {/* 🟢 [수정] 날짜가 지났고(isPast) 유효한 예약이면 후기 버튼 표시 */}
          {(() => {
            const targetDate = new Date(res.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isPast = targetDate < today;
            const isValid = !['cancelled', 'cancellation_requested', 'declined'].includes(res.status);

            return isPast && isValid && (
              <button 
                onClick={(e) => { e.stopPropagation(); if(!hasReview) onReview(); }}
                disabled={hasReview}
                className={`w-full h-full px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors ${
                  hasReview 
                    ? 'bg-slate-100 text-slate-400 cursor-default' 
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-900 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 size={16} className={hasReview ? "text-slate-400" : "text-blue-500"}/> 
                {hasReview ? '후기 작성됨' : '게스트 후기'}
              </button>
            );
          })()}
        </div>
      </div>

      {/* 취소 요청 승인 박스 */}
      {res.status === 'cancellation_requested' && (
        <div className="mt-4 bg-orange-50 border border-orange-100 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 ml-2">
           <div className="flex items-start gap-3">
             <AlertTriangle className="text-orange-500 shrink-0 mt-1" size={20} />
             <div className="flex-1">
             <p className="font-bold text-orange-900">{t('res_cancel_req_title')}</p> {/* 🟢 번역 */}
             <p className="text-sm text-orange-700 mt-1 mb-2">{t('res_cancel_reason')}: {res.cancel_reason || t('res_reason_none')}</p> {/* 🟢 번역 */}
               <button 
                 onClick={(e) => { e.stopPropagation(); onApproveCancel(); }}
                 disabled={isProcessing}
                 className="bg-orange-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-orange-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
               >
                 {isProcessing ? <Loader2 className="animate-spin" size={14}/> : <CheckCircle2 size={14}/>}
                 {t('res_approve_btn')} {/* 🟢 번역 */}
                 </button>
             </div>
           </div>
        </div>
      )}

      {/* 🟢 취소 완료 사유 박스 (추가됨) */}
      {res.status === 'cancelled' && (
        <div className="mt-4 bg-slate-50 border border-slate-100 rounded-xl p-4 ml-2">
<div className="text-xs text-slate-500">
              <span className="font-bold block mb-1 text-slate-700">{t('res_cancel_detail_title')}</span> {/* 🟢 번역 */}
              <p className="mb-1">{t('res_cancel_reason')}: {res.cancel_reason || '-'}</p> {/* 🟢 번역 */}
              <div className="flex gap-3 font-mono text-[10px] text-slate-400">
                 <span>{t('res_refund_amount')}: {res.refund_amount?.toLocaleString()}</span> {/* 🟢 번역 */}
                 <span>{t('res_penalty_profit')}: {res.host_payout_amount?.toLocaleString()}</span> {/* 🟢 번역 */}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}