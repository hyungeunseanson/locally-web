'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/app/utils/supabase/client';

export function useChat(role: 'guest' | 'host' = 'guest') {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  // 1. 초기 로딩 (채팅방 목록)
  const fetchInquiries = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUser(user);

      const fieldToMatch = role === 'guest' ? 'user_id' : 'host_id';
      
      const { data, error } = await supabase
        .from('inquiries')
        .select(`
          *,
          experiences (id, title, image_url),
          profiles:user_id (name, avatar_url)
        `)
        .eq(fieldToMatch, user.id)
        .order('updated_at', { ascending: false });

      if (!error && data) setInquiries(data);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, role]);

  // 2. 메시지 로딩
  const loadMessages = async (inquiryId: number) => {
    const { data } = await supabase
      .from('inquiry_messages')
      .select('*')
      .eq('inquiry_id', inquiryId)
      .order('created_at', { ascending: true });
    
    setMessages(data || []);
    
    // 선택된 문의 찾기
    const selected = inquiries.find(i => i.id === inquiryId);
    if (selected) setSelectedInquiry(selected);
  };

  // 3. 메시지 전송
  const sendMessage = async (inquiryId: number, content: string) => {
    if (!content.trim() || !currentUser) return;

    const { error } = await supabase
      .from('inquiry_messages')
      .insert([{
        inquiry_id: inquiryId,
        sender_id: currentUser.id,
        content: content
      }]);

    if (!error) {
      // 낙관적 업데이트
      setMessages(prev => [...prev, {
        id: Date.now(), // 임시 ID
        inquiry_id: inquiryId,
        sender_id: currentUser.id,
        content: content,
        created_at: new Date().toISOString()
      }]);
      
      // 목록 최신화 (마지막 메시지 업데이트)
      fetchInquiries();
    }
  };

  // 4. 새 문의 생성 (게스트용)
  const createInquiry = async (hostId: string, experienceId: string, content: string) => {
    if (!currentUser) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabase
      .from('inquiries')
      .insert([{
        user_id: currentUser.id,
        host_id: hostId,
        experience_id: experienceId,
        content: content
      }])
      .select()
      .single();

    if (error) throw error;
    
    // 첫 메시지도 같이 저장
    await sendMessage(data.id, content);
    return data;
  };

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  return {
    inquiries,
    selectedInquiry,
    messages,
    currentUser,
    isLoading,
    loadMessages,
    sendMessage,
    createInquiry,
    refresh: fetchInquiries
  };
}