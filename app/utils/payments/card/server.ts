import crypto from 'crypto';

import { getPortOnePayment, isPortOneCardReady } from '@/app/utils/portone/server';

import type {
  CancelCardPaymentParams,
  CancelCardPaymentResult,
  CardPaymentNotificationEnvelope,
  CardPaymentProvider,
  CardPaymentPublicRuntime,
  CardPaymentReadiness,
  VerifiedCardPayment,
  VerifyApprovedCardPaymentParams,
} from './types';

const DEFAULT_CARD_PAYMENT_PROVIDER: CardPaymentProvider = 'portone';
const PORTONE_SCRIPT_SRC = 'https://cdn.iamport.kr/v1/iamport.js';
const NICEPAY_SCRIPT_SRC = 'https://web.nicepay.co.kr/v3/webstd/js/nicepay-pg-web.js';
const NICEPAY_APPROVAL_SUCCESS_CODES = new Set(['3001']);
const NICEPAY_NOTIFICATION_SUCCESS_CODES = new Set(['3001', '0000']);
const NICEPAY_NOTIFICATION_SUCCESS_STATE_CODES = new Set(['0']);
const NICEPAY_STATUS_QUERY_SUCCESS_CODES = new Set(['0000']);
const NICEPAY_STATUS_QUERY_SUCCESS_STATUS = new Set(['0']);
const NICEPAY_STATUS_QUERY_URL = 'https://pg-api.nicepay.co.kr/webapi/common/trans_status.jsp';
const NICEPAY_ALLOWED_APPROVAL_HOSTS = new Set(['webapi.nicepay.co.kr', 'pg-api.nicepay.co.kr']);

type NicePayRuntimeConfig = {
  mid: string;
  merchantKey: string;
  clientKey: string;
  publicClientKey: string;
};

type NicePayStatusResponse = Record<string, string>;

function parseNumber(value: number | string | undefined | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sha256Hex(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getNicePayEdiDate() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function normalizePayloadRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [key, entryValue]) => {
      if (entryValue == null) return acc;
      acc[key] = String(entryValue);
      return acc;
    },
    {}
  );
}

function getPayloadValue(
  payload: URLSearchParams | Record<string, string>,
  candidates: string[]
): string | null {
  for (const candidate of candidates) {
    const raw =
      payload instanceof URLSearchParams ? payload.get(candidate) : payload[candidate];
    const value = String(raw || '').trim();
    if (value) return value;
  }

  return null;
}

function parseNicePayApiResponse(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return normalizePayloadRecord(parsed);
  } catch {
    return Object.fromEntries(new URLSearchParams(raw).entries());
  }
}

function isAllowedNicePayApiUrl(rawUrl: string | null | undefined) {
  if (!rawUrl) return false;

  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' && NICEPAY_ALLOWED_APPROVAL_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function getConfiguredCardPaymentProvider() {
  const rawProvider = String(process.env.CARD_PAYMENT_PROVIDER || '')
    .trim()
    .toLowerCase();

  if (!rawProvider) {
    return {
      provider: DEFAULT_CARD_PAYMENT_PROVIDER,
      unsupported: false,
    } as const;
  }

  if (rawProvider === 'portone' || rawProvider === 'nicepay') {
    return {
      provider: rawProvider,
      unsupported: false,
    } as const;
  }

  return {
    provider: DEFAULT_CARD_PAYMENT_PROVIDER,
    unsupported: true,
  } as const;
}

function mapPortOneMissingConfig(readiness: ReturnType<typeof isPortOneCardReady>) {
  if (readiness.ready) {
    return [] as string[];
  }

  if (readiness.reason === 'missing_imp_code') {
    return ['NEXT_PUBLIC_PORTONE_IMP_CODE'];
  }

  return ['PORTONE_API_KEY', 'PORTONE_API_SECRET'];
}

function getPortOnePublicRuntime(): CardPaymentPublicRuntime | undefined {
  const merchantCode = String(process.env.NEXT_PUBLIC_PORTONE_IMP_CODE || '').trim();
  if (!merchantCode) return undefined;

  return {
    provider: 'portone',
    merchantCode,
    scriptSrc: PORTONE_SCRIPT_SRC,
  };
}

function getNicePayRuntimeConfig(): NicePayRuntimeConfig {
  const mid = String(process.env.NICEPAY_MID || '').trim();
  const merchantKey = String(process.env.NICEPAY_MERCHANT_KEY || '').trim();
  const clientKey = String(process.env.NICEPAY_CLIENT_KEY || '').trim();
  const publicClientKey = String(process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY || '').trim();

  if (!mid) {
    throw new Error('Server Config Error: NICEPAY_MID missing');
  }

  if (!merchantKey) {
    throw new Error('Server Config Error: NICEPAY_MERCHANT_KEY missing');
  }

  if (!clientKey) {
    throw new Error('Server Config Error: NICEPAY_CLIENT_KEY missing');
  }

  if (!publicClientKey) {
    throw new Error('Server Config Error: NEXT_PUBLIC_NICEPAY_CLIENT_KEY missing');
  }

  return {
    mid,
    merchantKey,
    clientKey,
    publicClientKey,
  };
}

function getNicePayMissingConfig() {
  const missing: string[] = [];

  if (!String(process.env.NICEPAY_MID || '').trim()) {
    missing.push('NICEPAY_MID');
  }

  if (!String(process.env.NICEPAY_MERCHANT_KEY || '').trim()) {
    missing.push('NICEPAY_MERCHANT_KEY');
  }

  if (!String(process.env.NICEPAY_CLIENT_KEY || '').trim()) {
    missing.push('NICEPAY_CLIENT_KEY');
  }

  if (!String(process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY || '').trim()) {
    missing.push('NEXT_PUBLIC_NICEPAY_CLIENT_KEY');
  }

  return missing;
}

function getNicePayPublicRuntime(): CardPaymentPublicRuntime | undefined {
  const mid = String(process.env.NICEPAY_MID || '').trim();
  const publicClientKey = String(process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY || '').trim();

  if (!mid || !publicClientKey) {
    return undefined;
  }

  return {
    provider: 'nicepay',
    merchantCode: mid,
    publicClientKey,
    scriptSrc: NICEPAY_SCRIPT_SRC,
  };
}

export function buildNicePayLaunchFields(params: {
  orderId: string;
  productName: string;
  amount: number;
  buyerName: string;
  buyerTel: string;
  buyerEmail?: string;
  returnUrl: string;
}) {
  const config = getNicePayRuntimeConfig();
  const amount = parseNumber(params.amount);

  if (!params.orderId.trim()) {
    throw new Error('NICEPAY 주문번호가 없습니다.');
  }

  if (!params.productName.trim()) {
    throw new Error('NICEPAY 상품명이 없습니다.');
  }

  if (amount <= 0) {
    throw new Error('NICEPAY 결제 금액이 올바르지 않습니다.');
  }

  const ediDate = getNicePayEdiDate();
  const signData = sha256Hex(`${ediDate}${config.mid}${amount}${config.merchantKey}`);

  return {
    PayMethod: 'CARD',
    GoodsName: params.productName.trim(),
    Amt: String(amount),
    MID: config.mid,
    Moid: params.orderId.trim(),
    BuyerName: params.buyerName.trim(),
    BuyerTel: params.buyerTel.trim(),
    BuyerEmail: String(params.buyerEmail || '').trim(),
    ReturnURL: params.returnUrl,
    GoodsCl: '1',
    TransType: '0',
    CharSet: 'utf-8',
    ReqReserved: '',
    EdiDate: ediDate,
    SignData: signData,
  };
}

function parseNicePayCancelResponse(raw: string) {
  const parsed = parseNicePayApiResponse(raw);

  return {
    resultCode: parsed.ResultCode || null,
    resultMessage: parsed.ResultMsg || null,
  };
}

async function verifyNicePayApprovedPayment(
  params: VerifyApprovedCardPaymentParams
): Promise<VerifiedCardPayment> {
  const config = getNicePayRuntimeConfig();
  const providerPayload = normalizePayloadRecord(params.providerPayload);
  const authResultCode = getPayloadValue(providerPayload, ['AuthResultCode']);
  const authToken = getPayloadValue(providerPayload, ['AuthToken']);
  const txTid = getPayloadValue(providerPayload, ['TxTid', 'TID']) || params.approvalId;
  const authMid = getPayloadValue(providerPayload, ['MID']) || config.mid;
  const moid = getPayloadValue(providerPayload, ['Moid', 'merchant_uid', 'orderId']);
  const amount = parseNumber(getPayloadValue(providerPayload, ['Amt', 'amount']));
  const nextAppUrl = getPayloadValue(providerPayload, ['NextAppURL']);
  const signature = getPayloadValue(providerPayload, ['Signature']);
  const payMethod = getPayloadValue(providerPayload, ['PayMethod']);

  if (authResultCode && authResultCode !== '0000') {
    throw new Error('NICEPAY 인증 결과가 성공이 아닙니다.');
  }

  if (!authToken) {
    throw new Error('NICEPAY AuthToken이 없습니다.');
  }

  if (!txTid) {
    throw new Error('NICEPAY 승인용 거래번호가 없습니다.');
  }

  if (authMid !== config.mid) {
    throw new Error('NICEPAY MID가 서버 설정과 일치하지 않습니다.');
  }

  if (moid !== params.orderId) {
    throw new Error('NICEPAY 주문번호가 예약과 일치하지 않습니다.');
  }

  if (amount !== params.expectedAmount) {
    throw new Error('NICEPAY 결제 금액이 예약 금액과 일치하지 않습니다.');
  }

  if (payMethod && payMethod.toUpperCase() !== 'CARD') {
    throw new Error('NICEPAY 카드 결제 응답만 처리할 수 있습니다.');
  }

  if (!isAllowedNicePayApiUrl(nextAppUrl)) {
    throw new Error('NICEPAY 승인 URL이 유효하지 않습니다.');
  }

  const approvalUrl = nextAppUrl as string;

  if (signature) {
    const expectedSignature = sha256Hex(`${authToken}${config.mid}${amount}${config.merchantKey}`);
    if (signature !== expectedSignature) {
      throw new Error('NICEPAY 인증 응답 서명이 올바르지 않습니다.');
    }
  }

  const ediDate = getNicePayEdiDate();
  const signData = sha256Hex(`${authToken}${config.mid}${amount}${ediDate}${config.merchantKey}`);
  const approvalFormBody = new URLSearchParams({
    TID: txTid,
    AuthToken: authToken,
    MID: config.mid,
    Amt: String(amount),
    EdiDate: ediDate,
    SignData: signData,
    CharSet: 'utf-8',
    EdiType: 'JSON',
  });

  const response = await fetch(approvalUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: approvalFormBody.toString(),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`NICEPAY 승인 API 오류: ${response.status} ${response.statusText}`);
  }

  const rawResponse = await response.text();
  const parsed = parseNicePayApiResponse(rawResponse);
  const resultCode = getPayloadValue(parsed, ['ResultCode']);
  const approvedTransactionId = getPayloadValue(parsed, ['TID']) || txTid;
  const approvedOrderId = getPayloadValue(parsed, ['Moid']);
  const approvedAmount = parseNumber(getPayloadValue(parsed, ['Amt']));
  const approvalSignature = getPayloadValue(parsed, ['Signature']);
  const approvedPayMethod = getPayloadValue(parsed, ['PayMethod']);

  if (!resultCode || !NICEPAY_APPROVAL_SUCCESS_CODES.has(resultCode)) {
    throw new Error(
      `NICEPAY 승인 검증에 실패했습니다. [${resultCode || 'unknown'}] ${parsed.ResultMsg || '알 수 없는 오류'}`
    );
  }

  if (approvedOrderId && approvedOrderId !== params.orderId) {
    throw new Error('NICEPAY 승인 주문번호가 예약과 일치하지 않습니다.');
  }

  if (approvedAmount !== params.expectedAmount) {
    throw new Error('NICEPAY 승인 금액이 예약 금액과 일치하지 않습니다.');
  }

  if (approvedPayMethod && approvedPayMethod.toUpperCase() !== 'CARD') {
    throw new Error('NICEPAY 승인 응답이 카드 결제가 아닙니다.');
  }

  if (approvalSignature) {
    const expectedApprovalSignature = sha256Hex(
      `${approvedTransactionId}${config.mid}${approvedAmount}${config.merchantKey}`
    );

    if (approvalSignature !== expectedApprovalSignature) {
      throw new Error('NICEPAY 승인 응답 서명이 올바르지 않습니다.');
    }
  }

  return {
    provider: 'nicepay',
    approvedAmount,
    providerTransactionId: approvedTransactionId,
    raw: parsed,
  };
}

async function queryNicePayTransactionStatus(
  providerTransactionId: string
): Promise<NicePayStatusResponse> {
  const config = getNicePayRuntimeConfig();
  const ediDate = getNicePayEdiDate();
  const signData = sha256Hex(`${config.mid}${providerTransactionId}${ediDate}${config.merchantKey}`);
  const requestBody = new URLSearchParams({
    MID: config.mid,
    TID: providerTransactionId,
    EdiDate: ediDate,
    SignData: signData,
    CharSet: 'utf-8',
    EdiType: 'JSON',
  });

  const response = await fetch(NICEPAY_STATUS_QUERY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: requestBody.toString(),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`NICEPAY 조회 API 오류: ${response.status} ${response.statusText}`);
  }

  const rawResponse = await response.text();
  const parsed = parseNicePayApiResponse(rawResponse);
  const resultCode = getPayloadValue(parsed, ['ResultCode']);
  const status = getPayloadValue(parsed, ['Status']);

  if (!resultCode || !NICEPAY_STATUS_QUERY_SUCCESS_CODES.has(resultCode)) {
    throw new Error(
      `NICEPAY 거래 조회에 실패했습니다. [${resultCode || 'unknown'}] ${parsed.ResultMsg || '알 수 없는 오류'}`
    );
  }

  if (!status || !NICEPAY_STATUS_QUERY_SUCCESS_STATUS.has(status)) {
    throw new Error('NICEPAY 거래 상태가 승인 완료가 아닙니다.');
  }

  return parsed;
}

async function verifyNicePayNotification(
  notification: CardPaymentNotificationEnvelope,
  params: {
    orderId: string;
    expectedAmount: number;
  }
): Promise<VerifiedCardPayment> {
  const providerTransactionId = notification.providerTransactionId?.trim();
  if (!providerTransactionId) {
    throw new Error('NICEPAY 통보에 거래번호가 없습니다.');
  }

  const payMethod = getPayloadValue(notification.payload, ['PayMethod']);
  const resultCode = getPayloadValue(notification.payload, ['ResultCode', 'AuthResultCode']);
  const stateCode = getPayloadValue(notification.payload, ['StateCd']);

  if (payMethod && payMethod.toUpperCase() !== 'CARD') {
    throw new Error('NICEPAY 카드 통보만 처리할 수 있습니다.');
  }

  if (resultCode && !NICEPAY_NOTIFICATION_SUCCESS_CODES.has(resultCode)) {
    throw new Error('NICEPAY 통보 결과가 성공이 아닙니다.');
  }

  if (stateCode && !NICEPAY_NOTIFICATION_SUCCESS_STATE_CODES.has(stateCode)) {
    throw new Error('NICEPAY 통보 상태가 승인 완료가 아닙니다.');
  }

  if (notification.orderId && notification.orderId !== params.orderId) {
    throw new Error('NICEPAY 통보 주문번호가 예약과 일치하지 않습니다.');
  }

  if (notification.amount != null && notification.amount !== params.expectedAmount) {
    throw new Error('NICEPAY 통보 금액이 예약 금액과 일치하지 않습니다.');
  }

  const statusResult = await queryNicePayTransactionStatus(providerTransactionId);

  return {
    provider: 'nicepay',
    approvedAmount: params.expectedAmount,
    providerTransactionId,
    raw: {
      notification: notification.payload,
      statusQuery: statusResult,
    },
  };
}

export function getCurrentCardPaymentProvider(): CardPaymentProvider {
  return getConfiguredCardPaymentProvider().provider;
}

export function getCardPaymentReadiness(): CardPaymentReadiness {
  const { provider, unsupported } = getConfiguredCardPaymentProvider();

  if (unsupported) {
    return {
      provider,
      ready: false,
      reason: 'unsupported_provider',
      missingConfig: [],
    };
  }

  switch (provider) {
    case 'portone': {
      const readiness = isPortOneCardReady();
      return {
        provider: 'portone',
        ready: readiness.ready,
        reason: readiness.ready ? undefined : readiness.reason,
        missingConfig: mapPortOneMissingConfig(readiness),
        runtime: getPortOnePublicRuntime(),
      };
    }
    case 'nicepay': {
      const missingConfig = getNicePayMissingConfig();
      return {
        provider: 'nicepay',
        ready: missingConfig.length === 0,
        reason: missingConfig.length === 0 ? undefined : 'missing_nicepay_credentials',
        missingConfig,
        runtime: getNicePayPublicRuntime(),
      };
    }
    default:
      return {
        provider,
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
      return verifyNicePayApprovedPayment(params);
    default:
      throw new Error('지원하지 않는 카드 결제 provider입니다.');
  }
}

export async function verifyCardPaymentNotification(params: {
  notification: CardPaymentNotificationEnvelope;
  orderId: string;
  expectedAmount: number;
}): Promise<VerifiedCardPayment> {
  switch (params.notification.provider) {
    case 'nicepay':
      return verifyNicePayNotification(params.notification, {
        orderId: params.orderId,
        expectedAmount: params.expectedAmount,
      });
    case 'portone':
      throw new Error('PortOne direct card notifications are not used in the current flow.');
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
    const ediDate = getNicePayEdiDate();
    const signData = sha256Hex(ediDate + mid + String(params.cancelAmount) + merchantKey);

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

  const payloadRecord = Object.fromEntries(payload.entries());
  const orderId = getPayloadValue(payload, ['merchant_uid', 'orderId', 'Moid', 'moid', 'MOID']);
  const providerTransactionId = getPayloadValue(payload, [
    'imp_uid',
    'approvalId',
    'TID',
    'tid',
    'txTid',
    'TxTid',
  ]);
  const amount = getPayloadValue(payload, ['amount', 'Amt', 'authAmt', 'CancelAmt']);
  const status = getPayloadValue(payload, ['status', 'ResultCode', 'AuthResultCode', 'StateCd']);

  return {
    provider: getCurrentCardPaymentProvider(),
    idempotencyKey: orderId || providerTransactionId || null,
    orderId: orderId || null,
    providerTransactionId: providerTransactionId || null,
    amount: amount ? parseNumber(amount) : null,
    status: status || null,
    payload: payloadRecord,
    rawBody,
    headers,
  };
}
