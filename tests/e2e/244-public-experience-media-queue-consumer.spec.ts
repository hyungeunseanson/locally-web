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
  PUBLIC_EXPERIENCE_MEDIA_CACHE_CONTROL,
  PUBLIC_EXPERIENCE_MEDIA_MESSAGE_SCHEMA,
  type MirrorObjectMetadata,
  type PublicExperienceMediaMirrorDependencies,
  type PublicExperienceMediaMirrorOutcome,
} from '../../app/utils/publicExperienceMediaQueueMirror';

const SOURCE_URL =
  'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/experience/11111111-1111-4111-8111-111111111111/hero/source.jpg';
const SOURCE_BYTES = new TextEncoder().encode('integration-source');

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

type StoredObject = MirrorObjectMetadata & { bytes: Uint8Array };

function actualConsumerHarness(options: {
  latestRowResponses: Array<Response | Error>;
  sourceResponse?: Response;
}) {
  const objects = new Map<string, StoredObject>();
  const calls = { latestRow: 0, source: 0, store: 0, transform: 0 };
  const latestRowLoader = createPublicExperienceLatestRowLoader(
    environment(),
    async (_input, init) => {
      expect(init?.redirect).toBe('manual');
      const response =
        options.latestRowResponses[
          Math.min(calls.latestRow++, options.latestRowResponses.length - 1)
        ];
      if (response instanceof Error) throw response;
      return response;
    }
  );
  const dependencies: PublicExperienceMediaMirrorDependencies = {
    loadLatestExperience: latestRowLoader,
    async fetchSource() {
      calls.source += 1;
      return (
        options.sourceResponse ||
        new Response(SOURCE_BYTES, {
          status: 200,
          headers: {
            'content-type': 'image/jpeg',
            'content-length': String(SOURCE_BYTES.byteLength),
          },
        })
      );
    },
    store: {
      async head(key) {
        const object = objects.get(key);
        return object
          ? {
              size: object.size,
              httpMetadata: { ...object.httpMetadata },
              customMetadata: { ...object.customMetadata },
            }
          : null;
      },
      async getBytes(key) {
        return objects.get(key)?.bytes.slice() || null;
      },
      async createIfAbsent(input) {
        calls.store += 1;
        if (objects.has(input.key)) return false;
        objects.set(input.key, {
          bytes: input.body.slice(),
          size: input.body.byteLength,
          httpMetadata: {
            contentType: input.contentType,
            cacheControl: input.cacheControl,
          },
          customMetadata: { ...input.customMetadata },
        });
        return true;
      },
    },
    transformer: {
      async transform(input) {
        calls.transform += 1;
        return {
          bytes: new TextEncoder().encode(
            `webp:${input.width}:${input.quality}`
          ),
          contentType: 'image/webp',
        };
      },
    },
    now: () => new Date('2026-09-14T00:00:00.000Z'),
  };
  return { calls, dependencies, objects };
}

function latestRowResponse(
  overrides: Record<string, unknown> = {},
  init: ResponseInit = {}
) {
  return Response.json(
    [
      {
        id: 42,
        status: 'active',
        is_active: true,
        photos: [SOURCE_URL],
        itinerary: [],
        image_url: null,
        ...overrides,
      },
    ],
    init
  );
}

async function runActualConsumer(
  harness: ReturnType<typeof actualConsumerHarness>
) {
  const queued = queueMessage();
  const logs: Array<Record<string, unknown>> = [];
  await handlePublicExperienceMediaQueueBatch(
    {
      queue: PUBLIC_EXPERIENCE_MEDIA_PRODUCTION_QUEUE,
      messages: [queued.message],
    },
    environment(),
    {
      createDependencies: () => harness.dependencies,
      log: (record) => logs.push(record),
    }
  );
  return { ...queued, log: logs[0] };
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
      'diagnosticStage',
      'event',
      'eventId',
      'experienceId',
      'httpStatus',
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
    expect(requests[0].init?.redirect).toBe('manual');
    expect(JSON.stringify(requests[0].init)).not.toContain('service_role');
  });

  test('actual loader, engine, and consumer reach fake storage and transforms for a public row', async () => {
    const harness = actualConsumerHarness({
      latestRowResponses: [latestRowResponse(), latestRowResponse()],
    });
    const result = await runActualConsumer(harness);

    expect(result.calls).toEqual({ ack: 1, retry: 0 });
    expect(harness.calls).toEqual({
      latestRow: 2,
      source: 1,
      store: 6,
      transform: 5,
    });
    expect(result.log).toMatchObject({
      outcome: 'success',
      sourceCount: 1,
      derivativeCount: 5,
      originalCreatedCount: 1,
      derivativeCreatedCount: 5,
    });
    expect(
      [...harness.objects.values()].every(
        (object) =>
          object.httpMetadata.cacheControl ===
          PUBLIC_EXPERIENCE_MEDIA_CACHE_CONTROL
      )
    ).toBe(true);
  });

  test('actual initial row loader classifies HTTP failures without touching source, R2, or Images', async () => {
    const cases = [
      [401, 'permanent_conflict', 'latest_row_http_unauthorized'],
      [403, 'permanent_conflict', 'latest_row_http_unauthorized'],
      [400, 'permanent_conflict', 'latest_row_http_client_error'],
      [429, 'transient_failure', 'latest_row_http_rate_limited'],
      [503, 'transient_failure', 'latest_row_http_server_error'],
    ] as const;

    for (const [status, outcomeStatus, diagnosticCode] of cases) {
      const harness = actualConsumerHarness({
        latestRowResponses: [new Response('', { status })],
      });
      const result = await runActualConsumer(harness);
      expect(result.calls).toEqual({ ack: 0, retry: 1 });
      expect(result.log).toMatchObject({
        outcome: outcomeStatus,
        diagnosticCode,
        diagnosticStage: 'initial_row_load',
        httpStatus: status,
        sourceCount: 0,
        derivativeCount: 0,
      });
      expect(harness.calls).toEqual({
        latestRow: 1,
        source: 0,
        store: 0,
        transform: 0,
      });
    }
  });

  test('actual loader distinguishes redirect, content type, JSON parse, shape, and transport failures', async () => {
    const sensitive = `${SOURCE_URL}?token=must-not-leak`;
    const cases: Array<{
      response: Response | Error;
      code: string;
      status?: number;
    }> = [
      {
        response: new Response('', { status: 302, headers: { location: sensitive } }),
        code: 'latest_row_http_redirect',
        status: 302,
      },
      {
        response: new Response('<html>private</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
        code: 'latest_row_unexpected_content_type',
      },
      {
        response: new Response(`{"private":"${sensitive}"`, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
        code: 'latest_row_json_parse_failed',
      },
      {
        response: Response.json([{ id: 42, private: sensitive }]),
        code: 'latest_row_invalid_shape',
      },
      {
        response: new Error(`network failed for ${sensitive}`),
        code: 'latest_row_fetch_network_error',
      },
    ];

    for (const testCase of cases) {
      const harness = actualConsumerHarness({
        latestRowResponses: [testCase.response],
      });
      const result = await runActualConsumer(harness);
      expect(result.calls).toEqual({ ack: 0, retry: 1 });
      expect(result.log).toMatchObject({
        diagnosticCode: testCase.code,
        diagnosticStage: 'initial_row_load',
      });
      if (testCase.status) expect(result.log.httpStatus).toBe(testCase.status);
      expect(JSON.stringify(result.log)).not.toContain(sensitive);
      expect(JSON.stringify(result.log)).not.toContain('must-not-leak');
      expect(harness.calls.source).toBe(0);
      expect(harness.calls.store).toBe(0);
      expect(harness.calls.transform).toBe(0);
    }
  });

  test('diagnostic stage and inventory counts survive a source HTTP failure', async () => {
    const harness = actualConsumerHarness({
      latestRowResponses: [latestRowResponse()],
      sourceResponse: new Response('', { status: 503 }),
    });
    const result = await runActualConsumer(harness);

    expect(result.calls).toEqual({ ack: 0, retry: 1 });
    expect(result.log).toMatchObject({
      outcome: 'transient_failure',
      diagnosticCode: 'source_http_server_error',
      diagnosticStage: 'source_fetch',
      httpStatus: 503,
      sourceCount: 1,
      derivativeCount: 5,
    });
    expect(harness.calls).toEqual({
      latestRow: 1,
      source: 1,
      store: 0,
      transform: 0,
    });
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
    expect(requests[0].init).toEqual({ method: 'GET', redirect: 'manual' });
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
        {
          binding: 'EXPERIENCE_TRANSLATION_QUEUE',
          queue: 'locally-experience-translation-production',
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
        {
          queue: 'locally-experience-translation-production',
          max_batch_size: 1,
          max_retries: 5,
          dead_letter_queue: 'locally-experience-translation-dlq-production',
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
