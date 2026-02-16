'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Check, Clock, Trash2, X, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/app/context/ToastContext'; // 토스트 알림 사용 권장

type TimeSlot = string; 
type AvailabilityMap = Record<string, TimeSlot[]>;

export default function ManageDatesPage() {
  const supabase = createClient();
  const params = useParams();
  const { showToast } = useToast();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [availability, setAvailability] = useState<AvailabilityMap>({});
  // 🟢 [추가] 초기 로드 시점의 데이터 (변경 사항 비교용)
  const [initialData, setInitialData] = useState<AvailabilityMap>({}); 
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 1. 데이터 불러오기
  const fetchDates = async () => {
    const { data } = await supabase
      .from('experience_availability')
      .select('date, start_time, current_bookings') // 🟢 예약 현황도 가져옴
      .eq('experience_id', params.id);
    
    if (data) {
      const map: AvailabilityMap = {};
      data.forEach((item: any) => {
        if (!map[item.date]) map[item.date] = [];
        map[item.date].push(item.start_time);
      });
      setAvailability(JSON.parse(JSON.stringify(map))); // Deep Copy
      setInitialData(JSON.parse(JSON.stringify(map))); // 초기 상태 저장
    }
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
    setAvailability(prev => {
      const newSlots = (prev[selectedDate] || []).filter(t => t !== time);
      const newMap = { ...prev, [selectedDate]: newSlots };
      if (newSlots.length === 0) delete newMap[selectedDate];
      return newMap;
    });
  };

  // 🟢 [핵심] 스마트 저장 로직 (Diff Algorithm)
  const handleSave = async () => {
    if (!confirm('일정을 저장하시겠습니까?')) return;
    setLoading(true);

    try {
      const toInsert: any[] = [];
      const toDelete: { date: string, time: string }[] = [];

      // 1. 추가해야 할 것 찾기 (Current에는 있는데 Initial에는 없는 것)
      for (const [date, times] of Object.entries(availability)) {
        const initialTimes = initialData[date] || [];
        times.forEach(time => {
          if (!initialTimes.includes(time)) {
            toInsert.push({
              experience_id: params.id,
              date: date,
              start_time: time,
              is_booked: false,
              current_bookings: 0 // 초기값
            });
          }
        });
      }

      // 2. 삭제해야 할 것 찾기 (Initial에는 있는데 Current에는 없는 것)
      for (const [date, times] of Object.entries(initialData)) {
        const currentTimes = availability[date] || [];
        times.forEach(time => {
          if (!currentTimes.includes(time)) {
            toDelete.push({ date, time });
          }
        });
      }

      // 3. 실행 (순차 처리)
      // (1) Insert
      if (toInsert.length > 0) {
        const { error } = await supabase.from('experience_availability').insert(toInsert);
        if (error) throw error;
      }

      // (2) Delete (안전 삭제: 예약이 없는 것만 삭제)
      for (const item of toDelete) {
        // 예약이 있는지 먼저 확인 (안전장치)
        const { data: slot } = await supabase
          .from('experience_availability')
          .select('id, current_bookings')
          .eq('experience_id', params.id)
          .eq('date', item.date)
          .eq('start_time', item.time)
          .single();

        if (slot && slot.current_bookings > 0) {
          alert(`⚠️ [${item.date} ${item.time}] 스케줄은 이미 예약이 있어 삭제할 수 없습니다.`);
          // UI 롤백 (삭제 취소)
          addTimeSlot(item.time); 
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
      await fetchDates(); // 데이터 최신화 (중요)

    } catch (e: any) {
      console.error(e);
      alert('저장 중 오류가 발생했습니다: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ... (달력 렌더링 등 나머지 UI 코드는 기존 유지) ...
  // (generateTimeOptions, renderCalendar 등은 그대로 두셔도 됩니다)
  
  // (아래는 전체 코드 흐름 유지를 위한 return 부분입니다. 필요한 부분만 복붙하세요)
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

      days.push(
        <div 
          key={day} 
          onClick={() => handleDateClick(dateStr)}
          className={`h-16 border border-slate-100 flex flex-col items-center justify-start pt-2 cursor-pointer transition-all rounded-xl m-1 relative group ${
            isSelected ? 'ring-2 ring-black bg-slate-50 z-10' : 'hover:bg-slate-50 text-slate-700'
          }`}
        >
          <span className={`text-sm font-bold ${isSelected ? 'text-black' : ''}`}>{day}</span>
          {hasSlots && (
            <div className="flex gap-0.5 mt-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-black"></div>
              {availability[dateStr].length > 1 && <div className="w-1.5 h-1.5 rounded-full bg-black/30"></div>}
            </div>
          )}

          {/* 🟢 [복구됨] 몇 개의 타임이 있는지 텍스트로 표시 */}
          {hasSlots && (
            <span className="text-[10px] text-slate-400 mt-auto mb-1 font-bold bg-slate-100 px-1.5 py-0.5 rounded-md group-hover:text-black group-hover:bg-white transition-colors">
              {availability[dateStr].length} 타임
            </span>
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
                      availability[selectedDate].map(time => (
                        <div key={time} className="flex justify-between items-center bg-white p-3 px-4 rounded-xl border border-slate-200 shadow-sm">
                          <div className="flex items-center gap-3"><Clock size={16} className="text-slate-400"/><span className="font-bold text-slate-800">{time}</span></div>
                          <button onClick={() => removeTimeSlot(time)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16}/></button>
                        </div>
                      ))
                    ) : <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">시간을 추가해주세요.</div>}
                  </div>
                  <div className="border-t border-slate-200 pt-6">
                    <label className="text-xs font-bold text-slate-500 mb-3 block uppercase">시간 추가 (08:00 ~ 21:00)</label>
                    <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                      {timeOptions.map(time => (
                        <button key={time} onClick={() => availability[selectedDate]?.includes(time) ? removeTimeSlot(time) : addTimeSlot(time)}
                          className={`py-2 text-sm font-bold rounded-lg border transition-all ${availability[selectedDate]?.includes(time) ? 'bg-black text-white border-black' : 'bg-white text-slate-600 border-slate-200 hover:border-black'}`}>
                          {time}
                        </button>
                      ))}
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