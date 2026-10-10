import assert from 'node:assert/strict';
import test from 'node:test';
import { LEGACY_SERVICE_KEY, MODERN_SECRET_KEY, MODERN_PUBLISHABLE_KEY, LEGACY_ANON_KEY } from '../../tests/fixtures/supabaseApiKeys.mjs';

test('privileged configuration rejects public keys before any build, preflight or deploy command', async () => {
  for (const key of ['', MODERN_PUBLISHABLE_KEY, LEGACY_ANON_KEY]) {
    let commands = 0;
    await assert.rejects(() => main([], {
      environment: { SUPABASE_SERVICE_ROLE_KEY: key },
      runCommand: () => { commands += 1; },
      runBridgeProofFreshness: async () => {},
      runSemanticPreflight: async () => { commands += 1; },
    }), /supabase_privileged_api_key_invalid/);
    assert.equal(commands, 0);
  }
});

test('deployment configuration keeps the credential alias compatible with both supported formats', async () => {
  for (const key of [LEGACY_SERVICE_KEY, MODERN_SECRET_KEY]) {
    const logs = [];
    let buildEnvironment;
    await main(['--dry-run'], {
      environment: { SUPABASE_SERVICE_ROLE_KEY: key },
      runCommand: (_command, args, options) => {
        if (args.includes('cloudflare:build:production')) buildEnvironment = options.env;
      },
      log: (entry) => logs.push(entry),
    });
    assert.equal(buildEnvironment.SUPABASE_SERVICE_ROLE_KEY, key);
    assert.equal(JSON.stringify(logs).includes(key), false);
  }
});

import {
  readReleasePolicy,
  resolveReleaseProfile,
  validateReleasePolicy,
} from './public-experience-media-release-profile.mjs';
import {
  buildDeploymentContract,
  main,
  parseDeploymentArguments,
  resolveAllowedPlannedChanges,
  resolveAllowedPlannedCronAdditions,
  resolveProductionDeploymentContract,
} from './run-production-deploy.mjs';
import { readTranslationReleasePolicy, resolveTranslationReleaseProfile } from './experience-translation-release-profile.mjs';
import { readHomePopularityReleasePolicy, resolveHomePopularityReleaseProfile } from './home-popularity-release-profile.mjs';
import { readAdminSupportUnreadReleasePolicy, resolveAdminSupportUnreadReleaseProfile } from './admin-support-unread-release-profile.mjs';
import { readNotificationRetentionReleasePolicy, resolveNotificationRetentionReleaseProfile } from './notification-retention-release-profile.mjs';
import { readExperienceCompletionReleasePolicy, resolveExperienceCompletionReleaseProfile } from './experience-completion-release-profile.mjs';
import { readServiceCompletionReleasePolicy, resolveServiceCompletionReleaseProfile } from './service-completion-release-profile.mjs';
import { readCancelPendingBookingsReleasePolicy, resolveCancelPendingBookingsReleaseProfile } from './cancel-pending-bookings-release-profile.mjs';
import { readOpsAnomalyMonitorReleasePolicy, resolveOpsAnomalyMonitorReleaseProfile } from './ops-anomaly-monitor-release-profile.mjs';
import { readExperienceMediaSourceReleasePolicy, resolveExperienceMediaSourceReleaseProfile } from './experience-media-source-release-profile.mjs';

async function homeProfile(name = 'off') {
  return resolveHomePopularityReleaseProfile(
    await readHomePopularityReleasePolicy(),
    name
  );
}

async function adminSupportProfile(name = 'off') {
  return resolveAdminSupportUnreadReleaseProfile(
    await readAdminSupportUnreadReleasePolicy(),
    name
  );
}

async function retentionProfile(name = 'off') {
  return resolveNotificationRetentionReleaseProfile(
    await readNotificationRetentionReleasePolicy(),
    name
  );
}

async function experienceCompletionProfile(name = 'off') {
  return resolveExperienceCompletionReleaseProfile(
    await readExperienceCompletionReleasePolicy(),
    name
  );
}

async function serviceCompletionProfile(name = 'off') {
  return resolveServiceCompletionReleaseProfile(
    await readServiceCompletionReleasePolicy(),
    name
  );
}

async function cancelPendingBookingsProfile(name = 'off') {
  return resolveCancelPendingBookingsReleaseProfile(
    await readCancelPendingBookingsReleasePolicy(),
    name
  );
}

async function opsAnomalyMonitorProfile(name = 'off') {
  return resolveOpsAnomalyMonitorReleaseProfile(
    await readOpsAnomalyMonitorReleasePolicy(),
    name
  );
}

const APPROVED_IDS = [
  3071, 3081, 3188, 3253, 3307, 3308, 3309, 3331, 3343, 3402, 3403,
  3404, 3405, 3410, 3416, 3439, 3496, 3570, 3664, 3861, 4262, 4313,
  4397, 4413, 4414, 4424, 4523, 4597, 4659, 4660, 4811, 4837, 4838,
];

test('owns an exact approved cohort while retaining explicit single-ID and OFF profiles', async () => {
  const policy = await readReleasePolicy();
  assert.deepEqual(policy.profiles['approved-cohort'].experienceIds, APPROVED_IDS);
  assert.deepEqual(resolveReleaseProfile(policy, 'single-3309'), {
    name: 'single-3309',
    enabled: 'true',
    experienceIds: '3309',
    experienceCount: 1,
  });
  assert.deepEqual(resolveReleaseProfile(policy, 'off'), {
    name: 'off',
    enabled: 'false',
    experienceIds: '',
    experienceCount: 0,
  });
});

test('couples reader build values and producer runtime values for every profile', async () => {
  const policy = await readReleasePolicy();
  const translationProfile = resolveTranslationReleaseProfile(await readTranslationReleasePolicy(), 'off');
  for (const name of Object.keys(policy.profiles)) {
    const profile = resolveReleaseProfile(policy, name);
    const contract = buildDeploymentContract(profile, translationProfile, await homeProfile(), await adminSupportProfile(), await retentionProfile());
    assert.equal(
      contract.readerEnvironment.NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED,
      profile.enabled
    );
    assert.equal(
      contract.readerEnvironment.NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS,
      profile.experienceIds
    );
    assert(contract.wranglerArguments.includes(
      `PUBLIC_EXPERIENCE_MEDIA_PRODUCER_ENABLED:${profile.enabled}`
    ));
    assert(contract.wranglerArguments.includes(
      `PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS:${profile.experienceIds}`
    ));
  }
});

test('defaults canonical Production deploy to the approved cohort and rejects ad-hoc flags', async () => {
  const policy = await readReleasePolicy();
  assert.equal(resolveReleaseProfile(policy).name, 'approved-cohort');
  assert.deepEqual(parseDeploymentArguments([]), {
    requestedProfile: undefined,
    requestedTranslationProfile: undefined,
    requestedHomePopularityProfile: undefined,
    requestedAdminSupportUnreadProfile: undefined,
    requestedNotificationRetentionProfile: undefined,
    requestedExperienceCompletionProfile: undefined,
    dryRun: false,
  });
  assert.deepEqual(parseDeploymentArguments(['--media-profile=off', '--dry-run']), {
    requestedProfile: 'off',
    requestedTranslationProfile: undefined,
    requestedHomePopularityProfile: undefined,
    requestedAdminSupportUnreadProfile: undefined,
    requestedNotificationRetentionProfile: undefined,
    requestedExperienceCompletionProfile: undefined,
    dryRun: true,
  });
  assert.throws(() => parseDeploymentArguments(['--var', 'X:Y']), /Unsupported/);
  assert.throws(() => resolveReleaseProfile(policy, 'wildcard'), /Unknown/);
});

test('Experience media source authority is independently ON by default with an explicit OFF rollback', async () => {
  const policy = await readExperienceMediaSourceReleasePolicy();
  assert.equal(resolveExperienceMediaSourceReleaseProfile(policy).name, 'on');
  const media = resolveReleaseProfile(await readReleasePolicy());
  const translation = resolveTranslationReleaseProfile(await readTranslationReleasePolicy());
  for (const name of ['off', 'on']) {
    const source = resolveExperienceMediaSourceReleaseProfile(policy, name);
    const contract = buildDeploymentContract(
      media,
      translation,
      await homeProfile('on'),
      await adminSupportProfile('on'),
      await retentionProfile('on'),
      {},
      await experienceCompletionProfile('on'),
      source
    );
    assert(contract.wranglerArguments.includes(`EXPERIENCE_MEDIA_R2_SOURCE_ENABLED:${source.enabled}`));
    assert(contract.wranglerArguments.includes(`PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS:${media.experienceIds}`));
    assert(contract.wranglerArguments.includes('EXPERIENCE_TRANSLATION_QUEUE_ENABLED:true'));
  }
  assert.deepEqual(parseDeploymentArguments(['--experience-media-source-profile=on']), {
    requestedProfile: undefined,
    requestedTranslationProfile: undefined,
    requestedHomePopularityProfile: undefined,
    requestedAdminSupportUnreadProfile: undefined,
    requestedNotificationRetentionProfile: undefined,
    requestedExperienceCompletionProfile: undefined,
    requestedExperienceMediaSourceProfile: 'on',
    dryRun: false,
  });
});

test('fails closed for malformed, duplicate, unsorted, wildcard, or uncoupled profiles', () => {
  const base = {
    defaultProductionProfile: 'approved-cohort',
    profiles: {
      off: { enabled: 'false', experienceIds: [] },
      'single-3309': { enabled: 'true', experienceIds: [3309] },
      'approved-cohort': { enabled: 'true', experienceIds: [3309] },
    },
  };
  for (const invalidProfile of [
    { enabled: 'true', experienceIds: [] },
    { enabled: 'false', experienceIds: [3309] },
    { enabled: 'true', experienceIds: [3309, 3309] },
    { enabled: 'true', experienceIds: [3309, 3071] },
    { enabled: 'true', experienceIds: ['*'] },
  ]) {
    assert.throws(() => validateReleasePolicy({
      ...base,
      profiles: { ...base.profiles, 'approved-cohort': invalidProfile },
    }));
  }
});

test('dry-run preserves the exact deployment contract without changing the profile', async () => {
  const policy = await readReleasePolicy();
  const profile = resolveReleaseProfile(policy, 'single-3309');
  const translationProfile = resolveTranslationReleaseProfile(await readTranslationReleasePolicy(), 'off');
  const contract = buildDeploymentContract(profile, translationProfile, await homeProfile(), await adminSupportProfile(), await retentionProfile(), { dryRun: true });
  assert.equal(contract.wranglerArguments.at(-1), '--dry-run');
  assert.deepEqual(contract.wranglerArguments.slice(0, 3), ['deploy', '--config', './wrangler.jsonc']);
  assert(contract.wranglerArguments.includes('CLOUDFLARE_DEPLOYMENT_ENV:production'));
  assert(!contract.wranglerArguments.some((argument) => argument.includes('*')));
});

test('allows only variables owned by an explicitly requested release profile to change', () => {
  assert.deepEqual(
    resolveAllowedPlannedChanges(parseDeploymentArguments(['--service-completion-profile=on'])),
    ['SERVICE_COMPLETION_SCHEDULED_ENABLED']
  );
  assert.deepEqual(resolveAllowedPlannedChanges(parseDeploymentArguments([])), []);
});

test('translation ON/OFF profiles are independent from the approved media cohort', async () => {
  const media = resolveReleaseProfile(await readReleasePolicy());
  const policy = await readTranslationReleasePolicy();
  assert.equal(resolveTranslationReleaseProfile(policy).name, 'on');
  for (const name of ['off', 'on']) {
    const translation = resolveTranslationReleaseProfile(policy, name);
    const contract = buildDeploymentContract(media, translation, await homeProfile(), await adminSupportProfile(), await retentionProfile());
    assert(contract.wranglerArguments.includes(`EXPERIENCE_TRANSLATION_QUEUE_ENABLED:${translation.queueEnabled}`));
    assert(contract.wranglerArguments.includes(`EXPERIENCE_TRANSLATION_SCHEDULED_RECOVERY_ENABLED:${translation.scheduledRecoveryEnabled}`));
    assert(contract.wranglerArguments.includes(`PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS:${media.experienceIds}`));
  }
  assert.deepEqual(parseDeploymentArguments(['--translation-profile=off']), {
    requestedProfile: undefined,
    requestedTranslationProfile: 'off',
    requestedHomePopularityProfile: undefined,
    requestedAdminSupportUnreadProfile: undefined,
    requestedNotificationRetentionProfile: undefined,
    requestedExperienceCompletionProfile: undefined,
    dryRun: false,
  });
});

test('Home popularity ON/OFF profiles are independent from Translation and media', async () => {
  const media = resolveReleaseProfile(await readReleasePolicy());
  const translation = resolveTranslationReleaseProfile(
    await readTranslationReleasePolicy()
  );
  const policy = await readHomePopularityReleasePolicy();
  assert.equal(resolveHomePopularityReleaseProfile(policy).name, 'on');
  for (const name of ['off', 'on']) {
    const home = resolveHomePopularityReleaseProfile(policy, name);
    const contract = buildDeploymentContract(media, translation, home, await adminSupportProfile(), await retentionProfile());
    assert(contract.wranglerArguments.includes(
      `HOME_POPULARITY_SNAPSHOT_SCHEDULED_ENABLED:${home.scheduledEnabled}`
    ));
    assert(contract.wranglerArguments.includes('EXPERIENCE_TRANSLATION_QUEUE_ENABLED:true'));
    assert(contract.wranglerArguments.includes(
      `PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS:${media.experienceIds}`
    ));
  }
  assert.deepEqual(parseDeploymentArguments(['--home-popularity-profile=off']), {
    requestedProfile: undefined,
    requestedTranslationProfile: undefined,
    requestedHomePopularityProfile: 'off',
    requestedAdminSupportUnreadProfile: undefined,
    requestedNotificationRetentionProfile: undefined,
    requestedExperienceCompletionProfile: undefined,
    dryRun: false,
  });
});

test('Admin Support unread ON/OFF profiles are independent from Home, Translation, and media', async () => {
  const media = resolveReleaseProfile(await readReleasePolicy());
  const translation = resolveTranslationReleaseProfile(await readTranslationReleasePolicy());
  const home = await homeProfile('on');
  const policy = await readAdminSupportUnreadReleasePolicy();
  assert.equal(resolveAdminSupportUnreadReleaseProfile(policy).name, 'on');
  for (const name of ['off', 'on']) {
    const adminSupport = resolveAdminSupportUnreadReleaseProfile(policy, name);
    const contract = buildDeploymentContract(media, translation, home, adminSupport, await retentionProfile());
    assert(contract.wranglerArguments.includes(
      `ADMIN_SUPPORT_UNREAD_ALERTS_SCHEDULED_ENABLED:${adminSupport.scheduledEnabled}`
    ));
    assert(contract.wranglerArguments.includes('EXPERIENCE_TRANSLATION_QUEUE_ENABLED:true'));
    assert(contract.wranglerArguments.includes('HOME_POPULARITY_SNAPSHOT_SCHEDULED_ENABLED:true'));
    assert(contract.wranglerArguments.includes(
      `PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS:${media.experienceIds}`
    ));
  }
  assert.deepEqual(parseDeploymentArguments(['--admin-support-unread-profile=off']), {
    requestedProfile: undefined,
    requestedTranslationProfile: undefined,
    requestedHomePopularityProfile: undefined,
    requestedAdminSupportUnreadProfile: 'off',
    requestedNotificationRetentionProfile: undefined,
    requestedExperienceCompletionProfile: undefined,
    dryRun: false,
  });
});

test('notification retention ON/OFF profiles are independent from all existing Production profiles', async () => {
  const media = resolveReleaseProfile(await readReleasePolicy());
  const translation = resolveTranslationReleaseProfile(await readTranslationReleasePolicy());
  const home = await homeProfile('on');
  const adminSupport = await adminSupportProfile('on');
  const policy = await readNotificationRetentionReleasePolicy();
  assert.equal(resolveNotificationRetentionReleaseProfile(policy).name, 'on');
  for (const name of ['off', 'on']) {
    const retention = resolveNotificationRetentionReleaseProfile(policy, name);
    const contract = buildDeploymentContract(media, translation, home, adminSupport, retention);
    assert(contract.wranglerArguments.includes(
      `NOTIFICATION_RETENTION_CLEANUP_SCHEDULED_ENABLED:${retention.scheduledEnabled}`
    ));
    assert(contract.wranglerArguments.includes('EXPERIENCE_TRANSLATION_QUEUE_ENABLED:true'));
    assert(contract.wranglerArguments.includes('HOME_POPULARITY_SNAPSHOT_SCHEDULED_ENABLED:true'));
    assert(contract.wranglerArguments.includes('ADMIN_SUPPORT_UNREAD_ALERTS_SCHEDULED_ENABLED:true'));
    assert(contract.wranglerArguments.includes(
      `PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS:${media.experienceIds}`
    ));
  }
  assert.deepEqual(parseDeploymentArguments(['--notification-retention-profile=off']), {
    requestedProfile: undefined,
    requestedTranslationProfile: undefined,
    requestedHomePopularityProfile: undefined,
    requestedAdminSupportUnreadProfile: undefined,
    requestedNotificationRetentionProfile: 'off',
    requestedExperienceCompletionProfile: undefined,
    dryRun: false,
  });
});

test('Experience completion ON/OFF profiles are independent from every existing Production profile', async () => {
  const media = resolveReleaseProfile(await readReleasePolicy());
  const translation = resolveTranslationReleaseProfile(await readTranslationReleasePolicy());
  const home = await homeProfile('on');
  const adminSupport = await adminSupportProfile('on');
  const retention = await retentionProfile('on');
  const policy = await readExperienceCompletionReleasePolicy();
  assert.equal(resolveExperienceCompletionReleaseProfile(policy).name, 'on');
  for (const name of ['off', 'on']) {
    const completion = await experienceCompletionProfile(name);
    const contract = buildDeploymentContract(
      media,
      translation,
      home,
      adminSupport,
      retention,
      {},
      completion
    );
    assert(contract.wranglerArguments.includes(
      `EXPERIENCE_COMPLETION_SCHEDULED_ENABLED:${completion.scheduledEnabled}`
    ));
    assert(contract.wranglerArguments.includes('EXPERIENCE_TRANSLATION_QUEUE_ENABLED:true'));
    assert(contract.wranglerArguments.includes('HOME_POPULARITY_SNAPSHOT_SCHEDULED_ENABLED:true'));
    assert(contract.wranglerArguments.includes('ADMIN_SUPPORT_UNREAD_ALERTS_SCHEDULED_ENABLED:true'));
    assert(contract.wranglerArguments.includes('NOTIFICATION_RETENTION_CLEANUP_SCHEDULED_ENABLED:true'));
    assert(contract.wranglerArguments.includes(
      `PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS:${media.experienceIds}`
    ));
  }
  assert.deepEqual(parseDeploymentArguments(['--experience-completion-profile=off']), {
    requestedProfile: undefined,
    requestedTranslationProfile: undefined,
    requestedHomePopularityProfile: undefined,
    requestedAdminSupportUnreadProfile: undefined,
    requestedNotificationRetentionProfile: undefined,
    requestedExperienceCompletionProfile: 'off',
    dryRun: false,
  });
});

test('Service completion defaults ON and passes an independent ON/OFF deployment variable', async () => {
  const media = resolveReleaseProfile(await readReleasePolicy());
  const translation = resolveTranslationReleaseProfile(await readTranslationReleasePolicy());
  const home = await homeProfile('on');
  const adminSupport = await adminSupportProfile('on');
  const retention = await retentionProfile('on');
  const experience = await experienceCompletionProfile('on');
  const source = resolveExperienceMediaSourceReleaseProfile(
    await readExperienceMediaSourceReleasePolicy(),
    'off'
  );
  const policy = await readServiceCompletionReleasePolicy();
  assert.equal(resolveServiceCompletionReleaseProfile(policy).name, 'on');

  for (const name of ['off', 'on']) {
    const service = await serviceCompletionProfile(name);
    const contract = buildDeploymentContract(
      media,
      translation,
      home,
      adminSupport,
      retention,
      { dryRun: true },
      experience,
      source,
      service
    );
    assert(contract.wranglerArguments.includes(
      `SERVICE_COMPLETION_SCHEDULED_ENABLED:${service.scheduledEnabled}`
    ));
    assert(contract.wranglerArguments.includes(
      `EXPERIENCE_COMPLETION_SCHEDULED_ENABLED:${experience.scheduledEnabled}`
    ));
    assert(contract.wranglerArguments.includes('--dry-run'));
  }

  assert.deepEqual(parseDeploymentArguments(['--service-completion-profile=on', '--dry-run']), {
    requestedProfile: undefined,
    requestedTranslationProfile: undefined,
    requestedHomePopularityProfile: undefined,
    requestedAdminSupportUnreadProfile: undefined,
    requestedNotificationRetentionProfile: undefined,
    requestedExperienceCompletionProfile: undefined,
    requestedServiceCompletionProfile: 'on',
    dryRun: true,
  });
});

test('Cancel Pending Bookings defaults ON and retains an explicit Cron addition allowance', async () => {
  const media = resolveReleaseProfile(await readReleasePolicy());
  const translation = resolveTranslationReleaseProfile(await readTranslationReleasePolicy());
  const home = await homeProfile('on');
  const adminSupport = await adminSupportProfile('on');
  const retention = await retentionProfile('on');
  const experience = await experienceCompletionProfile('on');
  const service = await serviceCompletionProfile('on');
  const source = resolveExperienceMediaSourceReleaseProfile(
    await readExperienceMediaSourceReleasePolicy(),
    'on'
  );
  const policy = await readCancelPendingBookingsReleasePolicy();
  assert.equal(resolveCancelPendingBookingsReleaseProfile(policy).name, 'on');

  for (const name of ['off', 'on']) {
    const cancelPending = await cancelPendingBookingsProfile(name);
    const contract = buildDeploymentContract(
      media,
      translation,
      home,
      adminSupport,
      retention,
      {},
      experience,
      source,
      service,
      cancelPending
    );
    assert(contract.wranglerArguments.includes(
      `CANCEL_PENDING_BOOKINGS_SCHEDULED_ENABLED:${cancelPending.scheduledEnabled}`
    ));
  }

  const options = parseDeploymentArguments([
    '--cancel-pending-profile=off',
    '--allow-cancel-pending-cron-addition',
  ]);
  assert.equal(options.requestedCancelPendingBookingsProfile, 'off');
  assert.deepEqual(resolveAllowedPlannedChanges(options), [
    'CANCEL_PENDING_BOOKINGS_SCHEDULED_ENABLED',
  ]);
  assert.deepEqual(resolveAllowedPlannedCronAdditions(options), ['7,37 * * * *']);
  assert.deepEqual(resolveAllowedPlannedCronAdditions(parseDeploymentArguments([])), []);
});

test('passes the Cancel Pending profile and planned Cron addition to semantic preflight', async () => {
  let preflightOptions;
  await main([
    '--service-completion-profile=on',
    '--cancel-pending-profile=off',
    '--allow-cancel-pending-cron-addition',
  ], {
    environment: {},
    runCommand: () => {},
    runBridgeProofFreshness: async () => {},
    runSemanticPreflight: async (options) => {
      preflightOptions = options;
    },
    runBrowserSmoke: async () => {},
    log: () => {},
  });

  assert.equal(
    preflightOptions.expectedVariables.CANCEL_PENDING_BOOKINGS_SCHEDULED_ENABLED,
    'false'
  );
  assert.deepEqual(preflightOptions.allowedPlannedCronAdditions, ['7,37 * * * *']);
  assert(preflightOptions.allowedPlannedChanges.includes(
    'CANCEL_PENDING_BOOKINGS_SCHEDULED_ENABLED'
  ));
});

test('default Production deploy resolves all three scheduled flags ON without planned changes', async () => {
  let preflightOptions;
  const commands = [];
  await main([], {
    environment: {},
    runCommand: (_command, argumentsList) => { commands.push(argumentsList); },
    runBridgeProofFreshness: async () => {},
    runSemanticPreflight: async (options) => { preflightOptions = options; },
    runBrowserSmoke: async () => {},
    log: () => {},
  });

  for (const name of [
    'SERVICE_COMPLETION_SCHEDULED_ENABLED',
    'CANCEL_PENDING_BOOKINGS_SCHEDULED_ENABLED',
    'OPS_ANOMALY_MONITOR_SCHEDULED_ENABLED',
  ]) {
    assert.equal(preflightOptions.expectedVariables[name], 'true');
    assert(commands[1].includes(`${name}:true`));
  }
  assert.deepEqual(preflightOptions.allowedPlannedChanges, []);
  assert.deepEqual(preflightOptions.allowedPlannedCronAdditions, []);
});

test('explicit OFF profiles retain independent rollback for all three scheduled flags', async () => {
  for (const [argument, name] of [
    ['--service-completion-profile=off', 'SERVICE_COMPLETION_SCHEDULED_ENABLED'],
    ['--cancel-pending-profile=off', 'CANCEL_PENDING_BOOKINGS_SCHEDULED_ENABLED'],
    ['--ops-anomaly-monitor-profile=off', 'OPS_ANOMALY_MONITOR_SCHEDULED_ENABLED'],
  ]) {
    let preflightOptions;
    const commands = [];
    await main([argument], {
      environment: {},
      runCommand: (_command, argumentsList) => { commands.push(argumentsList); },
      runBridgeProofFreshness: async () => {},
      runSemanticPreflight: async (options) => { preflightOptions = options; },
      runBrowserSmoke: async () => {},
      log: () => {},
    });
    assert.equal(preflightOptions.expectedVariables[name], 'false');
    assert(commands[1].includes(`${name}:false`));
    assert.deepEqual(preflightOptions.allowedPlannedChanges, [name]);
    for (const other of [
      'SERVICE_COMPLETION_SCHEDULED_ENABLED',
      'CANCEL_PENDING_BOOKINGS_SCHEDULED_ENABLED',
      'OPS_ANOMALY_MONITOR_SCHEDULED_ENABLED',
    ].filter((variable) => variable !== name)) {
      assert.equal(preflightOptions.expectedVariables[other], 'true');
    }
  }
});

test('orders build, semantic preflight, pre-deploy smoke, deploy, and post-deploy smoke', async () => {
  const events = [];
  const commands = [];
  const logs = [];
  let smokeRuns = 0;
  await main([], {
    environment: {},
    runCommand: (command, argumentsList) => {
      commands.push({ command, argumentsList });
      events.push(argumentsList.includes('deploy') ? 'wrangler' : 'build');
    },
    runBridgeProofFreshness: async () => {},
    runSemanticPreflight: async () => {
      events.push('semantic-preflight');
    },
    runBrowserSmoke: async () => {
      events.push(++smokeRuns === 1 ? 'pre-smoke' : 'post-smoke');
    },
    log: (message) => { logs.push(message); },
  });

  assert.deepEqual(events, ['build', 'semantic-preflight', 'pre-smoke', 'wrangler', 'post-smoke']);
  assert.equal(smokeRuns, 2);
  assert.equal(commands.length, 2);
  assert(!commands[0].argumentsList.includes('--dry-run'));
  assert(!commands[1].argumentsList.includes('--dry-run'));
  assert.deepEqual(commands[1].argumentsList.slice(0, 3), ['deploy', '--config', './wrangler.jsonc']);
  assert(logs.includes('PRE_DEPLOY_PRODUCTION_SMOKE_PASS'));
  assert(logs.includes('POST_DEPLOY_PRODUCTION_SMOKE_PASS'));
  assert.equal(JSON.parse(logs.at(-1)).preDeployProductionBrowserSmoke, 'pass');
  assert.equal(JSON.parse(logs.at(-1)).productionBrowserSmoke, 'pass');
});

test('pre-deploy smoke failure preserves diagnostics and prevents Wrangler deploy', async () => {
  const events = [];
  const logs = [];
  const diagnostic = new Error('/login input readiness timed out: {"elapsedMs":45000}');
  await assert.rejects(
    () => main([], {
      environment: {},
      runCommand: (_command, argumentsList) => {
        events.push(argumentsList.includes('deploy') ? 'wrangler' : 'build');
      },
      runBridgeProofFreshness: async () => {},
      runSemanticPreflight: async () => { events.push('semantic-preflight'); },
      runBrowserSmoke: async () => {
        events.push('pre-smoke');
        throw diagnostic;
      },
      log: (message) => { logs.push(message); },
    }),
    (error) => {
      assert.match(error.message, /PRE_DEPLOY_PRODUCTION_SMOKE_FAILED: \/login input readiness timed out/);
      assert.equal(error.cause, diagnostic);
      return true;
    }
  );
  assert.deepEqual(events, ['build', 'semantic-preflight', 'pre-smoke']);
  assert(logs.includes('PRE_DEPLOY_PRODUCTION_SMOKE_FAILED'));
});

test('preflight failure prevents Wrangler deploy invocation', async () => {
  const events = [];
  await assert.rejects(
    () => main([], {
      environment: {},
      runCommand: (_command, argumentsList) => {
        events.push(argumentsList.includes('deploy') ? 'wrangler' : 'build');
      },
      runBridgeProofFreshness: async () => {},
      runSemanticPreflight: async () => {
        events.push('semantic-preflight');
        throw new Error('semantic drift');
      },
      runBrowserSmoke: async () => {
        events.push('browser-smoke');
      },
      log: () => {},
    }),
    /semantic drift/
  );
  assert.deepEqual(events, ['build', 'semantic-preflight']);
});

test('passes the final Service ON deployment contract to semantic preflight', async () => {
  let preflightOptions;
  await main(['--service-completion-profile=on'], {
    environment: {},
    runCommand: () => {},
    runBridgeProofFreshness: async () => {},
    runSemanticPreflight: async (options) => {
      preflightOptions = options;
    },
    runBrowserSmoke: async () => {},
    log: () => {},
  });

  assert.equal(preflightOptions.expectedVariables.SERVICE_COMPLETION_SCHEDULED_ENABLED, 'true');
  assert.deepEqual(preflightOptions.allowedPlannedChanges, ['SERVICE_COMPLETION_SCHEDULED_ENABLED']);
});

test('keeps Ops Anomaly Monitor ON by default and resolves its OFF profile independently', async () => {
  const policy = await readOpsAnomalyMonitorReleasePolicy();
  assert.equal(resolveOpsAnomalyMonitorReleaseProfile(policy).name, 'on');
  assert.deepEqual(resolveOpsAnomalyMonitorReleaseProfile(policy, 'off'), {
    name: 'off',
    scheduledEnabled: 'false',
  });
  assert.deepEqual(parseDeploymentArguments(['--ops-anomaly-monitor-profile=on']), {
    requestedProfile: undefined,
    requestedTranslationProfile: undefined,
    requestedHomePopularityProfile: undefined,
    requestedAdminSupportUnreadProfile: undefined,
    requestedNotificationRetentionProfile: undefined,
    requestedExperienceCompletionProfile: undefined,
    requestedOpsAnomalyMonitorProfile: 'on',
    dryRun: false,
  });
  assert.deepEqual(
    resolveAllowedPlannedChanges(parseDeploymentArguments(['--ops-anomaly-monitor-profile=on'])),
    ['OPS_ANOMALY_MONITOR_SCHEDULED_ENABLED']
  );
});

test('passes only the final Ops Anomaly Monitor ON change to semantic preflight', async () => {
  let preflightOptions;
  await main(['--ops-anomaly-monitor-profile=on'], {
    environment: {},
    runCommand: () => {},
    runBridgeProofFreshness: async () => {},
    runSemanticPreflight: async (options) => {
      preflightOptions = options;
    },
    runBrowserSmoke: async () => {},
    log: () => {},
  });

  assert.equal(preflightOptions.expectedVariables.OPS_ANOMALY_MONITOR_SCHEDULED_ENABLED, 'true');
  assert.deepEqual(preflightOptions.allowedPlannedChanges, [
    'OPS_ANOMALY_MONITOR_SCHEDULED_ENABLED',
  ]);
});

test('includes the Ops Anomaly Monitor flag in the explicit root-config deployment contract', async () => {
  const media = resolveReleaseProfile(await readReleasePolicy());
  const translation = resolveTranslationReleaseProfile(await readTranslationReleasePolicy());
  const mediaSource = resolveExperienceMediaSourceReleaseProfile(
    await readExperienceMediaSourceReleasePolicy()
  );
  const contract = buildDeploymentContract(
    media,
    translation,
    await homeProfile(),
    await adminSupportProfile(),
    await retentionProfile(),
    { dryRun: true },
    await experienceCompletionProfile(),
    mediaSource,
    await serviceCompletionProfile(),
    await cancelPendingBookingsProfile(),
    await opsAnomalyMonitorProfile('on')
  );

  assert.deepEqual(contract.wranglerArguments.slice(0, 3), [
    'deploy',
    '--config',
    './wrangler.jsonc',
  ]);
  assert(contract.wranglerArguments.includes('OPS_ANOMALY_MONITOR_SCHEDULED_ENABLED:true'));
  assert.equal(contract.wranglerArguments.at(-1), '--dry-run');
});

test('does not run post-deploy browser smoke when Wrangler deploy fails', async () => {
  let smokeRuns = 0;
  await assert.rejects(
    () => main([], {
      environment: {},
      runCommand: (_command, argumentsList) => {
        if (argumentsList.includes('deploy')) throw new Error('stub Wrangler failure');
      },
      runBridgeProofFreshness: async () => {},
      runSemanticPreflight: async () => {},
      runBrowserSmoke: async () => {
        smokeRuns += 1;
      },
      log: () => {},
    }),
    /stub Wrangler failure/
  );
  assert.equal(smokeRuns, 1);
});

test('skips browser smoke for Production dry-run', async () => {
  let smokeRuns = 0;
  let preflightRuns = 0;
  let wranglerArguments;
  const logs = [];
  await main(['--dry-run'], {
    environment: {},
    runCommand: (_command, argumentsList) => {
      if (argumentsList.includes('deploy')) wranglerArguments = argumentsList;
    },
    runBrowserSmoke: async () => {
      smokeRuns += 1;
    },
    runBridgeProofFreshness: async () => {},
    runSemanticPreflight: async () => {
      preflightRuns += 1;
    },
    log: (message) => { logs.push(message); },
  });

  assert.equal(smokeRuns, 0);
  assert.equal(preflightRuns, 0);
  assert(wranglerArguments.includes('--dry-run'));
  assert.equal(JSON.parse(logs.at(-1)).preDeployProductionBrowserSmoke, 'skipped');
  assert.equal(JSON.parse(logs.at(-1)).productionBrowserSmoke, 'skipped');
});

test('propagates browser smoke failure after the Worker deploy without rollback', async () => {
  const events = [];
  const logs = [];
  let smokeRuns = 0;
  await assert.rejects(
    () => main([], {
      environment: {},
      runCommand: (_command, argumentsList) => {
        events.push(argumentsList.includes('deploy') ? 'wrangler' : 'build');
      },
      runBridgeProofFreshness: async () => {},
      runSemanticPreflight: async () => {
        events.push('semantic-preflight');
      },
      runBrowserSmoke: async () => {
        events.push(++smokeRuns === 1 ? 'pre-smoke' : 'post-smoke');
        if (smokeRuns === 2) throw new Error('homepage smoke stage failed');
      },
      log: (message) => { logs.push(message); },
    }),
    /POST_DEPLOY_PRODUCTION_SMOKE_FAILED: Production Worker deploy completed, but browser smoke failed: homepage smoke stage failed.*Automatic rollback was not attempted/
  );
  assert.deepEqual(events, ['build', 'semantic-preflight', 'pre-smoke', 'wrangler', 'post-smoke']);
  assert.equal(smokeRuns, 2);
  assert(logs.includes('POST_DEPLOY_PRODUCTION_SMOKE_FAILED'));
});

test('completes successfully when browser smoke passes', async () => {
  const events = [];
  let smokeRuns = 0;
  await main([], {
    environment: {},
    runCommand: (_command, argumentsList) => {
      events.push(argumentsList.includes('deploy') ? 'wrangler' : 'build');
    },
    runBridgeProofFreshness: async () => {},
    runSemanticPreflight: async () => {
      events.push('semantic-preflight');
    },
    runBrowserSmoke: async () => {
      events.push(++smokeRuns === 1 ? 'pre-smoke' : 'post-smoke');
    },
    log: () => {},
  });
  assert.deepEqual(events, ['build', 'semantic-preflight', 'pre-smoke', 'wrangler', 'post-smoke']);
});


test('NICEPAY recovery requires an explicit release flag after the database migration', async () => {
  const defaultContract = await resolveProductionDeploymentContract(parseDeploymentArguments(['--dry-run']));
  assert.equal(defaultContract.runtimeVariables.NICEPAY_RECOVERY_SCHEDULED_ENABLED, 'true');
  assert.ok(defaultContract.wranglerArguments.includes('NICEPAY_RECOVERY_SCHEDULED_ENABLED:true'));
  assert.equal(parseDeploymentArguments([]).nicepayRecoveryEnabled, undefined);
  const options = parseDeploymentArguments(['--dry-run', '--enable-nicepay-recovery']);
  const enabled = await resolveProductionDeploymentContract(options);
  assert.equal(enabled.runtimeVariables.NICEPAY_RECOVERY_SCHEDULED_ENABLED, 'true');
  assert.ok(resolveAllowedPlannedChanges(options).includes('NICEPAY_RECOVERY_SCHEDULED_ENABLED'));
  assert.ok(enabled.wranglerArguments.includes('NICEPAY_RECOVERY_SCHEDULED_ENABLED:true'));
});
