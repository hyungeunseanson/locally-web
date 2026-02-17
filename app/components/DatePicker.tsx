'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 추가

export default function DatePicker({ selectedRange, onChange }: { selectedRange: any, onChange: (range: any) => void }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { t } = useLanguage(); // 🟢 추가
  
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDay = (y: number, m: number) => new Date(y, m, 1).getDay();
  
  const handleDateClick = (day: number) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    if (!selectedRange.start || (selectedRange.start && selectedRange.end)) { 
      onChange({ start: clickedDate, end: null }); 
    } else { 
      if (clickedDate < selectedRange.start) { 
        onChange({ start: clickedDate, end: selectedRange.start }); 
      } else { 
        onChange({ ...selectedRange, end: clickedDate }); 
      } 
    }
  };

  const renderDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysCount = getDaysInMonth(year, month);
    const startBlank = getFirstDay(year, month);
    const days = [];
    
    for (let i = 0; i < startBlank; i++) days.push(<div key={`empty-${i}`} />);
    
    for (let d = 1; d <= daysCount; d++) {
      const date = new Date(year, month, d);
      const isStart = selectedRange.start?.getTime() === date.getTime();
      const isEnd = selectedRange.end?.getTime() === date.getTime();
      const isInRange = selectedRange.start && selectedRange.end && date > selectedRange.start && date < selectedRange.end;
      
      days.push(
        <button key={d} onClick={() => handleDateClick(d)} className={`h-10 w-10 rounded-full text-sm font-bold flex items-center justify-center transition-all ${isStart || isEnd ? 'bg-black text-white' : ''} ${isInRange ? 'bg-slate-100' : ''} ${!isStart && !isEnd && !isInRange ? 'hover:border border-black' : ''}`}>{d}</button>
      );
    }
    return days;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()-1)))}><ChevronLeft size={20}/></button>
        <span className="font-bold">
    {currentDate.getFullYear()}{t('date_year')} {currentDate.getMonth()+1}{t('date_month')}
  </span>
        <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()+1)))}><ChevronRight size={20}/></button>
      </div>
      <div className="grid grid-cols-7 ...">
  {/* 🟢 번역 키 배열로 변경 */}
  {['day_0', 'day_1', 'day_2', 'day_3', 'day_4', 'day_5', 'day_6'].map(key => (
    <span key={key}>{t(key)}</span>
  ))}
</div>
      <div className="grid grid-cols-7 gap-y-1 justify-items-center">{renderDays()}</div>
    </div>
  );
}