'use client';

import React from 'react';
import { 
  Search, User, Mail, Globe, MessageCircle, Phone, Smile, Clock, 
  MapPin, Cake, CheckCircle2, ShoppingBag, StickyNote, Star, Trash2, Link as LinkIcon 
} from 'lucide-react';

export default function DetailsPanel({ activeTab, selectedItem, updateStatus, deleteItem }: any) {
  
  if (!selectedItem) {
    return (
      <div className="flex-[1.5] bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col items-center justify-center text-slate-300 shadow-sm">
        <Search size={64} className="mb-6 opacity-20"/>
        <p className="font-medium text-lg">왼쪽 리스트에서 항목을 선택해주세요.</p>
      </div>
    );
  }

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
    <div className="flex-[1.5] bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col p-8 overflow-y-auto shadow-sm">
      <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
        
        {/* 🟢 공통 헤더 (타이틀, 상태, ID) */}
        <div className="border-b border-slate-100 pb-6 flex justify-between items-start">
          <div>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-2 uppercase tracking-wide ${activeTab === 'USERS' ? 'bg-slate-100 text-slate-600' : selectedItem.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
              {activeTab === 'USERS' ? 'Customer' : selectedItem.status}
            </span>
            <h2 className="text-3xl font-black text-slate-900 leading-tight">
              {selectedItem.title || selectedItem.name || selectedItem.full_name || 'Unknown'}
            </h2>
            <p className="text-xs text-slate-400 mt-2 font-mono">ID: {selectedItem.id}</p>
          </div>
          {activeTab === 'USERS' && (
            <div className="text-right text-xs font-bold text-slate-700">
              <div className="text-[10px] text-slate-400 uppercase mb-1 flex justify-end gap-1"><Clock size={10}/> 최근 접속</div>
              방금 전 (Online)
            </div>
          )}
        </div>

        {/* 🔵 [USERS] 고객 상세 정보 (개인정보 + 활동로그 + 리뷰) */}
        {activeTab === 'USERS' && (
          <div className="space-y-8">
            {/* 1. 프로필 상세 */}
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

            {/* 2. 구매 활동 */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1"><ShoppingBag size={12}/> 구매 활동</h4>
              <div className="grid grid-cols-3 gap-4 mb-4">
                  <StatSmall label="총 구매액" value="₩1,250,000" color="bg-blue-50 text-blue-700" />
                  <StatSmall label="구매 횟수" value="5회" color="bg-green-50 text-green-700" />
                  <StatSmall label="마지막 구매" value="3일 전" color="bg-slate-50 text-slate-700" />
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
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

            {/* 3. 호스트 리뷰 */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1"><Star size={12}/> 받은 리뷰 (3개)</h4>
              <div className="space-y-3">
                {[1,2].map(i => (
                  <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-sm text-slate-900 flex items-center gap-1">Host Kim <Star size={10} fill="black"/> 5.0</span>
                      <span className="text-xs text-slate-400">2026.01.1{i}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">약속 시간도 잘 지켜주시고 매너가 너무 좋으신 게스트님이었습니다.</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. 관리자 메모 */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1"><StickyNote size={12}/> 관리자 메모</h4>
              <textarea className="w-full p-4 bg-yellow-50 border border-yellow-100 rounded-xl text-sm h-24 resize-none placeholder:text-yellow-700/50 focus:border-yellow-300 outline-none" placeholder="이 고객에 대한 특이사항을 기록하세요." />
            </div>
            
            {/* 계정 삭제 버튼 */}
            <div className="pt-6 mt-6 border-t border-slate-100">
              <button onClick={()=>deleteItem('profiles', selectedItem.id)} className="w-full py-4 rounded-xl font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                <Trash2 size={16}/> 계정 영구 삭제
              </button>
            </div>
          </div>
        )}

        {/* 🟠 [APPS] 호스트 지원서 상세 (누락된 정보 복구) */}
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
            
            {/* 복구된 항목들: 지원동기, 경력, SNS */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">지원 동기</h4>
              <div className="bg-slate-50 p-5 rounded-xl text-sm leading-relaxed text-slate-700 whitespace-pre-wrap border border-slate-100">{selectedItem.motivation || '(내용 없음)'}</div>
            </div>
            
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">관련 경력</h4>
              <div className="bg-slate-50 p-5 rounded-xl text-sm leading-relaxed text-slate-700 whitespace-pre-wrap border border-slate-100">{selectedItem.experience || '(내용 없음)'}</div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1"><LinkIcon size={12}/> SNS 및 포트폴리오</h4>
              {selectedItem.sns_links ? (
                <a href={selectedItem.sns_links} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm bg-blue-50 p-3 rounded-lg block truncate hover:text-blue-800">
                  {selectedItem.sns_links}
                </a>
              ) : <div className="text-sm text-slate-400">없음</div>}
            </div>

            {/* 관리 버튼 (보완요청/거절/승인/삭제) */}
            <div className="pt-8 mt-8 border-t border-slate-100 grid grid-cols-2 gap-4 sticky bottom-0 bg-white pb-4">
              <button onClick={()=>updateStatus('host_applications', selectedItem.id, 'revision')} className="py-4 rounded-xl font-bold text-orange-600 bg-orange-50 border border-orange-100 hover:bg-orange-100 transition-colors">보완 요청</button>
              <button onClick={()=>updateStatus('host_applications', selectedItem.id, 'rejected')} className="py-4 rounded-xl font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors">거절 (Reject)</button>
              <button onClick={()=>updateStatus('host_applications', selectedItem.id, 'approved')} className="col-span-2 py-4 rounded-xl font-bold text-white bg-slate-900 hover:bg-black shadow-lg transition-all">승인 (Approve)</button>
              <button onClick={()=>deleteItem('host_applications', selectedItem.id)} className="col-span-2 text-xs text-slate-400 hover:text-red-500 py-2 flex items-center justify-center gap-1"><Trash2 size={12}/> 지원서 영구 삭제</button>
            </div>
          </div>
        )}

        {/* 🟣 [EXPS] 체험 상세 정보 */}
        {activeTab === 'EXPS' && (
          <div className="space-y-8">
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
            {selectedItem.itinerary && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">진행 코스</h4>
                <div className="space-y-3 pl-4 border-l-2 border-slate-100">
                  {selectedItem.itinerary.map((it:any,i:number)=><div key={i} className="relative pl-6"><div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-slate-300 border-2 border-white"></div><div className="font-bold text-sm">{it.title}</div><div className="text-xs text-slate-500 mt-1">{it.description}</div></div>)}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-6">
              <div><h4 className="text-xs font-bold text-slate-400 uppercase mb-2">포함</h4><ul className="text-sm space-y-1">{selectedItem.inclusions?.map((t:string,i:number)=><li key={i} className="flex gap-2 items-center"><CheckCircle2 size={12} className="text-green-500"/> {t}</li>)}</ul></div>
              <div><h4 className="text-xs font-bold text-slate-400 uppercase mb-2">불포함</h4><ul className="text-sm space-y-1 text-slate-500">{selectedItem.exclusions?.map((t:string,i:number)=><li key={i}>- {t}</li>)}</ul></div>
            </div>

            {/* 관리 버튼 (보완요청/거절/승인/삭제) */}
            <div className="pt-8 mt-8 border-t border-slate-100 grid grid-cols-2 gap-4 sticky bottom-0 bg-white pb-4">
              <button onClick={()=>updateStatus('experiences', selectedItem.id, 'revision')} className="py-4 rounded-xl font-bold text-orange-600 bg-orange-50 border border-orange-100 hover:bg-orange-100 transition-colors">보완 요청</button>
              <button onClick={()=>updateStatus('experiences', selectedItem.id, 'rejected')} className="py-4 rounded-xl font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors">거절 (Reject)</button>
              <button onClick={()=>updateStatus('experiences', selectedItem.id, 'approved')} className="col-span-2 py-4 rounded-xl font-bold text-white bg-slate-900 hover:bg-black shadow-lg transition-all">승인 (Approve)</button>
              <button onClick={()=>deleteItem('experiences', selectedItem.id)} className="col-span-2 text-xs text-slate-400 hover:text-red-500 py-2 flex items-center justify-center gap-1"><Trash2 size={12}/> 체험 영구 삭제</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// 🟡 내부 컴포넌트 (Shared)
function InfoBox({ label, value, icon }: any) {
  return <div className="bg-slate-50 p-3 rounded-lg border border-slate-100"><div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase mb-1">{icon} {label}</div><div className="font-bold text-slate-900 text-sm">{value || '-'}</div></div>;
}

function StatSmall({ label, value, color }: any) {
  return <div className={`p-4 rounded-xl border border-transparent ${color || 'bg-slate-50 text-slate-700'}`}><div className="text-[10px] font-bold opacity-70 mb-1 uppercase">{label}</div><div className="text-lg font-black">{value}</div></div>;
}
//ㅇㅇ//