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
