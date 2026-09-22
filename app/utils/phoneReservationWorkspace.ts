import type { ProxyRequest } from '@/app/types/proxy';
import { isProxyCardPaymentAnchor } from './proxyBooking';

export type PhoneFilter = 'todo' | 'payment' | 'closed' | 'all';
export type PhoneWorkspaceRequest = ProxyRequest & {
  linked_inquiry_id: string | null;
  needs_attention: boolean;
  needs_reply: boolean;
  latest_sender_id: string | null;
  latest_content: string | null;
};

export const PHONE_FILTER_LABELS: Record<PhoneFilter, string> = {
  todo: '처리할 일', payment: '결제 대기', closed: '종료', all: '전체',
};

export function matchesPhoneFilter(request: PhoneWorkspaceRequest, filter: PhoneFilter) {
  if (isProxyCardPaymentAnchor(request)) return false;
  const active = request.status === 'PENDING' || request.status === 'IN_PROGRESS';
  if (filter === 'todo') return request.needs_attention || request.needs_reply || (active && request.payment_status === 'COMPLETED');
  if (filter === 'payment') return active && request.payment_status === 'WAITING';
  if (filter === 'closed') return !active && !request.needs_reply && !request.needs_attention;
  return true;
}

/** Display only: keep the server's attention/filter decision authoritative. */
export function getPhoneAttentionLabel(request: Pick<PhoneWorkspaceRequest, 'needs_attention' | 'linked_inquiry_id' | 'status' | 'payment_status'>): string | null {
  if (!request.needs_attention) return null;
  // The server normalizes missing, broken and wrong-customer links to null.
  if (!request.linked_inquiry_id) return '문의 연결 확인 필요';
  if (request.status === 'PENDING' || request.status === 'IN_PROGRESS') {
    if (request.payment_status === 'REFUNDED') return '환불 후 예약 상태 확인';
    if (request.payment_status === 'FAILED') return '결제 취소 후 예약 상태 확인';
  }
  return null;
}
