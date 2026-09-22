'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import ChatMonitor from './ChatMonitor';
import { useConfirmDialog } from '@/app/hooks/useConfirmDialog';
import { ChevronLeft, MoreHorizontal } from 'lucide-react';
import { getProxyCategoryLabel, getProxyPaymentMethod, getProxyPaymentStatusLabel, getProxyRequestTitle, getProxyRequesterDisplayName } from '@/app/utils/proxyBooking';
import { getPhoneAttentionLabel, PHONE_FILTER_LABELS, type PhoneFilter, type PhoneWorkspaceRequest } from '@/app/utils/phoneReservationWorkspace';

const PAGE_SIZE = 10;
const STATUS_LABELS = { PENDING: '대기', IN_PROGRESS: '진행 중', COMPLETED: '완료', CANCELLED: '취소' };

export default function PhoneReservationTab({ initialSelectedRequestId = null, active = true }: {
  initialSelectedRequestId?: string | null; active?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { showToast } = useToast();
  const { requestConfirm, ConfirmDialogElement } = useConfirmDialog();
  const [filter, setFilter] = useState<PhoneFilter>('todo');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [requests, setRequests] = useState<PhoneWorkspaceRequest[]>([]);
  const [detail, setDetail] = useState<PhoneWorkspaceRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [updating, setUpdating] = useState(false);
  const pages = useRef(1);
  const listVersion = useRef(0);
  const detailVersion = useRef(0);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const read = useCallback(async (url: string) => {
    const response = await fetch(url, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || '전화예약을 불러오지 못했습니다.');
    return result;
  }, []);

  const loadList = useCallback(async (more = false) => {
    if (!active) return;
    const version = ++listVersion.current;
    setLoading(true);
    setError('');
    try {
      const count = pages.current + (more ? 1 : 0);
      const rows: PhoneWorkspaceRequest[] = [];
      let nextHasMore = false;
      for (let page = 0; page < count; page++) {
        const searchParams = new URLSearchParams({ filter, q: query, offset: String(page * PAGE_SIZE), limit: String(PAGE_SIZE) });
        const result = await read(`/api/admin/customer-support?${searchParams}`);
        rows.push(...result.data);
        nextHasMore = result.pagination.hasMore;
        if (!nextHasMore) break;
      }
      if (version !== listVersion.current) return;
      pages.current = count;
      setRequests([...new Map(rows.map(row => [row.id, row])).values()]);
      setHasMore(nextHasMore);
    } catch (err) {
      if (version === listVersion.current) setError(err instanceof Error ? err.message : '목록 조회 실패');
    } finally {
      if (version === listVersion.current) setLoading(false);
    }
  }, [active, filter, query, read]);

  const loadDetail = useCallback(async () => {
    const version = ++detailVersion.current;
    if (!active || !initialSelectedRequestId) return;
    setDetailLoading(true);
    setDetailError('');
    try {
      const result = await read(`/api/admin/customer-support?requestId=${encodeURIComponent(initialSelectedRequestId)}`);
      if (version === detailVersion.current) setDetail(result.data);
    } catch (err) {
      if (version === detailVersion.current) {
        setDetail(null);
        setDetailError(err instanceof Error ? err.message : '상세 조회 실패');
      }
    } finally {
      if (version === detailVersion.current) setDetailLoading(false);
    }
  }, [active, initialSelectedRequestId, read]);

  useEffect(() => {
    pages.current = 1;
    void loadList();
    const version = listVersion;
    return () => { version.current++; };
  }, [loadList]);
  useEffect(() => {
    void loadDetail();
    const version = detailVersion;
    return () => { version.current++; };
  }, [loadDetail]);

  const refresh = useCallback(() => { void loadList(); void loadDetail(); }, [loadList, loadDetail]);
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(refresh, 350); };
    const channel = supabase.channel('admin-phone-workspace')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proxy_requests' }, schedule)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inquiry_messages' }, schedule)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inquiry_messages' }, payload => {
        if (payload.new.type === 'deleted') schedule();
      }).subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [active, refresh, supabase]);

  const select = (id: string | null) => {
    const next = new URLSearchParams(params.toString());
    next.set('view', 'phone');
    next.delete('inquiryId');
    if (id) next.set('proxyRequestId', id); else next.delete('proxyRequestId');
    router.push(`/admin/dashboard?${next}`, { scroll: false });
  };
  // Never show the previous customer's conversation while the next detail loads.
  const selected = detail?.id === initialSelectedRequestId ? detail : null;
  const attentionLabel = selected ? getPhoneAttentionLabel(selected) : null;
  const canComplete = Boolean(selected && !updating && selected.payment_status === 'COMPLETED' && ['PENDING', 'IN_PROGRESS'].includes(selected.status) && selected.linked_inquiry_id);
  const complete = async () => {
    if (!selected || !canComplete) return;
    setUpdating(true);
    try {
      const response = await fetch(`/api/proxy-bookings/${selected.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'COMPLETED' }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || '완료 처리에 실패했습니다.');
      refresh();
    } catch (err) { showToast(err instanceof Error ? err.message : '완료 처리 실패', 'error'); }
    finally { setUpdating(false); }
  };
  const paymentAction = async (action: 'confirm-payment' | 'cancel-payment' | 'refund-payment') => {
    if (!selected || updating) return;
    setUpdating(true);
    try {
      const response = await fetch(`/api/admin/proxy-bookings/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: selected.id }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || '결제 처리에 실패했습니다.');
      refresh();
    } catch (err) { showToast(err instanceof Error ? err.message : '결제 처리 실패', 'error'); }
    finally { setUpdating(false); }
  };
  const method = selected ? getProxyPaymentMethod(selected.form_data) : null;
  const manualPayment = selected?.payment_status === 'WAITING' && (selected.payment_channel === 'NAVER' || method === 'bank');
  const confirmPaymentAction = (action: 'cancel-payment' | 'refund-payment') => requestConfirm({
    title: action === 'refund-payment' ? '환불 처리' : '결제 취소',
    description: action === 'refund-payment' ? '이 전화예약 결제를 환불 처리할까요?' : '이 전화예약 결제를 취소할까요?',
    confirmLabel: '확인', tone: 'red',
  }, () => paymentAction(action));
  const toolbar = <div data-testid="admin-phone-chat-header" className="relative flex shrink-0 items-center gap-2 border-b border-slate-100 bg-slate-50/30 p-3 md:p-4">
    <button aria-label="목록으로" onClick={() => select(null)} className="shrink-0 rounded-full bg-slate-100 p-1.5 text-slate-500 md:hidden"><ChevronLeft size={18} /></button>
    {detailError ? <p role="alert" className="text-xs">{detailError}</p> : !selected ? <p className="text-xs">{detailLoading ? '상세를 불러오는 중...' : '전화예약을 선택해주세요.'}</p> : <>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-xs font-bold text-slate-900 md:text-lg">{getProxyRequesterDisplayName(selected.profiles)}</h2>
        <p className="truncate text-[8px] font-medium text-slate-500 md:text-[11px]" title={getProxyRequestTitle(selected)}>{getProxyRequestTitle(selected)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-[8px] md:text-[10px]">
        <span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5">{STATUS_LABELS[selected.status]}</span>
        <span className="text-slate-500">{getProxyPaymentStatusLabel(selected)}</span>
        {attentionLabel && <span className="whitespace-nowrap text-amber-700">{attentionLabel}</span>}
      </div>
      {(canComplete || manualPayment || selected.payment_status === 'COMPLETED') && <details key={selected.id} className="relative shrink-0" onKeyDown={event => {
        if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); }
      }}>
        <summary aria-label="전화예약 업무 메뉴" className="flex cursor-pointer list-none rounded-full p-1.5 text-slate-500 focus-visible:outline-2 focus-visible:outline-slate-400 [&::-webkit-details-marker]:hidden"><MoreHorizontal size={18} /></summary>
        <div className="absolute right-0 top-full z-20 mt-2 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg" onClick={event => {
          if ((event.target as HTMLElement).closest('button')) event.currentTarget.closest('details')?.removeAttribute('open');
        }}>
          {canComplete && <button disabled={updating} className="w-full rounded p-2 text-left text-xs hover:bg-slate-50 disabled:opacity-50" onClick={() => requestConfirm({ title: '처리 완료', description: '이 전화예약 업무를 완료 처리할까요?', confirmLabel: '완료 처리' }, complete)}>처리 완료</button>}
          {manualPayment && <button disabled={updating} className="w-full rounded p-2 text-left text-xs hover:bg-slate-50 disabled:opacity-50" onClick={() => void paymentAction('confirm-payment')}>입금 확인</button>}
          {manualPayment && <button disabled={updating} className="w-full rounded p-2 text-left text-xs text-rose-700 hover:bg-slate-50 disabled:opacity-50" onClick={() => confirmPaymentAction('cancel-payment')}>결제 취소</button>}
          {selected.payment_status === 'COMPLETED' && <button disabled={updating} className="w-full rounded p-2 text-left text-xs text-rose-700 hover:bg-slate-50 disabled:opacity-50" onClick={() => confirmPaymentAction('refund-payment')}>환불 처리</button>}
        </div>
      </details>}
    </>}
  </div>;

  return <div className="grid h-[calc(100dvh-235px)] min-h-[460px] grid-cols-1 gap-3 md:grid-cols-[minmax(230px,30%)_minmax(0,1fr)]">
    <section className={`${initialSelectedRequestId ? 'hidden md:flex' : 'flex'} min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200`}>
      <div className="space-y-2 border-b border-slate-200 px-3 py-2">
        <div className="flex items-center justify-between"><h2 className="font-bold">전화예약</h2><button data-testid="admin-phone-reservation-refresh-button" disabled={loading} className="text-xs" onClick={refresh}>새로고침</button></div>
        <input aria-label="전화예약 검색" value={search} onChange={event => setSearch(event.target.value)} placeholder="고객·업체·요청번호 검색" className="h-[44px] w-full rounded-lg border border-slate-200 px-3 text-sm" />
        <div className="flex flex-wrap gap-1">{Object.entries(PHONE_FILTER_LABELS).map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key as PhoneFilter)} className={`rounded-full border border-slate-200 px-2 py-1 text-xs ${filter === key ? 'bg-slate-900 text-white' : ''}`}>{label}</button>)}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto" data-testid="admin-phone-reservation-list">
        {error && <p role="alert" className="p-3">{error}</p>}
        {!loading && !error && !requests.length && <p className="p-4 text-sm text-slate-500">해당하는 전화예약이 없습니다.</p>}
        {requests.map(row => <button key={row.id} data-testid="admin-phone-reservation-list-item" onClick={() => select(row.id)} className={`w-full space-y-1 border-b border-slate-200 px-3 py-3 text-left ${row.id === initialSelectedRequestId ? 'bg-blue-50' : ''}`}>
          <p className="flex items-center justify-between gap-2 text-xs text-slate-500"><span className="min-w-0 truncate">{getProxyCategoryLabel(row.category)}</span><span className="shrink-0">{STATUS_LABELS[row.status]}</span></p>
          <p className="flex gap-1 text-sm font-bold"><span className="min-w-0 truncate" title={getProxyRequestTitle(row)}>{getProxyRequestTitle(row)}</span><span className="max-w-[40%] shrink-0 truncate">· {getProxyRequesterDisplayName(row.profiles)}</span></p>
          <p className="flex items-baseline gap-1 text-xs text-slate-500"><span className="shrink-0">{getProxyPaymentStatusLabel(row)}</span><span aria-hidden="true">·</span><span className="min-w-0 truncate">{row.latest_content}</span></p>
          {row.needs_reply && <span className="text-xs font-bold text-blue-700">추가 답장 </span>}
          {row.needs_attention && <span className="text-xs font-bold text-amber-700">{getPhoneAttentionLabel(row)}</span>}
        </button>)}
        {loading && <p className="p-3 text-sm">불러오는 중...</p>}
        {hasMore && <button disabled={loading} data-testid="admin-phone-reservation-load-more-button" onClick={() => void loadList(true)} className="w-full p-3 text-sm">더 보기</button>}
      </div>
    </section>
    <section className={`${initialSelectedRequestId ? 'flex' : 'hidden md:flex'} min-h-0 min-w-0 flex-col`}>
      <ChatMonitor enabled={active && Boolean(selected?.linked_inquiry_id)} phoneContext={{
        inquiryId: selected?.linked_inquiry_id || null, toolbar, onSent: refresh,
      }} />
    </section>
    {ConfirmDialogElement}
  </div>;
}
