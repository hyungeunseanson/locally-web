'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Clock, Users, Globe, FileText, Phone, User } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import SiteHeader from '@/app/components/SiteHeader';

const LANGUAGE_OPTIONS = ['한국어', '영어', '일본어', '중국어'];
const CITY_OPTIONS = ['도쿄', '오사카', '후쿠오카', '삿포로', '나고야', '서울', '부산', '제주'];

export default function ServiceRequestPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationHours, setDurationHours] = useState(4);
  const [guestCount, setGuestCount] = useState(1);
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
      showToast('모든 필수 항목을 입력해주세요.', 'error');
      return;
    }
    if (durationHours < 4) {
      showToast('최소 이용 시간은 4시간입니다.', 'error');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast('로그인이 필요합니다.', 'error');
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
        showToast(data.error || '의뢰 등록에 실패했습니다.', 'error');
        return;
      }

      showToast('의뢰가 등록되었습니다! 호스트들이 지원을 시작합니다.', 'success');
      router.push(`/services/${data.requestId}`);
    } catch {
      showToast('서버 오류가 발생했습니다.', 'error');
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
            <h1 className="text-[18px] md:text-2xl font-black tracking-tight">맞춤 서비스 의뢰</h1>
            <p className="text-[11px] md:text-sm text-slate-500 mt-0.5">원하는 내용을 작성하면 현지 호스트가 지원합니다</p>
          </div>
        </div>

        <div className="space-y-5 md:space-y-6">
          {/* 의뢰 제목 */}
          <div>
            <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-1.5">
              <FileText size={13} className="inline mr-1.5" />의뢰 제목 *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 도쿄 아사쿠사 지역 반나절 동행 통역"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* 도시 */}
          <div>
            <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-1.5">
              <Globe size={13} className="inline mr-1.5" />도시 *
            </label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            >
              <option value="">도시를 선택하세요</option>
              {CITY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 날짜 & 시간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-1.5">서비스 날짜 *</label>
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-1.5">시작 시간 *</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* 이용 시간 & 인원 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-1.5">
                <Clock size={13} className="inline mr-1.5" />이용 시간 (최소 4h) *
              </label>
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              >
                {[4, 5, 6, 7, 8, 9, 10, 12].map((h) => (
                  <option key={h} value={h}>{h}시간</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-1.5">
                <Users size={13} className="inline mr-1.5" />인원 *
              </label>
              <select
                value={guestCount}
                onChange={(e) => setGuestCount(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>{n}명</option>
                ))}
              </select>
            </div>
          </div>

          {/* 필요 언어 */}
          <div>
            <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-2">필요 언어 (복수 선택 가능)</label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleLanguage(lang)}
                  className={`px-3 py-1.5 rounded-full text-[12px] md:text-sm font-medium border transition-colors ${
                    languages.includes(lang)
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* 상세 설명 */}
          <div>
            <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-1.5">상세 설명 *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="원하시는 서비스 내용을 자세히 설명해주세요.&#10;예: 병원 통역, 쇼핑 동행, 비즈니스 미팅 등..."
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none placeholder:text-slate-400"
            />
          </div>

          {/* 연락처 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-1.5">
                <User size={13} className="inline mr-1.5" />이름 *
              </label>
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="홍길동"
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-[12px] md:text-sm font-bold text-slate-700 mb-1.5">
                <Phone size={13} className="inline mr-1.5" />연락처 *
              </label>
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="010-1234-5678"
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* 가격 요약 */}
          <div className="bg-slate-50 rounded-2xl p-4 md:p-5 border border-slate-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[12px] md:text-sm text-slate-500">시간당 요금</span>
              <span className="text-[13px] md:text-sm font-semibold">₩35,000</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[12px] md:text-sm text-slate-500">이용 시간</span>
              <span className="text-[13px] md:text-sm font-semibold">{durationHours}시간</span>
            </div>
            <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between items-center">
              <span className="text-[13px] md:text-sm font-bold text-slate-900">총 예상 금액</span>
              <span className="text-[16px] md:text-lg font-black text-slate-900">₩{totalPrice.toLocaleString()}</span>
            </div>
          </div>

          {/* 제출 버튼 */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[14px] md:text-base hover:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
          >
            {isSubmitting ? '의뢰 등록 중...' : '의뢰 등록하기'}
          </button>
          <p className="text-[10px] md:text-xs text-slate-400 text-center">
            의뢰 등록 후 현지 호스트들의 지원을 받고, 마음에 드는 호스트를 선택한 뒤 결제하면 매칭이 완료됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
