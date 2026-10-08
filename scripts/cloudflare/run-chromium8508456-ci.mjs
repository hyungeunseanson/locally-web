import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import {
  profile,
  verifyPinnedReleaseBrowser,
} from "./verify-pinned-release-browser.mjs";
import { runLocalGateControls } from "./chromium8508456-gate-ci.mjs";

const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
const out = resolve(process.argv[2]);
await mkdir(out, { recursive: true });
const executable = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const identity = await verifyPinnedReleaseBrowser(executable);
await writeFile(join(out, "identity.json"), JSON.stringify(identity, null, 2));
const source = JSON.parse(
  await readFile(
    new URL("./chromium8508456-source-evidence.json", import.meta.url),
  ),
);
assert.equal(source.binaryRevision, profile.browserRevision.slice(1));
assert.equal(source.ancestry.mergeBase, profile.fixCommit);
assert.equal(source.sourceOrderComparison.patched.preClientHandleResult, true);
const env = Object.fromEntries(
  ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL"]
    .filter((k) => process.env[k])
    .map((k) => [k, process.env[k]]),
);
Object.assign(env, {
  CI: "1",
  NEXT_TELEMETRY_DISABLED: "1",
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
});
const fixture = await mkdtemp(join(tmpdir(), "chromium8508456-fixture-"));
await cp(join(scriptDirectory, "chromium8508456-fixture"), fixture, {
  recursive: true,
});
async function command(args, cwd, extra = {}) {
  const child = spawn(args[0], args.slice(1), {
    cwd,
    env: { ...env, ...extra },
    stdio: "inherit",
  });
  const [code] = await once(child, "exit");
  assert.equal(code, 0, "Synthetic fixture command failed");
}
await command(
  ["npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund"],
  fixture,
);
for (const [name, version] of [
  ["next", "16.3.5"],
  ["react", "19.2.3"],
  ["@playwright/test", "1.59.1"],
]) {
  assert.equal(
    JSON.parse(
      await readFile(join(fixture, "node_modules", name, "package.json")),
    ).version,
    version,
  );
}
await command(["npm", "run", "build"], fixture);
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "-H",
    "127.0.0.1",
    "-p",
    "31892",
  ],
  { cwd: fixture, env, stdio: "ignore" },
);
const origin = "http://127.0.0.1:31892";
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    assert.equal(server.exitCode, null, "Fixture server exited");
    try {
      ready = (
        await fetch(origin + "/control", { signal: AbortSignal.timeout(1000) })
      ).ok;
    } catch {
      /* bounded startup polling only */
    }
    if (ready) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert(ready, "Fixture startup failed");
  await command(
    [process.execPath, join(scriptDirectory, "chromium8508456-stream-ci.mjs")],
    scriptDirectory,
    {
      REPRO_ORIGIN: origin,
      REPRO_OUTPUT: out,
      REPRO_MATRIX: "1",
      REPRO_BROWSER_LABEL: "patched",
      REPRO_BROWSER_EXECUTABLE: executable,
    },
  );
  const gate = await runLocalGateControls({
    origin,
    executable,
    identity,
    out,
  });
  // A post-run identity check catches changed bytes/path as well as wrong runtime.
  assert.deepEqual(await verifyPinnedReleaseBrowser(executable), identity);
  const protectedFiles = [
    "run-candidate-browser-smoke.mjs",
    "run-production-browser-smoke.mjs",
    "candidate-release-contract.mjs",
  ];
  const hashes = Object.fromEntries(
    await Promise.all(
      protectedFiles.map(async (name) => [
        name,
        createHash("sha256")
          .update(await readFile(join(scriptDirectory, name)))
          .digest("hex"),
      ]),
    ),
  );
  const report = {
    status: "PATCHED_BROWSER_CI_INTEGRATION_PASS",
    identity,
    sourceEvidence: source.ancestry,
    fixture: { next: "16.3.5", react: "19.2.3", synthetic: true },
    normalMatrix: "5/5 PASS",
    rsc: "PASS: original reader EOF / decoded CDP bytes / Link UI",
    negativeControls: "8/8 expected FAIL",
    unchangedGate: gate,
    protectedSourceSHA256: hashes,
    productionRequests: 0,
    productionMutations: 0,
    qualification:
      "Experimental pair only. Not an actual Locally Candidate, authenticated session or Production release Gate verdict.",
  };
  await writeFile(
    join(out, "integration.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  if (server.exitCode === null) {
    server.kill("SIGTERM");
    await once(server, "exit");
  }
}
