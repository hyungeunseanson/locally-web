import { NextResponse } from 'next/server';

import {
  buildNicePayLaunchFields,
  getCardPaymentReadiness,
  getCurrentCardPaymentProvider,
} from '@/app/utils/payments/card/server';

const NICEPAY_RESULT_MESSAGE_TYPE = 'locally:nicepay-result';
const NICEPAY_SCRIPT_SRC = 'https://pg-web.nicepay.co.kr/v3/common/js/nicepay-pgweb.js';

type CardLaunchPageBody = {
  provider?: string;
  orderId?: string;
  productName?: string;
  amount?: string;
  buyerName?: string;
  buyerTel?: string;
  buyerEmail?: string;
};

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

function renderNicePayLaunchPage(params: {
  origin: string;
  formAction: string;
  fields: Record<string, string>;
}) {
  const fieldInputs = Object.entries(params.fields)
    .map(
      ([key, value]) =>
        `<input type="hidden" name="${escapeHtmlAttribute(key)}" value="${escapeHtmlAttribute(
          value
        )}" />`
    )
    .join('\n');

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
      const LOCALLY_RESULT_MESSAGE_TYPE = ${escapeJsonForInlineScript(NICEPAY_RESULT_MESSAGE_TYPE)};
      window.__LOCALLY_OPENER_ORIGIN__ = ${escapeJsonForInlineScript(params.origin)};

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
    <form name="payForm" method="post" action="${escapeHtmlAttribute(
      params.formAction
    )}" accept-charset="euc-kr">
      ${fieldInputs}
    </form>
    <script src="${escapeHtmlAttribute(NICEPAY_SCRIPT_SRC)}" onload="nicepayStart()" onerror="postToOpener({ type: LOCALLY_RESULT_MESSAGE_TYPE, success: false, message: 'NICEPAY 결제 모듈을 불러오지 못했습니다.' })"></script>
  </body>
</html>`;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const body = Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)])
  ) as CardLaunchPageBody;
  const provider = getCurrentCardPaymentProvider();

  if (provider !== 'nicepay') {
    return NextResponse.json(
      {
        success: false,
        error: 'Card launch page is only used for NICEPAY direct payments.',
        provider,
      },
      { status: 409 }
    );
  }

  if ((body.provider || '').trim() && body.provider !== provider) {
    return NextResponse.json(
      {
        success: false,
        error: 'Requested provider does not match the configured card provider.',
      },
      { status: 400 }
    );
  }

  const readiness = getCardPaymentReadiness();
  if (!readiness.ready || !readiness.runtime) {
    return NextResponse.json(
      {
        success: false,
        error: 'Card payment is not ready.',
        provider: readiness.provider,
        missingConfig: readiness.missingConfig || [],
      },
      { status: 503 }
    );
  }

  try {
    const origin = new URL(request.url).origin;
    const fields = buildNicePayLaunchFields({
      orderId: String(body.orderId || ''),
      productName: String(body.productName || ''),
      amount: Number(body.amount || 0),
      buyerName: String(body.buyerName || ''),
      buyerTel: String(body.buyerTel || ''),
      buyerEmail: String(body.buyerEmail || ''),
      returnUrl: `${origin}/api/payment/nicepay/relay`,
    });

    return new NextResponse(
      renderNicePayLaunchPage({
        origin,
        formAction: '/api/payment/nicepay/relay',
        fields,
      }),
      {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'NICEPAY 결제 시작 페이지 생성에 실패했습니다.';

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 400 }
    );
  }
}
