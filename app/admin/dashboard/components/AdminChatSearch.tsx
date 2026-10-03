'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ADMIN_CHAT_SEARCH_DEBOUNCE_MS, ADMIN_CHAT_SEARCH_MIN_LENGTH, ADMIN_CHAT_SEARCH_MAX_LENGTH,
  ADMIN_CHAT_SEARCH_LIMIT, type AdminChatSearchResult, type AdminChatSearchSurface,
} from '@/app/utils/adminChatSearch';

type SearchState = { status: 'idle' | 'searching' | 'results' | 'empty' | 'error'; rows: AdminChatSearchResult[] };
const IDLE: SearchState = { status: 'idle', rows: [] };

export default function AdminChatSearch({ surface, enabled, onSelect }: {
  surface: AdminChatSearchSurface; enabled: boolean; onSelect: (id: string) => void;
}) {
  const [input, setInput] = useState('');
  const [state, setState] = useState<SearchState>(IDLE);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const query = input.trim();
  const eligible = query.length >= ADMIN_CHAT_SEARCH_MIN_LENGTH;
  const invalidate = () => { generation.current++; controller.current?.abort(); controller.current = null; };

  useEffect(() => {
    const version = ++generation.current;
    if (!enabled || !eligible) return;
    const flight = new AbortController();
    controller.current = flight;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams({ surface, q: query });
          const response = await fetch(`/api/admin/chat-search?${params}`, {
            cache: 'no-store', signal: AbortSignal.any([flight.signal, AbortSignal.timeout(15_000)]),
          });
          const result = await response.json();
          if (version !== generation.current || flight.signal.aborted) return;
          if (!response.ok || !result.success || !Array.isArray(result.data)) throw new Error('Search failed');
          const rows: AdminChatSearchResult[] = result.data.slice(0, ADMIN_CHAT_SEARCH_LIMIT);
          setState({ status: rows.length ? 'results' : 'empty', rows });
        } catch {
          if (version === generation.current && !flight.signal.aborted) setState({ status: 'error', rows: [] });
        }
      })();
    }, ADMIN_CHAT_SEARCH_DEBOUNCE_MS);
    return () => { clearTimeout(timer); flight.abort(); };
  }, [enabled, eligible, query, surface, attempt]);

  const change = (value: string) => {
    setInput(value);
    if (value.trim() === query) return;
    invalidate();
    setState(value.trim().length >= ADMIN_CHAT_SEARCH_MIN_LENGTH ? { status: 'searching', rows: [] } : IDLE);
  };
  const status = enabled && eligible ? state.status : 'idle';
  const label = surface === 'support' ? '1:1 문의 검색' : '전화예약 검색';
  return <div className="mt-2 min-w-0" data-testid="admin-chat-search" data-state={status}>
    <div className="flex gap-1">
      <input type="text" aria-label={label} value={input} maxLength={ADMIN_CHAT_SEARCH_MAX_LENGTH}
        onChange={event => change(event.target.value)} placeholder="ID·고객 이름·이메일·상품명"
        className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm" />
      {input && <button type="button" aria-label="검색 지우기" onClick={() => change('')}
        className="shrink-0 rounded-lg px-2 text-xs text-slate-500">지우기</button>}
    </div>
    <p className="mt-1 text-[10px] text-slate-500">{surface === 'support' ? '전체 1:1 문의' : '전체 전화예약'} · 목록 필터와 무관 · 2자 이상 · 최대 25개</p>
    <div role="status" aria-live="polite" className="text-xs text-slate-500">
      {status === 'searching' ? '검색 중...' : status === 'empty' ? '검색 결과가 없습니다.' : status === 'results' ? `${state.rows.length}개 검색 결과` : null}
    </div>
    {status === 'error' && <p role="alert" className="mt-1 text-xs text-red-600">검색하지 못했습니다. <button type="button" className="underline" onClick={() => {
      invalidate(); setState({ status: 'searching', rows: [] }); setAttempt(value => value + 1);
    }}>다시 시도</button></p>}
    {status === 'results' && <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200" aria-label={`${label} 결과`}>
      {state.rows.map(row => <button type="button" key={row.id} data-testid="admin-chat-search-result" onClick={() => onSelect(row.id)}
        className="block w-full min-w-0 border-b border-slate-100 px-2 py-2 text-left hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-500">
        <span className="block truncate text-xs font-bold" title={row.title || row.id}>{row.customer_name || row.customer_email || '고객'} · {row.title || (surface === 'support' ? '1:1 문의' : '전화예약')}</span>
        <span className="block truncate text-[10px] text-slate-500" title={row.id}>#{row.id}{row.customer_email ? ` · ${row.customer_email}` : ''}</span>
      </button>)}
    </div>}
  </div>;
}
