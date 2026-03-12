'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  Info,
  Search,
  User,
  X,
} from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import dynamic from 'next/dynamic';
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import { Range } from 'react-date-range';
import { createClient } from '@/app/utils/supabase/client';
import {
  BOOKING_CANCELLED_STATUSES_UPPER,
  BOOKING_CONFIRMED_STATUSES_UPPER,
  BOOKING_LEDGER_VISIBLE_STATUSES_UPPER,
  isCancelledBookingStatus,
  isConfirmedBookingStatus,
  isPendingBookingStatus,
} from '@/app/constants/bookingStatus';
import {
  getBookingBasePrice,
  getBookingExperienceAmount,
  getBookingHostPayout,
  getBookingPaidAmount,
  getBookingPlatformRevenue,
} from '@/app/utils/bookingFinance';
import { AdminMasterLedgerEntry } from '@/app/types/admin';

// SSR 비활성화로 react-date-range import (window is not defined 에러 방지)
const DateRange = dynamic(() => import('react-date-range').then(mod => mod.DateRange), { ssr: false });

function parseDateOnly(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function isBankPaymentMethod(value?: string | null) {
  return value === 'bank' || Boolean(value && value.includes('bank'));
}

function getLedgerBasePrice(booking: AdminMasterLedgerEntry) {
  if (booking._type === 'service') {
    return null;
  }

  return getBookingBasePrice(booking);
}

function getLedgerPayout(booking: AdminMasterLedgerEntry) {
  if (booking._type === 'service') {
    return booking.host_payout_amount != null ? Number(booking.host_payout_amount) : null;
  }

  return getBookingHostPayout(booking);
}

function getLedgerRevenue(booking: AdminMasterLedgerEntry) {
  if (booking._type === 'service') {
    return booking.platform_revenue != null ? Number(booking.platform_revenue) : null;
  }

  return getBookingPlatformRevenue(booking);
}

function getLedgerExperiencePrice(booking: AdminMasterLedgerEntry) {
  if (booking._type === 'service') {
    return Number(booking.total_experience_price ?? booking.amount ?? 0);
  }

  return getBookingExperienceAmount(booking) || getBookingPaidAmount(booking);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

const STATUS_TABS = [
  { id: 'ALL', label: '전체' },
  { id: 'PENDING', label: '입금대기' },
  { id: 'PAID', label: '확정됨' },
  { id: 'CANCELLED', label: '취소됨' },
] as const;

type ConfirmDialogState =
  | {
      kind: 'confirm-payment' | 'force-cancel';
      bookingId: string;
      title: string;
      description: string;
      confirmLabel: string;
      tone: 'blue' | 'red';
    }
  | null;

export default function MasterLedgerTab({
  onRefresh,
  refreshSignal,
}: {
  onRefresh: () => void;
  refreshSignal: string;
}) {
  const { showToast } = useToast();
  const supabase = useRef(createClient()).current;
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<Range[]>([{
    startDate: undefined,
    endDate: undefined,
    key: 'selection'
  }]);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'CANCELLED'>('ALL');
  const [selectedBooking, setSelectedBooking] = useState<AdminMasterLedgerEntry | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [allBookings, setAllBookings] = useState<AdminMasterLedgerEntry[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
  const lastRefreshSignalRef = useRef<string | null>(null);
  const selectedStartDate = dateRange[0].startDate ? format(dateRange[0].startDate, 'yyyy-MM-dd') : '';
  const selectedEndDate = dateRange[0].endDate ? format(dateRange[0].endDate, 'yyyy-MM-dd') : '';

  const fetchLedger = useCallback(async () => {
    setIsLoadingLedger(true);
    try {
      const searchParams = new URLSearchParams();
      if (selectedStartDate) {
        searchParams.set('startDate', selectedStartDate);
      }
      if (selectedEndDate) {
        searchParams.set('endDate', selectedEndDate);
      }

      const queryString = searchParams.toString();
      const response = await fetch(`/api/admin/master-ledger${queryString ? `?${queryString}` : ''}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '장부 데이터를 불러오지 못했습니다.');
      }

      setAllBookings((result.data || []) as AdminMasterLedgerEntry[]);
    } catch (error: unknown) {
      showToast(getErrorMessage(error, '장부 데이터를 불러오지 못했습니다.'), 'error');
    } finally {
      setIsLoadingLedger(false);
    }
  }, [selectedEndDate, selectedStartDate, showToast]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  useEffect(() => {
    if (lastRefreshSignalRef.current === null) {
      lastRefreshSignalRef.current = refreshSignal;
      return;
    }

    if (lastRefreshSignalRef.current === refreshSignal) {
      return;
    }

    lastRefreshSignalRef.current = refreshSignal;
    fetchLedger();
  }, [fetchLedger, refreshSignal]);

  useEffect(() => {
    const realtimeChannel = supabase
      .channel('admin_master_ledger_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings' }, () => {
        void fetchLedger();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'service_bookings' }, () => {
        void fetchLedger();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'service_bookings' }, () => {
        void fetchLedger();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [fetchLedger, supabase]);

  // 0. 예약 클릭 시 열람 처리
  const handleSelectBooking = (b: AdminMasterLedgerEntry) => {
    setSelectedBooking(b);

    // 열람 기록 저장
    const viewedIds = JSON.parse(localStorage.getItem('viewed_booking_ids') || '[]');
    if (!viewedIds.includes(b.id)) {
      const newViewed = [...viewedIds, b.id];
      localStorage.setItem('viewed_booking_ids', JSON.stringify(newViewed));
      // 사이드바에 알림 (이벤트 발생)
      window.dispatchEvent(new Event('booking-viewed'));
    }
  };

  // 1. 장부 데이터 필터링
  const ledgerData = allBookings.filter((b) => {
    // 날짜 범위 필터
    const sd = dateRange[0].startDate;
    const ed = dateRange[0].endDate;

    let startMatch = true;
    let endMatch = true;

    if (b.date) {
      const bookingDate = parseDateOnly(b.date);
      if (sd) {
        // 예약 날짜(YYYY-MM-DD)와 필터 Date 비교
        const filterSd = new Date(sd);
        filterSd.setHours(0, 0, 0, 0);
        startMatch = bookingDate ? bookingDate >= filterSd : true;
      }
      if (ed) {
        const filterEd = new Date(ed);
        filterEd.setHours(23, 59, 59, 999);
        endMatch = bookingDate ? bookingDate <= filterEd : true;
      }
    }

    // 검색어 매칭
    const searchString = `${b.experiences?.profiles?.name} ${b.experiences?.title} ${b.contact_name} ${b.id} ${b.profiles?.email} ${b.order_id ?? ''}`.toLowerCase();
    const searchMatch = searchString.includes(searchTerm.toLowerCase());

    // 상태 필터링
    const status = (b.status || '').toUpperCase();
    let statusMatch = false;

    if (statusFilter === 'ALL') {
      // 전체 보기: 입금대기, 결제완료, 취소됨 모두 포함
      statusMatch = BOOKING_LEDGER_VISIBLE_STATUSES_UPPER.includes(status);
    } else if (statusFilter === 'PAID') {
      statusMatch = BOOKING_CONFIRMED_STATUSES_UPPER.includes(status);
    } else if (statusFilter === 'PENDING') {
      statusMatch = isPendingBookingStatus(status);
    } else if (statusFilter === 'CANCELLED') {
      statusMatch = BOOKING_CANCELLED_STATUSES_UPPER.includes(status);
    }

    return startMatch && endMatch && searchMatch && statusMatch;
  });

  // 2. 통합 합계 계산 (KPI) - 취소된 건은 제외
  const totals = ledgerData.reduce((acc, curr) => {
    if (isCancelledBookingStatus(curr.status)) return acc;
    // 서비스의뢰: PENDING 상태는 KPI에서 제외 (결제 미확정)
    if (curr._type === 'service' && curr.status === 'PENDING') return acc;

    const paidAmount = getBookingPaidAmount(curr);
    const payout = getLedgerPayout(curr) ?? 0;
    const profit = getLedgerRevenue(curr) ?? 0;

    acc.totalSales += paidAmount;
    acc.totalPayout += payout;
    acc.totalProfit += profit;
    return acc;
  }, { totalSales: 0, totalPayout: 0, totalProfit: 0 });

  // 3. 엑셀 CSV 다운로드
  const downloadLedgerCSV = () => {
    const headers = ['Type', 'Date', 'Booking ID', 'Host', 'Tour', 'Customer', 'Status', 'Base Price', 'Total Price', 'Payout', 'Sales(Paid)', 'Revenue'];
    const rows = ledgerData.map(b => [
      b._type === 'service' ? '서비스의뢰' : '일반예약',
      b.date,
      b.id,
      b.experiences?.profiles?.name || 'Unknown',
      `"${b.experiences?.title}"`,
      `"${b.contact_name}(${b.guests}인)"`,
      b.status,
      getLedgerBasePrice(b) ?? '',
      getLedgerExperiencePrice(b),
      getLedgerPayout(b) ?? '',
      getBookingPaidAmount(b),
      getLedgerRevenue(b) ?? ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const sdStr = dateRange[0].startDate ? format(dateRange[0].startDate, 'yyyyMMdd') : 'ALL';
    const edStr = dateRange[0].endDate ? format(dateRange[0].endDate, 'yyyyMMdd') : 'ALL';
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `locally_ledger_${sdStr}_to_${edStr}.csv`;
    link.click();
    showToast('장부가 CSV로 다운로드되었습니다.', 'success');
  };

  const confirmDialogAction = async () => {
    if (!confirmDialog) return;

    if (confirmDialog.kind === 'confirm-payment') {
      await performConfirmPayment(confirmDialog.bookingId);
      return;
    }

    await performForceCancel(confirmDialog.bookingId);
  };

  const refreshAfterMutation = async () => {
    await Promise.allSettled([
      fetchLedger(),
      Promise.resolve(onRefresh()),
    ]);
  };

  const performConfirmPayment = async (bookingId: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/admin/bookings/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || '처리 실패');
      showToast('입금 확인 완료!', 'success');
      await refreshAfterMutation();
      setSelectedBooking(null);
      setConfirmDialog(null);
    } catch (error: unknown) {
      showToast(getErrorMessage(error, '처리 실패'), 'error');
    } finally { setIsProcessing(false); }
  };

  const handleConfirmPayment = async (bookingId: string) => {
    const isMobileScreen = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

    if (isMobileScreen) {
      setConfirmDialog({
        kind: 'confirm-payment',
        bookingId,
        title: '입금 확인',
        description: '입금이 확인되었습니까? 예약을 확정합니다.',
        confirmLabel: '입금 확인',
        tone: 'blue',
      });
      return;
    }

    if (!confirm('입금이 확인되었습니까? 예약을 확정합니다.')) return;
    await performConfirmPayment(bookingId);
  };

  const performForceCancel = async (bookingId: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/admin/bookings/force-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, reason: '관리자 직권 취소' }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || '취소 실패');
      showToast('취소 처리되었습니다.', 'success');
      await refreshAfterMutation();
      setSelectedBooking(null);
      setConfirmDialog(null);
    } catch (error: unknown) {
      showToast(getErrorMessage(error, '취소 실패'), 'error');
    } finally { setIsProcessing(false); }
  };

  const handleForceCancel = async (bookingId: string) => {
    const isMobileScreen = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

    if (isMobileScreen) {
      setConfirmDialog({
        kind: 'force-cancel',
        bookingId,
        title: '강제 취소',
        description: '정말로 강제 취소(전액 환불)하시겠습니까?',
        confirmLabel: '강제 취소',
        tone: 'red',
      });
      return;
    }

    if (!confirm('⚠️ 정말로 강제 취소(전액 환불)하시겠습니까?')) return;
    await performForceCancel(bookingId);
  };

  const handleCopy = (text?: string | null) => {
    if (!text) {
      showToast('복사할 정보가 없습니다.', 'error');
      return;
    }

    navigator.clipboard.writeText(text);
    showToast('복사되었습니다.', 'success');
  };

  const renderStatusBadge = (status: string) => {
    const s = status?.toLowerCase();
    if (isConfirmedBookingStatus(status)) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">확정</span>;
    if (s === 'pending') return <span className="inline-flex items-center gap-1 rounded bg-yellow-100 px-1.5 py-0.5 text-[9px] font-bold text-yellow-700 animate-pulse md:px-2 md:text-[10px]"><span className="md:hidden">입금</span><span className="hidden md:inline">입금 대기</span></span>;
    if (isCancelledBookingStatus(status)) return <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700 md:px-2 md:text-[10px]"><span className="md:hidden">취소</span><span className="hidden md:inline">취소됨</span></span>;
    return <span className="text-xs text-slate-500">{status}</span>;
  };

  return (
    <div className="flex h-full gap-4 md:gap-6 relative overflow-hidden flex-col md:flex-row">
      <div className={`flex-1 flex flex-col gap-4 md:gap-6 transition-all duration-300 ${selectedBooking ? 'hidden md:flex md:w-2/3' : 'flex w-full'}`}>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 md:gap-4 shrink-0">
          <div className="bg-slate-900 p-2.5 md:p-5 rounded-xl md:rounded-2xl text-white shadow-lg shadow-slate-200">
            <div className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">Total Sales</div>
            <div className="text-[13px] md:text-2xl font-black">₩{totals.totalSales.toLocaleString()}</div>
            <div className="text-[7px] md:text-[10px] text-slate-500 mt-0.5 md:mt-1">실결제 매출</div>
          </div>
          <div className="bg-white p-2.5 md:p-5 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">Payout (80%)</div>
            <div className="text-[13px] md:text-2xl font-black text-rose-600">₩{totals.totalPayout.toLocaleString()}</div>
            <div className="text-[7px] md:text-[10px] text-slate-400 mt-0.5 md:mt-1">지급 예정액</div>
          </div>
          <div className="bg-white p-2.5 md:p-5 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">Net Revenue</div>
            <div className="text-[13px] md:text-2xl font-black text-blue-600">₩{totals.totalProfit.toLocaleString()}</div>
            <div className="text-[7px] md:text-[10px] text-slate-400 mt-0.5 md:mt-1">순수익</div>
          </div>
          <div className="bg-white p-2.5 md:p-5 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">Bookings</div>
            <div className="text-[13px] md:text-2xl font-black text-slate-900">{ledgerData.length}건</div>
            <div className="text-[7px] md:text-[10px] text-slate-400 mt-0.5 md:mt-1 truncate">
              {dateRange[0].startDate && dateRange[0].endDate ?
                `${format(dateRange[0].startDate, 'yy.MM.dd')} ~ ${format(dateRange[0].endDate, 'yy.MM.dd')}`
                : '전체 기간'
              }
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between md:items-center bg-white p-2 md:p-4 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm shrink-0 gap-2 md:gap-0">
          <div className="flex flex-col md:flex-row gap-2 md:gap-4 md:items-center w-full md:w-auto">

            {/* 🗓️ 통합 달력(DateRangePicker) UI */}
            <div className="relative w-full md:w-auto">
              <button
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                className="flex items-center justify-center md:justify-start w-full md:w-auto gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl text-[10px] md:text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <Calendar size={14} className="text-blue-600 md:w-4 md:h-4" />
                {dateRange[0].startDate && dateRange[0].endDate
                  ? `${format(dateRange[0].startDate, 'yyyy.MM.dd')} - ${format(dateRange[0].endDate, 'yyyy.MM.dd')}`
                  : '전체 기간 선택'}
              </button>

              {isCalendarOpen && (
                <div className="absolute top-10 md:top-12 left-0 z-50 bg-white border border-slate-200 shadow-2xl rounded-xl md:rounded-2xl p-2 animate-in fade-in zoom-in-95">
                  <DateRange
                    editableDateInputs={true}
                    onChange={item => setDateRange([item.selection])}
                    moveRangeOnFirstSelection={false}
                    ranges={dateRange}
                    months={2} // 두 달 연속 표시
                    direction="horizontal"
                    locale={ko}
                    rangeColors={['#2563eb']} // Tailwind Blue-600
                  />
                  <div className="flex justify-between items-center p-2 border-t border-slate-100 mt-2">
                    <button
                      onClick={() => setDateRange([{ startDate: undefined, endDate: undefined, key: 'selection' }])}
                      className="text-xs text-slate-400 hover:text-slate-700 underline"
                    >
                      초기화
                    </button>
                    <button
                      onClick={() => setIsCalendarOpen(false)}
                      className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-xs font-bold"
                    >
                      적용
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap bg-slate-100 p-1 rounded-lg w-full md:w-auto justify-center">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`flex-1 md:flex-none px-1.5 py-1 md:px-3 text-[9px] md:text-xs font-bold rounded-md md:rounded-lg transition-all ${statusFilter === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {tab.id === 'PENDING' ? (
                    <>
                      <span className="md:hidden">입금</span>
                      <span className="hidden md:inline">입금대기</span>
                    </>
                  ) : tab.id === 'PAID' ? (
                    <>
                      <span className="md:hidden">확정</span>
                      <span className="hidden md:inline">확정됨</span>
                    </>
                  ) : tab.id === 'CANCELLED' ? (
                    <>
                      <span className="md:hidden">취소</span>
                      <span className="hidden md:inline">취소됨</span>
                    </>
                  ) : tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto mt-0 md:mt-0">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input
                type="text"
                placeholder="검색 (이름, 예약번호)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 md:pl-9 pr-3 py-1.5 md:py-2 bg-slate-50 border border-slate-100 rounded-lg md:rounded-xl text-[10px] md:text-xs focus:outline-none"
              />
            </div>
            <button
              onClick={downloadLedgerCSV}
              className="flex items-center justify-center gap-1.5 md:gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[11px] md:text-sm font-bold transition-all shrink-0"
            >
              <Download size={14} className="md:w-[18px] md:h-[18px]" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl md:rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto overflow-y-auto flex-1 scrollbar-hide">
            <table className="w-full text-[9px] md:text-[13px] text-left border-collapse min-w-[620px] md:min-w-[800px]">
              <thead className="bg-slate-50 text-[8px] md:text-[10px] font-black text-slate-400 uppercase sticky top-0 z-10 border-b border-slate-100">
                <tr>
                  <th className="px-1.5 md:px-4 py-2 md:py-4 w-16 md:w-24"><span className="md:hidden">상태</span><span className="hidden md:inline">Status</span></th>
                  <th className="hidden md:table-cell px-2 md:px-4 py-2 md:py-4">Type</th>
                  <th className="px-1.5 md:px-4 py-2 md:py-4"><span className="md:hidden">일자</span><span className="hidden md:inline">Date</span></th>
                  <th className="px-1.5 md:px-4 py-2 md:py-4"><span className="md:hidden">호스트</span><span className="hidden md:inline">Host</span></th>
                  <th className="px-1.5 md:px-4 py-2 md:py-4"><span className="md:hidden">상품</span><span className="hidden md:inline">Tour Item</span></th>
                  <th className="px-1.5 md:px-4 py-2 md:py-4 text-center"><span className="md:hidden">게스트</span><span className="hidden md:inline">Customer</span></th>
                  <th className="px-1.5 md:px-4 py-2 md:py-4 text-right"><span className="md:hidden">가격</span><span className="hidden md:inline">Price</span></th>
                  <th className="px-1.5 md:px-4 py-2 md:py-4 text-right"><span className="md:hidden">정산</span><span className="hidden md:inline">Payout</span></th>
                  <th className="px-2 md:px-4 py-2 md:py-4 text-right text-slate-900 bg-slate-100/50">매출(Paid)</th>
                  <th className="px-2 md:px-4 py-2 md:py-4 text-right text-blue-600">수익</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoadingLedger ? (
                  <tr><td colSpan={10} className="py-32 text-center text-slate-400">장부 데이터를 불러오는 중입니다.</td></tr>
                ) : ledgerData.length === 0 ? (
                  <tr><td colSpan={10} className="py-32 text-center text-slate-400">데이터가 없습니다.</td></tr>
                ) : (
                  ledgerData.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => handleSelectBooking(b)}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer group ${selectedBooking?.id === b.id ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="px-1.5 md:px-4 py-2 md:py-4">{renderStatusBadge(b.status)}</td>
                      <td className="hidden md:table-cell px-2 md:px-4 py-2.5 md:py-4">
                        {b._type === 'service'
                          ? <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700">서비스의뢰</span>
                          : <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500">일반예약</span>
                        }
                      </td>
                      <td className="px-1.5 md:px-4 py-2 md:py-4 font-mono text-[8px] md:text-xs text-slate-500">{b.date?.slice(5)}</td>
                      <td className="px-1.5 md:px-4 py-2 md:py-4 font-bold text-slate-900 truncate max-w-[76px] md:max-w-[80px]">{b.experiences?.profiles?.name || '-'}</td>
                      <td className="px-1.5 md:px-4 py-2 md:py-4">
                        <div className="max-w-[112px] md:max-w-[150px] truncate font-medium text-slate-700" title={b.experiences?.title}>
                          {b.experiences?.title}
                        </div>
                      </td>
                      <td className="px-1.5 md:px-4 py-2 md:py-4 text-center text-[9px] md:text-sm text-slate-600 truncate max-w-[76px] md:max-w-[80px]">
                        {b.contact_name}({b.guests})
                      </td>
                      <td className="px-1.5 md:px-4 py-2 md:py-4 text-right font-mono text-[8px] md:text-sm text-slate-400">
                        {getLedgerBasePrice(b) != null ? getLedgerBasePrice(b)?.toLocaleString() : '-'}
                      </td>
                      <td className="px-1.5 md:px-4 py-2 md:py-4 text-right font-mono text-[9px] md:text-sm font-black text-rose-600 bg-rose-50/30">
                        {getLedgerPayout(b) != null ? getLedgerPayout(b)?.toLocaleString() : '-'}
                      </td>
                      <td className="px-1.5 md:px-4 py-2 md:py-4 text-right font-mono text-[9px] md:text-sm font-black text-slate-900 bg-slate-100/50">
                        {getBookingPaidAmount(b).toLocaleString()}
                      </td>
                      <td className="px-1.5 md:px-4 py-2 md:py-4 text-right font-mono text-[9px] md:text-sm font-black text-blue-600">
                        {getLedgerRevenue(b) != null ? getLedgerRevenue(b)?.toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedBooking && (
        <>
        <button
          type="button"
          aria-label="상세 닫기"
          onClick={() => setSelectedBooking(null)}
          className="fixed inset-0 z-[90] bg-slate-900/35 md:hidden"
        />
        <div className="fixed inset-x-2 bottom-2 top-16 z-[100] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in slide-in-from-bottom-6 duration-300 md:relative md:inset-auto md:z-30 md:h-full md:w-[400px] md:rounded-2xl md:border md:border-slate-200 md:shadow-2xl">
          {/* Header */}
          <div className="p-2.5 md:p-5 border-b border-slate-100 flex justify-between items-start bg-slate-50">
            <div className="flex-1 pr-2">
              <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-1.5">
                <div className={`px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[10px] font-black uppercase tracking-wider ${selectedBooking.status.toLowerCase() === 'pending' ? 'bg-amber-100 text-amber-700 animate-pulse' :
                  isConfirmedBookingStatus(selectedBooking.status) ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                  {selectedBooking.status}
                </div>
                <span className="text-[8px] md:text-[10px] text-slate-400 font-bold">#{String(selectedBooking.id).slice(0, 8)}</span>
              </div>
              <h3 className="text-[12px] md:text-base font-black text-slate-900 leading-tight mb-1 md:mb-2 line-clamp-2">{selectedBooking.experiences?.title}</h3>
              <div className="flex items-center gap-1.5 md:gap-3 text-[9px] md:text-xs text-slate-600 font-medium">
                <span>{selectedBooking.date} {selectedBooking.time}</span>
                <span className="w-0.5 h-0.5 md:w-1 md:h-1 bg-slate-300 rounded-full"></span>
                <span>게스트 {selectedBooking.guests}명</span>
              </div>
            </div>
            <button onClick={() => setSelectedBooking(null)} className="text-slate-400 hover:text-slate-900 p-1 md:bg-white rounded-full bg-slate-200/50 md:border md:border-slate-100 md:shadow-sm"><X size={14} className="md:w-4 md:h-4" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-3 md:space-y-6 scrollbar-hide bg-white pb-6 md:pb-10">
            {/* 예약/결제 시점 */}
            <div className="flex items-center gap-1.5 md:gap-2 text-[9px] md:text-[11px] text-slate-500 bg-slate-50 p-2 md:p-2.5 rounded-lg border border-slate-100">
              <Clock size={12} className="text-slate-400 md:w-3.5 md:h-3.5" />
              <span>접수: <span className="font-bold text-slate-700">{format(new Date(selectedBooking.created_at), 'yyyy.MM.dd HH:mm:ss', { locale: ko })}</span></span>
            </div>

            {/* 게스트 정보 (Compact) */}
            <div>
              <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 md:mb-2 flex items-center gap-1"><User size={10} /> Guest Info</h4>
              <div className="grid grid-cols-1 gap-0 text-xs md:text-sm border border-slate-100 rounded-lg md:rounded-xl overflow-hidden">
                <div className="flex justify-between items-center px-2.5 md:px-3 py-1.5 md:py-2.5 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <span className="text-slate-500 text-[10px] md:text-xs">Name</span>
                  <span className="font-bold text-[10px] md:text-sm text-slate-900 flex items-center gap-1 cursor-pointer hover:text-blue-600" onClick={() => handleCopy(selectedBooking.contact_name)}>
                    {selectedBooking.contact_name} <Copy size={10} className="text-slate-300 md:w-3 md:h-3" />
                  </span>
                </div>
                <div className="flex justify-between items-center px-2.5 md:px-3 py-1.5 md:py-2.5 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <span className="text-slate-500 text-[10px] md:text-xs">Phone</span>
                  <span className="font-bold text-[10px] md:text-sm text-slate-900 flex items-center gap-1 cursor-pointer hover:text-blue-600" onClick={() => handleCopy(selectedBooking.contact_phone)}>
                    {selectedBooking.contact_phone} <Copy size={10} className="text-slate-300 md:w-3 md:h-3" />
                  </span>
                </div>
                <div className="flex justify-between items-center px-2.5 md:px-3 py-1.5 md:py-2.5 hover:bg-slate-50 transition-colors">
                  <span className="text-slate-500 text-[10px] md:text-xs">Email</span>
                  <span className="font-bold text-[10px] md:text-sm text-slate-900 flex items-center gap-1 cursor-pointer hover:text-blue-600 truncate max-w-[150px] md:max-w-[200px]" onClick={() => handleCopy(selectedBooking.profiles?.email)}>
                    {selectedBooking.profiles?.email} <Copy size={10} className="text-slate-300 md:w-3 md:h-3" />
                  </span>
                </div>
              </div>
            </div>

            {/* 결제 및 정산 (Compact List) */}
            <div>
              <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 md:mb-2 flex items-center gap-1"><CreditCard size={10} /> Payment Breakdown</h4>
              <div className="bg-slate-50 rounded-xl p-2.5 md:p-3 space-y-1 md:space-y-2 border border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] md:text-xs text-slate-500">결제 수단</span>
                  <span className="text-[10px] md:text-xs font-bold text-slate-700 flex items-center gap-1">
                    {/* 결제수단 로직 개선: payment_method 필드 자체를 확인 */}
                    {selectedBooking.payment_method === 'bank' || (selectedBooking.payment_method && selectedBooking.payment_method.includes('bank')) ? '🏛️ 무통장 입금' : '💳 카드 결제'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] md:text-xs text-slate-500">결제 금액</span>
                  <span className="text-[11px] md:text-sm font-black text-slate-900">₩{Number(selectedBooking.amount).toLocaleString()}</span>
                </div>
                <div className="h-px bg-slate-200 my-0.5 md:my-1"></div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] md:text-xs text-slate-500">호스트 정산 (80%)</span>
                  <span className="text-[10px] md:text-xs font-bold text-rose-500">
                    {getLedgerPayout(selectedBooking) != null ? `₩${getLedgerPayout(selectedBooking)?.toLocaleString()}` : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] md:text-xs text-slate-500">플랫폼 수익 (Net)</span>
                  <span className="text-[10px] md:text-xs font-bold text-blue-600">
                    {getLedgerRevenue(selectedBooking) != null ? `₩${getLedgerRevenue(selectedBooking)?.toLocaleString()}` : '-'}
                  </span>
                </div>
              </div>
              <p className="hidden md:flex text-[8px] md:text-[9px] text-slate-400 mt-1.5 md:mt-2 text-right justify-end gap-1 items-center"><Info size={10} /> Order ID: {selectedBooking.order_id || selectedBooking.id}</p>
            </div>

            {/* 관리자 액션 — 일반 예약만 */}
            {selectedBooking._type !== 'service' && (
              <div className="pt-1 md:pt-2">
                {isPendingBookingStatus(selectedBooking.status) && isBankPaymentMethod(selectedBooking.payment_method) && (
                  <button
                    onClick={() => handleConfirmPayment(selectedBooking.id)}
                    disabled={isProcessing}
                    className="w-full py-2.5 md:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] md:text-xs font-bold transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 group"
                  >
                    {isProcessing ? '처리 중...' : (
                      <>
                        <span><span className="md:hidden">💰 입금 확인</span><span className="hidden md:inline">💰 입금 확인 (예약 확정)</span></span>
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                )}

                {isConfirmedBookingStatus(selectedBooking.status) && (
                  <button
                    onClick={() => handleForceCancel(selectedBooking.id)}
                    disabled={isProcessing}
                    className="w-full py-2.5 md:py-3 bg-white hover:bg-red-50 text-red-600 rounded-xl text-[10px] md:text-xs font-bold transition-all border border-red-100 flex items-center justify-center gap-2"
                  >
                    {isProcessing ? '처리 중...' : (
                      <>
                        <span className="md:hidden">⚠️ 강제 취소</span>
                        <span className="hidden md:inline">⚠️ 예약 강제 취소 (전액 환불)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
            {selectedBooking._type === 'service' && (
              <div className="pt-1 md:pt-2">
                <p className="text-[10px] md:text-xs text-slate-400 text-center bg-slate-50 rounded-xl p-3 border border-slate-100">
                  서비스 의뢰 관리는 <strong>서비스 의뢰 탭</strong>에서 처리하세요.
                </p>
              </div>
            )}
          </div>
        </div>
        </>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[120] md:hidden">
          <button
            type="button"
            aria-label="확인 모달 닫기"
            onClick={() => !isProcessing && setConfirmDialog(null)}
            className="absolute inset-0 bg-slate-900/45"
          />
          <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 rounded-full p-2 ${confirmDialog.tone === 'red' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                {confirmDialog.tone === 'red' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-black text-slate-900">{confirmDialog.title}</h4>
                <p className="mt-1 text-[12px] leading-5 text-slate-600">{confirmDialog.description}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                disabled={isProcessing}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmDialogAction}
                disabled={isProcessing}
                className={`flex-1 rounded-xl px-4 py-3 text-xs font-bold text-white ${confirmDialog.tone === 'red' ? 'bg-red-600' : 'bg-blue-600'}`}
              >
                {isProcessing ? '처리 중...' : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
