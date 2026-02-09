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

      // 🟢 [근본적 해결] 체험(experiences)을 통해 호스트 정보를 가져오는 확실한 경로 사용
      // direct_host: 혹시 모를 직접 연결 (실패해도 괜찮음)
      // experiences -> host: 이미 검증된 연결 (이걸 메인으로 사용)
      let query = supabase
        .from('inquiries')
        .select(`
          *,
          guest:profiles!inquiries_user_id_fkey (*),
          direct_host:profiles!inquiries_host_id_fkey (*),
          experiences (
            id, title, photos, image_url,
            host:profiles!experiences_host_id_fkey (*)
          )
        `)
        .order('updated_at', { ascending: false });

      if (role === 'guest') query = query.eq('user_id', user.id);
      else if (role === 'host') query = query.eq('host_id', user.id).eq('type', 'general');

      const { data, error } = await query;
      if (error) throw error;
      
      if (data) {
        const safeData = data.map(item => {
          // 🟢 호스트 정보 우선순위: 1. 직접 연결된 호스트 -> 2. 체험을 통해 연결된 호스트
          const rawHost = item.direct_host || item.experiences?.host;
          
          return {
            ...item,
            // 이제 item.host에 확실한 데이터가 들어갑니다
            host: rawHost ? { ...rawHost, avatar_url: secureUrl(rawHost.avatar_url) } : null,
            guest: item.guest ? { ...item.guest, avatar_url: secureUrl(item.guest.avatar_url) } : null,
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
      // 조용히 실패 (데이터가 없을 수도 있으므로)
    } finally {
      setIsLoading(false);
    }
  }, [supabase, role]);

  const loadMessages = async (inquiryId: number) => {
    try {
      // 메시지 로드 시 sender 정보 가져오기
      const { data, error } = await supabase
        .from('inquiry_messages')
        .select(`*, sender:profiles!inquiry_messages_sender_id_fkey (*)`)
        .eq('inquiry_id', inquiryId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      if (data) {
        const safeMessages = data.map(msg => ({
          ...msg,
          sender: msg.sender ? { ...msg.sender, avatar_url: secureUrl(msg.sender.avatar_url) } : null
        }));
        setMessages(safeMessages);
      }
      
      // 목록에서 현재 선택된 방 정보 업데이트
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