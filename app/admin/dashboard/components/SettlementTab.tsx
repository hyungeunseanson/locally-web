'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { DollarSign, CheckCircle, User, ChevronDown, AlertTriangle, RefreshCcw } from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import { isCancelledOnlyBookingStatus, isCompletedBookingStatus } from '@/app/constants/bookingStatus';
import { getBookingHostPayout } from '@/app/utils/bookingFinance';
import { settleHostPayout } from '@/app/actions/admin';
import { useConfirmDialog } from '@/app/hooks/useConfirmDialog';

type SettlementExperience = {
  host_id: string | null;
  title: string | null;
};

type SettlementGuestProfile = {
  name: string | null;
  email: string | null;
};

type SettlementBookingRow = {
  id: string;
  amount: number | string | null;
  total_price: number | string | null;
  total_experience_price: number | string | null;
  status: string | null;
  date: string | null;
  title: string | null;
  host_payout_amount: number | string | null;
  refund_amount: number | string | null;
  platform_revenue: number | string | null;
  payout_status: string | null;
  experiences: SettlementExperience | null;
  profiles: SettlementGuestProfile | null;
};

type SettlementBookingQueryRow = Omit<SettlementBookingRow, 'experiences' | 'profiles'> & {
  experiences: SettlementExperience[] | null;
  profiles: SettlementGuestProfile[] | null;
};

type SettlementHostApplicationBank = {
  user_id: string;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
};

type SettlementHostApplicationsResponse = {
  data?: SettlementHostApplicationBank[];
};

type SettlementHostProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type SettlementHostInfo = SettlementHostProfile & {
  name: string;
  bank: SettlementHostApplicationBank | null;
};

type SettlementItem = SettlementBookingRow & {
  calculated_payout: number;
};

type SettlementGroup = {
  hostInfo: SettlementHostInfo;
  items: SettlementItem[];
  totalPayout: number;
};

const formatCurrency = (value: number | string | null | undefined) =>
  Number(value ?? 0).toLocaleString();

export default function SettlementTab() {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const { requestConfirm, ConfirmDialogElement } = useConfirmDialog();
  const [settlements, setSettlements] = useState<SettlementGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedHost, setExpandedHost] = useState<string | null>(null);

  // useCallback으로 감싸 의존성 명시 — React StrictMode 이중 실행 방지
  const fetchSettlements = useCallback(async () => {
    setIsLoading(true);

    // 1. 정산 대상 조회: (완료됨 OR 취소됐는데 줄 돈 있음) AND (아직 미지급)
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        id, amount, total_price, total_experience_price, status, date, title,
        host_payout_amount, refund_amount, platform_revenue, payout_status,
        experiences ( host_id, title ),
        profiles!bookings_user_id_fkey ( name, email )
      `)
      .eq('payout_status', 'pending') // 미지급 건만
      .in('status', ['completed', 'COMPLETED', 'cancelled', 'CANCELLED'])
      .order('date', { ascending: false });

    if (error) {
      console.error(error);
      setIsLoading(false);
      return;
    }

    const rawBookings = ((bookings || []) as unknown) as SettlementBookingQueryRow[];
    const safeBookings: SettlementBookingRow[] = rawBookings.map((booking) => ({
      ...booking,
      experiences: Array.isArray(booking.experiences) ? (booking.experiences[0] ?? null) : null,
      profiles: Array.isArray(booking.profiles) ? (booking.profiles[0] ?? null) : null,
    }));

    const settlementTargetBookings = safeBookings.filter((booking) =>
      isCompletedBookingStatus(booking.status ?? '') ||
      (isCancelledOnlyBookingStatus(booking.status ?? '') && Number(booking.host_payout_amount) > 0)
    );

    // 2. 호스트 정보 가져오기 (계좌 포함)
    const hostIds = Array.from(
      new Set(
        settlementTargetBookings
          .map((booking) => booking.experiences?.host_id)
          .filter((hostId): hostId is string => Boolean(hostId))
      )
    );
    const hostsMap = new Map<string, SettlementHostInfo>();

    if (hostIds.length > 0) {
      const { data: hosts } = await supabase.from('profiles').select('id, full_name, email').in('id', hostIds);
      // 🔒 account_number 등 민감 컬럼이 있는 host_applications는 service_role API로 조회
      const appsRes = await fetch(
        `/api/admin/host-applications?user_ids=${hostIds.join(',')}&select=user_id,bank_name,account_number,account_holder`
      );
      const appsJson = appsRes.ok
        ? (await appsRes.json()) as SettlementHostApplicationsResponse
        : { data: [] };
      const apps = Array.isArray(appsJson.data) ? appsJson.data : [];
      const safeHosts = (hosts || []) as SettlementHostProfile[];

      safeHosts.forEach((host) => {
        const app = apps.find((application) => application.user_id === host.id) ?? null;
        hostsMap.set(host.id, {
          ...host,
          name: host.full_name || host.email || 'Host',
          bank: app
        });
      });
    }

    // 3. 호스트별 그룹화 & 금액 계산 (여기가 핵심 🔥)
    const grouped = new Map<string, SettlementGroup>();
    settlementTargetBookings.forEach((booking) => {
      const hostId = booking.experiences?.host_id;
      if (!hostId) return;

      if (!grouped.has(hostId)) {
        grouped.set(hostId, {
          hostInfo: hostsMap.get(hostId) ?? {
            id: hostId,
            full_name: null,
            email: null,
            name: 'Host',
            bank: null,
          },
          items: [],
          totalPayout: 0
        });
      }

      const group = grouped.get(hostId);
      if (!group) return;

      // 💰 [정산금 계산 로직]
      const payout = getBookingHostPayout(booking);

      group.items.push({ ...booking, calculated_payout: payout });
      group.totalPayout += payout;
    });

    setSettlements(Array.from(grouped.values()));
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    void fetchSettlements();
  }, [fetchSettlements]);

  // 정산 완료 처리: settleHostPayout Server Action 사용 (감사로그 + 이중 정산 방지 내장)
  const markAsPaid = async (hostId: string, itemIds: string[]) => {
    requestConfirm({
      title: '정산 완료 처리',
      description: `총 ${itemIds.length}건에 대해 이체를 완료하셨습니까?\n확인 시 '지급 완료' 상태로 변경되며 목록에서 사라집니다.`,
      confirmLabel: '정산 완료',
      tone: 'default',
    }, async () => {
      try {
        const result = await settleHostPayout(itemIds);
        if (!result.success) throw new Error(result.error || 'Server error');

        showToast('정산 완료 처리되었습니다.', 'success');
        fetchSettlements();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '처리 중 오류가 발생했습니다.';
        showToast(msg, 'error');
      }
    });
  };

  if (isLoading) return <div className="p-12 text-center text-slate-400">정산 데이터를 불러오는 중...</div>;

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden h-full animate-in fade-in zoom-in-95 duration-300">
      {/* 헤더 */}
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="text-green-600" size={24} /> 정산 실행 (Payout)
          </h2>
          <p className="text-sm text-slate-500 mt-1">호스트에게 송금해야 할 <span className="font-bold text-slate-700">미지급 내역</span>입니다.</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400 font-bold uppercase mb-1">총 지급 대기액</div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">
            ₩{settlements.reduce((sum, item) => sum + item.totalPayout, 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* 리스트 영역 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
        {settlements.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
            <CheckCircle size={48} className="text-green-200" />
            <p className="font-medium">모든 정산이 완료되었습니다! 🎉</p>
            <button onClick={fetchSettlements} className="text-xs flex items-center gap-1 hover:text-black"><RefreshCcw size={12} /> 새로고침</button>
          </div>
        ) : (
          settlements.map((group) => (
            <div key={group.hostInfo.id} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white hover:shadow-md transition-all duration-200">
              {/* 호스트 카드 헤더 */}
              <div className="p-5 flex items-center justify-between cursor-pointer group"
                onClick={() => setExpandedHost(expandedHost === group.hostInfo.id ? null : group.hostInfo.id)}>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-lg group-hover:bg-slate-900 group-hover:text-white transition-colors">
                    {group.hostInfo?.name?.[0] || <User />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{group.hostInfo?.name || '알 수 없는 호스트'}</h3>
                    <div className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
                      {group.hostInfo?.bank?.bank_name ? (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded text-xs font-medium text-slate-600">
                          {group.hostInfo?.bank?.bank_name} <span className="text-slate-300">|</span> {group.hostInfo?.bank?.account_number}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-500 font-bold text-xs bg-red-50 px-2 py-0.5 rounded">
                          <AlertTriangle size={12} /> 계좌 정보 없음
                        </span>
                      )}
                      <span className="text-xs text-slate-400">예금주: {group.hostInfo?.bank?.account_holder || '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="block text-xs font-bold text-slate-400 uppercase mb-0.5">이번달 지급액</span>
                    <span className="block font-black text-green-600 text-xl">₩{group.totalPayout.toLocaleString()}</span>
                  </div>
                  <div className={`p-2 rounded-full bg-slate-50 text-slate-400 transition-transform duration-200 ${expandedHost === group.hostInfo.id ? 'rotate-180 bg-slate-200 text-slate-600' : ''}`}>
                    <ChevronDown size={20} />
                  </div>
                </div>
              </div>

              {/* 상세 내역 (아코디언) */}
              {expandedHost === group.hostInfo.id && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-5 animate-in slide-in-from-top-2">
                  <table className="w-full text-sm text-left mb-4">
                    <thead className="text-xs text-slate-400 uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="pb-3 pl-2">날짜</th>
                        <th className="pb-3">체험명</th>
                        <th className="pb-3">유형</th>
                        <th className="pb-3 text-right">결제금액</th>
                        <th className="pb-3 text-right pr-2">실지급액 (80%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/50">
                      {group.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 pl-2 font-mono text-slate-500 text-xs">{item.date}</td>
                          <td className="py-3 font-medium text-slate-700">{item.experiences?.title}</td>
                          <td className="py-3">
                            {isCancelledOnlyBookingStatus(item.status ?? '') ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded">
                                취소 위약금
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-bold rounded">
                                여행 완료
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-right text-slate-400 font-mono text-xs">₩{formatCurrency(item.amount)}</td>
                          <td className="py-3 text-right font-bold text-slate-900 pr-2">
                            ₩{item.calculated_payout.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-end pt-2 border-t border-slate-200">
                    <button
                      onClick={() => markAsPaid(group.hostInfo.id, group.items.map((item) => item.id))}
                      disabled={!group.hostInfo?.bank?.bank_name} // 계좌 없으면 버튼 비활성화
                      className={`px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition-all ${!group.hostInfo?.bank?.bank_name
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-slate-900 text-white hover:bg-black hover:scale-[1.02]'
                        }`}
                    >
                      <CheckCircle size={18} />
                      {group.hostInfo?.bank?.bank_name ? '이체 완료 및 정산 처리' : '계좌 정보가 없어 정산 불가'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      {ConfirmDialogElement}
    </div>
  );
}
