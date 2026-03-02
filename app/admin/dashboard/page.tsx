'use client';

import React, { useState, Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

// 컴포넌트 import
import UsersTab from './components/UsersTab';
import SalesTab from './components/SalesTab';
import AnalyticsTab from './components/AnalyticsTab';
import ManagementTab from './components/ManagementTab';
import ChatMonitor from './components/ChatMonitor';
import MasterLedgerTab from './components/MasterLedgerTab';
import TeamTab from './components/TeamTab';
import ServiceAdminTab from './components/ServiceAdminTab';

// Custom Hook
import { useAdminData } from './hooks/useAdminData';

function AdminDashboardContent() {
  const [filter, setFilter] = useState('ALL');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const searchParams = useSearchParams();
  const router = useRouter(); // 🟢 라우터 추가
  const urlTab = searchParams.get('tab')?.toUpperCase();

  // URL에 탭이 있으면 그걸 우선 사용, 없으면 localStorage 확인해서 복원
  const [activeTab, setActiveTab] = useState<string>('APPROVALS');
  const [isTabLoaded, setIsTabLoaded] = useState(false);

  useEffect(() => {
    const savedTab = localStorage.getItem('admin_active_tab');
    if (urlTab) {
      setActiveTab(urlTab);
      localStorage.setItem('admin_active_tab', urlTab);
    } else if (savedTab) {
      setActiveTab(savedTab);
      // URL도 업데이트해서 사이드바와 동기화
      router.replace(`/admin/dashboard?tab=${savedTab}`);
    }
    setIsTabLoaded(true);
  }, [urlTab, router]);

  const {
    apps, exps, users, bookings, reviews, searchLogs, analyticsEvents, inquiries, inquiryMessages, onlineUsers, isLoading,
    updateStatus, deleteItem, refresh
  } = useAdminData();

  if (isLoading || !isTabLoaded) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[80vh] animate-pulse">
        <div className="h-8 bg-slate-100 rounded w-1/4 mb-6"></div>
        <div className="space-y-4">
          <div className="h-12 bg-slate-100 rounded"></div>
          <div className="h-12 bg-slate-100 rounded"></div>
          <div className="h-12 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-2 md:p-6 rounded-lg md:rounded-2xl shadow-sm border border-slate-100 min-h-[80vh] flex flex-col h-full lg:h-auto overflow-hidden lg:overflow-visible">
      {activeTab === 'USERS' ? (
        <UsersTab users={users} onlineUsers={onlineUsers} deleteItem={deleteItem} />
      ) : activeTab === 'LEDGER' ? (
        <MasterLedgerTab bookings={bookings} onRefresh={refresh} />
      ) : activeTab === 'SALES' ? (
        <SalesTab bookings={bookings} apps={apps} onRefresh={refresh} />
      ) : activeTab === 'ANALYTICS' ? (
        <AnalyticsTab bookings={bookings} users={users} exps={exps} apps={apps} reviews={reviews} searchLogs={searchLogs} analyticsEvents={analyticsEvents} inquiries={inquiries} inquiryMessages={inquiryMessages} />
      ) : activeTab === 'SERVICE_REQUESTS' ? (
        <ServiceAdminTab />
      ) : activeTab === 'CHATS' ? (
        <ChatMonitor />
      ) : activeTab === 'TEAM' ? (
        <TeamTab />
      ) : (
        <ManagementTab
          activeTab={activeTab as any}
          filter={filter}
          setFilter={setFilter}
          apps={apps}
          exps={exps}
          users={users}
          messages={[]}
          selectedItem={selectedItem}
          setSelectedItem={setSelectedItem}
          updateStatus={updateStatus}
          deleteItem={deleteItem}
        />
      )}
    </div>
  );
}

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
