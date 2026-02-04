'use client';

import React from 'react';
import { Search, ChevronRight, User, Mail, Globe, MessageCircle, Phone, Smile, Calendar } from 'lucide-react';
import { InfoRow } from './SharedComponents';

export default function ManagementTab({ 
  activeTab, filter, setFilter, 
  apps, exps, users, messages, 
  selectedItem, setSelectedItem, 
  updateStatus, deleteItem 
}: any) {

  return (
    <div className="flex-1 flex gap-6 overflow-hidden h-full">
      
      {/* 1. 리스트 영역 (왼쪽) */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
        
        {/* 필터 헤더 */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
          <h3 className="font-bold text-lg text-slate-800">
            {activeTab === 'APPS' && '📝 호스트 지원서'}
            {activeTab === 'EXPS' && '🎈 등록된 체험'}
            {activeTab === 'USERS' && '👥 고객 유저 관리'}
            {activeTab === 'CHATS' && '💬 실시간 메시지'}
          </h3>
          {activeTab !== 'CHATS' && activeTab !== 'USERS' && (
            <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
              {['ALL', 'PENDING', 'APPROVED'].map(f => (
                <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filter===f ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{f}</button>
              ))}
            </div>
          )}
        </div>

        {/* 리스트 아이템 (스크롤 영역) */}
        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          
          {/* A. 호스트 지원서 리스트 */}
          {activeTab === 'APPS' && apps.filter((item:any) => filter === 'ALL' ? true : filter === 'PENDING' ? item.status === 'pending' : item.status !== 'pending').map((app:any) => (
            <ListItem key={app.id} selected={selectedItem?.id === app.id} onClick={()=>setSelectedItem(app)} 
              title={app.name} subtitle={`${app.host_nationality} / ${app.target_language}`} status={app.status} date={app.created_at} 
            />
          ))}

          {/* B. 체험 리스트 */}
          {activeTab === 'EXPS' && exps.filter((item:any) => filter === 'ALL' ? true : filter === 'PENDING' ? item.status === 'pending' : item.status === 'active').map((exp:any) => (
            <ListItem key={exp.id} selected={selectedItem?.id === exp.id} onClick={()=>setSelectedItem(exp)} 
              img={exp.photos?.[0]} title={exp.title} subtitle={`₩${exp.price.toLocaleString()}`} status={exp.status} date={exp.created_at} 
            />
          ))}

          {/* C. ✅ 고객(유저) 리스트 (상세 정보 자동 연동) */}
          {activeTab === 'USERS' && users.map((user:any) => (
            <div key={user.id} className="p-5 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors hover:border-slate-300 group bg-white">
              
              {/* 상단: 기본 정보 (가입 시 수집) */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                    <User size={20}/>
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      {user.full_name || '이름 미입력'}
                      {/* 국적 배지 */}
                      {user.nationality && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">{user.nationality}</span>}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      <Mail size={10}/> {user.email}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <button onClick={()=>deleteItem('profiles', user.id)} className="text-slate-300 text-xs hover:text-rose-500 transition-colors underline decoration-slate-200">계정 삭제</button>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-end gap-1">
                    <Calendar size={10}/> {new Date(user.created_at).toLocaleDateString()} 가입
                  </div>
                </div>
              </div>
              
              {/* 하단: 추가 프로필 정보 (유저가 입력 시 자동 표시) */}
              <div className="flex flex-wrap gap-2 text-[11px] mt-2 pt-2 border-t border-slate-50">
                {user.phone ? (
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 flex items-center gap-1"><Phone size={10}/> {user.phone}</span>
                ) : (
                  <span className="px-2 py-1 bg-slate-50 text-slate-300 rounded border border-slate-100 dashed">연락처 미입력</span>
                )}

                {user.kakao_id && (
                  <span className="px-2 py-1 bg-yellow-50 text-yellow-800 rounded border border-yellow-200 flex items-center gap-1"><MessageCircle size={10}/> Kakao: {user.kakao_id}</span>
                )}

                {user.mbti && (
                  <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded border border-purple-100 flex items-center gap-1"><Smile size={10}/> {user.mbti}</span>
                )}
              </div>

              {/* 자기소개 (있을 경우만 표시) */}
              {user.bio && (
                <div className="mt-3 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg leading-relaxed line-clamp-2">
                  "{user.bio}"
                </div>
              )}
            </div>
          ))}

          {/* D. 메시지 리스트 */}
          {activeTab === 'CHATS' && messages.map((msg:any) => (
            <div key={msg.id} className="p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors">
              <div className="flex justify-between mb-1.5">
                <span className="font-bold text-xs text-slate-800 flex items-center gap-1">
                  <span className="bg-slate-100 px-1.5 rounded text-slate-500">{msg.sender_name || 'User'}</span>
                  <ChevronRight size={10} className="text-slate-300"/>
                  <span className="bg-slate-900 text-white px-1.5 rounded">{msg.receiver_name || 'Host'}</span>
                </span>
                <span className="text-[10px] text-slate-400">{new Date(msg.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">{msg.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 2. 상세 보기 영역 (오른쪽 - 호스트/체험용) */}
      {(activeTab === 'APPS' || activeTab === 'EXPS') && (
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col p-6 overflow-y-auto shadow-sm">
          {selectedItem ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              
              {/* 상세 헤더 */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{selectedItem.title || selectedItem.name}</h2>
                  <p className="text-xs text-slate-400 mt-1 font-mono">{selectedItem.id}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${selectedItem.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{selectedItem.status}</span>
              </div>

              {/* 상세 내용 */}
              <div className="space-y-4">
                {activeTab === 'APPS' && (
                  <>
                    <InfoRow label="연락처" value={`${selectedItem.phone} / ${selectedItem.email}`} />
                    <InfoRow label="언어능력" value={selectedItem.target_language} />
                    <div className="bg-slate-50 p-5 rounded-xl text-sm whitespace-pre-wrap leading-relaxed text-slate-700 border border-slate-100">
                      <span className="block text-xs font-bold text-slate-400 mb-2 uppercase">자기소개</span>
                      {selectedItem.self_intro}
                    </div>
                  </>
                )}
                {activeTab === 'EXPS' && (
                  <>
                    {selectedItem.photos && (
                      <div className="relative aspect-video rounded-xl overflow-hidden shadow-sm border border-slate-100">
                        <img src={selectedItem.photos[0]} className="w-full h-full object-cover"/>
                      </div>
                    )}
                    <InfoRow label="판매 가격" value={`₩${selectedItem.price?.toLocaleString()}`} />
                    <div className="bg-slate-50 p-5 rounded-xl text-sm whitespace-pre-wrap leading-relaxed text-slate-700 border border-slate-100">
                      <span className="block text-xs font-bold text-slate-400 mb-2 uppercase">체험 설명</span>
                      {selectedItem.description}
                    </div>
                  </>
                )}
              </div>

              {/* 관리자 액션 버튼 */}
              <div className="pt-6 border-t border-slate-100 grid grid-cols-2 gap-3">
                <button onClick={()=>updateStatus(activeTab==='APPS'?'host_applications':'experiences', selectedItem.id, 'revision')} className="bg-white text-orange-600 font-bold py-3 rounded-xl border border-orange-200 hover:bg-orange-50 transition-colors">보완 요청</button>
                <button onClick={()=>updateStatus(activeTab==='APPS'?'host_applications':'experiences', selectedItem.id, 'rejected')} className="bg-white text-red-600 font-bold py-3 rounded-xl border border-red-200 hover:bg-red-50 transition-colors">거절</button>
                <button onClick={()=>updateStatus(activeTab==='APPS'?'host_applications':'experiences', selectedItem.id, 'approved')} className="col-span-2 bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-black shadow-lg hover:shadow-xl transition-all">승인 완료 (Approve)</button>
                <button onClick={()=>deleteItem(activeTab==='APPS'?'host_applications':'experiences', selectedItem.id)} className="col-span-2 text-slate-400 text-xs py-2 hover:text-red-500 transition-colors">데이터 영구 삭제</button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
              <Search size={48} className="mb-4 opacity-20"/>
              <p className="font-medium">리스트에서 항목을 선택하세요.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 리스트 아이템 컴포넌트
function ListItem({ selected, onClick, img, title, subtitle, status, date }: any) {
  return (
    <div onClick={onClick} className={`p-4 rounded-xl border cursor-pointer transition-all flex gap-4 items-center group ${selected ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-100 hover:border-slate-300 hover:bg-white bg-white'}`}>
      {img ? (
        <img src={img} className="w-12 h-12 rounded-lg object-cover bg-slate-100 border border-slate-100 shadow-sm shrink-0"/>
      ) : (
        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
          <User size={20}/>
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between mb-1">
          <div className="font-bold text-sm truncate text-slate-900">{title}</div>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${status==='pending'?'bg-yellow-100 text-yellow-700':status==='approved' || status==='active'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{status}</span>
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>{subtitle}</span>
          <span className="text-slate-400 font-mono">{new Date(date).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}