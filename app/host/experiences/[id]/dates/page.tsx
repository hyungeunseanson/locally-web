'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Check, Plus, Trash2, Clock } from 'lucide-react';
import Link from 'next/link';

// 타입 정의
type TimeSlot = string; // "10:00"
type AvailabilityMap = Record<string, TimeSlot[]>; // { "2024-05-01": ["10:00", "14:00"] }

export default function ManageDatesPage() {
  const supabase = createClient();
  const params = useParams();
  
  // 상태 관리
  const [currentDate, setCurrentDate] = useState(new Date()); // 현재 달력 월
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // 현재 편집 중인 날짜
  const [availability, setAvailability] = useState<AvailabilityMap>({}); // 전체 일정 데이터
  const [loading, setLoading] = useState(false);
  
  // 시간 추가 입력값
  const [newTime, setNewTime] = useState('10:00');

  // 1. 기존 데이터 불러오기
  const fetchDates = async () => {
    const { data, error } = await supabase
      .from('experience_availability')
      .select('date, start_time')
      .eq('experience_id', params.id);
    
    if (data) {
      // DB 데이터를 맵 형태로 변환
      const map: AvailabilityMap = {};
      data.forEach((item: any) => {
        if (!map[item.date]) map[item.date] = [];
        map[item.date].push(item.start_time);
      });
      setAvailability(map);
    }
  };

  useEffect(() => { fetchDates(); }, []);

  // 2. 날짜 선택 핸들러
  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr);
  };

  // 3. 시간대 추가
  const addTimeSlot = () => {
    if (!selectedDate || !newTime) return;
    
    setAvailability(prev => {
      const currentSlots = prev[selectedDate] || [];
      if (currentSlots.includes(newTime)) return prev; // 중복 방지
      
      return {
        ...prev,
        [selectedDate]: [...currentSlots, newTime].sort() // 시간순 정렬
      };
    });
  };

  // 4. 시간대 삭제
  const removeTimeSlot = (date: string, time: string) => {
    setAvailability(prev => {
      const updatedSlots = prev[date].filter(t => t !== time);
      const newMap = { ...prev, [date]: updatedSlots };
      if (updatedSlots.length === 0) delete newMap[date]; // 비었으면 키 삭제
      return newMap;
    });
  };

  // 5. 저장하기 (DB 동기화)
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
      const { error } = await supabase.from('experience_availability').insert(insertData);
      if (error) {
        alert('저장 실패: ' + error.message);
      } else {
        alert('일정이 성공적으로 저장되었습니다!');
      }
    } else {
      alert('저장되었습니다. (설정된 일정이 없습니다)');
    }

    setLoading(false);
  };

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
          className={`h-16 border border-slate-100 flex flex-col items-center justify-start pt-2 cursor-pointer transition-all rounded-xl m-1 relative ${
            isSelected 
              ? 'ring-2 ring-black bg-slate-50 z-10' 
              : 'hover:bg-slate-50'
          }`}
        >
          <span className={`text-sm font-bold ${isSelected ? 'text-black' : 'text-slate-700'}`}>{day}</span>
          
          {/* 스케줄 있으면 점 표시 */}
          {hasSlots && (
            <div className="flex gap-0.5 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
              {availability[dateStr].length > 1 && <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>}
            </div>
          )}
          
          {hasSlots && (
            <span className="text-[9px] text-slate-400 mt-auto mb-1">{availability[dateStr].length}개 타임</span>
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
          <Link href="/host/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-black font-bold text-sm">
            <ChevronLeft size={16} /> 대시보드
          </Link>
          <div className="flex gap-3">
             <button onClick={handleSave} disabled={loading} className="px-6 py-2 bg-black text-white rounded-full font-bold hover:scale-105 transition-transform flex items-center gap-2 shadow-lg">
               {loading ? '저장 중...' : <><Check size={16}/> 변경사항 저장</>}
             </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* 1. 달력 영역 (왼쪽) */}
          <div className="flex-1 w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black flex items-center gap-2">
                <Clock size={24} className="text-slate-900"/>
                {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
              </h2>
              <div className="flex gap-2">
                <button onClick={prevMonth} className="p-2 border rounded-full hover:bg-slate-50"><ChevronLeft size={16}/></button>
                <button onClick={nextMonth} className="p-2 border rounded-full hover:bg-slate-50"><ChevronRight size={16}/></button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-center mb-2">
              {['일','월','화','수','목','금','토'].map(d => (
                <div key={d} className="text-xs font-bold text-slate-400 py-2">{d}</div>
              ))}
            </div>
            
            <div className="grid grid-cols-7">
              {renderCalendar()}
            </div>
          </div>

          {/* 2. 시간대 설정 패널 (오른쪽) */}
          <div className="w-full lg:w-96 bg-slate-50 border border-slate-200 rounded-2xl p-6 sticky top-24 h-fit min-h-[400px]">
            {selectedDate ? (
              <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                <h3 className="text-lg font-black mb-1">{selectedDate}</h3>
                <p className="text-xs text-slate-500 mb-6 font-bold">스케줄 상세 설정</p>

                {/* 시간 추가 입력란 */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6">
                  <label className="text-xs font-bold text-slate-500 mb-2 block">새로운 시간대 추가</label>
                  <div className="flex gap-2">
                    <input 
                      type="time" 
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:bg-white outline-none"
                    />
                    <button 
                      onClick={addTimeSlot}
                      className="bg-black text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <Plus size={20}/>
                    </button>
                  </div>
                </div>

                {/* 등록된 시간 리스트 */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 mb-2 block">등록된 스케줄 ({availability[selectedDate]?.length || 0})</label>
                  
                  {availability[selectedDate]?.length > 0 ? (
                    availability[selectedDate].map((time, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm group">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="font-bold text-slate-700">{time}</span>
                        </div>
                        <button 
                          onClick={() => removeTimeSlot(selectedDate, time)}
                          className="text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                      등록된 시간이 없습니다.<br/>
                      위에서 시간을 추가해주세요.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-20">
                <Clock size={48} className="mb-4 opacity-20"/>
                <p className="font-bold mb-1">날짜를 선택해주세요</p>
                <p className="text-xs opacity-70">달력에서 날짜를 클릭하여<br/>시간대를 설정할 수 있습니다.</p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}