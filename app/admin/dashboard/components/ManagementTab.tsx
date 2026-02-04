'use client';

import React from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { InfoRow } from './SharedComponents';

export default function ManagementTab({ 
  activeTab, filter, setFilter, 
  apps, exps, users, messages, 
  selectedItem, setSelectedItem, 
  updateStatus, deleteItem 
}: any) {

  return (
    <div className="flex-1 flex gap-6 overflow-hidden">
      {/* 1. 리스트 영역 (왼쪽) */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* 필터 헤더 */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-lg">
            {activeTab === 'APPS' && '호스트 지원서'}
            {activeTab === 'EXPS' && '등록된 체험'}
            {activeTab === 'USERS' && '가입된 고객 정보'}
            {activeTab === 'CHATS' && '최근 메시지'}
          </h3>
          {activeTab !== 'CHATS' && activeTab !== 'USERS' && (
            <div className="flex bg-white rounded-lg p-1 border border-slate-200">
              {['ALL', 'PENDING', 'APPROVED'].map(f => (
                <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1 text-xs font-bold rounded ${filter===f ? 'bg-black text-white' : 'text-slate-500'}`}>{f}</button>
              ))}
            </div>
          )}
        </div>

        {/* 리스트 아이템 */}
        <div className="overflow-y-auto flex-1 p-2 space-y-2">
          {/* 앱스 */}
          {activeTab === 'APPS' && apps.filter((item:any) => filter === 'ALL' ? true : filter === 'PENDING' ? item.status === 'pending' : item.status !== 'pending').map((app:any) => (
            <ListItem key={app.id} selected={selectedItem?.id === app.id} onClick={()=>setSelectedItem(app)} 
              title={app.name} subtitle={`${app.host_nationality} / ${app.target_language}`} status={app.status} date={app.created_at} 
            />
          ))}
          {/* 체험 */}
          {activeTab === 'EXPS' && exps.filter((item:any) => filter === 'ALL' ? true : filter === 'PENDING' ? item.status === 'pending' : item.status === 'active').map((exp:any) => (
            <ListItem key={exp.id} selected={selectedItem?.id === exp.id} onClick={()=>setSelectedItem(exp)} 
              img={exp.photos?.[0]} title={exp.title} subtitle={`₩${exp.price.toLocaleString()}`} status={exp.status} date={exp.created_at} 
            />
          ))}
          {/* 유저 */}
          {activeTab === 'USERS' && users.map((user:any) => (
            <div key={user.id} className="p-4 border rounded-xl hover:bg-slate-50 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold flex items-center gap-2">{user.full_name || '이름 미설정'} <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{user.nationality || '국적미상'}</span></div>
                  <div className="text-xs text-slate-500 mt-0.5">{user.email}</div>
                </div>
                <button onClick={()=>deleteItem('profiles', user.id)} className="text-red-500 text-xs border border-red-200 px-3 py-1.5 rounded hover:bg-red-50">계정 삭제</button>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px]">
                {user.phone && <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded">📞 {user.phone}</span>}
                {user.kakao_id && <span className="px-2 py-1 bg-yellow-50 text-yellow-700 rounded border border-yellow-100">💬 Kakao: {user.kakao_id}</span>}
                {user.mbti && <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded border border-purple-100">🧠 {user.mbti}</span>}
              </div>
            </div>
          ))}
          {/* 채팅 */}
          {activeTab === 'CHATS' && messages.map((msg:any) => (
            <div key={msg.id} className="p-4 border-b last:border-0 hover:bg-slate-50 cursor-pointer">
              <div className="flex justify-between mb-1">
                <span className="font-bold text-xs">{msg.sender_name || 'User'} ➔ {msg.receiver_name || 'Host'}</span>
                <span className="text-[10px] text-slate-400">{new Date(msg.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-slate-700 bg-slate-100 p-2 rounded-lg">{msg.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 2. 상세 보기 영역 (오른쪽) */}
      {(activeTab === 'APPS' || activeTab === 'EXPS') && (
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col p-6 overflow-y-auto">
          {selectedItem ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-2xl font-black">{selectedItem.title || selectedItem.name}</h2>
                  <p className="text-sm text-slate-500 mt-1">{selectedItem.id}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${selectedItem.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{selectedItem.status}</span>
              </div>
              <div className="space-y-4">
                {activeTab === 'APPS' && (
                  <><InfoRow label="연락처" value={`${selectedItem.phone} / ${selectedItem.email}`} /><InfoRow label="언어" value={selectedItem.target_language} /><div className="bg-slate-50 p-4 rounded-xl text-sm whitespace-pre-wrap">{selectedItem.self_intro}</div></>
                )}
                {activeTab === 'EXPS' && (
                  <>{selectedItem.photos && <img src={selectedItem.photos[0]} className="w-full h-48 object-cover rounded-xl"/>}<InfoRow label="가격" value={`₩${selectedItem.price}`} /><div className="bg-slate-50 p-4 rounded-xl text-sm whitespace-pre-wrap">{selectedItem.description}</div></>
                )}
              </div>
              <div className="pt-6 border-t border-slate-100 grid grid-cols-2 gap-3">
                <button onClick={()=>updateStatus(activeTab==='APPS'?'host_applications':'experiences', selectedItem.id, 'revision')} className="bg-orange-50 text-orange-600 font-bold py-3 rounded-xl border border-orange-200 hover:bg-orange-100">보완 요청</button>
                <button onClick={()=>updateStatus(activeTab==='APPS'?'host_applications':'experiences', selectedItem.id, 'rejected')} className="bg-red-50 text-red-600 font-bold py-3 rounded-xl border border-red-200 hover:bg-red-100">거절</button>
                <button onClick={()=>updateStatus(activeTab==='APPS'?'host_applications':'experiences', selectedItem.id, 'approved')} className="col-span-2 bg-black text-white font-bold py-4 rounded-xl hover:bg-slate-800 shadow-lg">승인 하기</button>
                <button onClick={()=>deleteItem(activeTab==='APPS'?'host_applications':'experiences', selectedItem.id)} className="col-span-2 text-slate-400 text-xs py-2 hover:text-red-500">영구 삭제</button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300"><Search size={48} className="mb-4 opacity-20"/><p>항목을 선택하세요.</p></div>
          )}
        </div>
      )}
    </div>
  );
}

function ListItem({ selected, onClick, img, title, subtitle, status, date }: any) {
  return (
    <div onClick={onClick} className={`p-4 rounded-xl border cursor-pointer hover:shadow-md transition-all flex gap-3 ${selected ? 'border-black bg-slate-50 ring-1 ring-black' : 'border-slate-100'}`}>
      {img && <img src={img} className="w-12 h-12 rounded-lg object-cover bg-slate-200"/>}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between mb-1">
          <div className="font-bold text-sm truncate">{title}</div>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${status==='pending'?'bg-yellow-100 text-yellow-700':status==='approved' || status==='active'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{status}</span>
        </div>
        <div className="flex justify-between text-xs text-slate-500"><span>{subtitle}</span><span>{new Date(date).toLocaleDateString()}</span></div>
      </div>
    </div>
  );
}