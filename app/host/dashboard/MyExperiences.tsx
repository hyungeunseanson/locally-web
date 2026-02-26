'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Edit, Eye, Trash2, MapPin, Clock, AlertCircle } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 1. Import

export default function MyExperiences() {
  const { t } = useLanguage(); // 🟢 2. Hook
  const supabase = createClient();

  // 🟢 도시 이름 매핑 (DB 데이터 -> 번역 키)
  const cityMap: Record<string, string> = {
    '서울': 'seoul', '부산': 'busan', '제주': 'jeju',
    '도쿄': 'tokyo', '오사카': 'osaka', '후쿠오카': 'fukuoka',
    '삿포로': 'sapporo', '나고야': 'nagoya'
  };

  const [experiences, setExperiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyExperiences = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('experiences')
      .select('*, bookings(count)')
      .eq('host_id', user.id)
      .order('created_at', { ascending: false });

    if (data) setExperiences(data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchMyExperiences();
  }, [fetchMyExperiences]);

  const handleDelete = async (id: string) => {
    if (!confirm(t('exp_delete_confirm'))) return; // 🟢 번역
    await supabase.from('experiences').delete().eq('id', id);
    fetchMyExperiences();
  };




  if (loading) return <div className="py-20 text-center text-slate-400">{t('loading')}</div>; // 🟢 번역

  return (
    <div className="grid gap-3 md:gap-6">
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
            <div className={`px-3 py-2.5 md:p-4 rounded-xl md:rounded-2xl border flex items-start gap-2 text-[11px] md:text-sm animate-in fade-in slide-in-from-top-1 duration-300 ${exp.status === 'revision' ? 'bg-orange-50 border-orange-100 text-orange-800' : 'bg-red-50 border-red-100 text-red-800'
              }`}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold mr-1">
                  {exp.status === 'revision' ? t('admin_req_revision') : t('admin_req_rejected')}
                </span>
                {exp.admin_comment}
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-100 rounded-2xl px-3 py-3 md:p-6 flex justify-between items-center shadow-sm hover:shadow-md transition-all">
            <div className="flex gap-3 items-center">
              {/* 썸네일 */}
              <div className="w-14 h-14 md:w-24 md:h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0 relative border border-slate-50">
                {exp.photos && exp.photos.length > 0 ? (
                  <img src={exp.photos[0]} className="w-full h-full object-cover" alt={exp.title} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">{t('exp_no_img')}</div>
                )}
                {/* 상태 뱃지 */}
                <div className={`absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase text-white shadow-sm ${exp.status === 'active' ? 'bg-green-500' :
                  exp.status === 'revision' ? 'bg-orange-500' :
                    exp.status === 'rejected' ? 'bg-red-500' : 'bg-slate-500'
                  }`}>
                  {exp.status === 'active' ? t('exp_selling') :
                    exp.status === 'revision' ? t('exp_status_revision') :
                      exp.status === 'rejected' ? t('exp_status_rejected') : t('exp_status_pending')}
                </div>
              </div>

              <div className="min-w-0">
                <h2 className="font-bold text-[13px] md:text-xl mb-0.5 leading-snug">{exp.title}</h2>
                <div className="flex items-center gap-2 text-[11px] md:text-sm text-slate-500">
                  <span className="flex items-center gap-0.5">
                    <MapPin size={11} className="shrink-0" />
                    {t(`city_${cityMap[exp.city] || exp.city?.toLowerCase()}`) !== `city_${cityMap[exp.city] || exp.city?.toLowerCase()}`
                      ? t(`city_${cityMap[exp.city] || exp.city?.toLowerCase()}`)
                      : exp.city}
                  </span>
                  <span className="flex items-center gap-0.5"><Clock size={11} className="shrink-0" /> {exp.duration}{t('unit_hours')}</span>
                </div>
                <p className="text-[12px] md:text-sm font-bold text-slate-900 mt-1">
                  ₩{Number(exp.price).toLocaleString()}
                  <span className="text-slate-400 font-normal ml-1.5">· {exp.bookings?.[0]?.count || 0}{t('exp_count_unit')}</span>
                </p>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex flex-row md:flex-row gap-2 md:gap-2 shrink-0">
              <Link href={`/host/experiences/${exp.id}/dates`}>
                <button
                  className="w-9 h-9 md:w-auto md:h-auto md:px-4 md:py-2.5 border rounded-xl text-[11px] md:text-sm font-bold hover:bg-slate-50 flex items-center justify-center md:justify-start gap-1 transition-colors"
                  title={t('exp_schedule')}
                >
                  <Calendar size={15} />
                  <span className="hidden md:inline text-[11px]">{t('exp_schedule')}</span>
                </button>
              </Link>
              <Link href={`/host/experiences/${exp.id}/edit`}>
                <button className={`w-9 h-9 md:w-auto md:h-auto md:px-4 md:py-2.5 border rounded-xl text-[11px] md:text-sm font-bold flex items-center justify-center md:justify-start gap-1 transition-all ${exp.status === 'revision' ? 'bg-black text-white' : 'hover:bg-slate-50'
                  }`}>
                  <Edit size={15} />
                  <span className="hidden md:inline text-[11px]">{exp.status === 'revision' ? t('btn_edit_app') : t('exp_edit')}</span>
                </button>
              </Link>
              <button
                onClick={() => handleDelete(exp.id)}
                className="w-9 h-9 md:w-auto md:h-auto md:p-2.5 border rounded-xl text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all flex items-center justify-center"
                title="삭제"
              >
                <Trash2 size={15} className="md:hidden" />
                <Trash2 size={18} className="hidden md:block" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
