'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';
import { normalizeSoloGuaranteePrice } from '@/app/constants/soloGuarantee';
import {
  ExperienceCalendarDayStatus,
  ExperienceSlotSoldOutReason,
  ExperienceSlotSummary,
} from '../types';

interface ReservationCardProps {
  price: number;
  privatePrice?: number;
  isPrivateEnabled?: boolean;
  soloGuaranteePrice?: number;
  soloGuaranteeOptionVisible?: boolean;
  duration: number;
  availableDates: string[];
  dateToTimeMap: Record<string, string[]>;
  calendarDayStatusMap?: Record<string, ExperienceCalendarDayStatus>;
  maxGuests?: number;
  slotSummaryMap?: Record<string, ExperienceSlotSummary>;
  onReserve: (date: string, time: string, guests: number, isPrivate: boolean, isSoloGuaranteed: boolean) => void;
}

export default function ReservationCard({
  price, privatePrice = 0, isPrivateEnabled = false, soloGuaranteePrice: soloGuaranteePriceProp,
  soloGuaranteeOptionVisible = true,
  duration, availableDates, dateToTimeMap, calendarDayStatusMap = {}, onReserve,
  maxGuests = 10, slotSummaryMap = {}
}: ReservationCardProps) {
  const { t } = useLanguage();
  const soloGuaranteePrice = normalizeSoloGuaranteePrice(soloGuaranteePriceProp);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [guestSelection, setGuestSelection] = useState<string>('1');
  const [isSoloGuaranteed, setIsSoloGuaranteed] = useState(false);

  const cleanTime = selectedTime.substring(0, 5);
  const currentKey = `${selectedDate}_${cleanTime}`;
  const selectedDateStatus = selectedDate ? calendarDayStatusMap[selectedDate] : undefined;

  const currentSlotSummary = (selectedDate && selectedTime)
    ? slotSummaryMap[currentKey]
    : undefined;

  const remainingSeats = (selectedDate && selectedTime)
    ? (currentSlotSummary?.remainingSeats ?? maxGuests)
    : maxGuests;

  const maxSelectable = Math.max(1, Math.min(remainingSeats, maxGuests));

  // 날짜 계산 헬퍼
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDay = (y: number, m: number) => new Date(y, m, 1).getDay();
  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return t('exp_reservation_date_display', {
      month: t(`month_${date.getMonth() + 1}`),
      day: date.getDate(),
      weekday: t(`day_${date.getDay()}`),
    });
  };
  const calculateEndTime = (startTime: string) => {
    if (!startTime) return '';
    const [hour, minute] = startTime.split(':').map(Number);
    return `${hour + duration}:${String(minute).padStart(2, '0')}`;
  };
  const getSoldOutLabel = (soldOutReason?: ExperienceSlotSoldOutReason) => {
    if (soldOutReason === 'private_booked') {
      return t('exp_reservation_private_booked');
    }

    return t('exp_reservation_sold_out');
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
      const dayStatus = calendarDayStatusMap[dateStr];
      const isSelectable = Boolean(dayStatus);
      const isSelected = selectedDate === dateStr;
      const isSoldOutDay = dayStatus === 'sold_out';
      days.push(
        <button key={d} disabled={!isSelectable}
          data-testid={`reservation-day-${dateStr}`}
          onClick={() => { setSelectedDate(dateStr); setSelectedTime(""); }}
          className={`relative h-9 w-9 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
            isSelected
              ? isSoldOutDay
                ? 'bg-slate-900 text-white ring-2 ring-rose-200'
                : 'bg-black text-white'
              : ''
          } ${
            !isSelected && dayStatus === 'available'
              ? 'hover:bg-slate-100 hover:border-black border border-transparent text-slate-900'
              : ''
          } ${
            !isSelected && isSoldOutDay
              ? 'border border-rose-200 bg-rose-50 text-rose-500 hover:border-rose-300 hover:bg-rose-100'
              : ''
          } ${
            !isSelected && !isSelectable ? 'text-slate-300 decoration-slate-300 line-through' : ''
          }`}
        >
          <span>{d}</span>
          {isSoldOutDay && !isSelected && (
            <span className="absolute bottom-[5px] h-1.5 w-1.5 rounded-full bg-rose-400" />
          )}
        </button>
      );
    }
    return days;
  };

  const isPrivate = guestSelection === 'private';
  const resolvedGuestSelection =
    !isPrivate && Number(guestSelection) > maxSelectable
      ? String(maxSelectable)
      : guestSelection;
  const guestCount = isPrivate ? 1 : Number(resolvedGuestSelection);
  const isSoloEligible =
    soloGuaranteeOptionVisible &&
    !isPrivate &&
    guestCount === 1 &&
    Boolean(currentSlotSummary?.soloGuaranteeEligible);
  const basePrice = isPrivate ? privatePrice : (price * guestCount);
  const optionPrice = (isSoloEligible && isSoloGuaranteed) ? soloGuaranteePrice : 0;
  const totalPrice = basePrice + optionPrice;

  useEffect(() => {
    if (selectedDate && !availableDates.includes(selectedDate)) {
      const timeoutId = window.setTimeout(() => {
        setSelectedDate('');
        setSelectedTime('');
        setIsSoloGuaranteed(false);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [availableDates, selectedDate]);

  useEffect(() => {
    if (!selectedDate || !selectedTime) return;

    const availableTimes = dateToTimeMap[selectedDate] || [];
    if (!availableTimes.includes(selectedTime)) {
      const timeoutId = window.setTimeout(() => {
        setSelectedTime('');
        setIsSoloGuaranteed(false);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [dateToTimeMap, selectedDate, selectedTime]);

  useEffect(() => {
    if (isSoloGuaranteed && !isSoloEligible) {
      const timeoutId = window.setTimeout(() => {
        setIsSoloGuaranteed(false);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [isSoloEligible, isSoloGuaranteed]);

  useEffect(() => {
    if (selectedTime && currentSlotSummary && !currentSlotSummary.isBookable) {
      const timeoutId = window.setTimeout(() => {
        setSelectedTime('');
        setIsSoloGuaranteed(false);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [currentSlotSummary, selectedTime]);

  const isReserveDisabled =
    !selectedDate ||
    !selectedTime ||
    !currentSlotSummary?.isBookable;
  const hasBookableTimeOnSelectedDate = selectedDate
    ? (dateToTimeMap[selectedDate] || []).some((time) => {
        const timeKey = `${selectedDate}_${time.slice(0, 5)}`;
        return Boolean(slotSummaryMap[timeKey]?.isBookable);
      })
    : false;

  return (
    <div className="sticky top-28 border border-slate-200 shadow-[0_6px_16px_rgba(0,0,0,0.12)] rounded-2xl p-5 md:p-6 bg-white md:max-h-[calc(100dvh-8rem)] md:overflow-y-auto md:overscroll-contain">
      <div className="flex justify-between items-end mb-5">
        <div>
          <span className="text-xl md:text-2xl font-semibold">₩{isPrivate ? privatePrice.toLocaleString() : price.toLocaleString()}</span> 
          <span className="text-slate-500 text-xs md:text-sm"> {isPrivate ? t('exp_reservation_price_team_private') : t('exp_reservation_price_per_person')}</span>
        </div>
      </div>

      <div className="border border-slate-300 rounded-xl mb-4 overflow-hidden">
        {/* 달력 헤더 */}
        <div className="p-3.5 md:p-4 border-b border-slate-200 bg-white">
          <div className="flex justify-between items-center mb-3">
            <button
              data-testid="reservation-prev-month"
              onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()-1)))}
            >
              <ChevronLeft size={16}/>
            </button>
            <span className="font-semibold text-xs md:text-sm">{t('exp_reservation_calendar_header', { year: currentDate.getFullYear(), month: t(`month_${currentDate.getMonth() + 1}`) })}</span>
            <button
              data-testid="reservation-next-month"
              onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()+1)))}
            >
              <ChevronRight size={16}/>
            </button>
          </div>
          <div className="grid grid-cols-7 text-center mb-2">
            {[0, 1, 2, 3, 4, 5, 6].map((day) => <span key={day} className="text-[10px] md:text-[10px] text-slate-400 font-semibold">{t(`day_${day}`)}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-y-1 justify-items-center">
            {renderCalendar()}
          </div>
        </div>

        <div className="p-3 bg-white flex justify-between items-center border-t border-slate-200">
          <div className="flex flex-col w-full gap-3">
            <div className="flex justify-between items-start gap-2 mb-1">
              <div className="flex min-w-0 flex-wrap items-center gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-800">{t('exp_reservation_guest_count')}</span>
                {isPrivate && (
                  <span className="text-[10px] leading-relaxed text-slate-500">
                    ({t('exp_reservation_private_followup_note')})
                  </span>
                )}
              </div>
              {selectedTime && (
                <span className="text-[10px] text-rose-500 font-bold">
                  {remainingSeats <= 0 ? t('exp_reservation_sold_out') : remainingSeats <= 3 ? t('exp_reservation_seats_left', { count: remainingSeats }) : ''}
                </span>
              )}
            </div>
            
            <select
              data-testid="reservation-guest-select"
              value={resolvedGuestSelection}
              onChange={(e) => {
                const nextSelection = e.target.value;
                setGuestSelection(nextSelection);
                if (nextSelection !== '1' && isSoloGuaranteed) {
                  setIsSoloGuaranteed(false);
                }
              }}
              className="text-[13px] md:text-sm outline-none bg-transparent font-semibold w-full cursor-pointer py-1"
            >
              <optgroup label={t('exp_reservation_regular_booking')}>
                {Array.from({ length: Math.min(maxSelectable, 6) }, (_, i) => i + 1).map(n => (
                  <option key={n} value={String(n)}>{t('exp_reservation_guest_option', { count: n })}</option>
                ))}
              </optgroup>
              {isPrivateEnabled && (
                <optgroup label={t('exp_reservation_private_option')}>
                  <option value="private">
                    {t('exp_reservation_private_option_label_with_limit', { count: maxGuests })}
                  </option>
                </optgroup>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* 시간 선택 */}
      {selectedDate && (
        <div className="mb-4 animate-in fade-in zoom-in-95 duration-200">
          <p className="text-[11px] md:text-xs font-semibold text-slate-500 mb-2">{t('exp_reservation_time_select', { date: formatDateDisplay(selectedDate) })}</p>
          <div className="grid grid-cols-2 gap-2">
            {dateToTimeMap[selectedDate]?.map(time => {
              const tClean = time.substring(0, 5);
              const tKey = `${selectedDate}_${tClean}`;
              const slotSummary = slotSummaryMap[tKey];
              const tSeats = slotSummary?.remainingSeats ?? maxGuests;
              const isBookable = slotSummary?.isBookable ?? false;

              return (
                <button
                  key={time} 
                  data-testid={`reservation-time-${tClean}`}
                  onClick={() => setSelectedTime(tClean)}
                  disabled={!isBookable}
                  className={`py-2 px-3 rounded-lg text-[11px] md:text-xs font-semibold border transition-all flex flex-col items-center 
                    ${selectedTime === tClean ? 'bg-black text-white border-black' : 
                      !isBookable ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' :
                      'bg-white text-slate-700 border-slate-200 hover:border-black'}`}
                >
                  <span>{time}</span>
                  <span className={`text-[10px] md:text-[10px] font-normal ${selectedTime === tClean ? 'text-slate-300' : 'text-slate-400'}`}>
                    {!isBookable
                      ? getSoldOutLabel(slotSummary?.soldOutReason)
                      : t('exp_reservation_end_time_prefix', { time: calculateEndTime(time) })}
                    {isBookable && tSeats > 0 && tSeats <= 5 && <span className="ml-1 text-rose-500">{t('exp_reservation_remaining_short', { count: tSeats })}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          {(!dateToTimeMap[selectedDate] || dateToTimeMap[selectedDate].length === 0) && (
            <div className="text-center text-xs text-slate-400 py-4 bg-slate-50 rounded-lg">{t('exp_reservation_time_empty')}</div>
          )}
          {selectedDateStatus === 'sold_out' && !hasBookableTimeOnSelectedDate && (
            <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] leading-relaxed text-rose-600">
              {t('exp_reservation_date_soldout_msg')}
            </div>
          )}
        </div>
      )}

      {/* 1인 옵션 */}
      {isSoloEligible && (
        <div
          data-testid="reservation-solo-option"
          className={`p-4 mb-4 rounded-xl border-2 cursor-pointer transition-all ${isSoloGuaranteed ? 'border-black bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}
          onClick={() => setIsSoloGuaranteed(!isSoloGuaranteed)}
        >
          <div className="flex items-start gap-3">
            <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${isSoloGuaranteed ? 'bg-black border-black' : 'border-slate-300 bg-white'}`}>
              {isSoloGuaranteed && <Check size={12} className="text-white" strokeWidth={4}/>}
            </div>
            <div>
              <div className="font-semibold text-[13px] md:text-sm mb-1">{t('exp_reservation_solo_option_title')}</div>
              <div className="text-[11px] md:text-xs text-slate-500 leading-tight">{t('exp_reservation_solo_option_desc')} <br/><span className="text-rose-500 font-semibold">{t('exp_reservation_solo_option_refund_note')}</span></div>
              <div className="font-semibold text-[13px] md:text-sm mt-2 text-slate-900">+ ₩{soloGuaranteePrice.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      <button
        data-testid="reservation-submit"
        disabled={isReserveDisabled}
        onClick={() => onReserve(selectedDate, selectedTime, guestCount, isPrivate, isSoloEligible && isSoloGuaranteed)}
        className="w-full bg-gradient-to-r from-rose-500 to-rose-600 text-white text-[14px] md:text-base font-semibold py-3.5 rounded-xl hover:shadow-lg hover:scale-[1.01] transition-all mb-4 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none"
      >
        {isPrivate ? t('exp_reservation_book_private') : t('exp_reservation_book_shared')}
      </button>
      
      <div className="space-y-2 pt-4 border-t border-slate-100 text-[12px] md:text-sm">
        <div className="flex justify-between text-slate-600">
          <span className="underline">{isPrivate ? t('exp_reservation_private_rate') : t('exp_reservation_guest_rate', { price: price.toLocaleString(), count: guestCount })}</span>
          <span>₩{basePrice.toLocaleString()}</span>
        </div>
        {!isPrivate && guestCount === 1 && isSoloGuaranteed && <div className="flex justify-between text-slate-600"><span className="underline">{t('exp_reservation_solo_fee')}</span><span>₩{optionPrice.toLocaleString()}</span></div>}
      </div>
      
      <div className="flex justify-between font-semibold pt-4 border-t border-slate-100 mt-4 text-base md:text-lg"><span>{t('exp_reservation_total')}</span><span>₩{totalPrice.toLocaleString()}</span></div>
    </div>
  );
}
