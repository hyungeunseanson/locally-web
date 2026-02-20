'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useSearchParams, useRouter } from 'next/navigation'; 
import { useToast } from '@/app/context/ToastContext'; 

// 컴포넌트 import
import UsersTab from './components/UsersTab';
import BookingsTab from './components/BookingsTab';
import SalesTab from './components/SalesTab';
import AnalyticsTab from './components/AnalyticsTab';
import ManagementTab from './components/ManagementTab';
import ChatMonitor from './components/ChatMonitor'; 
import AuditLogTab from './components/AuditLogTab';
import MasterLedgerTab from './components/MasterLedgerTab';
import { updateAdminStatus, deleteAdminItem } from '@/app/actions/admin';

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

  useEffect(() => { 
    fetchData(); 
    const presenceChannel = supabase.channel('online_users')
      .on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState();
        const users = Object.values(newState).flat(); 
        const uniqueUsers = Array.from(new Map(users.map((u: any) => [u.user_id, u])).values());
        setOnlineUsers(uniqueUsers);
      }).subscribe();

    const bookingChannel = supabase.channel('realtime_bookings')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, (payload) => {
        setBookings(prev => [payload.new, ...prev]);
        showToast('🔔 새로운 예약이 접수되었습니다!', 'success');
      }).subscribe();

    return () => { 
      supabase.removeChannel(presenceChannel); 
      supabase.removeChannel(bookingChannel);
    };
  }, []);

  const fetchData = async () => {
    try {
      const { data: appData } = await supabase.from('host_applications').select('*').order('created_at', { ascending: false });
      if (appData) setApps(appData);
      const { data: expData } = await supabase.from('experiences').select('*').order('created_at', { ascending: false });
      if (expData) setExps(expData);
      const { data: userData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (userData) setUsers(userData);
      const { data: bookingData } = await supabase.from('bookings').select('*, experiences (title, host_id, profiles:host_id(name)), profiles:user_id (email, name, full_name)').order('created_at', { ascending: false }).limit(1000);
      if (bookingData) setBookings(bookingData);
      const { data: reviewData } = await supabase.from('reviews').select('rating, experience_id, created_at');
      if (reviewData) setReviews(reviewData);
    } catch (error) {
      showToast('Error loading data.', 'error');
    }
  };

  const updateStatus = async (table: 'host_applications' | 'experiences', id: string, status: string) => {
    let comment = ''; let dbStatus = status; 
    if (status === 'rejected' || status === 'revision') {
      const input = prompt(`Reason for [${status}]:`); if (input === null) return; comment = input;
    } else if (status === 'approved') {
      if (!confirm('Approve?')) return; if (table === 'experiences') dbStatus = 'active';
    }
    try {
      await updateAdminStatus(table, id, dbStatus, comment);
      showToast(`Success (${dbStatus})`, 'success'); 
      await fetchData(); setSelectedItem(null); 
    } catch (err: any) { showToast('Error: ' + err.message, 'error'); }
  };

  const deleteItem = async (table: string, id: string) => {
    if (!confirm('정말 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
      const res = await fetch('/api/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '삭제 요청 실패');
      showToast('삭제되었습니다.', 'success'); 
      fetchData(); setSelectedItem(null); 
    } catch (err: any) { showToast('삭제 실패: ' + err.message, 'error'); }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[80vh]">
      {activeTab === 'USERS' ? ( <UsersTab users={users} onlineUsers={onlineUsers} deleteItem={deleteItem} />
      ) : activeTab === 'BOOKINGS' ? ( <BookingsTab bookings={bookings} />
      ) : activeTab === 'LEDGER' ? ( <MasterLedgerTab bookings={bookings} onRefresh={fetchData} />
      ) : activeTab === 'SALES' ? ( <SalesTab bookings={bookings} apps={apps} />
      ) : activeTab === 'ANALYTICS' ? ( <AnalyticsTab bookings={bookings} users={users} exps={exps} apps={apps} reviews={reviews} />
      ) : activeTab === 'CHATS' ? ( <ChatMonitor />
      ) : activeTab === 'LOGS' ? ( <AuditLogTab />
      ) : (
        <ManagementTab activeTab={activeTab as any} filter={filter} setFilter={setFilter} apps={apps} exps={exps} users={users} messages={[]} selectedItem={selectedItem} setSelectedItem={setSelectedItem} updateStatus={updateStatus} deleteItem={deleteItem} />
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  return ( <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div></div>}> <AdminDashboardContent /> </Suspense> );
}