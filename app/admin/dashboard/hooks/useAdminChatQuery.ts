'use client';

import { useAdminAttention } from '../components/AdminAttentionProvider';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { AdminInquiryActivity } from '@/app/utils/adminInquiryActivity';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { sanitizeText } from '@/app/utils/sanitize';
import { getPrivateChatImageDeliveryUrl } from '@/app/utils/privateStorageDelivery';
import { OFFICIAL_SUPPORT_SENDER_NAME } from '@/app/utils/officialSender';
import { getInquiryMessageDisplayContent, SOFT_DELETED_INQUIRY_MESSAGE_TYPE } from '@/app/utils/inquiry';

type MonitorInquiry = Partial<AdminInquiryActivity> & {
  id: number | string;
  type?: string | null;
  guest?: { full_name?: string | null; name?: string | null; email?: string | null; avatar_url?: string | null; phone?: string | null; };
  host?: { id?: string | null; name?: string | null; avatar_url?: string | null; email?: string | null; phone?: string | null; status?: string | null };
  experiences?: { title?: string | null } | null;
  user_id: string;
  updated_at?: string | null;
  content?: string | null;
  status?: string | null;
  unread_count?: number;
  has_policy_signal?: boolean;
  policy_signal_categories?: string[];
};

type MonitorMessage = {
  id: number | string;
  sender_id: string;
  content: string;
  image_url?: string | null;
  type?: string | null;
  inquiry_id?: number | string;
  created_at?: string | null;
  is_read?: boolean;
  read_at?: string | null;
  admin_read_at?: string | null;
  sender?: { name?: string | null };
  has_policy_signal?: boolean;
  policy_signal_categories?: string[];
};

type InquiryMessageRealtimeRow = {
  id?: number | string;
  sender_id?: string;
  inquiry_id?: number | string;
  content?: string | null;
  image_url?: string | null;
  type?: string | null;
};

type InquiryRealtimeRow = {
  id?: number | string;
  status?: string | null;
  content?: string | null;
  updated_at?: string | null;
};

type AdminSendMessageResult = {
  inquiryId: number | string;
  messageId: number | string;
  displayContent: string;
  updatedAt: string;
  message?: MonitorMessage;
};

type InquiryPreviewPatch = Partial<Pick<
  MonitorInquiry,
  'content' | 'updated_at' | 'has_policy_signal' | 'policy_signal_categories' | 'last_message_at' | 'last_sender_role' | 'needs_reply' | 'reply_waiting_since'
>>;

function normalizeServerMessage(message: MonitorMessage): MonitorMessage {
  return {
    ...message,
    ...(message.type === SOFT_DELETED_INQUIRY_MESSAGE_TYPE ? { has_policy_signal: false, policy_signal_categories: [] } : {}),
    content: getInquiryMessageDisplayContent(message),
    image_url: message.type === 'image' && message.image_url ? getPrivateChatImageDeliveryUrl(message.id) : null,
  };
}

function isAdminSupportType(type?: string | null) {
  return type === 'admin' || type === 'admin_support';
}

function sortMonitorInquiries(items: MonitorInquiry[]) {
  return [...items].sort((a, b) => {
    const aIsResolvedSupport = isAdminSupportType(a.type) && a.status === 'resolved';
    const bIsResolvedSupport = isAdminSupportType(b.type) && b.status === 'resolved';

    if (Boolean(a.needs_reply) !== Boolean(b.needs_reply)) return a.needs_reply ? -1 : 1;
    if (aIsResolvedSupport !== bIsResolvedSupport) {
      return aIsResolvedSupport ? 1 : -1;
    }

    return (Date.parse(b.last_message_at || b.updated_at || '') || 0) - (Date.parse(a.last_message_at || a.updated_at || '') || 0);
  });
}

function mergeMonitorInquiry(
  base: MonitorInquiry | null | undefined,
  patch: Partial<MonitorInquiry> | null | undefined
): MonitorInquiry | null {
  if (!base && !patch) {
    return null;
  }

  if (base?.updated_at && patch?.updated_at && Date.parse(base.updated_at) > Date.parse(patch.updated_at)) return base;
  const nextBase = base ?? null;
  const nextPatch = patch ?? {};

  const guest = nextBase?.guest || nextPatch.guest
    ? { ...(nextBase?.guest ?? {}), ...(nextPatch.guest ?? {}) }
    : undefined;
  const host = nextBase?.host || nextPatch.host
    ? { ...(nextBase?.host ?? {}), ...(nextPatch.host ?? {}) }
    : undefined;
  const experiences = nextPatch.experiences === null
    ? null
    : nextBase?.experiences || nextPatch.experiences
      ? { ...(nextBase?.experiences ?? {}), ...(nextPatch.experiences ?? {}) }
      : undefined;

  return {
    ...(nextBase ?? {}),
    ...nextPatch,
    guest,
    host,
    experiences,
  } as MonitorInquiry;
}

function isAdminSendMessageResult(value: unknown): value is AdminSendMessageResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    (typeof candidate.inquiryId === 'string' || typeof candidate.inquiryId === 'number') &&
    (typeof candidate.messageId === 'string' || typeof candidate.messageId === 'number') &&
    typeof candidate.displayContent === 'string' &&
    typeof candidate.updatedAt === 'string'
  );
}

export function useAdminChatQuery({ view = 'support', conversationOnly = false, enabled = true, statusFilter = 'ALL' }: {
  view?: 'support' | 'monitor'; conversationOnly?: boolean; enabled?: boolean; statusFilter?: 'ALL' | 'open' | 'in_progress' | 'resolved';
} = {}) {
  const attention = useAdminAttention();
  const [inquiries, setInquiries] = useState<MonitorInquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<MonitorInquiry | null>(null);
  const [messages, setMessages] = useState<MonitorMessage[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const pagesRef = useRef(1);
  const [error, setError] = useState<string | undefined>();
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [ackFailure, setAckFailure] = useState<string | null>(null);
  const [ackAttempt, setAckAttempt] = useState(0);
  const [messageError, setMessageError] = useState<string | undefined>();

  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();

  const inquiriesRef = useRef<MonitorInquiry[]>([]);
  const selectedInquiryRef = useRef<MonitorInquiry | null>(null);
  const messagesRef = useRef<MonitorMessage[]>([]);
  const deletedMessageIdsRef = useRef(new Set<string>());
  const fetchInquiriesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inquiryRequestVersionRef = useRef(0);
  const messageRequestVersionRef = useRef(0);
  const messageFlightRef = useRef<{
    targetId: string;
    refreshRequested: boolean;
    promise: Promise<boolean>;
  } | null>(null);
  const localMessagesRef = useRef(new Map<string, Map<string, { message: MonitorMessage; version: number }>>());
  const observedOwnRowsRef = useRef(new Map<string, MonitorMessage>());
  const acknowledgedSnapshotsRef = useRef(new Set<string>());
  const attemptedAcknowledgementsRef = useRef(new Set<string>());
  const pendingAcknowledgementsRef = useRef(new Set<string>());
  const renderedSnapshotRef = useRef<{ inquiryId: string; messages: MonitorMessage[]; unread: number; version: number; requestVersion: number } | null>(null);
  const threadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeHealthyRef = useRef(false);
  const scheduleFallbackRef = useRef<() => void>(() => {});

  const getAuthenticatedUser = useCallback(async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser((previousUser) => previousUser?.id === user.id ? previousUser : user);
    }
    return user;
  }, [supabase]);

  const syncSelectedInquiryFromRows = useCallback((nextInquiries: MonitorInquiry[]) => {
    if (!selectedInquiryRef.current) return;

    const selectedId = String(selectedInquiryRef.current.id);
    const nextSelected = nextInquiries.find((inquiry) => String(inquiry.id) === selectedId);

    if (!nextSelected) return;

    const mergedSelected = mergeMonitorInquiry(selectedInquiryRef.current, nextSelected);
    if (!mergedSelected) return;

    selectedInquiryRef.current = mergedSelected;
    setSelectedInquiry(mergedSelected);
  }, []);

  const commitInquiries = useCallback((nextInquiries: MonitorInquiry[]) => {
    const sortedInquiries = sortMonitorInquiries(nextInquiries);
    inquiriesRef.current = sortedInquiries;
    setInquiries(sortedInquiries);
    syncSelectedInquiryFromRows(sortedInquiries);
  }, [syncSelectedInquiryFromRows]);

  const patchInquiry = useCallback((inquiryId: number | string, patch: Partial<MonitorInquiry>) => {
    const targetId = String(inquiryId);
    let found = false;

    const nextInquiries = inquiriesRef.current.map((inquiry) => {
      if (String(inquiry.id) !== targetId) {
        return inquiry;
      }

      found = true;
      return mergeMonitorInquiry(inquiry, patch) ?? inquiry;
    });

    if (!found) return;
    commitInquiries(nextInquiries);
  }, [commitInquiries]);

  const patchInquiryPreview = useCallback((inquiryId: number | string, patch: InquiryPreviewPatch) => {
    patchInquiry(inquiryId, patch);
  }, [patchInquiry]);

  const fetchInquiries = useCallback(async (showLoading = true, more = false) => {
    if (!enabled) return;
    const requestVersion = ++inquiryRequestVersionRef.current;
    if (showLoading && inquiriesRef.current.length === 0) setIsLoading(true);
    setError(undefined);

    try {
      const user = await getAuthenticatedUser();
      if (!user) {
        if (requestVersion === inquiryRequestVersionRef.current) {
          setIsLoading(false);
        }
        return;
      }

      if (conversationOnly) return;
      const requestedPages = pagesRef.current + (more ? 1 : 0);
      const nextInquiries: MonitorInquiry[] = [];
      let nextHasMore = false;
      for (let page = 0; page < requestedPages; page += 1) {
        const params = new URLSearchParams({ view, offset: String(page * 50), limit: '50' });
        if (view === 'support' && statusFilter !== 'ALL') params.set('status', statusFilter);
        const deepLink = new URLSearchParams(window.location.search).get('inquiryId');
        if (deepLink && page === 0) params.set('inquiryId', deepLink);
        const response = await fetch('/api/admin/inquiries' + `?${params.toString()}`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || '목록을 불러오지 못했습니다.');
        }

        nextInquiries.push(...(Array.isArray(result.data) ? result.data as MonitorInquiry[] : []));
        nextHasMore = Boolean(result.pagination?.hasMore);
        if (!nextHasMore) break;
      }
      if (requestVersion !== inquiryRequestVersionRef.current) return;
      pagesRef.current = requestedPages;
      setHasMore(nextHasMore);
      const existing = new Map(inquiriesRef.current.map(row => [String(row.id), row]));
      commitInquiries([...new Map(nextInquiries.map(row => [String(row.id), row])).values()]
        .map(row => mergeMonitorInquiry(existing.get(String(row.id)), row) ?? row));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '로딩 오류';
      console.error('[AdminChatQuery] fetchInquiries error:', err);
      if (requestVersion === inquiryRequestVersionRef.current) {
        setError(msg);
      }
    } finally {
      if (requestVersion === inquiryRequestVersionRef.current) {
        setIsLoading(false);
      }
    }
  }, [commitInquiries, getAuthenticatedUser, view, conversationOnly, enabled, statusFilter]);

  const fetchMessages = useCallback(async (
    inquiryId: number | string,
    options: { select?: boolean } = {}
  ) => {
    const shouldSelect = options.select === true;
    const targetId = String(inquiryId);

    if (!shouldSelect && String(selectedInquiryRef.current?.id ?? '') !== targetId) {
      return false;
    }

    if (shouldSelect) {
      const selectedFromList = inquiriesRef.current.find((inquiry) => String(inquiry.id) === targetId)
        ?? (conversationOnly ? { id: inquiryId, user_id: '' } : null);
      if (!selectedFromList) return false;

      selectedInquiryRef.current = selectedFromList;
      setSelectedInquiry(selectedFromList);
      messagesRef.current = [];
      setMessages([]);
      setMessageError(undefined);
      setIsMessagesLoading(true);
    }

    const requestVersion = ++messageRequestVersionRef.current;
    const attentionVersion = attention?.version(targetId) ?? 0;

    try {
      const response = await fetch(`/api/admin/inquiries/${inquiryId}/messages`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '메시지를 불러오지 못했습니다.');
      }

      if (
        requestVersion !== messageRequestVersionRef.current ||
        String(selectedInquiryRef.current?.id ?? '') !== targetId
      ) {
        return false;
      }

      const fetched = (Array.isArray(result.data) ? result.data as MonitorMessage[] : [])
        .filter(row => !deletedMessageIdsRef.current.has(String(row.id)));
      const local = localMessagesRef.current.get(targetId);
      const merged = new Map(fetched.map((message) => {
        const id = String(message.id), protectedRow = local?.get(id);
        if (protectedRow && requestVersion <= protectedRow.version) return [id, protectedRow.message] as const;
        local?.delete(id);
        return [id, message] as const;
      }));
      for (const [id, row] of local || []) if (!merged.has(id)) merged.set(id, row.message);
      const nextMessages = [...merged.values()].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
      messagesRef.current = nextMessages;
      setMessages(nextMessages);
      setMessageError(undefined);

      const inquiryDetail = typeof result.inquiry === 'object' && result.inquiry !== null
          ? result.inquiry as Partial<MonitorInquiry>
          : null;
      const selectedFromList = inquiriesRef.current.find((inquiry) => String(inquiry.id) === targetId);
      const nextSelected = mergeMonitorInquiry(
        selectedInquiryRef.current && String(selectedInquiryRef.current.id) === String(inquiryId)
          ? selectedInquiryRef.current
          : selectedFromList,
        inquiryDetail
      );
      if (nextSelected) {
        selectedInquiryRef.current = nextSelected;
        setSelectedInquiry(nextSelected);
      }
      if (inquiryDetail) patchInquiry(inquiryId, inquiryDetail);

      // This snapshot is eligible only after React commits the successful thread.
      renderedSnapshotRef.current = {
        inquiryId: targetId, messages: fetched, unread: Number(inquiryDetail?.admin_unread_count ?? 0),
        version: attentionVersion, requestVersion,
      };

      return true;
    } catch (err: unknown) {
      console.error('[AdminChatQuery] loadMessages error:', err);
      if (
        requestVersion === messageRequestVersionRef.current &&
        String(selectedInquiryRef.current?.id ?? '') === targetId
      ) {
        if (shouldSelect || messagesRef.current.length === 0) {
          setMessageError('메시지를 불러오지 못했습니다. 다시 시도해주세요.');
        } else {
          showToast('메시지를 불러오지 못했습니다.', 'error');
        }
      }
      return false;
    } finally {
      if (
        requestVersion === messageRequestVersionRef.current &&
        String(selectedInquiryRef.current?.id ?? '') === targetId
      ) {
        setIsMessagesLoading(false);
      }
    }
  }, [patchInquiry, showToast, conversationOnly, attention]);

  useEffect(() => {
    const captured = renderedSnapshotRef.current;
    if (!enabled || document.visibilityState === 'hidden' || isMessagesLoading || messageError || !captured || !captured.messages.length || captured.unread <= 0
      || captured.inquiryId !== String(selectedInquiry?.id)) return;
    const renderedIds = new Set(messages.map(row => String(row.id)));
    if (!captured.messages.every(row => renderedIds.has(String(row.id)))) return;
    const ids = captured.messages.map(row => String(row.id)).sort();
    const snapshot = `${captured.inquiryId}:${ids.join(',')}`;
    if (acknowledgedSnapshotsRef.current.has(snapshot) || pendingAcknowledgementsRef.current.has(snapshot)) return;
    const attempt = `${snapshot}:${captured.requestVersion}:${ackAttempt}`;
    if (attemptedAcknowledgementsRef.current.has(attempt)) return;
    attemptedAcknowledgementsRef.current.add(attempt);
    if (attemptedAcknowledgementsRef.current.size > 100) attemptedAcknowledgementsRef.current.delete(attemptedAcknowledgementsRef.current.values().next().value!);
    const throughMessageId = ids.reduce((last, id) => BigInt(id) > BigInt(last) ? id : last);
    pendingAcknowledgementsRef.current.add(snapshot);
    void fetch(`/api/admin/inquiries/${captured.inquiryId}/ack`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ throughMessageId, messageIds: ids }), signal: AbortSignal.timeout(15_000),
    }).then(async response => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error('Acknowledgement failed');
      setAckFailure(previous => previous === captured.inquiryId ? null : previous);
      acknowledgedSnapshotsRef.current.add(snapshot);
      if (acknowledgedSnapshotsRef.current.size > 100) acknowledgedSnapshotsRef.current.delete(acknowledgedSnapshotsRef.current.values().next().value!);
      if (typeof result.admin_unread_count === 'number') {
        if (attention) attention.applyAcknowledgement(captured.inquiryId, result.admin_unread_count, captured.version);
        else patchInquiry(captured.inquiryId, { admin_unread_count: result.admin_unread_count });
      }
    }).catch(() => setAckFailure(captured.inquiryId)).finally(() => pendingAcknowledgementsRef.current.delete(snapshot));
  }, [messages, selectedInquiry, enabled, isMessagesLoading, messageError, attention, patchInquiry, ackAttempt]);

  useEffect(() => {
    if (!attention || !enabled) return;
    const observedVersions = new Map<string, number>();
    return attention.subscribe(() => {
      const rows = Object.values(attention.getSnapshot().conversations);
      for (const activity of rows) {
        if (inquiriesRef.current.some(row => String(row.id) === String(activity.inquiry_id))) {
          patchInquiry(activity.inquiry_id, { ...activity, content: activity.last_message_content });
        } else if (!conversationOnly && activity.surface === view && Number(activity.admin_unread_count) > 0
          && attention.version(String(activity.inquiry_id)) > (observedVersions.get(String(activity.inquiry_id)) ?? 0)) {
          observedVersions.set(String(activity.inquiry_id), attention.version(String(activity.inquiry_id)));
          // A genuinely new conversation needs its participant metadata once.
          if (fetchInquiriesTimerRef.current) clearTimeout(fetchInquiriesTimerRef.current);
          fetchInquiriesTimerRef.current = setTimeout(() => { fetchInquiriesTimerRef.current = null; void fetchInquiries(false); }, 250);
        }
      }
    });
  }, [attention, enabled, patchInquiry, conversationOnly, view, fetchInquiries]);

  const loadMessages = useCallback((
    inquiryId: number | string,
    options: { select?: boolean } = {}
  ): Promise<boolean> => {
    const targetId = String(inquiryId);
    const pending = messageFlightRef.current;
    if (pending?.targetId === targetId && String(selectedInquiryRef.current?.id ?? '') === targetId) {
      // Share the initial load. A background invalidation may have happened after
      // its snapshot, so coalesce the burst into one serialized trailing refresh.
      pending.refreshRequested ||= !options.select;
      return pending.promise;
    }
    if (!options.select && String(selectedInquiryRef.current?.id ?? '') !== targetId) {
      return Promise.resolve(false);
    }

    const flight = { targetId, refreshRequested: false, promise: Promise.resolve(false) };
    messageFlightRef.current = flight;
    flight.promise = (async () => {
      try {
        let loaded = await fetchMessages(inquiryId, options);
        // Each completed GET settles its own UI lifecycle before revalidation.
        // Changing A -> B -> A creates a new owner, even when the ID matches.
        while (flight.refreshRequested && messageFlightRef.current === flight) {
          flight.refreshRequested = false;
          loaded = await fetchMessages(inquiryId);
        }
        return loaded;
      } finally {
        if (messageFlightRef.current === flight) messageFlightRef.current = null;
      }
    })();
    return flight.promise;
  }, [fetchMessages]);

  // Subscription/auth effect restarts do not own the selected thread's GET.
  // Only unmount, deselection or a newer request invalidates its response.
  useEffect(() => () => {
    messageRequestVersionRef.current++;
    messageFlightRef.current = null;
  }, []);

  const selectInquiry = useCallback((inquiryId: number | string) => {
    return loadMessages(inquiryId, { select: true });
  }, [loadMessages]);

  const retrySelectedInquiry = useCallback(() => {
    if (!selectedInquiryRef.current) return Promise.resolve(false);
    return loadMessages(selectedInquiryRef.current.id, { select: true });
  }, [loadMessages]);

  const sendMessage = async (inquiryId: number | string, content: string): Promise<AdminSendMessageResult> => {
    const cleanContent = sanitizeText(content);
    if (!cleanContent.trim()) {
      throw new Error('메시지 전송에 실패했습니다.');
    }

    try {
      const response = await fetch('/api/inquiries/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryId,
          content: cleanContent,
          type: 'text',
        }),
      });

      const result: unknown = await response.json();

      if (
        !response.ok ||
        typeof result !== 'object' ||
        result === null ||
        !('success' in result) ||
        result.success !== true ||
        !isAdminSendMessageResult(result)
      ) {
        const errorMessage =
          typeof result === 'object' &&
          result !== null &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : '메시지 전송에 실패했습니다.';
        throw new Error(errorMessage);
      }

      const currentInquiry = inquiriesRef.current.find((inquiry) => String(inquiry.id) === String(inquiryId));
      if (!currentInquiry || result.updatedAt >= String(currentInquiry.updated_at || '')) patchInquiryPreview(inquiryId, {
        content: result.displayContent,
        updated_at: result.updatedAt,
        last_message_at: result.message?.created_at ?? null,
        last_sender_role: 'admin',
        needs_reply: false,
        reply_waiting_since: null,
        has_policy_signal: false,
        policy_signal_categories: [],
      });
      const targetId = String(inquiryId);
      if (result.message && String(result.message.id) === String(result.messageId)
        && String(result.message.inquiry_id) === targetId && typeof result.message.content === 'string'
        && typeof result.message.sender_id === 'string' && typeof result.message.created_at === 'string') {
        const observed = (String(selectedInquiryRef.current?.id) === targetId ? messagesRef.current.find((message) => String(message.id) === String(result.messageId)) : undefined)
          || observedOwnRowsRef.current.get(String(result.messageId));
        const canonicalRow = { ...result.message, ...observed };
        const canonical = normalizeServerMessage({
          ...canonicalRow,
          sender: observed?.sender || { name: OFFICIAL_SUPPORT_SENDER_NAME },
        });
        const local = localMessagesRef.current.get(targetId) || new Map();
        local.set(String(result.messageId), { message: canonical, version: messageRequestVersionRef.current });
        localMessagesRef.current.set(targetId, local);
        if (String(selectedInquiryRef.current?.id) === targetId) {
          const merged = new Map(messagesRef.current.map((message) => [String(message.id), message]));
          merged.set(String(result.messageId), canonical);
          messagesRef.current = [...merged.values()].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
          setMessages(messagesRef.current);
        }
      } else {
        // Compatibility with an older API response during a rolling release.
        await loadMessages(inquiryId);
      }
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      showToast('메시지 전송 실패: ' + message, 'error');
      throw err instanceof Error ? err : new Error(message);
    }
  };

  const clearSelected = useCallback(() => {
    messageRequestVersionRef.current += 1;
    messageFlightRef.current = null;
    selectedInquiryRef.current = null;
    messagesRef.current = [];
    setSelectedInquiry(null);
    setMessages([]);
    setIsMessagesLoading(false);
    setMessageError(undefined);
  }, []);

  const scheduleFetchInquiries = useCallback((delay = 250) => {
    if (fetchInquiriesTimerRef.current) {
      clearTimeout(fetchInquiriesTimerRef.current);
    }

    fetchInquiriesTimerRef.current = setTimeout(() => {
      fetchInquiriesTimerRef.current = null;
      void fetchInquiries(false);
    }, delay);
  }, [fetchInquiries]);

  const catchUpRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!enabled || !currentUser) return;
    let stopped = false;
    let running = false;
    let requested = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const catchUp = async () => {
      if (stopped || document.visibilityState === 'hidden') return;
      const selectedId = selectedInquiryRef.current?.id;
      // Queue detail invalidations immediately; loadMessages serializes them.
      // The list loop below must not enqueue the same detail refresh again.
      const messages = selectedId != null ? loadMessages(selectedId) : Promise.resolve();
      if (running) { requested = true; return; }
      running = true;
      try {
        do {
          requested = false;
          await Promise.allSettled([
            fetchInquiries(false),
            messages,
          ]);
        } while (requested && !stopped && !document.hidden);
      } finally { running = false; }
    };
    catchUpRef.current = () => { void catchUp(); };
    const tick = () => {
      void catchUp();
      scheduleFallback();
    };
    // A quiet connected channel still needs a slow safety net when a table is
    // missing from the publication. Disconnected channels retry more promptly.
    const scheduleFallback = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(tick, realtimeHealthyRef.current ? 300_000 : 60_000);
    };
    scheduleFallbackRef.current = scheduleFallback;
    const visible = () => { if (document.visibilityState === 'visible') void catchUp(); };
    window.addEventListener('online', catchUpRef.current);
    document.addEventListener('visibilitychange', visible);
    scheduleFallback();
    const online = catchUpRef.current;
    return () => {
      stopped = true;
      catchUpRef.current = () => {};
      scheduleFallbackRef.current = () => {};
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [enabled, currentUser, fetchInquiries, loadMessages]);

  // 실시간 구독 로직
  useEffect(() => {
    pagesRef.current = 1;
    void fetchInquiries();
    const version = inquiryRequestVersionRef;
    return () => { version.current++; };
  }, [fetchInquiries]);

  useEffect(() => {
    if (!currentUser || !enabled) return;

    let disposed = false;
    realtimeHealthyRef.current = false;
    scheduleFallbackRef.current();
    const channel = supabase
      .channel(`admin-chat-realtime-${currentUser.id}-${conversationOnly ? 'detail' : view}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inquiry_messages' },
        (payload) => {
          const newPayload = payload.new as InquiryMessageRealtimeRow | null;
          // The same administrator can send from another browser tab. Apply the
          // canonical row directly; waiting for this tab's send response loses it.
          const own = payload.new as MonitorMessage;
          if (own?.sender_id === currentUser.id && own.id != null && own.inquiry_id != null
            && typeof own.content === 'string' && typeof own.created_at === 'string') {
            if (deletedMessageIdsRef.current.has(String(own.id))) return;
            const observed = observedOwnRowsRef.current.get(String(own.id))
              ?? messagesRef.current.find(row => String(row.id) === String(own.id));
            // A duplicate INSERT must not undo a later read/deletion UPDATE.
            const canonical = normalizeServerMessage({ ...own, ...observed, sender: { name: OFFICIAL_SUPPORT_SENDER_NAME } });
            observedOwnRowsRef.current.set(String(own.id), canonical);
            if (observedOwnRowsRef.current.size > 100) observedOwnRowsRef.current.delete(observedOwnRowsRef.current.keys().next().value!);
            const local = localMessagesRef.current.get(String(own.inquiry_id)) || new Map();
            local.set(String(own.id), { message: canonical, version: messageRequestVersionRef.current });
            localMessagesRef.current.set(String(own.inquiry_id), local);
            if (String(selectedInquiryRef.current?.id) === String(own.inquiry_id)) {
              const rows = new Map(messagesRef.current.map(row => [String(row.id), row]));
              rows.set(String(own.id), canonical);
              messagesRef.current = [...rows.values()].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
              setMessages(messagesRef.current);
            }
          }
          if (newPayload && newPayload.sender_id !== currentUser.id) {
            if (!attention) scheduleFetchInquiries();
            // 현재 열려있는 탭의 메시지인 경우 즉시 메시지 갱신
            if (selectedInquiryRef.current && String(newPayload.inquiry_id) === String(selectedInquiryRef.current.id)) {
              if (!attention) void loadMessages(selectedInquiryRef.current.id);
              else {
                if (threadTimerRef.current) clearTimeout(threadTimerRef.current);
                threadTimerRef.current = setTimeout(() => { threadTimerRef.current = null; const id = selectedInquiryRef.current?.id; if (id != null) void loadMessages(id); }, 250);
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'inquiry_messages' },
        (payload) => {
          const newPayload = payload.new as InquiryMessageRealtimeRow | null;
          const oldPayload = payload.old as InquiryMessageRealtimeRow | null;
          const inquiryId = newPayload?.inquiry_id || oldPayload?.inquiry_id;
          if (!inquiryId) return;
          const raw = newPayload as Partial<MonitorMessage> | null;
          if (raw?.id != null && raw.sender_id === currentUser.id) {
            const observed = { ...observedOwnRowsRef.current.get(String(raw.id)), ...raw } as MonitorMessage;
            observedOwnRowsRef.current.set(String(raw.id), {
              ...(typeof observed.content === 'string' ? normalizeServerMessage(observed) : observed),
              sender: { name: OFFICIAL_SUPPORT_SENDER_NAME },
            });
            if (typeof observed.content === 'string' && typeof observed.created_at === 'string') {
              const local = localMessagesRef.current.get(String(inquiryId)) || new Map();
              local.set(String(raw.id), { message: observedOwnRowsRef.current.get(String(raw.id))!, version: messageRequestVersionRef.current });
              localMessagesRef.current.set(String(inquiryId), local);
            }
            if (observedOwnRowsRef.current.size > 100) observedOwnRowsRef.current.delete(observedOwnRowsRef.current.keys().next().value!);
          }
          if (!selectedInquiryRef.current) return;
          if (raw?.id != null) {
            const index = messagesRef.current.findIndex((message) => String(message.id) === String(raw.id));
            if (index >= 0) {
              const updated = { ...messagesRef.current[index], ...raw };
              const normalized = normalizeServerMessage(updated);
              messagesRef.current = messagesRef.current.map((message, i) => i === index ? normalized : message);
              setMessages(messagesRef.current);
              const local = localMessagesRef.current.get(String(inquiryId)) || new Map();
              local.set(String(raw.id), { message: normalized, version: messageRequestVersionRef.current });
              localMessagesRef.current.set(String(inquiryId), local);
              return;
            }
          }

          if (
            String(inquiryId) === String(selectedInquiryRef.current.id)
          ) {
            const currentMessage = messagesRef.current.find(
              (message) => String(message.id) === String(newPayload?.id ?? oldPayload?.id ?? '')
            );
            const displayContentChanged =
              newPayload?.type === SOFT_DELETED_INQUIRY_MESSAGE_TYPE ||
              Boolean(currentMessage && (
                (newPayload?.type !== undefined && newPayload.type !== currentMessage.type) ||
                (newPayload?.content !== undefined && newPayload.content !== currentMessage.content) ||
                (newPayload?.image_url !== undefined && newPayload.image_url !== currentMessage.image_url)
              ));

            if (displayContentChanged) {
              loadMessages(selectedInquiryRef.current.id);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'inquiry_messages' },
        payload => {
          const id = String((payload.old as InquiryMessageRealtimeRow)?.id ?? '');
          if (!id) return;
          // DELETE may contain only the primary key. Keep a tombstone so a GET
          // captured before the deletion cannot resurrect the removed message.
          deletedMessageIdsRef.current.add(id);
          observedOwnRowsRef.current.delete(id);
          for (const local of localMessagesRef.current.values()) local.delete(id);
          if (messagesRef.current.some(row => String(row.id) === id)) {
            messagesRef.current = messagesRef.current.filter(row => String(row.id) !== id);
            setMessages(messagesRef.current);
          }
          if (!attention) scheduleFetchInquiries();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'inquiries' },
        (payload) => {
          const newPayload = payload.new as InquiryRealtimeRow | null;
          if (!newPayload?.id) return;
          // 문의 상태 변경, 내용 업데이트 시
          if (!attention) scheduleFetchInquiries();
          // 열려있는 문의가 업데이트 된 경우 객체 갱신
          if (selectedInquiryRef.current && String(newPayload.id) === String(selectedInquiryRef.current.id)) {
             const nextSelected = mergeMonitorInquiry(selectedInquiryRef.current, newPayload);
             if (nextSelected) {
               selectedInquiryRef.current = nextSelected;
               setSelectedInquiry(nextSelected);
             }
          }
        }
      )
      .subscribe(status => {
        if (disposed) return;
        realtimeHealthyRef.current = status === 'SUBSCRIBED';
        scheduleFallbackRef.current();
        if (status === 'SUBSCRIBED') catchUpRef.current();
      });

    return () => {
      if (fetchInquiriesTimerRef.current) {
        clearTimeout(fetchInquiriesTimerRef.current);
      }
      if (threadTimerRef.current) clearTimeout(threadTimerRef.current);
      disposed = true;
      realtimeHealthyRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUser, loadMessages, scheduleFetchInquiries, enabled, conversationOnly, view, attention]);

  return {
    inquiries,
    selectedInquiry,
    messages,
    isLoading,
    error,
    isMessagesLoading,
    messageError,
    acknowledgementFailed: ackFailure === String(selectedInquiry?.id),
    retryAcknowledgement: () => setAckAttempt(value => value + 1),
    loadMessages,
    selectInquiry,
    retrySelectedInquiry,
    sendMessage,
    clearSelected,
    refresh: fetchInquiries,
    hasMore,
    loadMore: () => fetchInquiries(false, true),
  };
}
