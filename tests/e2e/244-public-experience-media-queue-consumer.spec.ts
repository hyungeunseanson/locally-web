import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import {
  handlePublicExperienceMediaQueueBatch,
  PUBLIC_EXPERIENCE_MEDIA_PRODUCTION_QUEUE,
  type PublicExperienceMediaQueueMessageLike,
} from '../../app/utils/publicExperienceMediaQueueConsumer';
import {
  createPublicExperienceLatestRowLoader,
  createPublicExperienceMediaQueueDependencies,
  type PublicExperienceMediaQueueRuntimeEnv,
} from '../../app/utils/publicExperienceMediaQueueRuntime';
import {
  PUBLIC_EXPERIENCE_MEDIA_MESSAGE_SCHEMA,
  type PublicExperienceMediaMirrorOutcome,
} from '../../app/utils/publicExperienceMediaQueueMirror';

const wrangler = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const manifest = JSON.parse(
  readFileSync('config/cloudflare/migration-manifest.json', 'utf8')
);
const messageBody = {
  schema: PUBLIC_EXPERIENCE_MEDIA_MESSAGE_SCHEMA,
  version: 1,
  experienceId: '42',
  reason: 'edit',
  eventId: 'event_20260913_0001',
};

function environment(): PublicExperienceMediaQueueRuntimeEnv {
  return {
    CLOUDFLARE_DEPLOYMENT_ENV: 'production',
    NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    PUBLIC_EXPERIENCE_MEDIA_R2: {} as PublicExperienceMediaQueueRuntimeEnv['PUBLIC_EXPERIENCE_MEDIA_R2'],
    IMAGES: {} as PublicExperienceMediaQueueRuntimeEnv['IMAGES'],
  };
}

function queueMessage(body: unknown = messageBody) {
  const calls = { ack: 0, retry: 0 };
  const message: PublicExperienceMediaQueueMessageLike = {
    body,
    attempts: 2,
    ack: () => {
      calls.ack += 1;
    },
    retry: () => {
      calls.retry += 1;
    },
  };
  return { message, calls };
}

function outcome(status: PublicExperienceMediaMirrorOutcome['status']) {
  return {
    status,
    disposition:
      status === 'success' || status === 'already_exact' || status === 'ineligible_noop'
        ? 'ack'
        : status === 'permanent_conflict' || status === 'invalid_message'
          ? 'dead_letter'
          : 'retry',
    experienceId: '42',
    sourceCount: 1,
    derivativeCount: 5,
    originalCreatedCount: 1,
    originalExactSkipCount: 0,
    derivativeCreatedCount: 5,
    derivativeExactSkipCount: 0,
    diagnosticCode: `${status}_diagnostic`,
  } satisfies PublicExperienceMediaMirrorOutcome;
}

function inertDependencies() {
  return {
    loadLatestExperience: async () => null,
    fetchSource: async () => new Response(),
    store: {
      head: async () => null,
      getBytes: async () => null,
      createIfAbsent: async () => false,
    },
    transformer: {
      transform: async () => ({
        bytes: new Uint8Array([1]),
        contentType: 'image/webp',
      }),
    },
  };
}

test.describe('Production public experience media Queue consumer wiring', () => {
  for (const status of ['success', 'already_exact', 'ineligible_noop'] as const) {
    test(`${status} acknowledges exactly once`, async () => {
      const { message, calls } = queueMessage();
      await handlePublicExperienceMediaQueueBatch(
        { queue: PUBLIC_EXPERIENCE_MEDIA_PRODUCTION_QUEUE, messages: [message] },
        environment(),
        {
          createDependencies: inertDependencies,
          mirror: async () => outcome(status),
          log: () => undefined,
        }
      );
      expect(calls).toEqual({ ack: 1, retry: 0 });
    });
  }

  for (const status of [
    'source_drift',
    'transient_failure',
    'permanent_conflict',
    'invalid_message',
  ] as const) {
    test(`${status} retries for configured DLQ preservation`, async () => {
      const { message, calls } = queueMessage();
      await handlePublicExperienceMediaQueueBatch(
        { queue: PUBLIC_EXPERIENCE_MEDIA_PRODUCTION_QUEUE, messages: [message] },
        environment(),
        {
          createDependencies: inertDependencies,
          mirror: async () => outcome(status),
          log: () => undefined,
        }
      );
      expect(calls).toEqual({ ack: 0, retry: 1 });
    });
  }

  test('processes every message independently', async () => {
    const first = queueMessage();
    const second = queueMessage({ ...messageBody, eventId: 'event_20260913_0002' });
    let index = 0;
    await handlePublicExperienceMediaQueueBatch(
      {
        queue: PUBLIC_EXPERIENCE_MEDIA_PRODUCTION_QUEUE,
        messages: [first.message, second.message],
      },
      environment(),
      {
        createDependencies: inertDependencies,
        mirror: async () => outcome(index++ === 0 ? 'success' : 'source_drift'),
        log: () => undefined,
      }
    );
    expect(first.calls).toEqual({ ack: 1, retry: 0 });
    expect(second.calls).toEqual({ ack: 0, retry: 1 });
  });

  test('fails closed for any unexpected queue without disposition', async () => {
    const { message, calls } = queueMessage();
    let dependencyCalls = 0;
    await expect(
      handlePublicExperienceMediaQueueBatch(
        { queue: 'unexpected-queue', messages: [message] },
        environment(),
        {
          createDependencies: () => {
            dependencyCalls += 1;
            return inertDependencies();
          },
        }
      )
    ).rejects.toThrow(/unexpected_queue/);
    expect(dependencyCalls).toBe(0);
    expect(calls).toEqual({ ack: 0, retry: 0 });
  });

  test('fails closed outside the Production environment without disposition', async () => {
    const { message, calls } = queueMessage();
    await expect(
      handlePublicExperienceMediaQueueBatch(
        { queue: PUBLIC_EXPERIENCE_MEDIA_PRODUCTION_QUEUE, messages: [message] },
        { ...environment(), CLOUDFLARE_DEPLOYMENT_ENV: 'canary' }
      )
    ).rejects.toThrow(/non_production_environment/);
    expect(calls).toEqual({ ack: 0, retry: 0 });
  });

  test('logs only a bounded allowlist and never the raw body or source identifiers', async () => {
    const rawUrl =
      'https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/experiences/private-uuid/source.jpg';
    const { message } = queueMessage({ ...messageBody, sourceUrl: rawUrl });
    const logs: Array<Record<string, unknown>> = [];
    await handlePublicExperienceMediaQueueBatch(
      { queue: PUBLIC_EXPERIENCE_MEDIA_PRODUCTION_QUEUE, messages: [message] },
      environment(),
      {
        createDependencies: inertDependencies,
        mirror: async () => ({
          ...outcome('invalid_message'),
          diagnosticCode: rawUrl,
        }),
        log: (record) => logs.push(record),
      }
    );
    expect(logs).toHaveLength(1);
    expect(Object.keys(logs[0]).sort()).toEqual([
      'attempt',
      'derivativeCount',
      'derivativeCreatedCount',
      'derivativeExactSkipCount',
      'diagnosticCode',
      'event',
      'eventId',
      'experienceId',
      'originalCreatedCount',
      'originalExactSkipCount',
      'outcome',
      'reason',
      'sourceCount',
    ]);
    expect(JSON.stringify(logs)).not.toContain(rawUrl);
    expect(JSON.stringify(logs)).not.toContain('private-uuid');
  });

  test('loads only the latest required experience fields through anon/RLS GET', async () => {
    const requests: Array<{ url: URL; init?: RequestInit }> = [];
    const loader = createPublicExperienceLatestRowLoader(environment(), async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      return Response.json([
        {
          id: 42,
          status: 'active',
          is_active: true,
          photos: [],
          itinerary: [],
          image_url: null,
        },
      ]);
    });
    await expect(loader('42')).resolves.toMatchObject({ id: 42, status: 'active' });
    expect(requests).toHaveLength(1);
    expect(requests[0].url.pathname).toBe('/rest/v1/experiences');
    expect(requests[0].url.searchParams.get('select')).toBe(
      'id,status,is_active,photos,itinerary,image_url'
    );
    expect(requests[0].url.searchParams.get('id')).toBe('eq.42');
    expect(requests[0].init?.method).toBe('GET');
    expect(JSON.stringify(requests[0].init)).not.toContain('service_role');
  });

  test('runtime factory uses read-only source fetch plus the existing R2 and Images bindings', async () => {
    const requests: Array<{ input: string; init?: RequestInit }> = [];
    const runtime = environment();
    const dependencies = createPublicExperienceMediaQueueDependencies(
      runtime,
      async (input, init) => {
        requests.push({ input: String(input), init });
        return new Response(new Uint8Array([1]), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        });
      }
    );
    await dependencies.fetchSource(
      'https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/experiences/example.jpg'
    );
    expect(requests[0].init).toEqual({ method: 'GET', redirect: 'error' });
    expect(requests[0].init).not.toHaveProperty('body');
  });

  test('declares the exact default-OFF Production producer, consumer, DLQ, and public media R2 binding', () => {
    const production = wrangler.env.production;
    expect(production.queues).toEqual({
      producers: [
        {
          binding: 'PUBLIC_EXPERIENCE_MEDIA_QUEUE',
          queue: 'locally-public-experience-media-mirror-production',
        },
      ],
      consumers: [
        {
          queue: 'locally-public-experience-media-mirror-production',
          max_batch_size: 1,
          max_retries: 5,
          dead_letter_queue:
            'locally-public-experience-media-mirror-dlq-production',
          max_concurrency: 1,
          retry_delay: 60,
        },
      ],
    });
    expect(production.vars).toMatchObject({
      PUBLIC_EXPERIENCE_MEDIA_PRODUCER_ENABLED: 'false',
      PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS: '',
    });
    expect(production.r2_buckets).toContainEqual({
      binding: 'PUBLIC_EXPERIENCE_MEDIA_R2',
      bucket_name: 'locally-public-experience-canary',
    });
    expect(production.images).toEqual({ binding: 'IMAGES' });
    expect(wrangler.env.canary.queues).toBeUndefined();
    expect(wrangler.env.canary.r2_buckets).not.toContainEqual(
      expect.objectContaining({ binding: 'PUBLIC_EXPERIENCE_MEDIA_R2' })
    );
    expect(manifest.environments.production.publicExperienceMediaQueue).toBe(
      PUBLIC_EXPERIENCE_MEDIA_PRODUCTION_QUEUE
    );
  });

  test('wraps only fetch and queue while preserving the OpenNext DO exports', () => {
    const workerSource = readFileSync('cloudflare-worker.ts', 'utf8');
    expect(workerSource).toContain('openNextWorker.fetch(request, env, ctx)');
    expect(workerSource).toContain('handlePublicExperienceMediaQueueBatch(batch, env)');
    expect(workerSource).toContain('export { DOQueueHandler, DOShardedTagCache }');
    expect(workerSource).not.toContain('...openNextWorker');
  });

  test('keeps create-only R2 writes, exact Images specs, and no producer/send/copy/delete path', () => {
    const engineSource = readFileSync(
      'app/utils/publicExperienceMediaQueueMirror.ts',
      'utf8'
    );
    const runtimeSource = readFileSync(
      'app/utils/publicExperienceMediaQueueRuntime.ts',
      'utf8'
    );
    const consumerSource = readFileSync(
      'app/utils/publicExperienceMediaQueueConsumer.ts',
      'utf8'
    );
    expect(engineSource).toContain("onlyIf: { etagDoesNotMatch: '*' }");
    expect(engineSource).toContain('.transform({ width: input.width })');
    expect(engineSource).toContain(
      '.output({ format: input.format, quality: input.quality })'
    );
    expect(engineSource).not.toMatch(/\.(delete|copy|overwrite)\s*\(/i);
    expect(`${runtimeSource}\n${consumerSource}`).not.toMatch(/\.send\s*\(/);
    expect(`${runtimeSource}\n${consumerSource}`).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
