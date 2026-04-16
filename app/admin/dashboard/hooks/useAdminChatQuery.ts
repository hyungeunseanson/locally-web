'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { sanitizeText } from '@/app/utils/sanitize';

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
  type?: string | null;
  sender?: { name?: string | null };
  has_policy_signal?: boolean;
  policy_signal_categories?: string[];
};

type InquiryMessageRealtimeRow = {
  id?: number | string;
  sender_id?: string;
  inquiry_id?: number | string;
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

type InquiryPreviewPatch = Pick<MonitorInquiry, 'content' | 'updated_at'>;

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

  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();

  const inquiriesRef = useRef<MonitorInquiry[]>([]);
  const selectedInquiryRef = useRef<MonitorInquiry | null>(null);
  const processedEventRef = useRef<Set<string>>(new Set());
  const fetchInquiriesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getAuthenticatedUser = useCallback(async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && (!currentUser || currentUser.id !== user.id)) {
      setCurrentUser(user);
    }
    return user;
  }, [supabase, currentUser]);

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

  const patchInquiryPreview = useCallback((inquiryId: number | string, patch: InquiryPreviewPatch) => {
    const targetId = String(inquiryId);
    const nextInquiries = inquiriesRef.current.map((inquiry) =>
      String(inquiry.id) === targetId
        ? { ...inquiry, ...patch }
        : inquiry
    );

    inquiriesRef.current = nextInquiries;
    setInquiries(nextInquiries);
    syncSelectedInquiryFromRows(nextInquiries);
  }, [syncSelectedInquiryFromRows]);

  const fetchInquiries = useCallback(async (showLoading = true) => {
    if (showLoading && inquiriesRef.current.length === 0) setIsLoading(true);
    setError(undefined);

    try {
      const user = await getAuthenticatedUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/admin/inquiries');
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '목록을 불러오지 못했습니다.');
      }

      const nextInquiries = Array.isArray(result.data) ? result.data as MonitorInquiry[] : [];
      setInquiries(nextInquiries);
      inquiriesRef.current = nextInquiries;
      syncSelectedInquiryFromRows(nextInquiries);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '로딩 오류';
      console.error('[AdminChatQuery] fetchInquiries error:', err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthenticatedUser, syncSelectedInquiryFromRows]);

  const loadMessages = useCallback(async (inquiryId: number | string) => {
    try {
      const response = await fetch(`/api/admin/inquiries/${inquiryId}/messages`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '메시지를 불러오지 못했습니다.');
      }

      setMessages(Array.isArray(result.data) ? result.data : []);

      const inquiryDetail = typeof result.inquiry === 'object' && result.inquiry !== null
        ? result.inquiry as Partial<MonitorInquiry>
        : null;
      const selectedFromList = inquiriesRef.current.find((inquiry) => String(inquiry.id) === String(inquiryId));
      const mergedSelected = mergeMonitorInquiry(
        selectedInquiryRef.current && String(selectedInquiryRef.current.id) === String(inquiryId)
          ? selectedInquiryRef.current
          : selectedFromList,
        inquiryDetail
      );

      if (mergedSelected) {
        selectedInquiryRef.current = mergedSelected;
        setSelectedInquiry(mergedSelected);
      }

      await fetchInquiries(false);
    } catch (err: unknown) {
      console.error('[AdminChatQuery] loadMessages error:', err);
      showToast('메시지를 불러오지 못했습니다.', 'error');
    }
  }, [fetchInquiries, showToast]);

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
      });
      await loadMessages(inquiryId);
      await fetchInquiries(false); // Update list snippet & timestamp
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      showToast('메시지 전송 실패: ' + message, 'error');
      throw err instanceof Error ? err : new Error(message);
    }
  };

  const clearSelected = () => {
    selectedInquiryRef.current = null;
    setSelectedInquiry(null);
    setMessages([]);
  };

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

          if (String(inquiryId) === String(selectedInquiryRef.current.id)) {
            loadMessages(selectedInquiryRef.current.id);
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
             setSelectedInquiry((prev) => prev ? { ...prev, ...newPayload } : prev);
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
    loadMessages,
    sendMessage,
    clearSelected,
    refresh: fetchInquiries,
  };
}
