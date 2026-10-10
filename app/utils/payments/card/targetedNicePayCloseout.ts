import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cancelCardPayment, verifyCardRefundResponse } from './server';
import type { VerifiedCardPayment, CardPaymentNotificationEnvelope } from './types';
import { isTargetedNicePayCloseout } from './targetedCloseoutTargets';

type Recovery = { id: string; state: string };
async function rpc<T>(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error || data == null) throw new Error('TARGETED_CARD_RECOVERY_DB_UNAVAILABLE');
  return data as T;
}
const allowedApprovalKeys = ['ResultCode','Moid','TID','MID','Amt','PayMethod','Signature','AuthDate'] as const;
function approvalProof(payment: VerifiedCardPayment, orderId: string) {
  const raw = payment.raw as Record<string, unknown> | null;
  const mid = String(process.env.NICEPAY_MID || '');
  const key = String(process.env.NICEPAY_MERCHANT_KEY || '');
  const amt = String(raw?.Amt || '');
  const tid = payment.providerTransactionId;
  const signature = String(raw?.Signature || '').toLowerCase();
  const expected = crypto.createHash('sha256').update(tid + mid + amt + key).digest('hex');
  if (!raw || !mid || !key || payment.provider !== 'nicepay' || payment.approvedAmount !== 46200
    || raw.ResultCode !== '3001' || raw.Moid !== orderId || raw.TID !== tid || raw.MID !== mid
    || raw.PayMethod !== 'CARD' || !/^[0-9]+$/.test(amt) || Number(amt) !== 46200
    || !/^[a-f0-9]{64}$/.test(signature)
    || !crypto.timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(expected,'hex'))) return null;
  return Object.fromEntries(allowedApprovalKeys.map(k => [k, raw[k] ?? null]));
}
function refundProof(raw: string) {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    parsed = Object.fromEntries(new URLSearchParams(raw).entries());
  }
  return Object.fromEntries(['ResultCode','Moid','TID','MID','CancelAmt','CancelNum','Signature']
    .map(k => [k, parsed[k] ?? null]));
}

export async function recordTargetedNicePayNotification(params: {
  supabaseAdmin: SupabaseClient; notification: CardPaymentNotificationEnvelope;
}) {
  const n = params.notification;
  if (!isTargetedNicePayCloseout(n.orderId) || !n.providerTransactionId || n.amount !== 46200) {
    throw new Error('TARGETED_CARD_NOTIFICATION_ANCHOR_CONFLICT');
  }
  // Public PG notifications are not authenticated approval receipts. Preserve
  // bounded audit fields in a separate inbox; never create a financial incident
  // or block closeout solely from this envelope (even if it contains Signature).
  const keys = ['Moid','TID','Amt','MID','PayMethod','StateCd','ResultCode','Signature'] as const;
  const payload = Object.fromEntries(keys.map(key => [key, String(n.payload?.[key] ?? '').slice(0,128)]));
  return rpc<{ state: 'unverified_notification' | 'inbox_capacity_exhausted'; stored: boolean }>(params.supabaseAdmin,'record_targeted_card_notification_atomic',{
    p_booking_id:n.orderId,p_tid:n.providerTransactionId,p_amount:n.amount,p_payload:payload,
  });
}

/** Preserve the signed approval receipt without dispatching a refund. */
export async function recordTargetedNicePayApproval(params: {
  supabaseAdmin: SupabaseClient; orderId: string; payment: VerifiedCardPayment;
}) {
  if (!isTargetedNicePayCloseout(params.orderId)) throw new Error('TARGETED_CARD_SCOPE_CONFLICT');
  return rpc<Recovery>(params.supabaseAdmin,'record_targeted_card_approval_atomic',{
    p_booking_id:params.orderId,p_tid:params.payment.providerTransactionId,
    p_amount:params.payment.approvedAmount,p_proof:approvalProof(params.payment,params.orderId),
  });
}

/** No cron or HTTP refund endpoint is added. Recovery requires an explicit
 * operator invocation with a signed, correlated PG approval receipt. */
export async function recoverTargetedNicePayApproval(params: {
  supabaseAdmin: SupabaseClient; orderId: string; payment: VerifiedCardPayment;
  cancel?: typeof cancelCardPayment;
}) {
  if (!isTargetedNicePayCloseout(params.orderId)) throw new Error('TARGETED_CARD_SCOPE_CONFLICT');
  const proof = approvalProof(params.payment,params.orderId);
  let operation = await recordTargetedNicePayApproval(params);
  if (!proof) return { outcome:'review_required' as const };
  if (operation.state === 'refunded') return { outcome:'refunded' as const };
  if (operation.state === 'accepted') {
    await rpc(params.supabaseAdmin,'finalize_targeted_card_refund_atomic',{p_operation_id:operation.id});
    return { outcome:'refunded' as const };
  }
  const claimed = await rpc<boolean>(params.supabaseAdmin,'begin_targeted_card_refund_atomic',{
    p_operation_id:operation.id,
  });
  if (!claimed) return { outcome:'review_required' as const };
  const request = {providerTransactionId:params.payment.providerTransactionId,orderId:params.orderId,
    cancelAmount:46200,totalAmount:46200,requireMerchantKey:true,
    cancelReason:'운영 종료된 미완료 결제 시도의 뒤늦은 승인 보상'};
  let raw: string;
  try {
    const result = await (params.cancel ?? cancelCardPayment)(request);
    // Validate again even if an injected transport is supplied.
    verifyCardRefundResponse(result.raw,request);
    raw = result.raw;
  } catch {
    // UNKNOWN/dispatching are never automatically retried.
    await rpc(params.supabaseAdmin,'record_targeted_card_refund_result_atomic',{
      p_operation_id:operation.id,p_outcome:'unknown',p_proof:{diagnosticCode:'provider_outcome_uncertain'},
    });
    return { outcome:'review_required' as const };
  }
  // If either DB write fails, leave dispatching/accepted durable. Do not send
  // another PG request on reentry. Reconcile a signed cancellation receipt.
  operation = await rpc<Recovery>(params.supabaseAdmin,'record_targeted_card_refund_result_atomic',{
    p_operation_id:operation.id,p_outcome:'accepted',p_proof:refundProof(raw),
  });
  await rpc(params.supabaseAdmin,'finalize_targeted_card_refund_atomic',{p_operation_id:operation.id});
  return { outcome:'refunded' as const };
}

/** After a signed cancellation response was received but its DB write failed,
 * reconcile its exact operation without another PG call. */
export async function reconcileTargetedNicePayRefund(params: {
  supabaseAdmin: SupabaseClient; orderId: string; payment: VerifiedCardPayment; rawRefund: string;
}) {
  if (!isTargetedNicePayCloseout(params.orderId) || !approvalProof(params.payment,params.orderId)) {
    throw new Error('TARGETED_CARD_APPROVAL_PROOF_CONFLICT');
  }
  const request={providerTransactionId:params.payment.providerTransactionId,orderId:params.orderId,
    cancelAmount:46200,totalAmount:46200,requireMerchantKey:true,cancelReason:'운영 승인취소 증거 대조'};
  verifyCardRefundResponse(params.rawRefund,request);
  const operation = await rpc<Recovery>(params.supabaseAdmin,'record_targeted_card_approval_atomic',{
    p_booking_id:params.orderId,p_tid:params.payment.providerTransactionId,p_amount:46200,
    p_proof:approvalProof(params.payment,params.orderId),
  });
  await rpc(params.supabaseAdmin,'record_targeted_card_refund_result_atomic',{
    p_operation_id:operation.id,p_outcome:'accepted',p_proof:refundProof(params.rawRefund),
  });
  await rpc(params.supabaseAdmin,'finalize_targeted_card_refund_atomic',{p_operation_id:operation.id});
  return { outcome:'refunded' as const };
}
