'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';

export function useChat(role: 'guest' | 'host' | 'admin' = 'guest') {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const supabase = createClient();
  const { showToast } = useToast();

  const secureUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith('http://')) return url.replace('http://', 'https://');
    return url;
  };

  const fetchInquiries = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }
      setCurrentUser(user);

      // 1. 문의 목록 기본 조회
      let query = supabase
        .from('inquiries')
        .select(`*, experiences (id, title, photos, image_url, host_id)`)
        .order('updated_at', { ascending: false });

      if (role === 'guest') query = query.eq('user_id', user.id);
      else if (role === 'host') query = query.eq('host_id', user.id).eq('type', 'general');

      const { data: inquiriesData, error } = await query;
      if (error) throw error;
      
      if (inquiriesData && inquiriesData.length > 0) {
        // 2. 관련 사용자 ID 추출 (호스트와 게스트 모두)
        const hostIds = Array.from(new Set(inquiriesData.map(item => item.host_id).filter(Boolean)));
        const guestIds = Array.from(new Set(inquiriesData.map(item => item.user_id).filter(Boolean)));

        // 3. 프로필 및 신청서 정보 병렬 조회 (안전한 분리 조회)
        const [profilesRes, appsRes, guestProfilesRes] = await Promise.all([
          supabase.from('profiles').select('*').in('id', hostIds),
          supabase.from('host_applications').select('*').in('user_id', hostIds),
          supabase.from('profiles').select('*').in('id', guestIds) // 게스트 정보 따로 조회
        ]);

        const profilesMap = new Map(profilesRes.data?.map(p => [p.id, p]));
        const appsMap = new Map(appsRes.data?.map(a => [a.user_id, a]));
        const guestMap = new Map(guestProfilesRes.data?.map(g => [g.id, g]));

        const safeData = inquiriesData.map(item => {
          // 호스트 정보 매핑
          const profile = profilesMap.get(item.host_id);
          const app = appsMap.get(item.host_id);
          const hostName = app?.name || profile?.name || profile?.full_name || 'Locally Host';
          const hostAvatar = app?.profile_photo || profile?.avatar_url || null; // 신청서 사진 우선
          
          // 게스트 정보 매핑 (호스트 입장에서 중요)
          const guestProfile = guestMap.get(item.user_id);
          const guestName = guestProfile?.name || guestProfile?.full_name || guestProfile?.email?.split('@')[0] || '게스트';
          const guestAvatar = guestProfile?.avatar_url || null;

          return {
            ...item,
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

  const loadMessages = async (inquiryId: number) => {
    try {
      // 메시지 가져올 때도 sender 정보 안전하게 처리
      const { data, error } = await supabase
        .from('inquiry_messages')
        .select(`*`)
        .eq('inquiry_id', inquiryId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      if (data) {
        // 보낸 사람 ID 수집
        const senderIds = Array.from(new Set(data.map(m => m.sender_id)));
        const { data: senders } = await supabase.from('profiles').select('id, avatar_url').in('id', senderIds);
        const senderMap = new Map(senders?.map(s => [s.id, s]));

        const safeMessages = data.map(msg => ({
          ...msg,
          sender: {
            ...senderMap.get(msg.sender_id),
            avatar_url: secureUrl(senderMap.get(msg.sender_id)?.avatar_url)
          }
        }));
        setMessages(safeMessages);
      }
      const selected = inquiries.find(i => i.id === inquiryId);
      if (selected) setSelectedInquiry(selected);
    } catch (err: any) { console.error(err); }
  };

  const sendMessage = async (inquiryId: number, content: string) => {
    if (!content.trim() || !currentUser) return;
    try {
      const { error } = await supabase.from('inquiry_messages').insert([{ inquiry_id: inquiryId, sender_id: currentUser.id, content }]);
      if (error) throw error;
      await supabase.from('inquiries').update({ content, updated_at: new Date().toISOString() }).eq('id', inquiryId);
      await loadMessages(inquiryId);
      fetchInquiries(); 
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

  return { inquiries, selectedInquiry, messages, currentUser, isLoading, loadMessages, sendMessage, createInquiry, startNewChat, refresh: fetchInquiries };
}