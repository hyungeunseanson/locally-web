import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';
import {
  SERVICE_BOOKING_ACTIVE_STATUSES,
  SERVICE_REQUEST_ACTIVE_STATUSES,
  SERVICE_REQUEST_COMPLETED_STATUSES,
} from '@/app/constants/serviceStatus';
import type { SettlementSyncJobName } from '@/app/types/admin';

import {
  buildSettlementSyncJobHealth,
  loadSettlementSyncRunHistory,
} from './jobRuns';
import type {
  SettlementSyncAdminClient,
  SettlementSyncDueBacklog,
  SettlementSyncHealthSnapshot,
} from './types';

type ExperienceDueRow = {
  id: string;
  date: string | null;
  time: string | null;
};

type ServiceDueRequestRow = {
  id: string;
  service_date: string | null;
  status: string;
  selected_host_id: string | null;
};

type ServiceDueBookingRow = {
  id: string;
  request_id: string | null;
  status: string;
  host_id: string | null;
};

const EXPERIENCE_JOB_NAME: SettlementSyncJobName = 'experience_completion_sync';
const SERVICE_JOB_NAME: SettlementSyncJobName = 'service_completion_sync';

function getDueLagMinutes(oldestDueAt: string | null) {
  if (!oldestDueAt) return null;
  const dueDate = new Date(oldestDueAt);
  if (Number.isNaN(dueDate.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / (60 * 1000)));
}

function getTodayKSTDateString() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date());
}

function getExperienceDueAt(row: Pick<ExperienceDueRow, 'date' | 'time'>) {
  if (!row.date) return null;
  const dueAt = new Date(`${row.date}T${row.time || '00:00'}`);
  if (Number.isNaN(dueAt.getTime())) return null;
  return dueAt.toISOString();
}

function getServiceDueAt(row: Pick<ServiceDueRequestRow, 'service_date'>) {
  if (!row.service_date) return null;
  const dueAt = new Date(`${row.service_date}T00:00:00+09:00`);
  if (Number.isNaN(dueAt.getTime())) return null;
  return dueAt.toISOString();
}

export async function getExperienceCompletionDueBacklog(
  supabaseAdmin: SettlementSyncAdminClient
): Promise<SettlementSyncDueBacklog> {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('id, date, time')
    .in('status', [...BOOKING_ACTIVE_STATUS_FOR_CAPACITY]);

  if (error) throw error;

  const now = new Date();
  let count = 0;
  let oldestDueAt: string | null = null;

  ((data || []) as ExperienceDueRow[]).forEach((row) => {
    const dueAt = getExperienceDueAt(row);
    if (!dueAt) return;
    const dueDate = new Date(dueAt);
    if (dueDate >= now) return;

    count += 1;
    if (!oldestDueAt || dueAt < oldestDueAt) {
      oldestDueAt = dueAt;
    }
  });

  return {
    count,
    oldestDueAt,
    lagMinutes: getDueLagMinutes(oldestDueAt),
  };
}

export async function getServiceCompletionDueBacklog(
  supabaseAdmin: SettlementSyncAdminClient
): Promise<SettlementSyncDueBacklog> {
  const todayKST = getTodayKSTDateString();

  const { data: requestRowsRaw, error: requestError } = await supabaseAdmin
    .from('service_requests')
    .select('id, service_date, status, selected_host_id')
    .lt('service_date', todayKST)
    .in('status', [...SERVICE_REQUEST_ACTIVE_STATUSES, ...SERVICE_REQUEST_COMPLETED_STATUSES]);

  if (requestError) throw requestError;

  const requestRows = ((requestRowsRaw || []) as ServiceDueRequestRow[]).filter(
    (row) => row.selected_host_id
  );
  if (requestRows.length === 0) {
    return { count: 0, oldestDueAt: null, lagMinutes: null };
  }

  const requestIds = requestRows.map((row) => row.id);
  const { data: bookingRowsRaw, error: bookingError } = await supabaseAdmin
    .from('service_bookings')
    .select('id, request_id, status, host_id')
    .in('request_id', requestIds)
    .in('status', [...SERVICE_BOOKING_ACTIVE_STATUSES]);

  if (bookingError) throw bookingError;

  const bookingRows = ((bookingRowsRaw || []) as ServiceDueBookingRow[]).filter(
    (row) => row.host_id && row.request_id
  );
  if (bookingRows.length === 0) {
    return { count: 0, oldestDueAt: null, lagMinutes: null };
  }

  const requestMap = new Map(requestRows.map((row) => [row.id, row]));
  let oldestDueAt: string | null = null;

  bookingRows.forEach((row) => {
    const requestRow = row.request_id ? requestMap.get(row.request_id) : null;
    const dueAt = requestRow ? getServiceDueAt(requestRow) : null;
    if (!dueAt) return;
    if (!oldestDueAt || dueAt < oldestDueAt) {
      oldestDueAt = dueAt;
    }
  });

  return {
    count: bookingRows.length,
    oldestDueAt,
    lagMinutes: getDueLagMinutes(oldestDueAt),
  };
}

export async function getSettlementSyncHealthSnapshot(
  supabaseAdmin: SettlementSyncAdminClient
): Promise<SettlementSyncHealthSnapshot> {
  const [history, experienceBacklog, serviceBacklog] = await Promise.all([
    loadSettlementSyncRunHistory(supabaseAdmin, [EXPERIENCE_JOB_NAME, SERVICE_JOB_NAME]),
    getExperienceCompletionDueBacklog(supabaseAdmin),
    getServiceCompletionDueBacklog(supabaseAdmin),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    jobs: [
      buildSettlementSyncJobHealth({
        jobName: EXPERIENCE_JOB_NAME,
        runs: history.filter((row) => row.jobName === EXPERIENCE_JOB_NAME),
        backlog: experienceBacklog,
      }),
      buildSettlementSyncJobHealth({
        jobName: SERVICE_JOB_NAME,
        runs: history.filter((row) => row.jobName === SERVICE_JOB_NAME),
        backlog: serviceBacklog,
      }),
    ],
  };
}
