import { ADMIN_SUPPORT_UNREAD_ALERTS_CRON } from '@/app/utils/adminSupportUnreadAlertsScheduled';
import {
  createOpsAnomalyMonitorScheduledClient,
  type OpsAnomalyMonitorScheduledRuntimeEnv,
} from '@/app/utils/opsAnomalyMonitorScheduled';
import { runNicePayRecoveryBatch } from './nicepayRecovery';

export async function handleNicePayRecoveryScheduled(
  controller: { cron: string },
  environment: OpsAnomalyMonitorScheduledRuntimeEnv & { NICEPAY_RECOVERY_SCHEDULED_ENABLED?: string }
) {
  if (controller.cron !== ADMIN_SUPPORT_UNREAD_ALERTS_CRON ||
      environment.CLOUDFLARE_DEPLOYMENT_ENV !== 'production' ||
      environment.NICEPAY_RECOVERY_SCHEDULED_ENABLED !== 'true') {
    return { status: 'disabled' } as const;
  }
  const client = createOpsAnomalyMonitorScheduledClient(environment);
  const result = await runNicePayRecoveryBatch({ client });
  if (result.failed > 0) throw new Error('nicepay_recovery_batch_failed');
  return { status: 'completed', ...result } as const;
}
