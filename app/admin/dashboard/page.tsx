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

import { useToast } from '@/app/context/ToastContext'; // 🟢 [추가]

export default function AdminDashboardPage() {
  const { showToast } = useToast(); // 🟢 [추가]
  const [filter, setFilter] = useState('ALL'); 
  
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab')?.toUpperCase() || 'APPS';
  

  const [apps, setApps] = useState<any[]>([]);
  const [exps, setExps] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]); // 🟢 [추가] 리뷰 데이터 상태
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
// 🟢 [추가] 리뷰 데이터 가져오기
const { data: reviewData } = await supabase.from('reviews').select('rating, experience_id');
if (reviewData) setReviews(reviewData);
};

  // 🟢 [수정됨] 상태 업데이트 함수
const updateStatus = async (table: 'host_applications' | 'experiences', id: string, status: string) => {
  let comment = '';
  let dbStatus = status; // 🟢 DB에 저장될 실제 상태값 별도 관리

  if (status === 'rejected' || status === 'revision') {
    const input = prompt(`[${status === 'revision' ? '보완요청' : '거절'}] 사유를 입력해주세요:`);
    if (input === null) return;
    comment = input;
  } else if (status === 'approved') {
    if (!confirm('승인 처리하시겠습니까?')) return;
    // 🟢 체험은 승인 시 status가 'active'가 되어야 함
    if (table === 'experiences') {
      dbStatus = 'active'; 
    }
  }

  try {
    // 🟢 테이블별 업데이트 데이터 분기 처리 (안전성 확보)
    let updateData: any = { status: dbStatus };

    // host_applications 테이블에만 코멘트 저장
    if (table === 'host_applications') {
        updateData.admin_comment = comment;
    }

    const { error } = await supabase
      .from(table)
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    // 호스트 권한 부여 (기존 로직 유지)
    if (table === 'host_applications' && status === 'approved') {
      const app = apps.find(a => a.id === id);
      if (app) {
        await supabase.from('users').update({ role: 'host' }).eq('id', app.user_id);
      }
    }

    showToast('성공적으로 처리되었습니다.', 'success'); // 🟢 alert -> showToast

    await fetchData(); 
    setSelectedItem(null); 

  } catch (err: any) {
    console.error(err);
    showToast('처리 중 오류 발생: ' + err.message, 'error'); // 🟢 alert -> showToast
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
<AnalyticsTab bookings={bookings} users={users} exps={exps} apps={apps} reviews={reviews} />
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