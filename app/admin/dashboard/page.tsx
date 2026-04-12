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
import { normalizeAdminDashboardTab } from './tabRouting';

// Custom Hook
import { useAdminUsersData } from './hooks/useAdminUsersData';
import { useAdminApprovalsData } from './hooks/useAdminApprovalsData';
import type { AdminPanelSelectedItem } from '@/app/types/admin';

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
  selectedItem: AdminPanelSelectedItem | null;
  setSelectedItem: React.Dispatch<React.SetStateAction<AdminPanelSelectedItem | null>>;
}) {
  const { apps, exps, isLoading, updateStatus, deleteItem } = useAdminApprovalsData();

  if (isLoading) return <DataLoadingSkeleton />;

  return (
    <ManagementTab
      activeTab={activeTab}
      filter={filter}
      setFilter={setFilter}
      apps={apps}
      exps={exps}
      users={[]}
      messages={[]}
      selectedItem={selectedItem}
      setSelectedItem={setSelectedItem}
      updateStatus={updateStatus}
      deleteItem={deleteItem}
    />
  );
}

function UsersDataTab() {
  const { users, onlineUsers, isLoading, deleteItem } = useAdminUsersData();

  if (isLoading) return <DataLoadingSkeleton />;

  return <UsersTab users={users} onlineUsers={onlineUsers} deleteItem={deleteItem} />;
}

function ApprovalsDataTab({
  activeTab,
  filter,
  setFilter,
  selectedItem,
  setSelectedItem,
}: {
  activeTab: string;
  filter: string;
  setFilter: React.Dispatch<React.SetStateAction<string>>;
  selectedItem: AdminPanelSelectedItem | null;
  setSelectedItem: React.Dispatch<React.SetStateAction<AdminPanelSelectedItem | null>>;
}) {
  const { apps, exps, isLoading, updateStatus, deleteItem } = useAdminApprovalsData();

  if (isLoading) return <DataLoadingSkeleton />;

  return (
    <ManagementTab
      activeTab={activeTab}
      filter={filter}
      setFilter={setFilter}
      apps={apps}
      exps={exps}
      users={[]}
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
  const [selectedItem, setSelectedItem] = useState<AdminPanelSelectedItem | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawUrlTab = searchParams.get('tab');
  const urlTab = normalizeAdminDashboardTab(rawUrlTab);
  const storedTab = useSyncExternalStore(
    subscribeToAdminTabStorage,
    getStoredAdminTab,
    getServerStoredAdminTab
  );
  const savedTab = normalizeAdminDashboardTab(storedTab);
  const activeTab = urlTab || savedTab || 'APPROVALS';
  const teamTab = searchParams.get('teamTab');
  const proxyRequestId = searchParams.get('proxyRequestId');

  useEffect(() => {
    if (urlTab && rawUrlTab?.toUpperCase() !== urlTab) {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set('tab', urlTab);
      localStorage.setItem('admin_active_tab', urlTab);
      router.replace(`/admin/dashboard?${nextParams.toString()}`);
      return;
    }

    if (urlTab) {
      localStorage.setItem('admin_active_tab', urlTab);
    } else if (savedTab) {
      router.replace(`/admin/dashboard?tab=${savedTab}`);
    }
  }, [rawUrlTab, router, savedTab, searchParams, urlTab]);

  return (
    <div className="bg-white p-2 md:p-6 rounded-lg md:rounded-2xl shadow-sm border border-slate-100 min-h-[80vh] flex flex-col h-full lg:h-auto overflow-hidden lg:overflow-visible">
      <div key={activeTab} className="animate-in fade-in duration-200 flex flex-col flex-1">
      {activeTab === 'TEAM' ? (
        <TeamTab initialInnerTab={teamTab === 'proxy' ? 'proxy' : undefined} initialProxyRequestId={proxyRequestId} />
      ) : activeTab === 'ALERTS' ? (
        <AdminAlertsTab />
      ) : activeTab === 'CHATS' ? (
        <ChatMonitor />
      ) : activeTab === 'SERVICE_REQUESTS' ? (
        <ServiceAdminTab />
      ) : activeTab === 'SALES' ? (
        <SalesTab />
      ) : activeTab === 'LEDGER' ? (
        <MasterLedgerTab />
      ) : activeTab === 'ANALYTICS' ? (
        <AnalyticsTab />
      ) : activeTab === 'USERS' ? (
        <UsersDataTab />
      ) : activeTab === 'APPROVALS' ? (
        <ApprovalsDataTab
          activeTab={activeTab}
          filter={filter}
          setFilter={setFilter}
          selectedItem={selectedItem}
          setSelectedItem={setSelectedItem}
        />
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
