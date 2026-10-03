'use client';

import { ChevronUp, ChevronDown, MoreHorizontal } from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import { CHAT_OPERATIONS_LABELS, adminConversationPermalink, type ChatOperationsFilters } from '@/app/utils/adminChatOperations';
import { formatAdminSyncTime, formatAdminListTime } from '@/app/utils/adminChatTime';
import type { AdminChatSync } from '../hooks/useAdminChatSync';

export function ChatOperationsFiltersControl({ value, onChange }: { value: ChatOperationsFilters; onChange: (value: ChatOperationsFilters) => void }) {
  return <div className="flex flex-wrap gap-x-3 gap-y-1 pt-2 text-[10px] text-slate-600" role="group" aria-label="운영 필터 (모두 충족)">
    {(Object.keys(CHAT_OPERATIONS_LABELS) as (keyof ChatOperationsFilters)[]).map(key => <label key={key} className="inline-flex cursor-pointer items-center gap-1">
      <input type="checkbox" checked={value[key]} onChange={event => onChange({ ...value, [key]: event.target.checked })}
        className="h-3 w-3 rounded border-slate-300 accent-slate-800" />{CHAT_OPERATIONS_LABELS[key]}
    </label>)}
  </div>;
}
export function ChatSyncStatus({ sync }: { sync: Pick<AdminChatSync, 'state' | 'lastSyncedAt'> }) {
  const labels = { connected: '실시간 연결됨', reconnecting: '연결 확인 중', offline: '오프라인', paused: '연결 대기' };
  return <div data-testid="admin-chat-sync" data-state={sync.state} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-slate-500">
    <span>{labels[sync.state]}</span>
    <span title={sync.lastSyncedAt ? formatAdminListTime(sync.lastSyncedAt) + ' (KST)' : undefined}>
      마지막 동기화 {sync.lastSyncedAt ? formatAdminSyncTime(sync.lastSyncedAt) + ' KST' : '대기'}
    </span>
  </div>;
}
export function ConversationNavigation({ navigation }: { navigation: { move: (direction: -1 | 1) => void; previous: string | null; next: string | null } }) {
  return <div className="flex shrink-0 items-center" aria-label="불러온 대화 이동">
    <button type="button" aria-label="이전 대화" aria-keyshortcuts="Alt+ArrowUp" title="이전 대화 (Alt + ↑)" disabled={!navigation.previous}
      onClick={() => navigation.move(-1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronUp size={16} /></button>
    <button type="button" aria-label="다음 대화" aria-keyshortcuts="Alt+ArrowDown" title="다음 대화 (Alt + ↓)" disabled={!navigation.next}
      onClick={() => navigation.move(1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronDown size={16} /></button>
  </div>;
}
export function useCopyConversation(inquiryId: number | string | null, view: 'support' | 'monitor' | 'phone', requestId?: string | null) {
  const { showToast } = useToast();
  return async (kind: 'id' | 'link') => {
    if (inquiryId == null) return;
    try {
      await navigator.clipboard.writeText(kind === 'id' ? String(inquiryId) : adminConversationPermalink(window.location.origin, inquiryId, view, requestId));
      showToast(kind === 'id' ? '문의 ID를 복사했습니다.' : '대화 링크를 복사했습니다.', 'success');
    } catch { showToast('복사하지 못했습니다. 클립보드 권한을 확인해주세요.', 'error'); }
  };
}
export function ConversationCopyMenu({ inquiryId, view }: { inquiryId: number | string; view: 'support' | 'monitor' }) {
  const copy = useCopyConversation(inquiryId, view);
  return <details className="relative shrink-0" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
    <summary aria-label="대화 메뉴" className="flex cursor-pointer list-none rounded p-1 text-slate-500 [&::-webkit-details-marker]:hidden"><MoreHorizontal size={18} /></summary>
    <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg" onClick={event => { if ((event.target as HTMLElement).closest('button')) event.currentTarget.closest('details')?.removeAttribute('open'); }}>
      <button type="button" onClick={() => void copy('id')} className="w-full rounded p-2 text-left text-xs hover:bg-slate-50">문의 ID 복사</button>
      <button type="button" onClick={() => void copy('link')} className="w-full rounded p-2 text-left text-xs hover:bg-slate-50">대화 링크 복사</button>
    </div>
  </details>;
}
