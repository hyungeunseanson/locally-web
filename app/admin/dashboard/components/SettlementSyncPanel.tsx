'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ChevronDown, ChevronUp, Clock3, Play, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

import type {
  SettlementSyncJobHealth,
  SettlementSyncStatusResponse,
  SettlementSyncTriggerDomain,
  SettlementSyncTriggerResponse,
} from '@/app/types/admin';
import { useToast } from '@/app/context/ToastContext';

type SettlementSyncPanelProps = {
  onSyncApplied?: () => Promise<void> | void;
  onExperiencePayoutGuardChange?: (guard: ExperiencePayoutGuard) => void;
};

type ActionResult = {
  tone: 'success' | 'error' | 'info';
  message: string;
};

type OperatorGuidance = {
  tone: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
};

type ExperiencePayoutGuard = {
  safe: boolean;
  tone: OperatorGuidance['tone'];
  title: string;
  message: string;
};

type CollapsedSummary = {
  tone: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
};

const INFRA_DISABLED_JOB_CARDS: SettlementSyncJobHealth[] = [
  {
    job_name: 'experience_completion_sync',
    health_state: 'failed',
    is_running: false,
    running_since: null,
    stale_running: false,
    last_heartbeat_at: null,
    last_success_at: null,
    last_failure_at: null,
    last_failure_message: null,
    last_processed_count: null,
    due_candidate_count: 0,
    oldest_due_at: null,
    lag_minutes: null,
  },
  {
    job_name: 'service_completion_sync',
    health_state: 'failed',
    is_running: false,
    running_since: null,
    stale_running: false,
    last_heartbeat_at: null,
    last_success_at: null,
    last_failure_at: null,
    last_failure_message: null,
    last_processed_count: null,
    due_candidate_count: 0,
    oldest_due_at: null,
    lag_minutes: null,
  },
];

function formatDateTime(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return format(date, 'yyyy.MM.dd HH:mm');
}

function formatLagMinutes(value: number | null) {
  if (value == null) return '-';
  if (value < 60) return `${value}분`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}

function getHealthMeta(state: SettlementSyncJobHealth['health_state']) {
  switch (state) {
    case 'healthy':
      return { label: '정상', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'delayed':
      return { label: '지연', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'failed':
      return { label: '실패', className: 'bg-red-50 text-red-700 border-red-200' };
    case 'running':
      return { label: '실행 중', className: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'running_stale':
      return { label: '실행 중 멈춤', className: 'bg-red-50 text-red-700 border-red-300' };
    default:
      return { label: state, className: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
}

function getJobLabel(jobName: SettlementSyncJobHealth['job_name']) {
  return jobName === 'experience_completion_sync' ? '체험 완료 동기화' : '서비스 완료 동기화';
}

function getResultTone(ok: boolean, outcome?: string): ActionResult['tone'] {
  if (!ok) return 'error';
  if (outcome === 'already_processed' || outcome === 'not_due' || outcome === 'no_candidates') {
    return 'info';
  }
  return 'success';
}

function getExperienceOperatorGuidance(
  experienceJob: SettlementSyncJobHealth | null,
  infraError: string | null
): OperatorGuidance | null {
  if (infraError) {
    return {
      tone: 'error',
      title: '정산 전 점검 필요',
      message: '목록 반영 상태를 확인할 수 없으니 점검이 끝날 때까지 정산을 잠시 보류하세요.',
    };
  }

  if (!experienceJob) return null;

  switch (experienceJob.health_state) {
    case 'healthy':
      return {
        tone: 'success',
        title: '목록 반영 정상',
        message: '아래 정산 대기 목록을 확인하고 실제 송금 후 정산 완료 처리하세요.',
      };
    case 'delayed':
      return {
        tone: 'warning',
        title: '최신 반영 확인 필요',
        message: '최근 완료 건 반영이 늦을 수 있습니다. 필요하면 지연 건 다시 확인을 실행한 뒤 진행하세요.',
      };
    case 'running':
      return {
        tone: 'info',
        title: '업데이트 실행 중',
        message: '지금은 목록을 갱신하는 중입니다. 완료 후 새로고침한 뒤 정산을 진행하세요.',
      };
    case 'running_stale':
    case 'failed':
      return {
        tone: 'error',
        title: '점검 후 진행',
        message: '지금은 목록이 덜 반영됐을 수 있습니다. 다시 확인하거나 점검이 끝난 뒤 정산을 진행하세요.',
      };
    default:
      return null;
  }
}

function getExperiencePayoutGuard(params: {
  experienceJob: SettlementSyncJobHealth | null;
  infraError: string | null;
  isLoading: boolean;
}): ExperiencePayoutGuard {
  if (params.infraError) {
    return {
      safe: false,
      tone: 'error',
      title: '정산 전 확인 필요',
      message: '지금은 목록이 덜 반영됐을 수 있으니 점검판을 먼저 열어 확인하세요.',
    };
  }

  if (params.isLoading && !params.experienceJob) {
    return {
      safe: false,
      tone: 'info',
      title: '정산 상태 확인 중',
      message: '잠시 후 다시 확인하거나 점검판을 열어 상태를 확인하세요.',
    };
  }

  if (!params.experienceJob) {
    return {
      safe: false,
      tone: 'error',
      title: '정산 전 확인 필요',
      message: '지금은 목록이 덜 반영됐을 수 있으니 점검판을 먼저 열어 확인하세요.',
    };
  }

  if (params.experienceJob.health_state === 'healthy') {
    return {
      safe: true,
      tone: 'success',
      title: '정산 진행 가능',
      message: '아래 정산 대기 목록에서 진행하시면 됩니다.',
    };
  }

  return {
    safe: false,
    tone: params.experienceJob.health_state === 'running' ? 'info' : params.experienceJob.health_state === 'delayed' ? 'warning' : 'error',
    title: '정산 전 확인 필요',
    message: '지금은 목록이 덜 반영됐을 수 있으니 점검판을 먼저 열어 확인하세요.',
  };
}

function getCollapsedSummary(params: {
  isLoading: boolean;
  infraError: string | null;
  experienceJob: SettlementSyncJobHealth | null;
  experiencePayoutGuard: ExperiencePayoutGuard;
}): CollapsedSummary {
  if (params.isLoading && !params.experienceJob && !params.infraError) {
    return {
      tone: 'info',
      title: '정산 상태를 확인하고 있습니다',
      message: '잠시 후 아래 정산 대기 목록을 확인하거나, 필요하면 점검판을 열어 상태를 확인하세요.',
    };
  }

  if (params.experiencePayoutGuard.safe) {
    return {
      tone: 'success',
      title: '정산 진행 가능',
      message: '보통은 아래 정산 대기 목록에서 바로 처리하시면 됩니다.',
    };
  }

  if (params.experienceJob?.health_state === 'running') {
    return {
      tone: 'info',
      title: '목록 업데이트 중',
      message: '최근 완료 건을 반영하는 중일 수 있습니다. 필요할 때만 점검판을 열어 확인하세요.',
    };
  }

  if (params.experienceJob?.health_state === 'delayed') {
    return {
      tone: 'warning',
      title: '최신 반영 확인 필요',
      message: '최근 완료 건 반영이 늦을 수 있습니다. 문제가 있을 때만 점검판을 열어 확인하세요.',
    };
  }

  return {
    tone: params.infraError ? 'error' : params.experiencePayoutGuard.tone,
    title: '정산 전 확인 필요',
    message: '지금은 목록이 덜 반영됐을 수 있으니, 문제가 있을 때만 점검판을 열어 확인하세요.',
  };
}

export default function SettlementSyncPanel({
  onSyncApplied,
  onExperiencePayoutGuardChange,
}: SettlementSyncPanelProps) {
  const { showToast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState<SettlementSyncStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [infraError, setInfraError] = useState<string | null>(null);
  const [forceDomain, setForceDomain] = useState<SettlementSyncTriggerDomain>('auto');
  const [identifier, setIdentifier] = useState('');

  const loadStatus = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/settlement-sync', {
        method: 'GET',
        signal,
      });
      const payload = (await response.json()) as SettlementSyncStatusResponse & { error?: string };

      if (!response.ok || !payload.success) {
        if (response.status === 503) {
          const message =
            payload.error ||
            '정산 동기화 인프라를 사용할 수 없습니다. 마이그레이션 또는 RPC 상태를 확인하세요.';
          if (!signal?.aborted) {
            setStatus(null);
            setInfraError(message);
            setResult({ tone: 'error', message });
          }
          return;
        }

        throw new Error(payload.error || '동기화 상태를 불러오지 못했습니다.');
      }

      if (!signal?.aborted) {
        setStatus(payload);
        setInfraError(null);
      }
    } catch (error) {
      if (signal?.aborted) return;
      const message = error instanceof Error ? error.message : '동기화 상태를 불러오지 못했습니다.';
      setResult({ tone: 'error', message });
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadStatus(controller.signal);
    return () => controller.abort();
  }, [loadStatus]);

  const jobs = useMemo(() => {
    if (status?.jobs?.length) return status.jobs;
    if (infraError) return INFRA_DISABLED_JOB_CARDS;
    return [] as SettlementSyncJobHealth[];
  }, [infraError, status]);

  const experienceJob = useMemo(
    () => jobs.find((job) => job.job_name === 'experience_completion_sync') || null,
    [jobs]
  );

  const experienceOperatorGuidance = useMemo(
    () => getExperienceOperatorGuidance(experienceJob, infraError),
    [experienceJob, infraError]
  );
  const experiencePayoutGuard = useMemo(
    () =>
      getExperiencePayoutGuard({
        experienceJob,
        infraError,
        isLoading,
      }),
    [experienceJob, infraError, isLoading]
  );
  const collapsedSummary = useMemo(
    () =>
      getCollapsedSummary({
        isLoading,
        infraError,
        experienceJob,
        experiencePayoutGuard,
      }),
    [experienceJob, experiencePayoutGuard, infraError, isLoading]
  );

  useEffect(() => {
    onExperiencePayoutGuardChange?.(experiencePayoutGuard);
  }, [experiencePayoutGuard, onExperiencePayoutGuardChange]);

  const executeTrigger = useCallback(
    async (body: Record<string, unknown>) => {
      setIsSubmitting(true);

      try {
        const response = await fetch('/api/admin/settlement-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = (await response.json()) as SettlementSyncTriggerResponse & {
          error?: string;
          outcome?: string;
        };

        if (!response.ok || !payload.success) {
          const message = payload.error || '정산 완료 동기화 실행에 실패했습니다.';
          if (response.status === 503) {
            setInfraError(message);
          }
          setResult({ tone: 'error', message });
          showToast(message, 'error');
          return;
        }

        const actionResult = {
          tone: getResultTone(true, payload.outcome),
          message: payload.message,
        } satisfies ActionResult;

        setResult(actionResult);
        showToast(payload.message, actionResult.tone === 'error' ? 'error' : 'success');
        await Promise.all([loadStatus(), Promise.resolve(onSyncApplied?.())]);
      } catch (error) {
        const message = error instanceof Error ? error.message : '정산 완료 동기화 실행에 실패했습니다.';
        setResult({ tone: 'error', message });
        showToast(message, 'error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadStatus, onSyncApplied, showToast]
  );

  const handleRunDue = (domain: Extract<SettlementSyncTriggerDomain, 'experience' | 'service'>) => {
    void executeTrigger({
      mode: 'run_due',
      domain,
    });
  };

  const handleForceSync = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = identifier.trim();
    if (!trimmed) {
      setResult({ tone: 'error', message: 'booking_id 또는 order_id를 입력해 주세요.' });
      return;
    }

    await executeTrigger({
      mode: 'force_one',
      domain: forceDomain,
      identifier: trimmed,
    });
  };

  return (
    <section
      data-testid="settlement-sync-panel"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-900 md:text-xl">
            <Activity className="h-5 w-5 text-slate-700" />
            정산 전 점검
          </h3>
          <p className="text-xs text-slate-500 md:text-sm">
            보통은 아래 정산 대기 목록에서 바로 처리하시면 됩니다. 문제가 있을 때만 열어 확인하세요.
          </p>
        </div>
        <button
          type="button"
          data-testid="settlement-sync-toggle"
          onClick={() => setIsExpanded((current) => !current)}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {isExpanded ? '점검판 닫기' : '점검판 열기'}
        </button>
      </div>

      <div
        data-testid="settlement-sync-summary"
        className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
          collapsedSummary.tone === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : collapsedSummary.tone === 'info'
              ? 'border-blue-200 bg-blue-50 text-blue-700'
              : collapsedSummary.tone === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-red-200 bg-red-50 text-red-700'
        }`}
      >
        <p className="font-semibold">{collapsedSummary.title}</p>
        <p className="mt-1">{collapsedSummary.message}</p>
      </div>

      {isExpanded ? (
        <div data-testid="settlement-sync-details" className="mt-4 border-t border-slate-100 pt-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h4 className="text-sm font-black text-slate-900 md:text-base">고급 점검</h4>
              <p className="text-xs text-slate-500 md:text-sm">
                목록 반영이 이상하거나 정산 전에 다시 확인이 필요할 때만 사용하세요.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadStatus()}
              disabled={isLoading || isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
          </div>

          {result ? (
            <div
              data-testid="settlement-sync-result-banner"
              className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                result.tone === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : result.tone === 'info'
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {result.message}
            </div>
          ) : null}

          {infraError ? (
            <div
              data-testid="settlement-sync-infra-banner"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {infraError}
            </div>
          ) : null}

          {experienceOperatorGuidance ? (
            <div
              data-testid="settlement-sync-operator-banner"
              className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                experienceOperatorGuidance.tone === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : experienceOperatorGuidance.tone === 'info'
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : experienceOperatorGuidance.tone === 'warning'
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              <p className="font-semibold">{experienceOperatorGuidance.title}</p>
              <p className="mt-1">{experienceOperatorGuidance.message}</p>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(isLoading && !status ? [0, 1] : jobs).map((job, index) => {
              if (typeof job === 'number') {
                return (
                  <div
                    key={job}
                    className="animate-pulse rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    data-testid={index === 0 ? 'settlement-sync-card-experience-skeleton' : 'settlement-sync-card-service-skeleton'}
                  >
                    <div className="h-5 w-28 rounded bg-slate-200" />
                    <div className="mt-4 h-4 w-36 rounded bg-slate-200" />
                    <div className="mt-2 h-4 w-48 rounded bg-slate-200" />
                    <div className="mt-2 h-4 w-40 rounded bg-slate-200" />
                    <div className="mt-4 h-10 w-full rounded-full bg-slate-200" />
                  </div>
                );
              }

              const meta = getHealthMeta(job.health_state);
              const domain = job.job_name === 'experience_completion_sync' ? 'experience' : 'service';

              return (
                <div
                  key={job.job_name}
                  data-testid={`settlement-sync-card-${domain}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black text-slate-900">{getJobLabel(job.job_name)}</h4>
                      <p className="mt-1 text-xs text-slate-500">지연 건수와 최근 실행 이력을 함께 보여줍니다.</p>
                    </div>
                    <span
                      data-testid={`settlement-sync-state-${domain}`}
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                  </div>

                  <dl className="mt-4 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        마지막 성공
                      </dt>
                      <dd>{formatDateTime(job.last_success_at)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt>마지막 실패</dt>
                      <dd>{formatDateTime(job.last_failure_at)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt>마지막 heartbeat</dt>
                      <dd>{formatDateTime(job.last_heartbeat_at)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt>지연 건수</dt>
                      <dd data-testid={`settlement-sync-due-count-${domain}`}>{job.due_candidate_count}건</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt>최대 지연</dt>
                      <dd>{formatLagMinutes(job.lag_minutes)}</dd>
                    </div>
                    {job.last_failure_message ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                        {job.last_failure_message}
                      </div>
                    ) : null}
                  </dl>

                  <button
                    type="button"
                    data-testid={`settlement-sync-run-due-${domain}`}
                    onClick={() => handleRunDue(domain)}
                    disabled={isSubmitting || Boolean(infraError) || (job.is_running && !job.stale_running)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Play className="h-4 w-4" />
                    지연 건 지금 실행
                  </button>
                </div>
              );
            })}
          </div>

          <form
            data-testid="settlement-sync-force-form"
            onSubmit={handleForceSync}
            className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
              <div>
                <h4 className="text-sm font-black text-slate-900">개별 건 다시 반영</h4>
                <p className="text-xs text-slate-500">
                  이미 완료 시점이 지난 예약만 즉시 다시 반영합니다. 미래 일정은 강제로 완료하지 않습니다.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_140px]">
              <select
                data-testid="settlement-sync-force-domain"
                value={forceDomain}
                onChange={(event) => setForceDomain(event.target.value as SettlementSyncTriggerDomain)}
                disabled={Boolean(infraError)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option value="auto">자동 감지 (권장)</option>
                <option value="experience">체험</option>
                <option value="service">서비스</option>
              </select>

              <input
                data-testid="settlement-sync-force-identifier"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                disabled={Boolean(infraError)}
                placeholder="booking_id 또는 order_id"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400"
              />

              <button
                type="submit"
                data-testid="settlement-sync-force-submit"
                disabled={isSubmitting || Boolean(infraError)}
                className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                즉시 반영
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
