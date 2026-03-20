import crypto from 'crypto';

import { getPortOnePayment, isPortOneCardReady } from '@/app/utils/portone/server';

import type {
  CancelCardPaymentParams,
  CancelCardPaymentResult,
  CardPaymentNotificationEnvelope,
  CardPaymentProvider,
  CardPaymentReadiness,
  VerifiedCardPayment,
  VerifyApprovedCardPaymentParams,
} from './types';

const CURRENT_CARD_PAYMENT_PROVIDER: CardPaymentProvider = 'portone';

function parseNumber(value: number | string | undefined | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapReadinessMissingConfig(readiness: ReturnType<typeof isPortOneCardReady>) {
  if (readiness.ready) {
    return [] as string[];
  }

  if (readiness.reason === 'missing_imp_code') {
    return ['NEXT_PUBLIC_PORTONE_IMP_CODE'];
  }

  return ['PORTONE_API_KEY', 'PORTONE_API_SECRET'];
}

function parseNicePayCancelResponse(raw: string) {
  try {
    const parsed = JSON.parse(raw.replace(/'/g, '"')) as {
      ResultCode?: string;
      ResultMsg?: string;
    };

    return {
      resultCode: parsed.ResultCode || null,
      resultMessage: parsed.ResultMsg || null,
    };
  } catch {
    const params = new URLSearchParams(raw);
    return {
      resultCode: params.get('ResultCode'),
      resultMessage: params.get('ResultMsg'),
    };
  }
}

export function getCurrentCardPaymentProvider(): CardPaymentProvider {
  return CURRENT_CARD_PAYMENT_PROVIDER;
}

export function getCardPaymentReadiness(): CardPaymentReadiness {
  switch (getCurrentCardPaymentProvider()) {
    case 'portone': {
      const readiness = isPortOneCardReady();
      return {
        provider: 'portone',
        ready: readiness.ready,
        reason: readiness.ready ? undefined : readiness.reason,
        missingConfig: mapReadinessMissingConfig(readiness),
      };
    }
    case 'nicepay':
      return {
        provider: 'nicepay',
        ready: false,
        reason: 'missing_nicepay_credentials',
        missingConfig: ['NICEPAY_CLIENT_KEY', 'NICEPAY_MID', 'NICEPAY_MERCHANT_KEY'],
      };
    default:
      return {
        provider: getCurrentCardPaymentProvider(),
        ready: false,
        reason: 'unsupported_provider',
        missingConfig: [],
      };
  }
}

export async function verifyApprovedCardPayment(
  params: VerifyApprovedCardPaymentParams
): Promise<VerifiedCardPayment> {
  const provider = params.provider || getCurrentCardPaymentProvider();

  switch (provider) {
    case 'portone': {
      const payment = await getPortOnePayment(params.approvalId);
      const verifiedMerchantUid = String(payment.merchant_uid || '').trim();
      const approvedAmount = parseNumber(payment.amount);

      if (String(payment.status || '').toLowerCase() !== 'paid') {
        throw new Error('PortOne 결제 상태가 paid가 아닙니다.');
      }

      if (verifiedMerchantUid !== params.orderId) {
        throw new Error('PortOne 주문번호가 예약과 일치하지 않습니다.');
      }

      if (approvedAmount !== params.expectedAmount) {
        throw new Error('PortOne 결제 금액이 예약 금액과 일치하지 않습니다.');
      }

      return {
        provider,
        approvedAmount,
        providerTransactionId: payment.pg_tid || payment.imp_uid || params.approvalId,
        raw: payment,
      };
    }
    case 'nicepay':
      throw new Error('NICEPAY direct approval verification is reserved for the cutover phase.');
    default:
      throw new Error('지원하지 않는 카드 결제 provider입니다.');
  }
}

export async function cancelCardPayment(
  params: CancelCardPaymentParams
): Promise<CancelCardPaymentResult> {
  const mid = process.env.NICEPAY_MID;
  const merchantKey = process.env.NICEPAY_MERCHANT_KEY;

  if (!mid) {
    throw new Error('Server Config Error: NICEPAY_MID missing');
  }

  if (params.requireMerchantKey && !merchantKey) {
    throw new Error('Server Config Error: NICEPAY_MERCHANT_KEY missing');
  }

  const formBody = new URLSearchParams({
    TID: params.providerTransactionId,
    MID: mid,
    Moid: params.orderId,
    CancelAmt: String(params.cancelAmount),
    CancelMsg: params.cancelReason,
    PartialCancelCode:
      params.totalAmount != null && params.cancelAmount < params.totalAmount ? '1' : '0',
  });

  if (merchantKey) {
    const ediDate = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const signData = crypto
      .createHash('sha256')
      .update(ediDate + mid + String(params.cancelAmount) + merchantKey)
      .digest('hex');

    formBody.set('EdiDate', ediDate);
    formBody.set('SignData', signData);
  }

  const response = await fetch('https://webapi.nicepay.co.kr/webapi/cancel_process.jsp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody.toString(),
  });

  if (!response.ok) {
    throw new Error(`PG Network Timeout: ${response.status} ${response.statusText}`);
  }

  const raw = await response.text();
  const parsed = parseNicePayCancelResponse(raw);
  const acceptedCodes = params.acceptedResultCodes || ['2001'];

  if (!parsed.resultCode || !acceptedCodes.includes(parsed.resultCode)) {
    throw new Error(
      `PG Cancel Failed: [${parsed.resultCode || 'unknown'}] ${parsed.resultMessage || '알 수 없는 오류'}`
    );
  }

  return {
    resultCode: parsed.resultCode,
    resultMessage: parsed.resultMessage,
    raw,
  };
}

export async function readCardPaymentNotificationRequest(
  request: Request
): Promise<CardPaymentNotificationEnvelope> {
  const contentType = request.headers.get('content-type') || '';
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  let payload = new URLSearchParams();
  if (contentType.includes('application/json')) {
    try {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      payload = new URLSearchParams(
        Object.entries(parsed).flatMap(([key, value]) =>
          value == null ? [] : [[key, String(value)]]
        )
      );
    } catch {
      payload = new URLSearchParams();
    }
  } else {
    payload = new URLSearchParams(rawBody);
  }

  const orderId =
    payload.get('merchant_uid') ||
    payload.get('orderId') ||
    payload.get('Moid') ||
    payload.get('moid');
  const providerTransactionId =
    payload.get('imp_uid') ||
    payload.get('approvalId') ||
    payload.get('TID') ||
    payload.get('tid') ||
    payload.get('txTid');
  const amount =
    payload.get('amount') ||
    payload.get('Amt') ||
    payload.get('authAmt') ||
    payload.get('CancelAmt');
  const status =
    payload.get('status') ||
    payload.get('ResultCode') ||
    payload.get('AuthResultCode');

  return {
    provider: getCurrentCardPaymentProvider(),
    idempotencyKey: orderId || providerTransactionId || null,
    orderId: orderId || null,
    providerTransactionId: providerTransactionId || null,
    amount: amount ? parseNumber(amount) : null,
    status: status || null,
    rawBody,
    headers,
  };
}
