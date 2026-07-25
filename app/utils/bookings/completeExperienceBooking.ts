import type { SupabaseClient } from '@supabase/supabase-js';

import { SettlementSyncInfrastructureError } from '@/app/utils/settlementSync/types';

type CompletionRpcRow = {
  booking_id?: unknown;
  order_id?: unknown;
  user_id?: unknown;
  already_processed?: unknown;
  not_due?: unknown;
  completed?: unknown;
  notification_created?: unknown;
};

export type ExperienceBookingCompletionResult = {
  bookingId: string;
  orderId: string | null;
  userId: string | null;
  alreadyProcessed: boolean;
  notDue: boolean;
  completed: boolean;
  notificationCreated: boolean;
};

export type ExperienceBookingCompletionFailure = {
  bookingId: string;
  error: unknown;
};

export type ExperienceBookingCompletionBatchResult = {
  results: ExperienceBookingCompletionResult[];
  failures: ExperienceBookingCompletionFailure[];
};

function isMissingCompletionRpcError(
  error: {
    code?: string | null;
    message?: string | null;
    details?: string | null;
    hint?: string | null;
  } | null
) {
  if (!error) return false;

  const message = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  return (
    error.code === 'PGRST202' ||
    (message.includes('complete_experience_booking_if_due_atomic') &&
      (message.includes('Could not find the function') ||
        message.includes('No function matches') ||
        message.includes('does not exist')))
  );
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function completeExperienceBookingIfDueAtomic(
  supabaseAdmin: SupabaseClient,
  bookingId: string
): Promise<ExperienceBookingCompletionResult> {
  const { data, error } = await supabaseAdmin.rpc(
    'complete_experience_booking_if_due_atomic',
    { p_booking_id: bookingId }
  );

  if (error) {
    if (isMissingCompletionRpcError(error)) {
      throw new SettlementSyncInfrastructureError();
    }
    throw error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as CompletionRpcRow | null;
  const normalizedBookingId = readString(row?.booking_id);
  if (!row || !normalizedBookingId) {
    throw new Error('체험 완료 RPC가 유효한 결과를 반환하지 않았습니다.');
  }

  return {
    bookingId: normalizedBookingId,
    orderId: readString(row.order_id),
    userId: readString(row.user_id),
    alreadyProcessed: row.already_processed === true,
    notDue: row.not_due === true,
    completed: row.completed === true,
    notificationCreated: row.notification_created === true,
  };
}

export async function completeExperienceBookingsIfDueAtomic(
  supabaseAdmin: SupabaseClient,
  bookingIds: string[]
): Promise<ExperienceBookingCompletionBatchResult> {
  const settledResults = await Promise.allSettled(
    bookingIds.map((bookingId) =>
      completeExperienceBookingIfDueAtomic(supabaseAdmin, bookingId)
    )
  );
  const results: ExperienceBookingCompletionResult[] = [];
  const failures: ExperienceBookingCompletionFailure[] = [];

  settledResults.forEach((settledResult, index) => {
    if (settledResult.status === 'fulfilled') {
      results.push(settledResult.value);
      return;
    }

    failures.push({
      bookingId: bookingIds[index],
      error: settledResult.reason,
    });
  });

  return { results, failures };
}
