# Domain QA System

## Purpose
- This QA layer turns the existing Playwright suite into a domain-based sign-off system.
- It is designed for mixed verification:
  - automated Playwright checks for money, permissions, state transitions, notifications, callbacks, and critical flows
  - manual sign-off for copy, localization quality, responsive UX, visual fit, and touch-target quality

## Source Of Truth
- Domain manifest: [tests/e2e/domainMatrix.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/tests/e2e/domainMatrix.ts)
- QA runner: [scripts/run-domain-qa.mjs](/Users/hyungeunseanson/Documents/서비스/locally-web/scripts/run-domain-qa.mjs)
- Manual seed generator: [scripts/seed-domain-manual-results.mjs](/Users/hyungeunseanson/Documents/서비스/locally-web/scripts/seed-domain-manual-results.mjs)
- QA Playwright config: [playwright.domain-qa.config.ts](/Users/hyungeunseanson/Documents/서비스/locally-web/playwright.domain-qa.config.ts)
- Manual checklist guide: [docs/qa/manual-checklists/domain-checklists.md](/Users/hyungeunseanson/Documents/서비스/locally-web/docs/qa/manual-checklists/domain-checklists.md)

## Primary Commands
```bash
npm run test:e2e:qa:list
npm run test:e2e:qa:validate
npm run test:e2e:qa:critical
npm run test:e2e:qa:critical:run
npm run test:e2e:qa:critical:desktop
npm run test:e2e:qa:seed:critical
npm run test:e2e:qa:seed:domain16
npm run test:e2e:qa:domain16:desktop
npm run test:e2e:qa:seed:public-surface
npm run test:e2e:qa:public-surface:desktop
npm run test:e2e:qa:mobile:targeted
npm run test:e2e:qa:tablet:targeted
npm run test:e2e:qa:release-cross:plan
npm run test:e2e:qa:release-cross
npm run test:e2e:qa:live-gate-cross:plan
npm run test:e2e:qa:live-gate-cross
```

## Typical Workflow
1. Validate the matrix.
2. Seed manual-results JSON for the target domain bundle.
3. Run automated domain QA.
4. Fill the manual results file while checking canonical routes.
5. Re-run the domain report with `--manual-results` and optionally `--write-doc-report`.
6. Use the generated report to classify domains as `green`, `yellow`, or `red`.

## Wave Execution Order
1. `npm run test:e2e:qa:validate`
2. `npm run test:e2e:qa:seed:critical`
3. `npm run test:e2e:qa:critical:desktop`
4. Fill `docs/qa/manual-checklists/critical-priority.seed.json`
5. Re-run `npm run test:e2e:qa:critical:desktop` for the combined critical signoff
6. `npm run test:e2e:qa:seed:domain16`
7. `npm run test:e2e:qa:domain16:desktop`
8. `npm run test:e2e:qa:seed:public-surface`
9. `npm run test:e2e:qa:public-surface:desktop`
10. Run `npm run test:e2e:qa:mobile:targeted` and `npm run test:e2e:qa:tablet:targeted` only when responsive-sensitive domains need a focused rerun
11. Cross-check with `npm run test:e2e:qa:release-cross` and, when needed, `npm run test:e2e:qa:live-gate-cross`

`*:plan` variants generate a dry-run report only. Non-`plan` variants execute the linked external gate bundle.

## Example
```bash
npm run test:e2e:qa:validate
npm run test:e2e:qa:seed:critical
node scripts/run-domain-qa.mjs \
  --bundle critical-priority \
  --manual-results docs/qa/manual-checklists/critical-priority.seed.json \
  --write-doc-report
```

## Gate Policy
- Domain `red` means the domain blocks release.
- Domains `12, 1, 2, 4, 11` are hard blockers if they are `red`.
- Domains `12, 1, 2, 4, 11, 13, 16, 17, 18` must be at least `yellow` for a release candidate.
- Public domains `3, 6, 14, 15, 16` cannot be treated as fully `green` without manual copy/mobile/localization sign-off.
