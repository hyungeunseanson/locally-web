import { NextResponse } from 'next/server';

import {
  buildNicePayLaunchFields,
  getCardPaymentReadiness,
  getCurrentCardPaymentProvider,
} from '@/app/utils/payments/card/server';
import { resolveExperienceCardLaunch } from '@/app/utils/payments/card/experienceLaunch';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import {
  getProxyCategoryLabel,
  getProxyPaymentMethod,
  getProxyRequestFeeKrw,
} from '@/app/utils/proxyBooking';
import type { ProxyCategory } from '@/app/types/proxy';

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

function renderNicePayOutcomePage(params: {
  origin: string;
  message: string;
}) {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Locally NICEPAY</title>
    <script>
      const LOCALLY_RESULT_MESSAGE_TYPE = ${escapeJsonForInlineScript(NICEPAY_RESULT_MESSAGE_TYPE)};
      const LOCALLY_OPENER_ORIGIN = ${escapeJsonForInlineScript(params.origin)};
      const LOCALLY_MESSAGE = ${escapeJsonForInlineScript(params.message)};
      if (window.opener && typeof window.opener.postMessage === 'function') {
        window.opener.postMessage({
          type: LOCALLY_RESULT_MESSAGE_TYPE,
          success: false,
          message: LOCALLY_MESSAGE
        }, LOCALLY_OPENER_ORIGIN);
      }
      window.setTimeout(function () { window.close(); }, 120);
    </script>
  </head>
  <body></body>
</html>`;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const body = Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)])
  ) as CardLaunchPageBody;
  const provider = getCurrentCardPaymentProvider();
  const origin = new URL(request.url).origin;

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

  let launchOrderId = String(body.orderId || '').trim();
  let launchProductName = String(body.productName || '');
  let launchAmount = Number(body.amount || 0);
  let launchBuyerName = String(body.buyerName || '');
  let launchBuyerTel = String(body.buyerTel || '');
  let launchBuyerEmail = String(body.buyerEmail || '');

  const outcome = (message: string) => new NextResponse(
    renderNicePayOutcomePage({ origin, message }),
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  );

  if (launchOrderId.startsWith('LOCALLY-PROXY-')) {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return outcome('로그인 세션을 확인할 수 없습니다. 다시 시도해주세요.');
    }

    const { data: proxyRequest, error: proxyRequestError } = await createAdminClient()
      .from('proxy_requests')
      .select('id, user_id, category, form_data, payment_channel, payment_status, tid, locally_order_id')
      .eq('locally_order_id', launchOrderId)
      .maybeSingle();

    if (proxyRequestError || !proxyRequest || proxyRequest.user_id !== user.id) {
      return outcome('결제 요청을 확인할 수 없습니다. 다시 시도해주세요.');
    }

    if (
      proxyRequest.payment_channel !== 'LOCALLY' ||
      getProxyPaymentMethod(proxyRequest.form_data as Record<string, unknown> | null | undefined) !== 'card'
    ) {
      return outcome('카드 결제 요청만 결제창을 열 수 있습니다.');
    }

    if (String(proxyRequest.payment_status || '').toUpperCase() === 'COMPLETED' && proxyRequest.tid) {
      return outcome('이미 완료된 카드 결제입니다. 새 결제창을 열지 않습니다.');
    }

    if (
      String(proxyRequest.payment_status || '').toUpperCase() !== 'WAITING' ||
      proxyRequest.tid
    ) {
      return outcome('현재 상태에서는 카드 결제창을 열 수 없습니다.');
    }

    const storedFormData = (proxyRequest.form_data || {}) as Record<string, unknown>;
    launchOrderId = String(proxyRequest.locally_order_id || launchOrderId);
    launchAmount = getProxyRequestFeeKrw(
      String(proxyRequest.category || 'RESTAURANT') as ProxyCategory,
      storedFormData
    );
    launchProductName = `Locally ${getProxyCategoryLabel(String(proxyRequest.category || 'RESTAURANT') as ProxyCategory)}`;
    launchBuyerName = typeof storedFormData.contact_name === 'string'
      ? storedFormData.contact_name
      : launchBuyerName;
    launchBuyerTel = typeof storedFormData.contact_phone === 'string'
      ? storedFormData.contact_phone
      : launchBuyerTel;
    launchBuyerEmail = user.email || launchBuyerEmail;
  } else if (!launchOrderId.startsWith('SVC-')) {
    const launch = await resolveExperienceCardLaunch({
      supabaseServer: await createServerClient(),
      supabaseAdmin: createAdminClient(),
      requestedOrderId: launchOrderId,
      provider,
    });

    if (!launch.ok) {
      const message = launch.code === 'authentication_required'
        ? '로그인 세션을 확인할 수 없습니다. 다시 시도해주세요.'
        : '안전한 카드 결제 요청을 확인할 수 없습니다. 다시 시도해주세요.';
      return outcome(message);
    }

    launchOrderId = launch.orderId;
    launchProductName = launch.productName;
    launchAmount = launch.amount;
    launchBuyerName = launch.buyerName;
    launchBuyerTel = launch.buyerTel;
    launchBuyerEmail = launch.buyerEmail;
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
    const fields = buildNicePayLaunchFields({
      orderId: launchOrderId,
      productName: launchProductName,
      amount: launchAmount,
      buyerName: launchBuyerName,
      buyerTel: launchBuyerTel,
      buyerEmail: launchBuyerEmail,
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
