'use client';

import React from 'react';
import ListPanel from './ListPanel';
import DetailsPanel from './DetailsPanel';



export default function ManagementTab({ 
  activeTab, filter, setFilter, 
  apps, exps, users, messages, 
  selectedItem, setSelectedItem, 
  updateStatus, deleteItem 
}: any) {

  // 🟢 [핵심] 상태 업데이트 함수
  const updateStatus = async (table: string, id: string, status: string) => {
    try {
      const { error } = await supabase
        .from(table) // 'experiences' 또는 'host_applications'
        .update({ status: status }) // 'approved'로 변경
        .eq('id', id);

      if (error) throw error;

      showToast(`상태가 ${status}로 변경되었습니다.`, 'success');
      fetchData(); // 🟢 데이터 새로고침 필수! (UI 반영을 위해)
      
    } catch (err: any) {
      console.error(err);
      showToast('상태 변경 실패: ' + err.message, 'error');
    }
  };
  // 현재 탭과 필터에 맞는 리스트 반환
  const getFilteredList = () => {
    if (activeTab === 'APPS') return apps.filter((i:any) => filter === 'ALL' ? true : filter === 'PENDING' ? i.status === 'pending' : i.status !== 'pending');
    if (activeTab === 'EXPS') return exps.filter((i:any) => filter === 'ALL' ? true : filter === 'PENDING' ? i.status === 'pending' : i.status === 'active');
    if (activeTab === 'CHATS') return messages;
    return users; // USERS
  };

  const listItems = getFilteredList();

  return (
    <div className="flex-1 flex gap-6 overflow-hidden h-full">
      {/* 1. 좌측 리스트 패널 */}
      <ListPanel 
        activeTab={activeTab} 
        filter={filter} 
        setFilter={setFilter} 
        listItems={listItems} 
        selectedItem={selectedItem} 
        setSelectedItem={setSelectedItem} 
      />

      {/* 2. 우측 상세 패널 (채팅 제외) */}
      {activeTab !== 'CHATS' && (
        <DetailsPanel 
          activeTab={activeTab} 
          selectedItem={selectedItem} 
          updateStatus={updateStatus} 
          deleteItem={deleteItem} 
        />
      )}
    </div>
  );
}