'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import Link from 'next/link';

export default function ManageDatesPage() {
  const supabase = createClient();
  const params = useParams();
  
  // 달력 상태
  const [currentDate, setCurrentDate] = useState(new Date()); // 현재 보고 있는 달
  const [availableDates, setAvailableDates] = useState<string[]>([]); // 예약 가능 날짜들 (YYYY-MM-DD)
  const [loading, setLoading] = useState(false);

  // 1. 기존 설정된 날짜 불러오기
  const fetchDates = async () => {
    const { data } = await supabase
      .from('experience_availability')
      .select('date')
      .eq('experience_id', params.id);
    
    if (data) {
      setAvailableDates(data.map((d: any) => d.date));
    }
  };

  useEffect(() => { fetchDates(); }, []);

  // 2. 날짜 클릭 핸들러 (추가/삭제 토글)
  const toggleDate = (dateStr: string) => {
    if (availableDates.includes(dateStr)) {
      setAvailableDates(prev => prev.filter(d => d !== dateStr)); // 있으면 제거
    } else {
      setAvailableDates(prev => [...prev, dateStr]); // 없으면 추가
    }
  };

  // 3. 저장하기
  const handleSave = async () => {
    setLoading(true);
    
    // (1) 기존 날짜 싹 지우고 (간단한 구현을 위해)
    await supabase.from('experience_availability').delete().eq('experience_id', params.id);
    
    // (2) 선택된 날짜 다시 다 넣기
    if (availableDates.length > 0) {
      const insertData = availableDates.map(date => ({
        experience_id: params.id,
        date: date,
        is_booked: false
      }));
      await supabase.from('experience_availability').insert(insertData);
    }

    alert('일정이 저장되었습니다!');
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
    // 빈 칸 채우기
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-14"></div>);
    }
    
    // 날짜 채우기
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isSelected = availableDates.includes(dateStr);

      days.push(
        <div 
          key={day} 
          onClick={() => toggleDate(dateStr)}
          className={`h-14 border border-slate-100 flex flex-col items-center justify-center cursor-pointer transition-all rounded-lg m-1 relative ${
            isSelected 
              ? 'bg-black text-white shadow-md transform scale-105' 
              : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          <span className="text-sm font-bold">{day}</span>
          {isSelected && <span className="text-[10px] mt-1 opacity-80">가능</span>}
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
      <main className="max-w-4xl mx-auto px-6 py-12">
        
        {/* 상단 네비게이션 */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/host/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-black font-bold text-sm">
            <ChevronLeft size={16} /> 대시보드
          </Link>
          <div className="flex gap-3">
             <button onClick={() => setAvailableDates([])} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-full">초기화</button>
             <button onClick={handleSave} disabled={loading} className="px-6 py-2 bg-black text-white rounded-full font-bold hover:scale-105 transition-transform flex items-center gap-2">
               {loading ? '저장 중...' : <><Check size={16}/> 변경사항 저장</>}
             </button>
          </div>
        </div>

        <div className="flex gap-8 items-start">
          {/* 달력 영역 */}
          <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black">
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

          {/* 우측 설명 (에어비앤비 스타일) */}
          <div className="w-80 hidden md:block">
            <div className="sticky top-24 space-y-6">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h3 className="font-bold mb-2">예약 가능 설정</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  게스트가 예약할 수 있는 날짜를 선택해주세요.<br/>
                  날짜를 클릭하면 <span className="font-bold text-black">검은색(가능)</span>으로 바뀝니다.
                </p>
              </div>
              
              <div className="border p-4 rounded-xl flex justify-between items-center">
                <span className="text-sm font-bold text-slate-600">선택된 날짜</span>
                <span className="text-xl font-black">{availableDates.length}일</span>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}