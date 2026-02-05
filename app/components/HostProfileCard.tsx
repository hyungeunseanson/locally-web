'use client';

import React from 'react';
import Link from 'next/link';
import { User, Briefcase, Globe, Music, MessageCircle } from 'lucide-react';

interface HostProfileProps {
  hostId: string;
  name: string;
  avatarUrl?: string;
  job?: string;
  dreamDestination?: string;
  favoriteSong?: string;
  languages?: string[];
  intro?: string;
}

export default function HostProfileCard({
  hostId,
  name,
  avatarUrl,
  job,
  dreamDestination,
  favoriteSong,
  languages = [],
  intro
}: HostProfileProps) {
  return (
    <div className="py-12 border-t border-slate-200">
      <h3 className="text-2xl font-bold mb-8">호스트 {name}님 소개</h3>
      
      <div className="flex flex-col md:flex-row gap-8">
        {/* 왼쪽: 프로필 사진 및 기본 정보 */}
        <div className="md:w-1/3">
          <div className="bg-white rounded-3xl p-6 shadow-[0_6px_16px_rgba(0,0,0,0.12)] border border-slate-100 text-center">
            <div className="w-32 h-32 rounded-full overflow-hidden mx-auto mb-4 bg-slate-100">
              {avatarUrl ? (
                <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <User size={64} />
                </div>
              )}
            </div>
            <h2 className="text-2xl font-bold mb-1">{name}</h2>
            <p className="text-sm text-slate-500 mb-4">슈퍼호스트</p>
            
            <Link href={`/users/${hostId}`}>
              <button className="w-full py-3 rounded-xl border border-black font-bold hover:bg-slate-50 transition-colors">
                프로필 보기
              </button>
            </Link>
          </div>
        </div>

        {/* 오른쪽: 상세 정보 (첨부해주신 이미지 스타일) */}
        <div className="md:w-2/3 space-y-6">
          
          {/* 재미있는 사실들 (Grid 레이아웃) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {job && (
              <div className="flex items-start gap-3">
                <Briefcase className="text-slate-900 mt-1" size={20} />
                <div>
                  <p className="text-sm font-bold text-slate-900">직업/직장</p>
                  <p className="text-sm text-slate-600">{job}</p>
                </div>
              </div>
            )}
            
            {dreamDestination && (
              <div className="flex items-start gap-3">
                <Globe className="text-slate-900 mt-1" size={20} />
                <div>
                  <p className="text-sm font-bold text-slate-900">꼭 여행해 보고 싶은 장소</p>
                  <p className="text-sm text-slate-600">{dreamDestination}</p>
                </div>
              </div>
            )}

            {favoriteSong && (
              <div className="flex items-start gap-3">
                <Music className="text-slate-900 mt-1" size={20} />
                <div>
                  <p className="text-sm font-bold text-slate-900">학창시절 최애 노래</p>
                  <p className="text-sm text-slate-600">{favoriteSong}</p>
                </div>
              </div>
            )}

            {languages && languages.length > 0 && (
              <div className="flex items-start gap-3">
                <MessageCircle className="text-slate-900 mt-1" size={20} />
                <div>
                  <p className="text-sm font-bold text-slate-900">구사 언어</p>
                  <p className="text-sm text-slate-600">{languages.join(', ')}</p>
                </div>
              </div>
            )}
          </div>

          {/* 호스트 소개글 */}
          <div className="pt-6">
            <p className="text-slate-700 leading-relaxed text-sm md:text-base">
              {intro || `안녕하세요! 저는 ${name}입니다. 여행과 만남을 사랑하는 호스트예요. 저와 함께 특별한 추억을 만들어보세요!`}
            </p>
          </div>
          
          {/* 더 보기 버튼 */}
          <Link href={`/users/${hostId}`} className="inline-block font-bold underline decoration-1 underline-offset-4 hover:text-slate-600">
            더 읽어보기
          </Link>
        </div>
      </div>
    </div>
  );
}