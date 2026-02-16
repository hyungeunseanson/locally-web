'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Search, User, Mail, Globe, MessageCircle, Phone, Smile, Clock, 
  MapPin, Cake, CheckCircle2, ShoppingBag, StickyNote, Star, Trash2, Link as LinkIcon, Edit,
  CreditCard, FileText, Camera, Shield, Download, AlertTriangle, Check, X
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client'; // 🟢 Supabase 클라이언트 추가

export default function DetailsPanel({ activeTab, selectedItem, updateStatus, deleteItem }: any) {
  const supabase = createClient();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  // 🟢 [추가됨] 신분증 보안 URL 발급 로직
  // 'verification-docs' 버킷에 있는 파일은 그냥 <img> 태그로 못 봅니다. (403 에러)
  // 관리자 권한으로 '서명된 URL(Signed URL)'을 받아와야 볼 수 있습니다.
// 🟢 [수정됨] 보안 버킷(verification-docs) 연결 로직
useEffect(() => {
  if (activeTab === 'APPS' && selectedItem?.id_card_file) {
    const fetchSignedUrl = async () => {
      try {
        // 1. DB에 저장된 전체 경로(URL)에서 '파일명'만 추출
        const fullPath = selectedItem.id_card_file;
        let fileName = fullPath.split('/').pop(); 
        
        // URL 뒤에 ?쿼리스트링이 붙어있다면 제거
        if (fileName?.includes('?')) {
          fileName = fileName.split('?')[0];
        }

        if (!fileName) return;

        // 2. [중요] 'verification-docs' 버킷의 'id_card' 폴더 안을 찾도록 경로 조립
        // (사용자님이 Supabase 대시보드에서 파일을 이 경로로 옮겨주셔야 함)
        const securePath = `id_card/${fileName}`;

        console.log("🔒 보안 스토리지 요청:", "verification-docs", securePath);

        const { data, error } = await supabase
          .storage
          .from('verification-docs') // 🟢 프라이빗 버킷 이름
          .createSignedUrl(securePath, 3600); // 1시간 유효한 보안 링크 생성

        if (data) setSignedUrl(data.signedUrl);
        if (error) {
          console.error("🔥 스토리지 에러 (버킷/파일이 존재하는지 확인하세요):", error);
          setSignedUrl(null);
        }
      } catch (e) {
        console.error("URL 파싱 에러:", e);
      }
    };
    fetchSignedUrl();
  } else {
    setSignedUrl(null);
  }
}, [selectedItem, activeTab]);
  
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
        
        {/* 공통 헤더 */}
        <div className="border-b border-slate-100 pb-6 flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
               {selectedItem.profile_photo || selectedItem.avatar_url ? (
                 <img src={selectedItem.profile_photo || selectedItem.avatar_url} className="w-full h-full object-cover"/>
               ) : <div className="w-full h-full flex items-center justify-center text-slate-300"><User size={24}/></div>}
            </div>
            <div>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-2 uppercase tracking-wide ${activeTab === 'USERS' ? 'bg-slate-100 text-slate-600' : selectedItem.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                {activeTab === 'USERS' ? 'Customer' : selectedItem.status}
              </span>
              <h2 className="text-2xl font-black text-slate-900 leading-tight">
                {selectedItem.name || selectedItem.title || 'Unknown'}
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-mono">ID: {selectedItem.id}</p>
            </div>
          </div>
          {(activeTab === 'USERS' || activeTab === 'BOOKINGS') && (
            <div className="text-right text-xs font-bold text-slate-700">
              <div className="text-[10px] text-slate-400 uppercase mb-1 flex justify-end gap-1"><Clock size={10}/> 최근 접속</div>
              방금 전 (Online)
            </div>
          )}
        </div>

        {/* 🔵 [USERS] 고객 상세 정보 */}
        {activeTab === 'USERS' && (
          <div className="space-y-8">
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
            
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1"><ShoppingBag size={12}/> 구매 활동</h4>
              <div className="grid grid-cols-3 gap-4 mb-4">
                  <StatSmall label="총 구매액" value="₩1,250,000" color="bg-blue-50 text-blue-700" />
                  <StatSmall label="구매 횟수" value="5회" color="bg-green-50 text-green-700" />
                  <StatSmall label="마지막 구매" value="3일 전" color="bg-slate-50 text-slate-700" />
              </div>
            </div>
            <div className="pt-6 mt-6 border-t border-slate-100">
              <button onClick={()=>deleteItem('profiles', selectedItem.id)} className="w-full py-4 rounded-xl font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"><Trash2 size={16}/> 계정 영구 삭제</button>
            </div>
          </div>
        )}

        {/* 🟠 [APPS] 호스트 지원서 상세 */}
        {activeTab === 'APPS' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <InfoBox label="연락처" value={selectedItem.phone} icon={<Phone size={14}/>} />
              <InfoBox label="이메일" value={selectedItem.email} icon={<Mail size={14}/>} />
              <InfoBox label="국적" value={selectedItem.host_nationality === 'Korea' ? '🇰🇷 한국인' : '🇯🇵 일본인'} icon={<Globe size={14}/>} />
              <InfoBox label="생년월일" value={selectedItem.dob} icon={<Cake size={14}/>} />
            </div>

            {/* 프로필 사진 */}
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
               <div className="w-20 h-20 rounded-full bg-white overflow-hidden border border-slate-200 flex-shrink-0">
                 {selectedItem.profile_photo ? <img src={selectedItem.profile_photo} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-300"><User size={32}/></div>}
               </div>
               <div>
                 <div className="text-xs font-bold text-slate-400 uppercase mb-1">프로필 사진</div>
                 {selectedItem.profile_photo ? <a href={selectedItem.profile_photo} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs font-bold">원본 보기</a> : <span className="text-slate-400 text-xs">사진 없음</span>}
               </div>
            </div>

            {/* 언어 */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
               <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase mb-2"><MessageCircle size={14}/> 언어</div>
               <div className="flex flex-wrap gap-2">
                 {Array.isArray(selectedItem.languages) && selectedItem.languages.length > 0 
                   ? selectedItem.languages.map((l:string) => <span key={l} className="px-2 py-1 bg-white border rounded text-xs font-bold">{l}</span>)
                   : <span className="text-sm font-bold text-slate-900">{selectedItem.target_language || '-'}</span>}
               </div>
            </div>
            
            {/* 소셜 & 유입경로 */}
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-slate-50 p-3 rounded-lg border border-slate-100"><div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Instagram</div><div className="font-bold text-sm">{selectedItem.instagram || '-'}</div></div>
               <div className="bg-slate-50 p-3 rounded-lg border border-slate-100"><div className="text-[10px] font-bold text-slate-400 uppercase mb-1">가입 경로</div><div className="font-bold text-sm">{selectedItem.source || '-'}</div></div>
            </div>

            <div><h4 className="text-xs font-bold text-slate-400 uppercase mb-2">자기소개</h4><div className="bg-slate-50 p-5 rounded-xl text-sm leading-relaxed text-slate-700 whitespace-pre-wrap border border-slate-100">{selectedItem.self_intro}</div></div>
            <div><h4 className="text-xs font-bold text-slate-400 uppercase mb-2">지원 동기</h4><div className="bg-slate-50 p-5 rounded-xl text-sm leading-relaxed text-slate-700 whitespace-pre-wrap border border-slate-100">{selectedItem.motivation || '(내용 없음)'}</div></div>

            {/* 정산 계좌 */}
            <div className="bg-green-50 p-5 rounded-xl border border-green-100">
               <h4 className="text-xs font-bold text-green-700 uppercase mb-3 flex items-center gap-1"><CreditCard size={14}/> 정산 계좌 정보</h4>
               <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><span className="text-xs text-green-600 block mb-1">은행</span><span className="font-bold">{selectedItem.bank_name || '-'}</span></div>
                  <div><span className="text-xs text-green-600 block mb-1">계좌번호</span><span className="font-bold">{selectedItem.account_number || '-'}</span></div>
                  <div><span className="text-xs text-green-600 block mb-1">예금주</span><span className="font-bold">{selectedItem.account_holder || '-'}</span></div>
               </div>
            </div>

            {/* 🟢 [수정됨] 신분증 확인 섹션 (보안 URL 적용) */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
               <h4 className="text-xs font-bold text-purple-700 uppercase mb-3 flex items-center gap-1">
                 <Shield size={14}/> 신분증/자격증 확인 (관리자 전용)
               </h4>
               {signedUrl ? (
                 <div className="space-y-3">
                   <div className="relative aspect-[1.6] w-full bg-slate-200 rounded-lg overflow-hidden border border-slate-300 group">
                     <img src={signedUrl} className="w-full h-full object-contain bg-black/5"/>
                     <a href={signedUrl} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white font-bold text-sm">
                       <Download size={16} className="mr-2"/> 원본 다운로드
                     </a>
                   </div>
                   <p className="text-[10px] text-slate-400 text-center">* 보안을 위해 1시간 후 링크가 만료됩니다.</p>
                 </div>
               ) : (
                 <div className="w-full h-24 bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 text-sm">
                   <FileText size={20} className="mb-2 opacity-50"/>
                   {selectedItem.id_card_file ? '이미지 로딩 중...' : '제출된 신분증이 없습니다.'}
                 </div>
               )}
            </div>

            {/* 승인/거절 버튼 */}
            <div className="pt-8 mt-8 border-t border-slate-100 grid grid-cols-2 gap-4 sticky bottom-0 bg-white pb-4 z-10">
              <button onClick={()=>updateStatus('host_applications', selectedItem.id, 'revision')} className="py-4 rounded-xl font-bold text-orange-600 bg-orange-50 border border-orange-100 hover:bg-orange-100">보완 요청</button>
              <button onClick={()=>updateStatus('host_applications', selectedItem.id, 'rejected')} className="py-4 rounded-xl font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100">거절</button>
              <button onClick={()=>updateStatus('host_applications', selectedItem.id, 'approved')} className="col-span-2 py-4 rounded-xl font-bold text-white bg-slate-900 hover:bg-black shadow-lg flex items-center justify-center gap-2"><Check size={18}/> 승인 (호스트 권한 부여)</button>
              <button onClick={()=>deleteItem('host_applications', selectedItem.id)} className="col-span-2 text-xs text-slate-400 hover:text-red-500 py-2 flex items-center justify-center gap-1"><Trash2 size={12}/> 영구 삭제</button>
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
              <InfoBox label="가격" value={selectedItem.price !== undefined ? `₩${selectedItem.price.toLocaleString()}` : '-'} />
              <InfoBox label="소요 시간" value={selectedItem.duration ? `${selectedItem.duration}시간` : '-'} />
              <InfoBox label="최대 인원" value={selectedItem.max_guests ? `${selectedItem.max_guests}명` : '-'} />
              <InfoBox label="지역" value={selectedItem.city ? `${selectedItem.country || ''} > ${selectedItem.city}` : '-'} />
            </div>
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-start gap-3">
              <MapPin size={20} className="text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase mb-1">만나는 장소 (Meeting Point)</div>
                <div className="font-bold text-slate-900 text-sm">
                  {selectedItem.meeting_point || '정보 없음'}
                </div>
              </div>
            </div>
            
            <Link href={`/host/experiences/${selectedItem.id}/edit`}>
              <button className="w-full py-3 bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors mb-4">
                <Edit size={16}/> 관리자 권한으로 수정하기
              </button>
            </Link>

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

            <div className="pt-8 mt-8 border-t border-slate-100 grid grid-cols-2 gap-4 sticky bottom-0 bg-white pb-4">
              <button onClick={()=>updateStatus('experiences', selectedItem.id, 'revision')} className="py-4 rounded-xl font-bold text-orange-600 bg-orange-50 border border-orange-100 hover:bg-orange-100 transition-colors">보완 요청</button>
              <button onClick={()=>updateStatus('experiences', selectedItem.id, 'rejected')} className="py-4 rounded-xl font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors">거절</button>
              <button onClick={()=>updateStatus('experiences', selectedItem.id, 'approved')} className="col-span-2 py-4 rounded-xl font-bold text-white bg-slate-900 hover:bg-black shadow-lg transition-all">승인</button>
              <button onClick={()=>deleteItem('experiences', selectedItem.id)} className="col-span-2 text-xs text-slate-400 hover:text-red-500 py-2 flex items-center justify-center gap-1"><Trash2 size={12}/> 체험 영구 삭제</button>
            </div>
          </div>
        )}

        {/* 🟢 [BOOKINGS] 실시간/예약 상세 */}
        {(activeTab === 'BOOKINGS' || activeTab === 'REALTIME') && (
          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1"><Clock size={12}/> 예약 정보</h4>
              <div className="grid grid-cols-2 gap-4">
                <InfoBox label="예약 번호" value={selectedItem.id} />
                <InfoBox label="상태" value={selectedItem.status} />
                <InfoBox label="결제 금액" value={`₩${selectedItem.total_price?.toLocaleString() || 0}`} />
                <InfoBox label="인원" value={`${selectedItem.guests}명`} />
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">예약자 정보</h4>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-slate-500">이름</span><span className="font-bold">{selectedItem.user_name || selectedItem.profiles?.name || 'Unknown'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">연락처</span><span>{selectedItem.user_phone || selectedItem.profiles?.phone || '-'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">이메일</span><span>{selectedItem.user_email || selectedItem.profiles?.email || '-'}</span></div>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">체험 정보</h4>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                 <div className="font-bold text-sm mb-1">{selectedItem.experience_title || selectedItem.experiences?.title}</div>
                 <div className="text-xs text-slate-500">{selectedItem.date} · {selectedItem.time}</div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// 🟡 내부 컴포넌트
function InfoBox({ label, value, icon }: any) {
  return <div className="bg-slate-50 p-3 rounded-lg border border-slate-100"><div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase mb-1">{icon} {label}</div><div className="font-bold text-slate-900 text-sm truncate">{value || '-'}</div></div>;
}

function StatSmall({ label, value, color }: any) {
  return <div className={`p-4 rounded-xl border border-transparent ${color || 'bg-slate-50 text-slate-700'}`}><div className="text-[10px] font-bold opacity-70 mb-1 uppercase">{label}</div><div className="text-lg font-black">{value}</div></div>;
}