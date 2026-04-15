import { getInquiryMessageDisplayContent, isAdminSupportInquiry } from '@/app/utils/inquiry';
import { insertAdminAlerts, sendAdminAlertEmails } from '@/app/utils/adminAlertCenter';
import { createAdminClient } from '@/app/utils/supabase/admin';

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

type Identifier = number | string;

type InquiryUnreadBatchRow = {
  inquiry_id: Identifier;
  is_active: boolean;
  first_unread_message_id?: Identifier | null;
  first_unread_message_at?: string | null;
  last_unread_message_id?: Identifier | null;
  last_unread_message_at?: string | null;
  alert_due_at?: string | null;
  in_app_sent_at?: string | null;
  email_sent_at?: string | null;
  processing_started_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type InquiryUnreadAlertInquiryRow = {
  id: Identifier;
  user_id: string;
  type?: string | null;
};

type InquiryUnreadAlertMessageRow = {
  id: Identifier;
  inquiry_id?: Identifier;
  sender_id?: string | null;
  content?: string | null;
  type?: string | null;
  created_at?: string | null;
  read_at?: string | null;
};

type InquiryUnreadAlertGuestRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
};

type InquiryUnreadAuditMarkerRow = {
  action_type?: string | null;
  target_id?: string | null;
  details?: {
    batch_started_at?: string | null;
    first_unread_message_id?: string | number | null;
  } | null;
};

type FallbackUnreadBatchCandidate = {
  inquiryId: Identifier;
  userId: string;
  firstUnreadMessageId: Identifier;
  firstUnreadMessageAt: string;
  lastUnreadMessageId: Identifier;
  lastUnreadMessageAt: string;
  preview: string | null;
};

type InquiryUnreadWaveIdentity = {
  inquiryId: Identifier;
  firstUnreadMessageId: Identifier;
  firstUnreadMessageAt: string | null;
};

const UNREAD_BATCH_TABLE = 'admin_support_unread_alert_batches';
const UNREAD_BATCH_CLAIM_RPC = 'claim_due_admin_support_unread_alert_batches';
const UNREAD_ALERT_IN_APP_AUDIT_ACTION = 'ADMIN_SUPPORT_UNREAD_ALERT_IN_APP_SENT';
const UNREAD_ALERT_EMAIL_AUDIT_ACTION = 'ADMIN_SUPPORT_UNREAD_ALERT_EMAIL_SENT';
const UNREAD_ALERT_DELAY_MINUTES = 60;
const UNREAD_ALERT_DELAY_LABEL_KO =
  UNREAD_ALERT_DELAY_MINUTES % 60 === 0
    ? `${UNREAD_ALERT_DELAY_MINUTES / 60}시간`
    : `${UNREAD_ALERT_DELAY_MINUTES}분`;
const STALE_PROCESSING_WINDOW_MINUTES = 15;
const UNREAD_ALERT_AUDIT_ACTIONS = [
  UNREAD_ALERT_IN_APP_AUDIT_ACTION,
  UNREAD_ALERT_EMAIL_AUDIT_ACTION,
] as const;

function addMinutes(timestamp: string, minutes: number) {
  const base = new Date(timestamp);
  return new Date(base.getTime() + minutes * 60_000).toISOString();
}

function normalizeIsoTimestamp(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeIdentifier(value: Identifier | null | undefined) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function isMissingUnreadBatchInfraMessage(message?: string | null) {
  const safeMessage = message?.trim() || '';
  if (!safeMessage) return false;

  return (
    safeMessage.includes(UNREAD_BATCH_TABLE) ||
    safeMessage.includes(UNREAD_BATCH_CLAIM_RPC)
  );
}

function shouldFallbackFromUnreadBatchClaim(message?: string | null) {
  const safeMessage = message?.trim() || '';
  if (!safeMessage) return false;

  return (
    isMissingUnreadBatchInfraMessage(safeMessage) ||
    safeMessage.includes("column reference \"inquiry_id\" is ambiguous")
  );
}

function normalizeMessagePreview(message?: InquiryUnreadAlertMessageRow | null) {
  const content = getInquiryMessageDisplayContent({
    type: message?.type,
    content: message?.content,
  });
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

function getGuestDisplayName(guest?: InquiryUnreadAlertGuestRow | null) {
  if (!guest) return '고객';
  if (guest.full_name?.trim()) return guest.full_name.trim();
  if (guest.email?.trim()) return guest.email.trim().split('@')[0] || '고객';
  return '고객';
}

function buildAdminChatLink(inquiryId: Identifier) {
  return `/admin/dashboard?tab=CHATS&inquiryId=${encodeURIComponent(String(inquiryId))}`;
}

function buildUnreadAlertAuditDetails(params: {
  batchStartedAt: string;
  firstUnreadMessageId: Identifier;
}) {
  return {
    batch_started_at: params.batchStartedAt,
    first_unread_message_id: String(params.firstUnreadMessageId),
  };
}

function doesAuditMarkerMatchBatch(
  marker: InquiryUnreadAuditMarkerRow,
  batchStartedAt: string,
  firstUnreadMessageId: Identifier
) {
  const markerBatchStartedAt = normalizeIsoTimestamp(marker.details?.batch_started_at);
  const markerMessageId = normalizeIdentifier(marker.details?.first_unread_message_id);

  return (
    markerBatchStartedAt === batchStartedAt &&
    markerMessageId === String(firstUnreadMessageId)
  );
}

function getUnreadWaveIdentity(params: {
  inquiryId: Identifier;
  firstUnreadMessageId?: Identifier | null;
  firstUnreadMessageAt?: string | null;
}) {
  const firstUnreadMessageId = normalizeIdentifier(params.firstUnreadMessageId);
  if (!firstUnreadMessageId) return null;

  return {
    inquiryId: params.inquiryId,
    firstUnreadMessageId,
    firstUnreadMessageAt: normalizeIsoTimestamp(params.firstUnreadMessageAt),
  } satisfies InquiryUnreadWaveIdentity;
}

function buildNewUnreadBatchWriteSet(params: {
  messageId: Identifier;
  messageCreatedAt: string;
}) {
  return {
    is_active: true,
    first_unread_message_id: params.messageId,
    first_unread_message_at: params.messageCreatedAt,
    last_unread_message_id: params.messageId,
    last_unread_message_at: params.messageCreatedAt,
    alert_due_at: addMinutes(params.messageCreatedAt, UNREAD_ALERT_DELAY_MINUTES),
    in_app_sent_at: null,
    email_sent_at: null,
    processing_started_at: null,
  };
}

async function updateUnreadBatchForWave(params: {
  supabaseAdmin: SupabaseAdminClient;
  inquiryId: Identifier;
  expectedWave?: InquiryUnreadWaveIdentity | null;
  patch: Record<string, unknown>;
}) {
  const nextUpdatedAt = new Date().toISOString();

  let query = params.supabaseAdmin
    .from(UNREAD_BATCH_TABLE)
    .update({
      ...params.patch,
      updated_at: nextUpdatedAt,
    })
    .eq('inquiry_id', params.inquiryId);

  if (params.expectedWave) {
    query = query.eq('first_unread_message_id', params.expectedWave.firstUnreadMessageId);

    if (params.expectedWave.firstUnreadMessageAt) {
      query = query.eq('first_unread_message_at', params.expectedWave.firstUnreadMessageAt);
    } else {
      query = query.is('first_unread_message_at', null);
    }
  }

  const { data, error } = await query.select('inquiry_id');

  if (error) {
    throw new Error(error.message);
  }

  return { updated: Array.isArray(data) ? data.length > 0 : Boolean(data) };
}

async function insertUnreadAlertAuditMarker(params: {
  supabaseAdmin: SupabaseAdminClient;
  actionType: typeof UNREAD_ALERT_AUDIT_ACTIONS[number];
  inquiryId: Identifier;
  batchStartedAt: string;
  firstUnreadMessageId: Identifier;
}) {
  const { error } = await params.supabaseAdmin
    .from('admin_audit_logs')
    .insert({
      action_type: params.actionType,
      target_type: 'inquiries',
      target_id: String(params.inquiryId),
      details: buildUnreadAlertAuditDetails({
        batchStartedAt: params.batchStartedAt,
        firstUnreadMessageId: params.firstUnreadMessageId,
      }),
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function processDueAdminSupportUnreadAlertsFallback(params: {
  supabaseAdmin: SupabaseAdminClient;
  claimLimit: number;
}) {
  const { supabaseAdmin, claimLimit } = params;
  const now = Date.now();

  const { data: inquiryRows, error: inquiriesError } = await supabaseAdmin
    .from('inquiries')
    .select('id, user_id, type')
    .in('type', ['admin_support', 'admin']);

  if (inquiriesError) {
    throw new Error(inquiriesError.message);
  }

  const safeInquiryRows = (inquiryRows || []) as InquiryUnreadAlertInquiryRow[];
  if (safeInquiryRows.length === 0) {
    return {
      success: true,
      claimedCount: 0,
      alertedCount: 0,
      emailedCount: 0,
      skippedCount: 0,
      failureCount: 0,
      storage: 'audit-log-fallback',
    } as const;
  }

  const inquiryIds = safeInquiryRows.map((row) => row.id);
  const inquiryById = new Map(safeInquiryRows.map((row) => [String(row.id), row]));

  const { data: unreadMessageRows, error: unreadMessagesError } = await supabaseAdmin
    .from('inquiry_messages')
    .select('id, inquiry_id, sender_id, content, type, created_at, read_at')
    .in('inquiry_id', inquiryIds)
    .is('read_at', null)
    .order('created_at', { ascending: true });

  if (unreadMessagesError) {
    throw new Error(unreadMessagesError.message);
  }

  const safeUnreadMessageRows = (unreadMessageRows || []) as InquiryUnreadAlertMessageRow[];
  const fallbackCandidates = new Map<string, FallbackUnreadBatchCandidate>();

  for (const message of safeUnreadMessageRows) {
    const inquiry = inquiryById.get(String(message.inquiry_id));
    const messageCreatedAt = normalizeIsoTimestamp(message.created_at);

    if (
      !inquiry ||
      !isAdminSupportInquiry(inquiry.type) ||
      typeof message.sender_id !== 'string' ||
      message.sender_id !== inquiry.user_id ||
      !messageCreatedAt
    ) {
      continue;
    }

    const inquiryKey = String(inquiry.id);
    const existingCandidate = fallbackCandidates.get(inquiryKey);
    const preview = normalizeMessagePreview(message);

    if (!existingCandidate) {
      fallbackCandidates.set(inquiryKey, {
        inquiryId: inquiry.id,
        userId: inquiry.user_id,
        firstUnreadMessageId: message.id,
        firstUnreadMessageAt: messageCreatedAt,
        lastUnreadMessageId: message.id,
        lastUnreadMessageAt: messageCreatedAt,
        preview,
      });
      continue;
    }

    existingCandidate.lastUnreadMessageId = message.id;
    existingCandidate.lastUnreadMessageAt = messageCreatedAt;
    existingCandidate.preview = preview;
  }

  const dueCandidates = Array.from(fallbackCandidates.values())
    .filter((candidate) => {
      const dueAt =
        new Date(candidate.firstUnreadMessageAt).getTime() +
        UNREAD_ALERT_DELAY_MINUTES * 60_000;
      return dueAt <= now;
    })
    .slice(0, claimLimit);

  if (dueCandidates.length === 0) {
    return {
      success: true,
      claimedCount: 0,
      alertedCount: 0,
      emailedCount: 0,
      skippedCount: 0,
      failureCount: 0,
      storage: 'audit-log-fallback',
    } as const;
  }

  const guestIds = Array.from(new Set(dueCandidates.map((candidate) => candidate.userId)));
  const { data: guestRows, error: guestRowsError } = guestIds.length > 0
    ? await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', guestIds)
    : { data: [], error: null };

  if (guestRowsError) {
    throw new Error(guestRowsError.message);
  }

  const safeGuestRows = (guestRows || []) as InquiryUnreadAlertGuestRow[];
  const guestById = new Map(safeGuestRows.map((row) => [row.id, row]));

  const { data: markerRows, error: markersError } = await supabaseAdmin
    .from('admin_audit_logs')
    .select('action_type, target_id, details')
    .eq('target_type', 'inquiries')
    .in(
      'target_id',
      dueCandidates
        .map((candidate) => normalizeIdentifier(candidate.inquiryId))
        .filter((value): value is string => Boolean(value))
    )
    .in('action_type', [...UNREAD_ALERT_AUDIT_ACTIONS]);

  if (markersError) {
    throw new Error(markersError.message);
  }

  const safeMarkerRows = (markerRows || []) as InquiryUnreadAuditMarkerRow[];
  const markerGroups = new Map<string, InquiryUnreadAuditMarkerRow[]>();

  for (const marker of safeMarkerRows) {
    const targetId = normalizeIdentifier(marker.target_id);
    if (!targetId) continue;
    const group = markerGroups.get(targetId) || [];
    group.push(marker);
    markerGroups.set(targetId, group);
  }

  let claimedCount = 0;
  let alertedCount = 0;
  let emailedCount = 0;
  let skippedCount = 0;
  let failureCount = 0;

  for (const candidate of dueCandidates) {
    const markers = markerGroups.get(String(candidate.inquiryId)) || [];
    const inAppAlreadySent = markers.some(
      (marker) =>
        marker.action_type === UNREAD_ALERT_IN_APP_AUDIT_ACTION &&
        doesAuditMarkerMatchBatch(
          marker,
          candidate.firstUnreadMessageAt,
          candidate.firstUnreadMessageId
        )
    );
    const emailAlreadySent = markers.some(
      (marker) =>
        marker.action_type === UNREAD_ALERT_EMAIL_AUDIT_ACTION &&
        doesAuditMarkerMatchBatch(
          marker,
          candidate.firstUnreadMessageAt,
          candidate.firstUnreadMessageId
        )
    );

    if (inAppAlreadySent && emailAlreadySent) {
      skippedCount += 1;
      continue;
    }

    claimedCount += 1;
    const copy = buildAdminSupportUnreadAlertCopy({
      inquiryId: candidate.inquiryId,
      guestName: getGuestDisplayName(guestById.get(candidate.userId) || null),
      preview: candidate.preview,
    });

    let rowFailed = false;

    try {
      if (!inAppAlreadySent) {
        const alertResult = await insertAdminAlerts({
          title: copy.title,
          message: copy.message,
          link: copy.link,
        });

        if (alertResult.targetCount === 0 || alertResult.count === alertResult.targetCount) {
          alertedCount += alertResult.count;
          await insertUnreadAlertAuditMarker({
            supabaseAdmin,
            actionType: UNREAD_ALERT_IN_APP_AUDIT_ACTION,
            inquiryId: candidate.inquiryId,
            batchStartedAt: candidate.firstUnreadMessageAt,
            firstUnreadMessageId: candidate.firstUnreadMessageId,
          });
        }
      }

      if (!emailAlreadySent) {
        const emailResult = await sendAdminAlertEmails({
          subject: copy.subject,
          title: copy.title,
          message: copy.message,
          link: copy.link,
          ctaLabel: copy.ctaLabel,
        });

        if (emailResult.targetCount === 0 || emailResult.count === emailResult.targetCount) {
          emailedCount += emailResult.count;
          await insertUnreadAlertAuditMarker({
            supabaseAdmin,
            actionType: UNREAD_ALERT_EMAIL_AUDIT_ACTION,
            inquiryId: candidate.inquiryId,
            batchStartedAt: candidate.firstUnreadMessageAt,
            firstUnreadMessageId: candidate.firstUnreadMessageId,
          });
        }
      }
    } catch (error) {
      rowFailed = true;
      console.error('[AdminSupportUnreadAlerts] fallback delivery failed:', error);
    }

    if (rowFailed) {
      failureCount += 1;
    }
  }

  return {
    success: true,
    claimedCount,
    alertedCount,
    emailedCount,
    skippedCount,
    failureCount,
    storage: 'audit-log-fallback',
  } as const;
}

async function claimDueAdminSupportUnreadAlertBatchesWithoutRpc(params: {
  supabaseAdmin: SupabaseAdminClient;
  claimLimit: number;
}) {
  const { supabaseAdmin, claimLimit } = params;
  const nowIso = new Date().toISOString();
  const staleProcessingThresholdIso = new Date(
    Date.now() - STALE_PROCESSING_WINDOW_MINUTES * 60_000
  ).toISOString();

  const { data, error } = await supabaseAdmin
    .from('admin_support_unread_alert_batches')
    .select(
      'inquiry_id, is_active, first_unread_message_id, first_unread_message_at, last_unread_message_id, last_unread_message_at, alert_due_at, in_app_sent_at, email_sent_at, processing_started_at, created_at, updated_at'
    )
    .eq('is_active', true)
    .not('alert_due_at', 'is', null)
    .lte('alert_due_at', nowIso)
    .order('alert_due_at', { ascending: true })
    .limit(Math.max(claimLimit * 3, claimLimit));

  if (error) {
    throw new Error(error.message);
  }

  const dueRows = ((data || []) as InquiryUnreadBatchRow[])
    .filter((row) => {
      const isChannelPending = !normalizeIsoTimestamp(row.in_app_sent_at) || !normalizeIsoTimestamp(row.email_sent_at);
      const processingStartedAt = normalizeIsoTimestamp(row.processing_started_at);
      const isClaimable =
        !processingStartedAt || processingStartedAt < staleProcessingThresholdIso;
      return isChannelPending && isClaimable;
    })
    .slice(0, claimLimit);

  if (dueRows.length === 0) {
    return [] as InquiryUnreadBatchRow[];
  }

  const claimedRows: InquiryUnreadBatchRow[] = [];

  for (const row of dueRows) {
    const wave = getUnreadWaveIdentity({
      inquiryId: row.inquiry_id,
      firstUnreadMessageId: row.first_unread_message_id,
      firstUnreadMessageAt: row.first_unread_message_at,
    });

    const updateResult = await updateUnreadBatchForWave({
      supabaseAdmin,
      inquiryId: row.inquiry_id,
      expectedWave: wave,
      patch: {
        processing_started_at: nowIso,
      },
    });

    if (!updateResult.updated) {
      continue;
    }

    claimedRows.push({
      ...row,
      processing_started_at: nowIso,
      updated_at: nowIso,
    });
  }

  return claimedRows;
}

export function buildAdminSupportUnreadAlertCopy(params: {
  inquiryId: Identifier;
  guestName: string;
  preview?: string | null;
}) {
  const previewSuffix = params.preview ? ` · ${params.preview}` : '';

  return {
    subject: '[Locally Admin] 고객센터 1:1 문의 미읽음',
    title: '고객센터 1:1 문의 미읽음',
    message: `${params.guestName} 고객 문의가 ${UNREAD_ALERT_DELAY_LABEL_KO}째 확인되지 않았습니다.${previewSuffix}`,
    link: buildAdminChatLink(params.inquiryId),
    ctaLabel: '문의 확인하기',
  };
}

export async function startOrAdvanceAdminSupportUnreadBatch(params: {
  supabaseAdmin?: SupabaseAdminClient;
  inquiryId: Identifier;
  messageId: Identifier;
  messageCreatedAt?: string | null;
}) {
  const supabaseAdmin = params.supabaseAdmin ?? createAdminClient();
  const messageCreatedAt =
    normalizeIsoTimestamp(params.messageCreatedAt) || new Date().toISOString();

  const { data: existingRow, error: existingError } = await supabaseAdmin
    .from('admin_support_unread_alert_batches')
    .select('inquiry_id, is_active, alert_due_at')
    .eq('inquiry_id', params.inquiryId)
    .maybeSingle<InquiryUnreadBatchRow>();

  if (existingError) {
    if (isMissingUnreadBatchInfraMessage(existingError.message)) {
      return { success: true, startedNewBatch: false, storage: 'audit-log-fallback' } as const;
    }
    throw new Error(existingError.message);
  }

  if (!existingRow || existingRow.is_active !== true) {
    const { error: upsertError } = await supabaseAdmin
      .from('admin_support_unread_alert_batches')
      .upsert({
        inquiry_id: params.inquiryId,
        ...buildNewUnreadBatchWriteSet({
          messageId: params.messageId,
          messageCreatedAt,
        }),
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      if (isMissingUnreadBatchInfraMessage(upsertError.message)) {
        return { success: true, startedNewBatch: false, storage: 'audit-log-fallback' } as const;
      }
      throw new Error(upsertError.message);
    }

    return { success: true, startedNewBatch: true };
  }

  const { error: updateError } = await supabaseAdmin
    .from('admin_support_unread_alert_batches')
    .update({
      last_unread_message_id: params.messageId,
      last_unread_message_at: messageCreatedAt,
      processing_started_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('inquiry_id', params.inquiryId);

  if (updateError) {
    if (isMissingUnreadBatchInfraMessage(updateError.message)) {
      return { success: true, startedNewBatch: false, storage: 'audit-log-fallback' } as const;
    }
    throw new Error(updateError.message);
  }

  return { success: true, startedNewBatch: false };
}

export async function clearAdminSupportUnreadBatch(params: {
  supabaseAdmin?: SupabaseAdminClient;
  inquiryId: Identifier;
  expectedWave?: InquiryUnreadWaveIdentity | null;
}) {
  const supabaseAdmin = params.supabaseAdmin ?? createAdminClient();

  const { data: inquiry, error: inquiryError } = await supabaseAdmin
    .from('inquiries')
    .select('id, user_id, type')
    .eq('id', params.inquiryId)
    .maybeSingle<InquiryUnreadAlertInquiryRow>();

  if (inquiryError) {
    throw new Error(inquiryError.message);
  }

  if (!inquiry || !isAdminSupportInquiry(inquiry.type)) {
    return { success: true, cleared: false, remainingUnreadCount: 0 };
  }

  const { count, error: unreadError } = await supabaseAdmin
    .from('inquiry_messages')
    .select('id', { count: 'exact', head: true })
    .eq('inquiry_id', inquiry.id)
    .eq('sender_id', inquiry.user_id)
    .is('read_at', null);

  if (unreadError) {
    throw new Error(unreadError.message);
  }

  if ((count || 0) > 0) {
    return { success: true, cleared: false, remainingUnreadCount: count || 0 };
  }

  const clearResult = await updateUnreadBatchForWave({
    supabaseAdmin,
    inquiryId: inquiry.id,
    expectedWave: params.expectedWave || null,
    patch: {
      is_active: false,
      first_unread_message_id: null,
      first_unread_message_at: null,
      last_unread_message_id: null,
      last_unread_message_at: null,
      alert_due_at: null,
      in_app_sent_at: null,
      email_sent_at: null,
      processing_started_at: null,
    },
  }).catch((error) => {
    if (error instanceof Error && isMissingUnreadBatchInfraMessage(error.message)) {
      return {
        success: true,
        cleared: false,
        remainingUnreadCount: 0,
        storage: 'audit-log-fallback',
      } as const;
    }
    throw error;
  });

  if ('storage' in clearResult) {
    return clearResult;
  }

  return {
    success: true,
    cleared: clearResult.updated,
    remainingUnreadCount: 0,
  };
}

export async function processDueAdminSupportUnreadAlerts(params?: {
  supabaseAdmin?: SupabaseAdminClient;
  claimLimit?: number;
}) {
  const supabaseAdmin = params?.supabaseAdmin ?? createAdminClient();
  const claimLimit = params?.claimLimit ?? 50;

  const { data: claimedRows, error: claimError } = await supabaseAdmin.rpc(
    'claim_due_admin_support_unread_alert_batches',
    { p_limit: claimLimit }
  );

  let resolvedClaimedRows = claimedRows;

  if (claimError) {
    if (shouldFallbackFromUnreadBatchClaim(claimError.message)) {
      if (isMissingUnreadBatchInfraMessage(claimError.message)) {
        return processDueAdminSupportUnreadAlertsFallback({
          supabaseAdmin,
          claimLimit,
        });
      }

      resolvedClaimedRows = await claimDueAdminSupportUnreadAlertBatchesWithoutRpc({
        supabaseAdmin,
        claimLimit,
      });
    } else {
      throw new Error(claimError.message);
    }
  }

  const safeClaimedRows = (resolvedClaimedRows || []) as InquiryUnreadBatchRow[];
  if (safeClaimedRows.length === 0) {
    return {
      success: true,
      claimedCount: 0,
      alertedCount: 0,
      emailedCount: 0,
      skippedCount: 0,
    } as const;
  }

  const inquiryIds = safeClaimedRows.map((row) => row.inquiry_id);
  const { data: inquiryRows, error: inquiriesError } = await supabaseAdmin
    .from('inquiries')
    .select('id, user_id, type')
    .in('id', inquiryIds);

  if (inquiriesError) {
    throw new Error(inquiriesError.message);
  }

  const safeInquiryRows = (inquiryRows || []) as InquiryUnreadAlertInquiryRow[];
  const inquiryMap = new Map(safeInquiryRows.map((row) => [String(row.id), row]));
  const guestIds = Array.from(
    new Set(
      safeInquiryRows
        .map((row) => row.user_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    )
  );

  const { data: guestRows, error: guestsError } = guestIds.length > 0
    ? await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', guestIds)
    : { data: [], error: null };

  if (guestsError) {
    throw new Error(guestsError.message);
  }

  const safeGuestRows = (guestRows || []) as InquiryUnreadAlertGuestRow[];
  const guestMap = new Map(safeGuestRows.map((row) => [row.id, row]));
  const lastMessageIds = safeClaimedRows
    .map((row) => row.last_unread_message_id)
    .filter((value): value is Identifier => value !== null && value !== undefined);

  const { data: messageRows, error: messagesError } = lastMessageIds.length > 0
    ? await supabaseAdmin
      .from('inquiry_messages')
      .select('id, content, type')
      .in('id', lastMessageIds)
    : { data: [], error: null };

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  const safeMessageRows = (messageRows || []) as InquiryUnreadAlertMessageRow[];
  const messageMap = new Map(safeMessageRows.map((row) => [String(row.id), row]));

  let alertedCount = 0;
  let emailedCount = 0;
  let skippedCount = 0;
  let failureCount = 0;

  for (const row of safeClaimedRows) {
    const claimedWave = getUnreadWaveIdentity({
      inquiryId: row.inquiry_id,
      firstUnreadMessageId: row.first_unread_message_id,
      firstUnreadMessageAt: row.first_unread_message_at,
    });

    const inquiry = inquiryMap.get(String(row.inquiry_id));
    if (!inquiry || !isAdminSupportInquiry(inquiry.type)) {
      await clearAdminSupportUnreadBatch({
        supabaseAdmin,
        inquiryId: row.inquiry_id,
        expectedWave: claimedWave,
      });
      skippedCount += 1;
      continue;
    }

    const { count: remainingUnreadCount, error: unreadError } = await supabaseAdmin
      .from('inquiry_messages')
      .select('id', { count: 'exact', head: true })
      .eq('inquiry_id', inquiry.id)
      .eq('sender_id', inquiry.user_id)
      .is('read_at', null);

    if (unreadError) {
      throw new Error(unreadError.message);
    }

    if ((remainingUnreadCount || 0) === 0) {
      await clearAdminSupportUnreadBatch({
        supabaseAdmin,
        inquiryId: inquiry.id,
        expectedWave: claimedWave,
      });
      skippedCount += 1;
      continue;
    }

    const guest = guestMap.get(inquiry.user_id) || null;
    const preview = row.last_unread_message_id != null
      ? normalizeMessagePreview(messageMap.get(String(row.last_unread_message_id)))
      : null;
    const copy = buildAdminSupportUnreadAlertCopy({
      inquiryId: inquiry.id,
      guestName: getGuestDisplayName(guest),
      preview,
    });

    let nextInAppSentAt = normalizeIsoTimestamp(row.in_app_sent_at);
    let nextEmailSentAt = normalizeIsoTimestamp(row.email_sent_at);

    let rowFailed = false;

    try {
      if (!nextInAppSentAt) {
        const alertResult = await insertAdminAlerts({
          title: copy.title,
          message: copy.message,
          link: copy.link,
        });

        if (alertResult.targetCount === 0 || alertResult.count === alertResult.targetCount) {
          nextInAppSentAt = new Date().toISOString();
          alertedCount += alertResult.count;
        }
      }

      if (!nextEmailSentAt) {
        const emailResult = await sendAdminAlertEmails({
          subject: copy.subject,
          title: copy.title,
          message: copy.message,
          link: copy.link,
          ctaLabel: copy.ctaLabel,
        });

        if (emailResult.targetCount === 0 || emailResult.count === emailResult.targetCount) {
          nextEmailSentAt = new Date().toISOString();
          emailedCount += emailResult.count;
        }
      }
    } catch (error) {
      rowFailed = true;
      console.error('[AdminSupportUnreadAlerts] failed to send unread alerts:', error);
    } finally {
      const releaseResult = await updateUnreadBatchForWave({
        supabaseAdmin,
        inquiryId: row.inquiry_id,
        expectedWave: claimedWave,
        patch: {
          in_app_sent_at: nextInAppSentAt,
          email_sent_at: nextEmailSentAt,
          processing_started_at: null,
        },
      });

      if (!releaseResult.updated && claimedWave) {
        console.warn(
          '[AdminSupportUnreadAlerts] skipped release for superseded unread wave:',
          claimedWave
        );
      }
    }

    if (rowFailed) {
      failureCount += 1;
    }
  }

  return {
    success: true,
    claimedCount: safeClaimedRows.length,
    alertedCount,
    emailedCount,
    skippedCount,
    failureCount,
  } as const;
}
