import { unstable_cache, revalidateTag } from 'next/cache';

import {
  CLOUDFLARE_FUNCTIONAL_CANARY_CACHE_TAG,
  canaryJson,
  hiddenCanaryResponse,
  isCloudflareFunctionalCanaryRequest,
} from '@/app/utils/cloudflareFunctionalCanary';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ISOLATE_ID = crypto.randomUUID();
const CACHE_REVALIDATE_SECONDS = 60;
const REGENERATION_DELAY_MS = 1_500;

const readCachedSnapshot = unstable_cache(
  async (slot: string) => {
    await new Promise((resolve) => setTimeout(resolve, REGENERATION_DELAY_MS));
    return {
      slot,
      generationId: crypto.randomUUID(),
      generatedAt: Date.now(),
    };
  },
  ['cloudflare-functional-canary-cache'],
  {
    revalidate: CACHE_REVALIDATE_SECONDS,
    tags: [CLOUDFLARE_FUNCTIONAL_CANARY_CACHE_TAG],
  }
);

function normalizeSlot(request: Request) {
  const slot = new URL(request.url).searchParams.get('slot')?.trim() || '';
  return /^[A-Za-z0-9_-]{1,80}$/.test(slot) ? slot : null;
}

export async function GET(request: Request) {
  if (!(await isCloudflareFunctionalCanaryRequest(request))) {
    return hiddenCanaryResponse();
  }

  const slot = normalizeSlot(request);
  if (!slot) {
    return canaryJson({ error: 'Invalid slot' }, { status: 400 });
  }

  const startedAt = Date.now();
  const snapshot = await readCachedSnapshot(slot);
  return canaryJson({
    ...snapshot,
    isolateId: ISOLATE_ID,
    servedAt: Date.now(),
    durationMs: Date.now() - startedAt,
    cacheContract: {
      revalidateSeconds: CACHE_REVALIDATE_SECONDS,
      regenerationDelayMs: REGENERATION_DELAY_MS,
      tag: CLOUDFLARE_FUNCTIONAL_CANARY_CACHE_TAG,
    },
  });
}

export async function POST(request: Request) {
  if (!(await isCloudflareFunctionalCanaryRequest(request))) {
    return hiddenCanaryResponse();
  }

  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  if (body?.action !== 'revalidate-tag') {
    return canaryJson({ error: 'Invalid action' }, { status: 400 });
  }

  revalidateTag(CLOUDFLARE_FUNCTIONAL_CANARY_CACHE_TAG, 'max');
  return canaryJson({
    accepted: true,
    tag: CLOUDFLARE_FUNCTIONAL_CANARY_CACHE_TAG,
    profile: 'max',
  });
}
