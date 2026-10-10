import { NextResponse } from 'next/server';
import { verifyNicePayAuthPayload } from '@/app/utils/payments/card/server';
import { observeNicePayAuth } from '@/app/utils/payments/card/nicepayRecovery';
import { createAdminClient } from '@/app/utils/supabase/admin';

function escapeJsonForInlineScript(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function renderRelayHtml(params: {
  origin: string;
  payload: Record<string, string>;
}) {
  const payloadJson = escapeJsonForInlineScript(params.payload);
  const messageJson = escapeJsonForInlineScript({
    type: 'locally:nicepay-result',
    success: params.payload.AuthResultCode === '0000',
    cancelled: params.payload.AuthResultCode === '2001',
    message:
      params.payload.AuthResultMsg ||
      (params.payload.AuthResultCode === '0000'
        ? '결제가 완료되었습니다.'
        : '결제가 취소되었거나 승인에 실패했습니다.'),
    payload: params.payload,
  });

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Locally Payment Relay</title>
  </head>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;color:#0f172a;">
    <p style="margin:0 0 8px;font-weight:700;">결제 응답을 처리하고 있습니다.</p>
    <p style="margin:0;color:#475569;font-size:14px;">창이 자동으로 닫히지 않으면 이전 화면으로 돌아가 주세요.</p>
    <script>
      (function () {
        const origin = ${escapeJsonForInlineScript(params.origin)};
        const payload = ${payloadJson};
        const message = ${messageJson};
        const target = window.parent && window.parent !== window ? window.parent : window.opener;

        if (target && typeof target.postMessage === 'function') {
          target.postMessage(message, origin);
        }

        window.setTimeout(function () {
          try {
            window.close();
          } catch (error) {
            console.error('nicepay relay close failed', error);
          }
        }, 120);

        window.__LOCALLY_NICEPAY_PAYLOAD__ = payload;
      })();
    </script>
  </body>
</html>`;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const payload = Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)])
  );
  let relayPayload = payload;
  if (payload.AuthResultCode === '0000' && String(payload.Moid || '').startsWith('ORD-')) {
    try {
      const client = createAdminClient();
      const { data: booking, error } = await client.from('bookings')
        .select('id, order_id, amount, payment_provider')
        .eq('order_id', payload.Moid).maybeSingle();
      if (error || !booking || booking.payment_provider !== 'nicepay') {
        throw new Error('NICEPAY relay booking mismatch');
      }
      const auth = verifyNicePayAuthPayload({
        providerPayload: payload, orderId: booking.order_id,
        expectedAmount: Number(booking.amount),
      });
      await observeNicePayAuth({
        client, bookingId: booking.id, orderId: auth.orderId!,
        tid: auth.tid, mid: auth.mid, amount: auth.amount,
      });
    } catch {
      // No approval can begin without the durable auth gate.
      relayPayload = { AuthResultCode: 'PHASE2_RETRY', AuthResultMsg: '결제 상태 확인이 지연되고 있습니다. 예약 상태를 다시 확인해 주세요.' };
    }
  }
  const html = renderRelayHtml({
    origin: new URL(request.url).origin,
    payload: relayPayload,
  });

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
