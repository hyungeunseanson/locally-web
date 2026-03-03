'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { sendNotification } from '@/app/utils/notification';
import { sanitizeText } from '@/app/utils/sanitize';
import { compressImage, sanitizeFileName } from '@/app/utils/image';
import { InquiryType, isAdminSupportInquiry } from '@/app/utils/inquiry';

type ProfileRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
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

type InquiryRow = {
  id: number | string;
  user_id: string;
  host_id: string | null;
  experience_id?: string | number | null;
  type?: InquiryType | string | null;
  status?: string | null;  // CS 전용 상태: 'open' | 'in_progress' | 'resolved' | null (C2C)
  content?: string;
  updated_at?: string | null;
  experiences?: InquiryExperience | null;
};

type InquiryListItem = InquiryRow & {
  experience_id: string | number;
  unread_count: number;
  guest?: {
    id: string;
    name: string;
    avatar_url: string | null;
    email?: string | null;
  };
  host?: {
    id: string | null;
    name: string;
    avatar_url: string | null;
  };
  experiences?: (InquiryExperience & { image_url?: string | null }) | null;
};

type InquiryMessageRow = {
  id: number;
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

type RealtimeMessagePayload = {
  id?: number;
  sender_id?: string;
  inquiry_id?: number | string;
};

export function useChat(role: 'guest' | 'host' | 'admin' = 'guest') {
  const [inquiries, setInquiries] = useState<InquiryListItem[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryListItem | null>(null);
  const [messages, setMessages] = useState<InquiryMessageView[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();
  const { showToast } = useToast();

  // 실시간 이벤트 중복 수신 방지 (메시지 id 단위)
  const processedEventRef = useRef<Set<string>>(new Set());

  const secureUrl = (url: string | null | undefined) => {
    if (!url || url === '') return null;
    if (url.startsWith('http://')) return url.replace('http://', 'https://');
    return url;
  };

  const getAuthenticatedUser = useCallback(async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && (!currentUser || currentUser.id !== user.id)) {
      setCurrentUser(user);
    }
    return user;
  }, [supabase, currentUser]);

  const fetchInquiries = useCallback(async (showLoading = true) => {
    if (showLoading && inquiries.length === 0) setIsLoading(true);

    try {
      const user = await getAuthenticatedUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      let query = supabase
        .from('inquiries')
        .select('*, experiences (id, title, photos, image_url, host_id)')
        .order('updated_at', { ascending: false })
        .limit(100); // 🟢 OOM 방지 및 빠른 렌더링을 위한 최근 100개 제한

      if (role === 'guest') query = query.eq('user_id', user.id);
      else if (role === 'host') query = query.eq('host_id', user.id).eq('type', 'general');

      const { data: inquiriesData, error } = await query;
      if (error) throw error;

      const inquiryRows = (inquiriesData || []) as InquiryRow[];
      if (inquiryRows.length > 0) {
        const inquiryIds = inquiryRows.map((i) => i.id);
        const hostIds = Array.from(new Set(inquiryRows.map((item) => item.host_id).filter(Boolean))) as string[];
        const guestIds = Array.from(new Set(inquiryRows.map((item) => item.user_id).filter(Boolean))) as string[];

        const [profilesRes, appsRes, guestProfilesRes, unreadRes] = await Promise.all([
          supabase.from('profiles').select('*').in('id', hostIds),
          supabase.from('host_applications').select('*').in('user_id', hostIds),
          supabase.from('profiles').select('*').in('id', guestIds),
          supabase.from('inquiry_messages')
            .select('inquiry_id')
            .in('inquiry_id', inquiryIds)
            .eq('is_read', false)
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
          const hostApp = appsMap.get(item.host_id || '');
          const hostProfile = profilesMap.get(item.host_id || '');
          const hostName = hostApp?.name || hostProfile?.full_name || '호스트';
          const hostAvatar = hostApp?.profile_photo || hostProfile?.avatar_url;

          const guestProfile = guestMap.get(item.user_id);
          const guestName = guestProfile?.full_name || guestProfile?.email?.split('@')[0] || '게스트';
          const guestAvatar = guestProfile?.avatar_url;

          return {
            ...item,
            experience_id: item.experience_id ?? '',
            unread_count: unreadCounts[String(item.id)] || 0,
            guest: {
              id: item.user_id,
              name: guestName,
              avatar_url: secureUrl(guestAvatar ?? null),
              email: guestProfile?.email
            },
            host: {
              id: item.host_id,
              name: hostName,
              avatar_url: secureUrl(hostAvatar ?? null)
            },
            experiences: item.experiences
              ? {
                ...item.experiences,
                image_url: secureUrl(item.experiences.image_url || item.experiences.photos?.[0] || null)
              }
              : null
          };
        });

        setInquiries(safeData);
      } else {
        setInquiries([]);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, role, inquiries.length, getAuthenticatedUser]);

  const markAsRead = useCallback(async (inquiryId: number | string) => {
    if (!currentUser) return;
    setInquiries((prev) => prev.map((inq) =>
      inq.id === inquiryId ? { ...inq, unread_count: 0 } : inq
    ));

    await supabase
      .from('inquiry_messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('inquiry_id', inquiryId)
      .neq('sender_id', currentUser.id)
      .is('read_at', null);  // 이미 read_at 기록된 메시지는 덮어쓰지 않음
  }, [currentUser, supabase]);

  const loadMessages = useCallback(async (inquiryId: number | string) => {
    try {
      const { data, error } = await supabase
        .from('inquiry_messages')
        .select('*')
        .eq('inquiry_id', inquiryId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data) {
        const rawMessages = data as InquiryMessageRow[];
        const senderIds = Array.from(new Set(rawMessages.map((m) => m.sender_id)));
        const [proRes, appRes] = await Promise.all([
          supabase.from('profiles').select('*').in('id', senderIds),
          supabase.from('host_applications').select('*').in('user_id', senderIds)
        ]);

        const profileRows = (proRes.data || []) as ProfileRow[];
        const appRows = (appRes.data || []) as HostApplicationRow[];
        const profileMap = new Map(profileRows.map((p) => [p.id, p]));
        const appMap = new Map(appRows.map((a) => [a.user_id, a]));

        const safeMessages: InquiryMessageView[] = rawMessages.map((msg) => {
          const profile = profileMap.get(msg.sender_id);
          const app = appMap.get(msg.sender_id);
          const name = app?.name || profile?.full_name || '알 수 없음';
          const avatar = app?.profile_photo || profile?.avatar_url;

          return {
            ...msg,
            created_at: msg.created_at || new Date().toISOString(),
            sender: {
              id: msg.sender_id,
              name,
              avatar_url: secureUrl(avatar ?? null)
            }
          };
        });

        setMessages(safeMessages);
      }

      const selected = inquiries.find((i) => String(i.id) === String(inquiryId));
      if (selected) {
        setSelectedInquiry(selected);
        markAsRead(inquiryId);
      }
    } catch (err: unknown) {
      console.error(err);
    }
  }, [supabase, inquiries, markAsRead]);

  const sendMessage = async (inquiryId: number | string, content: string, file?: File, senderId?: string) => {
    const cleanContent = sanitizeText(content);
    if (!cleanContent.trim() && !file) return;

    const fallbackUser = senderId ? null : await getAuthenticatedUser();
    const actorId = senderId || currentUser?.id || fallbackUser?.id;
    if (!actorId) {
      showToast('로그인이 필요합니다.', 'error');
      return;
    }

    let imageUrl: string | null = null;
    let type = 'text';

    if (file) {
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

    const displayContent = cleanContent || (type === 'image' ? '📷 사진을 보냈습니다.' : '');

    setInquiries((prev) => prev.map((inq) =>
      inq.id === inquiryId
        ? { ...inq, content: displayContent, updated_at: new Date().toISOString() }
        : inq
    ).sort((a, b) => new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime()));

    try {
      const { error } = await supabase.from('inquiry_messages').insert([{
        inquiry_id: inquiryId,
        sender_id: actorId,
        content: cleanContent,
        image_url: imageUrl,
        type,
        is_read: false
      }]);

      if (error) throw error;

      await supabase.from('inquiries').update({
        content: displayContent,
        updated_at: new Date().toISOString()
      }).eq('id', inquiryId);

      await loadMessages(inquiryId);

      const currentInquiry = inquiries.find((i) => i.id === inquiryId);
      if (currentInquiry) {
        const isAdminInquiry = isAdminSupportInquiry(currentInquiry.type);
        const actorIsHost = !!currentInquiry.host_id && actorId === currentInquiry.host_id;
        const recipientId = isAdminInquiry
          ? (role === 'admin' ? currentInquiry.user_id : currentInquiry.host_id)
          : (actorIsHost ? currentInquiry.user_id : currentInquiry.host_id);

        const targetLink = isAdminInquiry
          ? (role === 'admin' ? '/guest/inbox' : '/host/dashboard?tab=inquiries')
          : (actorIsHost ? '/guest/inbox' : '/host/dashboard?tab=inquiries');

        const senderName =
          ((currentUser?.user_metadata as { full_name?: string } | undefined)?.full_name) ||
          ((fallbackUser?.user_metadata as { full_name?: string } | undefined)?.full_name) ||
          '상대방';

        const numericInquiryId = typeof inquiryId === 'number' ? inquiryId : Number(inquiryId);

        if (recipientId) {
          await sendNotification({
            recipient_id: recipientId,
            senderId: actorId,
            type: 'new_message',
            title: `💬 ${senderName}님의 새 메시지`,
            message: displayContent,
            link: targetLink,
            inquiry_id: Number.isFinite(numericInquiryId) ? numericInquiryId : undefined
          });
        }
      }

    } catch (err: unknown) {
      const dbError = err as { code?: string, message?: string };
      let message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';

      if (dbError.code === '23503' && dbError.message?.includes('profiles')) {
        message = '프로필 동기화가 진행 중입니다. 잠시 후(5초 뒤) 메시지를 다시 보내주세요.';
      }

      showToast('메시지 전송 실패: ' + message, 'error');
    }
  };

  const createInquiry = async (hostId: string, experienceId: string | number, content: string) => {
    const authUser = await getAuthenticatedUser();
    if (!authUser) throw new Error('로그인 필요');

    const { data, error } = await supabase
      .from('inquiries')
      .insert([{
        user_id: authUser.id,
        host_id: hostId,
        experience_id: String(experienceId),
        content,
        type: 'general'
      }])
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === '23503' && error.message.includes('profiles')) {
        throw new Error('프로필 동기화가 지연되고 있습니다. 잠시 후 5초 뒤에 다시 시도해주세요.');
      }
      throw error;
    }
    if (!data) throw new Error('문의방 생성에 실패했습니다.');

    await sendMessage(data.id as number | string, content, undefined, authUser.id);
    return data;
  };

  const startNewChat = (hostData: { id: string; name: string; avatarUrl?: string }, expData: { id: string; title: string }) => {
    setMessages([]);
    setSelectedInquiry({
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
    });
  };

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel(`chat-realtime-updates-${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inquiry_messages' },
        (payload) => {
          const newPayload = payload.new as RealtimeMessagePayload | null;
          const oldPayload = payload.old as RealtimeMessagePayload | null;
          const rawId = newPayload?.id || oldPayload?.id || 'unknown';
          const eventKey = `${payload.eventType}:${rawId}`;
          if (processedEventRef.current.has(eventKey)) return;
          processedEventRef.current.add(eventKey);
          setTimeout(() => processedEventRef.current.delete(eventKey), 1500);

          if (newPayload && newPayload.sender_id !== currentUser.id) {
            fetchInquiries(false);
            if (selectedInquiry && String(newPayload.inquiry_id) === String(selectedInquiry.id)) {
              loadMessages(selectedInquiry.id);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'inquiries' },
        () => fetchInquiries(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchInquiries, selectedInquiry, currentUser, loadMessages]);

  const clearSelected = () => {
    setSelectedInquiry(null);
    setMessages([]);
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
