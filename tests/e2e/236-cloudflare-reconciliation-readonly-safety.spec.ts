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
const foundationWorkflow = readFileSync(
  '.github/workflows/cloudflare-foundation-check.yml',
  'utf8'
);
const packageSource = JSON.parse(readFileSync('package.json', 'utf8'));
const mediaAuditSource = readFileSync(
  'scripts/cloudflare/audit-public-experience-media.mjs',
  'utf8'
);
const r2AuditSource = readFileSync(
  'scripts/cloudflare/r2-public-image-audit.py',
  'utf8'
);
const r2ReconciliationSource = readFileSync(
  'scripts/cloudflare/r2-public-image-reconcile.py',
  'utf8'
);
const hostR2ReconciliationSource = readFileSync(
  'scripts/cloudflare/r2-public-host-profile-reconcile.py',
  'utf8'
);
const mediaRecoverySource = readFileSync(
  'scripts/cloudflare/recover-public-experience-media.mjs',
  'utf8'
);
const r2RecoverySource = readFileSync(
  'scripts/cloudflare/r2-public-image-recovery.py',
  'utf8'
);
const mediaRepairPlannerSource = readFileSync(
  'scripts/cloudflare/plan-public-experience-media-repair.mjs',
  'utf8'
);
const r2RepairSource = readFileSync(
  'scripts/cloudflare/r2-public-image-repair.py',
  'utf8'
);
const repairJournalPackagingSource = readFileSync(
  'scripts/cloudflare/package-r2-repair-journal.sh',
  'utf8'
);
const controlledRepairWorkflow = readFileSync(
  '.github/workflows/public-experience-media-controlled-repair.yml',
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

  test('runs manifest-independent completeness without coupling manual audit to legacy writes', () => {
    expect(experienceWorkflow).toContain('Run manifest-independent metadata completeness audit');
    expect(experienceWorkflow).toContain('audit-public-experience-media.mjs metadata');
    expect(experienceWorkflow).toContain("options: [audit, plan, apply, legacy-reconcile]");
    expect(experienceWorkflow).toContain("github.event_name == 'schedule' || inputs.action == 'legacy-reconcile'");
    expect(experienceWorkflow).toContain('group: public-experience-image-reconciliation');
    expect(experienceWorkflow).toContain('needs: audit');
    expect(experienceWorkflow).not.toContain('needs: [audit, completeness]');
    expect(experienceWorkflow).toContain("ACTION: ${{ github.event_name == 'schedule' && 'audit' || inputs.action }}");
    expect(packageSource.scripts['cloudflare:experience-media:audit:metadata']).toBe(
      'node scripts/cloudflare/audit-public-experience-media.mjs metadata'
    );
    expect(packageSource.scripts['cloudflare:experience-media:audit:full']).toBe(
      'node scripts/cloudflare/audit-public-experience-media.mjs full'
    );
    expect(foundationWorkflow).toContain(
      'run: npm run cloudflare:experience-media:audit:test'
    );
    expect(foundationWorkflow).not.toContain(
      'run: npm run cloudflare:experience-media:audit:metadata'
    );
    expect(foundationWorkflow).not.toContain(
      'run: npm run cloudflare:experience-media:audit:full'
    );
  });

  test('strict parity clients expose read operations and no remote mutation API', () => {
    expect(mediaAuditSource).toContain("method: 'GET'");
    expect(mediaAuditSource).toContain("operation: 'storage-list-read'");
    expect(mediaAuditSource).toContain('supabaseMutationRequests: 0');
    expect(mediaAuditSource).not.toMatch(/\.from\([^)]*\)\.(insert|update|upsert|delete)\(/i);
    expect(mediaAuditSource).not.toMatch(/method\s*:\s*['\"](PUT|PATCH|DELETE)['\"]/i);

    expect(r2AuditSource).toContain('def list_metadata');
    expect(r2AuditSource).toContain('def get_bytes');
    expect(r2AuditSource).not.toMatch(/\.(put_object|upload_file|delete_object|delete_objects|copy_object)\(/);
    expect(r2AuditSource).not.toMatch(/method=["'](?:POST|PUT|PATCH|DELETE)["']/);
  });

  test('scheduled derivative reconciliation is conditional-create only', () => {
    expect(r2ReconciliationSource).toContain('IfNoneMatch="*"');
    expect(r2ReconciliationSource).toContain('client.put_object(');
    expect(r2ReconciliationSource).not.toContain('client.upload_file(');
    expect(r2ReconciliationSource).not.toContain('client.copy_object(');
    expect(r2ReconciliationSource).not.toMatch(
      new RegExp(`client\\.${'delete' + '_object'}s?\\(`)
    );
    expect(r2ReconciliationSource).toContain('"concurrentExactSkipCount"');
    expect(r2ReconciliationSource).toContain('"conflictCount": 0');
    expect(r2ReconciliationSource).toContain('"deletedObjectCount": 0');
  });

  test('host profile manual recovery is digest-bound and conditional-create only', () => {
    expect(hostWorkflow).toContain('options: [audit, plan, apply-create-only, legacy-reconcile]');
    expect(hostWorkflow).toContain('confirmed_plan_digest');
    expect(hostWorkflow).toContain("inputs.action == 'apply-create-only'");
    expect(hostWorkflow).toContain('--create-only-plan');
    expect(hostWorkflow).toContain('Verify source bytes immediately before R2 mutation');
    expect(hostWorkflow).toContain('Verify source bytes stayed exact within the shared read budget');
    expect(hostWorkflow).toContain('steps.source_preverify.outputs.total_source_bytes');
    expect(hostR2ReconciliationSource).toContain('IfNoneMatch="*"');
    expect(hostR2ReconciliationSource).toContain('Confirmed profile plan digest does not match');
    expect(hostR2ReconciliationSource).toContain('validate_planned_existing_derivative');
    expect(hostR2ReconciliationSource).toContain('existingProofs');
    expect(hostR2ReconciliationSource).toContain('concurrentExactSkipCount');
    expect(hostR2ReconciliationSource).toContain('deletedObjectCount');
  });

  test('bounded missed-enqueue recovery is explicit, conditional-create only, and default read-only', () => {
    expect(experienceWorkflow).toContain('default: audit');
    expect(experienceWorkflow).toContain("if: env.ACTION == 'apply'");
    expect(experienceWorkflow).toContain("${{ inputs.approve_apply }}");
    expect(experienceWorkflow).toContain("${{ inputs.confirm_digest }}");
    expect(experienceWorkflow).toContain('Verify source immediately before create-only apply');
    expect(experienceWorkflow).toContain('Verify source after create-only apply');
    expect(experienceWorkflow).toContain('--budget-state="$recovery_dir/.recovery-budget.json"');
    expect(experienceWorkflow).toContain('--phase=preApply');
    expect(experienceWorkflow).toContain('--phase=postApply');
    expect(mediaRecoverySource).toContain('selectRotatingCandidates');
    expect(mediaRecoverySource).toContain('maxSourceDownloads: 12');
    expect(mediaRecoverySource).toContain('maxSourceBytes: 64 * 1024 * 1024');
    expect(mediaRecoverySource).not.toMatch(/Queue\.send|deleteObject|copyObject/i);
    expect(mediaRecoverySource).toContain('execution,');
    expect(mediaRecoverySource).not.toContain('digestPayload');
    expect(mediaRecoverySource).toContain('transformAttemptCount');
    expect(r2RecoverySource).toContain('IfNoneMatch="*"');
    expect(r2RecoverySource).toContain('Exact fresh recovery plan digest confirmation is required');
    expect(r2RecoverySource).toContain('validate_artifacts(root, execution)');
    expect(r2RecoverySource).toContain('consume_create_attempt(budget_state)');
    expect(r2RecoverySource).not.toMatch(/\.copy_object\(|\.delete_object\(|\.delete_objects\(/);
    const sanitizedUpload = experienceWorkflow.match(
      /- name: Upload sanitized completeness evidence[\s\S]*?- name: Publish bounded completeness summary/
    )?.[0] ?? '';
    expect(sanitizedUpload).not.toContain('.r2-inspection.json');
    expect(sanitizedUpload).not.toContain('.recovery-plan.json');
    expect(sanitizedUpload).not.toContain('source-cache');
    expect(sanitizedUpload).not.toContain('/objects/');
  });

  test('keeps controlled repair independent and plan-only by default', () => {
    expect(experienceWorkflow).not.toContain(
      'public-experience-media-controlled-repair'
    );
    expect(experienceWorkflow).not.toContain('r2-public-image-repair.py');
    expect(controlledRepairWorkflow).toContain(
      'group: public-experience-image-reconciliation'
    );
    expect(controlledRepairWorkflow).not.toContain('schedule:');
    expect(controlledRepairWorkflow).toContain("default: plan");
    expect(mediaRepairPlannerSource).toContain("const [command = 'plan'");
    expect(r2RepairSource).toContain('args.plan = True');
    expect(r2RepairSource).toContain(
      'Exact plan digest confirmation is required'
    );
  });

  test('keeps enough timeout headroom for full repair journal packaging', () => {
    expect(controlledRepairWorkflow).toMatch(
      /controlled-repair:\n\s+runs-on: ubuntu-24\.04\n\s+timeout-minutes: 180\n/
    );
  });

  test('requires conditional writes and exposes no object removal API', () => {
    expect(r2RepairSource).toContain('IfNoneMatch="*"');
    expect(r2RepairSource).toContain('"CopySourceIfMatch": f');
    expect(r2RepairSource).toContain('{source_etag}');
    expect(r2RepairSource).toContain('"MetadataDirective": "REPLACE"');
    expect(r2RepairSource).toContain('"provenance_status"');
    expect(r2RepairSource).not.toContain('"sharp_version"');
    expect(r2RepairSource).not.toContain('"libvips_version"');
    expect(r2RepairSource).not.toContain('"runtime_id"');
    expect(r2RepairSource).not.toMatch(
      new RegExp(`\\.${'delete' + '_object'}s?\\(`)
    );
    expect(r2RepairSource).not.toContain('upload_file(');
  });

  test('encrypts private artifacts and never uploads plaintext plans or journals', () => {
    expect(controlledRepairWorkflow).toContain(
      '-aes-256-cbc -pbkdf2 -salt'
    );
    expect(controlledRepairWorkflow).toContain(
      '-pass env:R2_REPAIR_ARTIFACT_KEY'
    );
    expect(controlledRepairWorkflow).toContain('retention-days: 3');
    expect(controlledRepairWorkflow).toContain(
      'path: ${{ runner.temp }}/repair-plan.tar.gz.enc'
    );
    expect(controlledRepairWorkflow).toContain(
      'path: ${{ runner.temp }}/repair-journal.tar.gz.enc'
    );
    const artifactPaths = [
      ...controlledRepairWorkflow.matchAll(/^\s+path:\s+(.+)$/gm),
    ].map((match) => match[1]);
    expect(artifactPaths).not.toContain(
      '${{ runner.temp }}/experience-media-repair/.source-plan.json'
    );
    expect(artifactPaths).not.toContain(
      '${{ runner.temp }}/experience-media-repair/rollback-journal.json'
    );
  });

  test('packages action receipts without self-copy and preserves partial journals', () => {
    expect(controlledRepairWorkflow).toContain(
      'scripts/cloudflare/package-r2-repair-journal.sh'
    );
    expect(controlledRepairWorkflow).not.toMatch(
      /cp\s+"\$repair_dir\/\$\{ACTION\}-receipt\.json"/
    );
    expect(repairJournalPackagingSource).toContain(
      'receipt_name="${action}-receipt.json"'
    );
    expect(repairJournalPackagingSource).toContain(
      'files=(rollback-journal.json)'
    );
    expect(repairJournalPackagingSource).toContain(
      'files+=("$receipt_name")'
    );
    expect(repairJournalPackagingSource).toContain(
      'successful apply is missing its receipt; rollback journal was preserved'
    );
    expect(controlledRepairWorkflow).toContain(
      "steps.encrypt_journal.outputs.artifact_ready == 'true'"
    );
    expect(controlledRepairWorkflow).not.toContain('schedule:');
    expect(r2RepairSource).not.toMatch(
      new RegExp(`\\.${'delete' + '_object'}s?\\(`)
    );
  });
});
