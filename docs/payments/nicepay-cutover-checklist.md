# NicePay Cutover Checklist

## Summary
- Current live-safe default is `CARD_PAYMENT_PROVIDER=portone`.
- NicePay direct code path now exists for `experience + service + proxy`, but it stays dormant until the provider env is flipped.
- Cutover goal is "no code change on launch day": only env switch, PG console registration, and focused smoke verification.

## Decision Gate
- NicePay currently exposes two official integration families.
  `start.nicepay.co.kr` documents the `AUTHNICE.requestPay + clientId + secretKey + webhook` flow.
  `developers.nicepay.co.kr` documents the legacy WebStd `goPay + AuthToken/NextAppURL + MerchantKey` flow.
- The current app implementation matches the legacy WebStd family, not the newer `AUTHNICE` family.
  Evidence in code:
  `nicepay-pg-web.js`
  `goPay(...)`
  `AuthToken`
  `NextAppURL`
  `MerchantKey`-based signature verification
- Before any production flip, confirm which NicePay product / console flow your real merchant account actually uses.
  If the real account is `AUTHNICE`-only, stop here and treat that as a separate implementation project instead of a same-day env cutover.

## Source Of Truth
- Provider boundary: [app/utils/payments/card/server.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/payments/card/server.ts)
- Client launch boundary: [app/utils/payments/card/client.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/utils/payments/card/client.ts)
- NicePay launch signing: [app/api/payment/card-launch/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/payment/card-launch/route.ts)
- NicePay relay return URL: [app/api/payment/nicepay/relay/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/payment/nicepay/relay/route.ts)
- Experience callback: [app/api/payment/nicepay-callback/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/payment/nicepay-callback/route.ts)
- Service callback: [app/api/services/payment/nicepay-callback/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/services/payment/nicepay-callback/route.ts)
- Proxy callback: [app/api/proxy-bookings/payment/nicepay-callback/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/proxy-bookings/payment/nicepay-callback/route.ts)
- Experience notification: [app/api/payment/card-notification/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/payment/card-notification/route.ts)
- Service notification: [app/api/services/payment/card-notification/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/services/payment/card-notification/route.ts)
- Proxy notification: [app/api/proxy-bookings/payment/card-notification/route.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/app/api/proxy-bookings/payment/card-notification/route.ts)

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
- `NICEPAY_CLIENT_KEY`
- `NEXT_PUBLIC_NICEPAY_CLIENT_KEY`

### Mapping from the NicePay / Imweb side
- `MID` -> `NICEPAY_MID`
- `SIGN KEY` -> `NICEPAY_MERCHANT_KEY`
- `MID + SIGN KEY` map to the current WebStd implementation.
- `client key` and `secret key` belong to the newer `AUTHNICE` / Start NicePay guide and should not be treated as the same thing as `SIGN KEY`.
- The current project still keeps `NICEPAY_CLIENT_KEY` and `NEXT_PUBLIC_NICEPAY_CLIENT_KEY` in the env contract as a cutover guardrail, but the active approval algorithm in code is still the WebStd `MerchantKey` path.

## Cutover Day Checklist
1. Rotate any exposed NicePay merchant key first.
   If the previously pasted `SIGN KEY` was real, rotate it before any live wiring.
2. Fill the full NicePay env bundle in the target environment.
   Do not flip `CARD_PAYMENT_PROVIDER` yet.
3. Verify readiness first.
   `GET /api/payment/card-ready` and `GET /api/services/payment/card-ready` must both return `provider: "nicepay"`, `ready: true`, and an empty `missingConfig`.
4. Register only the provider-facing URLs in the PG console.
   Relay return URL: `https://<domain>/api/payment/nicepay/relay`
   Notification URL: confirm the exact NicePay registration model first.
   If NicePay supports flow-specific notification URLs, register the matching route.
   If NicePay supports only one global notification URL, do not flip production until that routing model is explicitly settled.
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
- Notification routes are idempotent by `orderId` first, then `providerTransactionId` fallback.
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

## Open Operational Checks
- Confirm the actual NicePay notification registration model before production flip.
- Confirm the real NicePay direct client key issuance path; the code requires a real `NEXT_PUBLIC_NICEPAY_CLIENT_KEY`.
- PayPal remains intentionally out of scope for this cutover.
