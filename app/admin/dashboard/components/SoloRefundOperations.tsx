'use client';
import { useCallback, useEffect, useState } from 'react';

type Operation = { id: string; booking_id: string; provider: string; payment_method: string;
  requested_amount: number; outcome: string; diagnostic_code: string | null; delivery_state: string; settlement_applied_at: string | null };
export default function SoloRefundOperations() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [diagnostics, setDiagnostics] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState('');
  const [signedResponse, setSignedResponse] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/bookings/solo-guarantee-refund/operations?page=${page}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('환불 확인 목록을 가져오지 못했습니다.');
      const data = await response.json(); setOperations(data.operations); setDiagnostics(data.diagnostics || {}); setHasMore(data.hasMore === true);
    } catch { setMessage('환불 확인 목록을 가져오지 못했습니다. 새로고침해 주세요.'); }
  }, [page]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function act(action: 'reconcile_provider' | 'retry_rejected' | 'retry_delivery' | 'apply_accepted') {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/bookings/solo-guarantee-refund/operations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId: selectedId, action, signedResponse }),
      });
      if (!response.ok) throw new Error('증빙 또는 상태를 확인해 주세요. 미확정 환불은 계속 보류됩니다.');
      setMessage('환불 확인을 처리했습니다.'); setSignedResponse(''); setSelectedId(''); await refresh();
    } catch { setMessage('증빙 또는 상태를 확인해 주세요. 미확정 환불은 계속 보류됩니다.'); }
    finally { setBusy(false); }
  }
  const selected = operations.find(op => op.id === selectedId);
  return <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
    <div className="flex items-center justify-between"><h3 className="font-bold">1인 추가금 환불 확인</h3><button type="button" onClick={() => void refresh()} className="underline">새로고침</button></div>
    <p className="my-2">확인 필요 {diagnostics.reconciliation_required || 0} · 수동 환불 대기 {diagnostics.manual_pending || 0} · 알림 확인 필요 {diagnostics.delivery_failed || 0}</p>
    <p className="text-xs text-slate-600">외부 결과가 미확정인 예약은 재환불과 호스트 정산이 보류됩니다. 은행·PayPal 환불 완료는 예약 상세에서 참조값과 함께 기록하세요.</p>
    <ul className="my-3 space-y-2">{operations.map(op => <li key={op.id}>
      <button type="button" className="text-left underline" onClick={() => { setSelectedId(op.id); setSignedResponse(''); }}>
        예약 {op.booking_id} · {op.payment_method} · ₩{op.requested_amount.toLocaleString()} · {op.outcome}{op.diagnostic_code ? ` · ${op.diagnostic_code}` : ''}
      </button>
    </li>)}</ul>
    {(page > 0 || hasMore) && <div className="mb-3 flex gap-3">
      <button type="button" disabled={busy || page === 0} className="underline disabled:opacity-50" onClick={() => { setSelectedId(''); setSignedResponse(''); setPage(p => p - 1); }}>이전</button>
      <span>{page + 1} 페이지</span>
      <button type="button" disabled={busy || !hasMore} className="underline disabled:opacity-50" onClick={() => { setSelectedId(''); setSignedResponse(''); setPage(p => p + 1); }}>다음</button>
    </div>}
    {selected?.outcome === 'accepted' && !selected.settlement_applied_at &&
      <button disabled={busy} type="button" className="rounded border border-slate-400 bg-white px-3 py-2" onClick={() => void act('apply_accepted')}>확인된 외부 환불 장부 반영</button>}
    {selected && ['accepted', 'manual_pending'].includes(selected.outcome) && selected.delivery_state !== 'delivered' &&
      <button disabled={busy} type="button" className="rounded border border-slate-400 bg-white px-3 py-2" onClick={() => void act('retry_delivery')}>환불 상태 알림 다시 전달</button>}
    {selected && selected.payment_method === 'card' && selected.outcome !== 'accepted' && <div className="space-y-2 rounded-lg bg-white p-3">
      <p className="font-bold">예약 {selected.booking_id} · ₩{selected.requested_amount.toLocaleString()}</p>
      {selected.outcome === 'rejected' ? <><p>서명과 거래가 일치하는 확정 거절 기록이 있습니다. 재시도하면 외부 환불을 다시 요청합니다.</p>
        <button disabled={busy} type="button" className="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" onClick={() => void act('retry_rejected')}>확정 거절 확인 후 환불 재시도</button></>
        : <><label className="block font-bold">NICEPAY의 해당 환불 응답 증빙
          <textarea aria-label="NICEPAY 환불 응답 증빙" value={signedResponse} onChange={event => setSignedResponse(event.target.value)} maxLength={16384} className="mt-1 w-full rounded border p-2" />
        </label><p className="text-xs">거래·취소 주문번호·금액·서명이 일치하는 응답만 확인합니다. 성공은 장부에 반영하고, 확정 거절은 별도 재시도 전에 기록합니다. 결제 상태만으로는 확정하지 않습니다.</p>
          <button disabled={busy || !signedResponse.trim()} type="button" className="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" onClick={() => void act('reconcile_provider')}>응답 증빙 확인</button></>}
    </div>}
    {message && <p role="status" className="mt-2">{message}</p>}
  </section>;
}
