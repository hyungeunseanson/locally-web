'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/app/utils/supabase/client';

export function useChat(role: 'guest' | 'host' | 'admin' = 'guest') {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // 이미지 URL 보안 처리
  const secureUrl = (url: string) => {
    if (!url) return null;
    if (url.startsWith('http://')) return url.replace('http://', 'https://');
    return url;
  };

  const fetchInquiries = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }
      setCurrentUser(user);

      let query = supabase
        .from('inquiries')
        .select(`
          *,
          experiences (id, title, photos),
          guest:profiles!inquiries_user_id_fkey (full_name, avatar_url),
          host:profiles!inquiries_host_id_fkey (full_name, avatar_url)
        `)
        .order('updated_at', { ascending: false });

      if (role === 'guest') query = query.eq('user_id', user.id);
      else if (role === 'host') query = query.eq('host_id', user.id).eq('type', 'general');
      else if (role === 'admin') query = query.eq('type', 'admin');

      const { data, error } = await query;
      if (error) throw error;
      
      if (data) {
        const safeData = data.map(item => ({
          ...item,
          guest: item.guest ? { ...item.guest, avatar_url: secureUrl(item.guest.avatar_url) } : null,
          host: item.host ? { ...item.host, avatar_url: secureUrl(item.host.avatar_url) } : null
        }));
        setInquiries(safeData);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, role]);

  const loadMessages = async (inquiryId: number) => {
    try {
      const { data, error } = await supabase
        .from('inquiry_messages')
        .select(`*, sender:profiles!inquiry_messages_sender_id_fkey (full_name, avatar_url)`)
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
      
      const selected = inquiries.find(i => i.id === inquiryId);
      if (selected) setSelectedInquiry(selected);
    } catch (err: any) {
      console.error(err);
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

      // 전송 후 즉시 서버 데이터 갱신
      await loadMessages(inquiryId);
      fetchInquiries(); 
    } catch (err: any) {
      alert("전송 실패: " + err.message);
    }
  };

  const createInquiry = async (hostId: string, experienceId: string, content: string) => {
    if (!currentUser) throw new Error('로그인 필요');
    const { data, error } = await supabase.from('inquiries').insert([{ user_id: currentUser.id, host_id: hostId, experience_id: experienceId, content, type: 'general' }]).select().single();
    if (error) throw error;
    await sendMessage(data.id, content);
    return data;
  };

  const createAdminInquiry = async (content: string) => {
    if (!currentUser) throw new Error('로그인 필요');
    const { data, error } = await supabase.from('inquiries').insert([{ user_id: currentUser.id, content, type: 'admin', host_id: null, experience_id: null }]).select().single();
    if (error) throw error;
    await sendMessage(data.id, content);
    return data;
  };

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  return { inquiries, selectedInquiry, messages, currentUser, isLoading, error, loadMessages, sendMessage, createInquiry, createAdminInquiry, refresh: fetchInquiries };
}