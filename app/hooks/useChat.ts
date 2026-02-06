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

      // ✅ [수정] 명시적인 외래키 이름을 사용하여 profiles 조인
      let query = supabase
        .from('inquiries')
        .select(`
          *,
          experiences (id, title, image_url),
          guest:profiles!inquiries_user_id_fkey (full_name, avatar_url),
          host:profiles!inquiries_host_id_fkey (full_name, avatar_url)
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
      
      if (error) {
        console.error("채팅 목록 불러오기 실패:", error.message);
        return;
      }
      
      if (data) setInquiries(data);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, role]);

  const loadMessages = async (inquiryId: number) => {
    // ✅ [수정] 여기도 sender 조인 시 profiles 테이블 명시
    const { data, error } = await supabase
      .from('inquiry_messages')
      .select(`
        *,
        sender:profiles (full_name)
      `)
      .eq('inquiry_id', inquiryId)
      .order('created_at', { ascending: true });
    
    if (!error) setMessages(data || []);
    
    const selected = inquiries.find(i => i.id === inquiryId);
    if (selected) setSelectedInquiry(selected);
  };

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