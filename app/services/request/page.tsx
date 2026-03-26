'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Clock, Users, Globe, FileText, Phone, User, CreditCard } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext';
import SiteHeader from '@/app/components/SiteHeader';
import Spinner from '@/app/components/ui/Spinner';
import { resolveServiceCountry } from '@/app/utils/serviceRequestLocation';

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

  const getLocalizedLanguageLabel = (lang: string) => (
    lang === '한국어'
      ? t('lang_ko')
      : lang === '영어'
        ? t('lang_en')
        : lang === '일본어'
          ? t('lang_ja')
          : lang === '중국어'
            ? t('lang_zh')
            : lang
  );

  const getLocalizedCityLabel = (value: string) => (
    value === '도쿄'
      ? t('city_tokyo')
      : value === '오사카'
        ? t('city_osaka')
        : value === '후쿠오카'
          ? t('city_fukuoka')
          : value === '삿포로'
            ? t('city_sapporo')
            : value === '나고야'
              ? t('city_nagoya')
              : value === '서울'
                ? t('city_seoul')
                : value === '부산'
                  ? t('city_busan')
                  : value === '제주'
                    ? t('city_jeju')
                    : value
  );

  const selectedLanguageSummary = languages.length > 0
    ? languages.map(getLocalizedLanguageLabel).join(' · ')
    : (t('srf_lang_help') as string);

  const summaryCard = (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{t('srf_summary_title')}</p>
      <div className="mt-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-[12px] md:text-sm text-slate-500">{t('srf_summary_price_hr')}</span>
          <span className="text-[13px] md:text-sm font-semibold">₩35,000</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[12px] md:text-sm text-slate-500">{t('srf_summary_duration')}</span>
          <span className="text-[13px] md:text-sm font-semibold">{durationHours}{t('req_duration_hours')}</span>
        </div>
        <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-2 text-[11px] md:text-[12px]">
          <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
            <p className="text-slate-400">{t('srf_city_label')}</p>
            <p className="mt-1 font-semibold text-slate-700">{city ? getLocalizedCityLabel(city) : '-'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
            <p className="text-slate-400">{t('srf_date_label')}</p>
            <p className="mt-1 font-semibold text-slate-700">{serviceDate || '-'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
            <p className="text-slate-400">{t('srf_time_label')}</p>
            <p className="mt-1 font-semibold text-slate-700">{startTime || '-'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
            <p className="text-slate-400">{t('srf_guests_label')}</p>
            <p className="mt-1 font-semibold text-slate-700">{guestCount}{t('req_guest_count')}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
          <p className="text-[11px] text-slate-400">{t('srf_lang_label')}</p>
          <p className="mt-1 text-[12px] leading-5 font-semibold text-slate-700">{selectedLanguageSummary}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-700">{t('srf_summary_next_title')}</p>
          <div className="mt-2 space-y-2 text-[12px] leading-5 text-amber-900">
            <p>{t('srf_summary_next_payment')}</p>
            <p>{t('srf_summary_next_recruit')}</p>
            <p>{t('srf_summary_next_select')}</p>
          </div>
        </div>
        <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
          <span className="text-[13px] md:text-sm font-bold text-slate-900">{t('srf_summary_total')}</span>
          <span className="text-[18px] md:text-[20px] font-black text-slate-900">₩{totalPrice.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );

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
      const resolvedCountry = resolveServiceCountry(city, null);
      if (!resolvedCountry) {
        showToast(t('srf_city_ph') as string, 'error');
        return;
      }

      const res = await fetch('/api/services/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, city, country: resolvedCountry,
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
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10 pb-28 md:pb-12">
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

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-5 md:space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 md:px-5 md:py-5">
              <p className="text-[11px] md:text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{t('srf_flow_title')}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                {[
                  t('srf_flow_step_request'),
                  t('srf_flow_step_payment'),
                  t('srf_flow_step_recruit'),
                  t('srf_flow_step_select'),
                ].map((label, index) => (
                  <div key={String(label)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <p className="text-[10px] font-black text-slate-400">STEP {index + 1}</p>
                    <p className="mt-1 text-[11px] md:text-xs font-semibold leading-5 text-slate-700">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <div className="mb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{t('srf_section_plan_title')}</p>
                <p className="mt-1 text-[12px] md:text-[13px] text-slate-500">{t('srf_section_plan_desc')}</p>
              </div>

              <div className="space-y-4">
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
                    {CITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>{getLocalizedCityLabel(option)}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      {TIME_OPTIONS.map((time) => <option key={time} value={time}>{time}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        {getLocalizedLanguageLabel(lang)}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] md:text-xs text-slate-500">{t('srf_lang_help')}</p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <div className="mb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{t('srf_section_request_title')}</p>
                <p className="mt-1 text-[12px] md:text-[13px] text-slate-500">{t('srf_section_request_desc')}</p>
              </div>
              <div>
                <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-1.5">{t('srf_desc_label')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  placeholder={t('srf_desc_ph') as string}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none placeholder:text-slate-400"
                />
                <p className="mt-2 text-[11px] md:text-xs text-slate-500">{t('srf_desc_help')}</p>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <div className="mb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{t('srf_section_contact_title')}</p>
                <p className="mt-1 text-[12px] md:text-[13px] text-slate-500">{t('srf_section_contact_desc')}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            </section>

            <div className="space-y-4 lg:hidden">
              {summaryCard}
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

          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              {summaryCard}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-slate-900 py-4 text-[14px] font-black text-white shadow-lg transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <CreditCard size={16} />
                  {isSubmitting ? t('processing') : t('srf_btn_submit')}
                </span>
              </button>
              <p className="text-[11px] leading-5 text-slate-400">
                {t('srf_submit_notice')}
              </p>
            </div>
          </aside>
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
