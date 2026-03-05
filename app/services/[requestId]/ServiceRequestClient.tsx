'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Clock, MapPin, Users, Calendar, CheckCircle,
  MessageSquare, Star, Globe2, ArrowRight, Sparkles, CreditCard,
  UserCheck, ClipboardList
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import SiteHeader from '@/app/components/SiteHeader';
import { useLanguage } from '@/app/context/LanguageContext';
import {
  getServiceRequestStatusLabel,
  isOpenServiceRequest,
  isMatchedServiceRequest,
  isPendingPaymentServiceRequest,
} from '@/app/constants/serviceStatus';
import type { ServiceRequest, ServiceApplicationWithProfile } from '@/app/types/service';
import HostProfileModal from '@/app/experiences/[id]/components/HostProfileModal';

// ── 매칭 스텝 정의 (v2 에스크로) ────────────────────────────────
const MATCHING_STEPS = [
  { icon: CreditCard, labelKey: 'sr_step_pay' },
  { icon: Users, labelKey: 'sr_step_apply' },
  { icon: UserCheck, labelKey: 'sr_step_match' },
  { icon: ClipboardList, labelKey: 'sr_step_complete' },
];

function getActiveStep(status: string) {
  if (status === 'pending_payment') return 0; // 결제 대기 (스텝 0 = 아직 시작 전)
  if (status === 'open') return 1;            // 결제 완료, 호스트 모집 중
  if (status === 'matched') return 2;         // 호스트 선택 완료
  if (status === 'paid' || status === 'confirmed') return 3;
  if (status === 'completed') return 4;
  return 0;
}

// ── 상태 칩 ───────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending_payment: { label: '결제 대기', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  open: { label: '모집중', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  matched: { label: '매칭 완료', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  paid: { label: '결제 완료', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  confirmed: { label: '확정', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  completed: { label: '완료', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  cancelled: { label: '취소', cls: 'bg-red-100 text-red-600 border-red-200' },
  expired: { label: '마감', cls: 'bg-slate-100 text-slate-400 border-slate-200' },
};

export default function ServiceRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [applications, setApplications] = useState<ServiceApplicationWithProfile[]>([]);
  const [myApplication, setMyApplication] = useState<{ id: string; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [hostModal, setHostModal] = useState<{ open: boolean; hostId: string | null }>({ open: false, hostId: null });

  const isOwner = currentUserId !== null && currentUserId === request?.user_id;
  const isSelectedHost = currentUserId !== null && currentUserId === request?.selected_host_id;

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ?? null;
      setCurrentUserId(userId);

      const { data: req } = await supabase
        .from('service_requests').select('*').eq('id', requestId).maybeSingle();
      if (!req) { setLoading(false); return; }
      setRequest(req as ServiceRequest);

      if (userId) {
        try {
          const appsRes = await fetch(`/api/services/applications?requestId=${requestId}`);
          const appsData = await appsRes.json();
          if (appsData.success) {
            if (appsData.isOwner) {
              setApplications((appsData.data ?? []) as ServiceApplicationWithProfile[]);
            } else if (appsData.myApplication) {
              setMyApplication(appsData.myApplication as { id: string; status: string });
            }
          }
        } catch (e) { console.error('applications load error:', e); }
      }
      setLoading(false);
    };
    void load();
  }, [requestId, supabase]);

  const handleSelectHost = async (applicationId: string) => {
    if (!window.confirm(t('sr_confirm_select_host'))) return;
    setSelecting(applicationId);
    try {
      const res = await fetch('/api/services/select-host', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, application_id: applicationId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { showToast(data.error || t('sr_select_host_fail'), 'error'); return; }
      showToast(t('sr_select_host_success'), 'success');
      // v2 에스크로: 결제는 이미 완료 — 페이지 새로고침으로 상태 반영
      router.refresh();
    } catch {
      showToast(t('server_error'), 'error');
    } finally { setSelecting(null); }
  };

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-100 border-t-slate-900" />
    </div>
  );

  if (!request) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
      <p className="text-slate-400 text-sm">{t('req_not_found')}</p>
      <Link href="/services"><button className="text-slate-900 underline text-sm">{t('btn_go_to_list')}</button></Link>
    </div>
  );

  const statusCfg = STATUS_CFG[request.status] ?? { label: request.status, cls: 'bg-slate-100 text-slate-500 border-slate-200' };
  const currentStepIndex = getActiveStep(request.status);

  return (
    <div className="min-h-screen bg-[#F8F8F8] text-slate-900 font-sans">
      <SiteHeader />

      <div className="max-w-2xl mx-auto px-4 pt-5 pb-32 md:pt-8 md:pb-14">

        {/* ── 헤더 내비게이션 ── */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 shadow-sm transition-colors shrink-0"
          >
            <ChevronLeft size={17} />
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
            <h1 className="text-[15px] md:text-lg font-black tracking-tight leading-tight truncate">
              {request.title}
            </h1>
            <span className={`text-[10px] md:text-xs px-2.5 py-0.5 rounded-full font-bold border ${statusCfg.cls}`}>
              {t(`status_${request.status}`)}
            </span>
          </div>
        </div>

        {/* ── 매칭 프로세스 스텝 가이드 ── */}
        <div className="bg-white rounded-2xl border border-slate-100 px-4 py-4 mb-4 shadow-sm">
          <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">{t('sr_progress')}</p>
          <div className="flex items-center">
            {MATCHING_STEPS.map((step, idx) => {
              const done = idx < currentStepIndex;
              const active = idx === currentStepIndex - 1 || (currentStepIndex === 0 && idx === 0);
              const StepIcon = step.icon;
              return (
                <React.Fragment key={idx}>
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center transition-all ${done ? 'bg-emerald-500' :
                      active ? 'bg-slate-900 ring-4 ring-slate-900/10' :
                        'bg-slate-100'
                      }`}>
                      {done
                        ? <CheckCircle size={16} className="text-white" />
                        : <StepIcon size={14} className={active ? 'text-white' : 'text-slate-400'} />
                      }
                    </div>
                    <p className={`text-[9px] md:text-[10px] font-semibold text-center leading-tight ${done ? 'text-emerald-600' : active ? 'text-slate-900' : 'text-slate-400'
                      }`}>{t(step.labelKey)}</p>
                  </div>
                  {idx < MATCHING_STEPS.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 transition-colors ${done ? 'bg-emerald-400' : 'bg-slate-100'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ── [고객 뷰] pending_payment: 결제 대기 배너 ── */}
        {isOwner && isPendingPaymentServiceRequest(request.status) && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-4 flex flex-col items-center gap-3 text-center">
            <CreditCard size={32} className="text-amber-500" />
            <div>
              <p className="font-black text-[15px] md:text-base text-amber-900 mb-1">{t('sr_need_pay')}</p>
              <p className="text-[12px] md:text-[13px] text-amber-700">{t('sr_need_pay_desc')}</p>
            </div>
            <button
              onClick={() => router.push(`/services/${requestId}/payment`)}
              className="w-full py-3.5 rounded-xl font-black text-[14px] md:text-sm text-white"
              style={{ background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', boxShadow: '0 4px 15px rgba(217,119,6,0.35)' }}
            >
              <span className="flex items-center justify-center gap-2">
                <CreditCard size={16} /> {t('btn_pay_now')}
              </span>
            </button>
          </div>
        )}

        {/* ── 의뢰 요약 카드 ── */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 md:p-5 mb-4 shadow-sm">
          <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">{t('sr_info')}</p>

          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {[
              { icon: MapPin, label: t('sr_label_region'), val: request.city },
              { icon: Calendar, label: t('sr_label_date'), val: `${request.service_date} ${request.start_time}` },
              { icon: Clock, label: t('sr_label_duration'), val: `${request.duration_hours}${t('req_duration_hours')}` },
              { icon: Users, label: t('sr_label_guests'), val: `${request.guest_count}${t('req_guest_count')}` },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="bg-slate-50 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm">
                    <Icon size={13} className="text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] md:text-[10px] text-slate-400 font-medium">{item.label}</p>
                    <p className="text-[11px] md:text-[12px] font-bold text-slate-800 truncate">{item.val}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 언어 */}
          {request.languages.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Globe2 size={12} className="text-slate-400 shrink-0" />
              {request.languages.map((l) => (
                <span key={l} className="text-[10px] md:text-[11px] bg-slate-100 border border-slate-150 px-2.5 py-0.5 rounded-full text-slate-600 font-medium">{l}</span>
              ))}
            </div>
          )}

          {/* 요청 내용 */}
          <div className="bg-slate-50 rounded-xl px-3.5 py-3 mb-4">
            <p className="text-[10px] text-slate-400 font-semibold mb-1">{t('sr_label_content')}</p>
            <p className="text-[12px] md:text-[13px] text-slate-700 leading-relaxed whitespace-pre-line">{request.description}</p>
          </div>

          {/* 금액 */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            {isOwner ? (
              <>
                <span className="text-[12px] md:text-[13px] text-slate-500">{t('req_total_paid')}</span>
                <span className="font-black text-[18px] md:text-xl text-slate-900">₩{request.total_customer_price.toLocaleString()}</span>
              </>
            ) : (
              <>
                <div>
                  <p className="text-[10px] text-slate-400 mb-0.5">{t('req_est_income')}</p>
                  <p className="font-black text-[18px] md:text-xl text-emerald-600">₩{request.total_host_payout.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-1.5">
                  <Sparkles size={12} className="text-emerald-500" />
                  <span className="text-[10px] md:text-[11px] text-emerald-700 font-bold">{t('sr_can_apply')}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── [고객 뷰] 지원자 목록 ── */}
        {isOwner && request.status !== 'pending_payment' && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] md:text-base font-black">
                {t('sr_host_list')}
                <span className="ml-2 text-[12px] text-slate-400 font-normal">({applications.length}{t('req_guest_count')})</span>
              </h2>
            </div>

            {applications.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-12 text-center">
                <Users size={28} className="text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-[13px] font-medium">{t('sr_empty_host')}</p>
                <p className="text-slate-300 text-[11px] mt-1">{t('sr_empty_host_sub')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => {
                  const name = app.profiles?.full_name || app.host_applications?.name || t('host');
                  const avatar = app.profiles?.avatar_url || app.host_applications?.profile_photo;
                  const langs = app.profiles?.languages || app.host_applications?.languages || [];
                  const bio = app.host_applications?.self_intro || app.profiles?.bio;
                  const isSelected = request.selected_application_id === app.id;

                  return (
                    <div
                      key={app.id}
                      className={`bg-white rounded-2xl border transition-all overflow-hidden shadow-sm cursor-pointer ${isSelected ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-100 hover:border-slate-200 hover:shadow-md'
                        }`}
                      onClick={() => setHostModal({ open: true, hostId: app.host_id })}
                    >
                      {/* ─ 호스트 프로필 헤더 ─ */}
                      <div className="px-4 pt-4 pb-3 flex items-start gap-3.5">
                        {/* 아바타 */}
                        <div className="relative shrink-0">
                          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-slate-100 overflow-hidden border-2 border-white shadow-md">
                            {avatar
                              ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-slate-400 text-lg font-black">{name.charAt(0)}</div>
                            }
                          </div>
                          {isSelected && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center border-2 border-white">
                              <CheckCircle size={10} className="text-white" />
                            </div>
                          )}
                        </div>

                        {/* 이름 + 언어 + 평점 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-black text-[14px] md:text-[15px] text-slate-900">{name}</span>
                            {isSelected && (
                              <span className="text-[9px] md:text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">{t('sr_selected')}</span>
                            )}
                          </div>
                          {/* 평점 */}
                          {app.review_count && app.review_count > 0 ? (
                            <div className="flex items-center gap-1 mb-1.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} size={11} className={s <= Math.round(app.review_avg ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200 fill-slate-200'} />
                              ))}
                              <span className="text-[10px] text-slate-500 ml-0.5">{app.review_avg?.toFixed(1)} ({app.review_count})</span>
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-300 mb-1.5">{t('sr_no_reviews')}</p>
                          )}
                          {/* 언어 */}
                          {langs.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {langs.slice(0, 4).map((l) => (
                                <span key={l} className="text-[9px] md:text-[10px] bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-full text-slate-500 font-medium">{l}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ─ 자기소개 ─ */}
                      {bio && (
                        <div className="px-4 pb-3">
                          <p className="text-[11px] md:text-[12px] text-slate-400 italic line-clamp-2">"{bio}"</p>
                        </div>
                      )}

                      {/* ─ 어필 메시지 구분 ─ */}
                      <div className="mx-4 border-t border-slate-50" />
                      <div className="px-4 py-3">
                        <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">{t('sr_appeal_message')}</p>
                        <p className="text-[12px] md:text-[13px] text-slate-700 leading-relaxed">{app.appeal_message}</p>
                      </div>

                      {/* ─ 선택 버튼 ─ */}
                      {isOpenServiceRequest(request.status) && !isSelected && (
                        <div className="px-4 pb-4" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleSelectHost(app.id)}
                            disabled={selecting === app.id}
                            className="w-full py-3 rounded-xl font-black text-[13px] md:text-sm text-white transition-all active:scale-[0.98] disabled:opacity-60"
                            style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', boxShadow: '0 4px 15px rgba(15,52,96,0.3)' }}
                          >
                            {selecting === app.id ? t('processing') : t('btn_select_host')}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── [선택된 호스트] 매칭 확정 안내 ── */}
        {isSelectedHost && isMatchedServiceRequest(request.status) && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 text-center mb-4">
            <CheckCircle size={36} className="text-blue-500 mx-auto mb-2" />
            <p className="font-black text-[15px] md:text-base text-blue-900 mb-1">{t('sr_selected_host_banner_title')}</p>
            <p className="text-[12px] md:text-[13px] text-blue-600">{t('sr_selected_host_banner_desc')}</p>
          </div>
        )}

        {/* ── [호스트 뷰] 지원 상태 / CTA ── */}
        {!isOwner && !isSelectedHost && currentUserId && (
          <div className="mb-4">
            {myApplication ? (
              <div className={`rounded-2xl p-5 border text-center ${myApplication.status === 'selected'
                ? 'bg-blue-50 border-blue-200'
                : myApplication.status === 'rejected'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-slate-50 border-slate-200'
                }`}>
                <p className={`font-black text-[14px] md:text-[15px] ${myApplication.status === 'selected' ? 'text-blue-700'
                  : myApplication.status === 'rejected' ? 'text-red-600'
                    : 'text-slate-700'
                  }`}>
                  {myApplication.status === 'selected'
                    ? t('sr_selected_host')
                    : myApplication.status === 'rejected'
                      ? t('sr_not_selected_host')
                      : t('sr_application_pending')}
                </p>
                {myApplication.status === 'pending' && (
                  <p className="text-[11px] md:text-[12px] text-slate-400 mt-1">{t('sr_customer_reviewing')}</p>
                )}
              </div>
            ) : isOpenServiceRequest(request.status) ? (
              <Link href={`/services/${requestId}/apply`}>
                <button
                  className="w-full py-4 rounded-2xl font-black text-[15px] md:text-base text-white transition-all active:scale-[0.98] hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #111827 0%, #1f2937 50%, #374151 100%)', boxShadow: '0 8px 25px rgba(17,24,39,0.35)' }}
                >
                  <span className="flex items-center justify-center gap-2">
                    {t('btn_apply')} <ArrowRight size={18} />
                  </span>
                </button>
              </Link>
            ) : (
              <div className="text-center py-5">
                <p className="text-slate-400 text-[13px] md:text-sm">마감된 의뢰입니다.</p>
              </div>
            )}
          </div>
        )}

        {/* ── 고객센터 ── */}
        <div className="text-center">
          <Link href="/guest/inbox" className="inline-flex items-center gap-1.5 text-[11px] md:text-xs text-slate-400 hover:text-slate-600 transition-colors">
            <MessageSquare size={11} /> 문의가 있으신가요? 고객센터에 물어보세요
          </Link>
        </div>
      </div>

      {/* ── 호스트 프로필 모달 ── */}
      {(() => {
        const app = hostModal.hostId ? applications.find((a) => a.host_id === hostModal.hostId) : null;
        if (!app) return null;
        const modalName = app.profiles?.full_name || app.host_applications?.name || t('host');
        return (
          <HostProfileModal
            isOpen={hostModal.open}
            onClose={() => setHostModal({ open: false, hostId: null })}
            host={{
              name: modalName,
              avatarUrl: app.profiles?.avatar_url || app.host_applications?.profile_photo || undefined,
              reviewCount: app.review_count,
              rating: app.review_avg,
              joinedYear: app.profiles?.created_at ? new Date(app.profiles.created_at).getFullYear() : undefined,
              job: app.host_applications?.profession || undefined,
              dreamDestination: app.host_applications?.dream_destination || undefined,
              favoriteSong: app.host_applications?.favorite_song || undefined,
              languages: app.profiles?.languages || app.host_applications?.languages || undefined,
              intro: app.host_applications?.self_intro || app.profiles?.bio || undefined,
            }}
          />
        );
      })()}
    </div>
  );
}
