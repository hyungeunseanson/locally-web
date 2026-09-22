export type LocallyScheduledTaskName =
  | 'experience_translation_recovery'
  | 'home_popularity_snapshot'
  | 'admin_support_unread_alerts'
  | 'notification_retention_cleanup'
  | 'experience_completion_sync'
  | 'service_completion_sync'
  | 'cancel_pending_bookings';

type ScheduledControllerLike = { cron: string };
type ScheduledHandler<Environment> = (
  controller: ScheduledControllerLike,
  environment: Environment
) => Promise<unknown> | unknown;

type ScheduledOptions<Environment> = {
  dailyCron: string;
  adminSupportCron: string;
  notificationRetentionCron: string;
  experienceCompletionCron: string;
  cancelPendingCron?: string;
  runTranslationRecovery: ScheduledHandler<Environment>;
  runHomePopularitySnapshot: ScheduledHandler<Environment>;
  runAdminSupportUnreadAlerts: ScheduledHandler<Environment>;
  runNotificationRetentionCleanup: ScheduledHandler<Environment>;
  runExperienceCompletionSync: ScheduledHandler<Environment>;
  runServiceCompletionSync: ScheduledHandler<Environment>;
  runCancelPendingBookings?: ScheduledHandler<Environment>;
  delegate?: ScheduledHandler<Environment>;
  log?: (entry: Record<string, unknown>) => void;
};

function safeLog(
  log: ScheduledOptions<unknown>['log'],
  entry: Record<string, unknown>
) {
  try {
    (log ?? ((record) => console.log(JSON.stringify(record))))(entry);
  } catch {
    // Logging cannot prevent either scheduled task from running.
  }
}

export async function handleLocallyScheduledEvent<Environment>(
  controller: ScheduledControllerLike,
  environment: Environment,
  options: ScheduledOptions<Environment>
) {
  if (
    controller.cron !== options.dailyCron &&
    controller.cron !== options.adminSupportCron &&
    controller.cron !== options.notificationRetentionCron &&
    controller.cron !== options.experienceCompletionCron &&
    controller.cron !== options.cancelPendingCron
  ) {
    if (options.delegate) return options.delegate(controller, environment);
    throw new Error('locally_unexpected_scheduled_trigger');
  }

  const tasks: Array<{
    name: LocallyScheduledTaskName;
    run: ScheduledHandler<Environment>;
  }> = controller.cron === options.dailyCron ? [
    {
      name: 'experience_translation_recovery',
      run: options.runTranslationRecovery,
    },
    {
      name: 'home_popularity_snapshot',
      run: options.runHomePopularitySnapshot,
    },
  ] : controller.cron === options.adminSupportCron ? [
    {
      name: 'admin_support_unread_alerts',
      run: options.runAdminSupportUnreadAlerts,
    },
  ] : controller.cron === options.notificationRetentionCron ? [
    {
      name: 'notification_retention_cleanup',
      run: options.runNotificationRetentionCleanup,
    },
  ] : controller.cron === options.cancelPendingCron ? [
    {
      name: 'cancel_pending_bookings',
      run: options.runCancelPendingBookings!,
    },
  ] : [
    {
      name: 'experience_completion_sync',
      run: options.runExperienceCompletionSync,
    },
    {
      name: 'service_completion_sync',
      run: options.runServiceCompletionSync,
    },
  ];
  const results = await Promise.allSettled(
    tasks.map(({ run }) => Promise.resolve().then(() => run(controller, environment)))
  );
  const failedTasks: LocallyScheduledTaskName[] = [];
  for (let index = 0; index < tasks.length; index += 1) {
    const result = results[index];
    const name = tasks[index].name;
    if (result.status === 'rejected') failedTasks.push(name);
    safeLog(options.log, {
      event: 'locally_scheduled_task_outcome',
      task: name,
      status: result.status === 'fulfilled' ? 'completed' : 'failed',
      diagnosticCode: result.status === 'fulfilled'
        ? 'scheduled_task_completed'
        : 'scheduled_task_failed',
    });
  }
  if (failedTasks.length > 0) {
    throw new Error('locally_scheduled_task_failed');
  }
  return { status: 'completed', taskCount: tasks.length } as const;
}
