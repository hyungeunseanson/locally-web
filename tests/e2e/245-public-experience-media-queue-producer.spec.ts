import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import {
  parsePublicExperienceMediaQueueMessage,
  type PublicExperienceMediaRow,
} from '../../app/utils/publicExperienceMediaQueueMirror';
import {
  planPublicExperienceMediaAfterWrite,
  schedulePublicExperienceMediaAfterWrite,
  type PublicExperienceMediaAfterWrite,
  type PublicExperienceMediaProducerLog,
} from '../../app/utils/publicExperienceMediaQueueProducer';

const SOURCE_ROOT =
  'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences';
const SOURCE_OWNER = '11111111-1111-4111-8111-111111111111';

function row(overrides: Partial<PublicExperienceMediaRow> = {}): PublicExperienceMediaRow {
  return {
    id: 42,
    status: 'active',
    is_active: true,
    photos: [`${SOURCE_ROOT}/experience/${SOURCE_OWNER}/hero/hero.jpg`],
    itinerary: [
      { image_url: `${SOURCE_ROOT}/experience/${SOURCE_OWNER}/itinerary/stop.jpg` },
    ],
    image_url: null,
    ...overrides,
  };
}

function producerHarness(overrides: Record<string, unknown> = {}) {
  const sent: unknown[] = [];
  const sendOptions: unknown[] = [];
  const tracked: Promise<unknown>[] = [];
  const logs: PublicExperienceMediaProducerLog[] = [];
  const queue = {
    send: async (message: unknown, options: unknown) => {
      sent.push(message);
      sendOptions.push(options);
    },
  };
  const env = {
    CLOUDFLARE_DEPLOYMENT_ENV: 'production',
    PUBLIC_EXPERIENCE_MEDIA_PRODUCER_ENABLED: 'true',
    PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS: '42',
    PUBLIC_EXPERIENCE_MEDIA_QUEUE: queue,
    ...overrides,
  };
  const ctx = {
    waitUntil: (promise: Promise<unknown>) => {
      tracked.push(promise);
    },
  };
  return { sent, sendOptions, tracked, logs, queue, env, ctx };
}

function schedule(
  harness: ReturnType<typeof producerHarness>,
  input: PublicExperienceMediaAfterWrite = {
    before: row({ photos: [`${SOURCE_ROOT}/experience/${SOURCE_OWNER}/hero/old.jpg`] }),
    after: row(),
    writeKind: 'edit' as const,
  }
) {
  return schedulePublicExperienceMediaAfterWrite(input, {
    loadRuntime: () => ({ env: harness.env, ctx: harness.ctx }),
    createEventId: () => 'event_20260914_0001',
    log: (entry) => harness.logs.push(entry),
  });
}

test.describe('default-OFF public experience media Queue producer', () => {
  test('defaults OFF and fails closed for environment, configuration, binding, and allowlist gaps', () => {
    for (const overrides of [
      { PUBLIC_EXPERIENCE_MEDIA_PRODUCER_ENABLED: undefined },
      { PUBLIC_EXPERIENCE_MEDIA_PRODUCER_ENABLED: 'false' },
      { CLOUDFLARE_DEPLOYMENT_ENV: 'canary' },
      { CLOUDFLARE_DEPLOYMENT_ENV: 'preview' },
      { CLOUDFLARE_DEPLOYMENT_ENV: undefined },
      { PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS: '41' },
      { PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS: '42,invalid' },
      { PUBLIC_EXPERIENCE_MEDIA_QUEUE: undefined },
    ]) {
      const harness = producerHarness(overrides);
      expect(schedule(harness).status).toBe('disabled');
      expect(harness.sent).toHaveLength(0);
      expect(harness.tracked).toHaveLength(0);
      expect(harness.logs).toHaveLength(0);
    }
  });

  test('never sends for pending create, inactive/deleted rows, or unchanged public media', () => {
    const cases = [
      {
        before: null,
        after: row({ status: 'pending' }),
        writeKind: 'create' as const,
        expected: 'ineligible',
      },
      {
        before: row(),
        after: row({ is_active: false }),
        writeKind: 'edit' as const,
        expected: 'ineligible',
      },
      {
        before: row(),
        after: null,
        writeKind: 'edit' as const,
        expected: 'ineligible',
      },
      {
        before: row(),
        after: row(),
        writeKind: 'edit' as const,
        expected: 'unchanged',
      },
    ];
    for (const input of cases) {
      const harness = producerHarness();
      const result = schedulePublicExperienceMediaAfterWrite(input, {
        loadRuntime: () => ({ env: harness.env, ctx: harness.ctx }),
      });
      expect(result.status).toBe(input.expected);
      expect(harness.sent).toHaveLength(0);
      expect(harness.tracked).toHaveLength(0);
    }
  });

  test('sends once for approval, reactivation, hero/photos, itinerary, and legacy changes', async () => {
    const changedRows = [
      {
        before: row({ status: 'pending' }),
        after: row(),
        writeKind: 'activation' as const,
        reason: 'activation',
      },
      {
        before: row({ is_active: false }),
        after: row(),
        writeKind: 'activation' as const,
        reason: 'activation',
      },
      {
        before: row(),
        after: row({ photos: [`${SOURCE_ROOT}/experience/${SOURCE_OWNER}/hero/new.jpg`] }),
        writeKind: 'edit' as const,
        reason: 'edit',
      },
      {
        before: row(),
        after: row({ itinerary: [{ image_url: `${SOURCE_ROOT}/experience/${SOURCE_OWNER}/itinerary/new-stop.jpg` }] }),
        writeKind: 'edit' as const,
        reason: 'edit',
      },
      {
        before: row({ photos: [], image_url: `${SOURCE_ROOT}/experience/${SOURCE_OWNER}/hero/legacy-old.jpg` }),
        after: row({ photos: [], image_url: `${SOURCE_ROOT}/experience/${SOURCE_OWNER}/hero/legacy-new.jpg` }),
        writeKind: 'edit' as const,
        reason: 'edit',
      },
      {
        before: row({ photos: [
          `${SOURCE_ROOT}/experience/${SOURCE_OWNER}/hero/hero.jpg`,
          `${SOURCE_ROOT}/experience/${SOURCE_OWNER}/hero/second.jpg`,
        ] }),
        after: row({ photos: [
          `${SOURCE_ROOT}/experience/${SOURCE_OWNER}/hero/second.jpg`,
          `${SOURCE_ROOT}/experience/${SOURCE_OWNER}/hero/hero.jpg`,
        ] }),
        writeKind: 'reorder' as const,
        reason: 'reorder',
      },
    ];

    for (const input of changedRows) {
      const plan = planPublicExperienceMediaAfterWrite(input);
      expect(plan).toMatchObject({ status: 'enqueue', reason: input.reason });
      const harness = producerHarness();
      const result = schedule(harness, input);
      expect(result.status).toBe('scheduled');
      if (result.status === 'scheduled') await result.completion;
      expect(harness.sent).toHaveLength(1);
      expect(harness.tracked).toHaveLength(1);
    }
  });

  test('registers one tracked send and records enqueued only after send completion', async () => {
    const harness = producerHarness();
    let resolveSend: (() => void) | undefined;
    harness.env.PUBLIC_EXPERIENCE_MEDIA_QUEUE = {
      send: (message: unknown, options: unknown) => {
        harness.sent.push(message);
        harness.sendOptions.push(options);
        return new Promise<void>((resolve) => {
          resolveSend = resolve;
        });
      },
    };

    const result = schedule(harness);
    expect(result.status).toBe('scheduled');
    expect(harness.tracked).toHaveLength(1);
    expect(harness.logs.map((entry) => entry.status)).toEqual(['scheduled']);
    await expect.poll(() => harness.sent.length).toBe(1);
    expect(parsePublicExperienceMediaQueueMessage(harness.sent[0])).toEqual({
      schema: 'locally.public-experience-media-mirror',
      version: 1,
      experienceId: '42',
      reason: 'edit',
      eventId: 'event_20260914_0001',
    });
    expect(harness.sendOptions).toEqual([{ contentType: 'json' }]);
    resolveSend?.();
    if (result.status === 'scheduled') {
      await expect(result.completion).resolves.toEqual({
        status: 'enqueued',
        diagnosticCode: 'queue_send_succeeded',
      });
    }
    expect(harness.logs.map((entry) => entry.status)).toEqual(['scheduled', 'enqueued']);
  });

  test('isolates synchronous throws and rejected sends from the completed database write', async () => {
    for (const failure of ['throw', 'reject'] as const) {
      const harness = producerHarness();
      harness.env.PUBLIC_EXPERIENCE_MEDIA_QUEUE = {
        send: () => {
          if (failure === 'throw') throw new Error('provider payload must stay private');
          return Promise.reject(new Error('provider payload must stay private'));
        },
      };
      const databaseResponse = { success: true, id: 42 };
      const result = schedule(harness);
      expect(databaseResponse).toEqual({ success: true, id: 42 });
      expect(result.status).toBe('scheduled');
      if (result.status === 'scheduled') {
        await expect(result.completion).resolves.toEqual({
          status: 'enqueue_failed',
          diagnosticCode: 'queue_send_failed',
        });
      }
      expect(harness.logs.at(-1)).toMatchObject({
        status: 'enqueue_failed',
        diagnosticCode: 'queue_send_failed',
      });
      expect(JSON.stringify(harness.logs)).not.toContain('provider payload');
    }
  });

  test('does not start Queue send when context loading or waitUntil registration fails', async () => {
    const loadFailure = producerHarness();
    const loadResult = schedulePublicExperienceMediaAfterWrite(
      { before: row({ status: 'pending' }), after: row(), writeKind: 'activation' },
      { loadRuntime: () => { throw new Error('context failed'); } }
    );
    expect(loadResult.status).toBe('context_unavailable');
    expect(loadFailure.sent).toHaveLength(0);

    const harness = producerHarness();
    harness.ctx.waitUntil = () => {
      throw new Error('waitUntil failed');
    };
    expect(schedule(harness).status).toBe('context_unavailable');
    await new Promise((resolve) => setImmediate(resolve));
    expect(harness.sent).toHaveLength(0);
  });

  test('logs only bounded fields and never source URLs, paths, bodies, or raw errors', async () => {
    const harness = producerHarness();
    const result = schedule(harness);
    expect(result.status).toBe('scheduled');
    if (result.status === 'scheduled') await result.completion;
    for (const entry of harness.logs) {
      expect(Object.keys(entry).sort()).toEqual([
        'diagnosticCode',
        'event',
        'eventId',
        'experienceId',
        'reason',
        'status',
      ]);
    }
    const serialized = JSON.stringify(harness.logs);
    expect(serialized).not.toContain(SOURCE_ROOT);
    expect(serialized).not.toContain(SOURCE_OWNER);
  });

  test('isolates logging failures from scheduling and Queue completion', async () => {
    const harness = producerHarness();
    const result = schedulePublicExperienceMediaAfterWrite(
      {
        before: row({ photos: [`${SOURCE_ROOT}/experience/${SOURCE_OWNER}/hero/old.jpg`] }),
        after: row(),
        writeKind: 'edit',
      },
      {
        loadRuntime: () => ({ env: harness.env, ctx: harness.ctx }),
        createEventId: () => 'event_20260914_0002',
        log: () => {
          throw new Error('logger unavailable');
        },
      }
    );
    expect(result.status).toBe('scheduled');
    if (result.status === 'scheduled') {
      await expect(result.completion).resolves.toEqual({
        status: 'enqueued',
        diagnosticCode: 'queue_send_succeeded',
      });
    }
    expect(harness.sent).toHaveLength(1);
  });

  test('hooks only confirmed authenticated write results and keeps producer remote wiring absent', () => {
    const shared = readFileSync('app/api/host/experiences/shared.ts', 'utf8');
    const admin = readFileSync('app/actions/admin.ts', 'utf8');
    const adminExperience = readFileSync('app/actions/updateExperienceAdminStatus.ts', 'utf8');
    const createRoute = readFileSync('app/api/host/experiences/route.ts', 'utf8');
    const updateRoute = readFileSync('app/api/host/experiences/[id]/route.ts', 'utf8');
    const photoRouteEntry = readFileSync('app/api/admin/experiences/[id]/photos/route.ts', 'utf8');
    const photoRoute = readFileSync('app/api/admin/experiences/[id]/photos/routeHandler.ts', 'utf8');
    const wrangler = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
    const worker = readFileSync('cloudflare-worker.ts', 'utf8');

    expect(shared.match(/dependencies\.scheduleMediaProducer\(/g)).toHaveLength(2);
    expect(shared).toContain(".select('id, status, is_active, photos, itinerary, image_url')");
    const createGuard = shared.indexOf("throw error ?? new Error('Failed to create experience.')");
    const createHook = shared.indexOf("writeKind: 'create'");
    const editGuard = shared.indexOf("throw error ?? new ApiError(500, '체험 저장에 실패했습니다.')");
    const editHook = shared.indexOf("writeKind: 'edit'");
    expect(createGuard).toBeGreaterThanOrEqual(0);
    expect(createHook).toBeGreaterThanOrEqual(0);
    expect(editGuard).toBeGreaterThanOrEqual(0);
    expect(editHook).toBeGreaterThanOrEqual(0);
    expect(createGuard).toBeLessThan(createHook);
    expect(editGuard).toBeLessThan(editHook);

    expect(admin).toContain('executeUpdateExperienceAdminStatus');
    expect(createRoute).toContain('return handleHostExperienceCreate(request)');
    expect(updateRoute).toContain('return handleHostExperienceUpdate(request, context)');
    expect(photoRouteEntry).toContain('return handleAdminExperiencePhotoReorder(request, context)');
    expect(adminExperience).toContain(".select('id, status, is_active, photos, itinerary, image_url')");
    const activationGuard = adminExperience.indexOf("if (!updatedExperience) throw new Error('Experience not found')");
    const activationHook = adminExperience.indexOf("writeKind: 'activation'");
    const reorderGuard = photoRoute.indexOf('if (!updatedExperience)');
    const reorderHook = photoRoute.indexOf("writeKind: 'reorder'");
    expect(activationGuard).toBeGreaterThanOrEqual(0);
    expect(activationHook).toBeGreaterThanOrEqual(0);
    expect(reorderGuard).toBeGreaterThanOrEqual(0);
    expect(reorderHook).toBeGreaterThanOrEqual(0);
    expect(activationGuard).toBeLessThan(activationHook);
    expect(reorderGuard).toBeLessThan(reorderHook);

    expect(wrangler.env.production.queues.producers).toBeUndefined();
    expect(worker).not.toContain('PUBLIC_EXPERIENCE_MEDIA_QUEUE.send');
    expect(worker).not.toContain('producer');
  });
});
