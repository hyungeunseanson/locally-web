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

  const fetchInquiries = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUser(user);

      // profiles 테이블 조인 (명시적 외래키 사용)
      let query = supabase
        .from('inquiries')
        .select(`
          *,
          experiences (id, title, photos),
          guest:profiles!inquiries_user_id_fkey (*),
          host:profiles!inquiries_host_id_fkey (*)
        `)
        .order('updated_at', { ascending: false });

      if (role === 'guest') {
        query = query.eq('user_id', user.id);
      } else if (role === 'host') {
        query = query.eq('host_id', user.id).eq('type', 'general');
      } else if (role === 'admin') {
        query = query.eq('type', 'admin');
      }

      const { data, error } = await query;
      if (error) throw error;
      if (data) setInquiries(data);
    } catch (err: any) {
      console.error("채팅 목록 로딩 에러:", err.message);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, role]);

  const loadMessages = async (inquiryId: number) => {
    try {
      // ✅ [핵심 수정] sender 조인 시 외래키 명시 (!inquiry_messages_sender_id_fkey)
      const { data, error } = await supabase
        .from('inquiry_messages')
        .select(`
          *,
          sender:profiles!inquiry_messages_sender_id_fkey (*)
        `)
        .eq('inquiry_id', inquiryId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setMessages(data || []);
      
      const selected = inquiries.find(i => i.id === inquiryId);
      if (selected) setSelectedInquiry(selected);
    } catch (err: any) {
      console.error("메시지 로딩 에러:", err.message);
    }
  };

  const sendMessage = async (inquiryId: number, content: string) => {
    if (!content.trim() || !currentUser) return;

    try {
      const { error } = await supabase
        .from('inquiry_messages')
        .insert([{
          inquiry_id: inquiryId,
          sender_id: currentUser.id,
          content: content
        }]);

      if (error) throw error;

      await supabase
        .from('inquiries')
        .update({ content: content, updated_at: new Date().toISOString() })
        .eq('id', inquiryId);

      const newMessage = {
        id: Date.now(),
        inquiry_id: inquiryId,
        sender_id: currentUser.id,
        content: content,
        created_at: new Date().toISOString(),
        sender: { full_name: currentUser.user_metadata?.full_name || '나' }
      };
      setMessages(prev => [...prev, newMessage]);
      fetchInquiries(); 
    } catch (err: any) {
      console.error("메시지 전송 실패:", err.message);
    }
  };

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

  const createAdminInquiry = async (content: string) => {
    if (!currentUser) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabase
      .from('inquiries')
      .insert([{
        user_id: currentUser.id,
        content: content,
        type: 'admin',
        host_id: null,
        experience_id: null
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
    createAdminInquiry,
    refresh: fetchInquiries
  };
}