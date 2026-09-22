import type { ProxyCategory, ProxyRequest } from '@/app/types/proxy';
import { getProxyFormDisplayEntries, isProxyCardPaymentAnchor } from './proxyBooking';

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

const CORE_FIELDS: Record<ProxyCategory, string[]> = {
  RESTAURANT: ['restaurant_name', 'restaurant_phone', 'google_map_url', 'target_date', 'preferred_slot_primary', 'preferred_slot_secondary', 'preferred_slot_tertiary', 'preferred_time_primary', 'preferred_time_secondary', 'guest_number', 'reservation_name', 'request_notes'],
  HOTEL: ['property_name', 'property_phone', 'property_link', 'reservation_number', 'checkin_date', 'checkout_date', 'hotel_inquiry_type', 'request_content', 'desired_change'],
  TRANSPORT: ['use_date', 'use_time', 'departure_location', 'arrival_location', 'passenger_number', 'baggage_count', 'flight_number', 'accommodation_reference'],
  GENERAL: ['business_name', 'business_phone', 'business_link', 'inquiry_content', 'preferred_check_time'],
  LOST_AND_FOUND: ['location_name', 'location_phone', 'location_link', 'lost_date', 'lost_time_window', 'item_type', 'item_description', 'last_seen_context', 'request_content'],
};

export function getPhoneFormSections(request: Pick<ProxyRequest, 'category' | 'form_data'>) {
  const entries = getProxyFormDisplayEntries(request.form_data);
  const keys = CORE_FIELDS[request.category];
  return {
    core: keys.flatMap(key => entries.filter(entry => entry.key === key)),
    other: entries.filter(entry => !keys.includes(entry.key)),
  };
}
