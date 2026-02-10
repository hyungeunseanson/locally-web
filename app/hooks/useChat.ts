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

  // ✅ 채팅방 목록 및 안 읽은 메시지, 프로필 정보 가져오기
  const fetchInquiries = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }
      setCurrentUser(user);

      // 1. 문의(채팅방) 목록 조회
      let query = supabase
        .from('inquiries')
        .select(`*, experiences (id, title, photos, image_url, host_id)`)
        .order('updated_at', { ascending: false });

      if (role === 'guest') query = query.eq('user_id', user.id);
      else if (role === 'host') query = query.eq('host_id', user.id).eq('type', 'general');

      const { data: inquiriesData, error } = await query;
      if (error) throw error;
      
      if (inquiriesData && inquiriesData.length > 0) {
        const inquiryIds = inquiriesData.map(i => i.id);
        const hostIds = Array.from(new Set(inquiriesData.map(item => item.host_id).filter(Boolean)));
        const guestIds = Array.from(new Set(inquiriesData.map(item => item.user_id).filter(Boolean)));

        // 2. 병렬 데이터 조회 (프로필, 호스트신청서, 안 읽은 메시지)
        const [profilesRes, appsRes, guestProfilesRes, unreadRes] = await Promise.all([
          supabase.from('profiles').select('*').in('id', hostIds),
          supabase.from('host_applications').select('*').in('user_id', hostIds),
          supabase.from('profiles').select('*').in('id', guestIds),
          // 안 읽은 메시지 카운트 (내가 보낸 게 아닌 것 중 is_read가 false인 것)
          supabase.from('inquiry_messages')
            .select('inquiry_id')
            .in('inquiry_id', inquiryIds)
            .eq('is_read', false)
            .neq('sender_id', user.id) 
        ]);

        const profilesMap = new Map(profilesRes.data?.map(p => [p.id, p]));
        const appsMap = new Map(appsRes.data?.map(a => [a.user_id, a]));
        const guestMap = new Map(guestProfilesRes.data?.map(g => [g.id, g]));

        // 안 읽은 메시지 개수 계산
        const unreadCounts:Record<number, number> = {};
        unreadRes.data?.forEach((msg: any) => {
          unreadCounts[msg.inquiry_id] = (unreadCounts[msg.inquiry_id] || 0) + 1;
        });

        // 3. 데이터 매핑 (이름/사진 우선순위 적용)
        const safeData = inquiriesData.map(item => {
          // 호스트 정보: 신청서(host_applications) 우선 -> 없으면 프로필
          const hostApp = appsMap.get(item.host_id);
          const hostProfile = profilesMap.get(item.host_id);
          
          const hostName = hostApp?.name || hostProfile?.full_name || hostProfile?.email?.split('@')[0] || '호스트';
          const hostAvatar = hostApp?.profile_photo || hostProfile?.avatar_url;

          // 게스트 정보: 프로필 우선
          const guestProfile = guestMap.get(item.user_id);
          const guestName = guestProfile?.full_name || guestProfile?.email?.split('@')[0] || '게스트';
          const guestAvatar = guestProfile?.avatar_url;

          return {
            ...item,
            unread_count: unreadCounts[item.id] || 0, // 🔴 안 읽은 메시지 수
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

  // ✅ 메시지 읽음 처리 함수
  const markAsRead = async (inquiryId: number) => {
    if (!currentUser) return;
    
    // UI 즉시 업데이트 (N 배지 제거)
    setInquiries(prev => prev.map(inq => 
      inq.id === inquiryId ? { ...inq, unread_count: 0 } : inq
    ));

    // DB 업데이트: 상대방이 보낸 메시지를 읽음으로 변경
    await supabase
      .from('inquiry_messages')
      .update({ is_read: true })
      .eq('inquiry_id', inquiryId)
      .neq('sender_id', currentUser.id); // 내가 보낸 건 건드리지 않음
  };

  const loadMessages = async (inquiryId: number) => {
    try {
      // 1. 메시지 로드
      const { data, error } = await supabase
        .from('inquiry_messages')
        .select(`*`)
        .eq('inquiry_id', inquiryId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      if (data) {
        const senderIds = Array.from(new Set(data.map(m => m.sender_id)));
        
        // 2. 메시지 보낸 사람 정보 병렬 조회 (호스트앱 + 프로필 둘 다 체크)
        const [proRes, appRes] = await Promise.all([
            supabase.from('profiles').select('*').in('id', senderIds),
            supabase.from('host_applications').select('*').in('user_id', senderIds)
        ]);

        const profileMap = new Map(proRes.data?.map(p => [p.id, p]));
        const appMap = new Map(appRes.data?.map(a => [a.user_id, a]));

        const safeMessages = data.map(msg => {
          // 메시지 보낸 사람 정보 결정 로직
          const p = profileMap.get(msg.sender_id);
          const a = appMap.get(msg.sender_id);
          
          // 호스트인 경우 신청서 정보 우선, 아니면 프로필
          const name = a?.name || p?.full_name || p?.email?.split('@')[0] || '알 수 없음';
          const avatar = a?.profile_photo || p?.avatar_url;

          return {
            ...msg,
            sender: {
              id: msg.sender_id,
              name: name,
              avatar_url: secureUrl(avatar)
            }
          };
        });
        setMessages(safeMessages);
      }

      // 3. 선택된 채팅방 설정 및 읽음 처리 호출
      const selected = inquiries.find(i => i.id === inquiryId);
      if (selected) {
          setSelectedInquiry(selected);
          markAsRead(inquiryId); // 🔴 메시지 읽음 처리 실행
      }
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