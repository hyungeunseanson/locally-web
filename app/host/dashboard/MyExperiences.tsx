'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Edit, Eye, Trash2, MapPin, Clock } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';

export default function MyExperiences() {
  const supabase = createClient();
  const [experiences, setExperiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyExperiences();
  }, []);

  const fetchMyExperiences = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('experiences')
      .select('*, bookings(count)')
      .eq('host_id', user.id)
      .order('created_at', { ascending: false });

    if (data) setExperiences(data);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    await supabase.from('experiences').delete().eq('id', id);
    fetchMyExperiences();
  };

  if (loading) return <div className="py-20 text-center text-slate-400">데이터를 불러오는 중...</div>;

  return (
    <div className="grid gap-6">
      {experiences.length === 0 && (
        <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
          <p className="mb-4">등록된 체험이 없습니다.</p>
          <Link href="/host/create">
            <button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:scale-105 transition-transform">
              첫 체험 등록하기
            </button>
          </Link>
        </div>
      )}
      
      {experiences.map((exp) => (
        <div key={exp.id} className="bg-white border border-slate-100 rounded-2xl p-6 flex justify-between items-center shadow-sm hover:shadow-lg transition-all">
          <div className="flex gap-5 items-center">
            {/* 썸네일 표시 */}
            <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0 relative">
              {exp.photos && exp.photos.length > 0 ? (
                <img src={exp.photos[0]} className="w-full h-full object-cover" alt={exp.title} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">No Img</div>
              )}
              {/* 상태 뱃지 */}
              <div className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase text-white ${
                exp.status === 'active' ? 'bg-green-500' : 'bg-slate-500'
              }`}>
                {exp.status === 'active' ? '판매중' : '심사중'}
              </div>
            </div>

            <div>
              <h2 className="font-bold text-xl mb-1">{exp.title}</h2>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="flex items-center gap-1"><MapPin size={14}/> {exp.city}</span>
                <span className="flex items-center gap-1"><Clock size={14}/> {exp.duration}시간</span>
              </div>
              <p className="text-sm font-bold text-slate-900 mt-2">
                ₩{Number(exp.price).toLocaleString()} 
                <span className="text-slate-400 font-normal ml-2">· 예약 {exp.bookings?.[0]?.count || 0}건</span>
              </p>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            <Link href={`/host/experiences/${exp.id}/dates`}>
              <button className="px-4 py-2.5 border rounded-xl text-sm font-bold hover:bg-slate-50 flex items-center gap-2 transition-colors">
                <Calendar size={16}/> 일정 관리
              </button>
            </Link>
            <Link href={`/host/experiences/${exp.id}/edit`}>
              <button className="px-4 py-2.5 border rounded-xl text-sm font-bold hover:bg-slate-50 flex items-center gap-2 transition-colors">
                <Edit size={16}/> 수정
              </button>
            </Link>
            <button 
              onClick={() => handleDelete(exp.id)}
              className="p-2.5 border rounded-xl text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all"
              title="삭제"
            >
              <Trash2 size={18}/>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}