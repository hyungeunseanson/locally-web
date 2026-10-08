import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import {
  profile,
  verifyPinnedReleaseBrowser,
} from "./verify-pinned-release-browser.mjs";

assert.equal(process.platform, "darwin");
assert.equal(process.arch, "arm64");
assert.equal(
  execFileSync("/usr/bin/uname", ["-m"], { encoding: "utf8" }).trim(),
  "arm64",
);
assert.equal(
  profile.officialDownload,
  "https://storage.googleapis.com/chrome-for-testing-public/157.0.8091.0/mac-arm64/chrome-mac-arm64.zip",
);
const evidence = resolve(process.argv[2]);
const directory = await mkdtemp(
  join(process.env.RUNNER_TEMP, "chromium8508456-"),
);
const archive = join(directory, "chrome.zip");
// No redirects, alternate URL, fallback, quarantine removal or re-signing.
const response = await fetch(profile.officialDownload, {
  redirect: "error",
  signal: AbortSignal.timeout(120000),
});
assert.equal(response.status, 200);
assert.equal(response.url, profile.officialDownload);
const bytes = Buffer.from(await response.arrayBuffer());
assert.equal(
  createHash("sha256").update(bytes).digest("hex"),
  profile.archiveSHA256,
);
await writeFile(archive, bytes, { mode: 0o600 });
execFileSync("/usr/bin/ditto", ["-x", "-k", archive, directory]);
const executable = join(
  directory,
  "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
);
assert.equal(
  execFileSync("/usr/bin/lipo", ["-archs", executable], {
    encoding: "utf8",
  }).trim(),
  "arm64",
);
const signing = spawnSync(
  "/usr/bin/codesign",
  [
    "--verify",
    "--deep",
    "--strict",
    executable.replace("/Contents/MacOS/Google Chrome for Testing", ""),
  ],
  { encoding: "utf8" },
);
const receipt = {
  runner: {
    os: process.platform,
    architecture: process.arch,
    release: execFileSync("/usr/bin/sw_vers", ["-productVersion"], {
      encoding: "utf8",
    }).trim(),
  },
  url: response.url,
  archiveBytes: bytes.length,
  archiveSHA256: profile.archiveSHA256,
  machOArchitectures: "arm64",
  codesign: { exitCode: signing.status, qualification: profile.signing },
  bypass: false,
};
// Preserve acquisition evidence even if native security refuses launch.
await writeFile(
  join(evidence, "acquisition.json"),
  JSON.stringify(receipt, null, 2),
);
receipt.identity = await verifyPinnedReleaseBrowser(executable);
await writeFile(
  join(evidence, "acquisition.json"),
  JSON.stringify(receipt, null, 2),
);
await writeFile(
  process.env.GITHUB_ENV,
  "PLAYWRIGHT_EXECUTABLE_PATH=" + executable + "\n",
  { flag: "a" },
);
console.log(JSON.stringify(receipt));
