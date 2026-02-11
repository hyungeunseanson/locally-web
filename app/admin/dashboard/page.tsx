'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import UsersTab from './components/UsersTab';
import BookingsTab from './components/BookingsTab';
import SalesTab from './components/SalesTab';
import AnalyticsTab from './components/AnalyticsTab';
import ManagementTab from './components/ManagementTab';
import ChatMonitor from './components/ChatMonitor'; // ✅ [필수] ChatMonitor 임포트
import { useSearchParams } from 'next/navigation'; // ✅ [추가] URL 탭 상태 읽기용

export default function AdminDashboardPage() {
  const [filter, setFilter] = useState('ALL'); 
  
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab')?.toUpperCase() || 'APPS';

  const [apps, setApps] = useState<any[]>([]);
  const [exps, setExps] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  // const [messages, setMessages] = useState<any[]>([]); // ❌ 더 이상 사용 안 함
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
        alert('🔔 새로운 예약이 접수되었습니다!');
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(presenceChannel); 
      supabase.removeChannel(bookingChannel);
    };
  }, []);

  const fetchData = async () => {
    const { data: appData } = await supabase.from('host_applications').select('*').order('created_at', { ascending: false });
    if (appData) setApps(appData);
    
    const { data: expData } = await supabase.from('experiences').select('*, bookings(count)').order('created_at', { ascending: false });
    if (expData) setExps(expData);
    
    const { data: userData } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (userData) setUsers(userData);
    
    const { data: bookingData } = await supabase.from('bookings').select('*, experiences(title, price)').order('created_at', { ascending: false });
    if (bookingData) setBookings(bookingData);
  };

  const updateStatus = async (table: 'host_applications' | 'experiences', id: string, status: string) => {
    let comment = '';
    
    if (status === 'rejected' || status === 'revision') {
      const input = prompt(`[${status === 'revision' ? '보완요청' : '거절'}] 사유를 입력해주세요:`);
      if (input === null) return;
      comment = input;
    } else {
      if (!confirm(`${status === 'approved' ? '승인' : '활성화'} 처리하시겠습니까?`)) return;
      if (table === 'experiences' && status === 'approved') status = 'active';
    }

    try {
      const { error } = await supabase.from(table).update({ status, admin_comment: comment }).eq('id', id);
      if (error) throw error;

      if (table === 'host_applications' && status === 'approved') {
        const app = apps.find(a => a.id === id);
        if (app) {
          await supabase.from('users').update({ role: 'host' }).eq('id', app.user_id);
        }
      }

      alert('처리되었습니다.');
      fetchData();
      setSelectedItem(null);
    } catch (err: any) {
      console.error(err);
      alert('오류가 발생했습니다: ' + err.message);
    }
  };

  const deleteItem = async (table: string, id: string) => {
    if (!confirm('정말 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      alert('삭제 실패: ' + error.message);
    } else { 
      alert('삭제되었습니다.'); 
      fetchData(); 
      setSelectedItem(null); 
    }
  };

  return (
<div className="bg-white p-6 rounded-lg shadow-sm">
      
      {/* 탭 내용 표시 부분 (기존 로직 그대로 활용) */}
      {activeTab === 'USERS' ? (
        <UsersTab users={users} onlineUsers={onlineUsers} deleteItem={deleteItem} />
      ) : activeTab === 'BOOKINGS' ? (
        <BookingsTab bookings={bookings} />
      ) : activeTab === 'SALES' ? (
<SalesTab bookings={bookings} apps={apps} />
      ) : activeTab === 'ANALYTICS' ? (
        <AnalyticsTab bookings={bookings} users={users} exps={exps} apps={apps} />
      ) : activeTab === 'CHATS' ? (
        <ChatMonitor />
      ) : (
        <ManagementTab 
          activeTab={activeTab as any} // 타입 에러 방지용 as any 추가
          filter={filter} setFilter={setFilter}
          apps={apps} exps={exps} users={users} messages={[]}
          selectedItem={selectedItem} setSelectedItem={setSelectedItem}
          updateStatus={updateStatus} deleteItem={deleteItem}
        />
      )}
    </div>
  );
}