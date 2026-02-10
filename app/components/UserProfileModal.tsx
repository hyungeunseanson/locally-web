'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { X, MapPin, Calendar, Instagram, CheckCircle2, ExternalLink } from 'lucide-react';
import Image from 'next/image';

interface UserProfileModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  role: 'host' | 'guest'; 
}

export default function UserProfileModal({ userId, isOpen, onClose, role }: UserProfileModalProps) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen && userId) {
      fetchProfile();
    }
  }, [isOpen, userId]);

  const fetchProfile = async () => {
    setLoading(true);
    // 1. 기본 프로필 정보
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // 2. 호스트라면 추가 정보 (SNS, 소개)
    let extraData = {};
    if (role === 'host') {
      const { data: hostData } = await supabase
        .from('host_applications')
        .select('introduction, sns_url')
        .eq('user_id', userId)
        .single();
      if (hostData) extraData = hostData;
    }

    setProfile({ ...profileData, ...extraData });
    setLoading(false);
  };

  const secureUrl = (url: string | null) => {
    if (!url) return "/default-avatar.png";
    if (url.startsWith('http://')) return url.replace('http://', 'https://');
    return url;
  };

  // 가입일 포맷팅 (예: 2024년 3월부터 활동)
  const formatJoinDate = (dateString: string) => {
    if (!dateString) return '최근 가입';
    const date = new Date(dateString);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월부터 활동`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden relative transform transition-all scale-100" 
        onClick={(e) => e.stopPropagation()} // 내부 클릭 시 닫힘 방지
      >
        {/* 닫기 버튼 */}
        <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-slate-200 transition-colors z-20 bg-black/20 hover:bg-black/40 p-2 rounded-full backdrop-blur-md">
          <X size={20} />
        </button>

        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-slate-300" />
          </div>
        ) : (
          <>
            {/* 상단 배경 (프로필 커버 느낌) */}
            <div className="h-36 bg-gradient-to-r from-slate-800 to-black relative">
               <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
            </div>

            {/* 프로필 사진 & 기본 정보 */}
            <div className="px-6 relative">
               {/* 아바타 (중앙 정렬) */}
               <div className="absolute -top-16 left-1/2 -translate-x-1/2">
                 <div className="w-32 h-32 rounded-full border-[6px] border-white bg-slate-200 overflow-hidden shadow-lg relative">
                   <Image 
                     src={secureUrl(profile?.avatar_url)} 
                     alt="profile" 
                     fill 
                     className="object-cover"
                   />
                 </div>
                 {/* 인증 배지 (신뢰도 상승) */}
                 <div className="absolute bottom-2 right-2 bg-blue-500 text-white p-1 rounded-full border-2 border-white shadow-sm" title="본인 인증됨">
                   <CheckCircle2 size={16} />
                 </div>
               </div>

               {/* 이름 & 역할 */}
               <div className="mt-20 text-center">
                 <h2 className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-1">
                   {profile?.full_name || (role === 'host' ? '호스트' : '게스트')}
                 </h2>
                 <p className="text-sm text-slate-500 font-medium">
                   {role === 'host' ? 'Local Host' : 'Global Guest'}
                 </p>
               </div>

               {/* 🟢 핵심 매력 정보 (태그 스타일) */}
               <div className="flex flex-wrap justify-center gap-2 mt-4 mb-6">
                 {/* 1. 거주지/국적 */}
                 {profile?.location && (
                   <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                     <MapPin size={12} />
                     {profile.location}
                   </span>
                 )}
                 {/* 2. 가입일 (신뢰도) */}
                 <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                   <Calendar size={12} />
                   {formatJoinDate(profile?.created_at)}
                 </span>
               </div>

               <hr className="border-slate-100 my-4" />

               {/* 자기소개 (Vibe) */}
               <div className="text-left space-y-2 mb-6">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">About</h3>
                 <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-xl">
                   {profile?.introduction || profile?.bio || "아직 작성된 자기소개가 없습니다."}
                 </p>
               </div>

               {/* 🟢 3. SNS 링크 (호스트인 경우만 - 매력 어필) */}
               {role === 'host' && profile?.sns_url && (
                 <div className="mb-8">
                   <a 
                     href={profile.sns_url.startsWith('http') ? profile.sns_url : `https://${profile.sns_url}`} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-sm shadow-md hover:opacity-90 transition-opacity"
                   >
                     <Instagram size={18} />
                     인스타그램 구경하기
                     <ExternalLink size={14} className="opacity-70"/>
                   </a>
                 </div>
               )}
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