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

declare global {
  interface Window {
    IMP?: {
      init: (merchantCode: string) => void;
      request_pay: (
        data: PortOneRequestPayload,
        callback: (response: PortOneResponse) => void
      ) => void;
    };
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

export async function launchCardPayment(
  params: CardPaymentLaunchParams
): Promise<CardPaymentLaunchResult> {
  switch (params.provider) {
    case 'portone':
      return requestPortOneCardPayment(params);
    case 'nicepay':
      throw new Error('NICEPAY direct card launch is reserved for the cutover phase.');
    default:
      throw new Error('지원하지 않는 카드 결제 provider입니다.');
  }
}
