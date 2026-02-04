'use client';

import React from 'react';
import { Star } from 'lucide-react';

export default function HostReviews() {
  return (
    <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
      <Star size={48} className="mx-auto mb-4 opacity-20"/>
      <p>아직 작성된 후기가 없습니다.</p>
    </div>
  );
}