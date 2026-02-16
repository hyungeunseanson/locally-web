'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Check, Clock, Trash2, X, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/app/context/ToastContext';

type TimeSlot = string; 
type AvailabilityMap = Record<string, TimeSlot[]>;
type BookingCountMap = Record<string, number>; // "2024-05-01_10:00": 3 (예약수)

export default function ManageDatesPage() {
  const supabase = createClient();
  const params = useParams();
  const { showToast } = useToast();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [availability, setAvailability] = useState<AvailabilityMap>({});
  const [initialData, setInitialData] = useState<AvailabilityMap>({}); 
  const [bookingCounts, setBookingCounts] = useState<BookingCountMap>({}); // 🟢 실제 예약 카운트 저장
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 1. 데이터 불러오기 (슬롯 + 실제 예약 내역)
  const fetchDates = async () => {
    // (1) 슬롯 가져오기 (컬럼 최소화)
    const { data: slots, error: slotError } = await supabase
      .from('experience_availability')
      .select('date, start_time') // 🟢 current_bookings 제거
      .eq('experience_id', params.id);
    
    if (slotError) {
        console.error("Slot fetch error:", slotError);
        return;
    }

    // (2) 실제 유효한 예약 가져오기 (confirmed, paid 등)
    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('date, time')
      .eq('experience_id', params.id)
      .in('status', ['confirmed', 'paid', 'completed']); // 유효한 예약 상태만

    // (3) 데이터 가공
    const availMap: AvailabilityMap = {};
    if (slots) {
      slots.forEach((item: any) => {
        if (!availMap[item.date]) availMap[item.date] = [];
        availMap[item.date].push(item.start_time);
      });
    }
    
    // 예약 카운트 맵 생성 ("날짜_시간" 키)
    const countMap: BookingCountMap = {};
    if (bookings) {
        bookings.forEach((b: any) => {
            const key = `${b.date}_${b.time}`;
            countMap[key] = (countMap[key] || 0) + 1;
        });
    }

    setAvailability(JSON.parse(JSON.stringify(availMap))); 
    setInitialData(JSON.parse(JSON.stringify(availMap))); 
    setBookingCounts(countMap); // 🟢 예약 상태 저장
  };

  useEffect(() => { fetchDates(); }, []);

  const handleDateClick = (dateStr: string) => setSelectedDate(dateStr);

  const addTimeSlot = (time: string) => {
    if (!selectedDate) return;
    setAvailability(prev => {
      const currentSlots = prev[selectedDate] || [];
      if (currentSlots.includes(time)) return prev;
      return { ...prev, [selectedDate]: [...currentSlots, time].sort() };
    });
  };

  const removeTimeSlot = (time: string) => {
    if (!selectedDate) return;
    
    // 🟢 UI에서 삭제 시도 시 예약 확인 (UX 강화)
    const bookingKey = `${selectedDate}_${time}`;
    if (bookingCounts[bookingKey] > 0) {
        alert(`⚠️ 해당 시간(${time})에는 확정된 예약이 ${bookingCounts[bookingKey]}건 있어 삭제할 수 없습니다.`);
        return;
    }

    setAvailability(prev => {
      const newSlots = (prev[selectedDate] || []).filter(t => t !== time);
      const newMap = { ...prev, [selectedDate]: newSlots };
      if (newSlots.length === 0) delete newMap[selectedDate];
      return newMap;
    });
  };

  // 🟢 스마트 저장 로직 (DB 수정 없이 bookings 테이블 조회로 안전장치 마련)
  const handleSave = async () => {
    if (!confirm('일정을 저장하시겠습니까?')) return;
    setLoading(true);

    try {
      const toInsert: any[] = [];
      const toDelete: { date: string, time: string }[] = [];

      // 1. 추가할 슬롯 찾기
      for (const [date, times] of Object.entries(availability)) {
        const initialTimes = initialData[date] || [];
        times.forEach(time => {
          if (!initialTimes.includes(time)) {
            toInsert.push({
              experience_id: params.id,
              date: date,
              start_time: time,
              is_booked: false 
              // 🟢 current_bookings 필드 제거 (에러 원인)
            });
          }
        });
      }

      // 2. 삭제할 슬롯 찾기
      for (const [date, times] of Object.entries(initialData)) {
        const currentTimes = availability[date] || [];
        times.forEach(time => {
          if (!currentTimes.includes(time)) {
            toDelete.push({ date, time });
          }
        });
      }

      // 3. 실행
      // (1) Insert
      if (toInsert.length > 0) {
        const { error } = await supabase.from('experience_availability').insert(toInsert);
        if (error) throw error;
      }

      // (2) Delete (DB체크 한 번 더 - 안전 삭제)
      for (const item of toDelete) {
        // 실제 bookings 테이블에 예약이 있는지 확인 (더 확실한 안전장치)
        const { count } = await supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('experience_id', params.id)
          .eq('date', item.date)
          .eq('time', item.time)
          .in('status', ['confirmed', 'paid', 'completed']);

        if (count && count > 0) {
           // 예약이 있으면 삭제 스킵하고 경고
           console.warn(`Skipped deletion for ${item.date} ${item.time} due to active bookings.`);
           // (선택사항) 사용자에게 알림을 줄 수도 있음
        } else {
          await supabase
            .from('experience_availability')
            .delete()
            .eq('experience_id', params.id)
            .eq('date', item.date)
            .eq('start_time', item.time);
        }
      }

      showToast('일정이 성공적으로 업데이트되었습니다.', 'success');
      await fetchDates(); 

    } catch (e: any) {
      console.error(e);
      alert('저장 중 오류가 발생했습니다: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const generateTimeOptions = () => {
    const times = [];
    for (let h = 8; h <= 21; h++) {
      times.push(`${String(h).padStart(2, '0')}:00`);
      if (h !== 21) times.push(`${String(h).padStart(2, '0')}:30`);
    }
    return times;
  };
  const timeOptions = generateTimeOptions();

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="h-16"></div>);
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const hasSlots = availability[dateStr] && availability[dateStr].length > 0;
      const isSelected = selectedDate === dateStr;
      
      // 🟢 해당 날짜의 총 타임 수
      const slotCount = availability[dateStr]?.length || 0;
      // 🟢 해당 날짜의 총 예약 건수 계산 (bookingCounts 활용)
      let bookedCount = 0;
      availability[dateStr]?.forEach(t => {
          if (bookingCounts[`${dateStr}_${t}`]) bookedCount += bookingCounts[`${dateStr}_${t}`];
      });

      days.push(
        <div 
          key={day} 
          onClick={() => handleDateClick(dateStr)}
          className={`h-20 border border-slate-100 flex flex-col items-center justify-start pt-2 cursor-pointer transition-all rounded-xl m-1 relative group ${
            isSelected ? 'ring-2 ring-black bg-slate-50 z-10' : 'hover:bg-slate-50 text-slate-700'
          }`}
        >
          <span className={`text-sm font-bold ${isSelected ? 'text-black' : ''}`}>{day}</span>
          
          {/* 예약 가능 표시 (점) */}
          {hasSlots && (
            <div className="flex gap-0.5 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-black"></div>
              {slotCount > 1 && <div className="w-1.5 h-1.5 rounded-full bg-black/30"></div>}
            </div>
          )}
          
          {/* 타임 수 표시 */}
          {hasSlots && (
            <div className="mt-auto mb-1 flex flex-col items-center">
                <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded-md group-hover:bg-white transition-colors">
                {slotCount} 타임
                </span>
                {/* 예약이 있으면 빨간 점 표시 등으로 알림 가능 */}
                {bookedCount > 0 && <span className="text-[8px] text-rose-500 font-bold mt-0.5">{bookedCount} 예약됨</span>}
            </div>
          )}
        </div>
      );
    }
    return days;
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-8">
          <Link href="/host/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-black font-bold text-sm">
            <ChevronLeft size={16} /> 대시보드
          </Link>
          <div className="flex gap-3">
             <button onClick={() => { setAvailability(initialData); setSelectedDate(null); }} className="px-4 py-2 text-sm font-bold text-slate-400 hover:bg-slate-100 rounded-full">변경 취소</button>
             <button onClick={handleSave} disabled={loading} className="px-6 py-2 bg-black text-white rounded-full font-bold hover:scale-105 transition-transform flex items-center gap-2 shadow-lg disabled:opacity-50">
               {loading ? '저장 중...' : <><Check size={16}/> 변경사항 저장</>}
             </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex-1 w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black">{currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월</h2>
              <div className="flex gap-2">
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 border rounded-full hover:bg-slate-50"><ChevronLeft size={20}/></button>
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 border rounded-full hover:bg-slate-50"><ChevronRight size={20}/></button>
              </div>
            </div>
            <div className="grid grid-cols-7 text-center mb-2">{['일','월','화','수','목','금','토'].map(d=><div key={d} className="text-xs font-bold text-slate-400 py-2">{d}</div>)}</div>
            <div className="grid grid-cols-7">{renderCalendar()}</div>
          </div>

          <div className="w-full lg:w-96">
            <div className="sticky top-24 bg-slate-50 border border-slate-200 rounded-3xl p-6 min-h-[500px]">
              {selectedDate ? (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-start mb-6">
                    <div><h3 className="text-xl font-black text-slate-900 mb-1">{selectedDate}</h3><p className="text-xs font-bold text-slate-500">시간 설정</p></div>
                    <button onClick={() => setSelectedDate(null)} className="p-1 hover:bg-slate-200 rounded-full text-slate-400"><X size={18}/></button>
                  </div>
                  <div className="space-y-2 mb-8">
                    {availability[selectedDate]?.length > 0 ? (
                      availability[selectedDate].map(time => {
                        // 🟢 예약 여부 확인
                        const isBooked = (bookingCounts[`${selectedDate}_${time}`] || 0) > 0;
                        return (
                            <div key={time} className={`flex justify-between items-center bg-white p-3 px-4 rounded-xl border shadow-sm ${isBooked ? 'border-rose-200 bg-rose-50' : 'border-slate-200'}`}>
                            <div className="flex items-center gap-3">
                                <Clock size={16} className={isBooked ? "text-rose-400" : "text-slate-400"}/>
                                <span className={`font-bold ${isBooked ? "text-rose-700" : "text-slate-800"}`}>{time}</span>
                                {isBooked && <span className="text-[10px] font-bold bg-rose-200 text-rose-700 px-1.5 py-0.5 rounded">예약됨</span>}
                            </div>
                            <button 
                                onClick={() => removeTimeSlot(time)} 
                                className={`text-slate-300 p-1 rounded-full transition-all ${isBooked ? 'opacity-30 cursor-not-allowed' : 'hover:text-rose-500 hover:bg-rose-50'}`}
                                disabled={isBooked} // 예약 있으면 버튼 비활성화 (UX 보호)
                            >
                                <Trash2 size={16}/>
                            </button>
                            </div>
                        )
                      })
                    ) : <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">시간을 추가해주세요.</div>}
                  </div>
                  <div className="border-t border-slate-200 pt-6">
                    <label className="text-xs font-bold text-slate-500 mb-3 block uppercase">시간 추가 (08:00 ~ 21:00)</label>
                    <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                      {timeOptions.map(time => {
                        const isAdded = availability[selectedDate]?.includes(time);
                        const isBooked = (bookingCounts[`${selectedDate}_${time}`] || 0) > 0;
                        return (
                          <button key={time} onClick={() => isAdded ? removeTimeSlot(time) : addTimeSlot(time)}
                            disabled={isBooked} // 예약된 시간은 토글 불가
                            className={`py-2 text-sm font-bold rounded-lg border transition-all ${
                                isAdded 
                                ? (isBooked ? 'bg-rose-100 text-rose-400 border-rose-200 cursor-not-allowed' : 'bg-black text-white border-black') 
                                : 'bg-white text-slate-600 border-slate-200 hover:border-black'
                            }`}>
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-32 opacity-60">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 border border-slate-100"><Clock size={32} /></div>
                  <p className="font-bold text-slate-600">날짜를 선택해주세요</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}