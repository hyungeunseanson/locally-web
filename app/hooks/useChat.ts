'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { sendNotification } from '@/app/utils/notification'; // 🟢 알림 함수 임포트
import { sanitizeText } from '@/app/utils/sanitize'; // 🟢 추가

export function useChat(role: 'guest' | 'host' | 'admin' = 'guest') {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const supabase = createClient();
  const { showToast } = useToast();

  const secureUrl = (url: string | null) => {
    if (!url || url === '') return null;
    if (url.startsWith('http://')) return url.replace('http://', 'https://');
    return url;
  };

  const fetchInquiries = useCallback(async () => {
    if (inquiries.length === 0) setIsLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }
      setCurrentUser(user);

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
  }, [supabase, role]);

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

  const sendMessage = async (inquiryId: number, content: string) => {
    // 🟢 [보안] 입력값 소독 (XSS 방지)
    const cleanContent = sanitizeText(content);

    if (!cleanContent.trim() || !currentUser) return;
    
    // UI 즉시 업데이트 (소독된 내용으로 보여줌)
    setInquiries(prev => prev.map(inq => 
      inq.id === inquiryId 
        ? { ...inq, content: cleanContent, updated_at: new Date().toISOString() } 
        : inq
    ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));

    try {
      // 1. 메시지 저장 (소독된 내용만 저장)
      const { error } = await supabase.from('inquiry_messages').insert([{ 
        inquiry_id: inquiryId, 
        sender_id: currentUser.id, 
        content: cleanContent // 🟢 안전한 데이터
      }]);
      
      if (error) throw error;
      
      // 2. 채팅방 정보 업데이트
      await supabase.from('inquiries').update({ 
        content: cleanContent, // 🟢 안전한 데이터
        updated_at: new Date().toISOString() 
      }).eq('id', inquiryId);
      
      // 3. 메시지 목록 새로고침
      await loadMessages(inquiryId);
      
      // 4. 알림 발송 (기존 로직 유지)
      const currentInquiry = inquiries.find(i => i.id === inquiryId);
      if (currentInquiry) {
        const recipientId = currentUser.id === currentInquiry.host_id 
          ? currentInquiry.user_id 
          : currentInquiry.host_id;

        const targetLink = currentUser.id === currentInquiry.host_id 
          ? '/guest/inbox'            
          : '/host/dashboard?tab=chat';

        const senderName = currentUser.user_metadata?.full_name || '상대방';

        await sendNotification({
          recipient_id: recipientId,
          senderId: currentUser.id,
          type: 'new_message',
          title: `💬 ${senderName}님의 새 메시지`,
          message: cleanContent, // 🟢 알림 내용도 안전하게
          link: targetLink,
          inquiry_id: inquiryId
        });
      }

    } catch (err: any) { showToast("메시지 전송 실패: " + err.message, 'error'); }
  };

  const createInquiry = async (hostId: string, experienceId: string, content: string) => {
    if (!currentUser) throw new Error('로그인 필요');
    const { data, error } = await supabase.from('inquiries').insert([{ user_id: currentUser.id, host_id: hostId, experience_id: experienceId, content, type: 'general' }]).select().single();
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

  // 실시간 리스트 업데이트
  useEffect(() => {
    const channel = supabase
      .channel('chat-list-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inquiry_messages' },
        (payload) => {
          if (currentUser && payload.new.sender_id !== currentUser.id) {
             fetchInquiries();
          }
          
          if (selectedInquiry && payload.new.inquiry_id === selectedInquiry.id) {
             loadMessages(selectedInquiry.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchInquiries, selectedInquiry, currentUser]);

  return { inquiries, selectedInquiry, messages, currentUser, isLoading, loadMessages, sendMessage, createInquiry, startNewChat, refresh: fetchInquiries };
}