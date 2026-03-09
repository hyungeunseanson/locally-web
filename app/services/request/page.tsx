'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Clock, Users, Globe, FileText, Phone, User } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext';
import SiteHeader from '@/app/components/SiteHeader';
import Spinner from '@/app/components/ui/Spinner';

const LANGUAGE_OPTIONS = ['한국어', '영어', '일본어', '중국어'];
const CITY_OPTIONS = ['도쿄', '오사카', '후쿠오카', '삿포로', '나고야', '서울', '부산', '제주'];

function ServiceRequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const { t } = useLanguage();

  const TIME_OPTIONS = Array.from({ length: 25 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8;
    const min = i % 2 === 0 ? '00' : '30';
    return `${String(hour).padStart(2, '0')}:${min}`;
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [serviceDate, setServiceDate] = useState(searchParams.get('date') || '');
  const [startTime, setStartTime] = useState(searchParams.get('startTime') || '');
  const [durationHours, setDurationHours] = useState(Number(searchParams.get('duration')) || 4);
  const [guestCount, setGuestCount] = useState(Number(searchParams.get('guests')) || 1);
  const [languages, setLanguages] = useState<string[]>([]);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalPrice = 35000 * durationHours;

  const toggleLanguage = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !city || !serviceDate || !startTime || !contactName.trim() || !contactPhone.trim()) {
      showToast(t('srf_err_required') as string, 'error');
      return;
    }
    if (durationHours < 4) {
      showToast(t('srf_err_min_hrs') as string, 'error');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast(t('srf_err_login') as string, 'error');
      router.push('/login');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/services/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, city, country: 'JP',
          service_date: serviceDate,
          start_time: startTime,
          duration_hours: durationHours,
          guest_count: guestCount,
          languages,
          contact_name: contactName,
          contact_phone: contactPhone,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || t('srf_err_fail'), 'error');
        return;
      }

      showToast(t('srf_success') as string, 'success');
      router.push(`/services/${data.requestId}/payment`);
    } catch {
      showToast(t('server_error') as string || '서버 오류가 발생했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 pb-28 md:pb-12">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6 md:mb-8">
          <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="text-[18px] md:text-2xl font-black tracking-tight">{t('srf_title')}</h1>
            <p className="text-[11px] md:text-sm text-slate-500 mt-0.5">{t('srf_desc')}</p>
          </div>
        </div>

        <div className="space-y-5 md:space-y-6">
          {/* 의뢰 제목 */}
          <div>
            <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-1.5">
              <FileText size={13} className="inline mr-1.5" />{t('srf_req_title_label')}
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('srf_req_title_ph') as string}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* 도시 */}
          <div>
            <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-1.5">
              <Globe size={13} className="inline mr-1.5" />{t('srf_city_label')}
            </label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            >
              <option value="">{t('srf_city_ph')}</option>
              {CITY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c === '도쿄' ? t('city_tokyo') : c === '오사카' ? t('city_osaka') : c === '후쿠오카' ? t('city_fukuoka') : c === '삿포로' ? t('city_sapporo') : c === '나고야' ? t('city_nagoya') : c === '서울' ? t('city_seoul') : c === '부산' ? t('city_busan') : c === '제주' ? t('city_jeju') : c}</option>
              ))}
            </select>
          </div>

          {/* 날짜 & 시간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-1.5">{t('srf_date_label')}</label>
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] md:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-1.5">{t('srf_time_label')}</label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] md:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              >
                <option value="">{t('srf_time_ph')}</option>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* 이용 시간 & 인원 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-1.5">
                <Clock size={13} className="inline mr-1.5" />{t('srf_duration_label')}
              </label>
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              >
                {[4, 5, 6, 7, 8, 9, 10, 12].map((h) => (
                  <option key={h} value={h}>{h}{t('req_duration_hours')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-1.5">
                <Users size={13} className="inline mr-1.5" />{t('srf_guests_label')}
              </label>
              <select
                value={guestCount}
                onChange={(e) => setGuestCount(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>{n}{t('req_guest_count')}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 필요 언어 */}
          <div>
            <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-2">{t('srf_lang_label')}</label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleLanguage(lang)}
                  className={`px-3 py-1.5 rounded-full text-[12px] md:text-sm font-medium border transition-colors ${languages.includes(lang)
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                >
                  {lang === '한국어' ? t('lang_ko') : lang === '영어' ? t('lang_en') : lang === '일본어' ? t('lang_ja') : lang === '중국어' ? t('lang_zh') : lang}
                </button>
              ))}
            </div>
          </div>

          {/* 상세 설명 */}
          <div>
            <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-1.5">{t('srf_desc_label')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder={t('srf_desc_ph') as string}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none placeholder:text-slate-400"
            />
          </div>

          {/* 연락처 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-1.5">
                <User size={13} className="inline mr-1.5" />{t('srf_name_label')}
              </label>
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder={t('srf_name_ph') as string}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-1.5">
                <Phone size={13} className="inline mr-1.5" />{t('srf_phone_label')}
              </label>
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder={t('srf_phone_ph') as string}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* 가격 요약 */}
          <div className="bg-slate-50 rounded-2xl p-4 md:p-5 border border-slate-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[12px] md:text-sm text-slate-500">{t('srf_summary_price_hr')}</span>
              <span className="text-[13px] md:text-sm font-semibold">₩35,000</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[12px] md:text-sm text-slate-500">{t('srf_summary_duration')}</span>
              <span className="text-[13px] md:text-sm font-semibold">{durationHours}{t('req_duration_hours')}</span>
            </div>
            <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between items-center">
              <span className="text-[13px] md:text-sm font-bold text-slate-900">{t('srf_summary_total')}</span>
              <span className="text-[16px] md:text-lg font-black text-slate-900">₩{totalPrice.toLocaleString()}</span>
            </div>
          </div>

          {/* 제출 버튼 */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[14px] md:text-base hover:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
          >
            {isSubmitting ? t('processing') : t('srf_btn_submit')}
          </button>
          <p className="text-[10px] md:text-xs text-slate-400 text-center">
            {t('srf_submit_notice')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ServiceRequestPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Spinner size={30} variant="muted" />
      </div>
    }>
      <ServiceRequestForm />
    </Suspense>
  );
}
