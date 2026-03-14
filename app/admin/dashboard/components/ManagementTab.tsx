'use client';

import React, { useState } from 'react';
import ListPanel from './ListPanel';
import DetailsPanel from './DetailsPanel';
import SettlementTab from './SettlementTab';
import { Users, MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';

type ConfirmDialogState =
  | {
      kind: 'update-status';
      table: 'host_applications' | 'experiences';
      id: string;
      status: string;
      title: string;
      description: string;
      confirmLabel: string;
      tone: 'blue' | 'red' | 'orange';
      requireComment?: boolean;
    }
  | {
      kind: 'delete-item';
      table: string;
      id: string;
      title: string;
      description: string;
      confirmLabel: string;
      tone: 'red';
      requireComment?: false;
    }
  | null;

import { AdminManagementTabProps } from '@/app/types/admin';

export default function ManagementTab({
  activeTab, filter, setFilter,
  apps, exps, users, messages,
  selectedItem, setSelectedItem,
  updateStatus, deleteItem
}: AdminManagementTabProps) {

  const [subTab, setSubTab] = useState<'APPS' | 'EXPS'>('APPS');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [commentInput, setCommentInput] = useState('');

  if (activeTab === 'SETTLEMENT') {
    return <SettlementTab />;
  }

  // 🟢 [통합 로직] APPROVALS 탭일 경우 subTab을 사용, 그 외에는 activeTab 사용
  const effectiveTab = activeTab === 'APPROVALS' ? subTab : activeTab;

  // 현재 탭과 필터에 맞는 리스트 반환
  const getFilteredList = () => {
    if (effectiveTab === 'APPS') {
      return apps.filter((i: any) => filter === 'ALL' ? true : filter === 'PENDING' ? i.status === 'pending' : i.status !== 'pending');
    }
    if (effectiveTab === 'EXPS') {
      return exps.filter((i: any) => filter === 'ALL' ? true : filter === 'PENDING' ? i.status === 'pending' : i.status === 'active');
    }
    if (effectiveTab === 'CHATS') return messages;
    return users; // USERS
  };

  const listItems = getFilteredList();

  const handleUpdateStatusClick = (table: 'host_applications' | 'experiences', id: string, status: string) => {
    if (status === 'rejected' || status === 'revision') {
      setConfirmDialog({
        kind: 'update-status',
        table,
        id,
        status,
        title: status === 'rejected' ? '거절 사유 입력' : '보완 사유 입력',
        description: `호스트에게 전달할 ${status === 'rejected' ? '거절' : '보완'} 사유를 입력해주세요.`,
        confirmLabel: status === 'rejected' ? '거절 처리' : '보완 요청 전송',
        tone: status === 'rejected' ? 'red' : 'orange',
        requireComment: true,
      });
    } else if (status === 'approved') {
      setConfirmDialog({
        kind: 'update-status',
        table,
        id,
        status,
        title: '승인 확인',
        description: '정말로 승인하시겠습니까? 승인 시 호스트 권한이 부여됩니다.',
        confirmLabel: '승인 및 권한 부여',
        tone: 'blue',
        requireComment: false,
      });
    } else {
       // Just in case
       updateStatus(table, id, status, '');
    }
    setCommentInput('');
  };

  const handleDeleteItemClick = (table: string, id: string) => {
    setConfirmDialog({
      kind: 'delete-item',
      table,
      id,
      title: '영구 삭제 확인',
      description: '정말 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      confirmLabel: '영구 삭제',
      tone: 'red',
    });
  };

  const confirmDialogAction = async () => {
    if (!confirmDialog) return;
    setIsProcessing(true);

    let success = false;
    try {
      if (confirmDialog.kind === 'update-status') {
        const updateResult = await updateStatus(confirmDialog.table, confirmDialog.id, confirmDialog.status, commentInput);
        success = typeof updateResult === 'boolean' ? updateResult : true;
      } else if (confirmDialog.kind === 'delete-item') {
        const deleteResult = await deleteItem(confirmDialog.table, confirmDialog.id);
        success = typeof deleteResult === 'boolean' ? deleteResult : true;
      }
    } finally {
      setIsProcessing(false);
      if (success) {
        setConfirmDialog(null);
        setCommentInput('');
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">

      {/* 🟢 [추가] 승인 관리 통합 탭 헤더 (서브 탭 전환) */}
      {activeTab === 'APPROVALS' && (
        <div className="border-b border-slate-200 pb-3 md:pb-4 mb-3 md:mb-4 flex items-center gap-2 md:gap-4 shrink-0">
          <h2 className="text-[13px] md:text-lg font-bold text-slate-900 mr-1 md:mr-4">승인 관리</h2>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => { setSubTab('APPS'); setSelectedItem(null); setFilter('ALL'); }}
              className={`flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-1.5 md:py-2 rounded-md text-[11px] md:text-sm font-bold transition-all ${subTab === 'APPS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Users size={14} className="md:w-4 md:h-4" /> 호스트 지원서 ({apps.filter((a: any) => a.status === 'pending').length})
            </button>
            <button
              onClick={() => { setSubTab('EXPS'); setSelectedItem(null); setFilter('ALL'); }}
              className={`flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-1.5 md:py-2 rounded-md text-[11px] md:text-sm font-bold transition-all ${subTab === 'EXPS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <MapPin size={14} className="md:w-4 md:h-4" /> 체험 등록 ({exps.filter((e: any) => e.status === 'pending').length})
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-6 overflow-hidden relative">
        {/* 1. 좌측 리스트 패널 */}
        <div className={`flex-1 flex overflow-hidden ${selectedItem && effectiveTab !== 'CHATS' ? 'hidden md:flex' : 'flex'}`}>
          <ListPanel
            activeTab={effectiveTab}
            filter={filter}
            setFilter={setFilter}
            listItems={listItems}
            selectedItem={selectedItem}
            setSelectedItem={setSelectedItem}
          />
        </div>

        {/* 2. 우측 상세 패널 (채팅 제외) */}
        {effectiveTab !== 'CHATS' && (
          <div className={`${selectedItem ? 'absolute inset-0 z-30 flex md:relative md:w-auto md:flex-[1.5]' : 'hidden md:flex md:flex-[1.5]'} bg-white`}>
            <DetailsPanel
              activeTab={effectiveTab}
              selectedItem={selectedItem}
              setSelectedItem={setSelectedItem}
              updateStatus={handleUpdateStatusClick}
              deleteItem={handleDeleteItemClick}
            />
          </div>
        )}
      </div>

      {confirmDialog && (
        <div className="fixed inset-0 z-[120] md:hidden">
          <button
            type="button"
            aria-label="확인 모달 닫기"
            onClick={() => !isProcessing && setConfirmDialog(null)}
            className="absolute inset-0 bg-slate-900/45"
          />
          <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl flex flex-col">
            <div className="flex items-start gap-3 flex-shrink-0">
              <div className={`mt-0.5 rounded-full p-2 flex-shrink-0 ${confirmDialog.tone === 'red' ? 'bg-red-100 text-red-600' : confirmDialog.tone === 'orange' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                {confirmDialog.tone === 'red' ? <AlertTriangle size={16} /> : confirmDialog.tone === 'orange' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-black text-slate-900">{confirmDialog.title}</h4>
                <p className="mt-1 text-[12px] leading-5 text-slate-600 whitespace-pre-wrap break-words">{confirmDialog.description}</p>
              </div>
            </div>

            {confirmDialog.requireComment && (
              <div className="mt-4 flex-1 min-h-[100px] flex flex-col">
                <textarea
                  className="w-full flex-1 min-h-[100px] p-3 border border-slate-200 bg-white rounded-xl text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                  placeholder="사유를 입력해주세요 (필수)"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                />
              </div>
            )}

            <div className="mt-4 flex gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => { setConfirmDialog(null); setCommentInput(''); }}
                disabled={isProcessing}
                className="flex-[0.5] rounded-xl border border-slate-200 bg-white px-2 py-3 text-xs font-bold text-slate-600"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmDialogAction}
                disabled={isProcessing || (confirmDialog.requireComment && !commentInput.trim())}
                className={`flex-1 rounded-xl px-2 py-3 text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed ${confirmDialog.tone === 'red' ? 'bg-red-600' : confirmDialog.tone === 'orange' ? 'bg-orange-500' : 'bg-blue-600'}`}
              >
                {isProcessing ? '처리 중...' : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
         <div className="hidden md:flex fixed inset-0 z-[120] items-center justify-center">
         <button
           type="button"
           aria-label="확인 모달 닫기"
           onClick={() => !isProcessing && setConfirmDialog(null)}
           className="absolute inset-0 bg-slate-900/45"
         />
         <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl flex flex-col max-h-[90vh]">
           <div className="flex items-start gap-4 flex-shrink-0">
             <div className={`mt-1 rounded-full p-2 flex-shrink-0 ${confirmDialog.tone === 'red' ? 'bg-red-100 text-red-600' : confirmDialog.tone === 'orange' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
               {confirmDialog.tone === 'red' ? <AlertTriangle size={20} /> : confirmDialog.tone === 'orange' ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
             </div>
             <div className="min-w-0 flex-1">
               <h4 className="text-base font-black text-slate-900">{confirmDialog.title}</h4>
               <p className="mt-1.5 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap break-words">{confirmDialog.description}</p>
             </div>
           </div>

           {confirmDialog.requireComment && (
             <div className="mt-5 flex-1 min-h-[120px] flex flex-col">
               <textarea
                 className="w-full flex-1 min-h-[120px] p-3 border border-slate-200 bg-white rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                 placeholder="사유를 입력해주세요 (필수)"
                 value={commentInput}
                 onChange={(e) => setCommentInput(e.target.value)}
                 autoFocus
               />
             </div>
           )}

           <div className="mt-6 flex justify-end gap-3 flex-shrink-0">
             <button
               type="button"
               onClick={() => { setConfirmDialog(null); setCommentInput(''); }}
               disabled={isProcessing}
               className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
             >
               취소
             </button>
             <button
               type="button"
               onClick={confirmDialogAction}
               disabled={isProcessing || (confirmDialog.requireComment && !commentInput.trim())}
               className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmDialog.tone === 'red' ? 'bg-red-600 hover:bg-red-700' : confirmDialog.tone === 'orange' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}
             >
               {isProcessing ? '처리 중...' : confirmDialog.confirmLabel}
             </button>
           </div>
         </div>
       </div>
      )}
    </div>
  );
}
