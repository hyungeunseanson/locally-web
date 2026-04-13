import { readdirSync, readFileSync } from 'fs';
import path from 'path';

const SPEC_DIR = path.resolve('tests/e2e');
const LIVE_HOST_REUSE_ALLOWLIST = new Set([
  '04-live-host-experience-create.spec.ts',
]);

function readSpecFiles() {
  return readdirSync(SPEC_DIR)
    .filter((entry) => entry.endsWith('.spec.ts'))
    .sort();
}

function scanSpec(file) {
  const source = readFileSync(path.join(SPEC_DIR, file), 'utf8');
  const touchesHostApplications = /from\((['"])host_applications\1\)/.test(source);
  const touchesHostRegisterPage = /page\.(goto|waitForURL)\((['"`])[^'"`]*\/host\/register/i.test(source);
  const touchesHostRegisterSubmit = /\/api\/host\/register\/submit/.test(source);
  const touchesHostRegister = touchesHostRegisterPage || touchesHostRegisterSubmit;
  const createsAuthUser =
    /auth\.admin\.createUser|\/auth\/v1\/signup|createAuthUser\(/.test(source);
  const hasAfterAll = /test\.afterAll\s*\(/.test(source);
  const deletesHostApplications = /from\((['"])host_applications\1\)[\s\S]*?\.delete\(/.test(source);
  const deletesHostApplicationsByUserOrEmail =
    /from\((['"])host_applications\1\)[\s\S]*?\.delete\(\)[\s\S]*?\.(eq|in)\((['"])(user_id|email)\3/.test(source);

  let note = '';
  if (LIVE_HOST_REUSE_ALLOWLIST.has(file)) {
    note = 'intentional live host reuse';
  }

  const suspiciousDirectHostApplicationCleanup =
    touchesHostApplications &&
    !deletesHostApplications &&
    !LIVE_HOST_REUSE_ALLOWLIST.has(file);

  const suspiciousHostRegisterCleanup =
    touchesHostRegister &&
    createsAuthUser &&
    !deletesHostApplications &&
    !deletesHostApplicationsByUserOrEmail;

  return {
    file,
    touchesHostApplications,
    touchesHostRegister,
    touchesHostRegisterPage,
    touchesHostRegisterSubmit,
    createsAuthUser,
    hasAfterAll,
    deletesHostApplications,
    deletesHostApplicationsByUserOrEmail,
    suspiciousDirectHostApplicationCleanup,
    suspiciousHostRegisterCleanup,
    note,
  };
}

function main() {
  const files = readSpecFiles();
  const results = files.map(scanSpec);

  const hostApplicationSpecs = results.filter((entry) => entry.touchesHostApplications);
  const hostRegisterSpecs = results.filter((entry) => entry.touchesHostRegister);

  const summary = {
    totalSpecs: results.length,
    hostApplicationSpecs: hostApplicationSpecs.length,
    hostRegisterSpecs: hostRegisterSpecs.length,
    suspiciousDirectHostApplicationCleanup: results
      .filter((entry) => entry.suspiciousDirectHostApplicationCleanup)
      .map((entry) => entry.file),
    suspiciousHostRegisterCleanup: results
      .filter((entry) => entry.suspiciousHostRegisterCleanup)
      .map((entry) => entry.file),
    liveHostReuseAllowlist: Array.from(LIVE_HOST_REUSE_ALLOWLIST),
  };

  console.log(JSON.stringify({ summary, files: results }, null, 2));
}

main();
