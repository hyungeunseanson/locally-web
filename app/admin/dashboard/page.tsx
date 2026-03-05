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

function DataLoadingSkeleton() {
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

function DataDrivenAdminTab({
  activeTab,
  filter,
  setFilter,
  selectedItem,
  setSelectedItem,
}: {
  activeTab: string;
  filter: string;
  setFilter: React.Dispatch<React.SetStateAction<string>>;
  selectedItem: unknown;
  setSelectedItem: React.Dispatch<React.SetStateAction<unknown>>;
}) {
  const {
    apps, exps, users, bookings, reviews, searchLogs, analyticsEvents, inquiries, inquiryMessages, onlineUsers, isLoading,
    updateStatus, deleteItem, refresh
  } = useAdminData();

  if (isLoading) return <DataLoadingSkeleton />;

  if (activeTab === 'USERS') {
    return <UsersTab users={users} onlineUsers={onlineUsers} deleteItem={deleteItem} />;
  }
  if (activeTab === 'LEDGER') {
    return <MasterLedgerTab bookings={bookings} onRefresh={refresh} />;
  }
  if (activeTab === 'SALES') {
    return <SalesTab bookings={bookings} apps={apps} onRefresh={refresh} />;
  }
  if (activeTab === 'ANALYTICS') {
    return (
      <AnalyticsTab
        bookings={bookings}
        users={users}
        exps={exps}
        apps={apps}
        reviews={reviews}
        searchLogs={searchLogs}
        analyticsEvents={analyticsEvents}
        inquiries={inquiries}
        inquiryMessages={inquiryMessages}
      />
    );
  }

  return (
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
  );
}

function AdminDashboardContent() {
  const [filter, setFilter] = useState('ALL');
  const [selectedItem, setSelectedItem] = useState<unknown>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
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
      router.replace(`/admin/dashboard?tab=${savedTab}`);
    }
    setIsTabLoaded(true);
  }, [urlTab, router]);

  if (!isTabLoaded) {
    return <DataLoadingSkeleton />;
  }

  return (
    <div className="bg-white p-2 md:p-6 rounded-lg md:rounded-2xl shadow-sm border border-slate-100 min-h-[80vh] flex flex-col h-full lg:h-auto overflow-hidden lg:overflow-visible">
      {activeTab === 'TEAM' ? (
        <TeamTab />
      ) : activeTab === 'CHATS' ? (
        <ChatMonitor />
      ) : activeTab === 'SERVICE_REQUESTS' ? (
        <ServiceAdminTab />
      ) : (
        <DataDrivenAdminTab
          activeTab={activeTab}
          filter={filter}
          setFilter={setFilter}
          selectedItem={selectedItem}
          setSelectedItem={setSelectedItem}
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
