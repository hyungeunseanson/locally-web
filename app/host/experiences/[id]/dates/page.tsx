'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, Calendar as CalIcon, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function ManageDatesPage() {
  const supabase = createClient();
  const params = useParams();
  const [dates, setDates] = useState<any[]>([]);
  const [newDate, setNewDate] = useState('');

  const fetchDates = async () => {
    const { data } = await supabase
      .from('experience_availability')
      .select('*')
      .eq('experience_id', params.id)
      .order('date', { ascending: true });
    if (data) setDates(data);
  };

  useEffect(() => { fetchDates(); }, []);

  const handleAddDate = async () => {
    if (!newDate) return;
    const { error } = await supabase
      .from('experience_availability')
      .insert([{ experience_id: params.id, date: newDate }]);
    
    if (error) alert('이미 등록된 날짜거나 오류가 발생했습니다.');
    else { setNewDate(''); fetchDates(); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await supabase.from('experience_availability').delete().eq('id', id);
    fetchDates();
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <main className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/host/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-black mb-6 font-bold text-sm">
          <ChevronLeft size={16} /> 대시보드로 돌아가기
        </Link>
        <h1 className="text-2xl font-black mb-2">예약 일정 관리 📅</h1>
        <p className="text-slate-500 mb-8">게스트가 예약할 수 있는 날짜를 추가해주세요.</p>

        <div className="flex gap-4 mb-8">
          <input 
            type="date" 
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="flex-1 border border-slate-300 rounded-xl px-4 py-3"
          />
          <button onClick={handleAddDate} className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:scale-105 transition-transform">
            날짜 추가
          </button>
        </div>

        <div className="space-y-2">
          {dates.length === 0 ? <p className="text-center text-slate-400 py-10">등록된 일정이 없습니다.</p> : dates.map((d) => (
            <div key={d.id} className="flex justify-between items-center p-4 border rounded-xl bg-slate-50">
              <div className="flex items-center gap-3">
                <CalIcon size={18} className="text-slate-500"/>
                <span className={`font-bold ${d.is_booked ? 'text-slate-400 line-through' : ''}`}>{d.date}</span>
                {d.is_booked && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">예약됨</span>}
              </div>
              {!d.is_booked && (
                <button onClick={() => handleDelete(d.id)} className="text-slate-400 hover:text-red-500">
                  <Trash2 size={18}/>
                </button>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}