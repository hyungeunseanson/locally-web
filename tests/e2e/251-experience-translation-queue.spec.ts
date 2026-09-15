import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { executeExperienceTranslationCron } from '../../app/api/cron/experience-translations/route';
import { scheduleExperienceTranslationWake } from '../../app/utils/experienceTranslation/queueProducer';
import { createExperienceTranslationQueueMessage, parseExperienceTranslationQueueMessage, EXPERIENCE_TRANSLATION_MAX_HOP, EXPERIENCE_TRANSLATION_QUEUE_NAME } from '../../app/utils/experienceTranslation/queueMessage';
import { handleExperienceTranslationQueueBatch } from '../../app/utils/experienceTranslation/queueConsumer';
import { EXPERIENCE_TRANSLATION_RECOVERY_CRON, handleExperienceTranslationScheduledRecovery } from '../../app/utils/experienceTranslation/scheduledRecovery';
import { ExperienceTranslationInfrastructureError, createExperienceTranslationWorkerDependencies, runExperienceTranslationWorker, type ExperienceTranslationLeasedTask, type ExperienceTranslationWorkerDependencies, type ExperienceTranslationWorkerRepository } from '../../app/utils/experienceTranslation/worker';
import { TranslationProviderError } from '../../app/utils/experienceTranslation/providers';

const task = (id = 'task_0001'): ExperienceTranslationLeasedTask => ({ id, job_id: 'job_0001', experience_id: 3309, translation_version: 2, source_locale: 'ko', target_locale: 'en', provider: 'gemini', attempt_count: 0, priority: 100, lease_expires_at: new Date(Date.now() + 60_000).toISOString() });
function dependencies(tasks: ExperienceTranslationLeasedTask[] = [task()]): ExperienceTranslationWorkerDependencies & { events: string[]; calls: number } {
  const events: string[] = [];
  let calls = 0;
  const repository: ExperienceTranslationWorkerRepository = {
    async leaseNextTask(provider) { const index = tasks.findIndex((candidate) => candidate.provider === provider); if (index < 0) return null; events.push('lease'); return tasks.splice(index, 1)[0]; },
    async fetchExperience() { return { id: 3309, source_locale: 'ko', translation_version: 2, title: 'source title', description: 'source description', manual_locales: [], translation_meta: {} }; },
    async getProviderModel() { return 'fixture-model'; },
    async markTaskProcessing() { events.push('processing'); },
    async markTaskCancelled() { events.push('cancelled'); },
    async markTaskCompleted() { events.push('completed'); },
    async markTaskRetryable() { events.push('retryable'); },
    async markTaskFailed() { events.push('failed'); },
    async applyExperienceTranslation() { events.push('update'); return true; },
    async recordProviderOutcome() { events.push('provider-state'); },
  };
  return {
    repository,
    config: { batchSize: 4, leaseSeconds: 180, maxAttempts: 4, reservedTokens: { gemini: 3500, grok: 3500 }, models: { gemini: undefined, grok: undefined }, hasGrokCredential: false },
    async translateGemini() { calls += 1; return { title: 'translated', description: 'translated', meetingPoint: '', supplies: '', inclusions: [], exclusions: [], itinerary: [], rules: { age_limit: '', activity_level: '', refund_policy: '', host_notice: '' }, totalTokens: 12 }; },
    async translateGrok() { throw new Error('unexpected'); },
    events,
    get calls() { return calls; },
  };
}

function queueMessage(body: unknown, attempts = 1) { let acked = 0; let retried = 0; return { body, attempts, ack() { acked += 1; }, retry() { retried += 1; }, get acked() { return acked; }, get retried() { return retried; } }; }

test.describe('experience translation Queue wake transport', () => {
  test('message contains only bounded wake metadata', () => {
    const message = createExperienceTranslationQueueMessage('job-created', 0, 'event_0001');
    expect(parseExperienceTranslationQueueMessage(message)).toEqual(message);
    expect(Object.keys(message).sort()).toEqual(['eventId', 'hop', 'reason', 'schema', 'version']);
    expect(parseExperienceTranslationQueueMessage({ ...message, title: 'private source' })).toBeNull();
  });

  test('shared worker leases PostgreSQL truth and preserves completion semantics', async () => {
    const deps = dependencies();
    await expect(runExperienceTranslationWorker(deps)).resolves.toMatchObject({ processed: 1, completed: 1, providerCalls: { gemini: 1, grok: 0 } });
    expect(deps.events).toEqual(['lease', 'processing', 'update', 'completed', 'provider-state']);
  });

  test('stale versions cancel without provider work and retryable provider state remains in PostgreSQL', async () => {
    const stale = dependencies();
    stale.repository.fetchExperience = async () => ({ id: 3309, source_locale: 'ko', translation_version: 3, title: 'source', description: 'source' });
    await expect(runExperienceTranslationWorker(stale)).resolves.toMatchObject({ processed: 1, cancelled: 1, providerCalls: { gemini: 0, grok: 0 } });
    expect(stale.calls).toBe(0);

    const retryable = dependencies();
    retryable.translateGemini = async () => { throw new TranslationProviderError({ provider: 'gemini', message: 'private provider body', retryable: true, cooldownSeconds: 30 }); };
    await expect(runExperienceTranslationWorker(retryable)).resolves.toMatchObject({ processed: 1, retried: 1, failed: 0 });
    expect(retryable.events).toContain('retryable');
  });

  test('Gemini fallback changes only PostgreSQL task state and permanent provider failure is recorded', async () => {
    const fallback = dependencies();
    fallback.config.hasGrokCredential = true;
    let retryProvider = '';
    fallback.repository.markTaskRetryable = async (_task, provider) => { retryProvider = provider; };
    fallback.translateGemini = async () => { throw new TranslationProviderError({ provider: 'gemini', message: 'bounded failure', retryable: true }); };
    await expect(runExperienceTranslationWorker(fallback)).resolves.toMatchObject({ processed: 1, retried: 1, providerCalls: { gemini: 1, grok: 0 } });
    expect(retryProvider).toBe('grok');

    const permanent = dependencies();
    permanent.translateGemini = async () => { throw new TranslationProviderError({ provider: 'gemini', message: 'bounded failure', retryable: false }); };
    await expect(runExperienceTranslationWorker(permanent)).resolves.toMatchObject({ processed: 1, failed: 1, retried: 0 });
    expect(permanent.events).toContain('failed');
  });

  test('manual locale protection preserves localized title/description writes', async () => {
    const deps = dependencies();
    deps.repository.fetchExperience = async () => ({ id: 3309, source_locale: 'ko', translation_version: 2, title: 'source', description: 'source', manual_locales: ['en'] });
    let payload: Record<string, unknown> = {};
    deps.repository.applyExperienceTranslation = async (_task, next) => { payload = next; return true; };
    await runExperienceTranslationWorker(deps);
    expect(payload).not.toHaveProperty('title_en');
    expect(payload).not.toHaveProperty('description_en');
    expect(payload.translation_meta).toMatchObject({ en: { mode: 'manual', status: 'ready', version: 2 } });
  });

  test('duplicate wakes cannot double-process an atomically leased task', async () => {
    const deps = dependencies();
    const first = queueMessage(createExperienceTranslationQueueMessage('job-created', 0, 'event_0001'));
    const second = queueMessage(createExperienceTranslationQueueMessage('job-created', 0, 'event_0002'));
    const options = { createDependencies: () => deps, createEventId: () => 'continuation_0001', log: () => undefined };
    await Promise.all([
      handleExperienceTranslationQueueBatch({ queue: EXPERIENCE_TRANSLATION_QUEUE_NAME, messages: [first] }, { CLOUDFLARE_DEPLOYMENT_ENV: 'production' }, options),
      handleExperienceTranslationQueueBatch({ queue: EXPERIENCE_TRANSLATION_QUEUE_NAME, messages: [second] }, { CLOUDFLARE_DEPLOYMENT_ENV: 'production' }, options),
    ]);
    expect(deps.calls).toBe(1);
    expect(first.acked + second.acked).toBe(2);
  });

  test('cold runtime injects its fetch and credentials into the actual Supabase adapter', async () => {
    const requests: string[] = [];
    const runtimeDependencies = createExperienceTranslationWorkerDependencies({
      NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'fixture-service-role',
      GEMINI_API_KEY: 'fixture-gemini-key',
    }, {
      explicitCredentials: true,
      fetch: async (input) => {
        requests.push(String(input));
        return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
      },
    });
    await expect(runExperienceTranslationWorker(runtimeDependencies)).resolves.toMatchObject({ processed: 0 });
    expect(requests).toHaveLength(2);
    expect(requests.every((url) => url.includes('/rest/v1/rpc/lease_experience_translation_task'))).toBe(true);
  });

  test('manual canary processes at most one task and empty drain acks', async () => {
    const deps = dependencies([task('task_0001'), task('task_0002')]);
    const message = queueMessage(createExperienceTranslationQueueMessage('manual-canary', 0, 'manual_0001'));
    await handleExperienceTranslationQueueBatch({ queue: EXPERIENCE_TRANSLATION_QUEUE_NAME, messages: [message] }, { CLOUDFLARE_DEPLOYMENT_ENV: 'production' }, { createDependencies: () => deps, log: () => undefined });
    expect(deps.calls).toBe(1); expect(message.acked).toBe(1);
    const empty = queueMessage(createExperienceTranslationQueueMessage('manual-canary', 0, 'manual_0002'));
    await handleExperienceTranslationQueueBatch({ queue: EXPERIENCE_TRANSLATION_QUEUE_NAME, messages: [empty] }, { CLOUDFLARE_DEPLOYMENT_ENV: 'production' }, { createDependencies: () => dependencies([]), log: () => undefined });
    expect(empty.acked).toBe(1);
  });

  test('transient infrastructure and invalid messages retry instead of being acked', async () => {
    const logs: Record<string, unknown>[] = [];
    const transport = queueMessage(createExperienceTranslationQueueMessage('job-created', 0, 'event_0003'));
    await handleExperienceTranslationQueueBatch({ queue: EXPERIENCE_TRANSLATION_QUEUE_NAME, messages: [transport] }, { CLOUDFLARE_DEPLOYMENT_ENV: 'production' }, { createDependencies: () => { throw new ExperienceTranslationInfrastructureError('lease', 'lease_rpc_failed'); }, log: () => undefined });
    expect(transport.retried).toBe(1); expect(transport.acked).toBe(0);
    const invalid = queueMessage({ title: 'private translation source', credential: 'private-token' });
    await handleExperienceTranslationQueueBatch({ queue: EXPERIENCE_TRANSLATION_QUEUE_NAME, messages: [invalid] }, { CLOUDFLARE_DEPLOYMENT_ENV: 'production' }, { log: (entry) => logs.push(entry) });
    expect(invalid.retried).toBe(1);
    expect(JSON.stringify(logs)).not.toContain('private translation source');
    expect(JSON.stringify(logs)).not.toContain('private-token');
  });

  test('continuation is bounded and never emitted for manual canary', async () => {
    const sent: unknown[] = [];
    for (const hop of [0, EXPERIENCE_TRANSLATION_MAX_HOP]) {
      const message = queueMessage(createExperienceTranslationQueueMessage('continuation', hop, `continuation_${hop}000000`));
      const deps = dependencies([task()]);
      deps.config.batchSize = 1;
      await handleExperienceTranslationQueueBatch({ queue: EXPERIENCE_TRANSLATION_QUEUE_NAME, messages: [message] }, { CLOUDFLARE_DEPLOYMENT_ENV: 'production', EXPERIENCE_TRANSLATION_QUEUE_ENABLED: 'true', EXPERIENCE_TRANSLATION_QUEUE: { async send(body) { sent.push(body); } } }, { createDependencies: () => deps, log: () => undefined });
    }
    expect(sent).toHaveLength(1);
  });

  test('producer is default-off and isolates send rejection after DB work', async () => {
    const tracked: Promise<unknown>[] = [];
    expect(scheduleExperienceTranslationWake({ loadRuntime: () => ({ env: { CLOUDFLARE_DEPLOYMENT_ENV: 'production', EXPERIENCE_TRANSLATION_QUEUE_ENABLED: 'false' }, ctx: { waitUntil: (promise) => tracked.push(promise) } }) }).status).toBe('disabled');
    const result = scheduleExperienceTranslationWake({ loadRuntime: () => ({ env: { CLOUDFLARE_DEPLOYMENT_ENV: 'production', EXPERIENCE_TRANSLATION_QUEUE_ENABLED: 'true', EXPERIENCE_TRANSLATION_QUEUE: { async send() { throw new Error('private provider body'); } } }, ctx: { waitUntil: (promise) => tracked.push(promise) } }), createEventId: () => 'producer_0001', log: () => { throw new Error('logger'); } });
    expect(result.status).toBe('scheduled');
    if (result.status === 'scheduled') await expect(result.completion).resolves.toEqual({ status: 'enqueue_failed', diagnosticCode: 'queue_send_failed' });
    let sendAttempts = 0;
    expect(scheduleExperienceTranslationWake({ loadRuntime: () => ({ env: { CLOUDFLARE_DEPLOYMENT_ENV: 'production', EXPERIENCE_TRANSLATION_QUEUE_ENABLED: 'true', EXPERIENCE_TRANSLATION_QUEUE: { async send() { sendAttempts += 1; } } }, ctx: { waitUntil() { throw new Error('context unavailable'); } } }) }).status).toBe('context_unavailable');
    expect(sendAttempts).toBe(0);
  });

  test('scheduled recovery sends exactly one wake only in enabled Production', async () => {
    const sent: unknown[] = [];
    const queue = { async send(message: unknown) { sent.push(message); } };
    await handleExperienceTranslationScheduledRecovery({ cron: EXPERIENCE_TRANSLATION_RECOVERY_CRON }, { CLOUDFLARE_DEPLOYMENT_ENV: 'production', EXPERIENCE_TRANSLATION_SCHEDULED_RECOVERY_ENABLED: 'true', EXPERIENCE_TRANSLATION_QUEUE: queue }, { createEventId: () => 'scheduled_0001', log: () => undefined });
    await handleExperienceTranslationScheduledRecovery({ cron: EXPERIENCE_TRANSLATION_RECOVERY_CRON }, { CLOUDFLARE_DEPLOYMENT_ENV: 'canary', EXPERIENCE_TRANSLATION_SCHEDULED_RECOVERY_ENABLED: 'true', EXPERIENCE_TRANSLATION_QUEUE: queue });
    await handleExperienceTranslationScheduledRecovery({ cron: EXPERIENCE_TRANSLATION_RECOVERY_CRON }, { CLOUDFLARE_DEPLOYMENT_ENV: 'production', EXPERIENCE_TRANSLATION_SCHEDULED_RECOVERY_ENABLED: 'false', EXPERIENCE_TRANSLATION_QUEUE: queue });
    expect(sent).toHaveLength(1);
  });

  test('HTTP cron keeps auth guard and response shape around the shared engine', async () => {
    const unauthorized = await executeExperienceTranslationCron(new NextRequest('https://example.test/api/cron/experience-translations'));
    expect(unauthorized.status).toBe(401);
    const prior = process.env.CRON_SECRET; process.env.CRON_SECRET = 'fixture-secret';
    try {
      const response = await executeExperienceTranslationCron(new NextRequest('https://example.test/api/cron/experience-translations', { headers: { authorization: 'Bearer fixture-secret' } }), dependencies([]));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ success: true, completed: 0, failed: 0, retried: 0, cancelled: 0, processed: 0 });
    } finally { if (prior === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = prior; }
  });

  test('GitHub keeps only the manual authenticated HTTP fallback after Cloudflare activation', () => {
    const workflow = readFileSync('.github/workflows/experience-translation-queue.yml', 'utf8');
    expect(workflow).toMatch(/\n\s*workflow_dispatch:\s*(?:\n|$)/);
    expect(workflow).not.toMatch(/\n\s*schedule:\s*(?:\n|$)/);
    expect(workflow).toContain('/api/cron/experience-translations');
    expect(workflow).toContain('-H "Authorization: Bearer ${CRON_SECRET}"');
    expect(workflow).toContain('group: experience-translation-queue');
    expect(workflow).toContain('cancel-in-progress: false');
  });
});
