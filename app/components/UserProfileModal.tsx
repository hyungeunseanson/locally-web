'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { X, MapPin, Calendar, Languages, Smile, User, Globe } from 'lucide-react';
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

    // 2. 호스트라면 추가 정보 (소개, 언어 등)
    let extraData = {};
    if (role === 'host') {
      const { data: hostData } = await supabase
        .from('host_applications')
        .select('introduction, mbti, languages') // 🟢 MBTI, 언어 가져오기
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

  // 가입일 포맷 (예: 24.03 가입)
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
        {/* 닫기 버튼 */}
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-black transition-colors z-20 bg-white/80 p-2 rounded-full backdrop-blur-md">
          <X size={20} />
        </button>

        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-black rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* 상단 프로필 이미지 영역 */}
            <div className="pt-10 pb-6 px-6 flex flex-col items-center bg-slate-50 border-b border-slate-100">
               <div className="w-28 h-28 rounded-full border-4 border-white bg-slate-200 overflow-hidden shadow-lg relative mb-4">
                 <Image 
                   src={secureUrl(profile?.avatar_url)} 
                   alt="profile" 
                   fill 
                   className="object-cover"
                 />
               </div>

               <h2 className="text-xl font-bold text-slate-900 mb-1">
                 {profile?.full_name || (role === 'host' ? '호스트' : '게스트')}
               </h2>
               
               {/* 역할 & 가입일 */}
               <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                 <span className={`px-2 py-0.5 rounded-full ${role === 'host' ? 'bg-black text-white' : 'bg-slate-200 text-slate-600'}`}>
                   {role === 'host' ? 'Host' : 'Guest'}
                 </span>
                 <span>•</span>
                 <span>{formatJoinDate(profile?.created_at)}</span>
               </div>
            </div>

            {/* 🟢 핵심 정보 (성향/스펙) */}
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
                       {profile?.location || profile?.nationality || "비공개"}
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
                       {profile?.mbti || "비공개"}
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
                       {profile?.languages || "한국어"}
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
                       {profile?.gender || "비공개"}
                     </div>
                   </div>
                 </div>
               </div>

               {/* 자기소개 */}
               <div>
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                   About Me
                 </h3>
                 <div className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl min-h-[80px]">
                   {profile?.introduction || profile?.bio || "아직 작성된 자기소개가 없습니다."}
                 </div>
               </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}