'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { X, Languages, Smile, User, Globe, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { formatGenderLabel, formatProfileLanguages, normalizeLanguageList } from '@/app/utils/profile';

interface UserProfileModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  role: 'host' | 'guest';
}

interface UserProfileModalState {
  created_at?: string | null;
  display_name?: string | null;
  display_avatar?: string | null;
  display_bio?: string | null;
  location?: string | null;
  mbti?: string | null;
  languages?: string[];
  gender?: string | null;
}

export default function UserProfileModal({ userId, isOpen, onClose, role }: UserProfileModalProps) {
  const [displayProfile, setDisplayProfile] = useState<UserProfileModalState | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!isOpen || !userId) return;

    let cancelled = false;

    const loadProfile = async () => {
      setLoading(true);

      const { data: baseProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!baseProfile) {
        if (!cancelled) {
          setDisplayProfile(null);
          setLoading(false);
        }
        return;
      }

      let finalData: UserProfileModalState = {
        created_at: baseProfile.created_at,
      };

      if (role === 'host') {
        const { data: hostData } = await supabase
          .from('host_applications')
          .select('name, profile_photo, self_intro, host_nationality')
          .eq('user_id', userId)
          .maybeSingle();

        finalData = {
          ...finalData,
          display_name: hostData?.name || baseProfile.full_name,
          display_avatar: hostData?.profile_photo || baseProfile.avatar_url,
          display_bio: hostData?.self_intro || baseProfile.bio || baseProfile.introduction,
          location: hostData?.host_nationality || baseProfile.nationality,
          mbti: baseProfile.mbti,
          languages: normalizeLanguageList(baseProfile.languages),
          gender: baseProfile.gender,
        };
      } else {
        finalData = {
          ...finalData,
          display_name: baseProfile.full_name,
          display_avatar: baseProfile.avatar_url,
          display_bio: baseProfile.bio || baseProfile.introduction,
          location: baseProfile.nationality,
          mbti: baseProfile.mbti,
          languages: normalizeLanguageList(baseProfile.languages),
          gender: baseProfile.gender,
        };
      }

      if (!cancelled) {
        setDisplayProfile(finalData);
        setLoading(false);
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [isOpen, role, supabase, userId]);

  const secureUrl = (url: string | null | undefined) => {
    if (!url || url === '') return null;
    if (url.startsWith('http://')) return url.replace('http://', 'https://');
    return url;
  };

  const formatJoinDate = (dateString: string) => {
    if (!dateString) return '최근';
    const date = new Date(dateString);
    return `${String(date.getFullYear()).slice(2)}.${String(date.getMonth() + 1).padStart(2, '0')} 가입`;
  };
  const displayAvatarUrl = secureUrl(displayProfile?.display_avatar);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 md:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="bg-white rounded-2xl md:rounded-[32px] shadow-2xl w-[92vw] max-w-[380px] md:max-w-sm overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 md:top-4 right-3 md:right-4 text-slate-400 hover:text-black transition-colors z-20 bg-white/80 p-1.5 md:p-2 rounded-full backdrop-blur-md">
          <X size={18} className="md:w-5 md:h-5" />
        </button>

        {loading ? (
          <div className="h-72 md:h-96 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-slate-300" />
          </div>
        ) : (
          <>
            <div className="pt-8 md:pt-10 pb-4 md:pb-6 px-4 md:px-6 flex flex-col items-center bg-slate-50 border-b border-slate-100">
              <div className="w-20 h-20 md:w-28 md:h-28 rounded-full border-4 border-white bg-slate-200 overflow-hidden shadow-lg relative mb-3 md:mb-4">
                {displayAvatarUrl ? (
                  <Image
                    src={displayAvatarUrl}
                    alt="profile"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300">
                    <User size={28} className="md:h-9 md:w-9" />
                  </div>
                )}
              </div>

              <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-1">
                {displayProfile?.display_name || (role === 'host' ? '호스트' : '게스트')}
              </h2>

              <div className="flex items-center gap-2 text-[11px] md:text-xs text-slate-500 font-medium">
                <span className={`px-2 py-0.5 rounded-full ${role === 'host' ? 'bg-black text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {role === 'host' ? 'Host' : 'Guest'}
                </span>
                <span>•</span>
                <span>{formatJoinDate(displayProfile?.created_at as string)}</span>
              </div>
            </div>

            <div className="p-4 md:p-6">
              <div className="grid grid-cols-2 gap-2.5 md:gap-3 mb-4 md:mb-6">
                {/* 국적/지역 */}
                <div className="bg-slate-50 p-2.5 md:p-3 rounded-xl md:rounded-2xl flex items-center gap-2 md:gap-3">
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><Globe size={14} className="md:w-4 md:h-4" /></div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Location</div>
                    <div className="text-[12px] md:text-sm font-semibold text-slate-700 truncate">
                      {displayProfile?.location || (role === 'host' ? '비공개' : '미입력')}
                    </div>
                  </div>
                </div>

                {/* MBTI */}
                <div className="bg-slate-50 p-2.5 md:p-3 rounded-xl md:rounded-2xl flex items-center gap-2 md:gap-3">
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0"><Smile size={14} className="md:w-4 md:h-4" /></div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">MBTI</div>
                    <div className="text-[12px] md:text-sm font-semibold text-slate-700 truncate">{displayProfile?.mbti || "비공개"}</div>
                  </div>
                </div>

                {/* 언어 */}
                <div className="bg-slate-50 p-2.5 md:p-3 rounded-xl md:rounded-2xl flex items-center gap-2 md:gap-3">
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0"><Languages size={14} className="md:w-4 md:h-4" /></div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Language</div>
                    <div className="text-[12px] md:text-sm font-semibold text-slate-700 truncate">
                      {formatProfileLanguages(displayProfile?.languages, role === 'host' ? '비공개' : '미입력')}
                    </div>
                  </div>
                </div>

                {/* 성별 */}
                <div className="bg-slate-50 p-2.5 md:p-3 rounded-xl md:rounded-2xl flex items-center gap-2 md:gap-3">
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center shrink-0"><User size={14} className="md:w-4 md:h-4" /></div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Gender</div>
                    <div className="text-[12px] md:text-sm font-semibold text-slate-700 truncate">
                      {formatGenderLabel(displayProfile?.gender)}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[11px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">About Me</h3>
                <div className="text-[12px] md:text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 md:p-4 rounded-xl md:rounded-2xl min-h-[72px] md:min-h-[80px] whitespace-pre-wrap">
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
