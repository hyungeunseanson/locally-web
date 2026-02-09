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
        const hostIds = Array.from(new Set(inquiriesData.map(item => item.host_id).filter(Boolean)));
        const [profilesRes, appsRes] = await Promise.all([
          supabase.from('profiles').select('*').in('id', hostIds),
          supabase.from('host_applications').select('*').in('user_id', hostIds)
        ]);

        const profilesMap = new Map(profilesRes.data?.map(p => [p.id, p]));
        const appsMap = new Map(appsRes.data?.map(a => [a.user_id, a]));

        const safeData = inquiriesData.map(item => {
          const profile = profilesMap.get(item.host_id);
          const app = appsMap.get(item.host_id);
          const hostName = app?.name || profile?.name || profile?.full_name || 'Locally Host';
          const hostAvatar = app?.profile_photo || profile?.avatar_url || null; // 신청서 사진 우선
          const rawGuest = item.guest;

          return {
            ...item,
            guest: rawGuest ? { ...rawGuest, avatar_url: secureUrl(rawGuest.avatar_url) } : null,
            host: {
              id: item.host_id,
              name: hostName,
              full_name: hostName,
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
    } catch (err: any) { console.error(err); } 
    finally { setIsLoading(false); }
  }, [supabase, role]);

  const loadMessages = async (inquiryId: number) => {
    try {
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

  // 🟢 [수정] startNewChat: 전달받은 avatarUrl을 강제로 사용
  const startNewChat = (hostData: { id: string; name: string; avatarUrl?: string }, expData: { id: string; title: string }) => {
    setMessages([]);
    setSelectedInquiry({
      id: 'new',
      type: 'general',
      host_id: hostData.id,
      experience_id: expData.id,
      host: { 
        name: hostData.name, 
        full_name: hostData.name, 
        avatar_url: secureUrl(hostData.avatarUrl || null) // 🟢 여기서 확실히 적용
      },
      experiences: { id: expData.id, title: expData.title },
      content: ''
    });
  };

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  // loadMessages를 외부에서 호출할 때 setSelectedInquiry가 작동하도록 반환
  // UI 컴포넌트에서 클릭 시 이 loadMessages가 호출됨
  return { inquiries, selectedInquiry, messages, currentUser, isLoading, loadMessages, sendMessage, createInquiry, startNewChat, refresh: fetchInquiries };
}