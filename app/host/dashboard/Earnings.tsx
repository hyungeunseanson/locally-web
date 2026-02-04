'use client';

import React, { useEffect, useState } from 'react';
import { PieChart } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';

export default function Earnings() {
  const supabase = createClient();
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: expData } = await supabase.from('experiences').select('price, bookings(count)').eq('host_id', user.id);
      
      let revenue = 0;
      expData?.forEach((e: any) => {
        revenue += e.price * (e.bookings?.[0]?.count || 0);
      });
      setTotalRevenue(revenue);
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-6">
        <div className="p-6 border rounded-2xl bg-white shadow-sm">
          <p className="text-slate-500 text-xs font-bold mb-1">총 예상 수익 (수수료 제외 전)</p>
          <h3 className="text-3xl font-black">₩{totalRevenue.toLocaleString()}</h3>
        </div>
        <div className="p-6 border rounded-2xl bg-white shadow-sm">
          <p className="text-slate-500 text-xs font-bold mb-1">플랫폼 수수료 (10%)</p>
          <h3 className="text-3xl font-black text-rose-500">- ₩{(totalRevenue * 0.1).toLocaleString()}</h3>
        </div>
        <div className="p-6 border rounded-2xl bg-slate-900 text-white shadow-sm">
          <p className="text-slate-400 text-xs font-bold mb-1">정산 예정 금액</p>
          <h3 className="text-3xl font-black">₩{(totalRevenue * 0.9).toLocaleString()}</h3>
        </div>
      </div>
      <div className="p-10 border rounded-2xl bg-slate-50 text-center">
        <PieChart className="mx-auto text-slate-300 mb-4" size={48}/>
        <p className="text-slate-500">아직 정산 내역이 없습니다.</p>
      </div>
    </div>
  );
}