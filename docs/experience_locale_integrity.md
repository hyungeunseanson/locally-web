# Experience locale integrity — Phase 2

This change prevents **clear** wrong-language content from receiving a new
`ready` state at the host write and translation writeback boundaries. It does
not certify translation quality or repair existing data. Phase 1 manifests
must not be executed as part of this change.

## Mutation boundaries and outcomes

`app/utils/experienceTranslation/integrity.ts` has no runtime imports, network
calls or database access. It inspects text leaves using script counts, grammar
and sentence endings, age units/comparators, operational vocabulary and field
risk. The possible outcomes are:

| Outcome | Host write | Provider/worker |
| --- | --- | --- |
| `VALID` | Continue existing write | Continue existing writeback |
| `REVIEW_REQUIRED` | Continue; return field-addressable `localeIntegrityWarnings` | Continue; no automatic retry for ambiguous content |
| `CLEAR_LANGUAGE_MISMATCH` | HTTP 400 with locale/field issues, before experience/queue writes | Retry using existing provider policy; do not write translated content |

The API warnings contain locale, field, risk and reason, not submitted text.
They are advisory response data; this phase adds neither a persisted review
status nor a host warning UI. `VALID` means no strong mismatch signal was
detected. It is not proof of semantic equivalence or linguistic correctness.
`REVIEW_REQUIRED` can still receive `ready` under this conservative policy.

### Source and manual content

- Create validates normalized source body and manual title/description before
  the existing insert. Source title/description are included in manual content.
- Update uses the row already fetched for authorization/versioning. A content,
  source locale or manual locale change validates the merged content before a
  new translation version is written. Unchanged content is not retrospectively
  certified on a non-content edit.
- Manual body maps retained on a title/description-only edit are checked using
  their actual target leaves, with no source fallback. Required source fields,
  list/itinerary structure and fixed-policy ID must be represented before a
  fresh `ready` stamp. Incomplete or clearly contaminated retained bodies stop
  the write; this check does not silently queue or replace manual content.
- The worker checks protected manual title/description before calling a
  provider. Missing or clearly wrong-language manual text fails the task using
  the existing failure path. AI retries cannot repair protected manual text.
  Existing manual titles/descriptions remain untouched.
- There is no client-supplied override. A future reviewed repair/override path
  needs authorization, audit evidence and compare-and-swap protection. It must
  call the same classifier before writing a new ready state. Admin requests
  through the host API already use these guards; arbitrary SQL bypasses them.

### Provider output

Existing JSON and per-source-field completeness validation runs first. The
same parser is used by Gemini and Grok. Language validation then rejects strong
mismatches as retryable `TranslationProviderError`s. A second local check in
the worker protects writeback when a provider implementation is substituted.
The lease, version comparison, provider fallback, retry limits and Queue
transport are unchanged.

## Field risk and conservative exceptions

Age limits, host notices, meeting instructions, inclusions and exclusions have
high risk. Itinerary instructions have high risk; descriptive itinerary prose,
description and supplies have medium risk. Supplies still receive operational
phrase checks. Full wrong-language sentences can be rejected at either risk.

Examples covered by fixtures:

- KO `20歳以上`, `個人の交通費` or `歩きやすい靴をご持参ください。`: clear mismatch.
- KO `高円寺駅`, a Japanese address, `PARCO`, `JR`, `Vespa`, or an English
  description mentioning a Japanese shop: no hard block.
- ZH Japanese prose with kana and Japanese endings: clear mismatch. Han-only
  cost terms shared with Chinese are not enough to reject ZH.
- Strong Japanese/Korean business sentences together: mismatch, never automatic
  deletion. A mixed-language short list such as `ドリンク` / `드링크`: review.
- Descriptive quoted/explained expressions: review instead of a hard block.
- Empty optional source fields remain allowed. Canonical activity-level enums
  are structural values and are not treated as Korean prose.

This is intentionally incomplete language detection. Short labels, ambiguous
Han-only text and grammar outside the small signal set may pass. It does not
prove that mixed-language array items are semantically equivalent. Photo URLs,
image pixels, raw location/address data, structural keys and UGC are excluded.
No production row or content dump is committed as a fixture.

## Fixed cancellation policy

Host writes now store `rules.refund_policy_id = locally_standard_v1` and an
empty `refund_policy` in canonical and source-localized rules. The server owns
this ID and ignores incoming policy presentation strings. The provider parser
copies the source ID and discards provider-authored policy text for that ID.
Legacy literal-only inputs keep their existing completeness requirement.

The public UI already renders the fixed policy through
`getLocalizedRefundPolicyLabel`; that dictionary/rendering path is unchanged.
Existing literal-only rows remain readable. There is no migration or scan.

**Transition cost:** the first successful host edit of a legacy literal-only
row changes its source policy representation. The existing dirty-content logic
therefore increments the translation version and queues the usual non-source
targets, even if the user's other edit is price-only. A strongly contaminated
source/manual text can stop that edit until corrected. Subsequent price-only
edits of ID-based rows do not add translation work. This is a deployment/review
consideration, not an authorization to requeue production now.

## Public fallback contract — Phase 3

Public readers still fall back without consulting translation status:

- Missing/failed target title can display the canonical title.
- Missing/empty target lists and itinerary can display the source collection.
- Partial target rules merge over source rules, mixing languages field by field.
- A nonempty partial target list/itinerary is used as-is; missing entries or
  descriptions are not filled individually.

Contract tests freeze these observations, not a desired final UX. A separate
Phase 3 should define availability, language labels and whether operational
instructions may fall back. Existing contaminated rows and fallback exposure
remain until independently approved repair/UX work.

## Performance and production boundary

| Cost | Added by ordinary validation |
| --- | --- |
| DB queries per normal create | 0 |
| DB queries per normal update | 0; reuse existing row read |
| DB queries per public page view | 0 |
| Public request integrity checks | 0 |
| External detection/provider calls | 0 |
| Queues, consumers, cron schedules | 0 |
| Queue messages for ordinary valid ID-based writes | 0 additional |

The classifier runs a fixed set of local pattern/count scans per text leaf over
one experience (at most four locales), with work proportional to payload size
for normal text. Provider parsing and writeback each run one local pass. Strong
provider rejection may consume existing bounded retries/fallback calls; those
are not new detection calls. Legacy policy conversion has the one-time queue
cost described above. No full-table or per-view work is introduced.

No Production DB mutation, manifest repair, requeue, deployment, Vercel change,
Cloudflare configuration change, new infrastructure or PR #160/ISR lineage
change is part of this task.

## Local verification

Run isolated contracts without a web server, browser login, real credentials,
live DB or remote provider:

```sh
NODE_OPTIONS=--conditions=react-server \
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000 \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=local-locale-fixture \
SUPABASE_SERVICE_ROLE_KEY=local-locale-service \
CRON_SECRET=local-locale-cron \
npx playwright test -c playwright.locale-integrity.config.ts
npx tsc --noEmit
npm run lint
git diff --check
```

The suite includes provider completeness (229), update boundaries (230), host
create/update producer integration (246), Queue contracts (251), and new locale
integrity/fallback tests. Query-count assertions cover the existing experience
insert and update read/write; queue and notification dependencies are mocked
and their existing implementation is unchanged.
