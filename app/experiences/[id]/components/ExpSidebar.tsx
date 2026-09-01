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
  onContactHost: () => void;
};

export default function ExpSidebar({
  experience,
  availableDates,
  dateToTimeMap,
  calendarDayStatusMap,
  slotSummaryMap,
  handleReserve,
  onContactHost,
}: ExpSidebarProps) {
  return (
    <div id="reservation-card" className="w-full md:w-[380px] scroll-mt-24 md:-mt-[150px]">
      <ReservationCard
        price={experience.price}
        maxGuests={experience.max_guests}
        slotSummaryMap={slotSummaryMap}
        privatePrice={experience.private_price ?? 0}
        isPrivateEnabled={experience.is_private_enabled}
        soloGuaranteePrice={experience.solo_guarantee_price}
        soloGuaranteeOptionVisible={experience.solo_guarantee_option_visible !== false}
        duration={experience.duration ?? 2}
        availableDates={availableDates}
        dateToTimeMap={dateToTimeMap}
        calendarDayStatusMap={calendarDayStatusMap}
        onReserve={handleReserve}
        onContactHost={onContactHost}
      />
    </div>
  );
}
