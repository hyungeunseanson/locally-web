# Home public payload usage and local benchmark

Starting main: `9ecbdf6dc35e5a0343fcbce54dd97f04b6be6b61`.

## Field usage audit

All fields of the previous `PublicHomeExperience` contract were traced through
`HomePageClient`, `HomeExperienceCard`, `ExperienceCardMeta`,
`useExperienceFilter`, `homeExperienceSections`, `search/searchText`,
`contentHelper`, `locationLocalization`, and `experienceImages`.
`fetchActiveExperiences` and the Home SSR page are the only application consumers
of this public Home dataset. Search/detail use separate contracts, unchanged here.

| Fields | Classification | Consumer / decision |
| --- | --- | --- |
| id | USED | Detail link, card/image identity, reveal/order identity |
| title, title_ko, title_en, title_ja, title_zh | USED | `getContent` localization and `buildSearchHaystack`; keep Korean override too |
| category, category_en, category_ja, category_zh | USED | Localized label/icon and multilingual search |
| city, country, location | USED | City aliases/filter and localized card location |
| languages | USED | Language filter and card badges |
| price, duration, rating | USED | Card metadata |
| review_count | USED | Popular ranking tie-break (even though Home hides the review-count label) |
| created_at | USED | Latest order and popular tie-break |
| wishlist_count | USED | Popular order and hint |
| public_image_r2_eligible | USED | Existing deterministic media-reader eligibility |
| card_image_url | USED | Normalized card image, including the existing missing-image fallback |
| host_id | SERVER-ONLY | Approved-host visibility; stays in DB SELECT, omitted from public projection |
| photos, image_url | SERVER-ONLY | Existing resolver normalizes primary/blank/trimmed/fallback URL on server; omit duplicated source fields |
| is_superhost | UNUSED | No Home card/filter/order consumer; remove payload, extra host SELECT column and set construction |
| available_dates | UNUSED while date OFF | No enabled filter consumer; omit SELECT, map and payload field; restored when shared flag is ON |

`status`/`is_active` were already SERVER-ONLY and remain server-only.
The legacy optional image fields on `HomeExperienceCardData` remain accepted for
old client snapshots/test mocks; current public data contains only `card_image_url`.
The shared image helper and search/detail image priority are unchanged.

## Query and cache behavior

`app/home/homeSearchConfig.ts` is the shared source of truth for the server loader
and client filter. OFF issues three parallel public SELECTs, no availability map,
and no `available_dates` property. ON issues four parallel SELECTs and returns the
visible experiences' date arrays. The cache key includes the flag so OFF and ON
snapshots cannot collide. `unstable_cache`, 300-second TTL, visibility rules,
query limits, popularity fail-open behavior, and ranking are preserved.
No Cloudflare/R2/cache configuration changes or manual cache invalidation.

## Local production benchmark

Same synthetic 33-experience fixture as the previous SSR benchmark. Both revisions
use Next production builds, Node 24, loopback HTTP, identity encoding, 3 warm-ups
then 15 sequential samples per route. Browser checks block external traffic and
writes, compare before/after card order, image URLs, widths, and test load more.
The fixture's non-GET requests are rejected; fixture writes = 0.

The exact benchmark runner and raw outputs are local artifacts under
`/Users/hyungeunseanson/Documents/Codex/2026-10-01/home-public-payload`.

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Home API JSON bytes | 22762 | 16129 | -29.1% |
| Serialized experience array bytes | 22753 | 16120 | -29.2% |
| Home HTML bytes | 260373 | 253146 | -2.8% |
| Home completion median (ms) | 16.436 | 15.216 | -7.4% |
| API completion median (ms) | 6.882 | 5.160 | -25.0% |
| Source queries per cold load | 4 | 3 | -25.0% |
| Initial SSR card nodes | 34 | 34 | +0.0% |

Warm measured Home and API samples issued zero Home source SELECTs in both
revisions. Cold source count is per loader execution, excluding unrelated layout
reads and build-time prerender requests. API JSON includes its `{data: ...}` envelope;
serialized payload counts only the experience array. SSR still sends 34 section
cards (10 popular + 24 latest); mobile exposes 12 latest initially, desktop 24.

Payload/HTML reductions are deterministic for this fixture. Small local timing
samples have runtime variance and do not establish Production Worker CPU/latency
improvement. No Production requests or deployments were performed for this task.

## Validation

- Home/filter/search/localization/order/meta regressions: 23 passing tests.
- Home splash/preload/visibility/parallel-query suite: 19 passing tests.
- New payload/date-flag/image/cache-fallback tests: 10 passing tests.
- Local Next production cache and responsive SSR suites: 2 passing tests.
- Production build/deploy contracts: 123 passing tests.
- TypeScript and tracked-source lint: PASS (7 existing warnings, 0 errors).
- Next production build, OpenNext production build, Wrangler Production dry-run,
  and `git diff --check`: PASS.

The live Supabase-mutating search fixture suite (58) was not executed; its Home
date expectation was updated to the OFF contract. Search filtering is covered by
local mocked browser tests. All new loader tests use injected read-only clients;
production cache/SSR tests use loopback fixtures. The splash tests isolate external
reads/writes and wait for hydration before clicking the locale menu.
