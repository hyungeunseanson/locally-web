import { NextResponse } from 'next/server';

import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { markSoloGuaranteeManualRefundCompleted } from '@/app/utils/bookings/soloGuaranteeRefund';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type MarkManualRefundBody = {
  bookingId?: unknown;
};

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

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

    const body = ((await request.json().catch(() => ({}))) || {}) as MarkManualRefundBody;
    const bookingId = typeof body.bookingId === 'string' ? body.bookingId.trim() : '';

    if (!bookingId) {
      return NextResponse.json({ success: false, error: 'bookingId is required' }, { status: 400 });
    }

    const result = await markSoloGuaranteeManualRefundCompleted({
      supabaseAdmin,
      bookingId,
      adminId: user.id,
      adminEmail: user.email,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    await recordAuditLog({
      admin_id: user.id,
      admin_email: user.email,
      action_type: 'ADMIN_MARK_SOLO_GUARANTEE_REFUND_COMPLETE',
      target_type: 'booking',
      target_id: bookingId,
      details: {
        refund_amount: result.refundAmount,
        refunded_at: result.refundedAt,
      },
    });

    return NextResponse.json({
      success: true,
      bookingId,
      refundAmount: result.refundAmount,
      refundedAt: result.refundedAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[ADMIN] solo guarantee manual refund complete error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
