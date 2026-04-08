import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import {
  confirmServiceBankPayment,
  runServiceBankConfirmSideEffects,
} from '@/app/utils/services/confirmServiceBankPayment';

export async function POST(request: Request) {
  try {
    // 1. Auth check
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

    const { orderId } = await request.json();
    const result = await confirmServiceBankPayment(supabaseAdmin, orderId);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    if (result.alreadyProcessed) {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    await runServiceBankConfirmSideEffects(supabaseAdmin, result.payment);

    try {
      await recordAuditLog({
        admin_id: user.id,
        admin_email: user.email,
        action_type: 'ADMIN_SERVICE_CONFIRM_BANK',
        target_type: 'service_booking',
        target_id: result.payment.orderId,
        details: {
          request_title: result.payment.requestTitle,
          amount: result.payment.amount,
          used_atomic_rpc: result.usedAtomicRpc,
          request_was_opened: result.requestWasOpened,
        },
      });
    } catch (auditError) {
      console.error('[ADMIN] service-confirm-payment audit log failed:', auditError);
    }

    return NextResponse.json({ success: true, message: '입금 확인 완료. 의뢰가 공개되었습니다.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ADMIN] service-confirm-payment error:', msg);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
