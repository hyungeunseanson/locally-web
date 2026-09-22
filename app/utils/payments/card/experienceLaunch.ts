import type { createAdminClient } from '@/app/utils/supabase/admin';
import type { createClient as createServerClient } from '@/app/utils/supabase/server';

import type { CardPaymentProvider } from './types';

type ExperienceRelation =
  | { title?: string | null }
  | Array<{ title?: string | null }>
  | null;

type ExperienceCardLaunchBooking = {
  id: string;
  order_id: string;
  user_id: string | null;
  amount: number;
  status: string | null;
  tid: string | null;
  payment_method: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  payment_claim_state: string | null;
  payment_claim_expires_at: string | null;
  payment_provider: string | null;
  payment_provider_reference: string | null;
  experiences: ExperienceRelation;
};

type ExperienceCardLaunchFailureCode =
  | 'authentication_required'
  | 'booking_unavailable'
  | 'claim_invalid';

export type ExperienceCardLaunchResolution =
  | {
      ok: true;
      orderId: string;
      productName: string;
      amount: number;
      buyerName: string;
      buyerTel: string;
      buyerEmail: string;
    }
  | {
      ok: false;
      code: ExperienceCardLaunchFailureCode;
    };

function getExperienceTitle(relation: ExperienceRelation) {
  const row = Array.isArray(relation) ? relation[0] : relation;
  return String(row?.title || '').trim() || 'Locally 체험 예약';
}

export async function resolveExperienceCardLaunch(params: {
  supabaseServer: Awaited<ReturnType<typeof createServerClient>>;
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  requestedOrderId: string;
  provider: CardPaymentProvider;
  now?: Date;
}): Promise<ExperienceCardLaunchResolution> {
  const {
    data: { user },
    error: authError,
  } = await params.supabaseServer.auth.getUser();

  if (authError || !user) {
    return { ok: false, code: 'authentication_required' };
  }

  const requestedOrderId = params.requestedOrderId.trim();
  if (!requestedOrderId) {
    return { ok: false, code: 'booking_unavailable' };
  }

  const { data, error } = await params.supabaseAdmin
    .from('bookings')
    .select(
      'id, order_id, user_id, amount, status, tid, payment_method, contact_name, contact_phone, payment_claim_state, payment_claim_expires_at, payment_provider, payment_provider_reference, experiences(title)'
    )
    .eq('order_id', requestedOrderId)
    .maybeSingle();
  const booking = data as ExperienceCardLaunchBooking | null;

  if (error || !booking || booking.user_id !== user.id || booking.order_id !== requestedOrderId) {
    return { ok: false, code: 'booking_unavailable' };
  }

  const expectedReference = String(booking.order_id || booking.id).trim();
  const claimExpiresAt = Date.parse(String(booking.payment_claim_expires_at || ''));
  const now = (params.now || new Date()).getTime();
  const amount = Number(booking.amount);

  if (
    String(booking.status || '').toLowerCase() !== 'pending' ||
    booking.tid != null ||
    String(booking.payment_method || '').toLowerCase() !== 'card' ||
    booking.payment_claim_state !== 'processing' ||
    booking.payment_provider !== params.provider ||
    booking.payment_provider_reference !== expectedReference ||
    expectedReference !== requestedOrderId ||
    !Number.isFinite(claimExpiresAt) ||
    claimExpiresAt <= now ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return { ok: false, code: 'claim_invalid' };
  }

  return {
    ok: true,
    orderId: expectedReference,
    productName: getExperienceTitle(booking.experiences),
    amount,
    buyerName: String(booking.contact_name || ''),
    buyerTel: String(booking.contact_phone || ''),
    buyerEmail: String(user.email || ''),
  };
}
