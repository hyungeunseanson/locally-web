'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { X, MapPin, Calendar, Languages, Smile, User, Globe } from 'lucide-react';
import Image from 'next/image';

interface UserProfileModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  role: 'host' | 'guest'; // 'host'면 호스트 프로필, 'guest'면 일반 프로필
}

export default function UserProfileModal({ userId, isOpen, onClose, role }: UserProfileModalProps) {
  const [displayProfile, setDisplayProfile] = useState<any>(null); // 화면에 보여줄 통합 데이터
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen && userId) {
      fetchProfile();
    }
  }, [isOpen, userId, role]);

  const fetchProfile = async () => {
    setLoading(true);
    
    // 1. 기본 계정 정보 (공통) - 가입일, 국적 등은 여기서 가져옴
    const { data: baseProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    let finalData = { ...baseProfile }; // 기본으로 회원 정보 사용

    // 2. 호스트 프로필을 봐야 하는 경우 -> 호스트 신청서 정보로 덮어쓰기
    if (role === 'host') {
      const { data: hostData } = await supabase
        .from('host_applications')
        .select('name, profile_photo, introduction, mbti, languages, gender') // 호스트 전용 데이터
        .eq('user_id', userId)
        .single();
      
      if (hostData) {
        // 호스트 데이터가 있으면 이걸 우선시해서 덮어씌움
        finalData = {
          ...finalData,
          // 화면 표시용 이름/사진/소개 교체
          display_name: hostData.name || baseProfile.full_name,
          display_avatar: hostData.profile_photo || baseProfile.avatar_url,
          display_bio: hostData.introduction || baseProfile.introduction,
          // 호스트 전용 스펙
          mbti: hostData.mbti,
          languages: hostData.languages,
          gender: hostData.gender || baseProfile.gender
        };
      }
    } else {
      // 3. 일반 게스트 프로필인 경우 -> 기본 정보 매핑
      finalData = {
        ...finalData,
        display_name: baseProfile.full_name,
        display_avatar: baseProfile.avatar_url,
        display_bio: baseProfile.introduction || baseProfile.bio,
        // 게스트는 보통 MBTI 같은게 profiles에 없으면 비공개 처리
        mbti: baseProfile.mbti,
        languages: baseProfile.languages,
        gender: baseProfile.gender
      };
    }

    setDisplayProfile(finalData);
    setLoading(false);
  };

  const secureUrl = (url: string | null) => {
    if (!url) return "/default-avatar.png";
    if (url.startsWith('http://')) return url.replace('http://', 'https://');
    return url;
  };

  const formatJoinDate = (dateString: string) => {
    if (!dateString) return '최근';
    const date = new Date(dateString);
    return `${String(date.getFullYear()).slice(2)}.${String(date.getMonth() + 1).padStart(2, '0')} 가입`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden relative" 
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-black transition-colors z-20 bg-white/80 p-2 rounded-full backdrop-blur-md">
          <X size={20} />
        </button>

        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-slate-300" />
          </div>
        ) : (
          <>
            {/* 상단 프로필 이미지 영역 */}
            <div className="pt-10 pb-6 px-6 flex flex-col items-center bg-slate-50 border-b border-slate-100">
               <div className="w-28 h-28 rounded-full border-4 border-white bg-slate-200 overflow-hidden shadow-lg relative mb-4">
                 <Image 
                   src={secureUrl(displayProfile?.display_avatar)} 
                   alt="profile" 
                   fill 
                   className="object-cover"
                 />
               </div>

               <h2 className="text-xl font-bold text-slate-900 mb-1">
                 {displayProfile?.display_name || (role === 'host' ? '호스트' : '게스트')}
               </h2>
               
               <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                 <span className={`px-2 py-0.5 rounded-full ${role === 'host' ? 'bg-black text-white' : 'bg-slate-200 text-slate-600'}`}>
                   {role === 'host' ? 'Host' : 'Guest'}
                 </span>
                 <span>•</span>
                 <span>{formatJoinDate(displayProfile?.created_at)}</span>
               </div>
            </div>

            {/* 정보 카드 영역 */}
            <div className="p-6">
               <div className="grid grid-cols-2 gap-3 mb-6">
                 {/* 1. 국적/지역 */}
                 <div className="bg-slate-50 p-3 rounded-2xl flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                     <Globe size={16} />
                   </div>
                   <div className="min-w-0">
                     <div className="text-[10px] text-slate-400 font-bold uppercase">Location</div>
                     <div className="text-sm font-semibold text-slate-700 truncate">
                       {displayProfile?.location || displayProfile?.nationality || "비공개"}
                     </div>
                   </div>
                 </div>

                 {/* 2. MBTI */}
                 <div className="bg-slate-50 p-3 rounded-2xl flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                     <Smile size={16} />
                   </div>
                   <div className="min-w-0">
                     <div className="text-[10px] text-slate-400 font-bold uppercase">MBTI</div>
                     <div className="text-sm font-semibold text-slate-700 truncate">
                       {displayProfile?.mbti || "비공개"}
                     </div>
                   </div>
                 </div>

                 {/* 3. 언어 */}
                 <div className="bg-slate-50 p-3 rounded-2xl flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                     <Languages size={16} />
                   </div>
                   <div className="min-w-0">
                     <div className="text-[10px] text-slate-400 font-bold uppercase">Language</div>
                     <div className="text-sm font-semibold text-slate-700 truncate">
                       {displayProfile?.languages || "한국어"}
                     </div>
                   </div>
                 </div>

                 {/* 4. 성별 */}
                 <div className="bg-slate-50 p-3 rounded-2xl flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
                     <User size={16} />
                   </div>
                   <div className="min-w-0">
                     <div className="text-[10px] text-slate-400 font-bold uppercase">Gender</div>
                     <div className="text-sm font-semibold text-slate-700 truncate">
                       {displayProfile?.gender || "비공개"}
                     </div>
                   </div>
                 </div>
               </div>

               {/* 자기소개 */}
               <div>
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                   About Me
                 </h3>
                 <div className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl min-h-[80px] whitespace-pre-wrap">
                   {displayProfile?.display_bio || "아직 작성된 자기소개가 없습니다."}
                 </div>
               </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// 로딩용 컴포넌트
function Loader2({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}