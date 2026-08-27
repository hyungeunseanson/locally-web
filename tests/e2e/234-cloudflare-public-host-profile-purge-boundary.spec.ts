import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "scripts/cloudflare/r2-public-host-profile-reconcile.py",
  "utf8",
);

test.describe("public host profile R2 purge boundary", () => {
  test("derives an exact canonical host namespace and never exposes broad deletion", () => {
    expect(source).toContain('prefix = f"hosts/{host_id}/"');
    expect(source).toContain("if not key.startswith(prefix)");
    expect(source).not.toContain("purge_everything");
    expect(source).not.toContain("delete_bucket");
    expect(source).not.toContain('Bucket=ACTIVE_BUCKET, Prefix="hosts/"');
  });

  test("deletes every object returned inside the exact host namespace regardless of filename", () => {
    expect(source).toContain(
      "active_keys = sorted(list_keys(active_client, ACTIVE_BUCKET, prefix=prefix))",
    );
    expect(source).toContain(
      "stale_keys = sorted(list_keys(stale_client, STALE_BUCKET, prefix=prefix))",
    );
    expect(source).not.toContain(
      "ACTIVE_KEY_PATTERN.fullmatch(key) for key in active_keys + stale_keys",
    );
  });

  test("privately preserves the exact namespace until cache purge succeeds", () => {
    expect(source).toContain('json.dumps({"files": urls[index:index + 100]})');
    expect(source).toContain(
      'active_urls = [f"{PUBLIC_BASE_URL}/{key}" for key in all_keys]',
    );
    expect(source).toContain(
      "archive_for_privacy_purge(active_client, stale_client, key)",
    );
    expect(source.indexOf("delete_batch(active_client")).toBeLessThan(
      source.indexOf("purge_cache_exact_urls(active_urls)"),
    );
    expect(source.indexOf("purge_cache_exact_urls(active_urls)")).toBeLessThan(
      source.indexOf("delete_batch(stale_client"),
    );
  });
});
