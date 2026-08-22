import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExpectedManifests,
  buildSpecifications,
  selectMissingSpecifications,
} from "./reconcile-public-experience-images.mjs";

const originA =
  "https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/experience/public-id/hero/a.jpg";
const originB =
  "https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/experience/public-id/hero/b.jpg";
const originC =
  "https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/experience/public-id/itinerary/c.jpg";

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
