import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

type ScheduledCronWorkflowContract = {
  path: string;
  name: string;
  concurrencyGroup: string;
  timeoutMinutes: number;
  endpoint: string;
};

const WORKFLOWS: ScheduledCronWorkflowContract[] = [
  {
    path: '.github/workflows/cancel-pending-bookings.yml',
    name: 'Cancel Pending Bookings',
    concurrencyGroup: 'cancel-pending-bookings',
    timeoutMinutes: 10,
    endpoint: '/api/cron/cancel-pending',
  },
];

test.describe('Scheduled cron workflow recovery contract', () => {
  for (const workflow of WORKFLOWS) {
    test(`${workflow.name} keeps its manual authenticated fallback contract`, () => {
      const source = readFileSync(workflow.path, 'utf8');

      expect(source).toContain(`name: ${workflow.name}`);
      expect(source).not.toMatch(/\n\s*schedule:\s*(?:\n|$)/);
      expect(source).toMatch(/\n\s*workflow_dispatch:\s*(?:\n|$)/);
      expect(source).toContain(`group: ${workflow.concurrencyGroup}`);
      expect(source).toMatch(/cancel-in-progress:\s*false/);
      expect(source).toMatch(/runs-on:\s*ubuntu-latest/);
      expect(source).toContain(`timeout-minutes: ${workflow.timeoutMinutes}`);

      expect(source).toContain('PROD_URL: ${{ secrets.PROD_URL }}');
      expect(source).toContain('CRON_SECRET: ${{ secrets.CRON_SECRET }}');
      expect(source).toContain('set -euo pipefail');
      expect(source).toContain('curl --silent --show-error --fail-with-body');
      expect(source).toContain(`\${PROD_URL%/}${workflow.endpoint}`);
      expect(source).toContain('-H "Authorization: Bearer ${CRON_SECRET}"');
    });
  }

  test('uses a unique concurrency group for every recovery-safe scheduled job', () => {
    const groups = WORKFLOWS.map((workflow) => workflow.concurrencyGroup);
    expect(new Set(groups).size).toBe(groups.length);
  });

  test('keeps Experience Completion as a manual authenticated fallback only', () => {
    const source = readFileSync('.github/workflows/complete-trips.yml', 'utf8');

    expect(source).toContain('name: Experience Completion Sync');
    expect(source).not.toMatch(/\n\s*schedule:\s*(?:\n|$)/);
    expect(source).toMatch(/\n\s*workflow_dispatch:\s*(?:\n|$)/);
    expect(source).toContain('group: complete-trips');
    expect(source).toContain('timeout-minutes: 15');
    expect(source).toContain('PROD_URL: ${{ secrets.PROD_URL }}');
    expect(source).toContain('CRON_SECRET: ${{ secrets.CRON_SECRET }}');
    expect(source).toContain('${PROD_URL%/}/api/cron/complete-trips');
    expect(source).toContain('-H "Authorization: Bearer ${CRON_SECRET}"');
  });
});
