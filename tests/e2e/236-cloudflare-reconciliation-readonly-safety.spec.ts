import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const configSource = readFileSync('playwright.cloudflare-images.config.ts', 'utf8');
const productionGuardSource = readFileSync(
  'tests/e2e/helpers/productionSupabaseGuard.ts',
  'utf8'
);
const experienceWorkflow = readFileSync(
  '.github/workflows/public-experience-image-reconciliation.yml',
  'utf8'
);
const hostWorkflow = readFileSync(
  '.github/workflows/public-host-profile-image-reconciliation.yml',
  'utf8'
);

const experienceSpecs = [
  'tests/e2e/226-cloudflare-image-canary.spec.ts',
  'tests/e2e/227-cloudflare-public-card-images.spec.ts',
  'tests/e2e/228-cloudflare-public-detail-images.spec.ts',
];
const hostSpecs = [
  ...experienceSpecs,
  'tests/e2e/233-cloudflare-public-host-profile-images.spec.ts',
  'tests/e2e/234-cloudflare-public-host-profile-purge-boundary.spec.ts',
];

function stepSource(workflow: string, name: string) {
  const match = workflow.match(
    new RegExp(`      - name: ${name}\\n([\\s\\S]*?)(?=\\n      - name: )`)
  );
  expect(match, `missing workflow step: ${name}`).toBeTruthy();
  return match?.[1] ?? '';
}

function expectExactSpecs(step: string, expected: string[]) {
  const actual = [...step.matchAll(/tests\/e2e\/[^\s]+\.spec\.ts/g)].map(
    ([path]) => path
  );
  expect(actual).toEqual(expected);
  expect(step).toContain('-c playwright.cloudflare-images.config.ts');
}

function expectCredentialsRemoved(step: string, names: string[]) {
  for (const name of names) {
    expect(step).toContain(`${name}: ''`);
  }
}

test.describe('Production reconciliation image checks stay read-only', () => {
  test('keeps the general Production Supabase guard and allowlists only image specs', () => {
    expect(configSource).toContain("globalSetup: './tests/e2e/production.guard.ts'");
    expect(productionGuardSource).toContain("'uhinvcydgzqlpnvieyal'");
    expect(productionGuardSource).toContain('Refusing to run tests against the Production Supabase project.');
    for (const spec of hostSpecs) {
      expect(configSource).toContain(spec.replace('tests/e2e/', '**/'));
    }
    expect(configSource).toContain('testMatch: productionReadonlyImageSpecs');
  });

  test('removes Production Supabase and R2 credentials only from verification steps', () => {
    const experienceStep = stepSource(
      experienceWorkflow,
      'Run Cloudflare image boundary tests'
    );
    const hostStep = stepSource(
      hostWorkflow,
      'Run profile and existing Cloudflare image boundary tests'
    );

    expectExactSpecs(experienceStep, experienceSpecs);
    expectExactSpecs(hostStep, hostSpecs);
    expectCredentialsRemoved(experienceStep, [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_ENDPOINT',
    ]);
    expectCredentialsRemoved(hostStep, [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'ACTIVE_R2_ACCESS_KEY_ID',
      'ACTIVE_R2_SECRET_ACCESS_KEY',
      'STALE_R2_ACCESS_KEY_ID',
      'STALE_R2_SECRET_ACCESS_KEY',
      'R2_ENDPOINT',
    ]);
  });

  test('allowlisted specs contain no Production mutation clients or requests', () => {
    for (const spec of hostSpecs) {
      const source = readFileSync(spec, 'utf8');
      expect(source).not.toMatch(/helpers\/testSupabase|createClient|getTestAdminClient/);
      expect(source).not.toMatch(/storage\.from\(|\.rpc\(|page\.request\.(post|put|patch|delete)\(/i);
      expect(source).not.toMatch(/method\s*:\s*['"](POST|PUT|PATCH|DELETE)['"]/i);
    }
  });
});
