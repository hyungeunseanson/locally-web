# Next.js 16.3.5 security update

This change pins `next` and `eslint-config-next` from `16.2.4` to the stable `16.3.5` release. It does not deploy either runtime and it does not activate the dormant public-experience media producer.

## Advisory disposition

The pre-update npm audit reported every advisory below against the direct `next@16.2.4` dependency. The installed version was inside each affected range; `16.3.5` is above the corresponding patched boundary.

| Advisory | Affected Next 16 range | First patched 16.x | Locally execution condition |
| --- | --- | --- | --- |
| `GHSA-8h8q-6873-q5fj`, `GHSA-3g8h-86w9-wvmq`, `GHSA-ffhc-5mcf-pf4q`, `GHSA-vfv6-92ff-j949`, `GHSA-gx5p-jg67-6x7h`, `GHSA-mg66-mrh9-m8jx`, `GHSA-h64f-5h5j-jqjh`, `GHSA-c4j6-fc7j-m34r`, `GHSA-492v-c6pp-mqqv`, `GHSA-wfc6-r584-vfw7`, `GHSA-267c-6grr-h53f`, `GHSA-36qx-fr4f-26g5` | `>=16.0.0 <16.2.5` | `16.2.5` | The repository uses App Router, RSC, rewrites, and image handling. Some middleware, Cache Components, Pages Router, CSP-nonce, or WebSocket-specific prerequisites are absent or unconfirmed; the framework is patched rather than relying on those distinctions. |
| `GHSA-26hh-7cqf-hhc6` | `>=16.0.0 <16.2.6` | `16.2.6` | App Router is active. No proxy-only assumption is used as a mitigation. |
| `GHSA-6gpp-xcg3-4w24`, `GHSA-m99w-x7hq-7vfj`, `GHSA-89xv-2m56-2m9x`, `GHSA-68g3-v927-f742`, `GHSA-4633-3j49-mh5q`, `GHSA-4c39-4ccg-62r3`, `GHSA-p9j2-gv94-2wf4`, `GHSA-q8wf-6r8g-63ch`, `GHSA-955p-x3mx-jcvp` | `>=16.0.0 <16.2.11` | `16.2.11` | Locally has App Router Server Actions and rewrites, so the Server Action, RSC, and rewrite classes are treated as applicable or potentially applicable on both hosting targets. The managed-Vercel host pin and non-Edge action details reduce only particular prerequisites, not the need to update. |
| `GHSA-p293-qw3h-jr36` | `>=16.0.0 <16.3.3` | `16.3.3` | The published prerequisite is a Windows-hosted server. Vercel and the Cloudflare Worker are not Windows-hosted, but the dependency is still patched. |
| `GHSA-2xp9-vwfh-vxw4` | `>=16.0.0 <16.3.3` | `16.3.3` | Locally uses `next/image` with remote sources. `formats: ['image/webp']` describes output negotiation and is not treated as proof that hostile AVIF input is impossible. Vercel's optimizer is a direct path; OpenNext uses the Cloudflare `IMAGES` binding, while CI reconciliation uses its separate Sharp path. |

`next@16.3.5` brings `sharp@0.35.4` into the Next image path. The Next-only PostCSS override is raised from `8.5.12` to the version declared by this release, `8.5.23`, so it does not reintroduce the audited PostCSS advisory. Independent advisories in Nodemailer, Undici, ws, Wrangler/Miniflare, Sentry, and other development tooling are intentionally not upgraded in this focused PR.

## Platform paths checked

- Vercel: the Next.js image optimizer, App Router, RSC, Server Actions, redirects, and rewrites are in scope.
- Cloudflare: the same built Next application and Server Actions run through OpenNext; image optimization is adapted to the existing `IMAGES` binding.
- GitHub Actions: public-media reconciliation remains the separate Sharp/Linux workflow and is not changed by this PR. The Next dependency's Sharp update must not be confused with upgrading Wrangler's separate Miniflare Sharp copy.

The image `remotePatterns`, SVG attachment/CSP guard, R2 fallback behavior, authentication and authorization rules, Queue wiring, and producer OFF/empty defaults remain unchanged.

## Controlled media canary accounting (plan only)

Experience `3309` remains only a candidate and is not enabled or modified here. Immediately before any later approval, re-read its row, media snapshot, direct R2 key state, Queue/DLQ state, quota, exact forward/rollback photo payloads, and audit-log side effects. A public-domain `404` is not proof that an R2 key is absent.

For the previously proposed reorder in which an already mirrored secondary photo becomes the hero, the current repository manifest implies five source identities and seventeen logical derivatives: two card keys plus fifteen detail keys. If direct R2 inspection still proves the two new card keys absent and all source/original/detail objects exact, the nominal first delivery is:

- one logical enqueue and one consumer delivery;
- five Supabase public-source GETs and two authoritative row reads;
- two new derivative keys, zero new original keys, two Images transforms, and two conditional R2 PUT attempts;
- existing originals and detail derivatives remain read-only exact skips.

Those are normal-path counts, not unconditional maxima. A concurrent duplicate can transform and attempt the same two conditional PUTs before the winner becomes visible; a later duplicate normally verifies exact objects and performs zero transforms/writes. Each retry can repeat work only for keys not yet proven exact. With five configured retries, one message can have up to six delivery attempts, and platform duplicate delivery can add further attempts. Successful new object creation remains bounded by the two deterministic keys because every PUT is create-only, but Images calls and conditional PUT attempts are not bounded merely by the number of new keys.

The forward operation is an authorized photos-order update and may also write the existing admin audit record; rollback repeats those application-level writes with the original payload. Producer OFF blocks new enqueue attempts only. It does not cancel a message already accepted by the Queue or a consumer invocation already running, so rollback must correlate the producer event ID, consumer outcome, R2 provenance/bytes, Queue and DLQ observations, and actual browser delivery/fallback state.
