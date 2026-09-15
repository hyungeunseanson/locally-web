import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readReleasePolicy,
  resolveReleaseProfile,
  validateReleasePolicy,
} from './public-experience-media-release-profile.mjs';
import {
  buildDeploymentContract,
  parseDeploymentArguments,
} from './run-production-deploy.mjs';
import { readTranslationReleasePolicy, resolveTranslationReleaseProfile } from './experience-translation-release-profile.mjs';
import { readHomePopularityReleasePolicy, resolveHomePopularityReleaseProfile } from './home-popularity-release-profile.mjs';
import { readAdminSupportUnreadReleasePolicy, resolveAdminSupportUnreadReleaseProfile } from './admin-support-unread-release-profile.mjs';
import { readNotificationRetentionReleasePolicy, resolveNotificationRetentionReleaseProfile } from './notification-retention-release-profile.mjs';
import { readExperienceCompletionReleasePolicy, resolveExperienceCompletionReleaseProfile } from './experience-completion-release-profile.mjs';
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
  assert(contract.wranglerArguments.includes('CLOUDFLARE_DEPLOYMENT_ENV:production'));
  assert(!contract.wranglerArguments.some((argument) => argument.includes('*')));
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
