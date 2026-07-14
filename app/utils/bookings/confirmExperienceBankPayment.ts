import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

import { insertAdminAlerts, sendAdminPaymentConfirmedEmail } from '@/app/utils/adminAlertCenter';
import { getBookingSettlementSnapshotForConfirmation } from '@/app/utils/bookingFinance';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { getHostBookingMessageHref } from '@/app/utils/hostBookingMessageLink';
import { notifyMembershipMilestone } from '@/app/utils/memberMilestoneNotifications';
import { buildLocalizedNotificationInsert } from '@/app/utils/notificationCopy';
import { isPendingBookingStatus } from '@/app/constants/bookingStatus';

type BookingExperienceMetaRow = {
  title: string | null;
  host_id: string | null;
};

type ConfirmExperienceBankPaymentBookingRow = {
  id: string;
  order_id: string | null;
  experience_id: number | null;
  user_id: string | null;
  amount: number | null;
  total_price: number | null;
  total_experience_price: number | null;
  price_at_booking: number | null;
  host_payout_amount?: number | null;
  platform_revenue?: number | null;
  refund_amount?: number | null;
  solo_guarantee_price: number | null;
  solo_guarantee_refund_amount?: number | null;
  status: string;
  payment_method: string | null;
  contact_name: string | null;
  guests: number | null;
  date: string | null;
  time: string | null;
  experiences: BookingExperienceMetaRow | BookingExperienceMetaRow[] | null;
};

type ConfirmedExperienceBankPaymentBooking = Omit<ConfirmExperienceBankPaymentBookingRow, 'experiences'> & {
  status: 'confirmed';
  payout_status: 'pending';
  host_payout_amount: number;
  platform_revenue: number;
  experiences: BookingExperienceMetaRow | null;
};

type ConfirmExperienceBankPaymentSnapshot = ReturnType<typeof getBookingSettlementSnapshotForConfirmation>;

type ConfirmExperienceBankPaymentFailure = {
  success: false;
  status: 400 | 404 | 409;
  error: string;
};

export type ConfirmExperienceBankPaymentSuccess = {
  success: true;
  alreadyProcessed: boolean;
  booking: ConfirmedExperienceBankPaymentBooking;
  experience: BookingExperienceMetaRow | null;
  guestDisplayName: string;
  snapshot: ConfirmExperienceBankPaymentSnapshot;
};

export type ConfirmExperienceBankPaymentResult =
  | ConfirmExperienceBankPaymentFailure
  | ConfirmExperienceBankPaymentSuccess;

function normalizeExperienceMeta(
  experience: ConfirmExperienceBankPaymentBookingRow['experiences']
): BookingExperienceMetaRow | null {
  if (Array.isArray(experience)) {
    return experience[0] || null;
  }

  return experience || null;
}

async function resolveGuestDisplayName(
  supabaseAdmin: SupabaseClient,
  booking: ConfirmExperienceBankPaymentBookingRow
) {
  const fallbackName = booking.contact_name || '게스트';

  if (!booking.user_id) {
    return fallbackName;
  }

  try {
    const { data: guestProfile, error } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', booking.user_id)
      .maybeSingle();

    if (error) {
      console.error('[experience bank confirm] guest profile lookup failed:', error);
      return fallbackName;
    }

    return guestProfile?.full_name || fallbackName;
  } catch (error) {
    console.error('[experience bank confirm] guest profile lookup threw:', error);
    return fallbackName;
  }
}

export async function confirmExperienceBankPayment(
  supabaseAdmin: SupabaseClient,
  bookingId: unknown
): Promise<ConfirmExperienceBankPaymentResult> {
  if (typeof bookingId !== 'string' || !bookingId.trim()) {
    return { success: false, status: 400, error: 'bookingId is required' };
  }

  const normalizedBookingId = bookingId.trim();
  const { data: bookingRaw, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .select(`
      id,
      order_id,
      experience_id,
      user_id,
      amount,
      total_price,
      total_experience_price,
      price_at_booking,
      refund_amount,
      solo_guarantee_price,
      solo_guarantee_refund_amount,
      status,
      payment_method,
      contact_name,
      guests,
      date,
      time,
      experiences(title, host_id)
    `)
    .eq('id', normalizedBookingId)
    .maybeSingle();

  const booking = bookingRaw as ConfirmExperienceBankPaymentBookingRow | null;

  if (bookingError || !booking) {
    return { success: false, status: 404, error: '예약 정보를 찾을 수 없습니다.' };
  }

  if (!isPendingBookingStatus(booking.status)) {
    return {
      success: false,
      status: 409,
      error: '현재 상태에서는 입금 확인할 수 없습니다.',
    };
  }

  if (booking.payment_method !== 'bank') {
    return {
      success: false,
      status: 409,
      error: '무통장 예약만 입금 확인할 수 있습니다.',
    };
  }

  const experience = normalizeExperienceMeta(booking.experiences);
  const snapshot = getBookingSettlementSnapshotForConfirmation({
    ...booking,
    amount: Number(booking.amount || 0),
  });
  const guestDisplayName = await resolveGuestDisplayName(supabaseAdmin, booking);

  const { data: updatedRow, error: updateError } = await supabaseAdmin
    .from('bookings')
    .update({
      status: 'confirmed',
      price_at_booking: snapshot.basePrice,
      total_experience_price: snapshot.totalExperiencePrice,
      host_payout_amount: snapshot.hostPayout,
      platform_revenue: snapshot.platformRevenue,
      payout_status: 'pending',
    })
    .eq('id', normalizedBookingId)
    .eq('status', booking.status)
    .select('id')
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }

  const confirmedBooking: ConfirmedExperienceBankPaymentBooking = {
    ...booking,
    status: 'confirmed',
    payout_status: 'pending',
    host_payout_amount: snapshot.hostPayout,
    platform_revenue: snapshot.platformRevenue,
    price_at_booking: snapshot.basePrice,
    total_experience_price: snapshot.totalExperiencePrice,
    experiences: experience,
  };

  return {
    success: true,
    alreadyProcessed: !updatedRow,
    booking: confirmedBooking,
    experience,
    guestDisplayName,
    snapshot,
  };
}

export async function runExperienceBankConfirmSideEffects(
  supabaseAdmin: SupabaseClient,
  result: ConfirmExperienceBankPaymentSuccess
) {
  const { booking, experience, guestDisplayName } = result;

  if (!experience) {
    console.error('[experience bank confirm] experience not found for booking:', booking.id);
    if (booking.experience_id != null) {
      revalidatePath(`/experiences/${booking.experience_id}`);
    }
    return;
  }

  const hostId = experience.host_id;
  const experienceTitle = experience.title || 'Locally 체험';
  const hostMessageHref = getHostBookingMessageHref({
    guestId: booking.user_id,
    experienceId: booking.experience_id,
  });

  try {
    const notifications = [];

    if (hostId) {
      notifications.push(
        await buildLocalizedNotificationInsert({
          supabaseAdmin,
          userId: hostId,
          type: 'booking_confirmed',
          link: hostMessageHref,
          key: 'booking.bank_confirmed.host',
          copyParams: {
            experienceTitle,
            guestName: guestDisplayName,
          },
        })
      );
    }

    if (booking.user_id) {
      notifications.push(
        await buildLocalizedNotificationInsert({
          supabaseAdmin,
          userId: booking.user_id,
          type: 'booking_confirmed',
          link: '/guest/trips',
          key: 'booking.bank_confirmed.guest',
          copyParams: {
            experienceTitle,
          },
        })
      );
    }

    if (notifications.length > 0) {
      const { error: notificationError } = await supabaseAdmin.from('notifications').insert(notifications);
      if (notificationError) {
        console.error('[experience bank confirm] notification insert failed:', notificationError);
      }
    }
  } catch (notificationError) {
    console.error('[experience bank confirm] notification side effect error:', notificationError);
  }

  if (hostId) {
    try {
      await sendImmediateGenericEmail({
        recipientUserId: hostId,
        subject: '',
        title: '',
        message: '',
        templatedEmail: {
          templateId: 'booking.bank_confirmed_host',
          audience: 'host',
          payload: {
            experienceTitle,
            ctaUrl: hostMessageHref,
            guestName: guestDisplayName,
          },
        },
      });
    } catch (error) {
      console.error('[experience bank confirm] host email failed:', error);
    }
  }

  if (booking.user_id) {
    try {
      await sendImmediateGenericEmail({
        recipientUserId: booking.user_id,
        subject: '',
        title: '',
        message: '',
        templatedEmail: {
          templateId: 'notice.copy',
          audience: 'guest',
          payload: {
            copyKey: 'booking.bank_confirmed.guest',
            copyParams: {
              experienceTitle,
            },
            ctaUrl: '/guest/trips',
          },
        },
      });
    } catch (error) {
      console.error('[experience bank confirm] guest email failed:', error);
    }

    try {
      await notifyMembershipMilestone({
        supabaseAdmin,
        userId: booking.user_id,
      });
    } catch (error) {
      console.error('[experience bank confirm] membership milestone failed:', error);
    }
  }

  try {
    await insertAdminAlerts({
      title: '체험 예약 무통장 입금이 확인되었습니다',
      message: `'${experienceTitle}' 예약의 무통장 입금 확인이 완료되었습니다.`,
      link: '/admin/dashboard?tab=LEDGER',
    });
  } catch (error) {
    console.error('[experience bank confirm] admin alert failed:', error);
  }

  try {
    await sendAdminPaymentConfirmedEmail({
      domain: 'experience',
      title: experienceTitle,
      orderId: booking.order_id || booking.id,
      amount: Number(booking.amount || 0),
      paymentMethod: 'bank',
      link: '/admin/dashboard?tab=LEDGER',
      customerName: guestDisplayName,
    });
  } catch (error) {
    console.error('[experience bank confirm] admin email failed:', error);
  }

  if (booking.experience_id != null) {
    revalidatePath(`/experiences/${booking.experience_id}`);
  }
}
