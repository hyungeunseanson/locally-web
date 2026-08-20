'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { sanitizeText } from '@/app/utils/sanitize';
import { SOFT_DELETED_INQUIRY_MESSAGE_TYPE } from '@/app/utils/inquiry';

type MonitorInquiry = {
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
};

type InquiryPreviewPatch = Partial<Pick<
  MonitorInquiry,
  'content' | 'updated_at' | 'has_policy_signal' | 'policy_signal_categories'
>>;

function isAdminSupportType(type?: string | null) {
  return type === 'admin' || type === 'admin_support';
}

function sortMonitorInquiries(items: MonitorInquiry[]) {
  return [...items].sort((a, b) => {
    const aIsResolvedSupport = isAdminSupportType(a.type) && a.status === 'resolved';
    const bIsResolvedSupport = isAdminSupportType(b.type) && b.status === 'resolved';

    if (aIsResolvedSupport !== bIsResolvedSupport) {
      return aIsResolvedSupport ? 1 : -1;
    }

    return new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime();
  });
}

function mergeMonitorInquiry(
  base: MonitorInquiry | null | undefined,
  patch: Partial<MonitorInquiry> | null | undefined
): MonitorInquiry | null {
  if (!base && !patch) {
    return null;
  }

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

export function useAdminChatQuery() {
  const [inquiries, setInquiries] = useState<MonitorInquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<MonitorInquiry | null>(null);
  const [messages, setMessages] = useState<MonitorMessage[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [messageError, setMessageError] = useState<string | undefined>();

  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();

  const inquiriesRef = useRef<MonitorInquiry[]>([]);
  const selectedInquiryRef = useRef<MonitorInquiry | null>(null);
  const messagesRef = useRef<MonitorMessage[]>([]);
  const processedEventRef = useRef<Set<string>>(new Set());
  const fetchInquiriesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inquiryRequestVersionRef = useRef(0);
  const messageRequestVersionRef = useRef(0);

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

  const fetchInquiries = useCallback(async (showLoading = true) => {
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

      const response = await fetch('/api/admin/inquiries');
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '목록을 불러오지 못했습니다.');
      }

      const nextInquiries = Array.isArray(result.data) ? result.data as MonitorInquiry[] : [];
      if (requestVersion !== inquiryRequestVersionRef.current) return;
      commitInquiries(nextInquiries);
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
  }, [commitInquiries, getAuthenticatedUser]);

  const loadMessages = useCallback(async (
    inquiryId: number | string,
    options: { select?: boolean } = {}
  ) => {
    const shouldSelect = options.select === true;
    const targetId = String(inquiryId);

    if (!shouldSelect && String(selectedInquiryRef.current?.id ?? '') !== targetId) {
      return false;
    }

    if (shouldSelect) {
      const selectedFromList = inquiriesRef.current.find((inquiry) => String(inquiry.id) === targetId);
      if (!selectedFromList) return false;

      selectedInquiryRef.current = selectedFromList;
      setSelectedInquiry(selectedFromList);
      messagesRef.current = [];
      setMessages([]);
      setMessageError(undefined);
      setIsMessagesLoading(true);
    }

    const requestVersion = ++messageRequestVersionRef.current;

    try {
      const response = await fetch(`/api/admin/inquiries/${inquiryId}/messages`);
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

      const nextMessages = Array.isArray(result.data) ? result.data as MonitorMessage[] : [];
      messagesRef.current = nextMessages;
      setMessages(nextMessages);

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
      const shouldClearUnread =
        isAdminSupportType(
          inquiryDetail?.type ??
          selectedFromList?.type ??
          selectedInquiryRef.current?.type
        );
      const mergedSelected = nextSelected && shouldClearUnread
        ? { ...nextSelected, unread_count: 0 }
        : nextSelected;

      if (mergedSelected) {
        selectedInquiryRef.current = mergedSelected;
        setSelectedInquiry(mergedSelected);
      }

      if (inquiryDetail || shouldClearUnread) {
        patchInquiry(inquiryId, {
          ...(inquiryDetail ?? {}),
          ...(shouldClearUnread ? { unread_count: 0 } : {}),
        });
      }

      return true;
    } catch (err: unknown) {
      console.error('[AdminChatQuery] loadMessages error:', err);
      if (
        requestVersion === messageRequestVersionRef.current &&
        String(selectedInquiryRef.current?.id ?? '') === targetId
      ) {
        if (shouldSelect) {
          setMessageError('메시지를 불러오지 못했습니다. 다시 시도해주세요.');
        } else {
          showToast('메시지를 불러오지 못했습니다.', 'error');
        }
      }
      return false;
    } finally {
      if (
        shouldSelect &&
        requestVersion === messageRequestVersionRef.current &&
        String(selectedInquiryRef.current?.id ?? '') === targetId
      ) {
        setIsMessagesLoading(false);
      }
    }
  }, [patchInquiry, showToast]);

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

      patchInquiryPreview(inquiryId, {
        content: result.displayContent,
        updated_at: result.updatedAt,
        has_policy_signal: false,
        policy_signal_categories: [],
      });
      await loadMessages(inquiryId);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      showToast('메시지 전송 실패: ' + message, 'error');
      throw err instanceof Error ? err : new Error(message);
    }
  };

  const clearSelected = useCallback(() => {
    messageRequestVersionRef.current += 1;
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

  // 실시간 구독 로직
  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel(`admin-chat-realtime-${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inquiry_messages' },
        (payload) => {
          const newPayload = payload.new as InquiryMessageRealtimeRow | null;
          const oldPayload = payload.old as InquiryMessageRealtimeRow | null;
          const rawId = newPayload?.id || oldPayload?.id || 'unknown';
          const eventKey = `${payload.eventType}:${rawId}`;
          
          if (processedEventRef.current.has(eventKey)) return;
          processedEventRef.current.add(eventKey);
          setTimeout(() => processedEventRef.current.delete(eventKey), 1500);

          if (newPayload && newPayload.sender_id !== currentUser.id) {
            // 현재 열려있는 탭의 메시지인 경우 즉시 메시지 갱신
            if (selectedInquiryRef.current && String(newPayload.inquiry_id) === String(selectedInquiryRef.current.id)) {
              loadMessages(selectedInquiryRef.current.id);
            } else {
              scheduleFetchInquiries();
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
          if (!inquiryId || !selectedInquiryRef.current) return;

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
        { event: 'UPDATE', schema: 'public', table: 'inquiries' },
        (payload) => {
          const newPayload = payload.new as InquiryRealtimeRow | null;
          if (!newPayload?.id) return;
          // 문의 상태 변경, 내용 업데이트 시
          scheduleFetchInquiries();
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
      .subscribe();

    return () => {
      if (fetchInquiriesTimerRef.current) {
        clearTimeout(fetchInquiriesTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUser, loadMessages, scheduleFetchInquiries]);

  return {
    inquiries,
    selectedInquiry,
    messages,
    isLoading,
    error,
    isMessagesLoading,
    messageError,
    loadMessages,
    selectInquiry,
    retrySelectedInquiry,
    sendMessage,
    clearSelected,
    refresh: fetchInquiries,
  };
}
