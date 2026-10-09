# SEO F04 Option B: robots policy and release alignment

Status: Draft PR #216 only. No merge, Worker build/upload/deployment or Cloudflare configuration change is authorized. Policy Option B was approved on 2026-10-10 (Asia/Seoul).

## Origin policy

The wildcard group allows public pages and crawlable noindex UI, disallows `/api/`, and declares `https://www.locally-travel.com/sitemap.xml`. Google-Extended inherits this group; there is no specific Allow group that could lose API protection. Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot and Perplexity-User also retain wildcard permissions. Robots is not access control: Auth/RLS and anonymous/legacy author redaction remain unchanged.

Seven explicit tokens retain `Disallow: /`: Amazonbot, Applebot-Extended, Bytespider, CCBot, ClaudeBot, GPTBot and meta-externalagent. Google-Extended permission accepts both Gemini training and grounding use. This does not promise placement in AI answers, or exclusion from all other training systems.

The pinned development-only `robots-parser@3.0.1` evaluates actual Next serialization and HTTP fixtures. Negative controls detect loss of API inheritance, unreadable noindex, managed Google-Extended Disallow and contradictory `ai-train=no`. Content Signals are evaluated separately from REP, whose parser does not enforce these content-use extensions.

## Fresh read-only Cloudflare evidence

Search Allow; Agent Allow; Training Disallow; Bot Preference Sync ON. Public robots.txt currently serves origin wildcard/API/sitemap rules without a managed prefix. The reason this disagrees with the documented injection behavior is NOT_VERIFIED at platform level. Its current absence must not be relied upon as a permanent exception.

The Training dialog exposes Block, Block on pages with ads, Disallow and Allow, without per-product token exceptions. The current crawler table has 32 entries: 15 Block/locked and 17 unblocked/editable. Google-Extended has no table row. No supported Google-Extended-only exception was found in the UI or published Bot Management schema; undocumented platform capabilities remain NOT_VERIFIED. Google-Extended has no separate HTTP User-Agent: spoofed UA 200 cannot prove this policy.

Claude-User is classified as AI Crawler and Block/locked, although the origin REP permits it. This is an independent edge alignment issue; origin changes cannot override it. An unchecked Block switch means no block from that feature, not unrestricted access through every security layer.

## Alternatives and protection impact

| Approach | Google-Extended / Option B | Protection impact |
| --- | --- | --- |
| Keep Training Disallow + Sync ON | Not guaranteed: future managed Disallow and global ai-train=no conflict | Preserves current 15 locked blocks and global classifier; no change now |
| Origin-owned REP + scoped crawler enforcement | Preferred target, conditional on platform verification and separate approval | Can preserve known crawler blocks individually, but does not automatically preserve broad training detection |
| Supported Google-Extended exception to global policy | Would be least disruptive if available | No such exception verified; needs Cloudflare confirmation before use |

The seven REP exclusions map to six HTTP crawler rows (Amazonbot, Bytespider, CCBot, ClaudeBot, GPTBot, Meta-ExternalAgent), plus Applebot-Extended, a content-use token without a separate crawler. Simply allowing global Training and retaining only those six rows risks dropping **9 of the 15 currently blocked rows**: Claude-User, PetalBot, Anchor Browser, Arquivo Web Crawler, FacebookBot, Google-CloudVertexBot, Novellum AI Crawl, TikTok Spider and Timpibot. To meet Option B's user-agent discovery policy, Claude-User needs a specifically reviewed release from its block; preserve the other **8** unless separately approved. Table state alone does not prove which inherited action would disappear after a global change.

There is also an unquantified loss of global verified/unverified behavioral training classification. Free-plan individual AI Crawl Control uses self-identifying UA strings; it is not equivalent to that broader classifier. Restoring listed blocks does not establish parity for unnamed or spoofing crawlers. Auth/RLS, BIC, WAF/payment exceptions and private noindex are separate protections and must be unchanged.

## Proposed settings plan — not applied

Target only after separate approval and successful preflight:

- Search: Allow; Agent: Allow.
- Origin owns the Option B REP, with the seven tokens above and no global training-denial content signal.
- Bot Preference Sync: OFF to prevent managed Google-Extended Disallow / ai-train=no; inspect any separate managed robots setting and set OFF only if actually present and separately approved.
- Training: Allow (do not block), **only with a verified replacement enforcement plan**. Do not treat Sync OFF alone as proof of edge protection or Option B alignment.
- Individually preserve all 14 non-Claude-User current blocked rows (six selected training rows plus eight existing additional rows), subject to confirmed UI/API support. Allow Claude-User specifically after its locked inheritance is resolved. Do not allow all Google crawlers or add broad WAF Skip rules.

Before applying, Cloudflare must confirm (1) why managed injection is absent for this Worker response, (2) whether a product-token/content-signal exception exists, (3) how locked actions migrate to independent blocks, (4) whether broader unknown-training protection can coexist with Google/Gemini permission, and (5) why Claude-User is classified as AI Crawler. If no equivalent broad protection is available, the exact residual gap requires an explicit decision; no silent downgrade is permitted.

Stage replacement rules first if the platform supports it, capture saved IDs/settings and before/after action receipts, then switch ownership/preferences under one approved plan. Do not create an interval with missing training blocks. If independent blocking cannot be staged while global inheritance remains, obtain a platform-supported atomic transition or retain the current state. Verify REP with the actual parser plus Content Signals review, all API/noindex/privacy contracts, and actual verified-crawler evidence where available. Restore the saved bot preferences and only newly changed crawler actions on failure. Preserve F03, Worker, DNS/SSL/HSTS and all payment/security settings. No cache purge is included.

## Protected payment release integration

Production is protected Worker `9c181ab0-84db-400f-9121-755970a6bcae` alone at 100%; fresh deployment `01bd5bb4-8706-48f8-94a0-16f8b86353fa`, bindings 63, queues 2, crons 5. Main `77d0d730fb418d68025585bcab8e08a0671ece87` may lack PHASE 1 financial protection code. CI for this SEO draft proves its checked-out source, not parity with that protective artifact or financial V2 integration.

Future release prerequisites: obtain the PHASE 1 source/provenance handoff without repeating the payment audit; integrate the protective changes with SEO through reviewed source PRs; validate exact-head financial V2 call/schema contracts, canary-key absence and rollback safety; only then authorize a fresh candidate build and 0% validation. Preserve the current protected Worker at 100% until a separately approved promotion. Rollback must target the protected `9c181ab0-84db-400f-9121-755970a6bcae`, not the older F02 artifact. Do not build or deploy the present main as an SEO-only replacement.

## Evidence and references

Sanitized local evidence: `.wrangler/f04-option-b-20261010/evidence/`. No cookies, tokens, HTML author identities or transaction data are retained. Fresh sitemap is 108 URLs (33 Experience / 2 Community / 58 Host / 15 Static), with no differences from the validated F02 URL set; this is a live XML comparison, not a new Production DB eligibility computation. Community bare/query metadata and four language canonical/hreflang samples retain existing contracts. Observability access remains NOT_VERIFIED; no permissions are expanded.

- [Google product tokens](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers)
- [Cloudflare managed robots and Content Signals](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/)
- [Cloudflare global AI bot policies](https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/)
- [Cloudflare individual crawler enforcement and Free-plan detection](https://developers.cloudflare.com/ai-crawl-control/features/manage-ai-crawlers/)
- [Cloudflare Bot Management schema](https://developers.cloudflare.com/api/resources/bot_management/methods/get/)
- [OpenAI crawler roles](https://developers.openai.com/api/docs/bots)
- [Anthropic crawler roles](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)
- [Perplexity crawler roles](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)
- [REP parser](https://github.com/samclarke/robots-parser)
