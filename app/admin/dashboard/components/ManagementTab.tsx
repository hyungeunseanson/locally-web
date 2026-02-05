'use client';

import React from 'react';
import { Search, ChevronRight, User, Mail, Globe, MessageCircle, Phone, Smile, Calendar, MapPin, Cake, CheckCircle2 } from 'lucide-react';
import { InfoRow } from './SharedComponents';

export default function ManagementTab({ 
  activeTab, filter, setFilter, 
  apps, exps, users, messages, 
  selectedItem, setSelectedItem, 
  updateStatus, deleteItem 
}: any) {

  // 나이 계산 헬퍼
  const calculateAge = (birthDate: string) => {
    if (!birthDate) return '';
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
    return `(만 ${age}세)`;
  };

  return (
    <div className="flex-1 flex gap-6 overflow-hidden h-full">
      
      {/* 1. 리스트 영역 (왼쪽) */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm min-w-[320px]">
        {/* ... (필터 헤더 - 기존과 동일) ... */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
          <h3 className="font-bold text-lg text-slate-800">
            {activeTab === 'APPS' && '📝 호스트 지원서'}
            {activeTab === 'EXPS' && '🎈 등록된 체험'}
            {activeTab === 'USERS' && '👥 고객(User) 리스트'}
            {activeTab === 'CHATS' && '💬 메시지 관리'}
          </h3>
          {activeTab !== 'CHATS' && activeTab !== 'USERS' && (
            <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
              {['ALL', 'PENDING', 'APPROVED'].map(f => (
                <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filter===f ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{f}</button>
              ))}
            </div>
          )}
        </div>

        {/* 리스트 아이템 */}
        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {activeTab === 'APPS' && apps.filter((item:any) => filter === 'ALL' ? true : filter === 'PENDING' ? item.status === 'pending' : item.status !== 'pending').map((app:any) => (
            <ListItem key={app.id} selected={selectedItem?.id === app.id} onClick={()=>setSelectedItem(app)} title={app.name} subtitle={`${app.host_nationality} / ${app.target_language}`} status={app.status} date={app.created_at} />
          ))}
          {activeTab === 'EXPS' && exps.filter((item:any) => filter === 'ALL' ? true : filter === 'PENDING' ? item.status === 'pending' : item.status === 'active').map((exp:any) => (
            <ListItem key={exp.id} selected={selectedItem?.id === exp.id} onClick={()=>setSelectedItem(exp)} img={exp.photos?.[0]} title={exp.title} subtitle={`₩${exp.price.toLocaleString()}`} status={exp.status} date={exp.created_at} />
          ))}
          {activeTab === 'USERS' && users.map((user:any) => (
            // ... (기존 유저 리스트 코드 유지) ...
            <div key={user.id} className="p-5 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors bg-white">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><User size={20}/></div>
                  <div><div className="font-bold">{user.full_name || 'Unknown'}</div><div className="text-xs text-slate-500">{user.email}</div></div>
               </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. 상세 보기 영역 (오른쪽 - 대폭 강화됨!) */}
      {(activeTab === 'APPS' || activeTab === 'EXPS') && (
        <div className="flex-[1.5] bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col p-8 overflow-y-auto shadow-sm">
          {selectedItem ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              
              {/* 타이틀 및 상태 */}
              <div className="border-b border-slate-100 pb-6">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-2 uppercase tracking-wide ${selectedItem.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{selectedItem.status}</span>
                <h2 className="text-3xl font-black text-slate-900 leading-tight">{selectedItem.title || selectedItem.name}</h2>
                <p className="text-xs text-slate-400 mt-2 font-mono">ID: {selectedItem.id}</p>
              </div>

              {/* ✅ 체험 상세 정보 (모든 데이터 표시) */}
              {activeTab === 'EXPS' && (
                <>
                  {/* 사진 갤러리 */}
                  {selectedItem.photos && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">등록된 사진</h4>
                      <div className="grid grid-cols-4 gap-2">
                        {selectedItem.photos.map((url:string, i:number) => (
                          <div key={i} className="aspect-square rounded-lg overflow-hidden border border-slate-100"><img src={url} className="w-full h-full object-cover"/></div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 기본 정보 */}
                  <div className="grid grid-cols-2 gap-4">
                    <InfoBox label="가격" value={`₩${selectedItem.price?.toLocaleString()}`} />
                    <InfoBox label="소요 시간" value={`${selectedItem.duration}시간`} />
                    <InfoBox label="최대 인원" value={`${selectedItem.max_guests}명`} />
                    <InfoBox label="지역" value={`${selectedItem.country} > ${selectedItem.city}`} />
                  </div>

                  {/* 상세 설명 */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">상세 설명</h4>
                    <div className="bg-slate-50 p-5 rounded-xl text-sm leading-relaxed text-slate-700 whitespace-pre-wrap border border-slate-100">{selectedItem.description}</div>
                  </div>

                  {/* 동선 (Itinerary) */}
                  {selectedItem.itinerary && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">진행 코스 (Itinerary)</h4>
                      <div className="space-y-3 pl-4 border-l-2 border-slate-100">
                        {selectedItem.itinerary.map((item: any, i: number) => (
                          <div key={i} className="relative pl-6">
                            <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-slate-300 border-2 border-white"></div>
                            <div className="font-bold text-sm text-slate-800">{item.title}</div>
                            <div className="text-xs text-slate-500 mt-1">{item.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 포함/불포함 */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">포함 사항</h4>
                      <ul className="text-sm space-y-1">{selectedItem.inclusions?.map((t:string,i:number)=><li key={i} className="flex gap-2 items-center"><CheckCircle2 size={12} className="text-green-500"/> {t}</li>)}</ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">불포함 사항</h4>
                      <ul className="text-sm space-y-1 text-slate-500">{selectedItem.exclusions?.map((t:string,i:number)=><li key={i}>- {t}</li>)}</ul>
                    </div>
                  </div>
                </>
              )}

              {/* ✅ 호스트 지원서 상세 (기존 유지) */}
              {activeTab === 'APPS' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <InfoBox label="연락처" value={selectedItem.phone} />
                    <InfoBox label="이메일" value={selectedItem.email} />
                    <InfoBox label="국적" value={selectedItem.host_nationality} />
                    <InfoBox label="언어" value={selectedItem.target_language} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">자기소개</h4>
                    <div className="bg-slate-50 p-5 rounded-xl text-sm leading-relaxed text-slate-700 whitespace-pre-wrap border border-slate-100">{selectedItem.self_intro}</div>
                  </div>
                </div>
              )}

              {/* 승인/거절 버튼 */}
              <div className="pt-8 mt-8 border-t border-slate-100 grid grid-cols-2 gap-4 sticky bottom-0 bg-white pb-4">
                <button onClick={()=>updateStatus(activeTab==='APPS'?'host_applications':'experiences', selectedItem.id, 'rejected')} className="py-4 rounded-xl font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors">거절 (Reject)</button>
                <button onClick={()=>updateStatus(activeTab==='APPS'?'host_applications':'experiences', selectedItem.id, 'approved')} className="py-4 rounded-xl font-bold text-white bg-slate-900 hover:bg-black shadow-lg hover:shadow-xl transition-all">승인 (Approve)</button>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
              <Search size={64} className="mb-6 opacity-20"/>
              <p className="font-medium text-lg">왼쪽 리스트에서 항목을 선택해주세요.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 작은 컴포넌트들
function ListItem({ selected, onClick, img, title, subtitle, status, date }: any) {
  return (
    <div onClick={onClick} className={`p-4 rounded-xl border cursor-pointer transition-all flex gap-4 items-center ${selected ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-100 hover:border-slate-300 hover:bg-white bg-white'}`}>
      {img ? <img src={img} className="w-12 h-12 rounded-lg object-cover bg-slate-100 border border-slate-100 shrink-0"/> : <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0"><User size={20}/></div>}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between mb-1"><div className="font-bold text-sm truncate text-slate-900">{title}</div><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${status==='pending'?'bg-yellow-100 text-yellow-700':status==='approved' || status==='active'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{status}</span></div>
        <div className="flex justify-between text-xs text-slate-500"><span>{subtitle}</span><span className="text-slate-400 font-mono">{new Date(date).toLocaleDateString()}</span></div>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: any) {
  return (
    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</div>
      <div className="font-bold text-slate-900 text-sm">{value || '-'}</div>
    </div>
  );
}