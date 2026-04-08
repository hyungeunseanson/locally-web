import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import {
  confirmExperienceBankPayment,
  runExperienceBankConfirmSideEffects,
} from '@/app/utils/bookings/confirmExperienceBankPayment';

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
      userId: user.id,
      email: user.email,
    });
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { bookingId } = await request.json();
    const result = await confirmExperienceBankPayment(supabaseAdmin, bookingId);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    if (result.alreadyProcessed) {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    await runExperienceBankConfirmSideEffects(supabaseAdmin, result);

    // [Fix] recordAuditLog 실패 시 이미 확정된 예약이 500으로 응답되는 것 방지
    try {
      await recordAuditLog({
        admin_id: user.id,
        admin_email: user.email,
        action_type: 'ADMIN_CONFIRM_BOOKING_PAYMENT',
        target_type: 'booking',
        target_id: result.booking.id,
        details: {
          experience_title: result.experience?.title || 'Locally 체험',
          amount: result.booking.amount,
          guest_name: result.guestDisplayName,
        },
      });
    } catch (auditErr) {
      console.error('[ADMIN confirm-payment] audit log failed (ignored):', auditErr);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[ADMIN] booking confirm-payment error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
