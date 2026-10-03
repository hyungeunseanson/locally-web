export type ChatOperationsFilters = { unseen: boolean; needsReply: boolean; reopened: boolean };
export const EMPTY_CHAT_OPERATIONS: ChatOperationsFilters = { unseen: false, needsReply: false, reopened: false };
export const CHAT_OPERATIONS_LABELS: Record<keyof ChatOperationsFilters, string> = {
  unseen: 'N만', needsReply: '답변 필요', reopened: '재문의',
};

export function readChatOperationsFilters(params: URLSearchParams): ChatOperationsFilters {
  return { unseen: params.get('unseen') === 'true', needsReply: params.get('needsReply') === 'true', reopened: params.get('reopened') === 'true' };
}
export function appendChatOperationsFilters(params: URLSearchParams, filters: ChatOperationsFilters) {
  for (const key of Object.keys(CHAT_OPERATIONS_LABELS) as (keyof ChatOperationsFilters)[]) {
    if (filters[key]) params.set(key, 'true');
  }
}
export function matchesChatOperations(row: { admin_unread_count?: number; needs_reply?: boolean; support_reopened_at?: string | null }, filters: ChatOperationsFilters) {
  return (!filters.unseen || Number(row.admin_unread_count ?? 0) > 0)
    && (!filters.needsReply || row.needs_reply === true)
    && (!filters.reopened || Boolean(row.support_reopened_at));
}

export function adminConversationPermalink(origin: string, inquiryId: number | string, view: 'support' | 'monitor' | 'phone', requestId?: string | null) {
  const url = new URL('/admin/dashboard', origin);
  url.searchParams.set('tab', 'CHATS');
  url.searchParams.set('view', view);
  if (view === 'phone' && requestId) url.searchParams.set('proxyRequestId', requestId);
  else url.searchParams.set('inquiryId', String(inquiryId));
  return url.href;
}
export function adjacentConversation(ids: string[], selectedId: string | null, direction: -1 | 1) {
  const index = selectedId == null ? -1 : ids.indexOf(selectedId);
  if (index < 0) return direction === 1 ? ids[0] ?? null : null;
  return ids[index + direction] ?? null;
}
