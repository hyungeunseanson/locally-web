'use client';

import React, { useState } from 'react';
import {
  Download, Search, Calendar, User,
  ArrowRight, CreditCard, Wallet, TrendingUp, AlertCircle, X,
  CheckCircle2, XCircle, Copy, Phone, Mail, AlertTriangle, Clock, Info
} from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import Image from 'next/image';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import dynamic from 'next/dynamic';
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import { Range } from 'react-date-range';

// SSR 비활성화로 react-date-range import (window is not defined 에러 방지)
const DateRange = dynamic(() => import('react-date-range').then(mod => mod.DateRange), { ssr: false });

export default function MasterLedgerTab({ bookings, onRefresh }: { bookings: any[], onRefresh: () => void }) {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<Range[]>([{
    startDate: undefined,
    endDate: undefined,
    key: 'selection'
  }]);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'CANCELLED'>('ALL');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 0. 예약 클릭 시 열람 처리
  const handleSelectBooking = (b: any) => {
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
  const ledgerData = bookings.filter(b => {
    // 날짜 범위 필터
    const sd = dateRange[0].startDate;
    const ed = dateRange[0].endDate;

    let startMatch = true;
    let endMatch = true;

    if (b.date) {
      if (sd) {
        // 예약 날짜(YYYY-MM-DD)와 필터 Date 비교
        const bDate = new Date(b.date);
        bDate.setHours(0, 0, 0, 0);
        const filterSd = new Date(sd);
        filterSd.setHours(0, 0, 0, 0);
        startMatch = bDate >= filterSd;
      }
      if (ed) {
        const bDate = new Date(b.date);
        bDate.setHours(0, 0, 0, 0);
        const filterEd = new Date(ed);
        filterEd.setHours(23, 59, 59, 999);
        endMatch = bDate <= filterEd;
      }
    }

    // 검색어 매칭
    const searchString = `${b.experiences?.profiles?.name} ${b.experiences?.title} ${b.contact_name} ${b.id} ${b.profiles?.email}`.toLowerCase();
    const searchMatch = searchString.includes(searchTerm.toLowerCase());

    // 상태 필터링
    const status = (b.status || '').toUpperCase();
    let statusMatch = false;

    if (statusFilter === 'ALL') {
      // 전체 보기: 입금대기, 결제완료, 취소됨 모두 포함
      statusMatch = ['PENDING', 'PAID', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'DECLINED', 'CANCELLATION_REQUESTED'].includes(status);
    } else if (statusFilter === 'PAID') {
      statusMatch = ['PAID', 'CONFIRMED', 'COMPLETED'].includes(status);
    } else if (statusFilter === 'PENDING') {
      statusMatch = status === 'PENDING';
    } else if (statusFilter === 'CANCELLED') {
      statusMatch = ['CANCELLED', 'DECLINED', 'CANCELLATION_REQUESTED'].includes(status);
    }

    return startMatch && endMatch && searchMatch && statusMatch;
  });

  // 2. 통합 합계 계산 (KPI) - 취소된 건은 제외
  const totals = ledgerData.reduce((acc, curr) => {
    if (['cancelled', 'declined', 'cancellation_requested'].includes(curr.status)) return acc;

    acc.totalSales += Number(curr.amount || 0);
    acc.totalBasePrice += Number(curr.total_experience_price || 0);
    acc.totalPayout += Number(curr.host_payout_amount || (curr.total_experience_price * 0.8));
    acc.totalProfit += Number(curr.platform_revenue || (curr.amount - (curr.total_experience_price * 0.8)));
    return acc;
  }, { totalSales: 0, totalBasePrice: 0, totalPayout: 0, totalProfit: 0 });

  // 3. 엑셀 CSV 다운로드
  const downloadLedgerCSV = () => {
    const headers = ['Date', 'Booking ID', 'Host', 'Tour', 'Customer', 'Status', 'Base Price', 'Total Price', 'Payout(80%)', 'Sales(Paid)', 'Revenue'];
    const rows = ledgerData.map(b => [
      b.date,
      b.id,
      b.experiences?.profiles?.name || 'Unknown',
      `"${b.experiences?.title}"`,
      `"${b.contact_name}(${b.guests}인)"`,
      b.status,
      b.price_at_booking,
      b.total_experience_price,
      b.host_payout_amount,
      b.amount,
      b.platform_revenue
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

  const handleConfirmPayment = async (bookingId: number) => {
    if (!confirm('입금이 확인되었습니까? 예약을 확정합니다.')) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/bookings/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });
      if (!res.ok) throw new Error('처리 실패');
      showToast('입금 확인 완료!', 'success');
      onRefresh();
      setSelectedBooking(null);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally { setIsProcessing(false); }
  };

  const handleForceCancel = async (bookingId: string) => {
    if (!confirm('⚠️ 정말로 강제 취소(전액 환불)하시겠습니까?')) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/payment/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, reason: '관리자 직권 취소', isHostCancel: true }),
      });
      if (!res.ok) throw new Error('취소 실패');
      showToast('취소 처리되었습니다.', 'success');
      onRefresh();
      setSelectedBooking(null);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally { setIsProcessing(false); }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('복사되었습니다.', 'success');
  };

  const renderStatusBadge = (status: string) => {
    const s = status?.toLowerCase();
    if (['paid', 'confirmed', 'completed'].includes(s)) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">확정</span>;
    if (s === 'pending') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700 animate-pulse">입금 대기</span>;
    if (['cancelled', 'declined', 'cancellation_requested'].includes(s)) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">취소됨</span>;
    return <span className="text-xs text-slate-500">{status}</span>;
  };

  return (
    <div className="flex h-full gap-4 md:gap-6 relative overflow-hidden flex-col md:flex-row">
      <div className={`flex-1 flex flex-col gap-4 md:gap-6 transition-all duration-300 ${selectedBooking ? 'hidden md:flex md:w-2/3' : 'flex w-full'}`}>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 shrink-0">
          <div className="bg-slate-900 p-4 md:p-5 rounded-xl md:rounded-2xl text-white shadow-lg shadow-slate-200">
            <div className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Sales</div>
            <div className="text-xl md:text-2xl font-black">₩{totals.totalSales.toLocaleString()}</div>
            <div className="text-[9px] md:text-[10px] text-slate-500 mt-1">실결제 매출</div>
          </div>
          <div className="bg-white p-4 md:p-5 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Payout (80%)</div>
            <div className="text-xl md:text-2xl font-black text-rose-600">₩{totals.totalPayout.toLocaleString()}</div>
            <div className="text-[9px] md:text-[10px] text-slate-400 mt-1">지급 예정액</div>
          </div>
          <div className="bg-white p-4 md:p-5 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Revenue</div>
            <div className="text-xl md:text-2xl font-black text-blue-600">₩{totals.totalProfit.toLocaleString()}</div>
            <div className="text-[9px] md:text-[10px] text-slate-400 mt-1">순수익</div>
          </div>
          <div className="bg-white p-4 md:p-5 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bookings</div>
            <div className="text-xl md:text-2xl font-black text-slate-900">{ledgerData.length}건</div>
            <div className="text-[9px] md:text-[10px] text-slate-400 mt-1 truncate">
              {dateRange[0].startDate && dateRange[0].endDate ?
                `${format(dateRange[0].startDate, 'yy.MM.dd')} ~ ${format(dateRange[0].endDate, 'yy.MM.dd')}`
                : '전체 기간'
              }
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between md:items-center bg-white p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm shrink-0 gap-3 md:gap-0">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4 md:items-center w-full md:w-auto">

            {/* 🗓️ 통합 달력(DateRangePicker) UI */}
            <div className="relative w-full md:w-auto">
              <button
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                className="flex items-center justify-center md:justify-start w-full md:w-auto gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <Calendar size={16} className="text-blue-600" />
                {dateRange[0].startDate && dateRange[0].endDate
                  ? `${format(dateRange[0].startDate, 'yyyy.MM.dd')} - ${format(dateRange[0].endDate, 'yyyy.MM.dd')}`
                  : '전체 기간 선택'}
              </button>

              {isCalendarOpen && (
                <div className="absolute top-12 left-0 z-50 bg-white border border-slate-200 shadow-2xl rounded-2xl p-2 animate-in fade-in zoom-in-95">
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

            <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl w-full md:w-auto justify-center">
              {[
                { id: 'ALL', label: '전체' },
                { id: 'PENDING', label: '입금대기' },
                { id: 'PAID', label: '확정됨' },
                { id: 'CANCELLED', label: '취소됨' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as any)}
                  className={`flex-1 md:flex-none px-2 py-1.5 md:px-3 text-[10px] md:text-xs font-bold rounded-lg transition-all ${statusFilter === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="검색 (이름, 예약번호)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:outline-none"
              />
            </div>
            <button
              onClick={downloadLedgerCSV}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all shrink-0"
            >
              <Download size={18} />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl md:rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto overflow-y-auto flex-1 scrollbar-hide">
            <table className="w-full text-xs md:text-[13px] text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-50 text-[9px] md:text-[10px] font-black text-slate-400 uppercase sticky top-0 z-10 border-b border-slate-100">
                <tr>
                  <th className="px-3 md:px-4 py-3 md:py-4 w-20 md:w-24">Status</th>
                  <th className="px-3 md:px-4 py-3 md:py-4">Date</th>
                  <th className="px-3 md:px-4 py-3 md:py-4">Host</th>
                  <th className="px-3 md:px-4 py-3 md:py-4">Tour Item</th>
                  <th className="px-3 md:px-4 py-3 md:py-4 text-center">Customer</th>
                  <th className="px-3 md:px-4 py-3 md:py-4 text-right">Price</th>
                  <th className="px-3 md:px-4 py-3 md:py-4 text-right">Payout(80%)</th>
                  <th className="px-3 md:px-4 py-3 md:py-4 text-right text-slate-900 bg-slate-100/50">매출(Paid)</th>
                  <th className="px-3 md:px-4 py-3 md:py-4 text-right text-blue-600">수익</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ledgerData.length === 0 ? (
                  <tr><td colSpan={9} className="py-32 text-center text-slate-400">데이터가 없습니다.</td></tr>
                ) : (
                  ledgerData.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => handleSelectBooking(b)}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer group ${selectedBooking?.id === b.id ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="px-4 py-4">{renderStatusBadge(b.status)}</td>
                      <td className="px-4 py-4 font-mono text-slate-500">{b.date?.slice(5)}</td>
                      <td className="px-4 py-4 font-bold text-slate-900">{b.experiences?.profiles?.name || '-'}</td>
                      <td className="px-4 py-4">
                        <div className="max-w-[150px] truncate font-medium text-slate-700" title={b.experiences?.title}>
                          {b.experiences?.title}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center text-slate-600">
                        {b.contact_name}({b.guests})
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-slate-400">
                        {Number(b.price_at_booking).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-black text-rose-600 bg-rose-50/30">
                        {Number(b.host_payout_amount || (b.total_experience_price * 0.8)).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-black text-slate-900 bg-slate-100/50">
                        {Number(b.amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-black text-blue-600">
                        {Number(b.platform_revenue || (b.amount - (b.total_experience_price * 0.8))).toLocaleString()}
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
        <div className="absolute inset-0 z-30 md:relative md:w-[400px] w-full bg-white md:rounded-2xl md:shadow-2xl md:border md:border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-right-10 duration-300 right-0 top-0 bottom-0 h-full">
          {/* Header */}
          <div className="p-4 md:p-5 border-b border-slate-100 flex justify-between items-start bg-slate-50">
            <div className="flex-1 pr-2">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${selectedBooking.status.toLowerCase() === 'pending' ? 'bg-amber-100 text-amber-700 animate-pulse' :
                  ['paid', 'confirmed', 'completed'].includes(selectedBooking.status.toLowerCase()) ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                  {selectedBooking.status}
                </div>
                <span className="text-[10px] text-slate-400 font-bold">#{selectedBooking.id.slice(0, 8)}</span>
              </div>
              <h3 className="text-base font-black text-slate-900 leading-tight mb-2 line-clamp-2">{selectedBooking.experiences?.title}</h3>
              <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
                <span>{selectedBooking.date} {selectedBooking.time}</span>
                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                <span>게스트 {selectedBooking.guests}명</span>
              </div>
            </div>
            <button onClick={() => setSelectedBooking(null)} className="text-slate-400 hover:text-slate-900 p-1 bg-white rounded-full border border-slate-100 shadow-sm"><X size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-hide bg-white">
            {/* 예약/결제 시점 */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <Clock size={12} className="text-slate-400" />
              <span>접수: <span className="font-bold text-slate-700">{format(new Date(selectedBooking.created_at), 'yyyy.MM.dd HH:mm:ss', { locale: ko })}</span></span>
            </div>

            {/* 게스트 정보 (Compact) */}
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><User size={10} /> Guest Info</h4>
              <div className="grid grid-cols-1 gap-0 text-sm border border-slate-100 rounded-xl overflow-hidden">
                <div className="flex justify-between items-center px-3 py-2.5 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <span className="text-slate-500 text-xs">Name</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1 cursor-pointer hover:text-blue-600" onClick={() => handleCopy(selectedBooking.contact_name)}>
                    {selectedBooking.contact_name} <Copy size={10} className="text-slate-300" />
                  </span>
                </div>
                <div className="flex justify-between items-center px-3 py-2.5 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <span className="text-slate-500 text-xs">Phone</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1 cursor-pointer hover:text-blue-600" onClick={() => handleCopy(selectedBooking.contact_phone)}>
                    {selectedBooking.contact_phone} <Copy size={10} className="text-slate-300" />
                  </span>
                </div>
                <div className="flex justify-between items-center px-3 py-2.5 hover:bg-slate-50 transition-colors">
                  <span className="text-slate-500 text-xs">Email</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1 cursor-pointer hover:text-blue-600 truncate max-w-[200px]" onClick={() => handleCopy(selectedBooking.profiles?.email)}>
                    {selectedBooking.profiles?.email} <Copy size={10} className="text-slate-300" />
                  </span>
                </div>
              </div>
            </div>

            {/* 결제 및 정산 (Compact List) */}
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><CreditCard size={10} /> Payment Breakdown</h4>
              <div className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">결제 수단</span>
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    {/* 결제수단 로직 개선: payment_method 필드 자체를 확인 */}
                    {selectedBooking.payment_method === 'bank' || (selectedBooking.payment_method && selectedBooking.payment_method.includes('bank')) ? '🏛️ 무통장 입금' : '💳 카드 결제'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">결제 금액</span>
                  <span className="text-sm font-black text-slate-900">₩{Number(selectedBooking.amount).toLocaleString()}</span>
                </div>
                <div className="h-px bg-slate-200 my-1"></div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">호스트 정산 (80%)</span>
                  <span className="text-xs font-bold text-rose-500">₩{Number(selectedBooking.host_payout_amount || (selectedBooking.total_experience_price * 0.8)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">플랫폼 수익 (Net)</span>
                  <span className="text-xs font-bold text-blue-600">₩{Number(selectedBooking.platform_revenue || (selectedBooking.amount - (selectedBooking.total_experience_price * 0.8))).toLocaleString()}</span>
                </div>
              </div>
              <p className="text-[9px] text-slate-400 mt-2 text-right flex justify-end gap-1 items-center"><Info size={10} /> Order ID: {selectedBooking.order_id || selectedBooking.id}</p>
            </div>

            {/* 관리자 액션 */}
            <div className="pt-2">
              {selectedBooking.status === 'PENDING' && (
                <button
                  onClick={() => handleConfirmPayment(selectedBooking.id)}
                  disabled={isProcessing}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 group"
                >
                  {isProcessing ? '처리 중...' : (
                    <>
                      <span>💰 입금 확인 (예약 확정)</span>
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              )}

              {['confirmed', 'paid', 'completed'].includes(selectedBooking.status.toLowerCase()) && (
                <button
                  onClick={() => handleForceCancel(selectedBooking.id)}
                  disabled={isProcessing}
                  className="w-full py-3 bg-white hover:bg-red-50 text-red-600 rounded-xl text-xs font-bold transition-all border border-red-100 flex items-center justify-center gap-2"
                >
                  {isProcessing ? '처리 중...' : '⚠️ 예약 강제 취소 (전액 환불)'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
