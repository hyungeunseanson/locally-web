# NICEPAY Cutover Checklist

## Current card boundary
- Client launch: [app/utils/payments/card/client.ts](/Users/sonhyungeun/Documents/locally-web/app/utils/payments/card/client.ts)
- Server readiness / approval verify / cancel / notification parsing: [app/utils/payments/card/server.ts](/Users/sonhyungeun/Documents/locally-web/app/utils/payments/card/server.ts)
- Experience card callback: [app/api/payment/nicepay-callback/route.ts](/Users/sonhyungeun/Documents/locally-web/app/api/payment/nicepay-callback/route.ts)
- Service card callback: [app/api/services/payment/nicepay-callback/route.ts](/Users/sonhyungeun/Documents/locally-web/app/api/services/payment/nicepay-callback/route.ts)
- Experience card noti placeholder: [app/api/payment/card-notification/route.ts](/Users/sonhyungeun/Documents/locally-web/app/api/payment/card-notification/route.ts)
- Service card noti placeholder: [app/api/services/payment/card-notification/route.ts](/Users/sonhyungeun/Documents/locally-web/app/api/services/payment/card-notification/route.ts)

## Environment variables to wire at cutover
- `NICEPAY_MID`
- `NICEPAY_MERCHANT_KEY`
- `NICEPAY_CLIENT_KEY` (project placeholder for future server-side direct auth config)
- `NEXT_PUBLIC_NICEPAY_CLIENT_KEY` (project placeholder for future client-side direct auth config)

## Last-mile implementation points
- Flip `CURRENT_CARD_PAYMENT_PROVIDER` in [app/utils/payments/card/server.ts](/Users/sonhyungeun/Documents/locally-web/app/utils/payments/card/server.ts) once NICEPAY direct is ready.
- Replace `launchCardPayment()` PortOne branch with NICEPAY direct client auth request.
- Replace `verifyApprovedCardPayment()` NICEPAY branch with server-side approval verification.
- Remove the remaining PortOne script / `NEXT_PUBLIC_PORTONE_IMP_CODE` dependency from [app/experiences/[id]/payment/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/experiences/[id]/payment/page.tsx) and [app/services/[requestId]/payment/page.tsx](/Users/sonhyungeun/Documents/locally-web/app/services/[requestId]/payment/page.tsx) when the client branch switches.
- Keep booking / service_booking status updates inside the existing callback routes.
- Implement `POST /api/payment/card-notification` idempotently by `orderId -> providerTransactionId`.
- Implement `POST /api/services/payment/card-notification` idempotently by `orderId -> providerTransactionId`.
- Keep `cancelCardPayment()` on the NICEPAY cancel API unless NICEPAY contract requires a different endpoint.

## Status update locations
- Experience: `bookings.status = 'PAID'`, `payment_method = 'card'`, `tid = provider transaction id`
- Service: `service_bookings.status = 'PAID'`, `payment_method = 'card'`, `tid = provider transaction id`, then `service_requests.status = 'open'`

## Out of scope in this phase
- Live NICEPAY credential wiring
- NICEPAY script / SDK injection
- DB schema changes
- PayPal cleanup
