# NicePay Cutover Checklist

## Summary
- Current live-safe default is `CARD_PAYMENT_PROVIDER=portone`.
- NicePay direct code path now exists for `experience + service + proxy`, but it stays dormant until the provider env is flipped.
- This cutover document is intentionally `WebStd`-only.
- Cutover goal is "no code change on launch day": only env switch, PG console registration, and focused smoke verification.

## Decision Gate
- NicePay currently exposes two official integration families.
  `start.nicepay.co.kr` documents the `AUTHNICE.requestPay + clientId + secretKey + webhook` flow.
  `developers.nicepay.co.kr` documents the legacy WebStd `goPay + AuthToken/NextAppURL + MerchantKey` flow.
- The current app implementation matches the legacy WebStd family, not the newer `AUTHNICE` family.
  Evidence in code:
  `https://pg-web.nicepay.co.kr/v3/common/js/nicepay-pgweb.js`
  `goPay(...)`
  `AuthToken`
  `NextAppURL`
  `MerchantKey`-based signature verification
- `AUTHNICE` is an explicit no-go condition for this path.
  If the real merchant account is `AUTHNICE`-only, stop here and treat that as a separate implementation project instead of a same-day env cutover.

## Source Of Truth
- Provider boundary: [app/utils/payments/card/server.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/payments/card/server.ts)
- Client launch boundary: [app/utils/payments/card/client.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/payments/card/client.ts)
- NicePay launch signing: [app/api/payment/card-launch/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/payment/card-launch/route.ts)
- NicePay relay return URL: [app/api/payment/nicepay/relay/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/payment/nicepay/relay/route.ts)
- NicePay notification dispatcher: [app/api/payment/cardNotificationHandler.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/payment/cardNotificationHandler.ts)
- Experience callback: [app/api/payment/nicepay-callback/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/payment/nicepay-callback/route.ts)
- Service callback: [app/api/services/payment/nicepay-callback/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/services/payment/nicepay-callback/route.ts)
- Proxy callback: [app/api/proxy-bookings/payment/nicepay-callback/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/proxy-bookings/payment/nicepay-callback/route.ts)
- Primary merchant-facing notification URL: [app/api/payment/card-notification/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/payment/card-notification/route.ts)
- Compatibility wrappers only: [app/api/services/payment/card-notification/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/services/payment/card-notification/route.ts), [app/api/proxy-bookings/payment/card-notification/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/proxy-bookings/payment/card-notification/route.ts)

## Env Contract
### Keep as-is for current live path
- `CARD_PAYMENT_PROVIDER=portone`
- `NEXT_PUBLIC_PORTONE_IMP_CODE`
- `PORTONE_API_KEY`
- `PORTONE_API_SECRET`

### Required full NicePay bundle before cutover
- `CARD_PAYMENT_PROVIDER=nicepay`
- `NICEPAY_MID`
- `NICEPAY_MERCHANT_KEY`

### Mapping from the NicePay / Imweb side
- `MID` -> `NICEPAY_MID`
- `SIGN KEY` -> `NICEPAY_MERCHANT_KEY`
- `MID + SIGN KEY` map to the current WebStd implementation and are the only code-required credentials in this path.
- `client key` and `secret key` belong to the newer `AUTHNICE` / Start NicePay guide and are out of scope for this WebStd cutover.

## Official WebStd Endpoints Locked In Code
- JS SDK: `https://pg-web.nicepay.co.kr/v3/common/js/nicepay-pgweb.js`
- Approval follow-up: `NextAppURL` returned by NicePay auth response
- Status query: `https://webapi.nicepay.co.kr/webapi/inquery/trans_status.jsp`
- Cancel / refund: `https://webapi.nicepay.co.kr/webapi/cancel_process.jsp`

## Cutover Day Checklist
1. Rotate any exposed NicePay merchant key first.
   If the previously pasted `SIGN KEY` was real, rotate it before any live wiring.
2. Fill the WebStd NicePay env bundle in the target environment.
   Do not flip `CARD_PAYMENT_PROVIDER` yet.
3. Verify readiness first.
   `GET /api/payment/card-ready` and `GET /api/services/payment/card-ready` must both return `provider: "nicepay"`, `ready: true`, and an empty `missingConfig`.
4. Register only the provider-facing URLs in the PG console.
   Relay return URL: `https://<domain>/api/payment/nicepay/relay`
   Primary notification URL: `https://<domain>/api/payment/card-notification`
   Do not register the service / proxy compatibility routes as merchant console targets.
5. Run the focused regression bundle before the final env flip.
   `tests/e2e/19-service-card-verification.spec.ts`
   `tests/e2e/21-service-payment-method-lock.spec.ts`
   `tests/e2e/24-experience-card-verification.spec.ts`
   `tests/e2e/44-experience-card-payment-ui.spec.ts`
   `tests/e2e/74-card-payment-precutover-contract.spec.ts`
   `tests/e2e/76-card-callback-contract.spec.ts`
   `tests/e2e/165-card-payment-provider-cutover.spec.ts`
6. Flip `CARD_PAYMENT_PROVIDER=nicepay`.
   No product code change should be needed.
7. Run manual smoke in this order.
   Experience card payment -> complete page
   Service card payment -> `service_bookings.status='PAID'` and `service_requests.status='open'`
   Proxy card payment -> `payment_status='COMPLETED'`

## Locked Behavior After Cutover
- Status meaning must not change.
  Experience: `bookings.status='PAID'`, `payment_method='card'`, `tid=<provider transaction id>`
  Service: `service_bookings.status='PAID'`, `payment_method='card'`, `tid=<provider transaction id>`, then `service_requests.status='open'`
  Proxy: existing proxy confirmation semantics stay unchanged, only provider verification path changes
- Browser-side internal callbacks stay app-owned and are not PG console registration targets.
  Experience: `/api/payment/nicepay-callback`
  Service: `/api/services/payment/nicepay-callback`
  Proxy: `/api/proxy-bookings/payment/nicepay-callback`
- Merchant-facing notification ownership is now one primary route.
  Primary registration target: `/api/payment/card-notification`
  Dispatch rules:
  `SVC-*` order ids -> service bookings first
  `LOCALLY-PROXY-*` order ids -> proxy requests first
  all other order ids -> experience bookings first
  missing order id -> `providerTransactionId` fallback across owners
- Compatibility notification routes stay available for internal seams and legacy-safe testing.
- Notification handling is idempotent by `orderId` first, then `providerTransactionId` fallback.
- Proxy callback and proxy notification intentionally differ only at the entry boundary.
  Callback keeps owner/auth guard for the browser return.
  Notification is server-to-server and skips owner guard.
  Both converge on the same `finalizeProxyCardPayment()` write path.
- If provider remains `portone`, the notification routes stay inert and return `202 ignored`.

## Verified On 2026-04-11
- Focused regression bundle passed under `playwright.contracts.config.ts`.
- Result: `20 passed`
- Included coverage:
  PortOne current-path smoke
  callback ownership / idempotency
  service payment-method lock
  NicePay readiness / launch field / approval / notification contracts

## Verified On 2026-04-12
- `tests/e2e/165-card-payment-provider-cutover.spec.ts`
- proxy NicePay callback + notification route-level contract rerun passed
- Included coverage:
  proxy callback unauthenticated guard
  proxy callback owner guard
  proxy callback idempotent replay
  proxy callback route-level confirmation
  proxy notification `orderId` lookup
  proxy notification `providerTransactionId` fallback lookup
  proxy notification idempotent replay

## Open Operational Checks
- Confirm the merchant console / service-change process accepts the new production domain for the same business entity.
- Confirm the production MID is enabled for the target card methods you plan to expose.
- Confirm the production merchant console registration uses the single primary notification URL and relay return URL above.
- PayPal remains intentionally out of scope for this cutover.
