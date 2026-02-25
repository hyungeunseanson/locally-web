'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { sendNotification } from '@/app/utils/notification';
import { sanitizeText } from '@/app/utils/sanitize';
import { compressImage, sanitizeFileName } from '@/app/utils/image';

export function useChat(role: 'guest' | 'host' | 'admin' = 'guest') {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();
  const { showToast } = useToast();

  // 🟢 [추가] 실시간 중복 처리 방지를 위한 Ref
  const lastUpdateRef = useRef<number>(0);

  const secureUrl = (url: string | null) => {
    if (!url || url === '') return null;
    if (url.startsWith('http://')) return url.replace('http://', 'https://');
    return url;
  };

  const fetchInquiries = useCallback(async (showLoading = true) => {
    // 🟢 [수정] 불필요한 로딩 상태 변경 방지 (깜빡임 해결)
    if (showLoading && inquiries.length === 0) setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }
      if (!currentUser) setCurrentUser(user); // 유저 정보 한 번만 세팅

      let query = supabase
        .from('inquiries')
        .select(`*, experiences (id, title, photos, image_url, host_id)`)
        .order('updated_at', { ascending: false });

      if (role === 'guest') query = query.eq('user_id', user.id);
      else if (role === 'host') query = query.eq('host_id', user.id).eq('type', 'general');

      const { data: inquiriesData, error } = await query;
      if (error) throw error;

      if (inquiriesData && inquiriesData.length > 0) {
        const inquiryIds = inquiriesData.map(i => i.id);
        const hostIds = Array.from(new Set(inquiriesData.map(item => item.host_id).filter(Boolean)));
        const guestIds = Array.from(new Set(inquiriesData.map(item => item.user_id).filter(Boolean)));

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

        const profilesMap = new Map(profilesRes.data?.map(p => [p.id, p]));
        const appsMap = new Map(appsRes.data?.map(a => [a.user_id, a]));
        const guestMap = new Map(guestProfilesRes.data?.map(g => [g.id, g]));

        const unreadCounts: Record<number, number> = {};
        unreadRes.data?.forEach((msg: any) => {
          unreadCounts[msg.inquiry_id] = (unreadCounts[msg.inquiry_id] || 0) + 1;
        });

        const safeData = inquiriesData.map(item => {
          const hostApp = appsMap.get(item.host_id);
          const hostProfile = profilesMap.get(item.host_id);
          const hostName = hostApp?.name || hostProfile?.full_name || '호스트';
          const hostAvatar = hostApp?.profile_photo || hostProfile?.avatar_url;

          const guestProfile = guestMap.get(item.user_id);
          const guestName = guestProfile?.full_name || guestProfile?.email?.split('@')[0] || '게스트';
          const guestAvatar = guestProfile?.avatar_url;

          return {
            ...item,
            unread_count: unreadCounts[item.id] || 0,
            guest: {
              id: item.user_id,
              name: guestName,
              avatar_url: secureUrl(guestAvatar),
              email: guestProfile?.email
            },
            host: {
              id: item.host_id,
              name: hostName,
              avatar_url: secureUrl(hostAvatar)
            },
            experiences: item.experiences ? {
              ...item.experiences,
              image_url: secureUrl(item.experiences.image_url || item.experiences.photos?.[0])
            } : null
          };
        });
        setInquiries(safeData);
      } else {
        setInquiries([]);
      }
    } catch (err: any) { console.error(err); }
    finally { setIsLoading(false); }
  }, [supabase, role, currentUser]); // 의존성 최적화

  const markAsRead = async (inquiryId: number) => {
    if (!currentUser) return;
    setInquiries(prev => prev.map(inq =>
      inq.id === inquiryId ? { ...inq, unread_count: 0 } : inq
    ));
    await supabase
      .from('inquiry_messages')
      .update({ is_read: true })
      .eq('inquiry_id', inquiryId)
      .neq('sender_id', currentUser.id);
  };

  const loadMessages = async (inquiryId: number) => {
    try {
      const { data, error } = await supabase
        .from('inquiry_messages')
        .select(`*`)
        .eq('inquiry_id', inquiryId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data) {
        const senderIds = Array.from(new Set(data.map(m => m.sender_id)));
        const [proRes, appRes] = await Promise.all([
          supabase.from('profiles').select('*').in('id', senderIds),
          supabase.from('host_applications').select('*').in('user_id', senderIds)
        ]);

        const profileMap = new Map(proRes.data?.map(p => [p.id, p]));
        const appMap = new Map(appRes.data?.map(a => [a.user_id, a]));

        const safeMessages = data.map(msg => {
          const p = profileMap.get(msg.sender_id);
          const a = appMap.get(msg.sender_id);
          const name = a?.name || p?.full_name || '알 수 없음';
          const avatar = a?.profile_photo || p?.avatar_url;

          return {
            ...msg,
            sender: {
              id: msg.sender_id,
              name: name,
              avatar_url: secureUrl(avatar)
            }
          };
        });
        setMessages(safeMessages);
      }

      const selected = inquiries.find(i => i.id === inquiryId);
      if (selected) {
        setSelectedInquiry(selected);
        markAsRead(inquiryId);
      }
    } catch (err: any) { console.error(err); }
  };

  const sendMessage = async (inquiryId: number, content: string, file?: File) => {
    const cleanContent = sanitizeText(content);
    if (!cleanContent.trim() && !file) return;
    if (!currentUser) return;

    let imageUrl = null;
    let type = 'text';

    // 📸 이미지 업로드 처리
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

    // UI 낙관적 업데이트
    setInquiries(prev => prev.map(inq =>
      inq.id === inquiryId
        ? { ...inq, content: displayContent, updated_at: new Date().toISOString() }
        : inq
    ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));

    try {
      const { error } = await supabase.from('inquiry_messages').insert([{
        inquiry_id: inquiryId,
        sender_id: currentUser.id,
        content: cleanContent,
        image_url: imageUrl,
        type: type,
        is_read: false
      }]);

      if (error) throw error;

      await supabase.from('inquiries').update({
        content: displayContent,
        updated_at: new Date().toISOString()
      }).eq('id', inquiryId);

      await loadMessages(inquiryId);

      // 알림 발송
      const currentInquiry = inquiries.find(i => i.id === inquiryId);
      if (currentInquiry) {
        const recipientId = currentUser.id === currentInquiry.host_id
          ? currentInquiry.user_id
          : currentInquiry.host_id;

        const targetLink = currentUser.id === currentInquiry.host_id
          ? '/guest/inbox'
          : '/host/dashboard?tab=inquiries';

        const senderName = currentUser.user_metadata?.full_name || '상대방';

        await sendNotification({
          recipient_id: recipientId,
          senderId: currentUser.id,
          type: 'new_message',
          title: `💬 ${senderName}님의 새 메시지`,
          message: displayContent,
          link: targetLink,
          inquiry_id: inquiryId
        });
      }

    } catch (err: any) { showToast("메시지 전송 실패: " + err.message, 'error'); }
  };

  const createInquiry = async (hostId: string, experienceId: string, content: string) => {
    if (!currentUser) throw new Error('로그인 필요');
    const { data, error } = await supabase.from('inquiries').insert([{ user_id: currentUser.id, host_id: hostId, experience_id: experienceId, content, type: 'general' }]).select().maybeSingle();
    if (error) throw error;
    await sendMessage(data.id, content);
    return data;
  };

  const startNewChat = (hostData: { id: string; name: string; avatarUrl?: string }, expData: { id: string; title: string }) => {
    setMessages([]);
    setSelectedInquiry({
      id: 'new',
      type: 'general',
      host_id: hostData.id,
      experience_id: expData.id,
      host: {
        name: hostData.name,
        avatar_url: secureUrl(hostData.avatarUrl || null)
      },
      experiences: { id: expData.id, title: expData.title },
      content: ''
    });
  };

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  // 🟢 [핵심 수정] 실시간 리스트 업데이트 강화 (채널 하나로 통합 관리)
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel('chat-realtime-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inquiry_messages' },
        (payload) => {
          const now = Date.now();
          // 0.5초 내 중복 이벤트 무시 (Supabase가 가끔 이벤트를 두 번 보냄)
          if (now - lastUpdateRef.current < 500) return;
          lastUpdateRef.current = now;

          const newData = payload.new as any;
          // 내가 보낸 게 아닐 때만 갱신 (나는 이미 낙관적 업데이트 함)
          if (newData && newData.sender_id !== currentUser.id) {
            fetchInquiries(false);
            if (selectedInquiry && newData.inquiry_id === selectedInquiry.id) {
              loadMessages(selectedInquiry.id);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'inquiries' }, // 🟢 추가: 채팅방 메타데이터 변경 감지
        () => fetchInquiries(false) // 목록 순서 변경 등 반영
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchInquiries, selectedInquiry, currentUser]); // loadMessages는 의존성에서 제외 (무한루프 방지)

  const clearSelected = () => { setSelectedInquiry(null); setMessages([]); };

  return { inquiries, selectedInquiry, messages, currentUser, isLoading, loadMessages, sendMessage, createInquiry, startNewChat, clearSelected, refresh: fetchInquiries };
}