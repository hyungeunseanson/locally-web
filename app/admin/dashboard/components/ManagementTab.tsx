'use client';

import React, { useState } from 'react';
import ListPanel from './ListPanel';
import DetailsPanel from './DetailsPanel';
import SettlementTab from './SettlementTab';
import { Users, MapPin } from 'lucide-react';

export default function ManagementTab({ 
  activeTab, filter, setFilter, 
  apps, exps, users, messages, 
  selectedItem, setSelectedItem, 
  updateStatus, deleteItem 
}: any) {

  const [subTab, setSubTab] = useState<'APPS' | 'EXPS'>('APPS');

  if (activeTab === 'SETTLEMENT') {
    return <SettlementTab />;
  }

  // 🟢 [통합 로직] APPROVALS 탭일 경우 subTab을 사용, 그 외에는 activeTab 사용
  const effectiveTab = activeTab === 'APPROVALS' ? subTab : activeTab;

  // 현재 탭과 필터에 맞는 리스트 반환
  const getFilteredList = () => {
    if (effectiveTab === 'APPS') {
      return apps.filter((i:any) => filter === 'ALL' ? true : filter === 'PENDING' ? i.status === 'pending' : i.status !== 'pending');
    }
    if (effectiveTab === 'EXPS') {
      return exps.filter((i:any) => filter === 'ALL' ? true : filter === 'PENDING' ? i.status === 'pending' : i.status === 'active');
    }
    if (effectiveTab === 'CHATS') return messages;
    return users; // USERS
  };

  const listItems = getFilteredList();

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      
      {/* 🟢 [추가] 승인 관리 통합 탭 헤더 (서브 탭 전환) */}
      {activeTab === 'APPROVALS' && (
        <div className="border-b border-slate-200 pb-4 mb-4 flex items-center gap-4 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 mr-4">승인 관리</h2>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => { setSubTab('APPS'); setSelectedItem(null); setFilter('ALL'); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${subTab === 'APPS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Users size={16}/> 호스트 지원서 ({apps.filter((a:any)=>a.status==='pending').length})
            </button>
            <button 
              onClick={() => { setSubTab('EXPS'); setSelectedItem(null); setFilter('ALL'); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${subTab === 'EXPS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <MapPin size={16}/> 체험 등록 ({exps.filter((e:any)=>e.status==='pending').length})
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* 1. 좌측 리스트 패널 */}
        <ListPanel 
          activeTab={effectiveTab} 
          filter={filter} 
          setFilter={setFilter} 
          listItems={listItems} 
          selectedItem={selectedItem} 
          setSelectedItem={setSelectedItem} 
        />

        {/* 2. 우측 상세 패널 (채팅 제외) */}
        {effectiveTab !== 'CHATS' && (
          <DetailsPanel 
            activeTab={effectiveTab} 
            selectedItem={selectedItem} 
            updateStatus={updateStatus} 
            deleteItem={deleteItem} 
          />
        )}
      </div>
    </div>
  );
}