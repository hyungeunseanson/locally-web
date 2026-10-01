'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { useNotification } from '@/app/context/NotificationContext';
import { sanitizeText } from '@/app/utils/sanitize';
import { CHAT_IMAGE_ATTACHMENTS_ENABLED, CHAT_IMAGE_ATTACHMENTS_UNAVAILABLE_MESSAGE } from '@/app/utils/chatAttachmentPolicy';
import { compressImage, sanitizeFileName, validateImage, isHeicValidationResult } from '@/app/utils/image';
import {
  getInquiryMessageDisplayContent,
  InquiryType,
  isAdminSupportInquiry,
  isOfficialInquirySupportMessage,
  SOFT_DELETED_INQUIRY_MESSAGE_TYPE,
} from '@/app/utils/inquiry';
import { getHostPublicProfile } from '@/app/utils/profile';
import { getPrivateChatImageDeliveryUrl } from '@/app/utils/privateStorageDelivery';
import {
  OFFICIAL_SUPPORT_AVATAR_SRC,
  OFFICIAL_SUPPORT_SENDER_NAME,
} from '@/app/utils/officialSender';

type ProfileRow = {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
};

type HostApplicationRow = {
  user_id: string;
  name?: string | null;
  profile_photo?: string | null;
};

type InquiryExperience = {
  id: number | string;
  title?: string | null;
  photos?: string[] | null;
  image_url?: string | null;
  host_id?: string | null;
};

type InquiryExperienceRelation = InquiryExperience | InquiryExperience[] | null | undefined;

type InquiryRow = {
  id: number | string;
  user_id: string;
  host_id: string | null;
  experience_id?: string | number | null;
  type?: InquiryType | string | null;
  status?: string | null;  // CS 전용 상태: 'open' | 'in_progress' | 'resolved' | null (C2C)
  content?: string;
  updated_at?: string | null;
  experiences?: InquiryExperienceRelation;
};

type InquiryListItem = InquiryRow & {
  experience_id: string | number;
  unread_count: number;
  guest?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  host?: {
    id: string | null;
    name: string;
    avatar_url: string | null;
  };
  experiences?: (InquiryExperience & { image_url?: string | null }) | null;
};

type InquiryMessageRow = {
  id: number | string;
  inquiry_id: number | string;
  sender_id: string;
  content: string;
  image_url?: string | null;
  type?: string;
  is_read?: boolean;
  read_at?: string | null;  // 상대방이 읽은 시각 (nullable, M3 신규)
  created_at: string;
};

type InquiryMessageView = InquiryMessageRow & {
  sender: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
};

type PendingInquirySend = {
  inquiryId: string;
  senderId: string;
  knownMessageIds: Set<string>;
  observedOwnRows: Map<string, InquiryMessageView>;
  observedRowVersions: Map<string, number>;
};

function sortInquiriesByUpdatedAt(items: InquiryListItem[]) {
  return [...items].sort((a, b) => new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime());
}

function normalizeInquiryExperience(experience: InquiryExperienceRelation): InquiryExperience | null {
  if (Array.isArray(experience)) return experience[0] ?? null;
  return experience ?? null;
}

type RealtimeMessagePayload = Partial<InquiryMessageRow>;

type RealtimeInquiryPayload = {
  id?: number | string;
  updated_at?: string | null;
  content?: string;
  status?: string | null;
};

const REALTIME_INQUIRY_REFRESH_DEBOUNCE_MS = 300;
const REALTIME_MESSAGE_REFRESH_DEBOUNCE_MS = 250;

function getHostInboxInquiryFilter(userId: string) {
  return `and(host_id.eq.${userId},type.eq.general),and(user_id.eq.${userId},type.in.(admin_support,admin))`;
}

export function useChat(role: 'guest' | 'host' | 'admin' = 'guest') {
  const [inquiries, setInquiries] = useState<InquiryListItem[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryListItem | null>(null);
  const [messages, setMessages] = useState<InquiryMessageView[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);
  const { showToast, showHeicUnsupportedToast } = useToast();
  const { notifications } = useNotification();

  // 실시간 이벤트 중복 수신 방지 (메시지 id 단위)
  const observedMessageIdsRef = useRef(new Set<string>());
  const notificationLookupsRef = useRef(new Set<string>());
  const unreadRequestVersionsRef = useRef(new Map<string, number>());
  const unreadRefreshTimeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inquiryPatchVersionsRef = useRef(new Map<string, number>());
  const inboxRequestVersionRef = useRef(0);
  // 실시간 핸들러가 최신 상태를 참조하기 위한 refs (의존성 배열 안정화)
  const inquiriesRef = useRef<InquiryListItem[]>([]);
  const selectedInquiryRef = useRef<InquiryListItem | null>(null);
  const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeMessageRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPrimedNotificationsRef = useRef(false);
  const latestNotificationIdRef = useRef<number | null>(null);
  const messagesRef = useRef<InquiryMessageView[]>([]);
  const commitMessages = useCallback((update: InquiryMessageView[] | ((previous: InquiryMessageView[]) => InquiryMessageView[])) => {
    const next = typeof update === 'function' ? update(messagesRef.current) : update;
    messagesRef.current = next;
    setMessages(next);
  }, []);
  const rememberMessage = useCallback((id: number | string) => {
    const seen = observedMessageIdsRef.current;
    seen.add(String(id));
    if (seen.size > 500) seen.delete(seen.values().next().value!);
  }, []);
  const activeInquiryIdRef = useRef<string | null>(null);
  const messageRequestVersionRef = useRef(0);
  // Keep local sends until a message GET observes their canonical ID. A GET
  // started before the insert must not erase a pending or acknowledged send.
  const localMessagesRef = useRef(new Map<string, Map<string, InquiryMessageView>>());
  const localMessageAckRef = useRef(new Map<string, { requestVersion: number; hasServerSnapshot: boolean }>());
  const pendingSendRef = useRef<PendingInquirySend | null>(null);

  const mergeLocalMessages = useCallback((inquiryId: string, fetched: InquiryMessageView[], requestVersion = 0) => {
    const pending = pendingSendRef.current;
    // A locked composer allows one pending send. Until the ACK supplies its
    // exact ID, buffer new own rows instead of guessing identity from content.
    // Existing own rows and incoming messages remain visible and up to date.
    const fetchedVisible = fetched.filter((message) => {
      const id = String(message.id);
      if (pending?.inquiryId === inquiryId
        && String(message.inquiry_id) === inquiryId
        && message.sender_id === pending.senderId
        && !pending.knownMessageIds.has(id)) {
        const realtimeVersion = pending.observedRowVersions.get(id);
        if (realtimeVersion === undefined || requestVersion > realtimeVersion) {
          pending.observedOwnRows.set(id, message);
          pending.observedRowVersions.delete(id);
        }
        return false;
      }
      return true;
    });
    const local = localMessagesRef.current.get(inquiryId);
    if (!local) return fetchedVisible;
    const visible = fetchedVisible.map((message) => {
      const id = String(message.id);
      const key = `${inquiryId}:${id}`;
      const acknowledged = localMessageAckRef.current.get(key);
      if (acknowledged && requestVersion <= acknowledged.requestVersion) {
        // Pre-ACK snapshots cannot retire the protection or overwrite a
        // server row already observed before ACK (including read/deletion).
        const protectedMessage = local.get(id);
        if (protectedMessage && acknowledged.hasServerSnapshot) return protectedMessage;
        local.set(id, message);
        acknowledged.hasServerSnapshot = true;
      } else {
        local.delete(id);
        localMessageAckRef.current.delete(key);
      }
      return message;
    });
    const visibleIds = new Set(visible.map((message) => String(message.id)));
    const merged = [...visible, ...[...local.values()].filter((message) => !visibleIds.has(String(message.id)))];
    if (local.size === 0) localMessagesRef.current.delete(inquiryId);
    return merged.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, []);

  const secureUrl = (url: string | null | undefined) => {
    if (!url || url === '') return null;
    if (url.startsWith('http://')) return url.replace('http://', 'https://');
    return url;
  };

  const getAuthenticatedUser = useCallback(async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser((previousUser) => previousUser?.id === user?.id ? previousUser : user);
    return user;
  }, [supabase]);

  const fetchInquiries = useCallback(async (showLoading = true) => {
    const requestVersion = ++inboxRequestVersionRef.current;
    const patchVersions = new Map(inquiryPatchVersionsRef.current);
    if (showLoading && inquiriesRef.current.length === 0) setIsLoading(true);

    try {
      const user = await getAuthenticatedUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      let query = supabase
        .from('inquiries')
        .select('id, user_id, host_id, experience_id, type, status, content, updated_at, experiences (id, title, photos, image_url, host_id)')
        .order('updated_at', { ascending: false })
        .limit(100); // 🟢 OOM 방지 및 빠른 렌더링을 위한 최근 100개 제한

      if (role === 'guest') query = query.eq('user_id', user.id);
      else if (role === 'host') query = query.or(getHostInboxInquiryFilter(user.id));

      const { data: inquiriesData, error } = await query;
      if (error) throw error;

      const inquiryRows = [...((inquiriesData || []) as InquiryRow[])];
      const deepLinkedInquiryId = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('inquiryId')
        : null;
      if (deepLinkedInquiryId && !inquiryRows.some((item) => String(item.id) === deepLinkedInquiryId)) {
        let exactQuery = supabase
          .from('inquiries')
          .select('id, user_id, host_id, experience_id, type, status, content, updated_at, experiences (id, title, photos, image_url, host_id)')
          .eq('id', deepLinkedInquiryId);
        exactQuery = role === 'guest'
          ? exactQuery.eq('user_id', user.id)
          : exactQuery.or(getHostInboxInquiryFilter(user.id));
        const { data: exactInquiry } = await exactQuery.maybeSingle();
        if (exactInquiry) inquiryRows.unshift(exactInquiry as InquiryRow);
      }
      if (inquiryRows.length > 0) {
        const inquiryIds = inquiryRows.map((i) => i.id);
        const hostIds = Array.from(new Set(
          inquiryRows
            .filter((item) => !isAdminSupportInquiry(item.type))
            .map((item) => item.host_id)
            .filter(Boolean)
        )) as string[];
        const guestIds = Array.from(new Set(inquiryRows.map((item) => item.user_id).filter(Boolean))) as string[];

        const [profilesRes, appsRes, guestProfilesRes, unreadRes] = await Promise.all([
          supabase.from('public_profiles').select('id, full_name, avatar_url').in('id', hostIds),
          supabase.from('host_applications').select('user_id, name, profile_photo').in('user_id', hostIds),
          supabase.from('public_profiles').select('id, full_name, avatar_url').in('id', guestIds),
          supabase.from('inquiry_messages')
            .select('inquiry_id')
            .in('inquiry_id', inquiryIds)
            .eq('is_read', false)
            .neq('type', SOFT_DELETED_INQUIRY_MESSAGE_TYPE)
            .neq('sender_id', user.id)
        ]);

        const hostProfiles = (profilesRes.data || []) as ProfileRow[];
        const hostApps = (appsRes.data || []) as HostApplicationRow[];
        const guestProfiles = (guestProfilesRes.data || []) as ProfileRow[];
        const unreadRows = (unreadRes.data || []) as Array<{ inquiry_id: number | string }>;

        const profilesMap = new Map(hostProfiles.map((p) => [p.id, p]));
        const appsMap = new Map(hostApps.map((a) => [a.user_id, a]));
        const guestMap = new Map(guestProfiles.map((g) => [g.id, g]));

        const unreadCounts: Record<string, number> = {};
        unreadRows.forEach((msg) => {
          const key = String(msg.inquiry_id);
          unreadCounts[key] = (unreadCounts[key] || 0) + 1;
        });

        const safeData: InquiryListItem[] = inquiryRows.map((item) => {
          const isAdminSupport = isAdminSupportInquiry(item.type);
          const experience = normalizeInquiryExperience(item.experiences);
          const hostApp = appsMap.get(item.host_id || '');
          const hostProfile = profilesMap.get(item.host_id || '');
          const hostPublicProfile = getHostPublicProfile(hostProfile, hostApp, '호스트');

          const guestProfile = guestMap.get(item.user_id);
          const guestName = guestProfile?.full_name || '게스트';
          const guestAvatar = guestProfile?.avatar_url;

          return {
            ...item,
            experience_id: item.experience_id ?? '',
            unread_count: unreadCounts[String(item.id)] || 0,
            guest: {
              id: item.user_id,
              name: guestName,
              avatar_url: secureUrl(guestAvatar ?? null),
            },
            host: {
              id: isAdminSupport ? null : item.host_id,
              name: isAdminSupport ? OFFICIAL_SUPPORT_SENDER_NAME : hostPublicProfile.name,
              avatar_url: isAdminSupport
                ? OFFICIAL_SUPPORT_AVATAR_SRC
                : secureUrl(hostPublicProfile.avatarUrl ?? null)
            },
            experiences: experience
              ? {
                ...experience,
                image_url: secureUrl(experience.image_url || experience.photos?.[0] || null)
              }
              : null
          };
        });

        if (requestVersion !== inboxRequestVersionRef.current) return;
        const reconciled = safeData.map((item) => {
          const id = String(item.id);
          if (patchVersions.get(id) === inquiryPatchVersionsRef.current.get(id)) return item;
          const current = inquiriesRef.current.find((row) => String(row.id) === id);
          if (!current) return item;
          return { ...item, ...(String(current.updated_at || '') >= String(item.updated_at || '')
            ? { content: current.content, updated_at: current.updated_at, status: current.status } : {}), unread_count: current.unread_count };
        });
        setInquiries(sortInquiriesByUpdatedAt(reconciled));
        inquiriesRef.current = sortInquiriesByUpdatedAt(reconciled);
        const selected = selectedInquiryRef.current;
        const refreshedSelected = selected && reconciled.find((item) => String(item.id) === String(selected.id));
        if (refreshedSelected) {
          selectedInquiryRef.current = refreshedSelected;
          setSelectedInquiry(refreshedSelected);
        }
      } else {
        if (requestVersion !== inboxRequestVersionRef.current) return;
        setInquiries([]);
        inquiriesRef.current = [];
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, role, getAuthenticatedUser]);

  const markAsRead = useCallback(async (inquiryId: number | string) => {
    if (!currentUser) return;
    const targetId = String(inquiryId);
    inquiryPatchVersionsRef.current.set(targetId, (inquiryPatchVersionsRef.current.get(targetId) || 0) + 1);
    const readVersion = (unreadRequestVersionsRef.current.get(targetId) || 0) + 1;
    unreadRequestVersionsRef.current.set(targetId, readVersion);
    const unreadTimer = unreadRefreshTimeoutsRef.current.get(targetId);
    if (unreadTimer) clearTimeout(unreadTimer);
    unreadRefreshTimeoutsRef.current.delete(targetId);
    const previousInquiries = inquiriesRef.current;
    const previousSelected = selectedInquiryRef.current;
    const nextInquiries = previousInquiries.map((inq) =>
      String(inq.id) === targetId ? { ...inq, unread_count: 0 } : inq
    );

    inquiriesRef.current = nextInquiries;
    setInquiries(nextInquiries);

    if (previousSelected && String(previousSelected.id) === targetId) {
      const nextSelected = { ...previousSelected, unread_count: 0 };
      selectedInquiryRef.current = nextSelected;
      setSelectedInquiry(nextSelected);
    }

    try {
      const response = await fetch('/api/inquiries/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId }),
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || '읽음 처리에 실패했습니다.');
      }
    } catch (error) {
      console.error('[useChat] markAsRead failed:', error);
      if (unreadRequestVersionsRef.current.get(targetId) !== readVersion) return;
      inquiryPatchVersionsRef.current.set(targetId, (inquiryPatchVersionsRef.current.get(targetId) || 0) + 1);
      const restoredInquiries = inquiriesRef.current.map((inquiry) => {
        const previous = previousInquiries.find((item) => String(item.id) === targetId);
        return String(inquiry.id) === targetId && previous
          ? { ...inquiry, unread_count: previous.unread_count }
          : inquiry;
      });
      inquiriesRef.current = restoredInquiries;
      setInquiries(restoredInquiries);

      const selected = selectedInquiryRef.current;
      if (selected && String(selected.id) === targetId && previousSelected && String(previousSelected.id) === targetId) {
        const restoredSelected = { ...selected, unread_count: previousSelected.unread_count };
        selectedInquiryRef.current = restoredSelected;
        setSelectedInquiry(restoredSelected);
      }
    }
  }, [currentUser]);

  const loadMessages = useCallback(async (inquiryId: number | string) => {
    const targetId = String(inquiryId);
    const requestVersion = ++messageRequestVersionRef.current;
    const isCurrentRequest = () => messageRequestVersionRef.current === requestVersion
      && activeInquiryIdRef.current === targetId;
    const selectedThread = inquiriesRef.current.find((inquiry) => String(inquiry.id) === targetId);
    if (activeInquiryIdRef.current !== targetId) {
      activeInquiryIdRef.current = targetId;
      commitMessages(mergeLocalMessages(targetId, []));
    }
    if (selectedThread) {
      selectedInquiryRef.current = selectedThread;
      setSelectedInquiry(selectedThread);
    }

    try {
      const { data, error } = await supabase
        .from('inquiry_messages')
        .select('id, inquiry_id, sender_id, content, image_url, type, is_read, read_at, created_at')
        .eq('inquiry_id', inquiryId)
        .order('created_at', { ascending: true });

      if (!isCurrentRequest()) return;
      if (error) throw error;
      if (!data) return;

      const rawMessages = data as InquiryMessageRow[];
      const isOfficialSupportSender = (senderId: string) => isOfficialInquirySupportMessage({
        inquiryType: selectedThread?.type,
        senderId,
        guestId: selectedThread?.user_id,
        hostId: selectedThread?.host_id,
      });
      const initialSender = (senderId: string): InquiryMessageView['sender'] => {
        if (isOfficialSupportSender(senderId)) {
          return { id: senderId, name: OFFICIAL_SUPPORT_SENDER_NAME, avatar_url: OFFICIAL_SUPPORT_AVATAR_SRC };
        }
        const participant = senderId === selectedThread?.user_id ? selectedThread.guest
          : senderId === selectedThread?.host_id ? selectedThread.host : undefined;
        return { id: senderId, name: participant?.name || '알 수 없음', avatar_url: participant?.avatar_url || null };
      };
      const safeMessages: InquiryMessageView[] = rawMessages.map((msg) => ({
        ...msg,
        image_url: msg.type === 'image' && msg.image_url ? getPrivateChatImageDeliveryUrl(msg.id) : null,
        content: getInquiryMessageDisplayContent({ type: msg.type, content: msg.content }),
        created_at: msg.created_at || new Date().toISOString(),
        sender: initialSender(msg.sender_id),
      }));

      // Publish bodies before awaiting sender metadata. Only enrich sender fields
      // afterwards, so this response cannot replace a newer send or read update.
      safeMessages.forEach((message) => rememberMessage(message.id));
      commitMessages(mergeLocalMessages(targetId, safeMessages, requestVersion));
      if (selectedThread) void markAsRead(inquiryId);

      const senderIds = Array.from(new Set(
        rawMessages
          .map((message) => message.sender_id)
          .filter((senderId) => !isOfficialSupportSender(senderId))
      ));
      if (senderIds.length === 0) return;
      const [proRes, appRes] = await Promise.all([
        supabase.from('public_profiles').select('id, full_name, avatar_url').in('id', senderIds),
        supabase.from('host_applications').select('user_id, name, profile_photo').in('user_id', senderIds),
      ]);
      if (!isCurrentRequest()) return;

      const profileMap = new Map(((proRes.data || []) as ProfileRow[]).map((profile) => [profile.id, profile]));
      const appMap = new Map(((appRes.data || []) as HostApplicationRow[]).map((app) => [app.user_id, app]));
      const fetchedIds = new Set(rawMessages.map((message) => String(message.id)));
      commitMessages((previous) => previous.map((message) => {
        if (String(message.inquiry_id) !== targetId || !fetchedIds.has(String(message.id)) || isOfficialSupportSender(message.sender_id)) return message;
        const profile = profileMap.get(message.sender_id);
        const app = appMap.get(message.sender_id);
        if (!profile && !app) return message;
        const publicProfile = getHostPublicProfile(profile, app, message.sender.name);
        return { ...message, sender: { id: message.sender_id, name: publicProfile.name, avatar_url: secureUrl(publicProfile.avatarUrl ?? message.sender.avatar_url) } };
      }));
    } catch (err: unknown) {
      if (isCurrentRequest()) console.error(err);
    }
  }, [supabase, markAsRead, mergeLocalMessages, commitMessages, rememberMessage]);

  const scheduleRealtimeInquiryRefresh = useCallback(() => {
    if (realtimeRefreshTimeoutRef.current) {
      clearTimeout(realtimeRefreshTimeoutRef.current);
    }

    realtimeRefreshTimeoutRef.current = setTimeout(() => {
      realtimeRefreshTimeoutRef.current = null;
      void fetchInquiries(false);
    }, REALTIME_INQUIRY_REFRESH_DEBOUNCE_MS);
  }, [fetchInquiries]);

  const refreshSelectedInquiryMessages = useCallback((inquiryId: number | string) => {
    if (!selectedInquiryRef.current || String(selectedInquiryRef.current.id) !== String(inquiryId)) return;
    void loadMessages(inquiryId);
  }, [loadMessages]);

  const scheduleRealtimeMessageRefresh = useCallback((inquiryId: number | string, delay = REALTIME_MESSAGE_REFRESH_DEBOUNCE_MS) => {
    if (String(selectedInquiryRef.current?.id) !== String(inquiryId)) return;
    if (realtimeMessageRefreshTimeoutRef.current) clearTimeout(realtimeMessageRefreshTimeoutRef.current);
    realtimeMessageRefreshTimeoutRef.current = setTimeout(() => {
      realtimeMessageRefreshTimeoutRef.current = null;
      refreshSelectedInquiryMessages(inquiryId);
    }, delay);
  }, [refreshSelectedInquiryMessages]);

  const patchInquiry = useCallback((inquiryId: number | string, patch: Partial<InquiryListItem>) => {
    const id = String(inquiryId);
    inquiryPatchVersionsRef.current.set(id, (inquiryPatchVersionsRef.current.get(id) || 0) + 1);
    const next = sortInquiriesByUpdatedAt(inquiriesRef.current.map((item) => String(item.id) === id ? { ...item, ...patch } : item));
    inquiriesRef.current = next;
    setInquiries(next);
    if (String(selectedInquiryRef.current?.id) === id) {
      const selected = { ...selectedInquiryRef.current!, ...patch };
      selectedInquiryRef.current = selected;
      setSelectedInquiry(selected);
    }
  }, []);

  const refreshUnread = useCallback(async (inquiryId: number | string) => {
    if (!currentUser) return;
    const id = String(inquiryId);
    const version = (unreadRequestVersionsRef.current.get(id) || 0) + 1;
    unreadRequestVersionsRef.current.set(id, version);
    try {
      const { data, error } = await supabase.from('inquiry_messages').select('inquiry_id')
        .eq('inquiry_id', inquiryId).eq('is_read', false)
        .neq('type', SOFT_DELETED_INQUIRY_MESSAGE_TYPE).neq('sender_id', currentUser.id);
      if (error) throw error;
      if (unreadRequestVersionsRef.current.get(id) === version) patchInquiry(inquiryId, { unread_count: data?.length || 0 });
    } catch (error) { console.warn('[useChat] unread refresh failed:', error); }
  }, [supabase, currentUser, patchInquiry]);

  const scheduleUnreadRefresh = useCallback((inquiryId: number | string) => {
    const id = String(inquiryId), timers = unreadRefreshTimeoutsRef.current;
    const existing = timers.get(id);
    if (existing) clearTimeout(existing);
    // Bulk read UPDATEs need only one scoped unread query for this room.
    timers.set(id, setTimeout(() => {
      timers.delete(id);
      void refreshUnread(inquiryId);
    }, REALTIME_INQUIRY_REFRESH_DEBOUNCE_MS));
  }, [refreshUnread]);

  const applyMessageRow = useCallback((row: RealtimeMessagePayload, insert = false) => {
    if (row.id == null || row.inquiry_id == null) return false;
    const targetId = String(row.inquiry_id), id = String(row.id);
    const thread = inquiriesRef.current.find((item) => String(item.id) === targetId);
    if (!thread) return false;
    // A notification lookup / catch-up may already contain a newer read or
    // deleted snapshot than the INSERT payload. Never replay that old insert.
    if (insert && observedMessageIdsRef.current.has(id)) return true;
    const previous = pendingSendRef.current?.observedOwnRows.get(id)
      || localMessagesRef.current.get(targetId)?.get(id)
      || messagesRef.current.find((message) => String(message.id) === id && String(message.inquiry_id) === targetId);
    const raw = { ...previous, ...row };
    if (!raw.sender_id || typeof raw.content !== 'string' || !raw.created_at) return false;
    const official = isOfficialInquirySupportMessage({ inquiryType: thread.type, senderId: raw.sender_id, guestId: thread.user_id, hostId: thread.host_id });
    const participant = raw.sender_id === thread.user_id ? thread.guest : thread.host;
    const next: InquiryMessageView = {
      ...raw as InquiryMessageRow,
      content: getInquiryMessageDisplayContent({ type: raw.type, content: raw.content }),
      image_url: raw.type === 'image' && raw.image_url ? getPrivateChatImageDeliveryUrl(row.id) : null,
      sender: official ? { id: raw.sender_id, name: OFFICIAL_SUPPORT_SENDER_NAME, avatar_url: OFFICIAL_SUPPORT_AVATAR_SRC }
        : previous?.sender || { id: raw.sender_id, name: participant?.name || '알 수 없음', avatar_url: participant?.avatar_url || null },
    };
    rememberMessage(row.id);
    const selected = activeInquiryIdRef.current === targetId;
    if (selected || pendingSendRef.current?.inquiryId === targetId) {
      const pending = pendingSendRef.current;
      if (pending?.inquiryId === targetId && pending.senderId === next.sender_id && !pending.knownMessageIds.has(id)) {
        pending.observedOwnRows.set(id, next);
        pending.observedRowVersions.set(id, messageRequestVersionRef.current);
      } else {
        const local = localMessagesRef.current.get(targetId) || new Map<string, InquiryMessageView>();
        local.set(id, next);
        localMessagesRef.current.set(targetId, local);
        localMessageAckRef.current.set(`${targetId}:${id}`, { requestVersion: messageRequestVersionRef.current, hasServerSnapshot: true });
        if (selected) commitMessages((previousMessages) => [...new Map([...previousMessages, next].map((message) => [String(message.id), message])).values()]
          .sort((a, b) => a.created_at.localeCompare(b.created_at)));
      }
    }
    if (insert && next.created_at >= String(thread.updated_at || '')) {
      patchInquiry(thread.id, { content: next.content, updated_at: next.created_at });
    }
    if (next.sender_id !== currentUser?.id) {
      if (selected) {
        if (insert && !next.is_read && !next.read_at && next.type !== SOFT_DELETED_INQUIRY_MESSAGE_TYPE) void markAsRead(thread.id);
      } else scheduleUnreadRefresh(thread.id);
    }
    return true;
  }, [commitMessages, currentUser, markAsRead, patchInquiry, scheduleUnreadRefresh, rememberMessage]);

  const refreshNotifiedMessage = useCallback(async (inquiryId: string, messageId: string) => {
    if (observedMessageIdsRef.current.has(messageId) || notificationLookupsRef.current.has(messageId)) return;
    notificationLookupsRef.current.add(messageId);
    try {
      const { data, error } = await supabase.from('inquiry_messages')
        .select('id, inquiry_id, sender_id, content, image_url, type, is_read, read_at, created_at')
        .eq('inquiry_id', inquiryId).eq('id', messageId).maybeSingle<InquiryMessageRow>();
      if (error) throw error;
      if (observedMessageIdsRef.current.has(messageId)) return;
      if (!data || !applyMessageRow(data, true)) {
        scheduleRealtimeInquiryRefresh();
        scheduleRealtimeMessageRefresh(inquiryId);
      }
    } catch (error) {
      console.warn('[useChat] notification catch-up failed:', error);
      scheduleRealtimeInquiryRefresh();
      scheduleRealtimeMessageRefresh(inquiryId);
    } finally { notificationLookupsRef.current.delete(messageId); }
  }, [supabase, applyMessageRow, scheduleRealtimeInquiryRefresh, scheduleRealtimeMessageRefresh]);

  const sendMessage = async (inquiryId: number | string, content: string, file?: File, senderId?: string) => {
    if (!CHAT_IMAGE_ATTACHMENTS_ENABLED && file) {
      showToast(CHAT_IMAGE_ATTACHMENTS_UNAVAILABLE_MESSAGE, 'error');
      return;
    }

    const cleanContent = sanitizeText(content);
    if (!cleanContent.trim() && !file) return;

    const authUser = currentUser || (senderId ? null : await getAuthenticatedUser());
    const actorId = senderId || authUser?.id;
    if (!actorId) {
      showToast('로그인이 필요합니다.', 'error');
      throw new Error('로그인이 필요합니다.');
    }

    let imageUrl: string | null = null;
    let type = 'text';
    const shouldOptimisticallyAppend = !file && normalizedHasText(cleanContent);
    const optimisticMessageId = shouldOptimisticallyAppend ? `temp-${Date.now()}` : null;
    const optimisticCreatedAt = new Date().toISOString();
    const targetId = String(inquiryId);
    let optimisticMessage: InquiryMessageView | null = null;
    let pendingSend: PendingInquirySend | null = null;

    if (file) {
      const validation = validateImage(file);
      if (!validation.valid) {
        if (isHeicValidationResult(validation)) {
          showHeicUnsupportedToast(validation.message);
        } else {
          showToast(validation.message || '이미지 전송 실패', 'error');
        }
        return;
      }

      try {
        const compressed = await compressImage(file);
        const fileName = `${inquiryId}/${Date.now()}_${sanitizeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage
          .from('chat-images')
          .upload(fileName, compressed);

        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('chat-images').getPublicUrl(fileName);
        imageUrl = data.publicUrl;
        type = 'image';
      } catch (err) {
        console.error('Image upload failed:', err);
        showToast('이미지 전송 실패', 'error');
        return;
      }
    }

    if (shouldOptimisticallyAppend && optimisticMessageId) {
      if (pendingSendRef.current) throw new Error('메시지 전송이 진행 중입니다.');
      const knownMessageIds = new Set([
        ...messagesRef.current.filter((message) => String(message.inquiry_id) === targetId).map((message) => String(message.id)),
        ...(localMessagesRef.current.get(targetId)?.keys() || []),
      ]);
      pendingSend = { inquiryId: targetId, senderId: actorId, knownMessageIds, observedOwnRows: new Map(), observedRowVersions: new Map() };
      pendingSendRef.current = pendingSend;
      optimisticMessage = {
        id: optimisticMessageId,
        inquiry_id: inquiryId,
        sender_id: actorId,
        content: cleanContent,
        image_url: null,
        type: 'text',
        is_read: false,
        read_at: null,
        created_at: optimisticCreatedAt,
        sender: {
          id: actorId,
          name: authUser?.user_metadata?.full_name || authUser?.email || '나',
          avatar_url: authUser?.user_metadata?.avatar_url || null,
        },
      };

      const local = localMessagesRef.current.get(targetId) || new Map<string, InquiryMessageView>();
      local.set(optimisticMessageId, optimisticMessage);
      localMessagesRef.current.set(targetId, local);
      if (activeInquiryIdRef.current === targetId) {
        const pendingMessage = optimisticMessage;
        commitMessages((prev) => [...prev, pendingMessage]);
      }
    }

    try {
      const response = await fetch('/api/inquiries/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryId,
          content: cleanContent,
          imageUrl,
          type,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || '메시지 저장에 실패했습니다.');
      }

      const nextInquiries = inquiriesRef.current
        .map((inq) =>
          String(inq.id) === String(inquiryId)
            && String(result.updatedAt || '') >= String(inq.updated_at || '')
            ? {
              ...inq,
              content: String(result.displayContent || cleanContent || ''),
              updated_at: String(result.updatedAt || new Date().toISOString()),
            }
            : inq
        )
        .sort((a, b) => new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime());

      inquiriesRef.current = nextInquiries;
      setInquiries(nextInquiries);
      const updatedSelectedInquiry = nextInquiries.find((inq) => String(inq.id) === String(inquiryId)) || null;
      if (updatedSelectedInquiry && activeInquiryIdRef.current === targetId) {
        // DB 재조립 시 host.avatar_url이 placeholder/null로 내려오면 기존 정상 avatar를 보존
        const isPlaceholder = (url: string | null | undefined) =>
          !url || url === '/images/logo.png';
        const prevHost = selectedInquiryRef.current?.host;
        const mergedHost = updatedSelectedInquiry.host
          ? {
              id: updatedSelectedInquiry.host.id ?? prevHost?.id ?? null,
              name: updatedSelectedInquiry.host.name ?? prevHost?.name ?? '호스트',
              avatar_url:
                isPlaceholder(updatedSelectedInquiry.host.avatar_url) && !isPlaceholder(prevHost?.avatar_url)
                  ? prevHost?.avatar_url ?? null
                  : updatedSelectedInquiry.host.avatar_url ?? null,
            }
          : undefined;
        const mergedInquiry = { ...updatedSelectedInquiry, host: mergedHost };
        selectedInquiryRef.current = mergedInquiry;
        setSelectedInquiry(mergedInquiry);
      }

      const senderName =
        authUser?.user_metadata?.full_name ||
        authUser?.email ||
        selectedInquiryRef.current?.guest?.name ||
        selectedInquiryRef.current?.host?.name ||
        '나';
      const senderAvatar =
        authUser?.user_metadata?.avatar_url ||
        selectedInquiryRef.current?.guest?.avatar_url ||
        selectedInquiryRef.current?.host?.avatar_url ||
        null;

      rememberMessage(result.messageId);
      inquiryPatchVersionsRef.current.set(targetId, (inquiryPatchVersionsRef.current.get(targetId) || 0) + 1);
      const observedRows = pendingSend?.observedOwnRows;
      const persistedMessage: InquiryMessageView = observedRows?.get(String(result.messageId)) || (optimisticMessage
        ? { ...optimisticMessage, ...(result.message || {}), id: result.messageId }
        : {
          id: result.messageId,
          inquiry_id: inquiryId,
          sender_id: actorId,
          content: cleanContent,
          image_url: imageUrl,
          type,
          is_read: false,
          read_at: null,
          created_at: String(result.updatedAt || optimisticCreatedAt),
          sender: { id: actorId, name: senderName, avatar_url: secureUrl(senderAvatar) },
        });
      const local = localMessagesRef.current.get(targetId) || new Map<string, InquiryMessageView>();
      if (optimisticMessageId) local.delete(optimisticMessageId);
      const releasedRows = new Map(observedRows);
      releasedRows.set(String(result.messageId), persistedMessage);
      for (const [id, message] of releasedRows) {
        local.set(id, message);
        localMessageAckRef.current.set(`${targetId}:${id}`, {
          requestVersion: messageRequestVersionRef.current,
          hasServerSnapshot: observedRows?.has(id) || false,
        });
      }
      localMessagesRef.current.set(targetId, local);
      if (pendingSendRef.current === pendingSend) pendingSendRef.current = null;
      if (activeInquiryIdRef.current === targetId) {
        commitMessages((prev) => {
          const merged = new Map(prev.filter((message) => String(message.id) !== optimisticMessageId)
            .map((message) => [String(message.id), message]));
          // Publish every buffered server row; the ACK identifies which one
          // replaces the temp. Preserve its read/deleted state verbatim.
          for (const [id, message] of releasedRows) merged.set(id, message);
          return [...merged.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
        });
      }
    } catch (err: unknown) {
      const dbError = err as { code?: string, message?: string };
      let message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';

      if (dbError.code === '23503' && dbError.message?.includes('profiles')) {
        message = '프로필 동기화가 진행 중입니다. 잠시 후(5초 뒤) 메시지를 다시 보내주세요.';
      }

      if (shouldOptimisticallyAppend && optimisticMessageId) {
        const local = localMessagesRef.current.get(targetId);
        local?.delete(optimisticMessageId);
        const observedRows = pendingSend?.observedOwnRows || new Map<string, InquiryMessageView>();
        // No ACK means no proof that an observed row is this send. Release
        // server rows, but let the next GET reflect any server-side rollback.
        if (local?.size === 0) localMessagesRef.current.delete(targetId);
        if (pendingSendRef.current === pendingSend) pendingSendRef.current = null;
        if (activeInquiryIdRef.current === targetId) {
          commitMessages((prev) => {
            const merged = new Map(prev.filter((message) => String(message.id) !== optimisticMessageId)
              .map((message) => [String(message.id), message]));
            for (const [id, message] of observedRows) merged.set(id, message);
            return [...merged.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
          });
        }
      }

      showToast('메시지 전송 실패: ' + message, 'error');
      throw err instanceof Error ? err : new Error(message);
    }
  };

  const createInquiry = async (hostId: string, experienceId: string | number, content: string) => {
    const authUser = await getAuthenticatedUser();
    if (!authUser) throw new Error('로그인 필요');
    const cleanContent = sanitizeText(content).trim();

    const response = await fetch('/api/inquiries/thread', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contextType: 'experience_general',
        hostId,
        experienceId: String(experienceId),
        message: cleanContent,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result?.success || !result?.inquiryId) {
      throw new Error(result?.error || '문의방 생성에 실패했습니다.');
    }

    const currentSelected = selectedInquiryRef.current;
    const updatedAt = String(result.updatedAt || new Date().toISOString());
    const nextInquiry: InquiryListItem = {
      id: result.inquiryId as number | string,
      type: result.inquiryType || 'general',
      host_id: hostId,
      user_id: authUser.id,
      experience_id: experienceId,
      unread_count: 0,
      content: String(result.displayContent || cleanContent),
      updated_at: updatedAt,
      host: currentSelected?.host || {
        id: hostId,
        name: 'Host',
        avatar_url: null,
      },
      guest: currentSelected?.guest,
      experiences: currentSelected?.experiences || null,
    };

    const nextInquiries = sortInquiriesByUpdatedAt([
      nextInquiry,
      ...inquiriesRef.current.filter((inq) => String(inq.id) !== String(result.inquiryId)),
    ]);
    inquiriesRef.current = nextInquiries;
    setInquiries(nextInquiries);
    ++messageRequestVersionRef.current;
    activeInquiryIdRef.current = String(nextInquiry.id);
    selectedInquiryRef.current = nextInquiry;
    setSelectedInquiry(nextInquiry);

    const firstMessageId = result.messageId ?? `temp-thread-${Date.now()}`;
    commitMessages([
      {
        id: firstMessageId,
        inquiry_id: result.inquiryId,
        sender_id: authUser.id,
        content: cleanContent,
        image_url: null,
        type: 'text',
        is_read: false,
        read_at: null,
        created_at: updatedAt,
        sender: {
          id: authUser.id,
          name:
            authUser.user_metadata?.full_name ||
            currentUser?.user_metadata?.full_name ||
            authUser.email ||
            '나',
          avatar_url:
            authUser.user_metadata?.avatar_url ||
            currentUser?.user_metadata?.avatar_url ||
            null,
        },
      },
    ]);

    void fetchInquiries(false);

    return result;
  };

  const startNewChat = (hostData: { id: string; name: string; avatarUrl?: string }, expData: { id: string; title: string }) => {
    ++messageRequestVersionRef.current;
    activeInquiryIdRef.current = 'new';
    commitMessages([]);
    const nextInquiry: InquiryListItem = {
      id: 'new',
      type: 'general',
      host_id: hostData.id,
      user_id: currentUser?.id || '',
      experience_id: expData.id,
      unread_count: 0,
      host: {
        id: hostData.id,
        name: hostData.name,
        avatar_url: secureUrl(hostData.avatarUrl || null)
      },
      experiences: { id: expData.id, title: expData.title },
      content: ''
    };
    selectedInquiryRef.current = nextInquiry;
    setSelectedInquiry(nextInquiry);
  };

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  useEffect(() => {
    if (!currentUser) return;

    const unreadTimers = unreadRefreshTimeoutsRef.current;
    const inquiryRealtimeConfigs =
      role === 'guest'
        ? [{ event: 'UPDATE' as const, schema: 'public', table: 'inquiries', filter: `user_id=eq.${currentUser.id}` }]
        : role === 'host'
          ? [
              {
                event: 'UPDATE' as const,
                schema: 'public',
                table: 'inquiries',
                filter: `host_id=eq.${currentUser.id}`,
              },
              {
                event: 'UPDATE' as const,
                schema: 'public',
                table: 'inquiries',
                filter: `user_id=eq.${currentUser.id}`,
              },
            ]
          : [{ event: 'UPDATE' as const, schema: 'public', table: 'inquiries' }];

    const handleInquiryUpdate = (payload: { new: unknown }) => {
      const row = payload.new as RealtimeInquiryPayload | null;
      if (row?.id == null) return;
      const existing = inquiriesRef.current.find((item) => String(item.id) === String(row.id));
      if (!existing) { scheduleRealtimeInquiryRefresh(); return; }
      if (row.updated_at && String(row.updated_at) < String(existing.updated_at || '')) return;
      patchInquiry(row.id, {
        ...(row.content !== undefined ? { content: row.content } : {}),
        ...(row.updated_at !== undefined ? { updated_at: row.updated_at } : {}),
        ...(row.status !== undefined ? { status: row.status } : {}),
      });
    };

    const channel = supabase.channel(`chat-realtime-updates-${currentUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inquiry_messages' }, (payload) => {
        const row = payload.new as RealtimeMessagePayload | null;
        if (row && applyMessageRow(row, true)) return;
        scheduleRealtimeInquiryRefresh();
        if (row?.inquiry_id != null) scheduleRealtimeMessageRefresh(row.inquiry_id);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inquiry_messages' }, (payload) => {
        const row = payload.new as RealtimeMessagePayload | null;
        if (row && applyMessageRow(row)) return;
        // Partial payloads cannot be used to invent a row: recover once.
        const inquiryId = row?.inquiry_id || (payload.old as RealtimeMessagePayload)?.inquiry_id;
        if (inquiryId != null) {
          scheduleUnreadRefresh(inquiryId);
          scheduleRealtimeMessageRefresh(inquiryId);
        }
      });
    inquiryRealtimeConfigs.forEach((config) => channel.on('postgres_changes', config, handleInquiryUpdate));

    channel.subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;

        // Catch up once when the realtime channel becomes active so messages
        // inserted just before subscribe/reconnect are not missed.
        scheduleRealtimeInquiryRefresh();
        if (selectedInquiryRef.current) {
          scheduleRealtimeMessageRefresh(selectedInquiryRef.current.id, 0);
        }
      });

    return () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
        realtimeRefreshTimeoutRef.current = null;
      }
      if (realtimeMessageRefreshTimeoutRef.current) {
        clearTimeout(realtimeMessageRefreshTimeoutRef.current);
        realtimeMessageRefreshTimeoutRef.current = null;
      }
      for (const timer of unreadTimers.values()) clearTimeout(timer);
      unreadTimers.clear();
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUser, role, scheduleRealtimeInquiryRefresh, scheduleRealtimeMessageRefresh, applyMessageRow, scheduleUnreadRefresh, patchInquiry]);

  useEffect(() => {
    hasPrimedNotificationsRef.current = false;
    latestNotificationIdRef.current = null;
  }, [currentUser?.id]);

  useEffect(() => {
    const latestMessageNotification = notifications.find((notification) => notification.type === 'new_message');

    if (!hasPrimedNotificationsRef.current) {
      hasPrimedNotificationsRef.current = true;
      latestNotificationIdRef.current = latestMessageNotification?.id ?? null;
      return;
    }

    if (!latestMessageNotification || latestNotificationIdRef.current === latestMessageNotification.id) return;
    const messageNotifications = notifications.filter((notification) => notification.type === 'new_message');
    const previousIndex = messageNotifications.findIndex((notification) => notification.id === latestNotificationIdRef.current);
    const fresh = previousIndex >= 0 ? messageNotifications.slice(0, previousIndex) : messageNotifications;
    latestNotificationIdRef.current = latestMessageNotification.id;
    for (const notification of fresh) {
      const linkedInquiryId = getInquiryIdFromNotificationLink(notification.link);
      const messageId = getMessageIdFromNotificationLink(notification.link);
      if (linkedInquiryId && messageId) {
        void refreshNotifiedMessage(String(linkedInquiryId), messageId);
        continue;
      }
      // Older notifications carry no message identity. Keep one debounced
      // recovery query; a recent unrelated event cannot suppress catch-up.
      scheduleRealtimeInquiryRefresh();
      const selected = selectedInquiryRef.current;
      if (selected && linkedInquiryId && String(linkedInquiryId) === String(selected.id)) {
        scheduleRealtimeMessageRefresh(selected.id);
      }
    }
  }, [notifications, scheduleRealtimeInquiryRefresh, scheduleRealtimeMessageRefresh, refreshNotifiedMessage]);

  useEffect(() => {
    if (!currentUser) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      scheduleRealtimeInquiryRefresh();
      if (selectedInquiryRef.current) {
        scheduleRealtimeMessageRefresh(selectedInquiryRef.current.id, 0);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentUser, scheduleRealtimeInquiryRefresh, scheduleRealtimeMessageRefresh]);

  useEffect(() => () => { ++messageRequestVersionRef.current; }, []);

  const clearSelected = () => {
    ++messageRequestVersionRef.current;
    activeInquiryIdRef.current = null;
    selectedInquiryRef.current = null;
    setSelectedInquiry(null);
    commitMessages([]);
  };

  return {
    inquiries,
    selectedInquiry,
    messages,
    currentUser,
    isLoading,
    loadMessages,
    sendMessage,
    createInquiry,
    startNewChat,
    clearSelected,
    refresh: fetchInquiries
  };
}

function normalizedHasText(value: string) {
  return value.trim().length > 0;
}

function getInquiryIdFromNotificationLink(link: string | null | undefined) {
  if (!link) return null;

  const match = link.match(/[?&]inquiryId=([^&]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function getMessageIdFromNotificationLink(link: string | null | undefined) {
  const match = link?.match(/[?&]messageId=([^&]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
