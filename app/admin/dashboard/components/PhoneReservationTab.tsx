'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import ChatMonitor from './ChatMonitor';
import { getProxyCategoryLabel, getProxyPaymentMethod, getProxyPaymentStatusLabel, getProxyRequestFeeKrw, getProxyRequestTitle, getProxyRequesterDisplayName } from '@/app/utils/proxyBooking';
import { getPhoneFormSections, PHONE_FILTER_LABELS, type PhoneFilter, type PhoneWorkspaceRequest } from '@/app/utils/phoneReservationWorkspace';

const PAGE_SIZE = 10;
const STATUS_LABELS = { PENDING: '대기', IN_PROGRESS: '진행 중', COMPLETED: '완료', CANCELLED: '취소' };

export default function PhoneReservationTab({ initialSelectedRequestId = null, active = true }: {
  initialSelectedRequestId?: string | null; active?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { showToast } = useToast();
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
  const canComplete = Boolean(selected && !updating && selected.payment_status === 'COMPLETED' && ['PENDING', 'IN_PROGRESS'].includes(selected.status) && selected.linked_inquiry_id);
  const complete = async () => {
    if (!selected) throw new Error('요청을 먼저 선택해주세요.');
    const response = await fetch(`/api/proxy-bookings/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'COMPLETED' }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || '완료 처리에 실패했습니다.');
    refresh();
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
  const sections = selected ? getPhoneFormSections(selected) : null;
  const method = selected ? getProxyPaymentMethod(selected.form_data) : null;
  const manualPayment = selected?.payment_status === 'WAITING' && (selected.payment_channel === 'NAVER' || method === 'bank');
  const showEntries = (entries: NonNullable<typeof sections>['core']) => entries.map(entry => <div key={entry.key} className="min-w-0" data-testid="admin-phone-reservation-form-entry">
    <dt className="text-xs text-slate-500">{entry.label}</dt>
    <dd className="break-words whitespace-pre-wrap text-sm text-slate-900">{entry.value}
      {/phone$/.test(entry.key) && <button className="ml-2 text-xs underline" onClick={() => void navigator.clipboard.writeText(entry.value).then(() => showToast('전화번호를 복사했습니다.', 'success')).catch(() => showToast('복사하지 못했습니다.', 'error'))}>복사</button>}
      {/^(https?:\/\/)/i.test(entry.value) && <a className="ml-2 text-xs underline" href={entry.value} target="_blank" rel="noopener noreferrer">열기</a>}
    </dd>
  </div>);
  const header = <div className="space-y-3">
    <button onClick={() => select(null)} className="text-sm text-slate-600 md:hidden">← 목록으로</button>
    {detailError ? <p role="alert">{detailError}</p> : !selected ? <p>{detailLoading ? '상세를 불러오는 중...' : '전화예약을 선택해주세요.'}</p> : <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">{getProxyRequestTitle(selected)} · {getProxyRequesterDisplayName(selected.profiles)}</h2>
        <span className="text-xs">{STATUS_LABELS[selected.status]}{selected.needs_reply ? ' · 추가 답장' : ''}{selected.needs_attention ? ' · 확인 필요' : ''}</span>
      </div>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="admin-phone-reservation-form-section">{sections && showEntries(sections.core)}</dl>
      {sections && sections.other.length > 0 && <details><summary className="cursor-pointer text-xs font-semibold">신청서 전체 보기</summary><dl className="mt-2 grid gap-2 sm:grid-cols-2">{showEntries(sections.other)}</dl></details>}
      <div className="flex flex-wrap items-center gap-3 border-t pt-2 text-sm">
        <span>{getProxyPaymentStatusLabel(selected)} · ₩{getProxyRequestFeeKrw(selected.category, selected.form_data).toLocaleString()} · {selected.payment_channel === 'NAVER' ? 'NAVER' : method === 'card' ? '카드' : '무통장'}</span>
        {manualPayment && <button disabled={updating} onClick={() => void paymentAction('confirm-payment')} className="rounded-lg bg-slate-900 px-3 py-1 text-white disabled:opacity-50">입금 확인</button>}
      </div>
      {selected.payment_status === 'WAITING' && method === 'card' && <p className="text-xs text-amber-800">카드 결제 확인 전에는 완료할 수 없습니다.</p>}
      <details className="text-xs"><summary className="cursor-pointer text-slate-500">결제 상세</summary>
        <div className="mt-2 space-y-2"><p>주문번호: {selected.locally_order_id || '—'}</p><p>네이버 구매자명: {selected.naver_buyer_name || '—'}</p>
          {manualPayment && <button disabled={updating} className="text-rose-700 underline" onClick={() => void paymentAction('cancel-payment')}>결제 취소</button>}
          {selected.payment_status === 'COMPLETED' && <button disabled={updating} className="text-rose-700 underline" onClick={() => void paymentAction('refund-payment')}>환불 처리</button>}
        </div>
      </details>
      {!selected.linked_inquiry_id && <p role="alert" className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">확인 필요: 고객 문의 연결을 확인해주세요. 이 상태에서는 답변하거나 완료할 수 없습니다.</p>}
    </>}
  </div>;

  return <div className="grid h-[calc(100dvh-235px)] min-h-[460px] grid-cols-1 gap-3 md:grid-cols-[minmax(230px,30%)_minmax(0,1fr)]">
    <section className={`${initialSelectedRequestId ? 'hidden md:flex' : 'flex'} min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200`}>
      <div className="space-y-2 border-b p-3">
        <div className="flex items-center justify-between"><h2 className="font-bold">전화예약</h2><button data-testid="admin-phone-reservation-refresh-button" disabled={loading} className="text-xs" onClick={refresh}>새로고침</button></div>
        <input aria-label="전화예약 검색" value={search} onChange={event => setSearch(event.target.value)} placeholder="고객·업체·요청번호 검색" className="w-full rounded-lg border p-2 text-sm" />
        <div className="flex flex-wrap gap-1">{Object.entries(PHONE_FILTER_LABELS).map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key as PhoneFilter)} className={`rounded-full border px-2 py-1 text-xs ${filter === key ? 'bg-slate-900 text-white' : ''}`}>{label}</button>)}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto" data-testid="admin-phone-reservation-list">
        {error && <p role="alert" className="p-3">{error}</p>}
        {!loading && !error && !requests.length && <p className="p-4 text-sm text-slate-500">해당하는 전화예약이 없습니다.</p>}
        {requests.map(row => <button key={row.id} data-testid="admin-phone-reservation-list-item" onClick={() => select(row.id)} className={`w-full border-b p-3 text-left ${row.id === initialSelectedRequestId ? 'bg-blue-50' : ''}`}>
          <p className="text-xs text-slate-500">{getProxyCategoryLabel(row.category)} · {STATUS_LABELS[row.status]}</p>
          <p className="truncate text-sm font-bold">{getProxyRequestTitle(row)} · {getProxyRequesterDisplayName(row.profiles)}</p>
          <p className="text-xs text-slate-500">{getProxyPaymentStatusLabel(row)}</p>
          <p className="line-clamp-1 text-xs text-slate-500">{row.latest_content}</p>
          {row.needs_reply && <span className="text-xs font-bold text-blue-700">추가 답장 </span>}
          {row.needs_attention && <span className="text-xs font-bold text-amber-700">확인 필요</span>}
        </button>)}
        {loading && <p className="p-3 text-sm">불러오는 중...</p>}
        {hasMore && <button disabled={loading} data-testid="admin-phone-reservation-load-more-button" onClick={() => void loadList(true)} className="w-full p-3 text-sm">더 보기</button>}
      </div>
    </section>
    <section className={`${initialSelectedRequestId ? 'flex' : 'hidden md:flex'} min-h-0 min-w-0 flex-col`}>
      <ChatMonitor enabled={active && Boolean(selected?.linked_inquiry_id)} phone={{
        inquiryId: selected?.linked_inquiry_id || null, header, canComplete, onComplete: complete, onSent: refresh,
      }} />
    </section>
  </div>;
}
