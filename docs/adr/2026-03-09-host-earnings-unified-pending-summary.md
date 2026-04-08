# ADR: Host Earnings Unified Pending Summary

- Status: Accepted
- Date: 2026-03-09

## Context

The host dashboard originally split earnings into separate `experience` and `service`
tabs. That isolated data sources well, but it made the first screen harder to scan.
Hosts care first about one question: "How much is currently waiting to be paid out?"

At the same time, the two domains do not share the same business flow:

- Experience earnings can exist in `completed`, `confirmed`, and cancellation payout states.
- Service earnings can exist in `completed`, `PAID`, and `confirmed` states.
- Both domains use different fee policies and different operational timing.

This means a naive "total income" number is misleading unless the payout stage semantics
are normalized first.

## Decision

We adopted a unified top-level metric:

- `Unified pending payout total`

This value is defined as:

- `experience.pending_payout_amount + service.pending_payout_amount`

The top-level total explicitly excludes:

- `in_progress`
- `paid`

## Domain Alignment

To make the top-level number meaningful, both domains are mapped onto the same three-stage
settlement model:

- `pending`
- `in_progress`
- `paid`

Experience mapping:

- `pending`: `completed` bookings and cancellation payout rows with positive host payout
- `in_progress`: `PAID` and `confirmed`
- `paid`: `payout_status = paid`

Service mapping:

- `pending`: `completed` and not yet paid out
- `in_progress`: `PAID` and `confirmed`
- `paid`: `payout_status = paid`

This keeps the main total semantically stable while still preserving domain-specific detail
below the fold.

## BFF Pattern

We introduced:

- `GET /api/host/earnings/summary`

Reasons:

1. The frontend must not add experience and service numbers on its own.
2. The server is the single place that knows the normalized payout-stage rules.
3. The top hero and breakdown card must render from one payload to avoid partial totals.

The summary route is the only source of truth for:

- `total_pending_payout_amount`
- `total_in_progress_amount`
- `total_paid_amount`
- per-domain breakdown

Detailed drilldown remains separated:

- experience detail stays in the experience panel
- service detail stays in `/api/host/earnings/services`

## Loading UI Contract

We adopted a strict `skeleton-at-once` contract for the unified top summary.

Reasons:

1. A partial render would show a misleading temporary total.
2. Experience and service data can arrive at different times.
3. A stable skeleton is easier to understand on mobile than a changing number.

Contract:

- While the summary is loading, both top blocks remain skeletons.
- The top blocks reveal together only after the summary payload is complete.
- Detailed panels may load independently after that.

## Mobile-First Layout

The first mobile viewport is reserved for:

1. Unified pending payout hero
2. Source breakdown card

This keeps the three most important facts visible without scrolling:

- total pending payout
- experience pending payout
- service pending payout

Lower-priority detail stays below:

- experience detail accordion
- service detail accordion

## Consequences

Positive:

- Hosts get a faster answer to the payout question.
- The main figure is harder to misread as "all-time income".
- Experience and service detail remain separated for support and audit work.

Tradeoffs:

- The summary route scans both domains and can become heavier as host history grows.
- The frontend now depends on one BFF for the top section, so route health matters more.

## Guardrails

- The frontend must never compute the unified total itself.
- `pending` totals must exclude `in_progress` amounts.
- Drilldown panels must remain source-specific even though the top summary is unified.
- Invalid or missing `latest_paid_at` values must fail open and render as empty text.

## Validation

The implementation is guarded by:

- unified summary contract tests
- waterfall/skeleton rendering tests
- mobile first-fold layout tests
- regression tests that verify service data does not contaminate experience detail values

## Known Residual Risks

- The summary route currently reads host earnings rows directly and aggregates in the app
  layer. This is safe for current data volume but may need DB-side aggregation or pagination
  if very large hosts appear.
- Test coverage does not yet include an explicit summary `401` contract or a no-data/empty-host
  route case.
