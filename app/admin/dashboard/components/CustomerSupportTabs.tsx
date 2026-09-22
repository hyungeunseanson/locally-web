'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ChatMonitor from './ChatMonitor';
import PhoneReservationTab from './PhoneReservationTab';

export default function CustomerSupportTabs() {
  const router = useRouter();
  const params = useSearchParams();
  const rawView = params.get('view');
  const view = rawView === 'phone' || rawView === 'monitor' ? rawView : 'support';
  const inquiryId = params.get('inquiryId');
  const [routingFailure, setRoutingFailure] = useState<{ id: string; message: string } | null>(null);
  const routingError = inquiryId && routingFailure?.id === inquiryId ? routingFailure.message : '';
  const [resolvedId, setResolvedId] = useState<string | null>(null);

  useEffect(() => {
    if (!inquiryId) return;
    const controller = new AbortController();
    void fetch(`/api/admin/inquiries?resolveOnly=true&inquiryId=${encodeURIComponent(inquiryId)}`, { signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.selection) throw new Error('연결된 문의를 확인할 수 없습니다.');
        const next = new URLSearchParams(params.toString());
        next.set('view', result.selection.view);
        if (result.selection.view === 'phone') {
          next.set('proxyRequestId', result.selection.proxyRequestId);
          next.delete('inquiryId');
        } else next.delete('proxyRequestId');
        setResolvedId(inquiryId);
        setRoutingFailure(null);
        if (next.toString() !== params.toString()) router.replace(`/admin/dashboard?${next}`, { scroll: false });
      }).catch(error => { if (!controller.signal.aborted) setRoutingFailure({ id: inquiryId, message: error.message }); });
    return () => controller.abort();
  }, [inquiryId, params, router]);

  const changeView = (nextView: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('view', nextView);
    next.delete('inquiryId');
    next.delete('proxyRequestId');
    setRoutingFailure(null);
    router.push(`/admin/dashboard?${next}`, { scroll: false });
  };
  const resolving = Boolean(inquiryId && resolvedId !== inquiryId);
  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    <nav aria-label="Customer Support" className="flex gap-1 rounded-xl bg-slate-100 p-1">
      {([['support', '1:1 문의'], ['phone', '전화예약'], ['monitor', '실시간 모니터링']] as const).map(([key, label]) =>
        <button key={key} aria-current={view === key ? 'page' : undefined} onClick={() => changeView(key)}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${view === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{label}</button>)}
    </nav>
    {routingError ? <p role="alert">{routingError}</p> : resolving ? <p>문의 위치를 확인하는 중...</p> : null}
    <div hidden={view === 'phone' || resolving || Boolean(routingError)}>
      <ChatMonitor view={view === 'monitor' ? 'monitor' : 'support'} enabled={view !== 'phone' && !resolving && !routingError} />
    </div>
    <div hidden={view !== 'phone' || resolving || Boolean(routingError)}>
      <PhoneReservationTab active={view === 'phone' && !resolving && !routingError} initialSelectedRequestId={params.get('proxyRequestId')} />
    </div>
  </div>;
}
