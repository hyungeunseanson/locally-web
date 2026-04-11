import type { CardPaymentLaunchResult } from './types';

function normalizeRawPayload(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export function buildCardPaymentCallbackRequestBody(params: {
  orderId: string;
  paymentSession: CardPaymentLaunchResult;
}) {
  const basePayload: Record<string, unknown> = {
    approvalId: params.paymentSession.approvalId,
    orderId: params.orderId,
    merchant_uid: params.orderId,
  };

  if (params.paymentSession.provider === 'portone') {
    return {
      ...basePayload,
      imp_uid: params.paymentSession.approvalId,
    };
  }

  return {
    ...basePayload,
    ...normalizeRawPayload(params.paymentSession.raw),
  };
}
