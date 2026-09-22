'use client';

import { useEffect, useRef } from 'react';
import type { ProxyRequest } from '@/app/types/proxy';
import { getProxyPaymentMethod, getProxyPaymentStatusLabel, getProxyRequestFeeKrw } from '@/app/utils/proxyBooking';

function paymentDate(value?: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short', hour12: false,
  }).format(new Date(value)) + ' (한국 시간)';
}

export default function PhonePaymentDetails({ request, onClose }: { request: ProxyRequest; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  const method = getProxyPaymentMethod(request.form_data);
  const entries = [
    ['결제 상태', getProxyPaymentStatusLabel(request)],
    ['결제 채널', request.payment_channel],
    ['결제 수단', request.payment_channel === 'NAVER' ? '네이버 주문' : method === 'card' ? '카드' : method === 'bank' ? '무통장 입금' : '—'],
    ['결제 금액', `₩${getProxyRequestFeeKrw(request.category, request.form_data).toLocaleString('ko-KR')}`],
    ['주문번호', request.locally_order_id || '—'],
    ['네이버 구매자명', request.naver_buyer_name || '—'],
    ['카드 거래번호', request.tid || '—'],
    ['결제일', paymentDate(request.paid_at)],
    ['환불일', paymentDate(request.refunded_at)],
  ];
  return <dialog ref={dialogRef} aria-labelledby="phone-payment-title" onClose={onClose}
    onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
    className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-black/40">
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="phone-payment-title" className="text-base font-bold">결제 상세</h2>
        <button autoFocus aria-label="결제 상세 닫기" className="rounded px-2 py-1 text-sm text-slate-500 focus-visible:outline-2" onClick={() => dialogRef.current?.close()}>닫기</button>
      </div>
      <dl className="space-y-3 text-sm">{entries.map(([label, value]) => <div key={label} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
        <dt className="text-slate-500">{label}</dt><dd className="min-w-0 break-words [overflow-wrap:anywhere]">{value}</dd>
      </div>)}</dl>
    </div>
  </dialog>;
}
