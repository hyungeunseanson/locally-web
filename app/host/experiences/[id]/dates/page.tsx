'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Check, Clock, Plus, Trash2, X } from 'lucide-react';
import Link from 'next/link';

// 타입 정의
type TimeSlot = string; // "10:00"
type AvailabilityMap = Record<string, TimeSlot[]>; // { "2024-05-01": ["10:00", "14:00"] }

export default function ManageDatesPage() {
  const supabase = createClient();
  const params = useParams();
  
  // 상태 관리
  const [currentDate, setCurrentDate] = useState(new Date()); // 현재 달력 월
  const [availability, setAvailability] = useState<AvailabilityMap>({}); // 전체 일정 데이터
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // 현재 편집 중인 날짜 (YYYY-MM-DD)
  const [loading, setLoading] = useState(false);

  // 1. 기존 데이터 불러오기
  const fetchDates = async () => {
    const { data } = await supabase
      .from('experience_availability')
      .select('date, start_time')
      .eq('experience_id', params.id);
    
    if (data) {
      const map: AvailabilityMap = {};
      data.forEach((item: any) => {
        if (!map[item.date]) map[item.date] = [];
        map[item.date].push(item.start_time);
      });
      setAvailability(map);
    }
  };

  useEffect(() => { fetchDates(); }, []);

  // 2. 날짜 클릭 핸들러
  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr); // 우측 패널에 해당 날짜 상세 정보 표시
  };

  // 3. 시간대 추가/삭제
  const addTimeSlot = (time: string) => {
    if (!selectedDate) return;
    setAvailability(prev => {
      const currentSlots = prev[selectedDate] || [];
      if (currentSlots.includes(time)) return prev; // 중복 방지
      const newSlots = [...currentSlots, time].sort();
      return { ...prev, [selectedDate]: newSlots };
    });
  };

  const removeTimeSlot = (time: string) => {
    if (!selectedDate) return;
    setAvailability(prev => {
      const newSlots = (prev[selectedDate] || []).filter(t => t !== time);
      const newMap = { ...prev, [selectedDate]: newSlots };
      if (newSlots.length === 0) delete newMap[selectedDate]; // 비었으면 날짜 키 삭제
      return newMap;
    });
  };

  // 4. 저장하기
  const handleSave = async () => {
    setLoading(true);
    
    // (1) 기존 데이터 삭제 (덮어쓰기 전략)
    await supabase.from('experience_availability').delete().eq('experience_id', params.id);
    
    // (2) 데이터 변환 (Map -> Array)
    const insertData = [];
    for (const [date, times] of Object.entries(availability)) {
      for (const time of times) {
        insertData.push({
          experience_id: params.id,
          date: date,
          start_time: time,
          is_booked: false
        });
      }
    }

    if (insertData.length > 0) {
      await supabase.from('experience_availability').insert(insertData);
    }

    alert('일정이 성공적으로 저장되었습니다!');
    setLoading(false);
  };

  // 시간대 생성 (08:00 ~ 21:00, 30분 단위)
  const generateTimeOptions = () => {
    const times = [];
    for (let h = 8; h <= 21; h++) {
      times.push(`${String(h).padStart(2, '0')}:00`);
      if (h !== 21) times.push(`${String(h).padStart(2, '0')}:30`);
    }
    return times;
  };
  const timeOptions = generateTimeOptions();

  // 달력 렌더링 헬퍼
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-16"></div>);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const hasSlots = availability[dateStr] && availability[dateStr].length > 0;
      const isSelected = selectedDate === dateStr;

      days.push(
        <div 
          key={day} 
          onClick={() => handleDateClick(dateStr)}
          className={`h-16 border border-slate-100 flex flex-col items-center justify-start pt-2 cursor-pointer transition-all rounded-xl m-1 relative group ${
            isSelected 
              ? 'ring-2 ring-black bg-slate-50 z-10' 
              : 'hover:bg-slate-50 text-slate-700'
          }`}
        >
          <span className={`text-sm font-bold ${isSelected ? 'text-black' : ''}`}>{day}</span>
          
          {/* 예약 가능 표시 (점) */}
          {hasSlots && (
            <div className="flex gap-0.5 mt-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-black"></div>
              {availability[dateStr].length > 1 && <div className="w-1.5 h-1.5 rounded-full bg-black/30"></div>}
            </div>
          )}
          
          {hasSlots && (
            <span className="text-[9px] text-slate-400 mt-auto mb-1 font-medium group-hover:text-slate-600">
              {availability[dateStr].length}개 타임
            </span>
          )}
        </div>
      );
    }
    return days;
  };

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-6 py-12">
        
        {/* 상단 네비게이션 */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/host/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-black font-bold text-sm transition-colors">
            <ChevronLeft size={16} /> 대시보드
          </Link>
          <div className="flex gap-3">
             <button onClick={() => setAvailability({})} className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors">초기화</button>
             <button onClick={handleSave} disabled={loading} className="px-6 py-2 bg-black text-white rounded-full font-bold hover:scale-105 transition-transform flex items-center gap-2 shadow-lg disabled:opacity-50">
               {loading ? '저장 중...' : <><Check size={16}/> 일정 저장하기</>}
             </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* 1. 달력 영역 (왼쪽) */}
          <div className="flex-1 w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black">
                {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
              </h2>
              <div className="flex gap-2">
                <button onClick={prevMonth} className="p-2 border rounded-full hover:bg-slate-50 transition-colors"><ChevronLeft size={20}/></button>
                <button onClick={nextMonth} className="p-2 border rounded-full hover:bg-slate-50 transition-colors"><ChevronRight size={20}/></button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-center mb-2">
              {['일','월','화','수','목','금','토'].map(d => (
                <div key={d} className="text-xs font-bold text-slate-400 py-2 uppercase tracking-wider">{d}</div>
              ))}
            </div>
            
            <div className="grid grid-cols-7">
              {renderCalendar()}
            </div>
          </div>

          {/* 2. 시간대 설정 패널 (우측 사이드바) */}
          <div className="w-full lg:w-96">
            <div className="sticky top-24 bg-slate-50 border border-slate-200 rounded-3xl p-6 min-h-[500px]">
              
              {selectedDate ? (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 mb-1">{selectedDate}</h3>
                      <p className="text-xs font-bold text-slate-500">예약 가능한 시간을 선택하세요</p>
                    </div>
                    <button onClick={() => setSelectedDate(null)} className="p-1 hover:bg-slate-200 rounded-full text-slate-400"><X size={18}/></button>
                  </div>

                  {/* 선택된 시간 리스트 */}
                  <div className="space-y-2 mb-8">
                    {availability[selectedDate]?.length > 0 ? (
                      availability[selectedDate].map(time => (
                        <div key={time} className="flex justify-between items-center bg-white p-3 px-4 rounded-xl border border-slate-200 shadow-sm group hover:border-rose-200 transition-colors">
                          <div className="flex items-center gap-3">
                            <Clock size={16} className="text-slate-400"/>
                            <span className="font-bold text-slate-800 text-lg">{time}</span>
                          </div>
                          <button onClick={() => removeTimeSlot(time)} className="text-slate-300 hover:text-rose-500 p-1 rounded-full hover:bg-rose-50 transition-all">
                            <Trash2 size={16}/>
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
                        설정된 시간이 없습니다.<br/>아래에서 시간을 추가해주세요.
                      </div>
                    )}
                  </div>

                  {/* 시간 추가 옵션 (8:00 ~ 21:00) */}
                  <div className="border-t border-slate-200 pt-6">
                    <label className="text-xs font-bold text-slate-500 mb-3 block uppercase tracking-wide">시간 추가하기 (08:00 ~ 21:00)</label>
                    <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                      {timeOptions.map(time => {
                        const isAdded = availability[selectedDate]?.includes(time);
                        return (
                          <button
                            key={time}
                            onClick={() => isAdded ? removeTimeSlot(time) : addTimeSlot(time)}
                            className={`py-2 text-sm font-bold rounded-lg transition-all border ${
                              isAdded 
                                ? 'bg-black text-white border-black' 
                                : 'bg-white text-slate-600 border-slate-200 hover:border-black hover:text-black'
                            }`}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-32 opacity-60">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                    <Clock size={32} />
                  </div>
                  <p className="font-bold text-slate-600 mb-1">날짜를 선택해주세요</p>
                  <p className="text-xs">달력에서 날짜를 클릭하여<br/>세부 시간을 설정할 수 있습니다.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}