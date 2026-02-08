'use client';

import React from 'react';
import Link from 'next/link'; // Link 추가
import { 
  Search, User, Mail, Globe, MessageCircle, Phone, Smile, Clock, 
  MapPin, Cake, CheckCircle2, ShoppingBag, StickyNote, Star, Trash2, Link as LinkIcon, Edit,
  CreditCard, FileText, Camera  // ✅ 추가된 아이콘
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

{/* 🟠 [APPS] 호스트 지원서 상세 */}
{activeTab === 'APPS' && (
          <div className="space-y-6">
            
            {/* 1. 기본 인적사항 */}
            <div className="grid grid-cols-2 gap-4">
              <InfoBox label="연락처" value={selectedItem.phone} icon={<Phone size={14}/>} />
              <InfoBox label="이메일" value={selectedItem.email} icon={<Mail size={14}/>} />
              <InfoBox label="국적" value={selectedItem.host_nationality === 'Korea' ? '🇰🇷 한국인' : '🇯🇵 일본인'} icon={<Globe size={14}/>} />
              <InfoBox label="생년월일" value={selectedItem.dob} icon={<Cake size={14}/>} />
            </div>

            {/* 2. 언어 능력 (배열/문자열 호환 처리) */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
               <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase mb-3">
                 <MessageCircle size={14}/> 언어 능력 (Level {selectedItem.language_level || '?'})
               </div>
               <div className="flex flex-wrap gap-2 mb-3">
                 {/* ✅ 언어 데이터가 배열인지 문자열인지 확인하여 표시 */}
                 {Array.isArray(selectedItem.languages) && selectedItem.languages.length > 0 
                   ? selectedItem.languages.map((l:string) => <span key={l} className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold shadow-sm">{l}</span>)
                   : <span className="text-sm font-bold text-slate-900">{selectedItem.target_language || '-'}</span>
                 }
               </div>
               {selectedItem.language_cert && (
                 <div className="text-xs text-slate-500 bg-white p-2 rounded-lg border border-slate-100 inline-block">
                   🏅 자격증: {selectedItem.language_cert}
                 </div>
               )}
            </div>

            {/* 3. 소셜 & 유입경로 (누락되었던 부분) */}
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Instagram</div>
                  <div className="font-bold text-sm">{selectedItem.instagram || '-'}</div>
               </div>
               <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">가입 경로</div>
                  <div className="font-bold text-sm">{selectedItem.source || '-'}</div>
               </div>
            </div>
            
            {/* 4. 자기소개 & 지원동기 */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">자기소개</h4>
                <div className="bg-white p-4 rounded-xl text-sm leading-relaxed text-slate-700 whitespace-pre-wrap border border-slate-200 shadow-sm">{selectedItem.self_intro}</div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">지원 동기</h4>
                <div className="bg-white p-4 rounded-xl text-sm leading-relaxed text-slate-700 whitespace-pre-wrap border border-slate-200 shadow-sm">{selectedItem.motivation || '(내용 없음)'}</div>
              </div>
            </div>

            {/* 5. 정산 계좌 정보 (관리자만 볼 수 있음) */}
            <div className="bg-green-50 p-5 rounded-xl border border-green-100">
               <h4 className="text-xs font-bold text-green-700 uppercase mb-3 flex items-center gap-1"><CreditCard size={14}/> 정산 계좌 정보</h4>
               <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><span className="text-xs text-green-600 block mb-1">은행</span><span className="font-bold">{selectedItem.bank_name || '-'}</span></div>
                  <div><span className="text-xs text-green-600 block mb-1">계좌번호</span><span className="font-bold">{selectedItem.account_number || '-'}</span></div>
                  <div><span className="text-xs text-green-600 block mb-1">예금주</span><span className="font-bold">{selectedItem.account_holder || '-'}</span></div>
               </div>
            </div>

            {/* 6. 신분증 확인 */}
            <div>
               <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1"><FileText size={14}/> 제출된 신분증</h4>
               {selectedItem.id_card_file ? (
                 <a href={selectedItem.id_card_file} target="_blank" rel="noreferrer" className="block w-full h-48 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative group">
                    <img src={selectedItem.id_card_file} className="w-full h-full object-contain"/>
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold text-sm">
                      크게 보기 (새창)
                    </div>
                 </a>
               ) : (
                 <div className="w-full h-24 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-sm">신분증 파일 없음</div>
               )}
            </div>

            {/* 관리 버튼 (기존 유지) */}
            <div className="pt-8 mt-8 border-t border-slate-100 grid grid-cols-2 gap-4 sticky bottom-0 bg-white pb-4 z-10">
              <button onClick={()=>updateStatus('host_applications', selectedItem.id, 'revision')} className="py-4 rounded-xl font-bold text-orange-600 bg-orange-50 border border-orange-100 hover:bg-orange-100 transition-colors">보완 요청</button>
              <button onClick={()=>updateStatus('host_applications', selectedItem.id, 'rejected')} className="py-4 rounded-xl font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors">거절 (Reject)</button>
              <button onClick={()=>updateStatus('host_applications', selectedItem.id, 'approved')} className="col-span-2 py-4 rounded-xl font-bold text-white bg-slate-900 hover:bg-black shadow-lg transition-all">승인 (Approve)</button>
              <button onClick={()=>deleteItem('host_applications', selectedItem.id)} className="col-span-2 text-xs text-slate-400 hover:text-red-500 py-2 flex items-center justify-center gap-1"><Trash2 size={12}/> 지원서 영구 삭제</button>
            </div>
            {/* ✅ [추가할 코드 시작] 관리자 수정 버튼 */}
            <Link href={`/host/experiences/${selectedItem.id}/edit`}>
              <button className="w-full py-3 bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors mb-4">
                <Edit size={16}/> 관리자 권한으로 수정하기
              </button>
            </Link>
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