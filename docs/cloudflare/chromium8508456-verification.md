# Chromium CL 8508456 binary verification

This is an experimental, manual diagnostic profile. It does not update Playwright,
select a new CI browser, invoke either release Gate, or authorize a Worker release.
The existing `PLAYWRIGHT_EXECUTABLE_PATH` selector already supports an external
browser without modifying Gate failure policy. No ERR_ABORTED exception is needed.

## Provenance

The official Chrome for Testing mac-arm64 Canary 157.0.8091.0 reports Git revision
`6532fdea9c01b64cea9c3d3d9f10c241bc3dfb42`. The pinned profile links the official
Google archive, exact source and Git compare evidence. Compare merge-base is
`62473ad0f747e245e514c93e741bb8e168a2a207`, confirming the merged
[CL 8508456](https://chromium-review.googlesource.com/c/chromium/src/+/8508456)
is an ancestor. Its exact source calls `HandleResult(result)` before the client
callback; Chromium 147's source does not.

Download only the profile's fixed HTTPS Google URL to an isolated directory.
Verify its archive SHA256 before extracting with `ditto -x -k`. Do not overwrite
Playwright's browser cache or system Chrome. The official archive is ad-hoc signed
and lacks sealed CodeResources; bundle codesign verification fails. Google service
CRC32C, ZIP CRC, recorded SHA256 and exact runtime/source identity were checked.
No Google signing identity, notarization or signature bypass is asserted.

Run the verifier with Node 24.20.0 and the unchanged Playwright 1.59.1 dependency:

```sh
node scripts/cloudflare/verify-pinned-release-browser.mjs /absolute/path/to/GoogleChromeForTestingExecutable
```

It checks macOS/arm64, Playwright, both executable and framework SHA256, browser
version/product and CDP Git revision, and closes the disposable browser. It makes
no application requests and never falls back to another browser. Wrong identity
must stop subsequent verification. This receipt is not a release-readiness PASS.
An eventual release invocation must also ensure the same bytes/path remain intact.

## Fixed local comparison

One identical Next 16.3.5 / React 19.2.3 build was tested with Playwright 1.59.1,
first Chromium 147.0.7727.15, then the pinned Canary executable. A synthetic static
favicon removed the old fixture's unrelated 404 from both arms. All runs are
retained; no failed sample was retried into PASS.

| Condition | Chromium 147 | Pinned 157 |
| --- | --- | --- |
| no-store, reader, two writes | EOF/11 bytes, ERR_ABORTED | EOF/11 bytes, requestfinished |
| no-cache, reader, two writes | requestfinished | requestfinished |
| no-store, native response.json | requestfinished | requestfinished |
| no-store, reader, single write | requestfinished | requestfinished |
| no-store, reader, three writes | EOF/11 bytes, ERR_ABORTED | EOF/11 bytes, requestfinished |
| Next RSC Home → Detail → Home | complete UI/EOF, ERR_ABORTED | complete UI/EOF, requestfinished |

The Detail original native reader and CDP both counted 50,471 decoded bytes;
the patched host body also completed. Page/console errors were zero in both arms.
JSON reader controls matched the 11-byte body's SHA256. Native response.json has
no direct reader EOF measurement; supplemental CDP body measurement confirmed
the same bytes/hash without introducing a second browser body read.

All six actual fault controls retained FAIL: mid-body abort, truncated JSON,
Content-Length mismatch, HTTP503, reader/network error and 503 document navigation.
A truncated unframed response and HTTP503 now correctly finish at the transport
layer, while parsing/status checks still reject them. EOF/requestfinished alone
never constitutes success. Additional truncated/malformed Flight and pageerror
fixtures were rejected. The unchanged page Gate passed the normal local Next
navigation, and the full unchanged production smoke ran on synthetic loopback
routes via its existing executable selector. These are not Production/Auth tests.

## CI and release decision

The new workflow checks verifier rejection contracts using synthetic dependencies;
it does not download/run Canary or claim binary integration PASS. It does not
replace or skip any existing required CI/Gate. Playwright documentation provides
no guarantee for arbitrary executable versions. This pair has local empirical
compatibility, not a guaranteed bundled pairing. Fresh Playwright stable/next
manifests still select Chromium 156.0.8078.4; a blind API upgrade is insufficient.

Before adopting a default CI browser, verify an exact fixed bundled/supported pair
and preserve the same matrix, genuine failures and executable identity checks.
That integration needs its own reviewed change and exact-head CI. Neither this
profile nor its verifier relaxes the existing release contracts.

The local verdict is `CHROMIUM_8508456_FIX_VERIFIED` for the observed reporting bug,
not isolated C++ causality across the many Chromium 147→157 changes. Historical
r233 remains UNRESOLVED. F02 Production remains BLOCKED: the old candidate lacks
PR210, and a future fresh merged artifact/candidate, all gates, 35 runs and separate
Production release approval are still required. This Draft PR must not be merged
or used to release automatically.
