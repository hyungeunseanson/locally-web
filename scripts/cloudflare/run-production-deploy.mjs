import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import {
  readReleasePolicy,
  resolveReleaseProfile,
} from './public-experience-media-release-profile.mjs';
import { readTranslationReleasePolicy, resolveTranslationReleaseProfile } from './experience-translation-release-profile.mjs';
import { readHomePopularityReleasePolicy, resolveHomePopularityReleaseProfile } from './home-popularity-release-profile.mjs';
import { readAdminSupportUnreadReleasePolicy, resolveAdminSupportUnreadReleaseProfile } from './admin-support-unread-release-profile.mjs';
import { readNotificationRetentionReleasePolicy, resolveNotificationRetentionReleaseProfile } from './notification-retention-release-profile.mjs';
import { readExperienceCompletionReleasePolicy, resolveExperienceCompletionReleaseProfile } from './experience-completion-release-profile.mjs';

const ROOT = process.cwd();

export function parseDeploymentArguments(argumentsList) {
  let requestedProfile;
  let requestedTranslationProfile;
  let requestedHomePopularityProfile;
  let requestedAdminSupportUnreadProfile;
  let requestedNotificationRetentionProfile;
  let requestedExperienceCompletionProfile;
  let dryRun = false;
  for (const argument of argumentsList) {
    if (argument.startsWith('--media-profile=')) {
      assert(!requestedProfile, 'Specify the public media release profile only once.');
      requestedProfile = argument.slice('--media-profile='.length);
      assert(requestedProfile, 'The public media release profile cannot be empty.');
    } else if (argument.startsWith('--translation-profile=')) {
      assert(!requestedTranslationProfile, 'Specify the translation release profile only once.');
      requestedTranslationProfile = argument.slice('--translation-profile='.length);
      assert(requestedTranslationProfile, 'The translation release profile cannot be empty.');
    } else if (argument.startsWith('--home-popularity-profile=')) {
      assert(!requestedHomePopularityProfile, 'Specify the Home popularity release profile only once.');
      requestedHomePopularityProfile = argument.slice('--home-popularity-profile='.length);
      assert(requestedHomePopularityProfile, 'The Home popularity release profile cannot be empty.');
    } else if (argument.startsWith('--admin-support-unread-profile=')) {
      assert(!requestedAdminSupportUnreadProfile, 'Specify the Admin Support unread release profile only once.');
      requestedAdminSupportUnreadProfile = argument.slice('--admin-support-unread-profile='.length);
      assert(requestedAdminSupportUnreadProfile, 'The Admin Support unread release profile cannot be empty.');
    } else if (argument.startsWith('--notification-retention-profile=')) {
      assert(!requestedNotificationRetentionProfile, 'Specify the notification retention release profile only once.');
      requestedNotificationRetentionProfile = argument.slice('--notification-retention-profile='.length);
      assert(requestedNotificationRetentionProfile, 'The notification retention release profile cannot be empty.');
    } else if (argument.startsWith('--experience-completion-profile=')) {
      assert(!requestedExperienceCompletionProfile, 'Specify the Experience completion release profile only once.');
      requestedExperienceCompletionProfile = argument.slice('--experience-completion-profile='.length);
      assert(requestedExperienceCompletionProfile, 'The Experience completion release profile cannot be empty.');
    } else if (argument === '--dry-run') {
      dryRun = true;
    } else {
      throw new Error(`Unsupported Production deployment argument: ${argument}`);
    }
  }
  return { requestedProfile, requestedTranslationProfile, requestedHomePopularityProfile, requestedAdminSupportUnreadProfile, requestedNotificationRetentionProfile, requestedExperienceCompletionProfile, dryRun };
}

export function buildDeploymentContract(profile, translationProfile, homePopularityProfile, adminSupportUnreadProfile, notificationRetentionProfile, { dryRun = false } = {}, experienceCompletionProfile = { scheduledEnabled: 'false' }) {
  const readerEnvironment = {
    NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED: profile.enabled,
    NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS: profile.experienceIds,
  };
  const wranglerArguments = [
    'deploy',
    '--env',
    'production',
    '--autoconfig=false',
    '--var',
    'CLOUDFLARE_DEPLOYMENT_ENV:production',
    '--var',
    `PUBLIC_EXPERIENCE_MEDIA_PRODUCER_ENABLED:${profile.enabled}`,
    '--var',
    `PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS:${profile.experienceIds}`,
    '--var',
    `EXPERIENCE_TRANSLATION_QUEUE_ENABLED:${translationProfile.queueEnabled}`,
    '--var',
    `EXPERIENCE_TRANSLATION_SCHEDULED_RECOVERY_ENABLED:${translationProfile.scheduledRecoveryEnabled}`,
    '--var',
    `HOME_POPULARITY_SNAPSHOT_SCHEDULED_ENABLED:${homePopularityProfile.scheduledEnabled}`,
    '--var',
    `ADMIN_SUPPORT_UNREAD_ALERTS_SCHEDULED_ENABLED:${adminSupportUnreadProfile.scheduledEnabled}`,
    '--var',
    `NOTIFICATION_RETENTION_CLEANUP_SCHEDULED_ENABLED:${notificationRetentionProfile.scheduledEnabled}`,
    `EXPERIENCE_COMPLETION_SCHEDULED_ENABLED:${experienceCompletionProfile.scheduledEnabled}`,
  ];
  if (dryRun) wranglerArguments.push('--dry-run');
  return { readerEnvironment, wranglerArguments };
}

function run(command, argumentsList, options = {}) {
  const result = spawnSync(command, argumentsList, {
    cwd: ROOT,
    env: options.env ?? process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} failed with exit code ${result.status}.`);
  }
}

export async function main(argumentsList = process.argv.slice(2)) {
  const options = parseDeploymentArguments(argumentsList);
  const policy = await readReleasePolicy();
  const profile = resolveReleaseProfile(policy, options.requestedProfile);
  const translationPolicy = await readTranslationReleasePolicy();
  const translationProfile = resolveTranslationReleaseProfile(translationPolicy, options.requestedTranslationProfile);
  const homePopularityPolicy = await readHomePopularityReleasePolicy();
  const homePopularityProfile = resolveHomePopularityReleaseProfile(homePopularityPolicy, options.requestedHomePopularityProfile);
  const adminSupportUnreadPolicy = await readAdminSupportUnreadReleasePolicy();
  const adminSupportUnreadProfile = resolveAdminSupportUnreadReleaseProfile(adminSupportUnreadPolicy, options.requestedAdminSupportUnreadProfile);
  const notificationRetentionPolicy = await readNotificationRetentionReleasePolicy();
  const notificationRetentionProfile = resolveNotificationRetentionReleaseProfile(notificationRetentionPolicy, options.requestedNotificationRetentionProfile);
  const experienceCompletionPolicy = await readExperienceCompletionReleasePolicy();
  const experienceCompletionProfile = resolveExperienceCompletionReleaseProfile(experienceCompletionPolicy, options.requestedExperienceCompletionProfile);
  const contract = buildDeploymentContract(profile, translationProfile, homePopularityProfile, adminSupportUnreadProfile, notificationRetentionProfile, options, experienceCompletionProfile);
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const wranglerCommand = path.join(
    ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler'
  );

  run(npmCommand, ['run', 'cloudflare:build:production'], {
    env: { ...process.env, ...contract.readerEnvironment },
  });
  run(wranglerCommand, contract.wranglerArguments);
  console.log(JSON.stringify({
    status: options.dryRun
      ? 'LOCALLY_CLOUDFLARE_PRODUCTION_DEPLOY_DRY_RUN_PASS'
      : 'LOCALLY_CLOUDFLARE_PRODUCTION_DEPLOY_PASS',
    publicExperienceMediaProfile: profile.name,
    publicExperienceMediaEnabled: profile.enabled,
    publicExperienceMediaExperienceCount: profile.experienceCount,
    experienceTranslationProfile: translationProfile.name,
    experienceTranslationQueueEnabled: translationProfile.queueEnabled,
    experienceTranslationScheduledRecoveryEnabled: translationProfile.scheduledRecoveryEnabled,
    homePopularityProfile: homePopularityProfile.name,
    homePopularityScheduledEnabled: homePopularityProfile.scheduledEnabled,
    adminSupportUnreadProfile: adminSupportUnreadProfile.name,
    adminSupportUnreadScheduledEnabled: adminSupportUnreadProfile.scheduledEnabled,
    notificationRetentionProfile: notificationRetentionProfile.name,
    notificationRetentionScheduledEnabled: notificationRetentionProfile.scheduledEnabled,
    experienceCompletionProfile: experienceCompletionProfile.name,
    experienceCompletionScheduledEnabled: experienceCompletionProfile.scheduledEnabled,
  }));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await main();
}
