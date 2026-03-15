'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Check, Clock, Trash2, X } from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 1. Import
import { BOOKING_CONFIRMED_STATUSES } from '@/app/constants/bookingStatus';

type TimeSlot = string;
type AvailabilityMap = Record<string, TimeSlot[]>;
type BookingCountMap = Record<string, number>;
type AvailabilityRow = {
  date: string;
  start_time: string;
};
type BookingRow = {
  date: string;
  time: string;
};
type ScheduleSaveResponse = {
  success?: boolean;
  error?: string;
  skippedBookedDeletions?: Array<{ date: string; time: string }>;
};

export default function ManageDatesPage() {
  const { t, lang } = useLanguage(); // 🟢 2. Hook
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [availability, setAvailability] = useState<AvailabilityMap>({});
  const [initialData, setInitialData] = useState<AvailabilityMap>({});
  const [bookingCounts, setBookingCounts] = useState<BookingCountMap>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const experienceId = Array.isArray(params.id) ? params.id[0] : params.id;

  // 1. 데이터 불러오기
  const fetchDates = useCallback(async () => {
    // (1) 슬롯 조회
    const { data: slots, error: slotError } = await supabase
      .from('experience_availability')
      .select('date, start_time')
      .eq('experience_id', params.id);

    if (slotError) {
      console.error("Slot fetch error:", slotError);
      return;
    }

    // (2) 실제 예약 조회 (안전 삭제를 위해)
    const { data: bookings } = await supabase
      .from('bookings')
      .select('date, time')
      .eq('experience_id', params.id)
      .in('status', [...BOOKING_CONFIRMED_STATUSES]);

    const availMap: AvailabilityMap = {};
    if (slots) {
      (slots as AvailabilityRow[]).forEach((item) => {
        if (!availMap[item.date]) availMap[item.date] = [];
        availMap[item.date].push(item.start_time);
      });
    }

    const countMap: BookingCountMap = {};
    if (bookings) {
      (bookings as BookingRow[]).forEach((b) => {
        const key = `${b.date}_${b.time}`;
        countMap[key] = (countMap[key] || 0) + 1;
      });
    }

    setAvailability(JSON.parse(JSON.stringify(availMap)));
    setInitialData(JSON.parse(JSON.stringify(availMap)));
    setBookingCounts(countMap);
  }, [params.id, supabase]);

  useEffect(() => { void fetchDates(); }, [fetchDates]);

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

    const bookingKey = `${selectedDate}_${time}`;
    if (bookingCounts[bookingKey] > 0) {
      showToast(`${t('sched_delete_error')} (${bookingCounts[bookingKey]})`, 'error'); // 🟢 번역
      return;
    }

    setAvailability(prev => {
      const newSlots = (prev[selectedDate] || []).filter(t => t !== time);
      const newMap = { ...prev, [selectedDate]: newSlots };
      if (newSlots.length === 0) delete newMap[selectedDate];
      return newMap;
    });
  };

  // 🟢 [핵심] 안전한 저장 로직 (Diff Algorithm)
  const persistScheduleChanges = async () => {
    setLoading(true);

    try {
      if (!experienceId) {
        throw new Error('Experience id is missing.');
      }

      const response = await fetch(`/api/host/experiences/${experienceId}/availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ availability }),
      });
      const result = (await response.json()) as ScheduleSaveResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save schedule changes.');
      }

      if ((result.skippedBookedDeletions?.length || 0) > 0) {
        console.warn('Skipped booked schedule deletions:', result.skippedBookedDeletions);
      }

      showToast(t('sched_save_success'), 'success'); // 🟢 번역
      await fetchDates();

    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'Unknown error';
      showToast(t('sched_save_error') + message, 'error'); // 🟢 번역
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClick = () => {
    if (loading) return;
    setIsSaveModalOpen(true);
  };

  const handleConfirmSave = async () => {
    setIsSaveModalOpen(false);
    await persistScheduleChanges();
  };

  // ... (UI 렌더링 부분은 기존 코드와 동일하여 생략, 아래 return 사용) ...
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
      const slotCount = availability[dateStr]?.length || 0;

      let bookedCount = 0;
      availability[dateStr]?.forEach(t => {
        if (bookingCounts[`${dateStr}_${t}`]) bookedCount += bookingCounts[`${dateStr}_${t}`];
      });

      days.push(
        <div
          key={day}
          onClick={() => handleDateClick(dateStr)}
          className={`h-20 border border-slate-100 flex flex-col items-center justify-start pt-2 cursor-pointer transition-all rounded-xl m-1 relative group ${isSelected ? 'ring-2 ring-black bg-slate-50 z-10' : 'hover:bg-slate-50 text-slate-700'
            }`}
        >
          <span className={`text-sm font-bold ${isSelected ? 'text-black' : ''}`}>{day}</span>

          {hasSlots && (
            <div className="flex gap-0.5 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-black"></div>
              {slotCount > 1 && <div className="w-1.5 h-1.5 rounded-full bg-black/30"></div>}
            </div>
          )}

          {hasSlots && (
            <div className="mt-auto mb-1 flex flex-col items-center">
              <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded-md group-hover:bg-white transition-colors">
                {slotCount}{t('sched_slots')} {/* 🟢 번역 */}
              </span>
              {bookedCount > 0 && <span className="text-[8px] text-rose-500 font-bold mt-0.5">{bookedCount} {t('sched_booked')}</span>} {/* 🟢 번역 */}
            </div>
          )}
        </div>
      );
    }
    return days;
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-20 md:pb-0">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-3 md:px-6 py-6 md:py-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-8">
          <button
            onClick={() => router.replace('/host/dashboard?tab=experiences')}
            className="flex items-center gap-2 text-slate-500 hover:text-black font-bold text-sm"
          >
            <ChevronLeft size={16} /> {t('nav_dashboard')} {/* 🟢 번역 */}
          </button>
          <div className="flex gap-3">
            <button onClick={() => { setAvailability(initialData); setSelectedDate(null); }} className="px-4 py-2 text-sm font-bold text-slate-400 hover:bg-slate-100 rounded-full">{t('btn_undo')}</button> {/* 🟢 번역 */}
            <button onClick={handleSaveClick} disabled={loading} className="px-4 md:px-6 py-2 bg-black text-white rounded-full font-bold text-xs md:text-sm hover:scale-105 transition-transform flex items-center gap-1.5 md:gap-2 shadow-lg disabled:opacity-50">
              {loading ? t('saving') : <><Check size={16} /> {t('btn_save_changes')}</>} {/* 🟢 기존 키 활용 */}
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex-1 w-full bg-white border border-slate-200 rounded-2xl md:rounded-3xl p-4 md:p-8 shadow-sm">
            <div className="flex justify-between items-center mb-4 md:mb-8">
              {/* 🟢 언어별 날짜 포맷 */}
              <h2 className="text-lg md:text-2xl font-black">
                {lang === 'ko'
                  ? `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`
                  : currentDate.toLocaleString(lang === 'en' ? 'en-US' : 'ja-JP', { month: 'long', year: 'numeric' })}
              </h2>
              <div className="flex gap-2">
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 border rounded-full hover:bg-slate-50"><ChevronLeft size={20} /></button>
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 border rounded-full hover:bg-slate-50"><ChevronRight size={20} /></button>
              </div>
            </div>
            {/* 🟢 요일 번역 (LanguageContext의 day_0 ~ day_6 활용) */}
            <div className="grid grid-cols-7 text-center mb-2">{[0, 1, 2, 3, 4, 5, 6].map(i => <div key={i} className="text-xs font-bold text-slate-400 py-2">{t(`day_${i}`)}</div>)}</div>
            <div className="grid grid-cols-7">{renderCalendar()}</div>
          </div>

          <div className="w-full lg:w-96">
            <div className="sticky top-24 bg-slate-50 border border-slate-200 rounded-2xl md:rounded-3xl p-4 md:p-6 min-h-[300px] md:min-h-[500px]">
              {selectedDate ? (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-start mb-5 md:mb-6">
                    <div>
                      <h3 className="text-lg md:text-xl font-black text-slate-900 mb-1">{selectedDate}</h3>
                      <p className="text-[10px] md:text-xs font-bold text-slate-500">{t('sched_time_setting')}</p>
                    </div> {/* 🟢 번역 */}
                    <button onClick={() => setSelectedDate(null)} className="p-1 hover:bg-slate-200 rounded-full text-slate-400"><X size={18} /></button>
                  </div>
                  <div className="space-y-2 mb-6 md:mb-8">
                    {availability[selectedDate]?.length > 0 ? (
                      availability[selectedDate].map(time => {
                        const isBooked = (bookingCounts[`${selectedDate}_${time}`] || 0) > 0;
                        return (
                          <div key={time} className={`flex justify-between items-center bg-white p-2.5 px-3 md:p-3 md:px-4 rounded-xl border shadow-sm ${isBooked ? 'border-rose-200 bg-rose-50' : 'border-slate-200'}`}>
                            <div className="flex items-center gap-3">
                              <Clock size={16} className={isBooked ? "text-rose-400" : "text-slate-400"} />
                              <span className={`text-[12px] md:text-sm font-bold ${isBooked ? "text-rose-700" : "text-slate-800"}`}>{time}</span>
                              {isBooked && <span className="text-[9px] md:text-[10px] font-bold bg-rose-200 text-rose-700 px-1.5 py-0.5 rounded">{t('sched_booked')}</span>} {/* 🟢 번역 */}
                            </div>
                            <button
                              onClick={() => removeTimeSlot(time)}
                              className={`text-slate-300 p-1 rounded-full transition-all ${isBooked ? 'opacity-30 cursor-not-allowed' : 'hover:text-rose-500 hover:bg-rose-50'}`}
                              disabled={isBooked}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )
                      })
                    ) : <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">{t('sched_add_guide')}</div>} {/* 🟢 번역 */}
                  </div>
                  <div className="border-t border-slate-200 pt-6">
                    <label className="text-[10px] md:text-xs font-bold text-slate-500 mb-3 block uppercase">{t('sched_add_label')} (08:00 ~ 21:00)</label> {/* 🟢 번역 */}
                    <div className="grid grid-cols-3 md:grid-cols-3 gap-1.5 md:gap-2 max-h-44 md:max-h-60 overflow-y-auto custom-scrollbar">
                      {timeOptions.map(time => {
                        const isAdded = availability[selectedDate]?.includes(time);
                        const isBooked = (bookingCounts[`${selectedDate}_${time}`] || 0) > 0;
                        return (
                          <button key={time} onClick={() => isAdded ? removeTimeSlot(time) : addTimeSlot(time)}
                            disabled={isBooked}
                            className={`py-1.5 md:py-2 text-[12px] md:text-sm font-bold rounded-lg border transition-all ${isAdded
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
                  <p className="font-bold text-slate-600">{t('sched_select_date')}</p> {/* 🟢 번역 */}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {isSaveModalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/55 backdrop-blur-sm px-4 pb-4 md:p-4"
          onClick={() => setIsSaveModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-5 md:px-6 pt-5 md:pt-6 pb-4 border-b border-slate-100">
              <h3 className="text-[15px] md:text-base font-black text-slate-900">
                {t('sched_save_confirm')}
              </h3>
              <p className="mt-2 text-[12px] md:text-sm text-slate-500">
                {t('btn_save_changes')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 px-5 md:px-6 py-4 md:py-5">
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] md:text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                className="rounded-2xl bg-black px-4 py-3 text-[13px] md:text-sm font-bold text-white hover:bg-slate-800 transition-colors"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
