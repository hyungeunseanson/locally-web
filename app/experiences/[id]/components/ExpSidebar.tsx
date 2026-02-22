'use client';

import React from 'react';
import ReservationCard from './ReservationCard';

export default function ExpSidebar({ experience, availableDates, dateToTimeMap, remainingSeatsMap, handleReserve }: any) {
  return (
    <div id="reservation-card" className="w-full md:w-[380px] scroll-mt-24">
      <ReservationCard
        price={Number(experience.price)}
        // ✅ 프라이빗 정보 전달 (중요)
        maxGuests={Number(experience.max_guests || 10)} // 🟢 최대 인원 추가
        remainingSeatsMap={remainingSeatsMap} // 🟢 잔여석 정보 추가
        privatePrice={Number(experience.private_price)}
        isPrivateEnabled={experience.is_private_enabled}
        duration={Number(experience.duration || 2)}
        availableDates={availableDates}
        dateToTimeMap={dateToTimeMap}
        onReserve={handleReserve}
      />
    </div>
  );
}