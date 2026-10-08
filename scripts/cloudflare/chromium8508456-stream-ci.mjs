import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { chromium } from "@playwright/test";
import { installReaderObserver } from "./chromium8508456-reader-observer.mjs";
const origin = process.env.REPRO_ORIGIN || "http://127.0.0.1:3000",
  out = process.env.REPRO_OUTPUT || "evidence";
assert(["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
const browserLabel = process.env.REPRO_BROWSER_LABEL || "bundled";
const nextVersion = process.env.REPRO_NEXT_VERSION || "16.3.5",
  matrix = process.env.REPRO_MATRIX === "1";
await mkdir(out, { recursive: true });
const digest = (x) => createHash("sha256").update(x).digest("hex");
const safe = (url) => {
  const u = new URL(url);
  return {
    pathname: u.pathname,
    queryKeys: [...u.searchParams.keys()].sort(),
    queryDigest: u.search ? digest(u.search) : null,
  };
};
assert(
  process.env.REPRO_BROWSER_EXECUTABLE,
  "Verified executable required; no bundled fallback",
);
const { profile, verifyPinnedReleaseBrowser } =
  await import("./verify-pinned-release-browser.mjs");
await verifyPinnedReleaseBrowser(process.env.REPRO_BROWSER_EXECUTABLE);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.REPRO_BROWSER_EXECUTABLE,
});
const probeContext = await browser.newContext(),
  probePage = await probeContext.newPage(),
  probeCDP = await probeContext.newCDPSession(probePage);
const browserIdentity = await probeCDP.send("Browser.getVersion");
assert.equal(browserIdentity.product, "Chrome/" + profile.browserVersion);
assert.equal(browserIdentity.revision, profile.browserRevision);
const { nativeProcessArchitecture } =
  await import("./chromium8508456-gate-ci.mjs");
const processArchitecture = await nativeProcessArchitecture(browser);
await probeContext.close();
const cases = [];
async function fixture(name, observer = false) {
  const start = performance.now(),
    ms = () => Math.round(performance.now() - start),
    events = [],
    requests = [],
    cdpRows = new Map(),
    bodies = [];
  const context = await browser.newContext({ serviceWorkers: "block" });
  if (observer) await context.addInitScript(installReaderObserver);
  const page = await context.newPage(),
    cdp = await context.newCDPSession(page);
  let closing = false;
  const add = (event, x = {}) => events.push({ ms: ms(), event, ...x }),
    byReq = new WeakMap();
  await cdp.send("Network.enable");
  await cdp.send("Page.enable");
  await cdp.send("Page.setLifecycleEventsEnabled", { enabled: true });
  cdp.on("Network.requestWillBeSent", (e) => {
    const row = {
      requestId: e.requestId,
      frameId: e.frameId,
      loaderId: e.loaderId,
      method: e.request.method,
      type: e.type,
      ...safe(e.request.url),
      timestamp: e.timestamp,
      wallTime: e.wallTime,
      startMs: ms(),
      chunks: [],
      initiatorType: e.initiator.type,
    };
    cdpRows.set(e.requestId, row);
    add("cdp-request", row);
  });
  cdp.on("Network.responseReceived", (e) => {
    const row = cdpRows.get(e.requestId);
    if (row)
      Object.assign(row, {
        status: e.response.status,
        protocol: e.response.protocol,
        cacheControl:
          e.response.headers["Cache-Control"] ||
          e.response.headers["cache-control"],
        contentType: e.response.mimeType,
        contentEncoding:
          e.response.headers["Content-Encoding"] ||
          e.response.headers["content-encoding"] ||
          null,
        contentLength:
          e.response.headers["Content-Length"] ||
          e.response.headers["content-length"] ||
          null,
        responseTimestamp: e.timestamp,
        responseMs: ms(),
      });
    add("cdp-response", {
      requestId: e.requestId,
      status: e.response.status,
      timestamp: e.timestamp,
    });
  });
  cdp.on("Network.dataReceived", (e) => {
    cdpRows
      .get(e.requestId)
      ?.chunks.push({
        timestamp: e.timestamp,
        ms: ms(),
        decoded: e.dataLength,
        encoded: e.encodedDataLength,
      });
  });
  cdp.on("Network.loadingFinished", (e) => {
    const row = cdpRows.get(e.requestId);
    if (row)
      row.terminal = {
        event: "loadingFinished",
        timestamp: e.timestamp,
        ms: ms(),
        encodedBytes: e.encodedDataLength,
        afterExplicitTeardown: closing,
      };
    add("cdp-finished", { requestId: e.requestId, timestamp: e.timestamp });
  });
  cdp.on("Network.loadingFailed", (e) => {
    const row = cdpRows.get(e.requestId);
    if (row)
      row.terminal = {
        event: "loadingFailed",
        timestamp: e.timestamp,
        ms: ms(),
        error: e.errorText,
        canceled: e.canceled,
        afterExplicitTeardown: closing,
      };
    add("cdp-failed", {
      requestId: e.requestId,
      error: e.errorText,
      canceled: e.canceled,
      timestamp: e.timestamp,
      afterExplicitTeardown: closing,
    });
  });
  page.on("request", (q) => {
    assert.equal(new URL(q.url()).origin, origin, "No external app request");
    assert(["GET", "HEAD"].includes(q.method()), "No writes");
    const h = q.headers(),
      row = {
        id: "q" + requests.length,
        startMs: ms(),
        method: q.method(),
        type: q.resourceType(),
        ...safe(q.url()),
        rsc: h.rsc === "1",
        prefetch: h["next-router-prefetch"] === "1",
      };
    byReq.set(q, row);
    requests.push(row);
  });
  page.on("response", (r) => {
    const row = byReq.get(r.request());
    if (!row) return;
    row.status = r.status();
    row.responseMs = ms();
    const h = r.headers();
    row.cacheControl = h["cache-control"];
    row.contentType = h["content-type"];
    row.contentEncoding = h["content-encoding"] || null;
    row.contentLength = h["content-length"] || null;
    if (row.rsc)
      bodies.push(
        r.body().then(
          (b) => {
            row.hostBodyComplete = true;
            row.hostBodyBytes = b.length;
          },
          (e) => {
            row.hostBodyComplete = false;
            row.hostBodyError = e.name;
          },
        ),
      );
  });
  page.on("requestfinished", (q) => {
    const row = byReq.get(q);
    if (row)
      row.terminal = {
        event: "requestfinished",
        ms: ms(),
        afterExplicitTeardown: closing,
      };
  });
  page.on("requestfailed", (q) => {
    const row = byReq.get(q);
    if (row)
      row.terminal = {
        event: "requestfailed",
        error: q.failure()?.errorText,
        ms: ms(),
        afterExplicitTeardown: closing,
      };
  });
  page.on("pageerror", (e) =>
    add("pageerror", { name: e.name, messageDigest: digest(e.message) }),
  );
  page.on("console", (m) => {
    if (m.type() === "error") add("consoleerror", { digest: digest(m.text()) });
  });
  page.on("framenavigated", (f) => add("frame-navigated", safe(f.url())));
  page.on("close", () => add("page-close", { afterExplicitTeardown: closing }));
  const row = {
    name,
    nextVersion,
    events,
    requests,
    cdp: [],
    browser: browser.version(),
    interception: 0,
    forwarder: 0,
  };
  cases.push(row);
  return {
    context,
    page,
    cdp,
    row,
    add,
    bodies,
    cdpRows,
    async close() {
      closing = true;
      add("explicit-context-close");
      row.cdp = [...cdpRows.values()];
      await context.close();
    },
  };
}
async function control(spec) {
  const f = await fixture(spec.name);
  try {
    await f.page.goto(origin + "/control", { waitUntil: "networkidle" });
    f.add("browser-consumer-start");
    f.row.spec = spec;
    const url =
      "/api/probe?cache=" +
      spec.cache +
      "&writes=" +
      spec.writes +
      "&fault=" +
      spec.fault;
    f.row.consumer = await f.page.evaluate(
      async ({ url, reader, fault }) => {
        const metrics = {
          eof: false,
          chunks: [],
          bytes: 0,
          parseOk: false,
          status: null,
          error: null,
          abortRequested: false,
        };
        const controller = new AbortController();
        try {
          const r = await fetch(url, { signal: controller.signal });
          metrics.status = r.status;
          if (reader === "json") {
            const result = await r.json();
            metrics.parseOk = result.ok === true;
            metrics.nativeJsonComplete = true;
            metrics.eof = null;
            metrics.bytes = null;
          } else {
            const handle = r.body.getReader(),
              chunks = [];
            try {
              while (true) {
                const { done, value } = await handle.read();
                if (done) {
                  metrics.eof = true;
                  metrics.eofAt = performance.now();
                  break;
                }
                metrics.chunks.push(value.byteLength);
                metrics.bytes += value.byteLength;
                if (metrics.bytes > 256) throw Error("SyntheticByteLimit");
                chunks.push(value);
                if (fault === "abort" && !metrics.abortRequested) {
                  metrics.abortRequested = true;
                  controller.abort();
                }
              }
            } finally {
              handle.releaseLock();
            }
            const joined = new Uint8Array(metrics.bytes);
            let offset = 0;
            for (const c of chunks) {
              joined.set(c, offset);
              offset += c.length;
            }
            const hash = await crypto.subtle.digest("SHA-256", joined);
            metrics.bodySHA256 = [...new Uint8Array(hash)]
              .map((x) => x.toString(16).padStart(2, "0"))
              .join("");
            metrics.parseOk =
              JSON.parse(
                new TextDecoder("utf-8", { fatal: true }).decode(joined),
              ).ok === true;
          }
        } catch (e) {
          metrics.error = e.name;
        }
        metrics.settledAt = performance.now();
        return metrics;
      },
      { url, reader: spec.reader, fault: spec.fault },
    );
    await f.page.waitForFunction(() => true); // round trip after the consumer; does not override a terminal.
    const target = () =>
      f.row.requests.find((r) => r.pathname === "/api/probe");
    for (let i = 0; i < 20 && !target()?.terminal; i++)
      await new Promise((r) => setTimeout(r, 25));
    f.row.dataRequest = target();
    assert(f.row.dataRequest?.terminal, "Original request terminal missing");
    const native = [...f.cdpRows.values()].find(
      (r) => r.pathname === "/api/probe",
    );
    assert(native?.terminal, "CDP terminal required");
    f.row.dataCDP = native;
    if (native.terminal.event === "loadingFinished") {
      const result = await f.cdp.send("Network.getResponseBody", {
        requestId: native.requestId,
      });
      const bytes = Buffer.from(
        result.body,
        result.base64Encoded ? "base64" : "utf8",
      );
      f.row.nativeBody = { bytes: bytes.length, sha256: digest(bytes) };
    }
    const expectedSHA =
      "4062edaf750fb8074e7e83e0c9028c94e32468a8b6f1614774328ef045150f93";
    f.row.applicationDataComplete =
      f.row.consumer.status === 200 &&
      f.row.consumer.parseOk &&
      (f.row.consumer.eof === true ||
        f.row.consumer.nativeJsonComplete === true) &&
      (f.row.consumer.bytes === 11 ||
        f.row.consumer.nativeJsonComplete === true);
    f.row.strictVerdict =
      f.row.applicationDataComplete &&
      f.row.dataRequest.terminal.event === "requestfinished" &&
      native.terminal.event === "loadingFinished" &&
      f.row.nativeBody?.bytes === 11 &&
      f.row.nativeBody?.sha256 === expectedSHA
        ? "PASS"
        : "FAIL";
    f.row.discrepancy =
      f.row.applicationDataComplete &&
      f.row.dataRequest.terminal.error === "net::ERR_ABORTED";
    assert.equal(
      f.row.strictVerdict,
      spec.fault === "none" ? "PASS" : "FAIL",
      "Unexpected control verdict",
    );
    if (spec.fault === "none") {
      assert.equal(
        f.row.events.filter(
          (e) => e.event === "pageerror" || e.event === "consoleerror",
        ).length,
        0,
      );
      assert.equal(
        f.row.requests.filter((r) => r.terminal?.event === "requestfailed")
          .length,
        0,
      );
      if (spec.reader === "stream")
        assert.equal(f.row.consumer.bodySHA256, expectedSHA);
    }
  } catch (e) {
    f.row.infrastructureError = e.name;
    throw e;
  } finally {
    await f.close();
    console.log(
      JSON.stringify({
        name: spec.name,
        strict: f.row.strictVerdict,
        eof: f.row.consumer?.eof,
        parse: f.row.consumer?.parseOk,
        terminal: f.row.dataRequest?.terminal,
        discrepancy: f.row.discrepancy,
      }),
    );
  }
}
try {
  if (matrix)
    for (const spec of [
      {
        name: "A-no-store-stream",
        cache: "no-store",
        reader: "stream",
        writes: 2,
        fault: "none",
      },
      {
        name: "B-no-cache-stream",
        cache: "no-cache",
        reader: "stream",
        writes: 2,
        fault: "none",
      },
      {
        name: "C-no-store-native-json",
        cache: "no-store",
        reader: "json",
        writes: 2,
        fault: "none",
      },
      {
        name: "D-no-store-single-write",
        cache: "no-store",
        reader: "stream",
        writes: 1,
        fault: "none",
      },
      {
        name: "E-no-store-multi-write",
        cache: "no-store",
        reader: "stream",
        writes: 3,
        fault: "none",
      },
      ...[
        "abort",
        "truncated",
        "length-mismatch",
        "http-503",
        "reader-error",
      ].map((fault) => ({
        name: "negative-" + fault,
        cache: "no-store",
        reader: "stream",
        writes: 2,
        fault,
      })),
    ])
      await control(spec);
  const f = await fixture("rsc-click-navigation", true);
  try {
    const query = "?variant=conditional&role=anonymous";
    await f.page.goto(origin + "/" + query, { waitUntil: "networkidle" });
    await f.page
      .getByTestId("resolved")
      .getByText("true", { exact: true })
      .waitFor();
    f.add("user-detail-click");
    await f.page.getByRole("link", { name: "Detail", exact: true }).click();
    await f.page
      .getByRole("heading", { name: "Detail", exact: true })
      .waitFor();
    await f.page
      .getByText("Synthetic content only. ".repeat(2000), { exact: true })
      .waitFor();
    await Promise.all(f.bodies);
    f.add("detail-full-content-rendered");
    f.row.detailUIComplete = true;
    f.row.readerFactsAtDetail = await f.page
      .evaluate(() => window.__rscReaderFacts)
      .then((facts) =>
        facts.map((x) => ({ ...x, ...safe(x.url), url: undefined })),
      );
    f.add("user-home-click");
    await f.page.getByRole("link", { name: "Home", exact: true }).click();
    await f.page.getByRole("heading", { name: "Home", exact: true }).waitFor();
    await Promise.all(f.bodies);
    f.row.homeUIComplete = true;
    f.row.readerFacts = await f.page
      .evaluate(() => window.__rscReaderFacts)
      .then((facts) =>
        facts.map((x) => ({ ...x, ...safe(x.url), url: undefined })),
      );
    f.row.strictVerdict =
      f.row.requests.some(
        (r) =>
          r.terminal?.event === "requestfailed" &&
          !r.terminal.afterExplicitTeardown,
      ) ||
      f.row.events.some((e) => ["consoleerror", "pageerror"].includes(e.event))
        ? "FAIL"
        : "PASS";
  } catch (e) {
    f.row.strictVerdict = "FAIL";
    f.row.errorName = e.name;
  } finally {
    await f.close();
    console.log(
      JSON.stringify({
        name: f.row.name,
        next: nextVersion,
        strict: f.row.strictVerdict,
        detailUI: f.row.detailUIComplete,
        homeUI: f.row.homeUIComplete,
        readers: f.row.readerFacts
          ?.filter((x) => x.rsc && !x.prefetch)
          .map((x) => ({ id: x.id, path: x.pathname, channels: x.channels })),
      }),
    );
  }
  assert.equal(f.row.strictVerdict, "PASS", "RSC strict verdict");
  for (const path of ["/detail/example", "/"]) {
    const readers = f.row.readerFacts.filter(
      (x) => x.rsc && !x.prefetch && x.pathname === path,
    );
    assert(readers.length > 0, "Original navigation reader required");
    const req = f.row.requests.find(
      (x) => x.rsc && !x.prefetch && x.pathname === path,
    );
    const native = f.row.cdp.find(
      (x) => x.pathname === path && x.type === "Fetch",
    );
    assert(req?.hostBodyComplete);
    assert.equal(req.terminal?.event, "requestfinished");
    assert.equal(native?.terminal?.event, "loadingFinished");
    const original = readers
      .flatMap((x) => x.channels)
      .find((c) => c.path === "original-body");
    assert(original?.eof);
    assert.equal(original.error, null);
    assert.equal(original.cancelCalled, false);
    assert.equal(original.bytes, req.hostBodyBytes);
    assert.equal(
      original.bytes,
      native.chunks.reduce((n, c) => n + c.decoded, 0),
    );
  }
  if (matrix) {
    const f = await fixture("negative-navigation");
    try {
      await f.page.goto(origin + "/control", { waitUntil: "networkidle" });
      await f.page.evaluate(() => {
        const a = document.createElement("a");
        a.href = "/broken";
        a.textContent = "Broken navigation";
        document.body.append(a);
      });
      f.add("user-broken-navigation-click");
      await f.page
        .getByRole("link", { name: "Broken navigation", exact: true })
        .click();
      await f.page.waitForURL((x) => x.pathname === "/broken");
      await f.page
        .getByRole("heading", { name: "Synthetic navigation failure" })
        .waitFor();
      f.row.navigationSuccess = false;
      f.row.strictVerdict = f.row.requests.some(
        (r) => r.pathname === "/broken" && r.status === 503,
      )
        ? "FAIL"
        : "NOT_ESTABLISHED";
      assert.equal(f.row.strictVerdict, "FAIL");
    } finally {
      await f.close();
      console.log(
        JSON.stringify({ name: f.row.name, strict: f.row.strictVerdict }),
      );
    }
  }
} finally {
  await browser.close();
  await writeFile(
    out + "/targeted-" + browserLabel + "-" + nextVersion + ".json",
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        browserLabel,
        executablePath: process.env.REPRO_BROWSER_EXECUTABLE,
        nextVersion,
        react: "19.2.3",
        playwright: "1.59.1",
        processArchitecture,
        browserIdentity: {
          protocolVersion: browserIdentity.protocolVersion,
          product: browserIdentity.product,
          revision: browserIdentity.revision,
          jsVersion: browserIdentity.jsVersion,
        },
        cases,
        productionCalls: 0,
        interceptedRequests: 0,
        gateChanges: 0,
        retries: 0,
        qualification:
          "Synthetic fixed diagnosis. EOF observer forwards native operations without extra reads/tee/clone/cancel. Promise instrumentation may affect microtask timing; historical causal attribution is not claimed.",
      },
      null,
      2,
    ),
  );
}
