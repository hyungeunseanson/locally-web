import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  buildNotificationRetentionCutoff,
  isNotificationRetentionEligible,
} from '../../app/utils/notificationRetentionCleanup.ts';

const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

function requiredEnvironment(name) {
  const value = process.env[name];
  assert(value, `Missing required environment value: ${name}`);
  return value;
}

function parseExactCount(response) {
  const contentRange = response.headers.get('content-range');
  const match = contentRange?.match(/\/(\d+)$/);
  assert(match, 'Supabase did not return an exact count.');
  return Number(match[1]);
}

async function fetchJson(response, diagnosticCode) {
  if (!response.ok) throw new Error(`${diagnosticCode}_${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${diagnosticCode}_invalid_json`);
  }
}

export function summarizeNotificationRetentionPreflight(rows, cutoff, totalCount) {
  const eligible = [];
  let protectedOldUnreadDemographicsCount = 0;
  for (const row of rows) {
    if (isNotificationRetentionEligible(row, cutoff)) {
      eligible.push(row);
    } else if (
      Date.parse(row.created_at) < Date.parse(cutoff) &&
      row.type === 'profile_demographics_required' &&
      row.is_read === false
    ) {
      protectedOldUnreadDemographicsCount += 1;
    }
  }
  const typeCounts = {};
  let readCount = 0;
  for (const row of eligible) {
    typeCounts[row.type] = (typeCounts[row.type] ?? 0) + 1;
    if (row.is_read) readCount += 1;
  }
  const candidateDigest = createHash('sha256')
    .update(eligible.map((row) => String(row.id)).sort().join('\n'))
    .digest('hex');
  return {
    totalCount,
    eligibleCount: eligible.length,
    protectedOldUnreadDemographicsCount,
    eligibleTypeCounts: Object.fromEntries(Object.entries(typeCounts).sort()),
    eligibleReadCount: readCount,
    eligibleUnreadCount: eligible.length - readCount,
    oldestEligibleAt: eligible.at(0)?.created_at ?? null,
    newestEligibleAt: eligible.at(-1)?.created_at ?? null,
    candidateDigest,
  };
}

export async function reportNotificationRetentionPreflight({
  now = new Date(),
  fetchImplementation = fetch,
} = {}) {
  const origin = new URL(requiredEnvironment('NEXT_PUBLIC_SUPABASE_URL'));
  assert.equal(origin.protocol, 'https:', 'Production preflight requires HTTPS Supabase origin.');
  assert(/^[a-z0-9]{20}\.supabase\.co$/.test(origin.hostname), 'Unexpected Supabase origin.');
  const serviceRole = requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY');
  const headers = {
    apikey: serviceRole,
    authorization: `Bearer ${serviceRole}`,
    accept: 'application/json',
    prefer: 'count=exact',
  };
  const cutoff = buildNotificationRetentionCutoff(now);

  const totalUrl = new URL('/rest/v1/notifications', origin);
  totalUrl.searchParams.set('select', 'id');
  totalUrl.searchParams.set('limit', '1');
  const totalResponse = await fetchImplementation(totalUrl, { headers, redirect: 'manual' });
  if (!totalResponse.ok) throw new Error(`total_count_failed_${totalResponse.status}`);
  const totalCount = parseExactCount(totalResponse);

  const rows = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const pageUrl = new URL('/rest/v1/notifications', origin);
    pageUrl.searchParams.set('select', 'id,type,is_read,created_at');
    pageUrl.searchParams.set('created_at', `lt.${cutoff}`);
    pageUrl.searchParams.set('order', 'created_at.asc,id.asc');
    const response = await fetchImplementation(pageUrl, {
      headers: {
        ...headers,
        range: `${page * PAGE_SIZE}-${(page + 1) * PAGE_SIZE - 1}`,
      },
      redirect: 'manual',
    });
    const pageRows = await fetchJson(response, 'old_rows_failed');
    assert(Array.isArray(pageRows), 'Supabase returned an invalid notification list.');
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
    assert(page + 1 < MAX_PAGES, 'Notification preflight pagination limit reached.');
  }

  const summary = summarizeNotificationRetentionPreflight(rows, cutoff, totalCount);
  return {
    observedAt: now.toISOString(),
    cutoff,
    ...summary,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  console.log(JSON.stringify(await reportNotificationRetentionPreflight(), null, 2));
}
