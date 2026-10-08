# Chromium CL 8508456 experimental CI verification

This profile tests a fixed external browser on a synthetic loopback fixture. It
never selects the default or mandatory release browser, changes release failure
policy, contacts an actual Candidate, or authorizes a Worker release. The existing
`PLAYWRIGHT_EXECUTABLE_PATH` selector is reused without modifying either Gate.

## Provenance and support

The official Google Chrome for Testing mac-arm64 Canary 157.0.8091.0 reports
revision `6532fdea9c01b64cea9c3d3d9f10c241bc3dfb42`. The pinned profile includes
the fixed URL and archive/executable/Framework SHA256. Saved source evidence binds
the runtime revision to the exact Chromium source and official mirror compare API:
merge-base `62473ad0f747e245e514c93e741bb8e168a2a207`, 558 commits ahead, none
behind. That exact source records `HandleResult(result)` before the client callback,
as required by [CL 8508456](https://chromium-review.googlesource.com/c/chromium/src/+/8508456).
Source evidence is saved at review time, not fetched on every CI run. CI links it
to the checksum-pinned bytes and exact runtime revision.

Fresh discovery on 2026-10-09 found Playwright stable 1.64.0 (Git head
`606ecd8b34bac100db32561b6278ffd76e5eb3cd`) and next
1.65.0-alpha-2026-10-08 (`4357c237cfde9135fb5b7894c22a45468321a973`). Both
[official manifests](https://github.com/microsoft/playwright/blob/606ecd8b34bac100db32561b6278ffd76e5eb3cd/packages/playwright-core/browsers.json)
select Chromium/headless-shell 156.0.8078.4, revision 1248. Its exact source commit
`f842f52ef39fd97b449eb27cff414bf05a98ddce` lacks the change; compare with the fix
is diverged (13 ahead / 6196 behind), merge-base
`c50edc4214d81e4f944c3415d55104a49e46d214`. No fixed official bundled pair was
identified. Playwright 1.59.1 + CfT157 remains experimental; arbitrary
[executable versions are not guaranteed compatible](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-option-executable-path).
No default API/browser upgrade occurs in this PR.

The official archive is ad-hoc signed and lacks sealed CodeResources; bundle
codesign verification fails. No Google signing identity, notarization or security
bypass is claimed. The CI records the verification exit code and native launch
result separately. If launch is refused, it fails without removing xattrs,
re-signing, changing Gatekeeper or falling back.

## Real CI and isolation

`Experimental Release Browser Identity` keeps the Ubuntu mock rejection contracts
and adds `real-patched-browser` on `macos-15`. GitHub documents this label as
[ARM64 for public and private repositories](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
The job checks Darwin/ARM64 before downloading or launching; it also checks Mach-O
architecture and the actual browser process through CDP process info and the native `sample` Code Type.
Repository eligibility is demonstrated by the actual hosted job execution.

Permissions are `contents: read`; actions are pinned by commit SHA, checkout does
not retain credentials, and no Production secret or user session is supplied.
Only the profile's exact Google HTTPS archive is downloaded, redirects are refused,
and SHA256 is checked before `ditto` extraction into a fresh runner directory.
Executable and Framework SHA256 and CDP product/version/revision must pass before
any fixture or Gate request. No fallback binary is available. Dependencies use
committed lockfiles; fixture subprocesses receive an environment allowlist without
provider credentials and disable Next telemetry. Browser app requests are loopback
GET/HEAD only, with fixture CSP and request assertions. Evidence records sanitized
paths, query digests, body lengths/digests, timings and terminal events, not cookies,
Authorization, payloads, actual users, HARs or session state.

The existing minimal Next 16.3.5 / React 19.2.3 repro is retained under
`scripts/cloudflare/chromium8508456-fixture`. A single isolated fixture build runs:

- Five normal JSON stream cases: no-store/two writes, no-cache/two writes,
  no-store/native response.json, no-store/one write, no-store/three writes.
  All require HTTP200, correct consumed data, 11 bytes and expected SHA256,
  CDP loadingFinished, requestfinished and zero unexpected failures.
  Native response.json has no direct reader EOF measurement; CDP body bytes/hash
  are measured after completion without an extra browser read.
- Actual Link Home → Detail → Home: full synthetic Flight UI, original native
  reader EOF, decoded CDP/reader/host-body byte equality, successful terminal
  events and zero console/page errors. The observer forwards existing operations;
  it issues no additional read/tee/clone/cancel. Instrumentation can affect timing.
- Eight genuine negatives must reject: mid-body abort, truncated JSON,
  Content-Length mismatch, HTTP503, reader/network error, HTTP503 document
  navigation, malformed Flight and an actual asynchronous pageerror. Transport
  completion alone cannot accept bad framing/parsing/status/UI. Malformed Flight
  corrupts only synthetic responses and prevents full-document recovery from
  masking the bad Flight. There is no unconditional forced-failure assertion.
- The unchanged `visitReadOnlyPage` and mutation gate on normal Next navigation,
  and the entire unchanged `runProductionBrowserSmoke` on synthetic HTML/API
  routes via the existing executable selector. Each process gets an exact CDP
  identity/architecture receipt, and fixture checks do not retry into PASS.

The unchanged candidate/production contracts retain UUID checks, full asset-byte
SHA256, anonymous/stateless forwarding, blocked writes, requestfailed policy and
bounded timeout/retry rules. None of their implementations change.

Run locally on macOS ARM64 with the already verified official executable:

```sh
PLAYWRIGHT_EXECUTABLE_PATH=/absolute/path/to/GoogleChromeForTestingExecutable \
  node scripts/cloudflare/run-chromium8508456-ci.mjs /absolute/evidence-directory
```

A real successful job reports `PATCHED_BROWSER_CI_INTEGRATION_PASS`. It does not
report `F02_CANDIDATE_BROWSER_GATE_PASS`, verify Production Auth/Host permissions,
or perform a Worker build/upload/deployment. Related Foundation CI builds are
provider-free synthetic artifacts, never release artifacts.

## Release boundary

Earlier local A/B used the same fixture/API with Chromium147 and pinned157.
Patched normal5/RSC passed; old no-store controls and Detail retained ERR_ABORTED
despite complete EOF/UI. Genuine faults remained rejected in both. This compares
many upstream browser changes; it is not an isolated C++ bisect. The historical
r233 cancellation actor remains UNKNOWN and the initial incident UNRESOLVED.

PR211 can be merged after exact-head real CI and preserved related gates pass.
Its merge does not adopt Canary for a mandatory Production gate. A default browser
or policy change requires separate reviewed approval. F02 Production remains
BLOCKED; F01 stays100%, and the stale0% Candidate lacks PR210/211.

The next separate release needs fresh merged source, a new exact artifact and
Candidate at0%, identity and every original Gate, static asset/RSC integrity,
SEO/Foundation/Financial/Auth/Privacy/Chat regressions, all35 Validation Epoch runs,
then separate Production approval before promotion and live verification. Resolve
experimental compatibility, signature/supply-chain limitations and the supported
pair decision explicitly before that release; this synthetic CI alone cannot
establish full release readiness.
