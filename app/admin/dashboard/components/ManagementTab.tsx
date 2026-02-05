'use client';

import React from 'react';
import { 
  Search, ChevronRight, User, Mail, Globe, MessageCircle, Phone, Smile, 
  Calendar, MapPin, Cake, CheckCircle2, ShoppingBag, CreditCard, StickyNote, Star, Clock 
} from 'lucide-react';
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
        
        {/* 필터 헤더 */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
          <h3 className="font-bold text-lg text-slate-800">
            {activeTab === 'APPS' && '📝 호스트 지원서'}
            {activeTab === 'EXPS' && '🎈 등록된 체험'}
            {activeTab === 'USERS' && '👥 고객 관리'}
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
          
          {/* A. 호스트 지원서 */}
          {activeTab === 'APPS' && apps.filter((item:any) => filter === 'ALL' ? true : filter === 'PENDING' ? item.status === 'pending' : item.status !== 'pending').map((app:any) => (
            <ListItem key={app.id} selected={selectedItem?.id === app.id} onClick={()=>setSelectedItem(app)} title={app.name} subtitle={`${app.host_nationality} / ${app.target_language}`} status={app.status} date={app.created_at} />
          ))}

          {/* B. 체험 리스트 */}
          {activeTab === 'EXPS' && exps.filter((item:any) => filter === 'ALL' ? true : filter === 'PENDING' ? item.status === 'pending' : item.status === 'active').map((exp:any) => (
            <ListItem key={exp.id} selected={selectedItem?.id === exp.id} onClick={()=>setSelectedItem(exp)} img={exp.photos?.[0]} title={exp.title} subtitle={`₩${exp.price.toLocaleString()}`} status={exp.status} date={exp.created_at} />
          ))}

          {/* ✅ C. 고객(유저) 리스트 */}
          {activeTab === 'USERS' && users.map((user:any) => (
            <ListItem 
              key={user.id} 
              selected={selectedItem?.id === user.id} 
              onClick={()=>setSelectedItem(user)} 
              img={user.avatar_url} 
              title={user.full_name || user.name || 'Unknown'} 
              subtitle={user.email} 
              status={user.nationality || '미상'} 
              date={user.created_at} 
              isUser={true}
            />
          ))}

          {/* D. 메시지 */}
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

      {/* 2. 상세 보기 영역 (오른쪽) */}
      {(activeTab !== 'CHATS') && (
        <div className="flex-[1.5] bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col p-8 overflow-y-auto shadow-sm">
          {selectedItem ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              
              {/* 공통 헤더 */}
              <div className="border-b border-slate-100 pb-6 flex justify-between items-start">
                <div>
                  {activeTab !== 'USERS' ? (
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-2 uppercase tracking-wide ${selectedItem.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{selectedItem.status}</span>
                  ) : (
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-2 uppercase tracking-wide bg-slate-100 text-slate-600">Customer</span>
                  )}
                  <h2 className="text-3xl font-black text-slate-900 leading-tight">{selectedItem.title || selectedItem.name || selectedItem.full_name || 'Unknown'}</h2>
                  <p className="text-xs text-slate-400 mt-2 font-mono">ID: {selectedItem.id}</p>
                </div>
                {/* 최근 접속 시간 (USERS 탭 전용) */}
                {activeTab === 'USERS' && (
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 flex items-center justify-end gap-1"><Clock size={10}/> 최근 접속</div>
                    <div className="text-sm font-bold text-slate-700">방금 전 (Online)</div>
                  </div>
                )}
              </div>

              {/* ✅ [USERS] 고객 상세 정보 (대폭 강화됨) */}
              {activeTab === 'USERS' && (
                <div className="space-y-8">
                  
                  {/* 1. 프로필 상세 그리드 */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1"><User size={12}/> 고객 프로필</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <InfoBox label="이메일" value={selectedItem.email} icon={<Mail size={14}/>} />
                      <InfoBox label="연락처" value={selectedItem.phone} icon={<Phone size={14}/>} />
                      <InfoBox label="생년월일" value={selectedItem.birth_date ? `${selectedItem.birth_date} ${calculateAge(selectedItem.birth_date)}` : null} icon={<Cake size={14}/>} />
                      <InfoBox label="국적" value={selectedItem.nationality} icon={<Globe size={14}/>} />
                      <InfoBox label="카카오톡 ID" value={selectedItem.kakao_id} icon={<MessageCircle size={14}/>} />
                      <InfoBox label="MBTI" value={selectedItem.mbti} icon={<Smile size={14}/>} />
                    </div>
                  </div>

                  {/* 2. 구매 활동 요약 */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1"><ShoppingBag size={12}/> 구매 활동</h4>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                       <StatSmall label="총 구매액" value="₩1,250,000" color="bg-blue-50 text-blue-700" />
                       <StatSmall label="구매 횟수" value="5회" color="bg-green-50 text-green-700" />
                       <StatSmall label="마지막 구매" value="3일 전" color="bg-slate-50 text-slate-700" />
                    </div>
                    
                    {/* 구매 내역 테이블 */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
                          <tr><th className="px-4 py-3">체험명</th><th className="px-4 py-3">날짜</th><th className="px-4 py-3 text-right">금액</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {[1,2,3].map(i => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 font-medium text-slate-800">을지로 노포 투어 - {i}차</td>
                              <td className="px-4 py-3 text-slate-500 text-xs">2026.02.0{i}</td>
                              <td className="px-4 py-3 text-right font-bold text-slate-900">₩50,000</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ✅ [New] 호스트가 남긴 리뷰 */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1"><Star size={12}/> 호스트 리뷰 (3개)</h4>
                    <div className="space-y-3">
                      {[1,2,3].map(i => (
                        <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-sm text-slate-900 flex items-center gap-1">Host Kim <Star size={10} fill="black" className="text-black"/> 5.0</span>
                            <span className="text-xs text-slate-400">2026.01.1{i}</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            약속 시간도 잘 지켜주시고 매너가 너무 좋으신 게스트님이었습니다. 다음에도 꼭 모시고 싶어요! 추천합니다.
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3. 관리자 메모 */}
                  <div className="mt-8">
                     <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1"><StickyNote size={12}/> 관리자 메모</h4>
                     <textarea className="w-full p-4 bg-yellow-50 border border-yellow-100 rounded-xl text-sm placeholder:text-yellow-700/50 focus:outline-none focus:border-yellow-300 transition-all resize-none h-24 text-yellow-900 leading-relaxed" placeholder="이 고객에 대한 특이사항을 기록하세요." />
                  </div>

                  {/* 계정 관리 버튼 */}
                  <div className="pt-6 mt-6 border-t border-slate-100">
                    <button onClick={()=>deleteItem('profiles', selectedItem.id)} className="w-full py-4 rounded-xl font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                      <Trash2 size={16}/> 계정 영구 삭제
                    </button>
                  </div>
                </div>
              )}

              {/* [EXPS] 체험 상세 정보 */}
              {activeTab === 'EXPS' && (
                <>
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
                  <div className="grid grid-cols-2 gap-4">
                    <InfoBox label="가격" value={`₩${selectedItem.price?.toLocaleString()}`} />
                    <InfoBox label="소요 시간" value={`${selectedItem.duration}시간`} />
                    <InfoBox label="최대 인원" value={`${selectedItem.max_guests}명`} />
                    <InfoBox label="지역" value={`${selectedItem.country} > ${selectedItem.city}`} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">상세 설명</h4>
                    <div className="bg-slate-50 p-5 rounded-xl text-sm leading-relaxed text-slate-700 whitespace-pre-wrap border border-slate-100">{selectedItem.description}</div>
                  </div>
                  {/* 동선 (Itinerary) */}
                  {selectedItem.itinerary && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">진행 코스</h4>
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

              {/* [APPS] 호스트 지원서 상세 */}
              {activeTab === 'APPS' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <InfoBox label="연락처" value={selectedItem.phone} icon={<Phone size={14}/>} />
                    <InfoBox label="이메일" value={selectedItem.email} icon={<Mail size={14}/>} />
                    <InfoBox label="국적" value={selectedItem.host_nationality} icon={<Globe size={14}/>} />
                    <InfoBox label="언어" value={selectedItem.target_language} icon={<MessageCircle size={14}/>} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">자기소개</h4>
                    <div className="bg-slate-50 p-5 rounded-xl text-sm leading-relaxed text-slate-700 whitespace-pre-wrap border border-slate-100">{selectedItem.self_intro}</div>
                  </div>
                </div>
              )}

              {/* 승인/거절 버튼 (APPS, EXPS 전용) */}
              {activeTab !== 'USERS' && (
                <div className="pt-8 mt-8 border-t border-slate-100 grid grid-cols-2 gap-4 sticky bottom-0 bg-white pb-4">
                  <button onClick={()=>updateStatus(activeTab==='APPS'?'host_applications':'experiences', selectedItem.id, 'rejected')} className="py-4 rounded-xl font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors">거절 (Reject)</button>
                  <button onClick={()=>updateStatus(activeTab==='APPS'?'host_applications':'experiences', selectedItem.id, 'approved')} className="py-4 rounded-xl font-bold text-white bg-slate-900 hover:bg-black shadow-lg hover:shadow-xl transition-all">승인 (Approve)</button>
                </div>
              )}

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
import { Trash2 } from 'lucide-react'; // 아이콘 추가

function ListItem({ selected, onClick, img, title, subtitle, status, date, isUser }: any) {
  return (
    <div onClick={onClick} className={`p-4 rounded-xl border cursor-pointer transition-all flex gap-4 items-center ${selected ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-100 hover:border-slate-300 hover:bg-white bg-white'}`}>
      {img ? (
        <img src={img} className="w-12 h-12 rounded-lg object-cover bg-slate-100 border border-slate-100 shrink-0"/>
      ) : (
        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
          <User size={20}/>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between mb-1">
          <div className="font-bold text-sm truncate text-slate-900">{title}</div>
          {isUser ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{status}</span>
          ) : (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${status==='pending'?'bg-yellow-100 text-yellow-700':status==='approved' || status==='active'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{status}</span>
          )}
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>{subtitle}</span>
          <span className="text-slate-400 font-mono">{new Date(date).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value, icon }: any) {
  return (
    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase mb-1">
        {icon} {label}
      </div>
      <div className="font-bold text-slate-900 text-sm">{value || '-'}</div>
    </div>
  );
}

function StatSmall({ label, value, color }: any) {
  return (
    <div className={`p-4 rounded-xl border border-transparent ${color || 'bg-slate-50 text-slate-700'}`}>
      <div className="text-[10px] font-bold opacity-70 mb-1 uppercase">{label}</div>
      <div className="text-lg font-black">{value}</div>
    </div>
  );
}