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
import { readServiceCompletionReleasePolicy, resolveServiceCompletionReleaseProfile } from './service-completion-release-profile.mjs';
import { readCancelPendingBookingsReleasePolicy, resolveCancelPendingBookingsReleaseProfile } from './cancel-pending-bookings-release-profile.mjs';
import { readExperienceMediaSourceReleasePolicy, resolveExperienceMediaSourceReleaseProfile } from './experience-media-source-release-profile.mjs';
import { runProductionBrowserSmoke } from './run-production-browser-smoke.mjs';
import { runProductionDeploySemanticPreflight } from './verify-production-deploy-contract.mjs';

const ROOT = process.cwd();

export function parseDeploymentArguments(argumentsList) {
  let requestedProfile;
  let requestedTranslationProfile;
  let requestedHomePopularityProfile;
  let requestedAdminSupportUnreadProfile;
  let requestedNotificationRetentionProfile;
  let requestedExperienceCompletionProfile;
  let requestedServiceCompletionProfile;
  let requestedExperienceMediaSourceProfile;
  let requestedCancelPendingBookingsProfile;
  let allowCancelPendingCronAddition = false;
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
    } else if (argument.startsWith('--experience-media-source-profile=')) {
      assert(!requestedExperienceMediaSourceProfile, 'Specify the Experience media source release profile only once.');
      requestedExperienceMediaSourceProfile = argument.slice('--experience-media-source-profile='.length);
      assert(requestedExperienceMediaSourceProfile, 'The Experience media source release profile cannot be empty.');
    } else if (argument.startsWith('--service-completion-profile=')) {
      assert(!requestedServiceCompletionProfile, 'Specify the Service completion release profile only once.');
      requestedServiceCompletionProfile = argument.slice('--service-completion-profile='.length);
      assert(requestedServiceCompletionProfile, 'The Service completion release profile cannot be empty.');
    } else if (argument.startsWith('--cancel-pending-profile=')) {
      assert(!requestedCancelPendingBookingsProfile, 'Specify the Cancel Pending Bookings release profile only once.');
      requestedCancelPendingBookingsProfile = argument.slice('--cancel-pending-profile='.length);
      assert(requestedCancelPendingBookingsProfile, 'The Cancel Pending Bookings release profile cannot be empty.');
    } else if (argument === '--allow-cancel-pending-cron-addition') {
      assert(!allowCancelPendingCronAddition, 'Allow the Cancel Pending Bookings Cron addition only once.');
      allowCancelPendingCronAddition = true;
    } else if (argument === '--dry-run') {
      dryRun = true;
    } else {
      throw new Error(`Unsupported Production deployment argument: ${argument}`);
    }
  }
  return {
    requestedProfile,
    requestedTranslationProfile,
    requestedHomePopularityProfile,
    requestedAdminSupportUnreadProfile,
    requestedNotificationRetentionProfile,
    requestedExperienceCompletionProfile,
    ...(requestedExperienceMediaSourceProfile
      ? { requestedExperienceMediaSourceProfile }
      : {}),
    ...(requestedServiceCompletionProfile
      ? { requestedServiceCompletionProfile }
      : {}),
    ...(requestedCancelPendingBookingsProfile
      ? { requestedCancelPendingBookingsProfile }
      : {}),
    ...(allowCancelPendingCronAddition
      ? { allowCancelPendingCronAddition: true }
      : {}),
    dryRun,
  };
}

export function buildDeploymentContract(profile, translationProfile, homePopularityProfile, adminSupportUnreadProfile, notificationRetentionProfile, { dryRun = false } = {}, experienceCompletionProfile = { scheduledEnabled: 'false' }, experienceMediaSourceProfile = { enabled: 'false' }, serviceCompletionProfile = { scheduledEnabled: 'false' }, cancelPendingBookingsProfile = { scheduledEnabled: 'false' }) {
  const readerEnvironment = {
    NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED: profile.enabled,
    NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS: profile.experienceIds,
  };
  const runtimeVariables = {
    CLOUDFLARE_DEPLOYMENT_ENV: 'production',
    PUBLIC_EXPERIENCE_MEDIA_PRODUCER_ENABLED: profile.enabled,
    PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS: profile.experienceIds,
    EXPERIENCE_MEDIA_R2_SOURCE_ENABLED: experienceMediaSourceProfile.enabled,
    EXPERIENCE_TRANSLATION_QUEUE_ENABLED: translationProfile.queueEnabled,
    EXPERIENCE_TRANSLATION_SCHEDULED_RECOVERY_ENABLED: translationProfile.scheduledRecoveryEnabled,
    HOME_POPULARITY_SNAPSHOT_SCHEDULED_ENABLED: homePopularityProfile.scheduledEnabled,
    ADMIN_SUPPORT_UNREAD_ALERTS_SCHEDULED_ENABLED: adminSupportUnreadProfile.scheduledEnabled,
    NOTIFICATION_RETENTION_CLEANUP_SCHEDULED_ENABLED: notificationRetentionProfile.scheduledEnabled,
    EXPERIENCE_COMPLETION_SCHEDULED_ENABLED: experienceCompletionProfile.scheduledEnabled,
    SERVICE_COMPLETION_SCHEDULED_ENABLED: serviceCompletionProfile.scheduledEnabled,
    CANCEL_PENDING_BOOKINGS_SCHEDULED_ENABLED: cancelPendingBookingsProfile.scheduledEnabled,
  };
  const wranglerArguments = [
    'deploy',
    '--config',
    './wrangler.jsonc',
    '--env',
    'production',
    '--autoconfig=false',
    ...Object.entries(runtimeVariables).flatMap(([name, value]) => ['--var', `${name}:${value}`]),
  ];
  if (dryRun) wranglerArguments.push('--dry-run');
  return { readerEnvironment, runtimeVariables, wranglerArguments };
}

export function resolveAllowedPlannedChanges(options) {
  const changes = [];
  if (options.requestedProfile) {
    changes.push(
      'PUBLIC_EXPERIENCE_MEDIA_PRODUCER_ENABLED',
      'PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS'
    );
  }
  if (options.requestedTranslationProfile) {
    changes.push(
      'EXPERIENCE_TRANSLATION_QUEUE_ENABLED',
      'EXPERIENCE_TRANSLATION_SCHEDULED_RECOVERY_ENABLED'
    );
  }
  if (options.requestedHomePopularityProfile) changes.push('HOME_POPULARITY_SNAPSHOT_SCHEDULED_ENABLED');
  if (options.requestedAdminSupportUnreadProfile) changes.push('ADMIN_SUPPORT_UNREAD_ALERTS_SCHEDULED_ENABLED');
  if (options.requestedNotificationRetentionProfile) changes.push('NOTIFICATION_RETENTION_CLEANUP_SCHEDULED_ENABLED');
  if (options.requestedExperienceCompletionProfile) changes.push('EXPERIENCE_COMPLETION_SCHEDULED_ENABLED');
  if (options.requestedExperienceMediaSourceProfile) changes.push('EXPERIENCE_MEDIA_R2_SOURCE_ENABLED');
  if (options.requestedServiceCompletionProfile) changes.push('SERVICE_COMPLETION_SCHEDULED_ENABLED');
  if (options.requestedCancelPendingBookingsProfile) changes.push('CANCEL_PENDING_BOOKINGS_SCHEDULED_ENABLED');
  return changes;
}

export function resolveAllowedPlannedCronAdditions(options) {
  return options.allowCancelPendingCronAddition ? ['7,37 * * * *'] : [];
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

export async function main(argumentsList = process.argv.slice(2), dependencies = {}) {
  const runCommand = dependencies.runCommand ?? run;
  const runBrowserSmoke = dependencies.runBrowserSmoke ?? runProductionBrowserSmoke;
  const runSemanticPreflight = dependencies.runSemanticPreflight ?? runProductionDeploySemanticPreflight;
  const log = dependencies.log ?? console.log;
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
  const serviceCompletionPolicy = await readServiceCompletionReleasePolicy();
  const serviceCompletionProfile = resolveServiceCompletionReleaseProfile(serviceCompletionPolicy, options.requestedServiceCompletionProfile);
  const cancelPendingBookingsPolicy = await readCancelPendingBookingsReleasePolicy();
  const cancelPendingBookingsProfile = resolveCancelPendingBookingsReleaseProfile(cancelPendingBookingsPolicy, options.requestedCancelPendingBookingsProfile);
  const experienceMediaSourcePolicy = await readExperienceMediaSourceReleasePolicy();
  const experienceMediaSourceProfile = resolveExperienceMediaSourceReleaseProfile(experienceMediaSourcePolicy, options.requestedExperienceMediaSourceProfile);
  const contract = buildDeploymentContract(profile, translationProfile, homePopularityProfile, adminSupportUnreadProfile, notificationRetentionProfile, options, experienceCompletionProfile, experienceMediaSourceProfile, serviceCompletionProfile, cancelPendingBookingsProfile);
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const wranglerCommand = path.join(
    ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler'
  );

  runCommand(npmCommand, ['run', 'cloudflare:build:production'], {
    env: { ...process.env, ...contract.readerEnvironment },
  });
  if (!options.dryRun) {
    await runSemanticPreflight({
      expectedVariables: contract.runtimeVariables,
      allowedPlannedChanges: resolveAllowedPlannedChanges(options),
      allowedPlannedCronAdditions: resolveAllowedPlannedCronAdditions(options),
      wranglerCommand,
      log,
    });
  }
  runCommand(wranglerCommand, contract.wranglerArguments);
  if (!options.dryRun) {
    try {
      await runBrowserSmoke();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Production Worker deploy completed, but browser smoke failed: ${reason} Automatic rollback was not attempted.`
      );
    }
  }
  log(JSON.stringify({
    status: options.dryRun
      ? 'LOCALLY_CLOUDFLARE_PRODUCTION_DEPLOY_DRY_RUN_PASS'
      : 'LOCALLY_CLOUDFLARE_PRODUCTION_DEPLOY_PASS',
    productionBrowserSmoke: options.dryRun ? 'skipped' : 'pass',
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
    serviceCompletionProfile: serviceCompletionProfile.name,
    serviceCompletionScheduledEnabled: serviceCompletionProfile.scheduledEnabled,
    cancelPendingBookingsProfile: cancelPendingBookingsProfile.name,
    cancelPendingBookingsScheduledEnabled: cancelPendingBookingsProfile.scheduledEnabled,
    experienceMediaSourceProfile: experienceMediaSourceProfile.name,
    experienceMediaR2SourceEnabled: experienceMediaSourceProfile.enabled,
  }));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await main();
}
