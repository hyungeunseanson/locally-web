import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import {
  buildHistoricalReviewRequestBackfillPlan,
  executeHistoricalReviewRequestBackfill,
  GUEST_REVIEW_REQUEST_EMAIL_BACKFILL_ACTION,
  GUEST_REVIEW_REQUEST_EMAIL_BACKFILL_CUTOFF,
  GUEST_REVIEW_REQUEST_EMAIL_BACKFILL_SOURCE,
  type HistoricalReviewRequestBooking,
} from '@/app/utils/reviews/guestReviewRequestEmailBackfill';

type ExperienceRelation = {
  id: string;
  title: string | null;
  duration: number | string | null;
};

type BookingRow = {
  id: string;
  user_id: string | null;
  date: string | null;
  time: string | null;
  status: string;
  experiences: ExperienceRelation | ExperienceRelation[] | null;
};

function loadEnvironmentFile(filePath: string) {
  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function getExperience(relation: BookingRow['experiences']) {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

async function loadPlan(supabaseAdmin: SupabaseClient) {
  const cutoffDate = GUEST_REVIEW_REQUEST_EMAIL_BACKFILL_CUTOFF.slice(0, 10);
  const { data: bookingData, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .select('id, user_id, date, time, status, experiences!inner(id, title, duration)')
    .eq('status', 'completed')
    .not('user_id', 'is', null)
    .lte('date', cutoffDate)
    .order('date', { ascending: false })
    .limit(500);
  if (bookingError) throw bookingError;

  const bookingRows = (bookingData as BookingRow[] | null) || [];
  if (bookingRows.length >= 500) {
    throw new Error('Historical review request email candidate scan reached its safety limit.');
  }
  const bookingIds = bookingRows.map((booking) => booking.id);
  const userIds = [...new Set(bookingRows.flatMap((booking) => booking.user_id ? [booking.user_id] : []))];

  const [reviewsResult, markersResult] = await Promise.all([
    bookingIds.length > 0
      ? supabaseAdmin.from('reviews').select('booking_id').in('booking_id', bookingIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length > 0
      ? supabaseAdmin
        .from('admin_audit_logs')
        .select('target_id')
        .eq('action_type', GUEST_REVIEW_REQUEST_EMAIL_BACKFILL_ACTION)
        .eq('target_type', 'user')
        .in('target_id', userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (reviewsResult.error) throw reviewsResult.error;
  if (markersResult.error) throw markersResult.error;

  const bookings = bookingRows.flatMap<HistoricalReviewRequestBooking>((row) => {
    const experience = getExperience(row.experiences);
    if (!row.user_id || !experience?.id) return [];
    return [{
      id: row.id,
      userId: row.user_id,
      experienceId: experience.id,
      experienceTitle: experience.title || 'Locally Experience',
      date: row.date,
      time: row.time,
      duration: experience.duration,
      status: row.status,
    }];
  });

  return buildHistoricalReviewRequestBackfillPlan({
    bookings,
    reviewedBookingIds: new Set(
      (reviewsResult.data || []).flatMap((review) =>
        typeof review.booking_id === 'string' ? [review.booking_id] : []
      )
    ),
    markedUserIds: new Set(
      (markersResult.data || []).flatMap((marker) =>
        typeof marker.target_id === 'string' ? [marker.target_id] : []
      )
    ),
  });
}

async function countMarkers(supabaseAdmin: SupabaseClient) {
  const { count, error } = await supabaseAdmin
    .from('admin_audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('action_type', GUEST_REVIEW_REQUEST_EMAIL_BACKFILL_ACTION)
    .eq('target_type', 'user');
  if (error) throw error;
  return count || 0;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const envFileArg = args.find((argument) => argument.startsWith('--env-file='));
  loadEnvironmentFile(path.resolve(envFileArg?.slice('--env-file='.length) || '.env.local'));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const plan = await loadPlan(supabaseAdmin);
  const result = await executeHistoricalReviewRequestBackfill({
    plan,
    apply,
    isMarked: async (userId) => {
      const { data, error } = await supabaseAdmin
        .from('admin_audit_logs')
        .select('id')
        .eq('action_type', GUEST_REVIEW_REQUEST_EMAIL_BACKFILL_ACTION)
        .eq('target_type', 'user')
        .eq('target_id', userId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data?.id);
    },
    hasReview: async (bookingId) => {
      const { data, error } = await supabaseAdmin
        .from('reviews')
        .select('id')
        .eq('booking_id', bookingId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data?.id);
    },
    sendEmail: (booking) => sendImmediateGenericEmail({
      recipientUserId: booking.userId,
      templatedEmail: {
        templateId: 'notice.copy',
        audience: 'guest',
        payload: {
          copyKey: 'review.request.guest',
          copyParams: { experienceTitle: booking.experienceTitle },
          ctaUrl: '/guest/trips',
        },
      },
    }, { supabaseAdmin }),
    recordMarker: async (booking) => {
      const sentAt = new Date().toISOString();
      const { error } = await supabaseAdmin.from('admin_audit_logs').insert({
        action_type: GUEST_REVIEW_REQUEST_EMAIL_BACKFILL_ACTION,
        target_type: 'user',
        target_id: booking.userId,
        details: {
          cutoff: GUEST_REVIEW_REQUEST_EMAIL_BACKFILL_CUTOFF,
          representative_booking_id: booking.id,
          experience_id: booking.experienceId,
          experience_title: booking.experienceTitle,
          sent_at: sentAt,
          source: GUEST_REVIEW_REQUEST_EMAIL_BACKFILL_SOURCE,
        },
      });
      if (error) throw error;
    },
  });

  const markerCount = await countMarkers(supabaseAdmin);
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    cutoff: GUEST_REVIEW_REQUEST_EMAIL_BACKFILL_CUTOFF,
    eligibleBookings: plan.eligibleBookingCount,
    eligibleCustomers: plan.uniqueCustomerCount,
    emailsThatWouldSend: plan.representatives.length,
    attemptedCustomers: result.attemptedCustomers,
    sentCustomers: result.sentCustomers,
    failedCustomers: result.failedCustomers,
    skippedReviewed: plan.skippedReviewedCount + result.skippedReviewed,
    skippedAlreadyMarked: result.skippedAlreadyMarked,
    auditMarkerCount: markerCount,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Historical review request email backfill failed.');
  process.exitCode = 1;
});
