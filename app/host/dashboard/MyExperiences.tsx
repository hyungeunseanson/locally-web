'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Edit } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';

export default function MyExperiences() {
  const supabase = createClient();
  const [experiences, setExperiences] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('experiences').select('*, bookings(count)').eq('host_id', user.id).order('created_at', { ascending: false });
      if (data) setExperiences(data);
    };
    fetchData();
  }, []);

  return (
    <div className="grid gap-6">
      {experiences.length === 0 && <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">등록된 체험이 없습니다.</div>}
      {experiences.map((exp) => (
        <div key={exp.id} className="bg-white border rounded-2xl p-6 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
          <div className="flex gap-4 items-center">
            {exp.image_url ? <img src={exp.image_url} className="w-16 h-16 rounded-lg object-cover bg-slate-100" /> : <div className="w-16 h-16 bg-slate-200 rounded-lg"/>}
            <div><h2 className="font-bold text-lg">{exp.title}</h2><p className="text-sm text-slate-500">₩{Number(exp.price).toLocaleString()} · 예약 {exp.bookings?.[0]?.count || 0}건</p></div>
          </div>
          <div className="flex gap-2">
            <Link href={`/host/experiences/${exp.id}/dates`}><button className="px-4 py-2 border rounded-lg text-sm font-bold hover:bg-slate-50 flex items-center gap-2"><Calendar size={16}/> 일정</button></Link>
            <Link href={`/host/experiences/${exp.id}/edit`}><button className="px-4 py-2 border rounded-lg text-sm font-bold hover:bg-slate-50 flex items-center gap-2"><Edit size={16}/> 수정</button></Link>
          </div>
        </div>
      ))}
    </div>
  );
}