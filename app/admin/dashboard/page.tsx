'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation'; 

// 컴포넌트 import
import UsersTab from './components/UsersTab';
import SalesTab from './components/SalesTab';
import AnalyticsTab from './components/AnalyticsTab';
import ManagementTab from './components/ManagementTab';
import ChatMonitor from './components/ChatMonitor'; 
import AuditLogTab from './components/AuditLogTab';
import MasterLedgerTab from './components/MasterLedgerTab';
import TeamTab from './components/TeamTab';

// Custom Hook
import { useAdminData } from './hooks/useAdminData';

function AdminDashboardContent() {
  const [filter, setFilter] = useState('ALL'); 
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab')?.toUpperCase() || 'APPROVALS';

  const { 
    apps, exps, users, bookings, reviews, onlineUsers, isLoading,
    updateStatus, deleteItem, refresh 
  } = useAdminData();

  if (isLoading) {
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
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[80vh]">
      {activeTab === 'USERS' ? ( 
        <UsersTab users={users} onlineUsers={onlineUsers} deleteItem={deleteItem} />
      ) : activeTab === 'LEDGER' ? ( 
        <MasterLedgerTab bookings={bookings} onRefresh={refresh} />
      ) : activeTab === 'SALES' ? ( 
        <SalesTab bookings={bookings} apps={apps} />
      ) : activeTab === 'ANALYTICS' ? ( 
        <AnalyticsTab bookings={bookings} users={users} exps={exps} apps={apps} reviews={reviews} />
      ) : activeTab === 'CHATS' ? ( 
        <ChatMonitor />
      ) : activeTab === 'LOGS' ? ( 
        <AuditLogTab />
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
