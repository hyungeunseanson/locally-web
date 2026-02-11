'use client';

import React from 'react';
import { 
  Clock, User, CheckCircle2, MessageSquare, 
  Phone, Mail, XCircle, AlertTriangle, Loader2, CalendarPlus 
} from 'lucide-react';

// ✅ [수정 후] (이렇게 바꾸세요)
interface Props {
    res: any;
    isNew: boolean;
    isProcessing: boolean; // ⭕ boolean으로 변경
    onCalendar: () => void;       // 인자 제거 (부모가 처리함)
    onMessage: () => void;
    onCancelQuery: () => void;
    onApproveCancel: () => void;
    onShowProfile: () => void;
    onCheck: () => void;
  }

// ✅ [수정 후]
export default function ReservationCard({ 
    res, isNew, isProcessing, // ⭕ 이름 변경
    onCalendar, onMessage, onCancelQuery, onApproveCancel, onShowProfile, onCheck 
  }: Props) {

  const secureUrl = (url: string | null) => {
    if (!url) return null;
    return url.replace('http://', 'https://');
  };

  const getDDay = (dateString: string) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(dateString);
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff < 0) return '종료';
    if (diff === 0) return 'Today';
    return `D-${diff}`;
  };

  const renderStatusBadge = (status: string, date: string) => {
    const isPast = new Date(date) < new Date();
    
    if (status === 'cancellation_requested') 
      return <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-1 rounded-full font-bold animate-pulse flex items-center gap-1"><AlertTriangle size={10}/> 취소 요청됨</span>;
    if (status === 'cancelled') 
      return <span className="bg-red-100 text-red-700 text-[10px] px-2 py-1 rounded-full font-bold">취소 완료</span>;
    if (status === 'PAID' || status === 'confirmed') {
      return isPast 
        ? <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-1 rounded-full font-bold">이용 완료</span>
        : <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1"><CheckCircle2 size={10}/> 예약 확정</span>;
    }
    return <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-1 rounded-full">{status}</span>;
  };

  const dDay = getDDay(res.date);
  const isConfirmed = res.status === 'confirmed' || res.status === 'PAID';

  return (
    // 🎨 테두리 색상 빨간색 제거 -> 깔끔한 스타일 유지
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
      
      {/* 왼쪽 컬러바 */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
        res.status === 'cancellation_requested' ? 'bg-orange-400 animate-pulse' :
        isConfirmed ? 'bg-green-500' : 
        res.status === 'cancelled' ? 'bg-red-400' : 'bg-slate-300'
      }`}/>

      <div className="flex flex-col md:flex-row gap-6">
        
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
            {new Date(res.date).toLocaleString('en-US', { month: 'short' })}
          </div>
          <div className="mt-2 text-xs font-medium text-slate-400 flex items-center gap-1">
            <Clock size={12}/> {res.time}
          </div>
          {isConfirmed && (
            <button 
              onClick={(e) => { e.stopPropagation(); onCalendar(); }}
              className="mt-3 w-full text-[10px] bg-white border border-slate-200 py-1.5 rounded-lg flex items-center justify-center gap-1 hover:bg-slate-100 hover:text-blue-600 transition-colors"
              title="캘린더에 추가"
            >
              <CalendarPlus size={12}/> 일정 추가
            </button>
          )}
        </div>

        {/* 상세 정보 */}
        <div className="flex-1">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold text-slate-400 mb-1">{res.experiences?.title}</p>
              <div className="flex items-center gap-2">
                 <h4 className="text-lg font-bold text-slate-900">예약 #{String(res.id).slice(0, 8)}</h4>
                 
                 {isNew && (
                   <button 
                     onClick={(e) => {
                       e.stopPropagation();
                       onCheck(); // ✅ 누르면 사라짐
                     }}
                     className="bg-rose-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold animate-pulse hover:bg-rose-600 cursor-pointer"
                     title="클릭하여 확인 표시 제거"
                   >
                     N
                   </button>
                 )}
                 
                 {renderStatusBadge(res.status, res.date)}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 font-bold mb-1">예상 수입</p>
              <p className="text-xl font-black text-slate-900">₩{res.amount?.toLocaleString()}</p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row gap-6">
            
            {/* 게스트 프로필 (클릭 시 모달) */}
            <div 
              className="flex items-center gap-4 cursor-pointer group/profile"
              onClick={(e) => {
                e.stopPropagation(); 
                onCheck(); 
                onShowProfile();
              }}
            >
              <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden border border-slate-200 group-hover/profile:ring-2 ring-slate-900 transition-all">
                {res.guest?.avatar_url ? (
                  <img src={secureUrl(res.guest.avatar_url)!} className="w-full h-full object-cover" alt="Guest" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={20}/></div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="font-bold text-slate-900 group-hover/profile:underline underline-offset-2 decoration-2">{res.guest?.full_name || '게스트'}</p>
                  <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">프로필 보기</span>
                </div>
                <p className="text-xs text-slate-500">{res.guests}명 참여</p>
              </div>
            </div>

            {/* ✅ 연락처 정보: 확정되면 무조건 노출 */}
            {isConfirmed && (
              <div className="flex flex-col justify-center gap-2 text-sm text-slate-600 border-l border-slate-100 pl-6">
                  <div className="flex items-center gap-2 hover:text-black cursor-pointer">
                    <Phone size={14} className="text-slate-400"/> {res.guest?.phone || '번호 없음'}
                  </div>
                  <div className="flex items-center gap-2 hover:text-black cursor-pointer">
                    <Mail size={14} className="text-slate-400"/> {res.guest?.email || '메일 없음'}
                  </div>
                  {res.guest?.kakao_id && (
                    <div className="flex items-center gap-2 hover:text-yellow-600 cursor-pointer text-slate-600">
                      <div className="w-3.5 h-3.5 bg-yellow-400 rounded-sm flex items-center justify-center">
                        <MessageSquare size={8} className="text-yellow-900" fill="currentColor"/>
                      </div>
                      {res.guest.kakao_id}
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>

{/* 액션 버튼들 - 메시지 버튼만 남김 */}
<div className="flex flex-row md:flex-col gap-2 justify-center border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 min-w-[140px]">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onCheck(); 
onMessage();
            }}
            className="w-full h-full bg-slate-900 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <MessageSquare size={16}/> 메시지
          </button>
        </div>
      </div>

      {/* 취소 요청 승인 박스 */}
      {res.status === 'cancellation_requested' && (
        <div className="mt-4 bg-orange-50 border border-orange-100 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
           <div className="flex items-start gap-3">
             <AlertTriangle className="text-orange-500 shrink-0 mt-1" size={20} />
             <div className="flex-1">
               <p className="font-bold text-orange-900">취소 요청이 접수되었습니다.</p>
               <p className="text-sm text-orange-700 mt-1">게스트 사유: {res.cancel_reason || '사유 없음'}</p>
               <button 
  onClick={(e) => { e.stopPropagation(); onApproveCancel(); }} // 인자 제거
  disabled={isProcessing}
                 className="mt-3 bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-orange-700 transition-colors flex items-center gap-2 shadow-md"
               >
{isProcessing ? <Loader2 className="animate-spin" size={16}/> : <CheckCircle2 size={16}/>} {/* ⭕ 변수 교체 */}
  요청 승인 및 환불해주기
</button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
}