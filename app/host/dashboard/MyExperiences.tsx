'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Edit, Trash2, MapPin, Clock, AlertCircle, Users } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useLanguage } from '@/app/context/LanguageContext';

interface ExperienceBookingCount {
  count?: number | null;
}

interface ExperienceRecord {
  id: string;
  title: string;
  city?: string | null;
  duration?: number | null;
  max_guests?: number | string | null;
  price?: number | string | null;
  photos?: string[] | null;
  status?: string | null;
  admin_comment?: string | null;
  bookings?: ExperienceBookingCount[] | null;
}

const CITY_MAP: Record<string, string> = {
  '서울': 'seoul', '부산': 'busan', '제주': 'jeju',
  '도쿄': 'tokyo', '오사카': 'osaka', '후쿠오카': 'fukuoka',
  '삿포로': 'sapporo', '나고야': 'nagoya'
};

export default function MyExperiences() {
  const { t } = useLanguage();
  const supabase = createClient();

  const [experiences, setExperiences] = useState<ExperienceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadExperiences = useCallback(async (): Promise<ExperienceRecord[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    const { data } = await supabase
      .from('experiences')
      .select('*, bookings(count)')
      .eq('host_id', user.id)
      .order('created_at', { ascending: false });

    return data ?? [];
  }, [supabase]);

  const refreshMyExperiences = useCallback(async () => {
    const nextExperiences = await loadExperiences();
    setExperiences(nextExperiences ?? []);
    setLoading(false);
  }, [loadExperiences]);

  useEffect(() => {
    let isActive = true;

    const initializeExperiences = async () => {
      const nextExperiences = await loadExperiences();
      if (!isActive) return;
      setExperiences(nextExperiences ?? []);
      setLoading(false);
    };

    void initializeExperiences();

    return () => {
      isActive = false;
    };
  }, [loadExperiences]);

  const handleDelete = async (id: string) => {
    if (!confirm(t('exp_delete_confirm'))) return;
    await supabase.from('experiences').delete().eq('id', id);
    await refreshMyExperiences();
  };

  const getCityLabel = useCallback((city?: string | null) => {
    if (!city) return '-';
    const cityKey = CITY_MAP[city] || city.toLowerCase();
    const translatedCity = t(`city_${cityKey}`);
    return translatedCity !== `city_${cityKey}` ? translatedCity : city;
  }, [t]);

  const getStatusLabel = useCallback((status?: string | null) => {
    switch (status) {
      case 'active':
        return t('exp_selling');
      case 'revision':
        return t('exp_status_revision');
      case 'rejected':
        return t('exp_status_rejected');
      default:
        return t('exp_status_pending');
    }
  }, [t]);

  const getStatusClasses = (status?: string | null) => {
    if (status === 'active') return 'bg-green-500 text-white';
    if (status === 'revision') return 'bg-orange-500 text-white';
    if (status === 'rejected') return 'bg-red-500 text-white';
    return 'bg-slate-500 text-white';
  };

  const formatPrice = (price?: number | string | null) => {
    const numericPrice = typeof price === 'number' ? price : Number(price);
    return Number.isFinite(numericPrice) ? `₩${numericPrice.toLocaleString()}` : '-';
  };

  const formatDuration = (duration?: number | null) => {
    if (duration == null) return '-';
    return `${duration}${t('unit_hours')}`;
  };

  const formatMaxGuests = (maxGuests?: number | string | null) => {
    const numericGuests = typeof maxGuests === 'number' ? maxGuests : Number(maxGuests);
    if (!Number.isFinite(numericGuests)) return '-';
    return `${numericGuests}${t('req_guest_count')}`;
  };

  if (loading) return <div className="py-20 text-center text-slate-400">{t('loading')}</div>;

  return (
    <div className="grid gap-3 md:gap-6">
      {experiences.length === 0 && (
        <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
          <p className="mb-4">{t('exp_empty_title')}</p>
          <Link href="/host/create">
            <button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:scale-105 transition-transform">
              {t('btn_first_exp')}
            </button>
          </Link>
        </div>
      )}

      {experiences.map((exp) => (
        <div key={exp.id} className="group flex flex-col gap-2">
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

          <div className="overflow-hidden rounded-2xl md:rounded-3xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
            <div className="md:hidden p-4">
              <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-3">
                <div className="relative h-[112px] w-[88px] overflow-hidden rounded-2xl border border-slate-100 bg-slate-100">
                  {exp.photos && exp.photos.length > 0 ? (
                    <img src={exp.photos[0]} className="h-full w-full object-cover" alt={exp.title} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center px-2 text-center text-[10px] md:text-xs text-slate-400">{t('exp_no_img')}</div>
                  )}
                  <div className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] md:text-xs font-bold shadow-sm ${getStatusClasses(exp.status)}`}>
                    {getStatusLabel(exp.status)}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-[14px] md:text-lg font-bold leading-snug text-slate-900 line-clamp-2">
                    {exp.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] md:text-sm font-medium text-slate-600">
                      <MapPin size={12} className="shrink-0 text-slate-400" />
                      <span className="truncate">{getCityLabel(exp.city)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] md:text-sm font-medium text-slate-600">
                      <Clock size={12} className="shrink-0 text-slate-400" />
                      <span>{formatDuration(exp.duration)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] md:text-sm font-medium text-slate-600">
                      <Users size={12} className="shrink-0 text-slate-400" />
                      <span>{formatMaxGuests(exp.max_guests)}</span>
                    </span>
                  </div>
                </div>

                <div className="col-span-2 rounded-2xl border border-slate-100 bg-slate-50/80 px-3.5 py-3">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] md:text-xs font-semibold text-slate-400">
                        {t('label_price')}
                      </p>
                      <p className="mt-1 text-[16px] md:text-lg font-black text-slate-900">
                        {formatPrice(exp.price)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] md:text-xs font-semibold text-slate-400">
                        {t('exp_booking_count')}
                      </p>
                      <p className="mt-1 text-[12px] md:text-sm font-semibold text-slate-600">
                        {exp.bookings?.[0]?.count || 0}{t('exp_count_unit')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  href={`/host/experiences/${exp.id}/dates`}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[12px] md:text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <Calendar size={15} />
                  <span>{t('exp_schedule')}</span>
                </Link>
                <Link
                  href={`/host/experiences/${exp.id}/edit`}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-[12px] md:text-sm font-semibold transition-colors ${exp.status === 'revision'
                    ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  <Edit size={15} />
                  <span>{exp.status === 'revision' ? t('btn_edit_app') : t('exp_edit')}</span>
                </Link>
                <button
                  onClick={() => handleDelete(exp.id)}
                  className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 text-[12px] md:text-sm font-semibold text-red-600 transition-colors hover:border-red-200 hover:bg-red-100"
                  title="삭제"
                >
                  <Trash2 size={15} />
                  <span>삭제</span>
                </button>
              </div>
            </div>

            <div className="hidden md:flex items-center justify-between gap-4 p-6">
              <div className="flex min-w-0 items-center gap-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-slate-100">
                  {exp.photos && exp.photos.length > 0 ? (
                    <img src={exp.photos[0]} className="h-full w-full object-cover" alt={exp.title} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center px-2 text-center text-sm text-slate-400">{t('exp_no_img')}</div>
                  )}
                  <div className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ${getStatusClasses(exp.status)}`}>
                    {getStatusLabel(exp.status)}
                  </div>
                </div>

                <div className="min-w-0">
                  <h2 className="mb-1 text-xl font-bold leading-snug text-slate-900">{exp.title}</h2>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={13} className="shrink-0" />
                      {getCityLabel(exp.city)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={13} className="shrink-0" />
                      {formatDuration(exp.duration)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-900">
                    {formatPrice(exp.price)}
                    <span className="ml-1.5 font-normal text-slate-400">
                      · {exp.bookings?.[0]?.count || 0}{t('exp_count_unit')}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/host/experiences/${exp.id}/dates`}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Calendar size={16} />
                  <span>{t('exp_schedule')}</span>
                </Link>
                <Link
                  href={`/host/experiences/${exp.id}/edit`}
                  className={`inline-flex items-center justify-center gap-1 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${exp.status === 'revision'
                    ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  <Edit size={16} />
                  <span>{exp.status === 'revision' ? t('btn_edit_app') : t('exp_edit')}</span>
                </Link>
                <button
                  onClick={() => handleDelete(exp.id)}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 p-2.5 text-slate-400 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                  title="삭제"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
