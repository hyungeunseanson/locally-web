'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Clock, MapPin, Users, DollarSign } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext';
import SiteHeader from '@/app/components/SiteHeader';
import type { ServiceRequest } from '@/app/types/service';

export default function ServiceApplyPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [appealMessage, setAppealMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 호스트 수입 (고객 노출 금지 — UI에서만 사용, 단가 비율 노출 안 함)
  const hostEarning = request ? 20000 * request.duration_hours : 0;

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: req } = await supabase
        .from('service_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (!req) { router.push('/services'); return; }

      if (req.user_id === user.id) {
        showToast('본인의 의뢰에는 지원할 수 없습니다.', 'error');
        router.push(`/services/${requestId}`);
        return;
      }

      if (req.status !== 'open') {
        showToast('마감된 의뢰입니다.', 'error');
        router.push(`/services/${requestId}`);
        return;
      }

      setRequest(req as ServiceRequest);
    };
    void load();
  }, [requestId, router, showToast, supabase]);

  const handleSubmit = async () => {
    if (!appealMessage.trim() || appealMessage.trim().length < 20) {
      showToast('어필 메시지를 20자 이상 작성해주세요.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/services/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId,
          appeal_message: appealMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || '지원에 실패했습니다.', 'error');
        return;
      }
      showToast('지원이 완료되었습니다! 고객의 선택을 기다려주세요.', 'success');
      router.push(`/services/${requestId}`);
    } catch {
      showToast('서버 오류가 발생했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!request) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-slate-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <div className="max-w-lg mx-auto px-4 py-6 md:py-10 pb-28 md:pb-12">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50">
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="text-[18px] md:text-xl font-black">{t('req_apply_title')}</h1>
            <p className="text-[11px] md:text-xs text-slate-500 mt-0.5">{t('req_apply_subtitle')}</p>
          </div>
        </div>

        {/* 의뢰 요약 (읽기 전용) */}
        <div className="bg-slate-50 rounded-2xl p-4 md:p-5 mb-5 border border-slate-100">
          <h2 className="font-bold text-[13px] md:text-sm text-slate-900 mb-2 line-clamp-2">{request.title}</h2>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] md:text-[12px] text-slate-500 mb-2">
            <span className="flex items-center gap-1"><MapPin size={11} />{request.city}</span>
            <span className="flex items-center gap-1"><Clock size={11} />{request.duration_hours}시간</span>
            <span className="flex items-center gap-1"><Users size={11} />{request.guest_count}명</span>
          </div>
          <p className="text-[11px] md:text-[12px] text-slate-500 line-clamp-2">{request.description}</p>

          {/* 예상 수입 (호스트 단가 ₩20,000 — 비율 노출 금지) */}
          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2">
            <DollarSign size={13} className="text-emerald-500" />
            <span className="text-[11px] md:text-[12px] text-slate-500">{t('req_est_income')}</span>
            <span className="font-black text-[14px] md:text-[15px] text-emerald-600">
              ₩{hostEarning.toLocaleString()}
            </span>
          </div>
        </div>

        {/* 어필 메시지 */}
        <div className="mb-5">
          <label className="block text-[13px] md:text-sm font-bold text-slate-700 mb-1.5">
            {t('req_appeal_msg')} * <span className="font-normal text-slate-400 text-[11px]">(최소 20자)</span>
          </label>
          <textarea
            value={appealMessage}
            onChange={(e) => setAppealMessage(e.target.value)}
            rows={6}
            placeholder="나의 강점, 경험, 이 의뢰에 적합한 이유를 작성해주세요.&#10;예: 도쿄 거주 7년 경력의 현지인으로, 병원 통역 경험이 풍부합니다..."
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] md:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none placeholder:text-slate-400"
          />
          <p className="text-[10px] md:text-xs text-slate-400 mt-1 text-right">{appealMessage.length}자</p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting || appealMessage.trim().length < 20}
          className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[14px] md:text-base hover:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
        >
          {isSubmitting ? t('loading') : t('req_btn_apply')}
        </button>
        <p className="text-[10px] md:text-xs text-slate-400 text-center mt-3">
          지원 후 고객이 선택하면 결제가 완료되어 매칭이 확정됩니다.
        </p>
      </div>
    </div>
  );
}
