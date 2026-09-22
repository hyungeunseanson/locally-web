import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProxyRequest } from '@/app/types/proxy';
import { getProxyLinkedInquiryId, PROXY_CARD_ANCHOR_MARKER, PROXY_CARD_ANCHOR_VERSION } from '@/app/utils/proxyBooking';
import { isAdminSupportInquiry } from '@/app/utils/inquiry';
import type { PhoneWorkspaceRequest } from '@/app/utils/phoneReservationWorkspace';

// Same fail-closed operational exclusion as GET /api/proxy-bookings (PR #83).
export const FORMAL_PROXY_FILTER = `form_data->>${PROXY_CARD_ANCHOR_MARKER}.is.null,form_data->>${PROXY_CARD_ANCHOR_MARKER}.neq.${PROXY_CARD_ANCHOR_VERSION}`;
export const PROXY_SELECT = 'id,user_id,category,status,form_data,payment_channel,payment_status,naver_buyer_name,locally_order_id,agreed_to_terms,created_at,updated_at';
const BATCH = 100;
export type SupportInquiry = {
  id: string | number; user_id: string; type?: string | null;
  inquiry_messages?: { sender_id: string; content: string; type?: string | null }[];
};

export async function linkedRequests(db: SupabaseClient, inquiryIds: string[]) {
  const result: ProxyRequest[] = [];
  if (!inquiryIds.length) return result;
  for (let offset = 0; ; offset += BATCH) {
    const { data, error } = await db.from('proxy_requests').select(PROXY_SELECT)
      .or(FORMAL_PROXY_FILTER).in('form_data->>linked_inquiry_id', inquiryIds)
      .order('id').range(offset, offset + BATCH - 1);
    if (error) throw error;
    result.push(...(data as ProxyRequest[]));
    if (data.length < BATCH) return result;
  }
}

export function validLinkedRequest(inquiry: Pick<SupportInquiry, 'id' | 'user_id' | 'type'>, requests: ProxyRequest[]) {
  const matches = requests.filter(row => getProxyLinkedInquiryId(row.form_data) === String(inquiry.id));
  return matches.length === 1 && matches[0].user_id === inquiry.user_id && isAdminSupportInquiry(inquiry.type)
    ? matches[0] : null;
}

export async function enrichPhoneRequests(db: SupabaseClient, rows: ProxyRequest[]): Promise<PhoneWorkspaceRequest[]> {
  if (!rows.length) return [];
  const ids = [...new Set(rows.map(row => getProxyLinkedInquiryId(row.form_data)).filter((id): id is string => Boolean(id) && /^\d+$/.test(id!)))];
  const [profiles, inquiries, links] = await Promise.all([
    db.from('profiles').select('id,full_name,email,avatar_url,phone').in('id', [...new Set(rows.map(row => row.user_id))]),
    ids.length ? db.from('inquiries').select('id,user_id,type,inquiry_messages(sender_id,content,type,created_at,id)')
      .in('id', ids).or('type.is.null,type.in.(text,image)', { referencedTable: 'inquiry_messages' })
      .order('created_at', { referencedTable: 'inquiry_messages', ascending: false })
      .order('id', { referencedTable: 'inquiry_messages', ascending: false })
      .limit(1, { referencedTable: 'inquiry_messages' }) : Promise.resolve({ data: [], error: null }),
    linkedRequests(db, ids),
  ]);
  if (profiles.error) throw profiles.error;
  if (inquiries.error) throw inquiries.error;
  return rows.map(row => {
    const inquiry = (inquiries.data as SupportInquiry[]).find(item => String(item.id) === getProxyLinkedInquiryId(row.form_data));
    const linked = inquiry && validLinkedRequest(inquiry, links)?.id === row.id;
    const latest = linked ? inquiry.inquiry_messages?.[0] : undefined;
    const active = row.status === 'PENDING' || row.status === 'IN_PROGRESS';
    return {
      ...row,
      profiles: profiles.data?.find(profile => profile.id === row.user_id),
      linked_inquiry_id: linked ? String(inquiry.id) : null,
      needs_attention: !linked || (active && ['REFUNDED', 'FAILED'].includes(row.payment_status)),
      needs_reply: row.status === 'COMPLETED' && latest?.sender_id === row.user_id,
      latest_sender_id: latest?.sender_id ?? null,
      latest_content: latest?.content ?? null,
    };
  });
}

// Bound each DB read, but never truncate the searchable universe at 100 rows.
// Filtering precedes response pagination; only one matching page reaches the browser.
export async function filteredPage<T>(readBatch: (offset: number) => Promise<T[]>, matches: (row: T) => boolean, offset: number, limit: number) {
  const page: T[] = [];
  let matched = 0;
  for (let scan = 0; ; scan += BATCH) {
    const batch = await readBatch(scan);
    for (const row of batch) {
      if (!matches(row)) continue;
      if (matched++ < offset) continue;
      page.push(row);
      if (page.length > limit) return { data: page.slice(0, limit), pagination: { offset, limit, hasMore: true } };
    }
    if (batch.length < BATCH) return { data: page, pagination: { offset, limit, hasMore: false } };
  }
}
