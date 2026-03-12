'use client';

import React from 'react';
import { Search, ChevronRight, User } from 'lucide-react';
import { getLanguageNames } from '@/app/utils/languageLevels';

export default function ListPanel({
  activeTab, filter, setFilter, listItems, selectedItem, setSelectedItem
}: any) {
  const filterOptions = [
    { value: 'ALL', label: 'ALL' },
    { value: 'PENDING', label: 'PENDING' },
    {
      value: 'APPROVED',
      label: activeTab === 'APPS' ? '처리완료' : activeTab === 'EXPS' ? '승인완료' : 'APPROVED'
    },
  ];

  const getAppLanguageSummary = (item: any) => {
    if (Array.isArray(item.languages) && item.languages.length > 0) {
      return item.languages.join(', ');
    }
    const levelNames = getLanguageNames(Array.isArray(item.language_levels) ? item.language_levels : []);
    if (levelNames.length > 0) {
      return levelNames.join(', ');
    }
    return item.target_language || '-';
  };

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm min-w-[320px]">

      {/* 🟢 필터 헤더 */}
      <div className="p-2 md:p-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
        <h3 className="font-bold text-xs md:text-sm text-slate-800">
          {activeTab === 'APPS' && '📝 호스트 지원서'}
          {activeTab === 'EXPS' && '🎈 등록된 체험'}
          {activeTab === 'USERS' && '👥 고객 관리'}
          {activeTab === 'CHATS' && '💬 메시지 관리'}
        </h3>
        {/* 채팅/유저 탭이 아닐 때만 필터 표시 */}
        {activeTab !== 'CHATS' && activeTab !== 'USERS' && (
          <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            {filterOptions.map((option) => (
              <button key={option.value} onClick={() => setFilter(option.value)} className={`px-2 py-1 text-[9px] md:text-[10px] font-bold rounded-md transition-all ${filter === option.value ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{option.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* 🟢 리스트 아이템 (스크롤 영역) */}
      <div className="overflow-y-auto flex-1 p-2 md:p-2.5 space-y-1.5">
        {listItems.map((item: any) => {

          // 🟢 [이미지 소스 결정 로직 추가] 탭에 따라 올바른 이미지 필드를 가져옵니다.
          let imgSrc = null;
          if (activeTab === 'APPS') imgSrc = item.profile_photo || item.avatar_url; // 호스트 지원서
          else if (activeTab === 'USERS') imgSrc = item.avatar_url; // 일반 유저
          else if (activeTab === 'EXPS') imgSrc = item.photos?.[0]; // 체험 (첫 번째 사진)

          // A. 채팅 메시지 리스트
          if (activeTab === 'CHATS') {
            return (
              <div key={item.id} className="p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="flex justify-between mb-1.5">
                  <span className="font-bold text-xs text-slate-800 flex items-center gap-1">
                    <span className="bg-slate-100 px-1.5 rounded text-slate-500">{item.sender_name || 'User'}</span>
                    <ChevronRight size={10} className="text-slate-300" />
                    <span className="bg-slate-900 text-white px-1.5 rounded">{item.receiver_name || 'Host'}</span>
                  </span>
                  <span className="text-[10px] text-slate-400">{new Date(item.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 line-clamp-2">{item.content}</p>
              </div>
            );
          }

          // B. 일반 리스트 (지원서, 체험, 유저)
          return (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className={`p-2.5 md:p-3 rounded-xl border cursor-pointer transition-all flex gap-2.5 md:gap-3 items-center ${selectedItem?.id === item.id ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-100 hover:border-slate-300 hover:bg-white bg-white'}`}
            >
              {/* 🟢 [수정됨] 위에서 구한 imgSrc 사용 */}
              {imgSrc ? (
                <img src={imgSrc} className="w-10 h-10 rounded-lg object-cover bg-slate-100 border border-slate-100 shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0"><User size={16} /></div>
              )}

              {/* 텍스트 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between mb-0.5">
                  <div className="font-bold text-[11px] md:text-xs truncate text-slate-900 pr-2">{item.title || item.name || item.full_name || 'Unknown'}</div>
                  <span className={`text-[8px] md:text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 ${activeTab === 'USERS' ? 'bg-slate-100 text-slate-500' : item.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : item.status === 'approved' || item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {activeTab === 'USERS' ? (item.nationality || 'Customer') : item.status}
                  </span>
                </div>
                <div className="flex justify-between text-[9px] md:text-[10px] text-slate-500">
                  <span className="truncate pr-1">
                    {activeTab === 'APPS' ? `${item.host_nationality} / ${getAppLanguageSummary(item)}`
                      : activeTab === 'EXPS' ? `Host: ${item.profiles?.full_name || '알 수 없음'} | ₩${item.price?.toLocaleString()}`
                        : item.email}
                  </span>
                  <span className="text-slate-400 font-mono">{new Date(item.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
