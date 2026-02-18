'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Edit, Eye, Trash2, MapPin, Clock, AlertCircle } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 1. Import

export default function MyExperiences() {
  const { t } = useLanguage(); // 🟢 2. Hook
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
    if (!confirm(t('exp_delete_confirm'))) return; // 🟢 번역
    await supabase.from('experiences').delete().eq('id', id);
    fetchMyExperiences();
  };




  if (loading) return <div className="py-20 text-center text-slate-400">{t('loading')}</div>; // 🟢 번역

  return (
    <div className="grid gap-6">
      {experiences.length === 0 && (
        <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
<p className="mb-4">{t('exp_empty_title')}</p> {/* 🟢 번역 */}
          <Link href="/host/create">
            <button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:scale-105 transition-transform">
{t('btn_first_exp')} {/* 🟢 번역 */}
            </button>
          </Link>
        </div>
      )}
      
      {experiences.map((exp) => (
        <div key={exp.id} className="group flex flex-col gap-2">
          {/* 관리자 코멘트 표시 */}
          {(exp.status === 'revision' || exp.status === 'rejected') && exp.admin_comment && (
            <div className={`p-4 rounded-2xl border flex items-start gap-3 text-sm animate-in fade-in slide-in-from-top-1 duration-300 ${
              exp.status === 'revision' ? 'bg-orange-50 border-orange-100 text-orange-800' : 'bg-red-50 border-red-100 text-red-800'
            }`}>
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold mr-2">
                {exp.status === 'revision' ? t('admin_req_revision') : t('admin_req_rejected')} {/* 🟢 번역 */}
                </span>
                {exp.admin_comment}
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-100 rounded-2xl p-6 flex justify-between items-center shadow-sm hover:shadow-lg transition-all">
            <div className="flex gap-5 items-center">
              {/* 썸네일 */}
              <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0 relative border border-slate-50">
                {exp.photos && exp.photos.length > 0 ? (
                  <img src={exp.photos[0]} className="w-full h-full object-cover" alt={exp.title} />
                ) : (
<div className="w-full h-full flex items-center justify-center text-xs text-slate-400">{t('exp_no_img')}</div> 
                )}
                {/* 상태 뱃지 */}
                <div className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase text-white shadow-sm ${
                  exp.status === 'active' ? 'bg-green-500' : 
                  exp.status === 'revision' ? 'bg-orange-500' :
                  exp.status === 'rejected' ? 'bg-red-500' : 'bg-slate-500'
                }`}>
                  {exp.status === 'active' ? t('exp_selling') : 
                   exp.status === 'revision' ? t('exp_status_revision') :
                   exp.status === 'rejected' ? t('exp_status_rejected') : t('exp_status_pending')} {/* 🟢 번역 */}
                </div>
              </div>

              <div>
                <h2 className="font-bold text-xl mb-1">{exp.title}</h2>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span className="flex items-center gap-1"><MapPin size={14}/> {t(`city_${exp.city?.toLowerCase()}`) || exp.city}</span> {/* 🟢 도시 번역 */}
                  <span className="flex items-center gap-1"><Clock size={14}/> {exp.duration}{t('unit_hours')}</span> {/* 🟢 번역 */}
                </div>
                <p className="text-sm font-bold text-slate-900 mt-2">
                  ₩{Number(exp.price).toLocaleString()} 
                  <span className="text-slate-400 font-normal ml-2">· {t('exp_booking_count')} {exp.bookings?.[0]?.count || 0}{t('exp_count_unit')}</span> {/* 🟢 번역 */}
                </p>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-2">
              <Link href={`/host/experiences/${exp.id}/dates`}>
                <button className="px-4 py-2.5 border rounded-xl text-sm font-bold hover:bg-slate-50 flex items-center gap-2 transition-colors">
                <Calendar size={16}/> {t('exp_schedule')} {/* 🟢 번역 */}
                </button>
              </Link>
              <Link href={`/host/experiences/${exp.id}/edit`}>
                <button className={`px-4 py-2.5 border rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                  exp.status === 'revision' ? 'bg-black text-white' : 'hover:bg-slate-50'
                }`}>
<Edit size={16}/> {exp.status === 'revision' ? t('btn_edit_app') : t('exp_edit')} {/* 🟢 번역 */}
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
        </div>
      ))}
    </div>
  );
}