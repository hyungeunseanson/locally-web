import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import {
  profile,
  verifyPinnedReleaseBrowser,
} from "./verify-pinned-release-browser.mjs";
import {
  visitReadOnlyPage,
  installProductionMutationGate,
  runProductionBrowserSmoke,
} from "./run-production-browser-smoke.mjs";

export async function nativeProcessArchitecture(browser) {
  const cdp = await browser.newBrowserCDPSession();
  try {
    const { processInfo } = await cdp.send("SystemInfo.getProcessInfo");
    const pid = processInfo.find((p) => p.type === "browser").id;
    // sample observes the running process, rather than inferring architecture
    // from the host or Mach-O. Retain only Code Type, never stacks or addresses.
    const report = execFileSync("/usr/bin/sample", [String(pid), "1", "1"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const architecture = report.match(/Code Type:\s+([^\r\n]+)/)?.[1].trim();
    assert.match(architecture ?? "", /^(ARM64|ARM-64 \(Native\))$/);
    return architecture;
  } finally {
    await cdp.detach();
  }
}

async function processIdentity(context) {
  const page = await context.newPage();
  try {
    const cdp = await context.newCDPSession(page);
    const version = await cdp.send("Browser.getVersion");
    assert.equal(version.product, "Chrome/" + profile.browserVersion);
    assert.equal(version.revision, profile.browserRevision);
    const architecture = await nativeProcessArchitecture(context.browser());
    return {
      product: version.product,
      revision: version.revision,
      architecture,
    };
  } finally {
    await page.close();
  }
}

export async function runLocalGateControls({
  origin,
  executable,
  identity,
  out,
}) {
  assert.deepEqual(await verifyPinnedReleaseBrowser(executable), identity);
  const browser = await chromium.launch({
    headless: true,
    executablePath: executable,
  });
  const cases = [];
  try {
    for (const mode of ["normal-rsc", "malformed-flight", "pageerror"]) {
      const context = await browser.newContext({ serviceWorkers: "block" });
      const actualIdentity = await processIdentity(context);
      const mutationGate = await installProductionMutationGate(context, origin);
      await context.route("**/*", async (route) => {
        assert.equal(
          new URL(route.request().url()).origin,
          origin,
          "Loopback requests only",
        );
        await route.fallback();
      });
      const diagnostics = [],
        errors = [],
        consoles = [],
        failures = [],
        faults = [];
      let closing = false;
      context.on("page", (page) => {
        page.on("pageerror", (e) =>
          errors.push({ name: e.name, afterTeardown: closing }),
        );
        page.on("console", (m) => {
          if (m.type() === "error")
            consoles.push({
              digest: createHash("sha256").update(m.text()).digest("hex"),
              afterTeardown: closing,
            });
        });
        page.on("requestfailed", (q) =>
          failures.push({
            pathname: new URL(q.url()).pathname,
            type: q.resourceType(),
            error: q.failure()?.errorText,
            afterTeardown: closing,
          }),
        );
      });
      if (mode === "malformed-flight")
        await context.route("**/detail/example?**", async (route) => {
          const isFlight = route.request().headers().rsc === "1";
          // Deliberately invalid synthetic Flight; a fallback document also cannot
          // recover healthy Detail UI. No forced test failure or accepted exception.
          faults.push({
            type: isFlight ? "malformed-flight" : "fallback-document",
            bytes: 34,
          });
          await route.fulfill({
            status: 200,
            contentType: isFlight ? "text/x-component" : "text/html",
            body: "Synthetic invalid Flight response\n",
          });
        });
      let verdict = "PASS",
        failureName;
      try {
        await visitReadOnlyPage(
          context,
          origin,
          "/?variant=conditional&role=anonymous",
          async (page) => {
            await page
              .getByTestId("resolved")
              .getByText("true", { exact: true })
              .waitFor();
            if (mode === "pageerror") {
              const event = page.waitForEvent("pageerror", { timeout: 2000 });
              await page.evaluate(() =>
                setTimeout(() => {
                  throw new Error("SyntheticUncaughtError");
                }, 0),
              );
              await event;
              return;
            }
            await page
              .getByRole("link", { name: "Detail", exact: true })
              .click();
            await page
              .getByText("Synthetic content only. ".repeat(2000), {
                exact: true,
              })
              .waitFor({ timeout: 5000 });
            await page.getByRole("link", { name: "Home", exact: true }).click();
            await page
              .getByRole("heading", { name: "Home", exact: true })
              .waitFor();
          },
          { mutationGate, attemptDiagnostics: diagnostics, log: () => {} },
        );
      } catch (error) {
        verdict = "FAIL";
        failureName = error.name;
      } finally {
        closing = true;
        await context.close();
      }
      cases.push({
        mode,
        identity: actualIdentity,
        verdict,
        failureName,
        errors,
        consoles,
        failures,
        faults,
        diagnostics,
      });
      assert.equal(verdict, mode === "normal-rsc" ? "PASS" : "FAIL");
      assert.equal(diagnostics.length, 1, "No retries to manufacture success");
      assert.equal(
        mutationGate.blockedUnexpectedWrites.length +
          mutationGate.blockedUnexpectedExternalWrites.length,
        0,
      );
      if (mode === "malformed-flight")
        assert(faults.some((x) => x.type === "malformed-flight"));
      if (mode === "pageerror") assert(errors.some((x) => !x.afterTeardown));
    }
  } finally {
    await browser.close();
    await writeFile(
      join(out, "gate-controls.json"),
      JSON.stringify(cases, null, 2),
    );
  }
  const requests = [],
    identities = [];
  const server = createServer((request, response) => {
    assert(["GET", "HEAD"].includes(request.method));
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    requests.push({ pathname, method: request.method });
    if (pathname === "/favicon.ico") {
      response.writeHead(200, { "content-type": "image/x-icon" }).end();
      return;
    }
    if (pathname === "/api/proxy-bookings") {
      response
        .writeHead(401, { "content-type": "application/json" })
        .end('{"error":"synthetic unauthenticated"}');
      return;
    }
    if (pathname === "/data") {
      response.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      response.write('{"ok":');
      setTimeout(() => response.end("true}"), 20);
      return;
    }
    const content =
      pathname === "/login"
        ? '<div data-testid="login-modal"><input aria-label="Synthetic login"></div>'
        : pathname === "/experiences/42"
          ? "<h1>Synthetic experience</h1>"
          : '<h1>Synthetic home</h1><a href="/experiences/42">Synthetic detail</a>';
    response
      .writeHead(200, { "content-type": "text/html" })
      .end(
        "<!doctype html><title>Synthetic Gate compatibility</title>" +
          content +
          '<script>fetch("/data").then(async r=>{const h=r.body.getReader();while(!(await h.read()).done){};h.releaseLock();document.documentElement.dataset.complete="true"}).catch(e=>console.error(e))</script>',
      );
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  let result;
  const previous = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  process.env.PLAYWRIGHT_EXECUTABLE_PATH = executable;
  try {
    assert.deepEqual(await verifyPinnedReleaseBrowser(executable), identity);
    result = await runProductionBrowserSmoke(
      "http://127.0.0.1:" + server.address().port,
      {
        log: () => {},
        observeContext: async (context) => {
          identities.push(await processIdentity(context));
        },
        collectReadOnlyPageEvidence: async (page) => {
          assert.equal(
            await page.locator("html").getAttribute("data-complete"),
            "true",
          );
        },
      },
    );
    assert.equal(result.status, "LOCALLY_PRODUCTION_BROWSER_SMOKE_PASS");
    assert(result.pageAttempts.every((x) => x.attempt === 1));
  } finally {
    if (previous === undefined) delete process.env.PLAYWRIGHT_EXECUTABLE_PATH;
    else process.env.PLAYWRIGHT_EXECUTABLE_PATH = previous;
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await writeFile(
      join(out, "unchanged-gate.json"),
      JSON.stringify(
        { result, identities, requests, productionRequests: 0 },
        null,
        2,
      ),
    );
  }
  return {
    syntheticProductionSmoke: "PASS",
    originalGateInvoked: true,
    processIdentity: identities,
    normalNextPageGate: "PASS",
    malformedFlight: "FAIL as expected",
    pageerror: "FAIL as expected",
    candidateGate: "NOT_RUN",
  };
}
