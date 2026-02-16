'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface ReservationCardProps {
  price: number;
  privatePrice?: number;
  isPrivateEnabled?: boolean;
  duration: number;
  availableDates: string[];
  dateToTimeMap: Record<string, string[]>;
  maxGuests?: number; // 🟢 추가됨
  remainingSeatsMap?: Record<string, number>; // 🟢 추가됨
  onReserve: (date: string, time: string, guests: number, isPrivate: boolean) => void;
}

export default function ReservationCard({ 
  price, privatePrice = 0, isPrivateEnabled = false, 
  duration, availableDates, dateToTimeMap, onReserve, 
  maxGuests = 10, remainingSeatsMap = {} 
}: ReservationCardProps) {
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [guestSelection, setGuestSelection] = useState<string>("1"); 
  const [isSoloGuaranteed, setIsSoloGuaranteed] = useState(false);
  const SOLO_GUARANTEE_PRICE = 30000;

  // 🟢 [핵심] 잔여석 계산 로직 (시간 문자열 HH:MM 포맷 주의)
  const cleanTime = selectedTime.substring(0, 5); 
  const currentKey = `${selectedDate}_${cleanTime}`;
  
  // 선택된 시간의 잔여석 (없으면 최대 정원)
  const remainingSeats = (selectedDate && selectedTime) 
    ? (remainingSeatsMap[currentKey] ?? maxGuests) 
    : maxGuests;

  // 인원 선택 최대값 제한 (잔여석 vs 최대정원 중 작은 값)
  const maxSelectable = Math.max(1, Math.min(remainingSeats, maxGuests));

  // 날짜 계산 헬퍼
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDay = (y: number, m: number) => new Date(y, m, 1).getDay();
  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
  };
  const calculateEndTime = (startTime: string) => {
    if (!startTime) return '';
    const [hour, minute] = startTime.split(':').map(Number);
    return `${hour + duration}:${String(minute).padStart(2, '0')}`;
  };

  // 달력 렌더링
  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysCount = getDaysInMonth(year, month);
    const startBlank = getFirstDay(year, month);
    const days = [];
    for (let i = 0; i < startBlank; i++) days.push(<div key={`empty-${i}`} />);
    for (let d = 1; d <= daysCount; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isAvailable = availableDates.includes(dateStr);
      const isSelected = selectedDate === dateStr;
      days.push(
        <button key={d} disabled={!isAvailable} 
          onClick={() => { setSelectedDate(dateStr); setSelectedTime(""); }}
          className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-medium transition-all ${isSelected ? 'bg-black text-white' : ''} ${!isSelected && isAvailable ? 'hover:bg-slate-100 hover:border-black border border-transparent' : ''} ${!isSelected && !isAvailable ? 'text-slate-300 decoration-slate-300 line-through' : ''}`}>
          {d}
        </button>
      );
    }
    return days;
  };

  // 가격 계산
  const isPrivate = guestSelection === 'private';
  const guestCount = isPrivate ? 1 : Number(guestSelection);
  const basePrice = isPrivate ? privatePrice : (price * guestCount);
  const optionPrice = (!isPrivate && guestCount === 1 && isSoloGuaranteed) ? SOLO_GUARANTEE_PRICE : 0;
  const totalPrice = basePrice + optionPrice;

  return (
    <div className="sticky top-28 border border-slate-200 shadow-[0_6px_16px_rgba(0,0,0,0.12)] rounded-2xl p-6 bg-white">
      <div className="flex justify-between items-end mb-6">
        <div>
          <span className="text-2xl font-bold">₩{isPrivate ? privatePrice.toLocaleString() : price.toLocaleString()}</span> 
          <span className="text-slate-500 text-sm"> {isPrivate ? '/ 팀 (단독)' : '/ 인'}</span>
        </div>
      </div>

      <div className="border border-slate-300 rounded-xl mb-4 overflow-hidden">
        {/* 달력 헤더 */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex justify-between items-center mb-4">
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()-1)))}><ChevronLeft size={16}/></button>
            <span className="font-bold text-sm">{currentDate.getFullYear()}년 {currentDate.getMonth()+1}월</span>
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()+1)))}><ChevronRight size={16}/></button>
          </div>
          <div className="grid grid-cols-7 text-center mb-2">
            {['일','월','화','수','목','금','토'].map(d=><span key={d} className="text-[10px] text-slate-400 font-bold">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-y-1 justify-items-center">
            {renderCalendar()}
          </div>
        </div>

        {/* 🟢 인원 선택 (잔여석 반영 로직 적용됨) */}
        <div className="p-3 bg-white flex justify-between items-center border-t border-slate-200">
          <div className="flex flex-col w-full">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold uppercase text-slate-800">인원</span>
              {selectedTime && (
                <span className="text-[10px] text-rose-500 font-bold">
                  {remainingSeats <= 0 ? '매진' : remainingSeats <= 3 ? `${remainingSeats}자리 남음` : ''}
                </span>
              )}
            </div>
            
            <select 
              value={guestSelection} 
              onChange={(e)=>setGuestSelection(e.target.value)} 
              className="text-sm outline-none bg-transparent font-bold w-full cursor-pointer py-1"
            >
              <optgroup label="일반 예약">
                {/* 🟢 남은 자리까지만 선택 가능하게 제한 (최대 6명 UI 제한 유지) */}
                {Array.from({ length: Math.min(maxSelectable, 6) }, (_, i) => i + 1).map(n => (
                  <option key={n} value={String(n)}>게스트 {n}명</option>
                ))}
              </optgroup>
              {isPrivateEnabled && (
                <optgroup label="프라이빗 옵션">
                  <option value="private">🔒 단독 투어 (우리끼리만)</option>
                </optgroup>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* 시간 선택 */}
      {selectedDate && (
        <div className="mb-4 animate-in fade-in zoom-in-95 duration-200">
          <p className="text-xs font-bold text-slate-500 mb-2">시간 선택 ({formatDateDisplay(selectedDate)})</p>
          <div className="grid grid-cols-2 gap-2">
            {dateToTimeMap[selectedDate]?.map(time => {
              // 🟢 시간대별 잔여석 확인 및 매진 처리
              const tClean = time.substring(0, 5);
              const tKey = `${selectedDate}_${tClean}`;
              const tSeats = remainingSeatsMap[tKey] ?? maxGuests;
              
              return (
                <button 
                  key={time} 
                  onClick={() => setSelectedTime(tClean)}
                  disabled={tSeats <= 0} // 🟢 매진 시 클릭 불가
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all flex flex-col items-center 
                    ${selectedTime === tClean ? 'bg-black text-white border-black' : 
                      tSeats <= 0 ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed line-through' :
                      'bg-white text-slate-700 border-slate-200 hover:border-black'}`}
                >
                  <span>{time}</span>
                  <span className={`text-[10px] font-normal ${selectedTime === tClean ? 'text-slate-300' : 'text-slate-400'}`}>
                    {tSeats <= 0 ? '매진' : `~ ${calculateEndTime(time)}`} 
                    {/* 🟢 5석 이하 시 강조 */}
                    {tSeats > 0 && tSeats <= 5 && <span className="ml-1 text-rose-500">({tSeats}석)</span>}
                  </span>
                </button>
              );
            })}
          </div>
          {(!dateToTimeMap[selectedDate] || dateToTimeMap[selectedDate].length === 0) && (
            <div className="text-center text-xs text-slate-400 py-4 bg-slate-50 rounded-lg">예약 가능한 시간이 없습니다.</div>
          )}
        </div>
      )}

      {/* 1인 옵션 */}
      {!isPrivate && guestCount === 1 && (
        <div className={`p-4 mb-4 rounded-xl border-2 cursor-pointer transition-all ${isSoloGuaranteed ? 'border-black bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`} onClick={() => setIsSoloGuaranteed(!isSoloGuaranteed)}>
          <div className="flex items-start gap-3">
            <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${isSoloGuaranteed ? 'bg-black border-black' : 'border-slate-300 bg-white'}`}>
              {isSoloGuaranteed && <Check size={12} className="text-white" strokeWidth={4}/>}
            </div>
            <div>
              <div className="font-bold text-sm mb-1">1인 출발 확정 옵션</div>
              <div className="text-xs text-slate-500 leading-tight">최소 인원 미달 시에도 취소 없이 출발합니다. <br/><span className="text-rose-500 font-bold">*추가 인원 모객 시 자동 환불</span></div>
              <div className="font-bold text-sm mt-2 text-slate-900">+ ₩{SOLO_GUARANTEE_PRICE.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      <button onClick={() => onReserve(selectedDate, selectedTime, guestCount, isPrivate)} className="w-full bg-gradient-to-r from-rose-500 to-rose-600 text-white font-bold py-3.5 rounded-xl hover:shadow-lg hover:scale-[1.01] transition-all mb-4">
        {isPrivate ? '단독 투어 예약하기' : '예약하기'}
      </button>
      
      <div className="space-y-2 pt-4 border-t border-slate-100 text-sm">
        <div className="flex justify-between text-slate-600">
          <span className="underline">{isPrivate ? '프라이빗 단독 요금' : `₩${price.toLocaleString()} x ${guestCount}명`}</span>
          <span>₩{basePrice.toLocaleString()}</span>
        </div>
        {!isPrivate && guestCount === 1 && isSoloGuaranteed && <div className="flex justify-between text-slate-600"><span className="underline">1인 출발 확정비</span><span>₩{optionPrice.toLocaleString()}</span></div>}
      </div>
      
      <div className="flex justify-between font-bold pt-4 border-t border-slate-100 mt-4 text-lg"><span>총 합계</span><span>₩{totalPrice.toLocaleString()}</span></div>
    </div>
  );
}