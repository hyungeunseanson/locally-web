'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { DollarSign, TrendingUp, CreditCard, Wallet, AlertTriangle, CheckCircle, Calendar as CalendarIcon, ChevronDown, ChevronRight, ChevronUp, Download, Check } from 'lucide-react';
import dynamic from 'next/dynamic';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { Range } from 'react-date-range';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useToast } from '@/app/context/ToastContext';
import { settleHostPayout } from '@/app/actions/admin';
import { isCancelledOnlyBookingStatus, isCompletedBookingStatus } from '@/app/constants/bookingStatus';
import { createClient } from '@/app/utils/supabase/client';

const DateRange = dynamic(() => import('react-date-range').then(mod => mod.DateRange), { ssr: false });


export default function SalesTab({ bookings, apps, onRefresh }: { bookings: any[], apps: any[], onRefresh?: () => void }) {
  const [dateRange, setDateRange] = useState<Range[]>([{
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
    key: 'selection'
  }]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('30D');
  const [settlementTab, setSettlementTab] = useState<'PENDING' | 'COMPLETED'>('PENDING');
  const [expandedHostId, setExpandedHostId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [serviceBookings, setServiceBookings] = useState<any[]>([]);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  // Fetch service_bookings once for KPI aggregation
  useEffect(() => {
    supabase
      .from('service_bookings')
      .select('amount, host_payout_amount, platform_revenue, status, created_at')
      .in('status', ['PAID', 'confirmed', 'completed'])
      .then(({ data }) => { if (data) setServiceBookings(data); });
  }, [supabase]);

  // 달력 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  // 날짜 필터 (입력된 날짜가 dateRange 안에 있는지 정밀 검사)
  const filterDate = (dateString: string) => {
    if (!dateRange[0].startDate || !dateRange[0].endDate) return true;

    const target = new Date(dateString);
    const sd = startOfDay(dateRange[0].startDate);
    const ed = endOfDay(dateRange[0].endDate);

    return target >= sd && target <= ed;
  };

  // 🟢 [수정] 유효한 매출 데이터 필터링 (완료됨 + 취소됐는데 위약금 있는거)
  const validBookings = bookings.filter(b =>
    filterDate(b.created_at) &&
    (isCompletedBookingStatus(b.status) || (isCancelledOnlyBookingStatus(b.status) && (b.platform_revenue > 0 || b.host_payout_amount > 0)))
  );

  // 맞춤 의뢰 service_bookings KPI (date range 필터 적용)
  const validServiceBookings = serviceBookings.filter(b => filterDate(b.created_at));
  const svcRevenue = validServiceBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
  const svcPlatformFee = validServiceBookings.reduce((sum, b) => sum + (b.platform_revenue || 0), 0);
  const svcHostPayout = validServiceBookings.reduce((sum, b) => sum + (b.host_payout_amount || 0), 0);

  // 🟢 [수정] 매출/수익 계산 (DB 컬럼 기반) — 체험 + 맞춤 의뢰 합산
  const expRevenue = validBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
  const totalRevenue = expRevenue + svcRevenue;

  // 플랫폼 수익: platform_revenue 컬럼이 있으면 쓰고, 없으면(옛날데이터) 대충 계산
  const expPlatformFee = validBookings.reduce((sum, b) => {
    return sum + (b.platform_revenue || (b.amount - (b.host_payout_amount || (b.amount * 0.8))));
  }, 0);
  const platformFee = expPlatformFee + svcPlatformFee;

  const expHostPayout = validBookings.reduce((sum, b) => {
    return sum + (b.host_payout_amount || (b.amount * 0.8));
  }, 0);
  const hostPayout = expHostPayout + svcHostPayout;

  const allCount = validBookings.length + validServiceBookings.length;
  const averageOrderValue = allCount > 0 ? totalRevenue / allCount : 0;

  // 🟢 [핵심] 정산 예정 내역 계산 (위약금 포함)
  const calculateSettlements = () => {
    const settlementMap = new Map();

    // 정산 대상: 완료된 건 + 취소 위약금 건
    const targetBookings = bookings.filter(b =>
      isCompletedBookingStatus(b.status) || (isCancelledOnlyBookingStatus(b.status) && b.host_payout_amount > 0)
    );

    targetBookings.forEach(booking => {
      const hostId = booking.experiences?.host_id;
      if (!hostId) return;

      if (!settlementMap.has(hostId)) {
        const hostInfo = apps.find((a: any) => a.user_id === hostId);
        settlementMap.set(hostId, {
          id: hostId,
          hostName: hostInfo?.name || '알 수 없음',
          bank: hostInfo?.bank_name ? `${hostInfo.bank_name}` : '계좌 미등록',
          accountNumber: hostInfo?.account_number || '',
          accountHolder: hostInfo?.account_holder || '-',
          hostNationality: hostInfo?.host_nationality || '-',
          totalAmount: 0,
          count: 0,
          status: booking.payout_status || 'pending',
          bookings: []
        });
      }

      const current = settlementMap.get(hostId);

      // 🟢 [중요] 호스트 줄 돈 계산
      let payout = 0;
      if (booking.host_payout_amount > 0) {
        payout = booking.host_payout_amount; // 이미 계산된 값 사용 (위약금 포함)
      } else {
        payout = (booking.amount || 0) * 0.8; // 옛날 데이터용 (80%)
      }

      // 탭 구분에 따라 필터링 (지급완료된 건은 제외하거나 포함)
      if (settlementTab === 'PENDING' && booking.payout_status === 'paid') return;
      if (settlementTab === 'COMPLETED' && booking.payout_status !== 'paid') return;

      current.totalAmount += payout;
      current.count += 1;
      current.bookings.push({ ...booking, calculatedPayout: payout });
    });

    return Array.from(settlementMap.values()).filter((i: any) => i.count > 0);
  };

  const settlementList = calculateSettlements();

  const toggleExpand = (hostId: string) => {
    setExpandedHostId(prev => prev === hostId ? null : hostId);
  };

  const handleSettlePayout = async (hostId: string, bookingIds: string[]) => {
    if (!confirm(`이 호스트의 ${bookingIds.length}건 정산을 완료 처리하시겠습니까?`)) return;

    setIsProcessing(true);
    try {
      const res = await settleHostPayout(bookingIds);
      if (res.success) {
        showToast('성공적으로 정산 처리되었습니다.', 'success');
        if (onRefresh) onRefresh();
      } else {
        throw new Error(res.error || 'Server error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('정산 처리 실패: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadCSV = (item: any) => {
    try {
      // 국세청 해외송금 증빙용 포맷 (수기 입력란 포함)
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
        '비고(외국인신분증등_수기입력)'
      ];

      const rows = item.bookings.map((b: any) => {
        // 취소된 경우와 완료된 경우의 매출/위약금 계산
        const gross = b.amount || 0;
        let refundPenaltyAmount = 0; // 취소 위약금 발생액
        let fee = 0; // 플랫폼 수수료
        const net = b.calculatedPayout || 0; // 호스트 지급액

        if (isCancelledOnlyBookingStatus(b.status)) {
          refundPenaltyAmount = gross; // 취소되었는데 리스트에 들어왔다면 전액 위약금이거나 부분 위약금. 
          fee = gross - net;
        } else {
          fee = gross - net;
        }

        const expTitle = b.experiences?.title || '로컬 가이드 서비스';
        // 따옴표나 쉼표가 있을 수 있으므로 필드 보호 (CSV 이스케이프)
        const escapeCSV = (str: any) => `"${String(str).replace(/"/g, '""')}"`;

        return [
          escapeCSV(format(new Date(b.created_at), 'yyyy-MM-dd HH:mm')),
          escapeCSV(b.id),
          escapeCSV(item.accountHolder),
          escapeCSV(item.hostNationality),
          escapeCSV(item.bank),
          escapeCSV(item.accountNumber),
          escapeCSV(`플랫폼 로컬 체험/가이드 용역 (${expTitle})`),
          escapeCSV(b.profiles?.name || 'Unknown User'),
          gross,
          refundPenaltyAmount,
          fee,
          net,
          '""' // 수기입력란 (빈칸)
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map((row: any[]) => row.join(','))
      ].join('\n');

      // Excel에서 한글 깨짐을 방지하기 위해 UTF-8 BOM(Byte Order Mark) 추가
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `세무증빙_정산명세서_${item.hostName}_${format(new Date(), 'yyyyMMdd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('국세청 소명용 명세서(CSV) 다운로드가 시작되었습니다.', 'success');
    } catch (err) {
      console.error('CSV Gen Error:', err);
      showToast('CSV 생성 중 오류가 발생했습니다.', 'error');
    }
  };

  return (
    <div className="flex-1 space-y-4 md:space-y-8 overflow-y-auto p-1 md:p-2 animate-in fade-in zoom-in-95 duration-300">

      {/* 헤더 & 필터 */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 md:gap-0">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Wallet className="text-yellow-500 w-5 h-5 md:w-6 md:h-6" /> 매출 및 재무 현황
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1">기간별 매출 추이와 호스트 정산 내역을 관리합니다.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3 relative">
          {/* Preset Buttons */}
          <div className="bg-slate-100 p-1 rounded-lg flex text-[10px] md:text-xs font-bold overflow-x-auto scrollbar-hide shrink-0">
            {['1D', '7D', '30D', '3M', '1Y', 'ALL'].map(f => (
              <button
                key={f} onClick={() => handlePresetClick(f)}
                className={`flex-1 md:flex-none px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-all whitespace-nowrap ${activePreset === f ? 'bg-white shadow text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Custom Date Picker Toggle */}
          <div className="relative w-full sm:w-auto" ref={datePickerRef}>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center justify-center gap-2 w-full px-3 md:px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs md:text-sm font-medium hover:bg-slate-50 transition-colors shrink-0"
            >
              <CalendarIcon size={14} className="text-slate-400 md:w-4 md:h-4" />
              <span className="text-slate-700 md:min-w-[170px] text-center">
                {dateRange[0].startDate && dateRange[0].endDate
                  ? `${format(dateRange[0].startDate, 'yyyy.MM.dd')} ~ ${format(dateRange[0].endDate, 'yyyy.MM.dd')}`
                  : '기간 선택'}
              </span>
              <ChevronDown size={14} className="text-slate-400 ml-1 md:w-4 md:h-4" />
            </button>

            {/* Dropdown Calendar */}
            {showDatePicker && (
              <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="p-2 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <span className="text-xs font-bold text-slate-500 uppercase px-2">Custom Range</span>
                  <button onClick={() => setShowDatePicker(false)} className="text-xs text-slate-400 hover:text-slate-600 px-2 font-medium">Close</button>
                </div>
                <DateRange
                  editableDateInputs={true}
                  onChange={(item) => {
                    setDateRange([item.selection]);
                    setActivePreset('CUSTOM'); // 달력 조작 시 프리셋 해제
                  }}
                  moveRangeOnFirstSelection={false}
                  ranges={dateRange}
                  months={1}
                  direction="horizontal"
                  className="!border-0 text-xs md:text-sm"
                  rangeColors={['#0f172a']} // slate-900
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="총 거래액 (GMV)" value={`₩${totalRevenue.toLocaleString()}`} sub={`체험 ₩${expRevenue.toLocaleString()} | 의뢰 ₩${svcRevenue.toLocaleString()}`} icon={<DollarSign size={16} className="text-white md:w-5 md:h-5" />} bg="bg-slate-900" />
        <StatCard title="순매출 (Net Revenue)" value={`₩${platformFee.toLocaleString()}`} sub="플랫폼 수익 (수수료)" icon={<TrendingUp size={16} className="text-white md:w-5 md:h-5" />} bg="bg-blue-600" />
        <StatCard title="정산 예정금 (AP)" value={`₩${hostPayout.toLocaleString()}`} sub="호스트 지급액" icon={<CreditCard size={16} className="text-white md:w-5 md:h-5" />} bg="bg-purple-600" />
        <StatCard title="객단가 (AOV)" value={`₩${Math.round(averageOrderValue).toLocaleString()}`} sub="건당 평균 결제액" icon={<Wallet size={16} className="text-slate-900 md:w-5 md:h-5" />} bg="bg-yellow-400" text="text-slate-900" />
      </div>

      {/* 정산 리스트 */}
      <div className="bg-white rounded-xl md:rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center bg-slate-50 gap-4 sm:gap-0">
          <div className="flex gap-4 md:gap-6 border-b border-slate-200 sm:border-0">
            <button onClick={() => setSettlementTab('PENDING')} className={`font-bold text-xs md:text-sm pb-2 sm:pb-0 border-b-2 sm:border-b-2 sm:-mb-[17px] md:-mb-[25px] transition-all ${settlementTab === 'PENDING' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'}`}>정산 대기 (Pending)</button>
            <button onClick={() => setSettlementTab('COMPLETED')} className={`font-bold text-xs md:text-sm pb-2 sm:pb-0 border-b-2 sm:border-b-2 sm:-mb-[17px] md:-mb-[25px] transition-all ${settlementTab === 'COMPLETED' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'}`}>정산 완료 (History)</button>
          </div>
          {settlementTab === 'PENDING' && (
            <button className="bg-slate-900 text-white px-3 md:px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors w-full sm:w-auto">
              <CheckCircle size={14} /> 지급 실행
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm text-left min-w-[600px]">
            <thead className="bg-white text-slate-500 text-[10px] md:text-xs uppercase border-b border-slate-100">
              <tr>
                <th className="px-4 md:px-6 py-3 md:py-4">호스트 정보</th>
                <th className="px-4 md:px-6 py-3 md:py-4">지급 총액</th>
                <th className="px-4 md:px-6 py-3 md:py-4">계좌 정보</th>
                <th className="px-4 md:px-6 py-3 md:py-4">건수</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-right">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {settlementList.length > 0 ? settlementList.map((item: any, idx: number) => (
                <React.Fragment key={idx}>
                  <tr
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${expandedHostId === item.id ? 'bg-slate-50' : ''}`}
                    onClick={() => toggleExpand(item.id)}
                  >
                    <td className="px-4 md:px-6 py-3 md:py-4">
                      <div className="flex items-center gap-1 md:gap-2">
                        {expandedHostId === item.id ? <ChevronUp size={14} className="text-slate-400 md:w-4 md:h-4" /> : <ChevronRight size={14} className="text-slate-400 md:w-4 md:h-4" />}
                        <div>
                          <div className="font-bold text-slate-900 text-xs md:text-sm">{item.hostName}</div>
                          <div className="text-[10px] md:text-xs text-slate-400">{item.accountHolder}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 font-mono font-bold text-purple-600 text-xs md:text-sm">₩{item.totalAmount.toLocaleString()}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-slate-500 flex items-center gap-1 text-[10px] md:text-xs">
                      {item.bank === '계좌 미등록' ? <AlertTriangle size={12} className="text-red-500 md:w-3.5 md:h-3.5" /> : <CreditCard size={12} className="md:w-3.5 md:h-3.5" />}
                      {item.bank} {item.accountNumber}
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-slate-500 text-xs md:text-sm">{item.count}건</td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                      <span className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[9px] md:text-[10px] font-bold uppercase ${item.bank === '계좌 미등록' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>
                        {item.bank === '계좌 미등록' ? '계좌 필요' : (settlementTab === 'PENDING' ? '지급 대기' : '지급 완료')}
                      </span>
                    </td>
                  </tr>

                  {/* 상세 내역 아코디언 */}
                  {expandedHostId === item.id && (
                    <tr>
                      <td colSpan={5} className="bg-slate-50 p-0 border-b border-slate-100">
                        <div className="px-4 md:px-14 py-4 md:py-6 overflow-x-auto">
                          <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-3 md:mb-4 gap-3 sm:gap-0">
                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                              <Wallet size={16} className="text-slate-500" /> 세부 정산 내역
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {/* 향후 CSV 다운로드 / 지급 연결 등 */}
                              <button
                                onClick={() => handleDownloadCSV(item)}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 md:py-1.5 text-xs font-medium bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors shadow-sm w-full sm:w-auto"
                              >
                                <Download size={14} /> 명세서 다운로드
                              </button>
                              {settlementTab === 'PENDING' && (
                                <button
                                  onClick={() => handleSettlePayout(item.id, item.bookings.map((b: any) => b.id))}
                                  disabled={isProcessing}
                                  className={`flex items-center justify-center gap-1.5 px-3 py-2 md:py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg transition-colors shadow-sm w-full sm:w-auto ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-800'}`}
                                >
                                  <Check size={14} /> {isProcessing ? '처리 중...' : '일괄 지급 완료 처리'}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto shadow-sm">
                            <table className="w-full text-[10px] md:text-xs text-left min-w-[500px]">
                              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                                <tr>
                                  <th className="px-3 md:px-4 py-2 md:py-3">결제일</th>
                                  <th className="px-3 md:px-4 py-2 md:py-3">예약 ID</th>
                                  <th className="px-3 md:px-4 py-2 md:py-3">게스트</th>
                                  <th className="px-3 md:px-4 py-2 md:py-3">진행 상태</th>
                                  <th className="px-3 md:px-4 py-2 md:py-3 text-right">결제 금액</th>
                                  <th className="px-3 md:px-4 py-2 md:py-3 text-right text-purple-600">정산 대상액</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {item.bookings.map((b: any) => (
                                  <tr key={b.id} className="hover:bg-slate-50">
                                    <td className="px-3 md:px-4 py-2 md:py-3 text-slate-500">{format(new Date(b.created_at), 'yy.MM.dd')} <span className="text-[9px]">{format(new Date(b.created_at), 'HH:mm')}</span></td>
                                    <td className="px-3 md:px-4 py-2 md:py-3 font-mono text-slate-400">{b.id.split('-').pop()}</td>
                                    <td className="px-3 md:px-4 py-2 md:py-3 font-medium text-slate-700">{b.profiles?.name || 'Unknown'}</td>
                                    <td className="px-3 md:px-4 py-2 md:py-3">
                                      <span className={`px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[10px] font-bold uppercase ${isCompletedBookingStatus(b.status) ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                                        {isCompletedBookingStatus(b.status) ? '완료' : '위약금'}
                                      </span>
                                    </td>
                                    <td className="px-3 md:px-4 py-2 md:py-3 text-right text-slate-500">₩{(b.amount || 0).toLocaleString()}</td>
                                    <td className="px-3 md:px-4 py-2 md:py-3 text-right font-bold text-purple-600">₩{b.calculatedPayout.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )) : (
                <tr><td colSpan={5} className="px-4 md:px-6 py-8 md:py-10 text-center text-xs md:text-sm text-slate-400">내역이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// (StatCard 컴포넌트는 기존과 동일하되 비율 튜닝)
function StatCard({ title, value, sub, icon, bg, text = 'text-white' }: any) {
  return (
    <div className={`p-4 md:p-5 rounded-xl md:rounded-2xl shadow-sm border border-slate-100 bg-white flex flex-col justify-between h-28 md:h-32 relative overflow-hidden group w-full`}>
      <div className={`absolute top-4 right-4 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center ${bg} shadow-md group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <div className="text-[9px] md:text-xs font-bold text-slate-400 uppercase tracking-wider pr-10">{title}</div>
      <div>
        <div className={`text-lg md:text-2xl font-black ${text === 'text-white' ? 'text-slate-900' : text} tracking-tight truncate pr-8`}>{value}</div>
        <div className="text-[9px] md:text-[10px] text-slate-400 mt-0.5 md:mt-1 font-medium">{sub}</div>
      </div>
    </div>
  );
}
