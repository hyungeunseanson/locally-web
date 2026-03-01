'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Clock, MapPin, Users, Calendar, CheckCircle, MessageSquare, Star } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import SiteHeader from '@/app/components/SiteHeader';
import { getServiceRequestStatusLabel, isOpenServiceRequest, isMatchedServiceRequest } from '@/app/constants/serviceStatus';
import type { ServiceRequest, ServiceApplicationWithProfile } from '@/app/types/service';

export default function ServiceRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [applications, setApplications] = useState<ServiceApplicationWithProfile[]>([]);
  const [myApplication, setMyApplication] = useState<{ id: string; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);

  const isOwner = currentUserId !== null && currentUserId === request?.user_id;
  const isSelectedHost = currentUserId !== null && currentUserId === request?.selected_host_id;

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ?? null;
      setCurrentUserId(userId);

      // 1. 의뢰 정보 로드
      const { data: req } = await supabase
        .from('service_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (!req) { setLoading(false); return; }
      setRequest(req as ServiceRequest);

      // 2. 지원자 목록 로드 — 서버 API 사용 (service_role → RLS 우회)
      // - 의뢰 소유자: 전체 지원자 목록 + 프로필 조인
      // - 비소유자(호스트): 본인 지원 내역만 반환
      if (userId) {
        try {
          const appsRes = await fetch(`/api/services/applications?requestId=${requestId}`);
          const appsData = await appsRes.json();
          if (appsData.success) {
            if (appsData.isOwner) {
              setApplications((appsData.data ?? []) as ServiceApplicationWithProfile[]);
            } else {
              // 비소유자: 본인 지원 내역 세팅
              if (appsData.myApplication) {
                setMyApplication(appsData.myApplication as { id: string; status: string });
              }
            }
          }
        } catch (e) {
          console.error('Applications load error:', e);
        }
      }

      setLoading(false);
    };
    void load();
  }, [requestId, supabase]);

  const handleSelectHost = async (applicationId: string) => {
    if (!window.confirm('이 호스트를 선택하시겠습니까? 선택 후 결제 페이지로 이동합니다.')) return;
    setSelecting(applicationId);
    try {
      const res = await fetch('/api/services/select-host', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, application_id: applicationId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || '호스트 선택에 실패했습니다.', 'error');
        return;
      }
      showToast('호스트가 선택되었습니다! 결제 페이지로 이동합니다.', 'success');
      router.push(`/services/${requestId}/payment?applicationId=${applicationId}`);
    } catch {
      showToast('서버 오류가 발생했습니다.', 'error');
    } finally {
      setSelecting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-slate-900" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <p className="text-slate-500 text-[14px] md:text-base">의뢰를 찾을 수 없습니다.</p>
        <Link href="/services"><button className="text-slate-900 underline text-[13px] md:text-sm">목록으로</button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 pb-28 md:pb-12">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[16px] md:text-xl font-black tracking-tight leading-tight">{request.title}</h1>
              <span className={`text-[10px] md:text-xs px-2 py-0.5 rounded-full font-semibold ${isOpenServiceRequest(request.status) ? 'bg-emerald-100 text-emerald-700' :
                  isMatchedServiceRequest(request.status) ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-500'
                }`}>
                {getServiceRequestStatusLabel(request.status)}
              </span>
            </div>
          </div>
        </div>

        {/* 의뢰 정보 */}
        <div className="bg-slate-50 rounded-2xl p-4 md:p-5 mb-5 space-y-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] md:text-[13px] text-slate-600">
            <span className="flex items-center gap-1.5"><MapPin size={13} />{request.city}</span>
            <span className="flex items-center gap-1.5"><Calendar size={13} />{request.service_date} {request.start_time}</span>
            <span className="flex items-center gap-1.5"><Clock size={13} />{request.duration_hours}시간</span>
            <span className="flex items-center gap-1.5"><Users size={13} />{request.guest_count}명</span>
          </div>
          {request.languages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {request.languages.map((lang) => (
                <span key={lang} className="text-[10px] md:text-xs bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-600">{lang}</span>
              ))}
            </div>
          )}
          <p className="text-[12px] md:text-[13px] text-slate-700 leading-relaxed pt-1">{request.description}</p>

          {/* 금액 표시 — 역할에 따라 엄격히 분리 */}
          <div className="flex justify-between items-center pt-1 border-t border-slate-200 mt-1">
            {isOwner ? (
              // 고객(의뢰 소유자): 총 결제 금액
              <>
                <span className="text-[12px] md:text-sm text-slate-500">총 금액</span>
                <span className="font-black text-[16px] md:text-lg text-slate-900">₩{request.total_customer_price.toLocaleString()}</span>
              </>
            ) : (
              // 호스트 또는 비로그인: 예상 수입만 표시 (고객 결제금액 절대 노출 금지)
              <>
                <span className="text-[12px] md:text-sm text-slate-500">예상 수입</span>
                <span className="font-black text-[16px] md:text-lg text-emerald-700">₩{request.total_host_payout.toLocaleString()}</span>
              </>
            )}
          </div>
        </div>

        {/* [고객 뷰] 지원자 목록 */}
        {isOwner && (
          <div>
            <h2 className="text-[14px] md:text-base font-black mb-3">
              지원한 호스트 <span className="text-slate-400 font-normal text-[12px] md:text-sm">({applications.length}명)</span>
            </h2>
            {applications.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-[13px] md:text-sm">
                아직 지원한 호스트가 없습니다. 조금만 기다려 주세요!
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => {
                  const name = app.profiles?.full_name || app.host_applications?.name || '호스트';
                  const avatar = app.profiles?.avatar_url || app.host_applications?.profile_photo;
                  const langs = app.profiles?.languages || app.host_applications?.languages || [];
                  const isSelected = request.selected_application_id === app.id;

                  return (
                    <div key={app.id} className={`rounded-2xl p-4 md:p-5 border transition-all ${isSelected ? 'border-blue-300 bg-blue-50' : 'border-slate-100 bg-white [box-shadow:0_1px_4px_rgba(0,0,0,0.06)]'}`}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-200 overflow-hidden shrink-0">
                          {avatar && <img src={avatar} alt={name} className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-bold text-[13px] md:text-sm">{name}</span>
                            {isSelected && <CheckCircle size={14} className="text-blue-500" />}
                            {app.review_count && app.review_count > 0 ? (
                              <span className="flex items-center gap-0.5 text-[10px] md:text-xs text-amber-500">
                                <Star size={10} className="fill-amber-400" />{app.review_avg?.toFixed(1)} ({app.review_count})
                              </span>
                            ) : null}
                          </div>
                          {langs.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1">
                              {langs.slice(0, 3).map((l) => (
                                <span key={l} className="text-[9px] md:text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{l}</span>
                              ))}
                            </div>
                          )}
                          <p className="text-[12px] md:text-[13px] text-slate-600 leading-relaxed">{app.appeal_message}</p>
                        </div>
                      </div>
                      {isOpenServiceRequest(request.status) && !isSelected && (
                        <button
                          onClick={() => handleSelectHost(app.id)}
                          disabled={selecting === app.id}
                          className="mt-3 w-full bg-slate-900 text-white py-2.5 rounded-xl font-bold text-[12px] md:text-sm hover:bg-slate-800 transition-colors disabled:opacity-60"
                        >
                          {selecting === app.id ? '처리 중...' : '이 호스트 선택하기'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* [선택된 호스트 뷰] — 결제 대기 안내 */}
        {isSelectedHost && isMatchedServiceRequest(request.status) && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 md:p-5 text-center">
            <CheckCircle size={32} className="text-blue-500 mx-auto mb-2" />
            <p className="font-bold text-[14px] md:text-base text-blue-800 mb-1">고객에게 선택되었습니다!</p>
            <p className="text-[12px] md:text-sm text-blue-600">고객이 결제를 완료하면 매칭이 확정됩니다.</p>
          </div>
        )}

        {/* [호스트 뷰] 지원 상태/CTA — 비소유자이면서 비선택 호스트 */}
        {!isOwner && !isSelectedHost && currentUserId && (
          <div className="mt-4">
            {myApplication ? (
              <div className={`rounded-2xl p-4 border ${myApplication.status === 'selected' ? 'bg-blue-50 border-blue-200' : myApplication.status === 'rejected' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-center font-bold text-[13px] md:text-sm ${myApplication.status === 'selected' ? 'text-blue-700' : myApplication.status === 'rejected' ? 'text-red-600' : 'text-slate-700'}`}>
                  {myApplication.status === 'selected' ? '🎉 선택되었습니다!' : myApplication.status === 'rejected' ? '이번에는 선택되지 않았습니다.' : '지원 완료 — 검토 중'}
                </p>
              </div>
            ) : isOpenServiceRequest(request.status) ? (
              <Link href={`/services/${requestId}/apply`}>
                <button className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[14px] md:text-base hover:bg-slate-800 transition-colors shadow-lg">
                  지원하기
                </button>
              </Link>
            ) : (
              <div className="text-center text-slate-400 text-[13px] md:text-sm py-4">마감된 의뢰입니다.</div>
            )}
          </div>
        )}

        {/* [고객 뷰] 결제 이동 — matched 상태 */}
        {isOwner && isMatchedServiceRequest(request.status) && request.selected_application_id && (
          <div className="mt-4">
            <Link href={`/services/${requestId}/payment?applicationId=${request.selected_application_id}`}>
              <button className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[14px] md:text-base hover:bg-slate-800 transition-colors shadow-lg">
                결제하러 가기
              </button>
            </Link>
          </div>
        )}

        {/* 고객센터 문의 */}
        <div className="mt-6 text-center">
          <Link href="/guest/inbox" className="inline-flex items-center gap-1.5 text-[11px] md:text-xs text-slate-400 hover:text-slate-600 transition-colors">
            <MessageSquare size={12} /> 문의가 있으신가요? 고객센터에 물어보세요
          </Link>
        </div>
      </div>
    </div>
  );
}
