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

const ROOT = process.cwd();

export function parseDeploymentArguments(argumentsList) {
  let requestedProfile;
  let requestedTranslationProfile;
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
    } else if (argument === '--dry-run') {
      dryRun = true;
    } else {
      throw new Error(`Unsupported Production deployment argument: ${argument}`);
    }
  }
  return { requestedProfile, requestedTranslationProfile, dryRun };
}

export function buildDeploymentContract(profile, translationProfile, { dryRun = false } = {}) {
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
  const contract = buildDeploymentContract(profile, translationProfile, options);
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
  }));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await main();
}
