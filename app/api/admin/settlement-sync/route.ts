import { NextResponse } from 'next/server';

import type {
  SettlementSyncTriggerDomain,
  SettlementSyncTriggerRequest,
  SettlementSyncTriggerResponse,
} from '@/app/types/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { forceExperienceCompletionSync, resolveExperienceCompletionTarget, runExperienceCompletionSync } from '@/app/utils/settlementSync/experienceCompletion';
import { getSettlementSyncHealthSnapshot } from '@/app/utils/settlementSync/health';
import { forceServiceCompletionSync, resolveServiceCompletionTarget, runServiceCompletionSync } from '@/app/utils/settlementSync/serviceCompletion';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

function parseTestDelayMs(request: Request) {
  if (process.env.NODE_ENV === 'production') return undefined;
  const raw = request.headers.get('x-locally-test-delay-settlement-sync-ms');
  const parsed = Number(raw || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function buildTriggerMessage(result: {
  outcome?: SettlementSyncTriggerResponse['outcome'];
  processedCount?: number;
  domain: SettlementSyncTriggerResponse['domain'];
}) {
  const domainLabel =
    result.domain === 'experience'
      ? '체험'
      : result.domain === 'service'
        ? '서비스'
        : '체험/서비스';

  switch (result.outcome) {
    case 'completed':
      return result.processedCount && result.processedCount > 0
        ? `${domainLabel} 완료 동기화를 ${result.processedCount}건 반영했습니다.`
        : '동기화가 이미 반영되어 있습니다.';
    case 'no_candidates':
      return '처리할 지연 건이 없습니다.';
    case 'already_processed':
      return '이미 완료 처리된 건입니다.';
    case 'not_due':
      return '아직 완료 시점 전이라 동기화할 수 없습니다.';
    case 'already_running':
      return '이미 실행 중인 동기화 작업이 있어 잠시 후 다시 시도해 주세요.';
    case 'ambiguous_target':
      return '입력한 식별자가 체험/서비스에 모두 매칭되어 도메인을 자동 판별할 수 없습니다.';
    default:
      return '정산 완료 동기화를 실행했습니다.';
  }
}

async function requireAdmin() {
  const supabaseServer = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabaseServer.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  const supabaseAdmin = createAdminClient();
  const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
    userId: user.id,
    email: user.email,
  });

  if (!isAdmin) {
    return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) };
  }

  return { user, supabaseAdmin };
}

async function recordManualTriggerAudit(params: {
  adminId: string;
  adminEmail?: string | null;
  actionType: 'ADMIN_SETTLEMENT_SYNC_RUN_DUE' | 'ADMIN_SETTLEMENT_SYNC_FORCE_ONE';
  targetId: string;
  details: Record<string, unknown>;
}) {
  await recordAuditLog({
    admin_id: params.adminId,
    admin_email: params.adminEmail,
    action_type: params.actionType,
    target_type: 'settlement_sync',
    target_id: params.targetId,
    details: params.details,
  });
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;

    const snapshot = await getSettlementSyncHealthSnapshot(auth.supabaseAdmin);

    return NextResponse.json({
      success: true,
      generated_at: snapshot.generatedAt,
      jobs: snapshot.jobs,
    });
  } catch (error: unknown) {
    console.error('[ADMIN] settlement-sync GET error:', error);
    const message = error instanceof Error ? error.message : '서버 오류가 발생했습니다.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;

    const body = (await request.json()) as SettlementSyncTriggerRequest;
    const testDelayMs = parseTestDelayMs(request);

    if (body.mode === 'run_due') {
      if (!body.domain || !['experience', 'service', 'all'].includes(body.domain)) {
        return NextResponse.json({ success: false, error: '유효한 동기화 도메인이 필요합니다.' }, { status: 400 });
      }

      const runOne = async (domain: Extract<SettlementSyncTriggerDomain, 'experience' | 'service'>) =>
        domain === 'experience'
          ? runExperienceCompletionSync({
              supabaseAdmin: auth.supabaseAdmin,
              triggerSource: 'manual_run_due',
              initiatedByAdminId: auth.user.id,
              testDelayMs,
            })
          : runServiceCompletionSync({
              supabaseAdmin: auth.supabaseAdmin,
              triggerSource: 'manual_run_due',
              initiatedByAdminId: auth.user.id,
              testDelayMs,
            });

      const domains =
        body.domain === 'all'
          ? (['experience', 'service'] as const)
          : ([body.domain] as const);

      const results = [];
      for (const domain of domains) {
        const result = await runOne(domain);
        results.push({ domain, result });
        if (!result.success) {
          await recordManualTriggerAudit({
            adminId: auth.user.id,
            adminEmail: auth.user.email,
            actionType: 'ADMIN_SETTLEMENT_SYNC_RUN_DUE',
            targetId: domain,
            details: {
              domain,
              outcome: result.outcome || 'failed',
              processed_count: result.processedCount || 0,
              skipped_count: result.skippedCount || 0,
              run_id: result.runId || null,
              error: result.error,
            },
          });

          return NextResponse.json(
            {
              success: false,
              error: result.error,
              outcome: result.outcome || 'already_running',
            },
            { status: result.status }
          );
        }
      }

      const processedCount = results.reduce((sum, item) => sum + item.result.processedCount, 0);
      const skippedCount = results.reduce((sum, item) => sum + item.result.skippedCount, 0);
      const runId = results[results.length - 1]?.result.runId || 0;
      const outcome =
        processedCount > 0
          ? 'completed'
          : results.some((item) => item.result.outcome === 'no_candidates')
            ? 'no_candidates'
            : 'completed';

      await recordManualTriggerAudit({
        adminId: auth.user.id,
        adminEmail: auth.user.email,
        actionType: 'ADMIN_SETTLEMENT_SYNC_RUN_DUE',
        targetId: body.domain,
        details: {
          domain: body.domain,
          outcome,
          processed_count: processedCount,
          skipped_count: skippedCount,
          run_ids: results.map((item) => item.result.runId),
        },
      });

      const response: SettlementSyncTriggerResponse = {
        success: true,
        mode: 'run_due',
        domain: body.domain,
        run_id: runId,
        outcome,
        processed_count: processedCount,
        skipped_count: skippedCount,
        message: buildTriggerMessage({ outcome, processedCount, domain: body.domain }),
      };

      return NextResponse.json(response);
    }

    if (body.mode !== 'force_one' || typeof body.identifier !== 'string' || !body.identifier.trim()) {
      return NextResponse.json({ success: false, error: '유효한 식별자가 필요합니다.' }, { status: 400 });
    }

    let resolvedDomain: Extract<SettlementSyncTriggerDomain, 'experience' | 'service'> | null = null;

    if (body.domain === 'experience' || body.domain === 'service') {
      resolvedDomain = body.domain;
    } else {
      const [experienceTarget, serviceTarget] = await Promise.all([
        resolveExperienceCompletionTarget(auth.supabaseAdmin, body.identifier),
        resolveServiceCompletionTarget(auth.supabaseAdmin, body.identifier),
      ]);

      if (experienceTarget && serviceTarget) {
        return NextResponse.json(
          {
            success: false,
            error: buildTriggerMessage({ outcome: 'ambiguous_target', domain: 'all' }),
            outcome: 'ambiguous_target',
          },
          { status: 409 }
        );
      }

      if (experienceTarget) resolvedDomain = 'experience';
      if (serviceTarget) resolvedDomain = 'service';
    }

    if (!resolvedDomain) {
      return NextResponse.json({ success: false, error: '일치하는 예약을 찾을 수 없습니다.' }, { status: 404 });
    }

    const result =
      resolvedDomain === 'experience'
        ? await forceExperienceCompletionSync({
            supabaseAdmin: auth.supabaseAdmin,
            triggerSource: 'manual_force_one',
            initiatedByAdminId: auth.user.id,
            identifier: body.identifier,
            testDelayMs,
          })
        : await forceServiceCompletionSync({
            supabaseAdmin: auth.supabaseAdmin,
            triggerSource: 'manual_force_one',
            initiatedByAdminId: auth.user.id,
            identifier: body.identifier,
            testDelayMs,
          });

    await recordManualTriggerAudit({
      adminId: auth.user.id,
      adminEmail: auth.user.email,
      actionType: 'ADMIN_SETTLEMENT_SYNC_FORCE_ONE',
      targetId: body.identifier.trim(),
      details: {
        domain: resolvedDomain,
        identifier: body.identifier.trim(),
        outcome: result.success ? result.outcome : result.outcome || 'failed',
        processed_count: result.processedCount || 0,
        skipped_count: result.skippedCount || 0,
        run_id: result.runId || null,
        target: result.target || null,
        error: result.success ? null : result.error,
      },
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          outcome: result.outcome || 'already_running',
          target: result.target,
        },
        { status: result.status }
      );
    }

    const response: SettlementSyncTriggerResponse = {
      success: true,
      mode: 'force_one',
      domain: resolvedDomain,
      run_id: result.runId,
      outcome: result.outcome,
      processed_count: result.processedCount,
      skipped_count: result.skippedCount,
      target: result.target,
      message: buildTriggerMessage({
        outcome: result.outcome,
        processedCount: result.processedCount,
        domain: resolvedDomain,
      }),
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('[ADMIN] settlement-sync POST error:', error);
    const message = error instanceof Error ? error.message : '서버 오류가 발생했습니다.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
