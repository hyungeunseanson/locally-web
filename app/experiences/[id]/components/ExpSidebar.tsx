'use client';

import React from 'react';
import ReservationCard from './ReservationCard';
import { ExperienceCalendarDayStatus, ExperienceDetail, ExperienceSlotSummary } from '../types';

type ExpSidebarProps = {
  experience: ExperienceDetail;
  availableDates: string[];
  dateToTimeMap: Record<string, string[]>;
  calendarDayStatusMap: Record<string, ExperienceCalendarDayStatus>;
  slotSummaryMap: Record<string, ExperienceSlotSummary>;
  handleReserve: (date: string, time: string, guests: number, isPrivate: boolean, isSoloGuaranteed: boolean) => void;
};

export default function ExpSidebar({
  experience,
  availableDates,
  dateToTimeMap,
  calendarDayStatusMap,
  slotSummaryMap,
  handleReserve
}: ExpSidebarProps) {
  return (
    <div id="reservation-card" className="w-full md:w-[380px] scroll-mt-24 md:-mt-[150px]">
      <ReservationCard
        price={Number(experience.price)}
        maxGuests={Number(experience.max_guests || 10)}
        slotSummaryMap={slotSummaryMap}
        privatePrice={Number(experience.private_price)}
        isPrivateEnabled={experience.is_private_enabled}
        duration={Number(experience.duration || 2)}
        availableDates={availableDates}
        dateToTimeMap={dateToTimeMap}
        calendarDayStatusMap={calendarDayStatusMap}
        onReserve={handleReserve}
      />
    </div>
  );
}
