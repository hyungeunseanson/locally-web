export type LocallyScheduledTaskName =
  | 'experience_translation_recovery'
  | 'home_popularity_snapshot'
  | 'admin_support_unread_alerts';

type ScheduledControllerLike = { cron: string };
type ScheduledHandler<Environment> = (
  controller: ScheduledControllerLike,
  environment: Environment
) => Promise<unknown> | unknown;

type ScheduledOptions<Environment> = {
  dailyCron: string;
  adminSupportCron: string;
  runTranslationRecovery: ScheduledHandler<Environment>;
  runHomePopularitySnapshot: ScheduledHandler<Environment>;
  runAdminSupportUnreadAlerts: ScheduledHandler<Environment>;
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
    controller.cron !== options.adminSupportCron
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
  ] : [
    {
      name: 'admin_support_unread_alerts',
      run: options.runAdminSupportUnreadAlerts,
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
