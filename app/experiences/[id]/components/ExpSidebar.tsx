'use client';

import React from 'react';
import ReservationCard from './ReservationCard';

export default function ExpSidebar({ experience, availableDates, dateToTimeMap, handleReserve }: any) {
  return (
    <div className="w-full md:w-[380px]">
      <ReservationCard 
        price={Number(experience.price)} 
        // ✅ 프라이빗 정보 전달 (중요)
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