import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

import { insertAdminAlerts, sendAdminPaymentConfirmedEmail } from '@/app/utils/adminAlertCenter';
import { getBookingSettlementSnapshot } from '@/app/utils/bookingFinance';
import { notifyExperiencePaymentConfirmed } from '@/app/utils/experienceNotificationFlows';

import {
  confirmExperiencePaymentAtomic,
  type ExperiencePaymentProvider,
} from './experiencePaymentClaims';

type ExperienceMeta = {
  host_id?: string | null;
  title?: string | null;
};

export type ConfirmedExperiencePaymentBooking = {
  id: string;
  order_id: string | null;
  user_id: string | null;
  experience_id: string | number | null;
  status: string;
  payment_method: string | null;
  amount: number | null;
  total_price: number | null;
  total_experience_price: number | null;
  price_at_booking: number | null;
  host_payout_amount: number | null;
  platform_revenue: number | null;
  refund_amount: number | null;
  solo_guarantee_price: number | null;
  solo_guarantee_refund_amount: number | null;
  guests: number | null;
  date: string;
  time: string | null;
  contact_name: string | null;
  experiences?: ExperienceMeta | ExperienceMeta[] | null;
};

export async function confirmExperiencePayment(params: {
  supabaseAdmin: SupabaseClient;
  bookingId: string;
  provider: ExperiencePaymentProvider;
  providerReference: string;
  providerTransactionId: string;
  verifiedAmount: number;
}) {
  const outcome = await confirmExperiencePaymentAtomic(params);
  const { data, error } = await params.supabaseAdmin
    .from('bookings')
    .select('*, experiences(host_id, title)')
    .eq('id', params.bookingId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Confirmed experience payment could not be reloaded.');
  }

  return {
    outcome,
    booking: data as ConfirmedExperiencePaymentBooking,
  };
}

export async function runExperiencePaymentConfirmationSideEffects(params: {
  supabaseAdmin: SupabaseClient;
  booking: ConfirmedExperiencePaymentBooking;
  paymentMethod: 'card' | 'paypal';
}) {
  const { booking } = params;
  const experience = Array.isArray(booking.experiences)
    ? booking.experiences[0]
    : booking.experiences;
  const experienceTitle = experience?.title || 'Locally 체험';
  const guestName = booking.contact_name || '게스트';
  const snapshot = getBookingSettlementSnapshot(booking);

  await notifyExperiencePaymentConfirmed({
    supabaseAdmin: params.supabaseAdmin,
    guestId: booking.user_id || null,
    hostId: experience?.host_id || null,
    experienceId: booking.experience_id || null,
    experienceTitle,
    guestName,
    guestsCount: Number(booking.guests || 1),
    bookingDate: booking.date,
    bookingTime: booking.time || null,
    guestPaidAmount: Number(booking.amount || 0),
    hostBookingAmount: snapshot.totalExperiencePrice,
  });

  insertAdminAlerts({
    title: params.paymentMethod === 'paypal'
      ? '체험 예약 PayPal 결제가 완료되었습니다'
      : '체험 예약 결제가 완료되었습니다',
    message: `'${experienceTitle}' 예약 결제가 완료되었습니다. 게스트: ${guestName}`,
    link: '/admin/dashboard?tab=LEDGER',
  }).catch((error) => {
    console.error(JSON.stringify({
      event: 'experience_payment_side_effect',
      status: 'failed',
      diagnosticCode: 'admin_alert_failed',
    }));
    void error;
  });

  try {
    await sendAdminPaymentConfirmedEmail({
      domain: 'experience',
      title: experienceTitle,
      orderId: booking.order_id || booking.id,
      amount: Number(booking.amount || 0),
      paymentMethod: params.paymentMethod,
      link: '/admin/dashboard?tab=LEDGER',
      customerName: guestName,
    });
  } catch {
    console.error(JSON.stringify({
      event: 'experience_payment_side_effect',
      status: 'failed',
      diagnosticCode: 'admin_email_failed',
    }));
  }

  if (booking.experience_id != null) {
    revalidatePath(`/experiences/${booking.experience_id}`);
  }
}
