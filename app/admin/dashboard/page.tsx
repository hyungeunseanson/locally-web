'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useSearchParams, useRouter } from 'next/navigation'; 
import { useToast } from '@/app/context/ToastContext'; 

// 컴포넌트 import (경로는 그대로 유지)
import UsersTab from './components/UsersTab';
import BookingsTab from './components/BookingsTab';
import SalesTab from './components/SalesTab';
import AnalyticsTab from './components/AnalyticsTab';
import ManagementTab from './components/ManagementTab';
import ChatMonitor from './components/ChatMonitor'; 

function AdminDashboardContent() {
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

  // 데이터 로딩 (초기 1회)
  useEffect(() => { 
    fetchData(); 
    
    // 실시간 접속자 감지
    const presenceChannel = supabase.channel('online_users')
      .on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState();
        const users = Object.values(newState).flat(); 
        const uniqueUsers = Array.from(new Map(users.map((u: any) => [u.user_id, u])).values());
        setOnlineUsers(uniqueUsers);
      })
      .subscribe();

    // 실시간 예약 알림
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
      // 1. 호스트 지원서
      const { data: appData } = await supabase.from('host_applications').select('*').order('created_at', { ascending: false });
      if (appData) setApps(appData);
      
      // 2. 체험 목록
      const { data: expData } = await supabase.from('experiences').select('*').order('created_at', { ascending: false });
      if (expData) setExps(expData);
      
      // 3. 유저 목록
      const { data: userData } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      if (userData) setUsers(userData);
      
      // 4. 예약 데이터 (상세 정보 포함)
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('*, experiences (title), profiles:user_id (email)') 
        .order('created_at', { ascending: false })
        .limit(1000);
      if (bookingData) setBookings(bookingData);

      // 5. 리뷰 데이터
      const { data: reviewData } = await supabase.from('reviews').select('rating, experience_id, created_at');
      if (reviewData) setReviews(reviewData);

    } catch (error) {
      console.error("Data Fetch Error:", error);
      showToast('데이터를 불러오는 중 오류가 발생했습니다.', 'error');
    }
  };

  // 상태 업데이트 (승인/거절)
  const updateStatus = async (table: 'host_applications' | 'experiences', id: string, status: string) => {
    let comment = '';
    let dbStatus = status; 

    // 거절/보완요청 시 사유 입력
    if (status === 'rejected' || status === 'revision') {
      const input = prompt(`[${status === 'revision' ? '보완요청' : '거절'}] 사유를 입력해주세요:`);
      if (input === null) return; // 취소
      comment = input;
    } 
    // 승인 시 확인
    else if (status === 'approved') {
      if (!confirm('승인 처리하시겠습니까?')) return;
      if (table === 'experiences') {
        dbStatus = 'active'; // 체험은 승인되면 'active' 상태가 됨
      }
    }

    try {
      let updateData: any = { status: dbStatus };

      if (comment) {
          updateData.admin_comment = comment;
      }

      const { data, error } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', id)
        .select();

      if (error) throw error;

      // 호스트 지원서가 승인되면 유저 권한도 'host'로 변경
      if (table === 'host_applications' && status === 'approved') {
        const app = apps.find(a => a.id === id);
        if (app) {
          await supabase.from('users').update({ role: 'host' }).eq('id', app.user_id);
        }
      }

      showToast(`성공적으로 처리되었습니다. (${dbStatus})`, 'success'); 
      await fetchData(); // 데이터 새로고침
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
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[80vh]">
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

// Suspense로 감싸서 배포 시 에러 방지
export default function AdminDashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    }>
      <AdminDashboardContent />
    </Suspense>
  );
}