'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CreditCard,
  Download,
  DollarSign,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { Range } from 'react-date-range';
import { endOfDay, format, startOfDay, subDays } from 'date-fns';

import { settleHostPayout } from '@/app/actions/admin';
import type {
  AdminCombinedPayoutQueueRow,
  AdminPayoutQueueDomainGroup,
  AdminPayoutQueueEntry,
  AdminPayoutQueueState,
  AdminSalesBooking,
  AdminServiceBooking,
  AdminServiceSalesSummary,
} from '@/app/types/admin';
import { useConfirmDialog } from '@/app/hooks/useConfirmDialog';
import { useToast } from '@/app/context/ToastContext';
import { isCancelledOnlyBookingStatus, isCompletedBookingStatus } from '@/app/constants/bookingStatus';
import {
  EXPERIENCE_PAYOUT_THRESHOLD_KRW,
  EXPERIENCE_PAYOUT_LONG_HOLD_DAYS,
} from '@/app/utils/payoutQueue';
import { getBookingPaidAmount, getBookingPlatformRevenue } from '@/app/utils/bookingFinance';
import SettlementSyncPanel from './SettlementSyncPanel';

const DateRange = dynamic(() => import('react-date-range').then((mod) => mod.DateRange), { ssr: false });

type SalesSummaryResponse = {
  success: boolean;
  error?: string;
  data?: AdminSalesBooking[];
  serviceSummaryRows?: AdminServiceSalesSummary[];
};

type PayoutQueueResponse = {
  success: boolean;
  error?: string;
  combinedHostTotals?: AdminCombinedPayoutQueueRow[];
};

type ExperiencePayoutGuard = {
  safe: boolean;
  tone: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
};

type ServicePayoutGuard = ExperiencePayoutGuard;

const DEFAULT_EXPERIENCE_PAYOUT_GUARD: ExperiencePayoutGuard = {
  safe: false,
  tone: 'info',
  title: '정산 상태 확인 중',
  message: '잠시 후 다시 확인하거나 점검판을 열어 상태를 확인하세요.',
};

const DEFAULT_SERVICE_PAYOUT_GUARD: ServicePayoutGuard = {
  safe: false,
  tone: 'info',
  title: '서비스 정산 상태 확인 중',
  message: '잠시 후 다시 확인하거나 점검판을 열어 상태를 확인하세요.',
};

const SETTLEMENT_STATE_META: Record<AdminPayoutQueueState, { label: string; className: string }> = {
  eligible: { label: '정산 가능', className: 'bg-emerald-100 text-emerald-700' },
  hold: { label: '10만원 미만', className: 'bg-slate-100 text-slate-500' },
  long_hold: { label: '장기 보류', className: 'bg-amber-100 text-amber-700' },
  completed: { label: '지급 완료', className: 'bg-blue-100 text-blue-700' },
};

const PENDING_SETTLEMENT_STATE_ORDER: Record<AdminPayoutQueueState, number> = {
  eligible: 0,
  long_hold: 1,
  hold: 2,
  completed: 3,
};

type StatCardProps = {
  title: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  bg: string;
  text?: string;
  onClick?: () => void;
  actionLabel?: string;
  testId?: string;
};

function getPendingPolicyNotes(row: AdminCombinedPayoutQueueRow) {
  const notes: string[] = [];

  if (row.domains.experience?.pending_count) {
    if (row.domains.experience.settlement_state === 'long_hold') {
      notes.push(
        `체험 정산은 ₩${EXPERIENCE_PAYOUT_THRESHOLD_KRW.toLocaleString()} 미만 누적 보류이며 ${EXPERIENCE_PAYOUT_LONG_HOLD_DAYS}일 이상 장기 보류 상태입니다.`
      );
    } else if (row.domains.experience.settlement_state === 'hold') {
      notes.push(
        `체험 정산은 누적 ₩${EXPERIENCE_PAYOUT_THRESHOLD_KRW.toLocaleString()} 이상부터 이체 대상입니다.`
      );
    }
  }

  if (row.domains.service?.pending_count) {
    notes.push('서비스 정산은 완료 처리된 건만 대기 목록에 집계됩니다.');
  }

  return notes;
}

function formatEntryId(entry: AdminPayoutQueueEntry) {
  const raw = entry.order_id || entry.id;
  return raw.length > 14 ? raw.slice(-12) : raw;
}

function getEntryStatusLabel(entry: AdminPayoutQueueEntry) {
  if (entry.domain === 'experience') {
    return isCompletedBookingStatus(entry.status) ? '완료' : '위약금';
  }

  if (entry.status === 'completed') return '완료';
  if (entry.status === 'confirmed') return '확정';
  if (entry.status === 'PAID') return '결제 완료';
  return entry.status;
}

function getEntryStatusClass(entry: AdminPayoutQueueEntry) {
  if (entry.domain === 'experience') {
    return isCompletedBookingStatus(entry.status)
      ? 'bg-blue-50 text-blue-600'
      : 'bg-red-50 text-red-600';
  }

  if (entry.status === 'completed') return 'bg-emerald-50 text-emerald-700';
  if (entry.status === 'confirmed') return 'bg-indigo-50 text-indigo-700';
  return 'bg-slate-100 text-slate-600';
}

function renderDomainSection(params: {
  domainLabel: string;
  domain: AdminPayoutQueueDomainGroup;
  settlementTab: 'PENDING' | 'COMPLETED';
}) {
  const { domainLabel, domain, settlementTab } = params;
  const entries = settlementTab === 'PENDING' ? domain.pending_entries : domain.paid_entries;

  if (entries.length === 0) return null;

  const sectionAmount = settlementTab === 'PENDING' ? domain.pending_amount : domain.paid_amount;

  return (
    <div className="mt-4 first:mt-0">
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h5 className="text-sm font-bold text-slate-900">{domainLabel}</h5>
          <p className="text-[10px] md:text-xs text-slate-500">
            {settlementTab === 'PENDING'
              ? `${domain.pending_count}건 · ₩${domain.pending_amount.toLocaleString()}`
              : `${domain.paid_count}건 · ₩${domain.paid_amount.toLocaleString()}`}
          </p>
        </div>
        <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-bold uppercase ${SETTLEMENT_STATE_META[domain.settlement_state].className}`}>
          {settlementTab === 'COMPLETED' ? '지급 완료' : SETTLEMENT_STATE_META[domain.settlement_state].label}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[560px] text-left text-[10px] md:text-xs">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 md:px-4 md:py-3">결제일</th>
              <th className="px-3 py-2 md:px-4 md:py-3">주문 ID</th>
              <th className="px-3 py-2 md:px-4 md:py-3">게스트</th>
              <th className="px-3 py-2 md:px-4 md:py-3">진행 상태</th>
              <th className="px-3 py-2 text-right md:px-4 md:py-3">결제 금액</th>
              <th className="px-3 py-2 text-right md:px-4 md:py-3">지급액</th>
              <th className="px-3 py-2 text-right md:px-4 md:py-3">
                {settlementTab === 'PENDING' ? '서비스일/체험일' : '지급 완료'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-500 md:px-4 md:py-3">
                  {format(new Date(entry.created_at), 'yy.MM.dd')}
                  <span className="ml-1 text-[9px]">{format(new Date(entry.created_at), 'HH:mm')}</span>
                </td>
                <td className="px-3 py-2 font-mono text-slate-400 md:px-4 md:py-3">{formatEntryId(entry)}</td>
                <td className="px-3 py-2 font-medium text-slate-700 md:px-4 md:py-3">{entry.guest_name}</td>
                <td className="px-3 py-2 md:px-4 md:py-3">
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase md:px-2 md:text-[10px] ${getEntryStatusClass(entry)}`}>
                    {getEntryStatusLabel(entry)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-slate-500 md:px-4 md:py-3">₩{entry.amount.toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-bold text-purple-600 md:px-4 md:py-3">
                  ₩{entry.payout_amount.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-slate-500 md:px-4 md:py-3">
                  {settlementTab === 'PENDING'
                    ? entry.date || '-'
                    : entry.payout_paid_at
                      ? format(new Date(entry.payout_paid_at), 'yy.MM.dd HH:mm')
                      : '-'}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50/70">
              <td colSpan={5} className="px-3 py-2 text-right font-bold text-slate-600 md:px-4 md:py-3">
                {domainLabel} 합계
              </td>
              <td className="px-3 py-2 text-right font-black text-slate-900 md:px-4 md:py-3">
                ₩{sectionAmount.toLocaleString()}
              </td>
              <td className="px-3 py-2 md:px-4 md:py-3" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SalesTab({ onRefresh }: { onRefresh?: () => void }) {
  const [dateRange, setDateRange] = useState<Range[]>([
    {
      startDate: subDays(new Date(), 30),
      endDate: new Date(),
      key: 'selection',
    },
  ]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('30D');
  const [settlementTab, setSettlementTab] = useState<'PENDING' | 'COMPLETED'>('PENDING');
  const [expandedHostId, setExpandedHostId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [salesBookings, setSalesBookings] = useState<AdminSalesBooking[]>([]);
  const [serviceBookings, setServiceBookings] = useState<AdminServiceSalesSummary[]>([]);
  const [settlementRows, setSettlementRows] = useState<AdminCombinedPayoutQueueRow[]>([]);
  const [experiencePayoutGuard, setExperiencePayoutGuard] = useState<ExperiencePayoutGuard>(
    DEFAULT_EXPERIENCE_PAYOUT_GUARD
  );
  const [servicePayoutGuard, setServicePayoutGuard] = useState<ServicePayoutGuard>(
    DEFAULT_SERVICE_PAYOUT_GUARD
  );
  const [isSalesLoading, setIsSalesLoading] = useState(true);
  const [serviceCSVLoading, setServiceCSVLoading] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const settlementSectionRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const { requestConfirm, ConfirmDialogElement } = useConfirmDialog();

  const salesStartAt = dateRange[0].startDate ? startOfDay(dateRange[0].startDate).toISOString() : '';
  const salesEndAt = dateRange[0].endDate ? endOfDay(dateRange[0].endDate).toISOString() : '';

  const fetchSalesData = useCallback(async () => {
    setIsSalesLoading(true);

    try {
      const params = new URLSearchParams();
      if (salesStartAt) params.set('startAt', salesStartAt);
      if (salesEndAt) params.set('endAt', salesEndAt);
      const query = params.toString() ? `?${params.toString()}` : '';

      const [salesRes, payoutQueueRes] = await Promise.all([
        fetch(`/api/admin/sales-summary${query}`),
        fetch(`/api/admin/payout-queue${query}`),
      ]);

      const salesJson = (await salesRes.json()) as SalesSummaryResponse;
      if (!salesRes.ok || !salesJson.success) {
        throw new Error(salesJson.error || '매출 데이터를 불러오지 못했습니다.');
      }

      const payoutQueueJson = (await payoutQueueRes.json()) as PayoutQueueResponse;
      if (!payoutQueueRes.ok || !payoutQueueJson.success) {
        throw new Error(payoutQueueJson.error || '정산 큐 데이터를 불러오지 못했습니다.');
      }

      setSalesBookings(salesJson.data ?? []);
      setServiceBookings(salesJson.serviceSummaryRows ?? []);
      setSettlementRows(payoutQueueJson.combinedHostTotals ?? []);
    } catch (error: unknown) {
      console.error('Sales summary fetch error:', error);
      showToast(error instanceof Error ? error.message : '매출 데이터를 불러오지 못했습니다.', 'error');
    } finally {
      setIsSalesLoading(false);
    }
  }, [salesEndAt, salesStartAt, showToast]);

  useEffect(() => {
    void fetchSalesData();
  }, [fetchSalesData]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresetClick = (preset: string) => {
    setActivePreset(preset);
    const now = new Date();

    if (preset === '1D') {
      setDateRange([{ startDate: subDays(now, 1), endDate: now, key: 'selection' }]);
    } else if (preset === '7D') {
      setDateRange([{ startDate: subDays(now, 7), endDate: now, key: 'selection' }]);
    } else if (preset === '30D') {
      setDateRange([{ startDate: subDays(now, 30), endDate: now, key: 'selection' }]);
    } else if (preset === '3M') {
      setDateRange([{ startDate: subDays(now, 90), endDate: now, key: 'selection' }]);
    } else if (preset === '1Y') {
      setDateRange([{ startDate: subDays(now, 365), endDate: now, key: 'selection' }]);
    } else if (preset === 'ALL') {
      setDateRange([{ startDate: new Date('2020-01-01'), endDate: now, key: 'selection' }]);
    }
  };

  const filterDate = (dateString: string) => {
    if (!dateRange[0].startDate || !dateRange[0].endDate) return true;

    const target = new Date(dateString);
    const startDate = startOfDay(dateRange[0].startDate);
    const endDate = endOfDay(dateRange[0].endDate);

    return target >= startDate && target <= endDate;
  };

  const validBookings = salesBookings.filter(
    (booking) =>
      filterDate(booking.created_at) &&
      (isCompletedBookingStatus(booking.status) ||
        (isCancelledOnlyBookingStatus(booking.status) &&
          ((booking.platform_revenue ?? 0) > 0 || (booking.host_payout_amount ?? 0) > 0)))
  );

  const validServiceBookings = serviceBookings.filter((booking) => filterDate(booking.created_at));
  const svcRevenue = validServiceBookings.reduce((sum, booking) => sum + (booking.amount || 0), 0);
  const svcPlatformFee = validServiceBookings.reduce(
    (sum, booking) => sum + (booking.platform_revenue || 0),
    0
  );

  const expRevenue = validBookings.reduce((sum, booking) => sum + (booking.amount || 0), 0);
  const totalRevenue = expRevenue + svcRevenue;
  const expPlatformFee = validBookings.reduce(
    (sum, booking) => sum + getBookingPlatformRevenue(booking),
    0
  );
  const platformFee = expPlatformFee + svcPlatformFee;
  const allCount = validBookings.length + validServiceBookings.length;
  const averageOrderValue = allCount > 0 ? totalRevenue / allCount : 0;

  const pendingSettlementList = [...settlementRows]
    .filter((row) => row.pending_amount > 0)
    .sort((left, right) => {
      const orderDiff =
        PENDING_SETTLEMENT_STATE_ORDER[left.settlement_state] -
        PENDING_SETTLEMENT_STATE_ORDER[right.settlement_state];
      if (orderDiff !== 0) return orderDiff;
      return right.pending_amount - left.pending_amount;
    });

  const completedSettlementList = [...settlementRows]
    .filter((row) => row.paid_amount > 0)
    .sort((left, right) => right.paid_amount - left.paid_amount);

  const settlementList = settlementTab === 'PENDING' ? pendingSettlementList : completedSettlementList;
  const eligibleSettlementList = pendingSettlementList.filter((row) => row.settlement_state === 'eligible');
  const holdSettlementList = pendingSettlementList.filter((row) => row.settlement_state !== 'eligible');
  const eligibleSettlementAmount = eligibleSettlementList.reduce((sum, row) => sum + row.pending_amount, 0);
  const holdSettlementAmount = holdSettlementList.reduce(
    (sum, row) => sum + (row.domains.experience?.pending_amount || 0),
    0
  );
  const longHoldCount = pendingSettlementList.filter((row) => row.settlement_state === 'long_hold').length;
  const svcPendingHostPayout = pendingSettlementList.reduce(
    (sum, row) => sum + (row.domains.service?.pending_amount || 0),
    0
  );
  const expSettlementCardSubtext = [
    holdSettlementAmount > 0 ? `체험 보류 ₩${holdSettlementAmount.toLocaleString()} (10만원 미만)` : null,
    svcPendingHostPayout > 0
      ? `서비스 정산 대기 ₩${svcPendingHostPayout.toLocaleString()}`
      : '서비스 정산 대기 없음',
  ]
    .filter(Boolean)
    .join(' · ');

  const toggleExpand = (hostId: string) => {
    setExpandedHostId((current) => (current === hostId ? null : hostId));
  };

  const handleOpenSettlementDrilldown = () => {
    setSettlementTab('PENDING');
    setExpandedHostId(null);
    settlementSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSettleExperiencePayout = (bookingIds: string[]) => {
    requestConfirm(
      {
        title: '체험 정산 완료 처리',
        description: `체험 예약 ${bookingIds.length}건을 지급 완료 처리하시겠습니까?`,
        confirmLabel: '체험 정산 완료',
        tone: 'default',
      },
      async () => {
        setIsProcessing(true);
        try {
          const result = await settleHostPayout(bookingIds);
          if (!result.success) throw new Error(result.error || 'Server error');

          showToast('체험 정산이 완료 처리되었습니다.', 'success');
          await Promise.all([fetchSalesData(), Promise.resolve(onRefresh?.())]);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '체험 정산 처리 실패';
          console.error(error);
          showToast(message, 'error');
        } finally {
          setIsProcessing(false);
        }
      }
    );
  };

  const handleSettleServicePayout = (bookingIds: string[]) => {
    requestConfirm(
      {
        title: '서비스 정산 완료 처리',
        description: `서비스 예약 ${bookingIds.length}건을 지급 완료 처리하시겠습니까?`,
        confirmLabel: '서비스 정산 완료',
        tone: 'default',
      },
      async () => {
        setIsProcessing(true);
        try {
          const response = await fetch('/api/admin/service-payouts/mark-paid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingIds }),
          });
          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.error || '서비스 정산 처리 실패');
          }

          showToast('서비스 정산이 완료 처리되었습니다.', 'success');
          await Promise.all([fetchSalesData(), Promise.resolve(onRefresh?.())]);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '서비스 정산 처리 실패';
          console.error(error);
          showToast(message, 'error');
        } finally {
          setIsProcessing(false);
        }
      }
    );
  };

  const handleDownloadExperienceCSV = (row: AdminCombinedPayoutQueueRow) => {
    const experienceDomain = row.domains.experience;
    if (!experienceDomain) return;

    const entries = settlementTab === 'PENDING' ? experienceDomain.pending_entries : experienceDomain.paid_entries;
    if (entries.length === 0) return;

    try {
      const headers = [
        '결제일시',
        '예약번호(ID)',
        '예금주(실명)',
        '호스트국적',
        '수취은행명',
        '계좌번호',
        '용역제공내역',
        '게스트명',
        '거래총액(Gross)',
        '위약금반환액',
        '플랫폼수수료(Fee)',
        '실지급정산액(Net)',
        '비고(외국인신분증등_수기입력)',
      ];

      const escapeCSV = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const rows = entries.map((entry) => {
        const refundPenaltyAmount =
          entry.status === 'cancelled'
            ? Math.max(0, getBookingPaidAmount({ amount: entry.amount }) - entry.payout_amount - entry.platform_revenue)
            : 0;

        return [
          escapeCSV(format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm')),
          escapeCSV(entry.id),
          escapeCSV(row.account_holder),
          escapeCSV(row.host_nationality),
          escapeCSV(row.bank),
          escapeCSV(row.account_number),
          escapeCSV(`플랫폼 로컬 체험/가이드 용역 (${entry.title})`),
          escapeCSV(entry.guest_name),
          entry.amount,
          refundPenaltyAmount,
          entry.platform_revenue,
          entry.payout_amount,
          '""',
        ];
      });

      const csvContent = [headers.join(','), ...rows.map((item) => item.join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `세무증빙_체험정산명세서_${row.host_name}_${format(new Date(), 'yyyyMMdd')}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('체험 정산 명세서(CSV) 다운로드가 시작되었습니다.', 'success');
    } catch (error) {
      console.error('Experience CSV error:', error);
      showToast('체험 정산 명세서 생성 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleDownloadServiceSettlementCSV = (row: AdminCombinedPayoutQueueRow) => {
    const serviceDomain = row.domains.service;
    if (!serviceDomain) return;

    const entries = settlementTab === 'PENDING' ? serviceDomain.pending_entries : serviceDomain.paid_entries;
    if (entries.length === 0) return;

    try {
      const escapeCSV = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const headers = ['결제일시', '주문번호', '의뢰명', '서비스일', '고객명', '결제액', '플랫폼수수료', '호스트지급액'];
      const rows = entries.map((entry) => [
        escapeCSV(format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm')),
        escapeCSV(entry.order_id || entry.id),
        escapeCSV(entry.title),
        escapeCSV(entry.date || '-'),
        escapeCSV(entry.guest_name),
        entry.amount,
        entry.platform_revenue,
        entry.payout_amount,
      ]);
      const csv = [headers.join(','), ...rows.map((item) => item.join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `맞춤의뢰_호스트정산명세서_${row.host_name}_${format(new Date(), 'yyyyMMdd')}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('서비스 정산 명세서(CSV) 다운로드가 시작되었습니다.', 'success');
    } catch (error) {
      console.error('Service settlement CSV error:', error);
      showToast('서비스 정산 명세서 생성 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleDownloadServiceCSV = async () => {
    setServiceCSVLoading(true);
    try {
      const params = new URLSearchParams();
      if (salesStartAt) params.set('startAt', salesStartAt);
      if (salesEndAt) params.set('endAt', salesEndAt);

      const response = await fetch(`/api/admin/service-bookings-csv?${params.toString()}`);
      if (!response.ok) throw new Error('서버 오류: 데이터 조회 실패');

      const { data } = await response.json();
      const rows = (data || []).filter((booking: { created_at: string }) => filterDate(booking.created_at));

      if (rows.length === 0) {
        showToast('해당 기간에 서비스 결제 내역이 없습니다.', 'error');
        return;
      }

      const escapeCSV = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const headers = [
        '결제일시',
        '주문번호',
        '의뢰명',
        '도시',
        '서비스일',
        '고객명',
        '호스트명',
        '결제수단',
        '결제액',
        '플랫폼수수료',
        '호스트지급액',
        '예금주',
        '은행',
        '계좌번호',
        '결제상태',
        '정산상태',
      ];

      const csvRows = rows.map((booking: AdminServiceBooking) => [
        escapeCSV(format(new Date(booking.created_at), 'yyyy-MM-dd HH:mm')),
        escapeCSV(booking.order_id || booking.id),
        escapeCSV(booking.service_request?.title || '-'),
        escapeCSV(booking.service_request?.city || '-'),
        escapeCSV(booking.service_request?.service_date || '-'),
        escapeCSV(
          booking.customer_profile?.full_name ||
            booking.customer_profile?.email ||
            booking.customer_id.slice(-6)
        ),
        escapeCSV(booking.host_application?.name || '-'),
        escapeCSV(booking.payment_method === 'bank' ? '무통장' : '카드'),
        booking.amount || 0,
        booking.platform_revenue || 0,
        booking.host_payout_amount || 0,
        escapeCSV(booking.host_application?.account_holder || '-'),
        escapeCSV(booking.host_application?.bank_name || '-'),
        escapeCSV(booking.host_application?.account_number || '-'),
        escapeCSV(booking.status),
        escapeCSV(booking.payout_status === 'paid' ? '정산완료' : booking.host_id ? '정산대기' : '미선택'),
      ]);

      const csv = [headers.join(','), ...csvRows.map((row: Array<string | number>) => row.join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `맞춤의뢰_정산명세서_${format(dateRange[0].startDate!, 'yyyyMMdd')}_${format(dateRange[0].endDate!, 'yyyyMMdd')}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`맞춤 의뢰 명세서 ${rows.length}건 다운로드 완료`, 'success');
    } catch (error: unknown) {
      console.error('Service CSV error:', error);
      showToast(`서비스 CSV 생성 오류: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setServiceCSVLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300 flex-1 space-y-4 overflow-y-auto p-1 md:space-y-8 md:p-2">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-0">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 md:text-2xl">
            <Wallet className="h-5 w-5 text-yellow-500 md:h-6 md:w-6" /> 매출 및 재무 현황
          </h2>
          <p className="mt-1 text-xs text-slate-500 md:text-sm">기간별 매출 추이와 호스트 정산 내역을 관리합니다.</p>
          <p data-testid="sales-date-basis-note" className="mt-2 text-[11px] text-slate-500 md:text-xs">
            Billing 기간은 결제 생성일 기준입니다. 체험일 또는 서비스일 기준 비교는 Master Ledger에서 확인하세요.
          </p>
        </div>
        <div className="relative flex flex-col items-stretch gap-2 sm:flex-row sm:items-center md:gap-3">
          <div className="flex shrink-0 overflow-x-auto rounded-lg bg-slate-100 p-1 text-[10px] font-bold scrollbar-hide md:text-xs">
            {['1D', '7D', '30D', '3M', '1Y', 'ALL'].map((preset) => (
              <button
                key={preset}
                onClick={() => handlePresetClick(preset)}
                className={`flex-1 whitespace-nowrap rounded-md px-2 py-1.5 transition-all md:flex-none md:px-3 md:py-2 ${
                  activePreset === preset
                    ? 'bg-white text-slate-900 shadow'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-auto" ref={datePickerRef}>
            <button
              onClick={() => setShowDatePicker((current) => !current)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium transition-colors hover:bg-slate-50 md:px-4 md:text-sm"
            >
              <CalendarIcon size={14} className="text-slate-400 md:h-4 md:w-4" />
              <span className="text-center text-slate-700 md:min-w-[170px]">
                {dateRange[0].startDate && dateRange[0].endDate
                  ? `${format(dateRange[0].startDate, 'yyyy.MM.dd')} ~ ${format(dateRange[0].endDate, 'yyyy.MM.dd')}`
                  : '기간 선택'}
              </span>
              <ChevronDown size={14} className="ml-1 text-slate-400 md:h-4 md:w-4" />
            </button>

            {showDatePicker && (
              <div className="animate-in fade-in slide-in-from-top-2 absolute right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-2">
                  <span className="px-2 text-xs font-bold uppercase text-slate-500">Custom Range</span>
                  <button
                    onClick={() => setShowDatePicker(false)}
                    className="px-2 text-xs font-medium text-slate-400 hover:text-slate-600"
                  >
                    Close
                  </button>
                </div>
                <DateRange
                  editableDateInputs={true}
                  onChange={(item) => {
                    setDateRange([item.selection]);
                    setActivePreset('CUSTOM');
                  }}
                  moveRangeOnFirstSelection={false}
                  ranges={dateRange}
                  months={1}
                  direction="horizontal"
                  className="!border-0 text-xs md:text-sm"
                  rangeColors={['#0f172a']}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <SettlementSyncPanel
        onSyncApplied={fetchSalesData}
        onExperiencePayoutGuardChange={setExperiencePayoutGuard}
        onServicePayoutGuardChange={setServicePayoutGuard}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard
          title="총 거래액 (GMV)"
          value={`₩${totalRevenue.toLocaleString()}`}
          sub={`체험 ₩${expRevenue.toLocaleString()} | 의뢰 ₩${svcRevenue.toLocaleString()}`}
          icon={<DollarSign size={16} className="text-white md:h-5 md:w-5" />}
          bg="bg-slate-900"
        />
        <StatCard
          title="순매출 (Net Revenue)"
          value={`₩${platformFee.toLocaleString()}`}
          sub="플랫폼 수익 (수수료)"
          icon={<TrendingUp size={16} className="text-white md:h-5 md:w-5" />}
          bg="bg-blue-600"
        />
        <StatCard
          title="통합 정산 가능액"
          value={`₩${eligibleSettlementAmount.toLocaleString()}`}
          sub={expSettlementCardSubtext || `체험은 ₩${EXPERIENCE_PAYOUT_THRESHOLD_KRW.toLocaleString()} 이상부터 정산 대상`}
          icon={<CreditCard size={16} className="text-white md:h-5 md:w-5" />}
          bg="bg-purple-600"
          onClick={handleOpenSettlementDrilldown}
          actionLabel="정산 대상 보기"
          testId="sales-settlement-card"
        />
        <StatCard
          title="객단가 (AOV)"
          value={`₩${Math.round(averageOrderValue).toLocaleString()}`}
          sub="건당 평균 결제액"
          icon={<Wallet size={16} className="text-slate-900 md:h-5 md:w-5" />}
          bg="bg-yellow-400"
          text="text-slate-900"
        />
      </div>

      <div
        ref={settlementSectionRef}
        data-testid="sales-settlement-panel"
        className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:rounded-2xl"
      >
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between md:p-6">
          <div className="flex gap-4 border-b border-slate-200 md:gap-6 md:border-0">
            <button
              onClick={() => setSettlementTab('PENDING')}
              className={`border-b-2 pb-2 text-xs font-bold transition-all md:-mb-[25px] md:text-sm ${
                settlementTab === 'PENDING'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400'
              }`}
            >
              정산 대기 (Pending)
            </button>
            <button
              onClick={() => setSettlementTab('COMPLETED')}
              className={`border-b-2 pb-2 text-xs font-bold transition-all md:-mb-[25px] md:text-sm ${
                settlementTab === 'COMPLETED'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400'
              }`}
            >
              정산 완료 (History)
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadServiceCSV}
              disabled={serviceCSVLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 md:w-auto md:px-4"
            >
              <Download size={14} /> {serviceCSVLoading ? '생성 중...' : '맞춤 의뢰 명세서 ↓'}
            </button>
            {settlementTab === 'PENDING' && (
              <button
                disabled
                className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-slate-200 px-3 py-2 text-xs font-bold text-slate-500 md:w-auto md:px-4"
              >
                <CheckCircle size={14} /> 일괄 지급 준비중
              </button>
            )}
          </div>
        </div>

        {settlementTab === 'PENDING' && (
          <div className="flex flex-col gap-2 border-b border-purple-100 bg-purple-50 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
            <div className="flex flex-wrap gap-2 text-[10px] font-bold md:gap-3 md:text-xs">
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">
                정산 가능 {eligibleSettlementList.length}명 · ₩{eligibleSettlementAmount.toLocaleString()}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                보류 {holdSettlementList.length}명 · ₩{holdSettlementAmount.toLocaleString()}
              </span>
              {longHoldCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">
                  장기 보류 {longHoldCount}명
                </span>
              )}
            </div>
            <p className="text-[10px] font-medium text-slate-500 md:text-xs">
              여기서 호스트별 정산 대상을 확인하고, 실제 송금 후 정산 완료 처리하세요.
            </p>
          </div>
        )}

        {settlementTab === 'PENDING' && !experiencePayoutGuard.safe && (
          <div
            data-testid="sales-experience-payout-guard"
            className={`border-b px-4 py-3 text-sm md:px-6 ${
              experiencePayoutGuard.tone === 'info'
                ? 'border-blue-100 bg-blue-50 text-blue-700'
                : experiencePayoutGuard.tone === 'warning'
                  ? 'border-amber-100 bg-amber-50 text-amber-700'
                  : 'border-red-100 bg-red-50 text-red-700'
            }`}
          >
            <p className="font-semibold">{experiencePayoutGuard.title}</p>
            <p className="mt-1">{experiencePayoutGuard.message}</p>
          </div>
        )}

        {settlementTab === 'PENDING' && svcPendingHostPayout > 0 && !servicePayoutGuard.safe && (
          <div
            data-testid="sales-service-payout-guard"
            className={`border-b px-4 py-3 text-sm md:px-6 ${
              servicePayoutGuard.tone === 'info'
                ? 'border-blue-100 bg-blue-50 text-blue-700'
                : servicePayoutGuard.tone === 'warning'
                  ? 'border-amber-100 bg-amber-50 text-amber-700'
                  : 'border-red-100 bg-red-50 text-red-700'
            }`}
          >
            <p className="font-semibold">{servicePayoutGuard.title}</p>
            <p className="mt-1">{servicePayoutGuard.message}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs md:text-sm">
            <thead className="border-b border-slate-100 bg-white text-[10px] uppercase text-slate-500 md:text-xs">
              <tr>
                <th className="px-4 py-3 md:px-6 md:py-4">호스트 정보</th>
                <th className="px-4 py-3 md:px-6 md:py-4">지급 총액</th>
                <th className="px-4 py-3 md:px-6 md:py-4">계좌 정보</th>
                <th className="px-4 py-3 md:px-6 md:py-4">건수</th>
                <th className="px-4 py-3 text-right md:px-6 md:py-4">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {settlementList.length > 0 ? (
                settlementList.map((row) => {
                  const totalAmount =
                    settlementTab === 'PENDING' ? row.pending_amount : row.paid_amount;
                  const totalCount =
                    settlementTab === 'PENDING' ? row.pending_count : row.paid_count;
                  const notes = settlementTab === 'PENDING' ? getPendingPolicyNotes(row) : [];
                  const canSettleExperience =
                    settlementTab === 'PENDING' &&
                    row.domains.experience?.pending_count &&
                    row.domains.experience.settlement_state === 'eligible';
                  const canSettleService =
                    settlementTab === 'PENDING' && row.domains.service?.pending_count;

                  return (
                    <React.Fragment key={row.host_id}>
                      <tr
                        data-testid={`sales-settlement-row-${row.host_id}`}
                        className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                          expandedHostId === row.host_id ? 'bg-slate-50' : ''
                        }`}
                        onClick={() => toggleExpand(row.host_id)}
                      >
                        <td className="px-4 py-3 md:px-6 md:py-4">
                          <div className="flex items-center gap-1 md:gap-2">
                            {expandedHostId === row.host_id ? (
                              <ChevronUp size={14} className="text-slate-400 md:h-4 md:w-4" />
                            ) : (
                              <ChevronRight size={14} className="text-slate-400 md:h-4 md:w-4" />
                            )}
                            <div>
                              <div className="text-xs font-bold text-slate-900 md:text-sm">{row.host_name}</div>
                              <div className="text-[10px] text-slate-400 md:text-xs">{row.account_holder}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-purple-600 md:px-6 md:py-4 md:text-sm">
                          ₩{totalAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-[10px] text-slate-500 md:px-6 md:py-4 md:text-xs">
                          <div className="flex items-center gap-1">
                            {row.bank === '계좌 미등록' ? (
                              <AlertTriangle size={12} className="text-red-500 md:h-3.5 md:w-3.5" />
                            ) : (
                              <CreditCard size={12} className="md:h-3.5 md:w-3.5" />
                            )}
                            <span>
                              {row.bank} {row.account_number}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 md:px-6 md:py-4 md:text-sm">{totalCount}건</td>
                        <td className="px-4 py-3 text-right md:px-6 md:py-4">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase md:px-2 md:py-1 md:text-[10px] ${
                              row.bank === '계좌 미등록'
                                ? 'bg-red-100 text-red-600'
                                : SETTLEMENT_STATE_META[row.settlement_state].className
                            }`}
                          >
                            {row.bank === '계좌 미등록'
                              ? '계좌 필요'
                              : settlementTab === 'COMPLETED'
                                ? '지급 완료'
                                : SETTLEMENT_STATE_META[row.settlement_state].label}
                          </span>
                        </td>
                      </tr>

                      {expandedHostId === row.host_id && (
                        <tr>
                          <td colSpan={5} className="border-b border-slate-100 bg-slate-50 p-0">
                            <div className="px-4 py-4 md:px-14 md:py-6">
                              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:mb-4">
                                <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                                  <Wallet size={16} className="text-slate-500" /> 통합 정산 내역
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {row.domains.experience && (
                                    <button
                                      onClick={() => handleDownloadExperienceCSV(row)}
                                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-100 sm:w-auto md:py-1.5"
                                    >
                                      <Download size={14} /> 체험 명세서
                                    </button>
                                  )}
                                  {row.domains.service && (
                                    <button
                                      onClick={() => handleDownloadServiceSettlementCSV(row)}
                                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-100 sm:w-auto md:py-1.5"
                                    >
                                      <Download size={14} /> 서비스 명세서
                                    </button>
                                  )}
                                  {canSettleExperience ? (
                                    <button
                                      data-testid={`sales-settle-experience-${row.host_id}`}
                                      onClick={() =>
                                        handleSettleExperiencePayout(
                                          row.domains.experience!.pending_entries.map((entry) => entry.id)
                                        )
                                      }
                                      disabled={
                                        isProcessing ||
                                        row.bank === '계좌 미등록' ||
                                        !experiencePayoutGuard.safe
                                      }
                                      className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors sm:w-auto md:py-1.5 ${
                                        isProcessing ||
                                        row.bank === '계좌 미등록' ||
                                        !experiencePayoutGuard.safe
                                          ? 'cursor-not-allowed bg-slate-300'
                                          : 'bg-slate-900 hover:bg-slate-800'
                                      }`}
                                    >
                                      <Check size={14} /> 체험 정산 완료
                                    </button>
                                  ) : null}
                                  {canSettleService ? (
                                    <button
                                      data-testid={`sales-settle-service-${row.host_id}`}
                                      onClick={() =>
                                        handleSettleServicePayout(
                                          row.domains.service!.pending_entries.map((entry) => entry.id)
                                        )
                                      }
                                      disabled={
                                        isProcessing ||
                                        row.bank === '계좌 미등록' ||
                                        !servicePayoutGuard.safe
                                      }
                                      className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors sm:w-auto md:py-1.5 ${
                                        isProcessing ||
                                        row.bank === '계좌 미등록' ||
                                        !servicePayoutGuard.safe
                                          ? 'cursor-not-allowed bg-slate-300'
                                          : 'bg-emerald-600 hover:bg-emerald-500'
                                      }`}
                                    >
                                      <Check size={14} /> 서비스 정산 완료
                                    </button>
                                  ) : null}
                                </div>
                              </div>

                              {notes.length > 0 && (
                                <div className="mb-4 space-y-1 text-[10px] font-medium text-slate-500 md:text-xs">
                                  {notes.map((note) => (
                                    <p key={note}>{note}</p>
                                  ))}
                                </div>
                              )}

                              {row.domains.experience &&
                                renderDomainSection({
                                  domainLabel: '체험 예약',
                                  domain: row.domains.experience,
                                  settlementTab,
                                })}
                              {row.domains.service &&
                                renderDomainSection({
                                  domainLabel: '맞춤 의뢰',
                                  domain: row.domains.service,
                                  settlementTab,
                                })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400 md:px-6 md:py-10 md:text-sm">
                    {isSalesLoading ? '정산 데이터를 불러오는 중입니다.' : '내역이 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {ConfirmDialogElement}
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  icon,
  bg,
  text = 'text-white',
  onClick,
  actionLabel,
  testId,
}: StatCardProps) {
  const cardClassName = `group relative flex h-28 w-full flex-col justify-between overflow-hidden rounded-xl border bg-white p-4 shadow-sm md:h-32 md:rounded-2xl md:p-5 ${
    onClick
      ? 'cursor-pointer border-purple-100 text-left transition-all hover:border-purple-200 hover:shadow-md'
      : 'border-slate-100'
  }`;

  const content = (
    <>
      <div className={`absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full shadow-md transition-transform group-hover:scale-110 md:h-10 md:w-10 ${bg}`}>
        {icon}
      </div>
      <div className="pr-10 text-[9px] font-bold uppercase tracking-wider text-slate-400 md:text-xs">{title}</div>
      <div>
        <div className={`truncate pr-8 text-lg font-black tracking-tight md:text-2xl ${text === 'text-white' ? 'text-slate-900' : text}`}>
          {value}
        </div>
        <div className="mt-0.5 text-[9px] font-medium text-slate-400 md:mt-1 md:text-[10px]">{sub}</div>
        {actionLabel ? <div className="mt-2 text-[9px] font-bold text-purple-600 md:text-[10px]">{actionLabel}</div> : null}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" data-testid={testId} onClick={onClick} className={cardClassName}>
        {content}
      </button>
    );
  }

  return (
    <div data-testid={testId} className={cardClassName}>
      {content}
    </div>
  );
}
