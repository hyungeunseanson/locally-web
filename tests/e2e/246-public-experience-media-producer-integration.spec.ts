import { expect, test } from '@playwright/test';
import { NextRequest } from 'next/server';

import { executeUpdateExperienceAdminStatus } from '@/app/actions/updateExperienceAdminStatus';
import { handleAdminExperiencePhotoReorder } from '@/app/api/admin/experiences/[id]/photos/routeHandler';
import { handleHostExperienceUpdate } from '@/app/api/host/experiences/[id]/routeHandler';
import { handleHostExperienceCreate } from '@/app/api/host/experiences/routeHandler';
import {
  createExperienceFromBody,
  getRouteActor,
  updateExperienceFromBody,
  type ExperienceWriteDependencies,
  type RouteActorDependencies,
} from '@/app/api/host/experiences/shared';
import {
  schedulePublicExperienceMediaAfterWrite,
  type PublicExperienceMediaAfterWrite,
  type PublicExperienceMediaProducerLog,
  type PublicExperienceMediaProducerScheduleResult,
} from '@/app/utils/publicExperienceMediaQueueProducer';
import type { createAdminClient } from '@/app/utils/supabase/admin';

const SOURCE_ROOT =
  'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences';
const SOURCE_OWNER = '11111111-1111-4111-8111-111111111111';
const OLD_PHOTO = `${SOURCE_ROOT}/experience/${SOURCE_OWNER}/hero/old.jpg`;
const NEW_PHOTO = `${SOURCE_ROOT}/experience/${SOURCE_OWNER}/hero/new.jpg`;
const ITINERARY_PHOTO = `${SOURCE_ROOT}/experience/${SOURCE_OWNER}/itinerary/stop.jpg`;

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type ExpectedQuery = {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  result: QueryResult;
};

type QueryCall = {
  table: string;
  operation: ExpectedQuery['operation'];
  payload?: unknown;
};

class FakeQuery implements PromiseLike<QueryResult> {
  private operation: ExpectedQuery['operation'] = 'select';

  constructor(
    private readonly database: FakeDatabase,
    private readonly table: string
  ) {}

  select() {
    return this;
  }

  insert(payload: unknown) {
    this.operation = 'insert';
    this.database.recordPayload(this.table, this.operation, payload);
    return this;
  }

  update(payload: unknown) {
    this.operation = 'update';
    this.database.recordPayload(this.table, this.operation, payload);
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  upsert(payload: unknown) {
    this.operation = 'upsert';
    this.database.recordPayload(this.table, this.operation, payload);
    return this;
  }

  eq() {
    return this;
  }

  filter() {
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.database.consume(this.table, this.operation));
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.database.consume(this.table, this.operation)).then(
      onfulfilled,
      onrejected
    );
  }
}

class FakeDatabase {
  readonly calls: QueryCall[] = [];

  constructor(private readonly expected: ExpectedQuery[]) {}

  from(table: string) {
    return new FakeQuery(this, table);
  }

  recordPayload(
    table: string,
    operation: ExpectedQuery['operation'],
    payload: unknown
  ) {
    this.calls.push({ table, operation, payload });
  }

  consume(table: string, operation: ExpectedQuery['operation']) {
    const next = this.expected.shift();
    if (!next) {
      throw new Error(`Unexpected local fake query: ${table}:${operation}`);
    }
    expect({ table, operation }).toEqual({
      table: next.table,
      operation: next.operation,
    });
    if (!this.calls.some((call) => call.table === table && call.operation === operation)) {
      this.calls.push({ table, operation });
    }
    return next.result;
  }

  assertExhausted() {
    expect(this.expected).toHaveLength(0);
  }
}

function asAdminClient(database: FakeDatabase): ReturnType<typeof createAdminClient> {
  return database as never;
}

function success(data: unknown): QueryResult {
  return { data, error: null };
}

function failure(message: string): QueryResult {
  return { data: null, error: { message } };
}

function mediaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    host_id: 'host-1',
    title: '서울 골목 도보 체험',
    description: '서울의 골목과 지역 문화를 천천히 둘러보는 충분히 긴 체험 소개 문장입니다.',
    title_ko: '서울 골목 도보 체험',
    description_ko: '서울의 골목과 지역 문화를 천천히 둘러보는 충분히 긴 체험 소개 문장입니다.',
    status: 'active',
    is_active: true,
    photos: [OLD_PHOTO],
    itinerary: [
      {
        title: '출발 장소',
        description: '현지 호스트를 만나 체험을 시작합니다.',
        type: 'meet',
        image_url: ITINERARY_PHOTO,
      },
    ],
    image_url: null,
    translation_version: 1,
    source_locale: 'ko',
    manual_locales: ['ko'],
    category: 'walking',
    meeting_point: '서울역 1번 출구',
    meeting_point_i18n: null,
    supplies: '편한 신발',
    supplies_i18n: null,
    inclusions: ['가이드'],
    inclusions_i18n: null,
    exclusions: ['교통비'],
    exclusions_i18n: null,
    itinerary_i18n: null,
    rules: {
      age_limit: '만 12세 이상',
      activity_level: '보통',
      refund_policy: 'standard',
      host_notice: '',
    },
    rules_i18n: null,
    solo_guarantee_price: 20000,
    ...overrides,
  };
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    country: '대한민국',
    city: '서울',
    category: 'walking',
    language_levels: [{ language: 'ko', level: 5 }],
    source_locale: 'ko',
    manual_locales: ['ko'],
    manual_content: {
      ko: {
        title: '서울 골목 도보 체험',
        description: '서울의 골목과 지역 문화를 천천히 둘러보는 충분히 긴 체험 소개 문장입니다.',
      },
    },
    photos: [NEW_PHOTO],
    location: '서울특별시 중구',
    itinerary: [
      {
        title: '출발 장소',
        description: '현지 호스트를 만나 체험을 시작합니다.',
        type: 'meet',
        image_url: ITINERARY_PHOTO,
      },
    ],
    inclusions: ['가이드'],
    exclusions: ['교통비'],
    supplies: '편한 신발',
    duration: 2,
    maxGuests: 6,
    meeting_point: '서울역 1번 출구',
    rules: {
      age_limit: '만 12세 이상',
      activity_level: '보통',
      refund_policy: 'standard',
      host_notice: '',
    },
    price: 50000,
    solo_guarantee_price: 20000,
    is_private_enabled: false,
    private_price: 0,
    ...overrides,
  };
}

function request(method: 'POST' | 'PATCH', body: unknown) {
  return new NextRequest('http://127.0.0.1:3000/test', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function actorDependencies(options: {
  user?: { id: string; email?: string | null } | null;
  isAdmin?: boolean;
  adminDatabase?: FakeDatabase;
} = {}): RouteActorDependencies {
  const user = options.user === undefined
    ? { id: 'host-1', email: 'host@example.test' }
    : options.user;
  const adminDatabase = options.adminDatabase ?? new FakeDatabase([]);
  return {
    createServerClient: async () => ({
      auth: {
        getUser: async () => ({ data: { user }, error: null }),
      },
    }),
    createAdminClient: () => asAdminClient(adminDatabase),
    resolveAdminAccess: async () => ({
      isAdmin: options.isAdmin ?? false,
      userRole: options.isAdmin ? 'admin' : 'host',
      isWhitelisted: false,
    }),
  };
}

type ProducerFailure =
  | 'none'
  | 'sync_throw'
  | 'reject'
  | 'context'
  | 'wait_until'
  | 'logger';

function producerHarness(failureMode: ProducerFailure = 'none') {
  const messages: unknown[] = [];
  const tracked: Promise<unknown>[] = [];
  const completions: Promise<unknown>[] = [];
  const logs: PublicExperienceMediaProducerLog[] = [];
  const results: PublicExperienceMediaProducerScheduleResult[] = [];
  let sendAttempts = 0;

  const schedule = (input: PublicExperienceMediaAfterWrite) => {
    const result = schedulePublicExperienceMediaAfterWrite(input, {
      loadRuntime: () => {
        if (failureMode === 'context') throw new Error('private context details');
        return {
          env: {
            CLOUDFLARE_DEPLOYMENT_ENV: 'production',
            PUBLIC_EXPERIENCE_MEDIA_PRODUCER_ENABLED: 'true',
            PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS: '42',
            PUBLIC_EXPERIENCE_MEDIA_QUEUE: {
              send: (message: unknown) => {
                sendAttempts += 1;
                messages.push(message);
                if (failureMode === 'sync_throw') {
                  throw new Error('private Queue provider details');
                }
                if (failureMode === 'reject') {
                  return Promise.reject(new Error('private Queue provider details'));
                }
                return Promise.resolve();
              },
            },
          },
          ctx: {
            waitUntil: (promise: Promise<unknown>) => {
              if (failureMode === 'wait_until') {
                throw new Error('private waitUntil details');
              }
              tracked.push(promise);
            },
          },
        };
      },
      createEventId: () => 'event_integration_0001',
      log: (entry) => {
        if (failureMode === 'logger') throw new Error('private logger details');
        logs.push(entry);
      },
    });
    results.push(result);
    if (result.status === 'scheduled') completions.push(result.completion);
    return result;
  };

  return {
    completions,
    logs,
    messages,
    results,
    schedule,
    tracked,
    get sendAttempts() {
      return sendAttempts;
    },
    async settle() {
      await Promise.all(completions);
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

function writeDependencies(
  database: FakeDatabase,
  producer: ReturnType<typeof producerHarness>
): ExperienceWriteDependencies {
  return {
    createAdminClient: () => asAdminClient(database),
    scheduleMediaProducer: producer.schedule,
    enqueueTranslationJob: async () => undefined,
    markTranslationQueueFailure: async () => undefined,
    insertAdminAlerts: async () => ({ success: true, count: 0, targetCount: 0 }),
    sendAdminAlertEmails: async () => ({ success: true, count: 0, targetCount: 0 }),
  };
}

function emailResult() {
  return {
    success: true,
    sent: false,
    provider: 'none' as const,
    skipped: 'recipient_missing' as const,
    subject: '',
    preheader: '',
    html: '',
    text: '',
  };
}

function createRouteDependencies(
  auth: RouteActorDependencies,
  writes: ExperienceWriteDependencies
) {
  return {
    getRouteActor: () => getRouteActor(auth),
    createExperienceFromBody: (
      body: Parameters<typeof createExperienceFromBody>[0],
      actor: Parameters<typeof createExperienceFromBody>[1]
    ) => createExperienceFromBody(body, actor, writes),
  };
}

function updateRouteDependencies(
  auth: RouteActorDependencies,
  writes: ExperienceWriteDependencies
) {
  return {
    getRouteActor: () => getRouteActor(auth),
    updateExperienceFromBody: (
      input: Parameters<typeof updateExperienceFromBody>[0]
    ) => updateExperienceFromBody(input, writes),
  };
}

async function responseBody(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test.describe('public experience media producer application integration', () => {
  test('host create executes route auth and preserves validation/insert/pending behavior', async () => {
    const unauthProducer = producerHarness();
    const unauthDatabase = new FakeDatabase([]);
    const unauthResponse = await handleHostExperienceCreate(
      request('POST', validBody()),
      createRouteDependencies(
        actorDependencies({ user: null, adminDatabase: unauthDatabase }),
        writeDependencies(unauthDatabase, unauthProducer)
      )
    );
    expect(unauthResponse.status).toBe(401);
    expect(await responseBody(unauthResponse)).toEqual({ success: false, error: 'Unauthorized' });
    expect(unauthProducer.sendAttempts).toBe(0);

    const validationProducer = producerHarness();
    const validationDatabase = new FakeDatabase([]);
    const validationResponse = await handleHostExperienceCreate(
      request('POST', validBody({ city: '' })),
      createRouteDependencies(
        actorDependencies({ isAdmin: true, adminDatabase: validationDatabase }),
        writeDependencies(validationDatabase, validationProducer)
      )
    );
    expect(validationResponse.status).toBe(400);
    expect(await responseBody(validationResponse)).toMatchObject({ success: false });
    expect(validationProducer.sendAttempts).toBe(0);

    for (const result of [
      failure('insert failed'),
      {
        data: mediaRow({ status: 'active', is_active: true, photos: [NEW_PHOTO] }),
        error: { message: 'insert failed' },
      },
      success(null),
    ]) {
      const producer = producerHarness();
      const database = new FakeDatabase([
        { table: 'experiences', operation: 'insert', result },
      ]);
      const response = await handleHostExperienceCreate(
        request('POST', validBody()),
        createRouteDependencies(
          actorDependencies({ isAdmin: true, adminDatabase: database }),
          writeDependencies(database, producer)
        )
      );
      expect(response.status).toBe(500);
      expect(await responseBody(response)).toMatchObject({ success: false });
      expect(producer.sendAttempts).toBe(0);
      database.assertExhausted();
    }

    const pendingProducer = producerHarness();
    const pendingDatabase = new FakeDatabase([
      {
        table: 'experiences',
        operation: 'insert',
        result: success(mediaRow({ status: 'pending', is_active: false, photos: [NEW_PHOTO] })),
      },
    ]);
    const pendingResponse = await handleHostExperienceCreate(
      request('POST', validBody()),
      createRouteDependencies(
        actorDependencies({ isAdmin: true, adminDatabase: pendingDatabase }),
        writeDependencies(pendingDatabase, pendingProducer)
      )
    );
    expect(pendingResponse.status).toBe(200);
    expect(await responseBody(pendingResponse)).toMatchObject({ success: true, id: 42 });
    expect(pendingProducer.results).toMatchObject([{ status: 'ineligible' }]);
    expect(pendingProducer.sendAttempts).toBe(0);
    pendingDatabase.assertExhausted();
  });

  test('host edit enforces ownership and confirmed update rows before enqueue', async () => {
    const forbiddenProducer = producerHarness();
    const forbiddenDatabase = new FakeDatabase([
      {
        table: 'experiences',
        operation: 'select',
        result: success(mediaRow({ host_id: 'other-host' })),
      },
    ]);
    const forbiddenResponse = await handleHostExperienceUpdate(
      request('PATCH', validBody()),
      { params: Promise.resolve({ id: '42' }) },
      updateRouteDependencies(
        actorDependencies({ adminDatabase: forbiddenDatabase }),
        writeDependencies(forbiddenDatabase, forbiddenProducer)
      )
    );
    expect(forbiddenResponse.status).toBe(403);
    expect(await responseBody(forbiddenResponse)).toEqual({ success: false, error: '수정 권한이 없습니다.' });
    expect(forbiddenProducer.sendAttempts).toBe(0);
    forbiddenDatabase.assertExhausted();

    for (const result of [
      failure('update failed'),
      { data: mediaRow({ photos: [NEW_PHOTO] }), error: { message: 'update failed' } },
      success(null),
    ]) {
      const producer = producerHarness();
      const database = new FakeDatabase([
        { table: 'experiences', operation: 'select', result: success(mediaRow()) },
        { table: 'experiences', operation: 'update', result },
      ]);
      const response = await handleHostExperienceUpdate(
        request('PATCH', validBody()),
        { params: Promise.resolve({ id: '42' }) },
        updateRouteDependencies(
          actorDependencies({ isAdmin: true, adminDatabase: database }),
          writeDependencies(database, producer)
        )
      );
      expect(response.status).toBe(500);
      expect(await responseBody(response)).toMatchObject({ success: false });
      expect(producer.sendAttempts).toBe(0);
      database.assertExhausted();
    }
  });

  test('host edit returns the real success response and sends only for eligible media changes', async () => {
    for (const scenario of [
      {
        name: 'public media changed',
        before: mediaRow(),
        after: mediaRow({ photos: [NEW_PHOTO] }),
        body: validBody(),
        expectedSends: 1,
      },
      {
        name: 'public media unchanged',
        before: mediaRow({ photos: [NEW_PHOTO] }),
        after: mediaRow({ photos: [NEW_PHOTO] }),
        body: validBody(),
        expectedSends: 0,
      },
      ...['inactive', 'rejected', 'revision', 'approved'].map((status) => ({
        name: status,
        before: mediaRow({ status, photos: [OLD_PHOTO] }),
        after: mediaRow({ status, photos: [NEW_PHOTO] }),
        body: validBody(),
        expectedSends: 0,
      })),
    ]) {
      const producer = producerHarness();
      const database = new FakeDatabase([
        { table: 'experiences', operation: 'select', result: success(scenario.before) },
        { table: 'experiences', operation: 'update', result: success(scenario.after) },
      ]);
      const response = await handleHostExperienceUpdate(
        request('PATCH', scenario.body),
        { params: Promise.resolve({ id: '42' }) },
        updateRouteDependencies(
          actorDependencies({ isAdmin: true, adminDatabase: database }),
          writeDependencies(database, producer)
        )
      );
      expect(response.status, scenario.name).toBe(200);
      expect(await responseBody(response), scenario.name).toMatchObject({ success: true, id: 42 });
      await producer.settle();
      expect(producer.sendAttempts, scenario.name).toBe(scenario.expectedSends);
      database.assertExhausted();
    }
  });

  test('actual host edit response survives every producer-side failure boundary', async () => {
    for (const failureMode of [
      'sync_throw',
      'reject',
      'context',
      'wait_until',
      'logger',
    ] as const) {
      const producer = producerHarness(failureMode);
      const database = new FakeDatabase([
        { table: 'experiences', operation: 'select', result: success(mediaRow()) },
        {
          table: 'experiences',
          operation: 'update',
          result: success(mediaRow({ photos: [NEW_PHOTO] })),
        },
      ]);
      const response = await handleHostExperienceUpdate(
        request('PATCH', validBody()),
        { params: Promise.resolve({ id: '42' }) },
        updateRouteDependencies(
          actorDependencies({ isAdmin: true, adminDatabase: database }),
          writeDependencies(database, producer)
        )
      );
      expect(response.status, failureMode).toBe(200);
      expect(await responseBody(response), failureMode).toMatchObject({ success: true, id: 42 });
      await producer.settle();
      expect(producer.sendAttempts, failureMode).toBe(
        failureMode === 'context' || failureMode === 'wait_until' ? 0 : 1
      );
      expect(JSON.stringify(producer.logs)).not.toContain('private');
      database.assertExhausted();
    }
  });

  test('admin status action requires authorization and a returned updated row', async () => {
    const unauthorizedProducer = producerHarness();
    await expect(executeUpdateExperienceAdminStatus(42, 'active', undefined, {
      getAdminClient: async () => {
        throw new Error('Forbidden: Admin access required');
      },
      createAdminClient: () => asAdminClient(new FakeDatabase([])),
      scheduleMediaProducer: unauthorizedProducer.schedule,
      buildLocalizedNotificationInsert: async () => ({} as never),
      sendImmediateGenericEmail: async () => emailResult(),
      recordAuditLog: async () => undefined,
    })).rejects.toThrow('Forbidden: Admin access required');
    expect(unauthorizedProducer.sendAttempts).toBe(0);

    for (const result of [failure('admin update failed'), success(null)]) {
      const producer = producerHarness();
      const database = new FakeDatabase([
        {
          table: 'experiences',
          operation: 'select',
          result: success(mediaRow({ status: 'pending' })),
        },
        { table: 'experiences', operation: 'update', result },
      ]);
      await expect(executeUpdateExperienceAdminStatus(42, 'active', undefined, {
        getAdminClient: async () => ({
          auth: { getUser: async () => ({ data: { user: { id: 'admin-1', email: 'admin@example.test' } } }) },
        }),
        createAdminClient: () => asAdminClient(database),
        scheduleMediaProducer: producer.schedule,
        buildLocalizedNotificationInsert: async () => ({} as never),
        sendImmediateGenericEmail: async () => emailResult(),
        recordAuditLog: async () => undefined,
      })).rejects.toThrow(result.error ? 'admin update failed' : 'Experience not found');
      expect(producer.sendAttempts).toBe(0);
      database.assertExhausted();
    }
  });

  test('admin status action sends only for an actually public-active returned row', async () => {
    for (const scenario of [
      { status: 'active', isActive: true, expectedSends: 1 },
      { status: 'active', isActive: false, expectedSends: 0 },
      { status: 'approved', isActive: true, expectedSends: 0 },
      { status: 'revision', isActive: true, expectedSends: 0 },
      { status: 'rejected', isActive: true, expectedSends: 0 },
    ]) {
      const producer = producerHarness();
      const expectedQueries: ExpectedQuery[] = [
        {
          table: 'experiences',
          operation: 'select',
          result: success(mediaRow({ status: 'pending' })),
        },
        {
          table: 'experiences',
          operation: 'update',
          result: success(mediaRow({ status: scenario.status, is_active: scenario.isActive })),
        },
      ];
      if (['active', 'approved', 'revision'].includes(scenario.status)) {
        expectedQueries.push({
          table: 'experiences',
          operation: 'select',
          result: success(null),
        });
      }
      const database = new FakeDatabase(expectedQueries);
      const result = await executeUpdateExperienceAdminStatus(42, scenario.status, undefined, {
        getAdminClient: async () => ({
          auth: { getUser: async () => ({ data: { user: { id: 'admin-1', email: 'admin@example.test' } } }) },
        }),
        createAdminClient: () => asAdminClient(database),
        scheduleMediaProducer: producer.schedule,
        buildLocalizedNotificationInsert: async () => ({} as never),
        sendImmediateGenericEmail: async () => emailResult(),
        recordAuditLog: async () => undefined,
      });
      expect(result).toEqual({ success: true });
      await producer.settle();
      expect(producer.sendAttempts, scenario.status).toBe(scenario.expectedSends);
      database.assertExhausted();
    }
  });

  test('admin photo reorder returns auth, validation, conflict, and success responses without false enqueue', async () => {
    const authClient = (user: { id: string; email?: string } | null) => async () => ({
      auth: { getUser: async () => ({ data: { user }, error: null }) },
    }) as never;
    const common = (database: FakeDatabase, producer: ReturnType<typeof producerHarness>, isAdmin = true) => ({
      createClient: authClient({ id: 'admin-1', email: 'admin@example.test' }),
      createAdminClient: () => asAdminClient(database),
      resolveAdminAccess: async () => ({ isAdmin, userRole: isAdmin ? 'admin' : 'host', isWhitelisted: false }),
      scheduleMediaProducer: producer.schedule,
      recordAuditLog: async () => undefined,
    });

    const unauthProducer = producerHarness();
    const unauthResponse = await handleAdminExperiencePhotoReorder(
      request('PATCH', { expectedPhotos: [OLD_PHOTO, NEW_PHOTO], photos: [NEW_PHOTO, OLD_PHOTO] }),
      { params: Promise.resolve({ id: '42' }) },
      { ...common(new FakeDatabase([]), unauthProducer), createClient: authClient(null) }
    );
    expect(unauthResponse.status).toBe(401);
    expect(unauthProducer.sendAttempts).toBe(0);

    const forbiddenProducer = producerHarness();
    const forbiddenResponse = await handleAdminExperiencePhotoReorder(
      request('PATCH', { expectedPhotos: [OLD_PHOTO, NEW_PHOTO], photos: [NEW_PHOTO, OLD_PHOTO] }),
      { params: Promise.resolve({ id: '42' }) },
      common(new FakeDatabase([]), forbiddenProducer, false)
    );
    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenProducer.sendAttempts).toBe(0);

    const invalidProducer = producerHarness();
    const invalidDatabase = new FakeDatabase([
      {
        table: 'experiences',
        operation: 'select',
        result: success(mediaRow({ photos: [OLD_PHOTO, NEW_PHOTO] })),
      },
    ]);
    const invalidResponse = await handleAdminExperiencePhotoReorder(
      request('PATCH', { expectedPhotos: [OLD_PHOTO, NEW_PHOTO], photos: [OLD_PHOTO, 'different.jpg'] }),
      { params: Promise.resolve({ id: '42' }) },
      common(invalidDatabase, invalidProducer)
    );
    expect(invalidResponse.status).toBe(400);
    expect(invalidProducer.sendAttempts).toBe(0);
    invalidDatabase.assertExhausted();

    const updateFailureProducer = producerHarness();
    const updateFailureDatabase = new FakeDatabase([
      {
        table: 'experiences',
        operation: 'select',
        result: success(mediaRow({ photos: [OLD_PHOTO, NEW_PHOTO] })),
      },
      { table: 'experiences', operation: 'update', result: failure('photo update failed') },
    ]);
    const updateFailureResponse = await handleAdminExperiencePhotoReorder(
      request('PATCH', { expectedPhotos: [OLD_PHOTO, NEW_PHOTO], photos: [NEW_PHOTO, OLD_PHOTO] }),
      { params: Promise.resolve({ id: '42' }) },
      common(updateFailureDatabase, updateFailureProducer)
    );
    expect(updateFailureResponse.status).toBe(500);
    expect(await responseBody(updateFailureResponse)).toEqual({
      success: false,
      error: 'Internal Server Error',
    });
    expect(updateFailureProducer.sendAttempts).toBe(0);
    updateFailureDatabase.assertExhausted();

    const conflictProducer = producerHarness();
    const conflictDatabase = new FakeDatabase([
      {
        table: 'experiences',
        operation: 'select',
        result: success(mediaRow({ photos: [OLD_PHOTO, NEW_PHOTO] })),
      },
      { table: 'experiences', operation: 'update', result: success(null) },
    ]);
    const conflictResponse = await handleAdminExperiencePhotoReorder(
      request('PATCH', { expectedPhotos: [OLD_PHOTO, NEW_PHOTO], photos: [NEW_PHOTO, OLD_PHOTO] }),
      { params: Promise.resolve({ id: '42' }) },
      common(conflictDatabase, conflictProducer)
    );
    expect(conflictResponse.status).toBe(409);
    expect(await responseBody(conflictResponse)).toEqual({
      success: false,
      error: 'Photos changed. Refresh and try again.',
    });
    expect(conflictProducer.sendAttempts).toBe(0);
    conflictDatabase.assertExhausted();

    const successProducer = producerHarness();
    const successDatabase = new FakeDatabase([
      {
        table: 'experiences',
        operation: 'select',
        result: success(mediaRow({ photos: [OLD_PHOTO, NEW_PHOTO] })),
      },
      {
        table: 'experiences',
        operation: 'update',
        result: success(mediaRow({ photos: [NEW_PHOTO, OLD_PHOTO] })),
      },
    ]);
    const successResponse = await handleAdminExperiencePhotoReorder(
      request('PATCH', { expectedPhotos: [OLD_PHOTO, NEW_PHOTO], photos: [NEW_PHOTO, OLD_PHOTO] }),
      { params: Promise.resolve({ id: '42' }) },
      common(successDatabase, successProducer)
    );
    expect(successResponse.status).toBe(200);
    expect(await responseBody(successResponse)).toEqual({
      success: true,
      data: { id: 42, photos: [NEW_PHOTO, OLD_PHOTO] },
    });
    await successProducer.settle();
    expect(successProducer.sendAttempts).toBe(1);
    successDatabase.assertExhausted();
  });
});
