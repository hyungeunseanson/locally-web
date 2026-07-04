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

type NicePayRelayMessage = {
  type?: string;
  success?: boolean;
  cancelled?: boolean;
  message?: string;
  payload?: Record<string, string>;
};

const NICEPAY_RESULT_MESSAGE_TYPE = 'locally:nicepay-result';
const NICEPAY_LAUNCH_PAGE_PATH = '/api/payment/card-launch-page';

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

function escapeHtmlAttribute(value: string | number | undefined) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildHiddenInputHtml(name: string, value: string | number | undefined) {
  return `<input type="hidden" name="${escapeHtmlAttribute(name)}" value="${escapeHtmlAttribute(
    value
  )}" />`;
}

function submitNicePayLaunchPageInPopup(popup: Window, params: CardPaymentLaunchParams) {
  const fields = [
    buildHiddenInputHtml('provider', params.provider),
    buildHiddenInputHtml('orderId', params.orderId),
    buildHiddenInputHtml('productName', params.productName),
    buildHiddenInputHtml('amount', params.amount),
    buildHiddenInputHtml('buyerName', params.buyerName),
    buildHiddenInputHtml('buyerTel', params.buyerTel),
    buildHiddenInputHtml('buyerEmail', params.buyerEmail),
  ].join('\n');

  popup.document.open();
  popup.document.write(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>Locally NICEPAY</title>
    <style>
      html, body { height: 100%; margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; }
      body { display: grid; place-items: center; text-align: center; }
      span { color: #64748b; font-size: 14px; }
      form { overflow: hidden; height: 0; }
    </style>
  </head>
  <body>
    <main>
      <strong>NICEPAY 결제 준비 중입니다.</strong><br />
      <span>잠시만 기다려 주세요.</span>
    </main>
    <form id="locally-nicepay-launch" method="post" action="${escapeHtmlAttribute(
      NICEPAY_LAUNCH_PAGE_PATH
    )}" accept-charset="utf-8">
      ${fields}
    </form>
    <script>
      document.getElementById('locally-nicepay-launch').submit();
    </script>
  </body>
</html>`);
  popup.document.close();
}

function getNicePayApprovalId(payload: Record<string, string>) {
  return String(payload.TxTid || payload.TID || '').trim();
}

function isPaymentArtifactDescriptor(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('nicepay') ||
    normalized.includes('nice_pay') ||
    normalized.includes('pgweb') ||
    normalized.includes('nicepay-relay')
  );
}

function parseZIndex(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function cleanupCardPaymentBrowserArtifacts() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !document.body) {
    return;
  }

  const artifacts = new Set<Element>();
  const selectors = [
    'iframe[name^="nicepay-relay-"]',
    'form[name="payForm"]',
    'iframe[src*="nicepay.co.kr"]',
    'iframe[src*="nicevan.co.kr"]',
    'iframe[id*="nicepay" i]',
    'iframe[class*="nicepay" i]',
    '[id*="nicepay" i]',
    '[class*="nicepay" i]',
    '[id*="pgweb" i]',
    '[class*="pgweb" i]',
  ];

  for (const selector of selectors) {
    try {
      document.querySelectorAll(selector).forEach((element) => artifacts.add(element));
    } catch {
      // Ignore selector support differences in older WebViews.
    }
  }

  Array.from(document.body.children).forEach((element) => {
    if (element.id === '__next') return;

    const descriptor = [
      element.id,
      typeof element.className === 'string' ? element.className : '',
      element.getAttribute('name') || '',
      element.getAttribute('src') || '',
    ].join(' ');
    const text = (element.textContent || '').trim().toLowerCase();
    const style = window.getComputedStyle(element);
    const isBlockingLayer =
      (style.position === 'fixed' || style.position === 'absolute') &&
      parseZIndex(style.zIndex) >= 100;

    if (
      isPaymentArtifactDescriptor(descriptor) ||
      (isBlockingLayer && text.includes('please, wait'))
    ) {
      artifacts.add(element);
    }
  });

  artifacts.forEach((element) => {
    if (element.parentElement) {
      element.remove();
    }
  });

  document.body.style.removeProperty('overflow');
  document.documentElement.style.removeProperty('overflow');
}

function scheduleCardPaymentBrowserArtifactCleanup() {
  if (typeof window === 'undefined') return;

  window.setTimeout(() => {
    cleanupCardPaymentBrowserArtifacts();
  }, 250);
}

function requestNicePayCardPayment(params: CardPaymentLaunchParams): Promise<CardPaymentLaunchResult> {
  return new Promise((resolve, reject) => {
    const popupName = `locally-nicepay-${Date.now()}`;
    const popup = window.open(
      '',
      popupName,
      'popup=yes,width=720,height=860,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
    );

    if (!popup) {
      reject(new Error('결제창 팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.'));
      return;
    }

    cleanupCardPaymentBrowserArtifacts();

    let pollTimer = 0;
    let closePollTimer = 0;
    let hasCleanedUp = false;

    const cleanup = () => {
      if (hasCleanedUp) return;
      hasCleanedUp = true;

      window.removeEventListener('message', handleMessage);
      window.clearTimeout(pollTimer);
      window.clearInterval(closePollTimer);
      try {
        if (!popup.closed) {
          popup.close();
        }
      } catch {
        // Ignore popup lifecycle differences between browsers.
      }
      scheduleCardPaymentBrowserArtifactCleanup();
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

    try {
      submitNicePayLaunchPageInPopup(popup, params);
      popup.focus();
    } catch {
      rejectWithCleanup(new Error('결제창을 열지 못했습니다. 다시 시도해주세요.'));
      return;
    }

    closePollTimer = window.setInterval(() => {
      if (popup.closed) {
        rejectWithCleanup(new Error('결제창이 닫혔습니다. 다시 시도해주세요.'));
      }
    }, 1000);

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
