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

      // 1. 문의(inquiries)와 체험(experiences) 데이터 가져오기
      let query = supabase
        .from('inquiries')
        .select(`
          *,
          experiences (id, title, photos, image_url, host_id), 
          guest:profiles!inquiries_user_id_fkey (*)
        `)
        .order('updated_at', { ascending: false });

      if (role === 'guest') query = query.eq('user_id', user.id);
      else if (role === 'host') query = query.eq('host_id', user.id).eq('type', 'general');

      const { data: inquiriesData, error } = await query;
      if (error) throw error;
      
      if (inquiriesData) {
        // 2. 호스트 ID 목록 추출 (중복 제거)
        const hostIds = Array.from(new Set(inquiriesData.map(item => item.host_id).filter(Boolean)));

        // 3. [핵심] Profiles(프로필)와 Host_Applications(신청서) 두 곳에서 정보 조회
        const [profilesRes, appsRes] = await Promise.all([
          supabase.from('profiles').select('*').in('id', hostIds),
          supabase.from('host_applications').select('*').in('user_id', hostIds)
        ]);

        const profilesMap = new Map(profilesRes.data?.map(p => [p.id, p]));
        const appsMap = new Map(appsRes.data?.map(a => [a.user_id, a]));

        // 4. 데이터 병합 (ExperienceClient.tsx와 동일한 우선순위 적용)
        const safeData = inquiriesData.map(item => {
          const profile = profilesMap.get(item.host_id);
          const app = appsMap.get(item.host_id);
          
          // 호스트 정보 조립: 신청서 정보 우선 -> 프로필 정보 -> 기본값
          const hostName = app?.name || profile?.name || profile?.full_name || 'Locally Host';
          const hostAvatar = app?.profile_photo || profile?.avatar_url || null;

          const rawGuest = item.guest;

          return {
            ...item,
            guest: rawGuest ? { ...rawGuest, avatar_url: secureUrl(rawGuest.avatar_url) } : null,
            // 호스트 객체 완성
            host: {
              id: item.host_id,
              name: hostName,
              full_name: hostName, // 호환성을 위해 둘 다 넣어줌
              avatar_url: secureUrl(hostAvatar)
            },
            experiences: item.experiences ? {
              ...item.experiences,
              image_url: secureUrl(item.experiences.image_url || item.experiences.photos?.[0])
            } : null
          };
        });
        
        setInquiries(safeData);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, role]);

  const loadMessages = async (inquiryId: number) => {
    try {
      // 메시지 로드
      const { data, error } = await supabase
        .from('inquiry_messages')
        .select(`*, sender:profiles!inquiry_messages_sender_id_fkey (*)`)
        .eq('inquiry_id', inquiryId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      if (data) {
        // 메시지 내의 sender 정보는 profiles 테이블에 의존하므로, 
        // 만약 여기서도 사진이 안 나오면 위와 같은 로직이 필요하지만,
        // 일단 메시지 리스트는 sender 정보만으로 충분한 경우가 많습니다.
        const safeMessages = data.map(msg => ({
          ...msg,
          sender: msg.sender ? { ...msg.sender, avatar_url: secureUrl(msg.sender.avatar_url) } : null
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
    } catch (err: any) { 
      showToast("메시지 전송 실패: " + err.message, 'error');
    }
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
      host: { name: hostData.name, full_name: hostData.name, avatar_url: hostData.avatarUrl || null },
      experiences: { id: expData.id, title: expData.title },
      content: ''
    });
  };

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  return { inquiries, selectedInquiry, messages, currentUser, isLoading, loadMessages, sendMessage, createInquiry, startNewChat, refresh: fetchInquiries };
}