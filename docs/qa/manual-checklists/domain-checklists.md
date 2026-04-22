# Domain Manual Checklists

## How To Use
- Use this with the automated domain run report from `scripts/run-domain-qa.mjs`.
- For every canonical route, check `desktop`, `mobile`, and `tablet`.
- Public-facing routes should be checked in `ko`, `en`, `ja`, and `zh`.
- Internal admin surfaces should be checked in `ko`, then one fallback locale sanity pass if needed.
- Record outcomes in the JSON format shown in `manual-results.example.json`.

## Standard Checklist Areas
| Area | What to confirm |
| --- | --- |
| `copy` | Current state and CTA wording match the action and actor |
| `translation` | No Korean leakage in non-Korean locale, no broken fallback |
| `ux` | Flow is understandable and next step is obvious |
| `ui` | Layout, spacing, visibility, and hierarchy feel intentional |
| `a11y` | Focus, label, and visible affordance are adequate for the key path |
| `tap-target` | Buttons, tabs, chips, and inputs are large enough to use |
| `overflow` | No clipping, overlap, sticky obstruction, or scroll trap |
| `state` | Success, error, empty, loading, and stale states are correct |

## 1. Global Runtime / Auth / Locale / Routing
- Canonical routes: `/`, `/login`, `/signup`, `/guest/trips`
- Actors: `public`, `guest`, `host`, `admin`
- Required checks:
  - Auth success and redirect copy are correct.
  - Locale choice survives redirect and refresh.
  - Header/footer shell does not break on mobile.

## 2. Data Layer / RLS / RPC / Storage
- Canonical surfaces: protected APIs, upload paths, auth-required write flows
- Actors: `public`, `guest`, `host`, `admin`
- Required checks:
  - Unauthorized actor cannot reach protected writes.
  - Wrong owner cannot view or mutate foreign data.
  - Upload and asset paths do not reveal accidental public data.

## 3. Home / Search / Discovery
- Canonical routes: `/`, `/search`, `/search?city=seoul`
- Actors: `public`, `guest`
- Required checks:
  - Search labels and city pickers are localized.
  - Filter controls are tappable on mobile.
  - Card meta, pricing, and badges do not overflow.

## 4. Experience Booking / Payment / Trips
- Canonical routes: `/experiences/[id]`, `/experiences/[id]/payment`, `/guest/trips`
- Actors: `public`, `guest`
- Required checks:
  - Booking card and payment CTA are visually clear.
  - Success, cancel, and failure states match the actual booking state.
  - Trips cards and detail links remain usable after state changes.

## 5. Messaging / Inquiries / Support
- Canonical routes: `/guest/inbox`, host inquiry UI, admin inquiry or support view
- Actors: `guest`, `host`, `admin`
- Required checks:
  - Thread context is obvious.
  - Unread badges and empty states are correct.
  - Composer, send button, and thread scroll behavior work on mobile.

## 6. Reviews / Reputation / Public Host Profile
- Canonical routes: public host page, experience detail review section, admin review view
- Actors: `public`, `guest`, `host`, `admin`
- Required checks:
  - Review write/reply affordance matches actor permission.
  - Public review aggregates and masking are visually coherent.
  - Review cards and reply layout stay readable on mobile.

## 7. Host Onboarding / Approval / Transition
- Canonical routes: `/become-a-host`, `/host/register`, `/admin/dashboard`
- Actors: `public`, `host`, `admin`
- Required checks:
  - Registration and revision status copy is clear.
  - Approval results reflect immediately in host-facing UI.
  - Host landing and onboarding CTA hierarchy feels intentional.

## 8. Host Dashboard / CRUD / Schedule / Earnings
- Canonical routes: `/host/dashboard`, `/host/create`, host edit/detail pages
- Actors: `host`
- Required checks:
  - CRUD forms are usable on mobile and tablet.
  - Save/delete actions are never hidden by sticky UI.
  - Earnings cards and tabs do not overflow.

## 9. Service Marketplace
- Canonical routes: service request create, service request detail, service payment
- Actors: `guest`, `host`, `admin`
- Required checks:
  - Request -> match -> payment flow copy stays consistent.
  - Host selection and payment method state are visually obvious.
  - Chat or completion transitions are reflected in UI quickly.

## 10. Proxy Booking / Linked Inquiry
- Canonical routes: `/proxy-bookings/new`, guest proxy detail, admin proxy workspace
- Actors: `guest`, `admin`
- Required checks:
  - Self-service and admin state match.
  - Linked inquiry context is visible and correct.
  - Mobile form and fee summary are readable.

## 11. Admin Core
- Canonical routes: `/admin/dashboard`, users, alerts, chats views
- Actors: `admin`, `operator`
- Required checks:
  - Sidebar labels and active tab state are correct.
  - Core monitoring tabs render without clipping.
  - Action buttons are visible and deliberate.

## 12. Admin Finance / Ledger / Settlement
- Canonical routes: admin ledger, sales, settlement sync panels
- Actors: `admin`, `operator`
- Required checks:
  - Financial numbers are legible and grouped correctly.
  - Confirm, settle, and trigger buttons are visible and not ambiguous.
  - Health or backlog warnings are not visually buried.

## 13. Admin Team / Hotspot
- Canonical routes: admin team workspace, analytics tab
- Actors: `admin`, `operator`
- Required checks:
  - Team badge, memo, comment, and chat state are visually coherent.
  - Analytics summaries do not feel stale or overfetched.
  - Mobile and tablet layouts remain usable.

## 14. Community / Content
- Canonical routes: `/community`, `/community/[id]`
- Actors: `public`, `guest`
- Required checks:
  - Feed, author, and content card layout looks intentional.
  - Empty, paused, or filtered states are understandable.
  - Mobile typography and spacing remain stable.

## 15. Company / Brand / Help / Trust
- Canonical routes: `/about`, `/company`, `/help`, `/site-map`
- Actors: `public`
- Required checks:
  - Trust copy reads clearly and does not feel unfinished.
  - Back navigation and footer links work on mobile.
  - Static legal/help content is not clipped or visually broken.

## 16. SEO / Metadata / Domain / Analytics / Adsense
- Canonical surfaces: home metadata, dynamic detail metadata, analytics routes
- Actors: `public`, `system`
- Required checks:
  - Canonical and locale metadata match the visible page.
  - Ads or analytics gates do not break primary layout.
  - Domain and metadata behavior match cutover intent.

## 17. Email / Notifications / Delivery
- Canonical surfaces: notifications tray, notification detail, email previews
- Actors: `guest`, `host`, `admin`
- Required checks:
  - Role and event-specific copy is correct.
  - Notification badges and list items are usable on mobile.
  - Email preview spacing and CTA hierarchy remain clear.

## 18. Ops / Cron / Gate / Runbook
- Canonical surfaces: cron routes, smoke scripts, release commands
- Actors: `admin`, `operator`, `system`
- Required checks:
  - Command/runbook naming is unambiguous.
  - Environment targeting is explicit.
  - No live-facing command can be mistaken for a local-only command.

## 19. Legacy / Compat / Removal Candidates
- Canonical routes: `/payment/success`, `/become-a-host2`, legacy compat views
- Actors: `public`, `host`, `admin`
- Required checks:
  - Legacy surfaces explain current behavior correctly.
  - Alias redirects do not create confusing loops.
  - Dormant compat routes do not expose broken UX.
