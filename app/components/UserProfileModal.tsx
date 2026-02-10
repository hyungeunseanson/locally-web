'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { X, User, Mail, MapPin } from 'lucide-react';
import Image from 'next/image';

interface UserProfileModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  role: 'host' | 'guest'; // 누구의 프로필을 보는지
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
    // 1. 기본 프로필 정보 조회
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // 2. 호스트라면 호스트 지원서 정보도 확인 (더 자세한 정보)
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-black transition-colors z-10 p-2 bg-white/50 rounded-full">
          <X size={20} />
        </button>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-black rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* 상단 배경 및 아바타 */}
            <div className="h-32 bg-slate-900 relative">
               <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                 <div className="w-24 h-24 rounded-full border-4 border-white bg-slate-200 overflow-hidden relative shadow-md">
                   <Image 
                     src={secureUrl(profile?.avatar_url)} 
                     alt="profile" 
                     fill 
                     className="object-cover"
                   />
                 </div>
               </div>
            </div>

            {/* 정보 영역 */}
            <div className="pt-14 pb-8 px-6 text-center">
              <h2 className="text-xl font-bold text-slate-900 mb-1">
                {profile?.full_name || (role === 'host' ? '호스트' : '게스트')}
              </h2>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-6">
                {role === 'host' ? 'Host Profile' : 'Guest Profile'}
              </p>

              <div className="space-y-4 text-left">
                {/* 자기소개 */}
                <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-600 leading-relaxed min-h-[80px]">
                  {profile?.introduction || profile?.bio || "자기소개가 없습니다."}
                </div>

                {/* 연락처 정보 (이메일 등) */}
                <div className="flex items-center gap-3 text-sm text-slate-600 px-2">
                  <Mail size={16} className="text-slate-400"/>
                  <span>{profile?.email}</span>
                </div>
                {profile?.location && (
                  <div className="flex items-center gap-3 text-sm text-slate-600 px-2">
                    <MapPin size={16} className="text-slate-400"/>
                    <span>{profile?.location}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}