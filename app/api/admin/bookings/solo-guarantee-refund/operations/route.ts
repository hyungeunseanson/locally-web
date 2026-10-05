import { NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { CardRefundOutcomeError, verifyCardRefundResponse } from '@/app/utils/payments/card/server';
import { deliverSoloRefundNotification, retryRejectedSoloRefund, type SoloRefundOperation } from '@/app/utils/bookings/soloGuaranteeRefund';

async function authorized() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;
  const db = createAdminClient();
  const access = await resolveAdminAccess(db, { userId: user.id, email: user.email });
  return access.isAdmin ? { user, db } : null;
}

export async function GET(request: Request) {
  const access = await authorized();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const rawPage = Number(new URL(request.url).searchParams.get('page') || 0);
  const page = Number.isSafeInteger(rawPage) && rawPage >= 0 && rawPage <= 100000 ? rawPage : 0;
  const { data, error } = await access.db.from('booking_solo_refund_operations')
    .select('id, booking_id, provider, payment_method, requested_amount, outcome, result_code, settlement_applied_at, diagnostic_code, delivery_state, delivery_attempts, created_at, updated_at')
    .or('settlement_applied_at.is.null,delivery_state.neq.delivered')
    .order('created_at', { ascending: true }).order('id', { ascending: true }).range(page * 50, page * 50 + 50);
  if (error) return NextResponse.json({ error: 'Refund operations unavailable' }, { status: 503 });
  const diagnostics = await access.db.rpc('solo_refund_diagnostics');
  if (diagnostics.error || !diagnostics.data) return NextResponse.json({ error: 'Refund diagnostics unavailable' }, { status: 503 });
  return NextResponse.json({ operations: (data || []).slice(0, 50), hasMore: (data || []).length > 50, page, diagnostics: diagnostics.data });
}

export async function POST(request: Request) {
  const access = await authorized();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.operationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.operationId)) {
    return NextResponse.json({ error: 'operationId required' }, { status: 400 });
  }
  try {
    if (body.action === 'apply_accepted') {
      const result = await access.db.rpc('apply_solo_refund_settlement_atomic', { p_operation_id: body.operationId });
      if (result.error || !result.data?.[0]) throw new Error('apply_conflict');
      await deliverSoloRefundNotification(access.db, result.data[0] as SoloRefundOperation);
      return NextResponse.json({ success: true, applied: true });
    }
    if (body.action === 'retry_delivery') {
      const result = await access.db.rpc('retry_solo_refund_delivery_atomic', { p_operation_id: body.operationId, p_admin_id: access.user.id });
      if (result.error || !result.data?.[0]) throw new Error('delivery_retry_conflict');
      const delivered = await deliverSoloRefundNotification(access.db, result.data[0] as SoloRefundOperation);
      return NextResponse.json({ success: true, delivered });
    }
    if (body.action === 'retry_rejected') {
      const operation = await retryRejectedSoloRefund(access.db, body.operationId, access.user.id);
      return NextResponse.json({ success: true, outcome: operation.outcome, applied: !!operation.settlement_applied_at });
    }
    if (!['reconcile_accepted', 'reconcile_provider'].includes(body.action) || typeof body.signedResponse !== 'string' || body.signedResponse.length > 16384) {
      return NextResponse.json({ error: 'Correlated signed refund response required' }, { status: 400 });
    }
    const { data: op, error } = await access.db.from('booking_solo_refund_operations').select('*').eq('id', body.operationId).single();
    if (error || !op || op.payment_method !== 'card' || op.provider !== 'nicepay') {
      return NextResponse.json({ error: 'Card reconciliation required' }, { status: 409 });
    }
    if (op.merchant_reference && op.merchant_reference !== process.env.NICEPAY_MID?.trim()) {
      return NextResponse.json({ error: 'Original merchant verification required' }, { status: 409 });
    }
    // Raw evidence exists only in request memory. Never log or save it.
    let verified;
    try {
      verified = verifyCardRefundResponse(body.signedResponse, {
        providerTransactionId: op.transaction_reference, orderId: op.order_reference,
        cancelAmount: op.requested_amount, cancelReason: 'Reconciliation', requireMerchantKey: true,
      });
    } catch (error) {
      if (body.action !== 'reconcile_provider' || !(error instanceof CardRefundOutcomeError) || error.outcome !== 'rejected') throw error;
      const rejected = await access.db.rpc('reconcile_solo_refund_rejected_atomic', {
        p_operation_id: op.id, p_result_code: error.resultCode, p_amount: op.requested_amount,
        p_transaction_reference: op.transaction_reference, p_order_reference: op.order_reference, p_admin_id: access.user.id,
      });
      if (rejected.error || !rejected.data?.[0]) throw new Error('reconciliation_conflict');
      return NextResponse.json({ success: true, outcome: 'rejected', applied: false });
    }
    const result = await access.db.rpc('reconcile_solo_refund_accepted_atomic', {
      p_operation_id: op.id, p_result_code: verified.resultCode, p_refund_reference: verified.refundReference,
      p_amount: op.requested_amount, p_transaction_reference: op.transaction_reference,
      p_order_reference: op.order_reference, p_admin_id: access.user.id,
    });
    if (result.error || !result.data?.[0]) throw new Error('reconciliation_conflict');
    await deliverSoloRefundNotification(access.db, result.data[0] as SoloRefundOperation);
    return NextResponse.json({ success: true, applied: true });
  } catch {
    return NextResponse.json({ error: 'Outcome remains blocked; valid provider evidence or a definite rejection is required.' }, { status: 409 });
  }
}
