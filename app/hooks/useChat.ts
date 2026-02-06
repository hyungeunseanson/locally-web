'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/app/utils/supabase/client';

export function useChat(role: 'guest' | 'host' | 'admin' = 'guest') {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  // 1. 채팅방 목록 불러오기
  const fetchInquiries = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUser(user);

      let query = supabase
        .from('inquiries')
        .select(`
          *,
          experiences (id, title, image_url),
          guest:user_id (full_name, avatar_url),
          host:host_id (full_name, avatar_url)
        `)
        .order('updated_at', { ascending: false });

      // 역할별 필터링
      if (role === 'guest') {
        // 게스트: 내가 보낸 문의 (일반 + 관리자)
        query = query.eq('user_id', user.id);
      } else if (role === 'host') {
        // 호스트: 나에게 온 문의 (일반 체험 문의만)
        query = query.eq('host_id', user.id).eq('type', 'general');
      } else if (role === 'admin') {
        // 관리자: 관리자 문의만 조회
        query = query.eq('type', 'admin');
      }

      const { data, error } = await query;
      if (!error && data) setInquiries(data);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, role]);

  // 2. 메시지 불러오기
  const loadMessages = async (inquiryId: number) => {
    const { data } = await supabase
      .from('inquiry_messages')
      .select(`
        *,
        sender:sender_id (full_name)
      `)
      .eq('inquiry_id', inquiryId)
      .order('created_at', { ascending: true });
    
    setMessages(data || []);
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
      // 채팅방의 마지막 메시지 업데이트
      await supabase
        .from('inquiries')
        .update({ content: content, updated_at: new Date().toISOString() })
        .eq('id', inquiryId);

      // UI 즉시 업데이트 (낙관적 업데이트)
      const newMessage = {
        id: Date.now(),
        inquiry_id: inquiryId,
        sender_id: currentUser.id,
        content: content,
        created_at: new Date().toISOString(),
        sender: { full_name: currentUser.user_metadata?.full_name || '나' }
      };
      setMessages(prev => [...prev, newMessage]);
      fetchInquiries(); // 목록 새로고침
    }
  };

  // 4. 일반 문의 생성 (게스트 -> 호스트)
  const createInquiry = async (hostId: string, experienceId: string, content: string) => {
    if (!currentUser) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabase
      .from('inquiries')
      .insert([{
        user_id: currentUser.id,
        host_id: hostId,
        experience_id: experienceId,
        content: content,
        type: 'general'
      }])
      .select()
      .single();

    if (error) throw error;
    await sendMessage(data.id, content);
    return data;
  };

  // 5. 관리자 1:1 문의 생성 (유저 -> 관리자)
  const createAdminInquiry = async (content: string) => {
    if (!currentUser) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabase
      .from('inquiries')
      .insert([{
        user_id: currentUser.id,
        content: content,
        type: 'admin',
        host_id: null,      -- 관리자는 특정 호스트가 아님
        experience_id: null -- 특정 체험 관련이 아님
      }])
      .select()
      .single();

    if (error) throw error;
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
    createAdminInquiry, // ✅ 추가됨
    refresh: fetchInquiries
  };
}