'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import UsersTab from './components/UsersTab';
import BookingsTab from './components/BookingsTab';
import SalesTab from './components/SalesTab';
import AnalyticsTab from './components/AnalyticsTab';
import ManagementTab from './components/ManagementTab';
import ChatMonitor from './components/ChatMonitor'; 
import { useSearchParams } from 'next/navigation'; 
import { useToast } from '@/app/context/ToastContext'; 

export default function AdminDashboardPage() {
  const { showToast } = useToast(); 
  const [filter, setFilter] = useState('ALL'); 
  
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab')?.toUpperCase() || 'APPS';

  const [apps, setApps] = useState<any[]>([]);
  const [exps, setExps] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]); 
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]); 

  const supabase = createClient();

  useEffect(() => { 
    fetchData(); 
    
    const presenceChannel = supabase.channel('online_users')
      .on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState();
        const users = Object.values(newState).flat(); 
        const uniqueUsers = Array.from(new Map(users.map((u: any) => [u.user_id, u])).values());
        setOnlineUsers(uniqueUsers);
      })
      .subscribe();

    const bookingChannel = supabase.channel('realtime_bookings')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, (payload) => {
        setBookings(prev => [payload.new, ...prev]);
        showToast('🔔 새로운 예약이 접수되었습니다!', 'success');
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(presenceChannel); 
      supabase.removeChannel(bookingChannel);
    };
  }, []);

  const fetchData = async () => {
    try {
      const { data: appData } = await supabase.from('host_applications').select('*').order('created_at', { ascending: false });
      if (appData) setApps(appData);
      
      // 🟢 [수정] bookings(count) 제거 (단순 조회)
      const { data: expData } = await supabase.from('experiences').select('*').order('created_at', { ascending: false });
      if (expData) setExps(expData);
      
      const { data: userData } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      if (userData) setUsers(userData);
      
      // 🟢 [수정] experiences(title, price) 제거 (단순 조회)
// 🟢 [핵심 수정] 예약 데이터 조회 강화
      // - experiences(title): 체험 제목도 같이 가져옴 (관리 편의성)
      // - limit(1000): 기본 100개 제한을 풀어서 최신 1000개까지 가져오도록 설정
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('*, experiences (title), profiles (email)') 
        .order('created_at', { ascending: false }) // 최신순 정렬
        .limit(1000); // 🟢 데이터 짤림 방지

if (bookingData) {
        console.log(`✅ 예약 데이터 ${bookingData.length}개 로드 완료`); // 디버깅용 로그
        setBookings(bookingData);
      }

      const { data: reviewData } = await supabase.from('reviews').select('rating, experience_id');
      if (reviewData) setReviews(reviewData);
    } catch (error) {
      console.error("Data Fetch Error:", error);
    }
  };

// 🟢 [수정] page.tsx 내부 updateStatus 함수
// 🟢 [수정] updateStatus 함수 (체험 보완 요청 시 메시지 저장 기능 추가)
const updateStatus = async (table: 'host_applications' | 'experiences', id: string, status: string) => {
  let comment = '';
  let dbStatus = status; 

  if (status === 'rejected' || status === 'revision') {
    const input = prompt(`[${status === 'revision' ? '보완요청' : '거절'}] 사유를 입력해주세요:`);
    if (input === null) return;
    comment = input;
  } else if (status === 'approved') {
    if (!confirm('승인 처리하시겠습니까?')) return;
    if (table === 'experiences') {
      dbStatus = 'active'; 
    }
  }

  try {
    let updateData: any = { status: dbStatus };

    // 🟢 [수정] 호스트 신청뿐만 아니라 체험(experiences)도 코멘트 저장하도록 변경
    if (comment) {
        updateData.admin_comment = comment;
    }

    const { data, error } = await supabase
      .from(table)
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      alert("⚠️ 업데이트 실패: DB 정책(RLS) 문제로 수정되지 않았습니다.");
      return;
    }

    if (table === 'host_applications' && status === 'approved') {
      const app = apps.find(a => a.id === id);
      if (app) {
        await supabase.from('users').update({ role: 'host' }).eq('id', app.user_id);
      }
    }

    showToast(`성공적으로 처리되었습니다. (${dbStatus})`, 'success'); 
    await fetchData(); 
    setSelectedItem(null); 

  } catch (err: any) {
    console.error(err);
    showToast('처리 중 오류 발생: ' + err.message, 'error'); 
  }
};

  const deleteItem = async (table: string, id: string) => {
    if (!confirm('정말 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      showToast('삭제 실패: ' + error.message, 'error');
    } else { 
      showToast('삭제되었습니다.', 'success'); 
      fetchData(); 
      setSelectedItem(null); 
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      {activeTab === 'USERS' ? (
        <UsersTab users={users} onlineUsers={onlineUsers} deleteItem={deleteItem} />
      ) : activeTab === 'BOOKINGS' ? (
        <BookingsTab bookings={bookings} />
      ) : activeTab === 'SALES' ? (
        <SalesTab bookings={bookings} apps={apps} />
      ) : activeTab === 'ANALYTICS' ? (
        <AnalyticsTab bookings={bookings} users={users} exps={exps} apps={apps} reviews={reviews} />
      ) : activeTab === 'CHATS' ? (
        <ChatMonitor />
      ) : (
        <ManagementTab 
          activeTab={activeTab as any}
          filter={filter} setFilter={setFilter}
          apps={apps} exps={exps} users={users} messages={[]}
          selectedItem={selectedItem} setSelectedItem={setSelectedItem}
          updateStatus={updateStatus} deleteItem={deleteItem}
        />
      )}
    </div>
  );
}