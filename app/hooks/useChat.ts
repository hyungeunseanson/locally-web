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

      // 1. 1차 시도: JOIN을 통한 조회
      let query = supabase
        .from('inquiries')
        .select(`
          *,
          experiences (id, title, photos, image_url),
          guest:profiles!inquiries_user_id_fkey (*),
          host:profiles!inquiries_host_id_fkey (*)
        `)
        .order('updated_at', { ascending: false });

      if (role === 'guest') query = query.eq('user_id', user.id);
      else if (role === 'host') query = query.eq('host_id', user.id).eq('type', 'general');

      const { data, error } = await query;
      if (error) throw error;
      
      if (data) {
        // 2. 2차 시도: 호스트 정보가 누락된 경우 수동 조회 (FK 이름 불일치 대비)
        const missingHostIds = data
          .filter(item => !item.host && item.host_id)
          .map(item => item.host_id);

        let profilesMap: Record<string, any> = {};

        if (missingHostIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', missingHostIds);
            
          if (profiles) {
            profiles.forEach(p => { profilesMap[p.id] = p; });
          }
        }

        const safeData = data.map(item => {
          // host가 있으면 쓰고, 없으면 수동 조회한 맵에서 찾음
          const rawHost = item.host || profilesMap[item.host_id];
          const rawGuest = item.guest; // 게스트는 본인이므로 보통 있음

          return {
            ...item,
            guest: rawGuest ? { ...rawGuest, avatar_url: secureUrl(rawGuest.avatar_url) } : null,
            host: rawHost ? { ...rawHost, avatar_url: secureUrl(rawHost.avatar_url) } : null
          };
        });
        
        setInquiries(safeData);
      }
    } catch (err: any) {
      console.error(err);
      // 목록 로딩 실패는 조용히 처리
    } finally {
      setIsLoading(false);
    }
  }, [supabase, role]);

  const loadMessages = async (inquiryId: number) => {
    try {
      // 메시지 불러오기 (sender 정보 포함)
      const { data, error } = await supabase
        .from('inquiry_messages')
        .select(`*, sender:profiles!inquiry_messages_sender_id_fkey (*)`)
        .eq('inquiry_id', inquiryId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      if (data) {
        // 메시지 전송자 정보도 누락될 경우를 대비해 수동 매핑 가능하지만, 
        // 일단 메시지는 sender_id가 확실하므로 JOIN에 의존하되 에러 로그 확인
        const safeMessages = data.map(msg => ({
          ...msg,
          sender: msg.sender ? { ...msg.sender, avatar_url: secureUrl(msg.sender.avatar_url) } : null
        }));
        setMessages(safeMessages);
      }
      
      // 선택된 대화방 정보 업데이트
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
      
      // 메시지 전송 후 즉시 리로드
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