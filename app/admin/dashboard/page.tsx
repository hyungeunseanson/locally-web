'use client';

import React, { Suspense, useEffect, useState, useSyncExternalStore } from 'react';
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
import AdminAlertsTab from './components/AdminAlertsTab';

// Custom Hook
import { useAdminData } from './hooks/useAdminData';

function subscribeToAdminTabStorage(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getStoredAdminTab() {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem('admin_active_tab');
}

function getServerStoredAdminTab() {
  return null;
}

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
  const ledgerRefreshSignal = `${bookings.length}:${String(bookings[0]?.id ?? '')}`;

  if (isLoading) return <DataLoadingSkeleton />;

  if (activeTab === 'USERS') {
    return <UsersTab users={users} onlineUsers={onlineUsers} deleteItem={deleteItem} />;
  }
  if (activeTab === 'LEDGER') {
    return <MasterLedgerTab onRefresh={refresh} refreshSignal={ledgerRefreshSignal} />;
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
      activeTab={activeTab}
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
  const savedTab = useSyncExternalStore(
    subscribeToAdminTabStorage,
    getStoredAdminTab,
    getServerStoredAdminTab
  );
  const activeTab = urlTab || savedTab?.toUpperCase() || 'APPROVALS';

  useEffect(() => {
    if (urlTab) {
      localStorage.setItem('admin_active_tab', urlTab);
    } else if (savedTab) {
      router.replace(`/admin/dashboard?tab=${savedTab.toUpperCase()}`);
    }
  }, [urlTab, savedTab, router]);

  return (
    <div className="bg-white p-2 md:p-6 rounded-lg md:rounded-2xl shadow-sm border border-slate-100 min-h-[80vh] flex flex-col h-full lg:h-auto overflow-hidden lg:overflow-visible">
      {activeTab === 'TEAM' ? (
        <TeamTab />
      ) : activeTab === 'ALERTS' ? (
        <AdminAlertsTab />
      ) : activeTab === 'CHATS' ? (
        <ChatMonitor />
      ) : activeTab === 'SERVICE_REQUESTS' ? (
        <ServiceAdminTab />
      ) : activeTab === 'SALES' ? (
        <SalesTab />
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
