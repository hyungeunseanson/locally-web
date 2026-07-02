'use client';

import type { CardPaymentLaunchParams, CardPaymentLaunchResult } from './types';

type PortOneRequestPayload = {
  pg: string;
  pay_method: 'card';
  merchant_uid: string;
  name: string;
  amount: number;
  buyer_email?: string;
  buyer_name: string;
  buyer_tel: string;
  m_redirect_url: string;
};

type PortOneResponse = {
  success?: boolean;
  code?: string;
  status?: string;
  imp_uid?: string;
  error_msg?: string;
};

type NicePayLaunchEnvelope = {
  success?: boolean;
  provider?: 'nicepay';
  formAction?: string;
  fields?: Record<string, string>;
  error?: string;
};

type NicePayRelayMessage = {
  type?: string;
  success?: boolean;
  cancelled?: boolean;
  message?: string;
  payload?: Record<string, string>;
};

const NICEPAY_RESULT_MESSAGE_TYPE = 'locally:nicepay-result';

declare global {
  interface Window {
    IMP?: {
      init: (merchantCode: string) => void;
      request_pay: (
        data: PortOneRequestPayload,
        callback: (response: PortOneResponse) => void
      ) => void;
    };
    goPay?: (form: HTMLFormElement) => void;
    nicepaySubmit?: () => void;
    nicepayClose?: () => void;
  }
}

function requestPortOneCardPayment(params: CardPaymentLaunchParams): Promise<CardPaymentLaunchResult> {
  return new Promise((resolve, reject) => {
    const imp = window.IMP;
    if (!imp) {
      reject(new Error('결제 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'));
      return;
    }

    imp.init(params.merchantCode);
    imp.request_pay(
      {
        pg: 'nice_v2',
        pay_method: 'card',
        merchant_uid: params.orderId,
        name: params.productName,
        amount: params.amount,
        buyer_email: params.buyerEmail,
        buyer_name: params.buyerName,
        buyer_tel: params.buyerTel,
        m_redirect_url: params.redirectUrl,
      },
      (response) => {
        const isSuccess =
          response.success === true ||
          response.code === '0' ||
          response.status === 'paid' ||
          (Boolean(response.imp_uid) && !response.error_msg);

        if (!isSuccess) {
          reject(new Error(`결제 실패: ${response.error_msg || '알 수 없는 오류'}`));
          return;
        }

        if (!response.imp_uid) {
          reject(new Error('결제 확인용 approval id를 받지 못했습니다. 다시 시도해주세요.'));
          return;
        }

        resolve({
          provider: 'portone',
          approvalId: response.imp_uid,
          raw: response,
        });
      }
    );
  });
}

function createHiddenInput(form: HTMLFormElement, name: string, value: string) {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = name;
  input.value = value;
  form.appendChild(input);
}

function formDataToStringRecord(form: HTMLFormElement) {
  return Object.fromEntries(
    Array.from(new FormData(form).entries()).map(([key, value]) => [key, String(value)])
  );
}

function getNicePayApprovalId(payload: Record<string, string>) {
  return String(payload.TxTid || payload.TID || '').trim();
}

function hasNicePayAuthResponse(payload: Record<string, string>) {
  return Boolean(
    payload.AuthResultCode ||
      payload.AuthToken ||
      payload.TxTid ||
      payload.TID ||
      payload.NextAppURL
  );
}

async function requestNicePayLaunchEnvelope(
  params: CardPaymentLaunchParams
): Promise<NicePayLaunchEnvelope> {
  const response = await fetch('/api/payment/card-launch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: params.provider,
      orderId: params.orderId,
      productName: params.productName,
      amount: params.amount,
      buyerName: params.buyerName,
      buyerTel: params.buyerTel,
      buyerEmail: params.buyerEmail,
    }),
  });

  const envelope = (await response.json()) as NicePayLaunchEnvelope;
  if (!response.ok || !envelope.success || !envelope.formAction || !envelope.fields) {
    throw new Error(envelope.error || 'NICEPAY 결제 준비에 실패했습니다.');
  }

  return envelope;
}

function requestNicePayCardPayment(params: CardPaymentLaunchParams): Promise<CardPaymentLaunchResult> {
  return new Promise((resolve, reject) => {
    const goPay = window.goPay;
    if (typeof goPay !== 'function') {
      reject(new Error('결제 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'));
      return;
    }

    const cleanupCallbacks = {
      submit: window.nicepaySubmit,
      close: window.nicepayClose,
    };

    const iframe = document.createElement('iframe');
    const iframeName = `nicepay-relay-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    iframe.name = iframeName;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.className = 'hidden';

    const form = document.createElement('form');
    form.name = 'payForm';
    form.method = 'post';
    form.acceptCharset = 'utf-8';
    form.target = iframeName;
    form.className = 'hidden';

    let pollTimer = 0;

    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(pollTimer);
      window.nicepaySubmit = cleanupCallbacks.submit;
      window.nicepayClose = cleanupCallbacks.close;
      form.remove();
      iframe.remove();
    };

    const rejectWithCleanup = (error: Error) => {
      cleanup();
      reject(error);
    };

    const handleMessage = (event: MessageEvent<NicePayRelayMessage>) => {
      if (event.origin !== window.location.origin) return;

      const data = event.data;
      if (!data || data.type !== NICEPAY_RESULT_MESSAGE_TYPE) {
        return;
      }

      if (!data.success || !data.payload) {
        rejectWithCleanup(new Error(data.message || '결제가 취소되었거나 승인에 실패했습니다.'));
        return;
      }

      const approvalId = getNicePayApprovalId(data.payload);
      if (!approvalId) {
        rejectWithCleanup(new Error('결제 확인용 approval id를 받지 못했습니다. 다시 시도해주세요.'));
        return;
      }

      cleanup();
      resolve({
        provider: 'nicepay',
        approvalId,
        raw: data.payload,
      });
    };

    window.addEventListener('message', handleMessage);
    document.body.appendChild(iframe);
    document.body.appendChild(form);

    requestNicePayLaunchEnvelope(params)
      .then((envelope) => {
        form.action = envelope.formAction!;

        for (const [key, value] of Object.entries(envelope.fields || {})) {
          createHiddenInput(form, key, value);
        }

        window.nicepaySubmit = () => {
          const payload = formDataToStringRecord(form);

          if (hasNicePayAuthResponse(payload)) {
            if (payload.AuthResultCode && payload.AuthResultCode !== '0000') {
              rejectWithCleanup(
                new Error(payload.AuthResultMsg || '결제가 취소되었거나 승인에 실패했습니다.')
              );
              return;
            }

            const approvalId = getNicePayApprovalId(payload);
            if (!approvalId) {
              rejectWithCleanup(
                new Error('결제 확인용 approval id를 받지 못했습니다. 다시 시도해주세요.')
              );
              return;
            }

            cleanup();
            resolve({
              provider: 'nicepay',
              approvalId,
              raw: payload,
            });
            return;
          }

          form.submit();
        };
        window.nicepayClose = () => {
          rejectWithCleanup(new Error('결제가 취소되었습니다.'));
        };

        goPay(form);
      })
      .catch((error: unknown) => {
        rejectWithCleanup(
          error instanceof Error ? error : new Error('NICEPAY 결제 준비에 실패했습니다.')
        );
      });

    pollTimer = window.setTimeout(() => {
      rejectWithCleanup(new Error('결제 응답이 지연되고 있습니다. 다시 시도해주세요.'));
    }, 5 * 60 * 1000);
  });
}

export async function launchCardPayment(
  params: CardPaymentLaunchParams
): Promise<CardPaymentLaunchResult> {
  switch (params.provider) {
    case 'portone':
      return requestPortOneCardPayment(params);
    case 'nicepay':
      return requestNicePayCardPayment(params);
    default:
      throw new Error('지원하지 않는 카드 결제 provider입니다.');
  }
}
