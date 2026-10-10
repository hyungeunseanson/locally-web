import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const directory = await mkdtemp(join(tmpdir(), 'locally-phase2-scheduled-'));
try {
  const outfile = join(directory, 'scheduled.cjs');
  await build({ entryPoints: ['app/utils/cloudflareScheduled.ts'], outfile,
    bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'tsconfig.json' });
  const { handleLocallyScheduledEvent } = createRequire(import.meta.url)(outfile);
  const called = [];
  const run = name => async () => { called.push(name); };
  const options = {
    dailyCron: 'daily', adminSupportCron: '*/10 * * * *', notificationRetentionCron: 'retention',
    experienceCompletionCron: 'completion', cancelPendingCron: 'cancel',
    runTranslationRecovery: run('translation'), runHomePopularitySnapshot: run('home'),
    runAdminSupportUnreadAlerts: run('admin'), runNotificationRetentionCleanup: run('retention'),
    runExperienceCompletionSync: run('experience'), runServiceCompletionSync: run('service'),
    runCancelPendingBookings: run('cancel'),
    runOpsAnomalyMonitor: async () => { called.push('ops-failed'); throw Error('synthetic ops outage'); },
    runNicePayRecovery: run('nicepay-recovered'), log: () => {},
  };
  await assert.rejects(handleLocallyScheduledEvent({ cron: options.adminSupportCron }, {}, options),
    /locally_scheduled_task_failed/);
  assert.deepEqual(called.sort(), ['admin', 'nicepay-recovered', 'ops-failed'].sort());
  console.log('PASS NICEPAY replay still runs when another ten-minute task fails');
} finally {
  await rm(directory, { recursive: true, force: true });
}
