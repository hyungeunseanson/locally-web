import nodemailer from 'nodemailer';

import { createAdminClient } from '@/app/utils/supabase/admin';

const TEN_MINUTES_MS = 10 * 60 * 1000;
const MAX_TEAM_DIGEST_ITEMS = 25;

type EmailNotificationJobKind = 'team_digest' | 'inquiry_unread';
type EmailNotificationJobStatus = 'queued' | 'processing' | 'sent' | 'cancelled' | 'failed';

type EmailNotificationJobRow = {
  id: string;
  job_key: string;
  kind: EmailNotificationJobKind;
  status: EmailNotificationJobStatus;
  recipient_user_id: string | null;
  recipient_email: string;
  payload: Record<string, unknown> | null;
  send_after: string;
  attempt_count: number;
};

type TeamDigestEventType =
  | 'team_chat'
  | 'team_todo'
  | 'team_task_comment'
  | 'team_memo'
  | 'team_memo_comment';

type TeamDigestEvent = {
  type: TeamDigestEventType;
  title: string;
  message: string;
  link: string;
  createdAt: string;
};

type TeamDigestPayload = {
  bucketStart: string;
  bucketEnd: string;
  items: TeamDigestEvent[];
};

type InquiryUnreadPayload = {
  inquiryId: string;
  link: string;
  title: string;
  latestMessage: string;
  batchStartedAt: string;
  unreadCount: number;
};

function isMailerConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncateText(value: string, maxLength = 180) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function buildAbsoluteLink(link?: string | null) {
  if (!link) return `${getSiteUrl()}/`;
  if (link.startsWith('http://') || link.startsWith('https://')) return link;
  const normalized = link.startsWith('/') ? link : `/${link}`;
  return `${getSiteUrl()}${normalized}`;
}

function renderEmailShell(params: {
  title: string;
  bodyHtml: string;
  ctaLink?: string | null;
  ctaLabel?: string;
  footer?: string;
}) {
  const cta = params.ctaLink
    ? `<a href="${escapeHtml(buildAbsoluteLink(params.ctaLink))}" style="display:inline-block;padding:12px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">${escapeHtml(params.ctaLabel || '확인하기')}</a>`
    : '';

  const footer = params.footer
    ? `<p style="margin:24px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">${escapeHtml(params.footer)}</p>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0f172a;line-height:1.6;">
      <h2 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${escapeHtml(params.title)}</h2>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;">
        ${params.bodyHtml}
      </div>
      ${cta ? `<div style="margin-top:20px;">${cta}</div>` : ''}
      ${footer}
    </div>
  `;
}

async function sendHtmlEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!isMailerConfigured()) return false;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Locally Team" <${process.env.GMAIL_USER}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  return true;
}

export async function resolveUserEmail(userId: string) {
  const supabaseAdmin = createAdminClient();

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.email) return profile.email;

  const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
  return authData?.user?.email || '';
}

function getTeamDigestBucket(date = new Date()) {
  const bucketStartMs = Math.floor(date.getTime() / TEN_MINUTES_MS) * TEN_MINUTES_MS;
  const bucketStart = new Date(bucketStartMs);
  const bucketEnd = new Date(bucketStartMs + TEN_MINUTES_MS);
  return { bucketStart, bucketEnd };
}

async function upsertTeamDigestJob(params: {
  recipientEmail: string;
  recipientUserId?: string | null;
  event: TeamDigestEvent;
}) {
  const supabaseAdmin = createAdminClient();
  const { bucketStart, bucketEnd } = getTeamDigestBucket(new Date(params.event.createdAt));
  const jobKey = `team:${params.recipientEmail}:${bucketStart.toISOString()}`;

  const { data: existing } = await supabaseAdmin
    .from('email_notification_jobs')
    .select('*')
    .eq('job_key', jobKey)
    .maybeSingle<EmailNotificationJobRow>();

  if (existing) {
    if (existing.status !== 'queued') return;

    const existingPayload = (existing.payload || {}) as TeamDigestPayload;
    const nextItems = [...(existingPayload.items || []), params.event].slice(-MAX_TEAM_DIGEST_ITEMS);

    await supabaseAdmin
      .from('email_notification_jobs')
      .update({
        payload: {
          bucketStart: existingPayload.bucketStart || bucketStart.toISOString(),
          bucketEnd: existingPayload.bucketEnd || bucketEnd.toISOString(),
          items: nextItems,
        },
      })
      .eq('id', existing.id);

    return;
  }

  const payload: TeamDigestPayload = {
    bucketStart: bucketStart.toISOString(),
    bucketEnd: bucketEnd.toISOString(),
    items: [params.event],
  };

  await supabaseAdmin
    .from('email_notification_jobs')
    .insert({
      job_key: jobKey,
      kind: 'team_digest',
      status: 'queued',
      recipient_user_id: params.recipientUserId || null,
      recipient_email: params.recipientEmail,
      payload,
      send_after: bucketEnd.toISOString(),
    });
}

export async function queueTeamDigestEmails(params: {
  actorEmail?: string | null;
  title: string;
  message: string;
  link?: string | null;
  eventType?: TeamDigestEventType | null;
}) {
  if (!isMailerConfigured()) {
    return { success: true, queuedRecipients: 0, skipped: 'mailer_not_configured' as const };
  }

  const supabaseAdmin = createAdminClient();
  const { data: whitelistData, error: whitelistError } = await supabaseAdmin
    .from('admin_whitelist')
    .select('email');

  if (whitelistError) {
    throw new Error(whitelistError.message);
  }

  const whitelistEmails = (whitelistData || [])
    .map((row) => row.email)
    .filter((email): email is string => Boolean(email))
    .filter((email) => email !== params.actorEmail);

  if (whitelistEmails.length === 0) {
    return { success: true, queuedRecipients: 0, skipped: null };
  }

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .in('email', whitelistEmails);

  const profileMap = new Map((profiles || []).map((row) => [row.email, row.id]));
  const createdAt = new Date().toISOString();
  const event: TeamDigestEvent = {
    type: params.eventType || 'team_chat',
    title: params.title,
    message: truncateText(params.message, 220),
    link: params.link || '/admin/dashboard?tab=TEAM',
    createdAt,
  };

  for (const email of whitelistEmails) {
    await upsertTeamDigestJob({
      recipientEmail: email,
      recipientUserId: profileMap.get(email) || null,
      event,
    });
  }

  return { success: true, queuedRecipients: whitelistEmails.length, skipped: null };
}

export async function queueInquiryUnreadEmail(params: {
  recipientId: string;
  inquiryId: number | string;
  title: string;
  message: string;
  link: string;
}) {
  if (!isMailerConfigured()) return { success: true, queued: false, skipped: 'mailer_not_configured' as const };

  const supabaseAdmin = createAdminClient();
  const recipientEmail = await resolveUserEmail(params.recipientId);

  if (!recipientEmail) {
    return { success: true, queued: false, skipped: 'recipient_email_missing' as const };
  }

  const inquiryId = String(params.inquiryId);
  const unreadFilter = supabaseAdmin
    .from('inquiry_messages')
    .select('created_at')
    .eq('inquiry_id', inquiryId)
    .neq('sender_id', params.recipientId)
    .is('read_at', null)
    .order('created_at', { ascending: true })
    .limit(1);

  const { data: oldestUnread } = await unreadFilter.maybeSingle<{ created_at: string }>();

  if (!oldestUnread?.created_at) {
    return { success: true, queued: false, skipped: 'no_unread_messages' as const };
  }

  const { count: unreadCount } = await supabaseAdmin
    .from('inquiry_messages')
    .select('id', { count: 'exact', head: true })
    .eq('inquiry_id', inquiryId)
    .neq('sender_id', params.recipientId)
    .is('read_at', null);

  const batchStartedAt = oldestUnread.created_at;
  const jobKey = `inquiry:${params.recipientId}:${inquiryId}:${batchStartedAt}`;

  const { data: existing } = await supabaseAdmin
    .from('email_notification_jobs')
    .select('*')
    .eq('job_key', jobKey)
    .maybeSingle<EmailNotificationJobRow>();

  const payload: InquiryUnreadPayload = {
    inquiryId,
    link: params.link,
    title: params.title,
    latestMessage: truncateText(params.message, 220),
    batchStartedAt,
    unreadCount: unreadCount || 1,
  };

  if (existing) {
    if (existing.status !== 'queued') {
      return { success: true, queued: false, skipped: 'existing_finalized' as const };
    }

    await supabaseAdmin
      .from('email_notification_jobs')
      .update({
        recipient_email: recipientEmail,
        payload,
      })
      .eq('id', existing.id);

    return { success: true, queued: true };
  }

  const sendAfter = new Date(new Date(batchStartedAt).getTime() + TEN_MINUTES_MS).toISOString();

  await supabaseAdmin
    .from('email_notification_jobs')
    .insert({
      job_key: jobKey,
      kind: 'inquiry_unread',
      status: 'queued',
      recipient_user_id: params.recipientId,
      recipient_email: recipientEmail,
      payload,
      send_after: sendAfter,
    });

  return { success: true, queued: true };
}

export async function sendImmediateGenericEmail(params: {
  recipientUserId?: string | null;
  recipientEmail?: string | null;
  subject: string;
  title: string;
  message: string;
  link?: string | null;
  ctaLabel?: string;
}) {
  if (!isMailerConfigured()) return { success: true, sent: false, skipped: 'mailer_not_configured' as const };

  const email = params.recipientEmail || (params.recipientUserId ? await resolveUserEmail(params.recipientUserId) : '');

  if (!email) {
    return { success: true, sent: false, skipped: 'recipient_email_missing' as const };
  }

  const html = renderEmailShell({
    title: params.title,
    bodyHtml: `<p style="margin:0;white-space:pre-wrap;">${escapeHtml(params.message)}</p>`,
    ctaLink: params.link || null,
    ctaLabel: params.ctaLabel || '확인하기',
  });

  await sendHtmlEmail({
    to: email,
    subject: params.subject,
    html,
  });

  return { success: true, sent: true };
}

function summarizeTeamItems(items: TeamDigestEvent[]) {
  const labels: Record<TeamDigestEventType, string> = {
    team_chat: '팀 채팅',
    team_todo: '새 할 일',
    team_task_comment: '할 일 댓글',
    team_memo: '팀 메모',
    team_memo_comment: '메모 답글',
  };

  const counts = new Map<TeamDigestEventType, number>();
  for (const item of items) {
    counts.set(item.type, (counts.get(item.type) || 0) + 1);
  }

  return Array.from(counts.entries()).map(([type, count]) => `${labels[type]} ${count}건`);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

async function processTeamDigestJob(job: EmailNotificationJobRow) {
  const payload = (job.payload || {}) as TeamDigestPayload;
  const items = payload.items || [];

  if (items.length === 0) {
    return { status: 'cancelled' as const, reason: 'empty_digest' };
  }

  const summaryLines = summarizeTeamItems(items)
    .map((line) => `<li style="margin:0 0 6px;">${escapeHtml(line)}</li>`)
    .join('');

  const detailLines = items
    .slice(-8)
    .map(
      (item) => `
        <li style="margin:0 0 12px;">
          <strong>${escapeHtml(item.title)}</strong><br/>
          <span style="color:#475569;">${escapeHtml(item.message)}</span><br/>
          <span style="color:#94a3b8;font-size:12px;">${escapeHtml(formatDateTime(item.createdAt))}</span>
        </li>
      `
    )
    .join('');

  const html = renderEmailShell({
    title: `지난 10분간 팀 업데이트 ${items.length}건`,
    bodyHtml: `
      <p style="margin:0 0 12px;">최근 10분 동안 팀스페이스에 아래 업데이트가 있었습니다.</p>
      <ul style="margin:0 0 18px;padding-left:18px;">${summaryLines}</ul>
      <ul style="margin:0;padding-left:18px;">${detailLines}</ul>
    `,
    ctaLink: '/admin/dashboard?tab=TEAM',
    ctaLabel: '팀스페이스 열기',
    footer: '이 메일은 10분 단위 팀스페이스 요약 메일입니다.',
  });

  await sendHtmlEmail({
    to: job.recipient_email,
    subject: `[Locally Admin] 지난 10분간 팀 업데이트 ${items.length}건`,
    html,
  });

  return { status: 'sent' as const };
}

async function processInquiryUnreadJob(job: EmailNotificationJobRow) {
  const payload = (job.payload || {}) as InquiryUnreadPayload;

  if (!job.recipient_user_id) {
    return { status: 'cancelled' as const, reason: 'missing_recipient_user_id' };
  }

  const supabaseAdmin = createAdminClient();
  const inquiryId = payload.inquiryId;
  const batchStartedAt = payload.batchStartedAt;

  if (!inquiryId || !batchStartedAt) {
    return { status: 'cancelled' as const, reason: 'invalid_payload' };
  }

  const { count: unreadCount } = await supabaseAdmin
    .from('inquiry_messages')
    .select('id', { count: 'exact', head: true })
    .eq('inquiry_id', inquiryId)
    .neq('sender_id', job.recipient_user_id)
    .is('read_at', null)
    .gte('created_at', batchStartedAt);

  if (!unreadCount || unreadCount <= 0) {
    return { status: 'cancelled' as const, reason: 'already_read' };
  }

  const subject = unreadCount > 1
    ? `[Locally] 읽지 않은 새 메시지 ${unreadCount}개가 있어요`
    : `[Locally] 새 메시지가 도착했어요`;

  const html = renderEmailShell({
    title: unreadCount > 1 ? `읽지 않은 새 메시지 ${unreadCount}개` : '읽지 않은 새 메시지 1개',
    bodyHtml: `
      <p style="margin:0 0 12px;"><strong>${escapeHtml(payload.title || '새 메시지')}</strong></p>
      <p style="margin:0;white-space:pre-wrap;">${escapeHtml(payload.latestMessage || '')}</p>
    `,
    ctaLink: payload.link || '/guest/inbox',
    ctaLabel: '메시지 확인하기',
    footer: '10분 동안 읽지 않은 메시지가 있어 발송된 안내 메일입니다.',
  });

  await sendHtmlEmail({
    to: job.recipient_email,
    subject,
    html,
  });

  return { status: 'sent' as const };
}

export async function processQueuedEmailNotificationJobs(limit = 100) {
  if (!isMailerConfigured()) {
    return {
      success: true,
      processed: 0,
      sent: 0,
      cancelled: 0,
      failed: 0,
      skipped: 'mailer_not_configured' as const,
    };
  }

  const supabaseAdmin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: jobs, error } = await supabaseAdmin
    .from('email_notification_jobs')
    .select('*')
    .eq('status', 'queued')
    .lte('send_after', nowIso)
    .order('send_after', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  let sent = 0;
  let cancelled = 0;
  let failed = 0;

  for (const rawJob of (jobs || []) as EmailNotificationJobRow[]) {
    const { data: claimed } = await supabaseAdmin
      .from('email_notification_jobs')
      .update({
        status: 'processing',
        attempt_count: (rawJob.attempt_count || 0) + 1,
      })
      .eq('id', rawJob.id)
      .eq('status', 'queued')
      .select('*')
      .maybeSingle<EmailNotificationJobRow>();

    if (!claimed) continue;

    try {
      const result = claimed.kind === 'team_digest'
        ? await processTeamDigestJob(claimed)
        : await processInquiryUnreadJob(claimed);

      if (result.status === 'sent') {
        sent += 1;
        await supabaseAdmin
          .from('email_notification_jobs')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            last_error: null,
          })
          .eq('id', claimed.id);
      } else {
        cancelled += 1;
        await supabaseAdmin
          .from('email_notification_jobs')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            last_error: result.reason,
          })
          .eq('id', claimed.id);
      }
    } catch (jobError) {
      failed += 1;
      const message = jobError instanceof Error ? jobError.message : 'Unknown error';
      await supabaseAdmin
        .from('email_notification_jobs')
        .update({
          status: 'failed',
          last_error: message,
        })
        .eq('id', claimed.id);
    }
  }

  return {
    success: true,
    processed: sent + cancelled + failed,
    sent,
    cancelled,
    failed,
  };
}
