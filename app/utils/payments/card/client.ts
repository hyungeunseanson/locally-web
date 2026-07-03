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
const NICEPAY_SCRIPT_SRC = 'https://pg-web.nicepay.co.kr/v3/common/js/nicepay-pgweb.js';

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

function escapeHtmlAttribute(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeJsonForInlineScript(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function buildNicePayPopupHtml(envelope: NicePayLaunchEnvelope, openerOrigin: string) {
  const fieldInputs = Object.entries(envelope.fields || {})
    .map(
      ([key, value]) =>
        `<input type="hidden" name="${escapeHtmlAttribute(key)}" value="${escapeHtmlAttribute(
          value
        )}" />`
    )
    .join('\n');
  const resultTypeJson = escapeJsonForInlineScript(NICEPAY_RESULT_MESSAGE_TYPE);
  const openerOriginJson = escapeJsonForInlineScript(openerOrigin);
  const scriptSrcJson = escapeJsonForInlineScript(NICEPAY_SCRIPT_SRC);
  const formAction = escapeHtmlAttribute(envelope.formAction || '');

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Locally NICEPAY</title>
    <style>
      html, body { height: 100%; margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; }
      .fallback { min-height: 100%; display: grid; place-items: center; text-align: center; padding: 24px; box-sizing: border-box; }
      .fallback strong { display: block; font-size: 17px; margin-bottom: 8px; }
      .fallback span { color: #64748b; font-size: 14px; }
      form { overflow: hidden; height: 0; }
    </style>
    <script>
      const LOCALLY_RESULT_MESSAGE_TYPE = ${resultTypeJson};
      window.__LOCALLY_OPENER_ORIGIN__ = ${openerOriginJson};

      function postToOpener(message) {
        if (window.opener && typeof window.opener.postMessage === 'function') {
          window.opener.postMessage(message, window.__LOCALLY_OPENER_ORIGIN__);
        }
      }

      window.addEventListener('message', function receiveNicePayRelay(event) {
        if (event.origin !== window.__LOCALLY_OPENER_ORIGIN__) return;
        const data = event.data || {};
        if (data.type !== LOCALLY_RESULT_MESSAGE_TYPE) return;
        postToOpener(data);
        window.setTimeout(function () {
          window.close();
        }, 120);
      });

      function nicepayStart() {
        if (typeof window.goPay !== 'function') {
          postToOpener({
            type: LOCALLY_RESULT_MESSAGE_TYPE,
            success: false,
            message: 'NICEPAY 결제 모듈을 불러오지 못했습니다.'
          });
          return;
        }
        window.goPay(document.payForm);
      }

      function nicepaySubmit() {
        document.payForm.submit();
      }

      function nicepayClose() {
        postToOpener({
          type: LOCALLY_RESULT_MESSAGE_TYPE,
          success: false,
          cancelled: true,
          message: '결제가 취소되었습니다.'
        });
        window.setTimeout(function () {
          window.close();
        }, 120);
      }
    </script>
  </head>
  <body>
    <div class="fallback">
      <div>
        <strong>NICEPAY 결제창을 여는 중입니다.</strong>
        <span>창을 닫지 말고 잠시만 기다려 주세요.</span>
      </div>
    </div>
    <form name="payForm" method="post" action="${formAction}" accept-charset="euc-kr">
      ${fieldInputs}
    </form>
    <script>
      (function loadNicePayScript() {
        const script = document.createElement('script');
        script.src = ${scriptSrcJson};
        script.onload = function () {
          nicepayStart();
        };
        script.onerror = function () {
          postToOpener({
            type: LOCALLY_RESULT_MESSAGE_TYPE,
            success: false,
            message: 'NICEPAY 결제 모듈을 불러오지 못했습니다.'
          });
        };
        document.body.appendChild(script);
      })();
    </script>
  </body>
</html>`;
}

function writeNicePayPopupLoading(popup: Window) {
  try {
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
    </style>
  </head>
  <body>
    <main>
      <strong>NICEPAY 결제 준비 중입니다.</strong><br />
      <span>잠시만 기다려 주세요.</span>
    </main>
  </body>
</html>`);
    popup.document.close();
  } catch {
    // The popup may already be navigating or blocked from document access.
  }
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
    const popup = window.open(
      '',
      `locally-nicepay-${Date.now()}`,
      'popup=yes,width=720,height=860,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
    );

    if (!popup) {
      reject(new Error('결제창 팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.'));
      return;
    }

    writeNicePayPopupLoading(popup);
    cleanupCardPaymentBrowserArtifacts();

    let pollTimer = 0;
    let closePollTimer = 0;
    let hasCleanedUp = false;
    let popupObjectUrl: string | null = null;

    const cleanup = () => {
      if (hasCleanedUp) return;
      hasCleanedUp = true;

      window.removeEventListener('message', handleMessage);
      window.clearTimeout(pollTimer);
      window.clearInterval(closePollTimer);
      if (popupObjectUrl) {
        URL.revokeObjectURL(popupObjectUrl);
        popupObjectUrl = null;
      }
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

    requestNicePayLaunchEnvelope(params)
      .then((envelope) => {
        if (popup.closed) {
          rejectWithCleanup(new Error('결제창이 닫혔습니다. 다시 시도해주세요.'));
          return;
        }

        try {
          popupObjectUrl = URL.createObjectURL(
            new Blob([buildNicePayPopupHtml(envelope, window.location.origin)], {
              type: 'text/html;charset=utf-8',
            })
          );
          popup.location.href = popupObjectUrl;
          popup.focus();
        } catch {
          rejectWithCleanup(new Error('결제창을 열지 못했습니다. 다시 시도해주세요.'));
        }
      })
      .catch((error: unknown) => {
        rejectWithCleanup(
          error instanceof Error ? error : new Error('NICEPAY 결제 준비에 실패했습니다.')
        );
      });

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
