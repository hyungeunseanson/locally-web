'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { sanitizeText } from '@/app/utils/sanitize';

type MonitorInquiry = {
  id: number | string;
  type?: string | null;
  guest?: { full_name?: string | null; name?: string | null; email?: string | null; avatar_url?: string | null; phone?: string | null; };
  host?: { name?: string | null; avatar_url?: string | null };
  experiences?: { title?: string | null } | null;
  user_id: string;
  updated_at?: string | null;
  content?: string | null;
  status?: string | null;
  unread_count?: number;
};

type MonitorMessage = {
  id: number | string;
  sender_id: string;
  content: string;
  sender?: { name?: string | null };
};

export function useAdminChatQuery() {
  const [inquiries, setInquiries] = useState<MonitorInquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<MonitorInquiry | null>(null);
  const [messages, setMessages] = useState<MonitorMessage[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const supabase = createClient();
  const { showToast } = useToast();

  const inquiriesRef = useRef<MonitorInquiry[]>([]);
  const selectedInquiryRef = useRef<MonitorInquiry | null>(null);
  const processedEventRef = useRef<Set<string>>(new Set());

  const getAuthenticatedUser = useCallback(async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && (!currentUser || currentUser.id !== user.id)) {
      setCurrentUser(user);
    }
    return user;
  }, [supabase, currentUser]);

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

      setInquiries(result.data);
      inquiriesRef.current = result.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '로딩 오류';
      console.error('[AdminChatQuery] fetchInquiries error:', err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthenticatedUser]);

  const loadMessages = useCallback(async (inquiryId: number | string) => {
    try {
      const response = await fetch(`/api/admin/inquiries/${inquiryId}/messages`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '메시지를 불러오지 못했습니다.');
      }

      setMessages(result.data);

      const selected = inquiriesRef.current.find((i) => String(i.id) === String(inquiryId));
      if (selected) {
        selectedInquiryRef.current = selected;
        setSelectedInquiry(selected);
      }
    } catch (err: unknown) {
      console.error('[AdminChatQuery] loadMessages error:', err);
      showToast('메시지를 불러오지 못했습니다.', 'error');
    }
  }, [showToast]);

  const sendMessage = async (inquiryId: number | string, content: string) => {
    const cleanContent = sanitizeText(content);
    if (!cleanContent.trim()) return;

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

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || '메시지 전송에 실패했습니다.');
      }

      await loadMessages(inquiryId);
      await fetchInquiries(false); // Update list snippet & timestamp
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      showToast('메시지 전송 실패: ' + message, 'error');
      throw err instanceof Error ? err : new Error(message);
    }
  };

  const clearSelected = () => {
    selectedInquiryRef.current = null;
    setSelectedInquiry(null);
    setMessages([]);
  };

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
        { event: '*', schema: 'public', table: 'inquiry_messages' },
        (payload) => {
          const newPayload = payload.new as any;
          const oldPayload = payload.old as any;
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
              // 아닌 경우 목록 갱신 (선택적 최적화 가능)
              fetchInquiries(false);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'inquiries' },
        (payload) => {
          const newPayload = payload.new as any;
          // 문의 상태 변경, 내용 업데이트 시
          fetchInquiries(false);
          // 열려있는 문의가 업데이트 된 경우 객체 갱신
          if (selectedInquiryRef.current && String(newPayload.id) === String(selectedInquiryRef.current.id)) {
             setSelectedInquiry((prev) => prev ? { ...prev, ...newPayload } : prev);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUser, fetchInquiries, loadMessages]);

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
