import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  buildExpectedManifests,
  buildSharpObjectPlanItem,
  buildSourceProvenance,
  buildSpecifications,
  SCHEDULED_SHARP_TRANSFORM_ENGINE,
  selectMissingSpecifications,
} from "./reconcile-public-experience-images.mjs";

const publicId = "11111111-1111-4111-8111-111111111111";
const originA =
  `https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/experience/${publicId}/hero/a.jpg`;
const originB =
  `https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/experience/${publicId}/hero/b.jpg`;
const originC =
  `https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/experience/${publicId}/itinerary/c.jpg`;

function fixture() {
  const inventory = [
    {
      id: "100",
      heroUrls: [originA, originB],
      detailUrls: [originA, originB, originC],
    },
  ];
  const expected = buildExpectedManifests(inventory, {});
  return {
    inventory,
    specifications: buildSpecifications(inventory, expected),
  };
}

test("selects only missing immutable variants and their required source images", () => {
  const { specifications } = fixture();
  const missingKeys = [
    specifications.find(
      (item) => item.originUrl === originA && item.width === 384,
    ).key,
    specifications.find(
      (item) => item.originUrl === originA && item.width === 960,
    ).key,
    ...specifications
      .filter((item) => item.originUrl === originC)
      .map((item) => item.key),
  ];

  const selected = selectMissingSpecifications(specifications, missingKeys);

  assert.equal(specifications.length, 11);
  assert.equal(selected.length, 5);
  assert.deepEqual(
    new Set(selected.map((item) => item.originUrl)),
    new Set([originA, originC]),
  );
  assert.deepEqual(selected.map((item) => item.key).sort(), missingKeys.sort());
});

test("returns no transform work when every expected R2 key already exists", () => {
  const { specifications } = fixture();
  assert.deepEqual(selectMissingSpecifications(specifications, []), []);
});

test("builds deterministic manifests from only the current public-active inventory", () => {
  const retainedCard = {
    originUrl: originA,
    smallKey: "cards/retained-small.webp",
    largeKey: "cards/retained-large.webp",
  };
  const expected = buildExpectedManifests(
    [
      { id: "100", heroUrls: [originA], detailUrls: [originA, originC] },
      { id: "200", heroUrls: [originB], detailUrls: [originB] },
    ],
    {
      100: retainedCard,
      999: {
        originUrl: originC,
        smallKey: "cards/stale-small.webp",
        largeKey: "cards/stale-large.webp",
      },
    },
  );

  assert.deepEqual(Object.keys(expected.cards), ["100", "200"]);
  assert.notDeepEqual(expected.cards["100"], retainedCard);
  assert.deepEqual(expected.cards["100"], {
    originUrl: originA,
    smallKey: `cards/experience-100-primary-${createHash('sha256').update(originA).digest('hex').slice(0, 12)}-w384-q65.webp`,
    largeKey: `cards/experience-100-primary-${createHash('sha256').update(originA).digest('hex').slice(0, 12)}-w640-q65.webp`,
  });
  assert.match(expected.cards["200"].smallKey, /^cards\/experience-200-primary-[a-f0-9]{12}-w384-q65\.webp$/);
  assert.deepEqual(Object.keys(expected.details), ["100", "200"]);
  assert.deepEqual(Object.keys(expected.details["100"]), [originA, originC]);
  assert.equal(expected.cards["999"], undefined);
  assert.equal(expected.details["999"], undefined);
});

test("preserves the explicit legacy card identity without trusting manifest keys", () => {
  const legacyOrigin = 'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/experience/0288da66-8322-447c-bf80-bff314ee7299/hero/1786530514581_1786530514581-xj0z0lli.png';
  const expected = buildExpectedManifests([{ id: '4523', heroUrls: [legacyOrigin], detailUrls: [legacyOrigin] }], {
    4523: { originUrl: legacyOrigin, smallKey: 'wrong-small.webp', largeKey: 'wrong-large.webp' },
  });
  assert.deepEqual(expected.cards['4523'], {
    originUrl: legacyOrigin,
    smallKey: 'experience-4523-primary-w384-q65.webp',
    largeKey: 'experience-4523-primary-w640-q65.webp',
  });
});

test("fails closed when the R2 missing plan contains an unknown or duplicate key", () => {
  const { specifications } = fixture();
  assert.throws(
    () => selectMissingSpecifications(specifications, ["unexpected.webp"]),
    /unexpected keys/,
  );
  assert.throws(
    () =>
      selectMissingSpecifications(specifications, [
        specifications[0].key,
        specifications[0].key,
      ]),
    /duplicate keys/,
  );
});

test("builds the plain normalized-key SHA and complete scheduled Sharp provenance", () => {
  const sourceBytes = Buffer.from("source-bytes");
  const outputBytes = Buffer.from("sharp-output");
  const source = buildSourceProvenance(originA, sourceBytes);
  const specification = fixture().specifications.find(
    (item) => item.originUrl === originA && item.width === 384,
  );
  const generatedAt = "2026-09-13T00:00:00.000Z";
  const item = buildSharpObjectPlanItem(
    specification,
    "objects/card.webp",
    outputBytes,
    source,
    generatedAt,
  );

  assert.equal(
    source.sourceKeySha256,
    "b4d9779fb378ec0858b7de41174f44893177758450d71a13efa1311ebe4026cc",
  );
  assert.deepEqual(item, {
    key: specification.key,
    path: "objects/card.webp",
    bytes: outputBytes.length,
    sha256: createHash("sha256").update(outputBytes).digest("hex"),
    contentType: "image/webp",
    sourceKeySha256: source.sourceKeySha256,
    sourceByteSha256: createHash("sha256").update(sourceBytes).digest("hex"),
    sourceSize: sourceBytes.length,
    derivativeRole: "card",
    width: 384,
    quality: 65,
    format: "webp",
    transformSchemaVersion: "1",
    transformEngine: "sharp-libvips",
    provenanceStatus: "verified",
    generatedAt,
  });
  assert.equal(SCHEDULED_SHARP_TRANSFORM_ENGINE, "sharp-libvips");
  assert.doesNotMatch(JSON.stringify(item), /supabase\.co|experience\/[0-9a-f-]{36}/i);
});

test("fails closed when provenance source normalization differs from the runtime contract", () => {
  for (const sourceUrl of [
    `${originA}?changed=1`,
    originA.replace("/experiences/", "/avatars/"),
    originA.replace("uhinvcydgzqlpnvieyal.supabase.co", "example.com"),
    originA.replace(publicId, "not-a-uuid"),
  ]) {
    assert.throws(
      () => buildSourceProvenance(sourceUrl, Buffer.from("source")),
      /Refusing/,
    );
  }
});
