'use client';

import React from 'react';
import { Search, ChevronRight, User, Mail, Globe, MessageCircle, Phone, Smile, Calendar, MapPin, Cake } from 'lucide-react';
import { InfoRow } from './SharedComponents';

export default function ManagementTab({ 
  activeTab, filter, setFilter, 
  apps, exps, users, messages, 
  selectedItem, setSelectedItem, 
  updateStatus, deleteItem 
}: any) {

  // 나이 계산 헬퍼 함수
  const calculateAge = (birthDate: string) => {
    if (!birthDate) return '';
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return `(만 ${age}세)`;
  };

  return (
    <div className="flex-1 flex gap-6 overflow-hidden h-full">
      
      {/* 1. 리스트 영역 (왼쪽) */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
        
        {/* 필터 헤더 */}
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

          {/* C. ✅ 고객(유저) 리스트 - 생년월일/국적 추가, 자기소개 삭제 */}
          {activeTab === 'USERS' && users.map((user:any) => (
            <div key={user.id} className="p-5 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors hover:border-slate-300 group bg-white">
              
              {/* 상단: 기본 정보 */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  {/* 프로필 사진 */}
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 overflow-hidden shrink-0">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User size={24}/>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-2 text-base">
                      {user.full_name || user.name || 'Unknown User'}
                      {/* 🇰🇷 국적 배지 (강조) */}
                      {user.nationality ? (
                        <span className="text-[10px] bg-slate-800 text-white px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
                          <Globe size={10}/> {user.nationality}
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded border border-slate-200">국적 미상</span>
                      )}
                    </div>
                    <div className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5 font-medium">
                      <Mail size={12}/> {user.email || '-'}
                    </div>
                  </div>
                </div>
                
                {/* 우측 상단: 가입일 및 삭제 */}
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 mb-1 flex items-center justify-end gap-1">
                    <Calendar size={10}/> {new Date(user.created_at).toLocaleDateString()} 가입
                  </div>
                  <button onClick={()=>deleteItem('profiles', user.id)} className="text-slate-300 text-xs hover:text-rose-500 transition-colors underline decoration-slate-200 hover:decoration-rose-500">
                    계정 삭제
                  </button>
                </div>
              </div>
              
              {/* 하단: 상세 정보 그리드 */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-50">
                
                {/* 1. 🎂 생년월일 (New) */}
                {user.birth_date ? (
                  <div className="text-xs text-slate-700 flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded font-medium">
                    <Cake size={12} className="text-rose-400"/> 
                    {user.birth_date} <span className="text-slate-400 text-[10px]">{calculateAge(user.birth_date)}</span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-300 flex items-center gap-2 px-2 py-1.5 border border-dashed border-slate-200 rounded">
                    <Cake size={12}/> 생년월일 미입력
                  </div>
                )}

                {/* 2. 📞 연락처 */}
                {user.phone ? (
                  <div className="text-xs text-slate-600 flex items-center gap-2 bg-blue-50 px-2 py-1.5 rounded text-blue-700">
                    <Phone size={12}/> {user.phone}
                  </div>
                ) : (
                  <div className="text-xs text-slate-300 flex items-center gap-2 px-2 py-1.5 border border-dashed border-slate-200 rounded">
                    <Phone size={12}/> 연락처 미입력
                  </div>
                )}

                {/* 3. 🟡 카카오톡 */}
                {user.kakao_id ? (
                  <div className="text-xs text-yellow-700 flex items-center gap-2 bg-[#FEE500]/30 px-2 py-1.5 rounded font-medium">
                    <MessageCircle size={12}/> {user.kakao_id}
                  </div>
                ) : (
                  <div className="text-xs text-slate-300 flex items-center gap-2 px-2 py-1.5 border border-dashed border-slate-200 rounded">
                    <MessageCircle size={12}/> 카카오 ID 미입력
                  </div>
                )}

                {/* 4. 🧠 MBTI */}
                {user.mbti ? (
                  <div className="text-xs text-purple-700 flex items-center gap-2 bg-purple-50 px-2 py-1.5 rounded font-bold">
                    <Smile size={12}/> {user.mbti}
                  </div>
                ) : (
                  <div className="text-xs text-slate-300 flex items-center gap-2 px-2 py-1.5 border border-dashed border-slate-200 rounded">
                    <Smile size={12}/> MBTI 미입력
                  </div>
                )}
              </div>

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