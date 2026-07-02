import { revalidatePath } from 'next/cache';

import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { getBookingSettlementSnapshotForConfirmation } from '@/app/utils/bookingFinance';
import { notifyExperiencePaymentConfirmed } from '@/app/utils/experienceNotificationFlows';
import type { VerifiedCardPayment } from '@/app/utils/payments/card/types';
import { createAdminClient } from '@/app/utils/supabase/admin';

type ExperienceMeta = {
  price?: number | null;
  private_price?: number | null;
  max_guests?: number | null;
  host_id?: string | null;
  title?: string | null;
};

export type ExperienceCardBookingRow = {
  id: string;
  order_id: string | null;
  user_id: string | null;
  experience_id: string;
  status: string;
  payment_method: string | null;
  amount: number | null;
  total_price?: number | null;
  total_experience_price?: number | null;
  price_at_booking?: number | null;
  host_payout_amount?: number | null;
  platform_revenue?: number | null;
  refund_amount?: number | null;
  solo_guarantee_price?: number | null;
  solo_guarantee_refund_amount?: number | null;
  guests: number | null;
  type: string | null;
  date: string;
  time: string | null;
  contact_name: string | null;
  experiences?: ExperienceMeta | ExperienceMeta[] | null;
};

type ExperienceCardConfirmationResult =
  | {
      success: true;
      alreadyProcessed?: boolean;
    }
  | {
      success: false;
      status: number;
      error: string;
    };

export async function finalizeExperienceCardPayment(params: {
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  originalBooking: ExperienceCardBookingRow;
  verificationResult: VerifiedCardPayment;
}): Promise<ExperienceCardConfirmationResult> {
  const { supabaseAdmin, originalBooking, verificationResult } = params;
  const experienceMeta = Array.isArray(originalBooking.experiences)
    ? originalBooking.experiences[0]
    : originalBooking.experiences;

  const { data: existingBookings } = await supabaseAdmin
    .from('bookings')
    .select('id, guests, type')
    .eq('experience_id', originalBooking.experience_id)
    .eq('date', originalBooking.date)
    .eq('time', originalBooking.time)
    .neq('id', originalBooking.id)
    .in('status', [...BOOKING_ACTIVE_STATUS_FOR_CAPACITY]);

  const currentBookedCount =
    existingBookings?.reduce((sum, booking) => sum + Number(booking.guests || 0), 0) || 0;
  const hasPrivateBooking = existingBookings?.some((booking) => booking.type === 'private');
  const maxGuests = experienceMeta?.max_guests || 10;

  if (
    hasPrivateBooking ||
    (originalBooking.type === 'private' && currentBookedCount > 0) ||
    (originalBooking.type !== 'private' &&
      currentBookedCount + Number(originalBooking.guests || 0) > maxGuests)
  ) {
    return {
      success: false,
      status: 409,
      error: '잔여 좌석이 부족하여 예약을 확정할 수 없습니다.',
    };
  }

  const snapshot = getBookingSettlementSnapshotForConfirmation({
    ...originalBooking,
    amount: Number(originalBooking.amount || 0),
  });

  const { data: bookingData, error: updateError } = await supabaseAdmin
    .from('bookings')
    .update({
      status: 'PAID',
      payment_method: 'card',
      tid: verificationResult.providerTransactionId,
      price_at_booking: snapshot.basePrice,
      total_experience_price: snapshot.totalExperiencePrice,
      host_payout_amount: snapshot.hostPayout,
      platform_revenue: snapshot.platformRevenue,
      payout_status: 'pending',
    })
    .eq('id', originalBooking.id)
    .eq('status', 'PENDING')
    .select('*, experiences (host_id, title)')
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message || '결제 확정 업데이트에 실패했습니다.');
  }

  if (!bookingData) {
    return { success: true, alreadyProcessed: true };
  }

  const bookingExperienceMeta = Array.isArray(bookingData.experiences)
    ? bookingData.experiences[0]
    : bookingData.experiences;
  const expTitle = bookingExperienceMeta?.title || 'Locally 체험';
  const resolvedHostId = bookingExperienceMeta?.host_id;
  const guestName = bookingData.contact_name || '게스트';

  await notifyExperiencePaymentConfirmed({
    supabaseAdmin,
    guestId: bookingData.user_id || null,
    hostId: resolvedHostId || null,
    experienceId: bookingData.experience_id || originalBooking.experience_id || null,
    experienceTitle: expTitle,
    guestName,
    guestsCount: Number(bookingData.guests || 1),
    bookingDate: bookingData.date,
    bookingTime: bookingData.time || null,
    totalAmount: Number(bookingData.amount || originalBooking.amount || 0),
  });

  insertAdminAlerts({
    title: '체험 예약 결제가 완료되었습니다',
    message: `'${expTitle}' 예약 결제가 완료되었습니다. 게스트: ${guestName}`,
    link: '/admin/dashboard?tab=LEDGER',
  }).catch((adminAlertError) => {
    console.error('Booking Payment Admin Alert Error:', adminAlertError);
  });

  revalidatePath(`/experiences/${originalBooking.experience_id}`);

  return { success: true };
}
