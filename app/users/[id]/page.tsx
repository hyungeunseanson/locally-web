'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { User, CheckCircle2, Star } from 'lucide-react';
import ExperienceCard from '@/app/components/ExperienceCard';

export default function UserProfilePage({ params }: { params: { id: string } }) {
  const [profile, setProfile] = useState<any>(null);
  const [hostExperiences, setHostExperiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchProfile = async () => {
      // 1. 프로필 정보 가져오기
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', params.id)
        .maybeSingle();
      
      setProfile(profileData);

      // 2. 호스트가 운영 중인 체험 가져오기
      const { data: expData } = await supabase
        .from('experiences')
        .select('*')
        .eq('host_id', params.id)
        .eq('status', 'active');
        
      if (expData) setHostExperiences(expData);
      setLoading(false);
    };

    fetchProfile();
  }, [params.id]);

  if (loading) return <div className="min-h-screen bg-white" />;

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <SiteHeader />
      
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row gap-12">
          
          {/* 왼쪽: 프로필 카드 (고정) */}
          <div className="md:w-1/3">
            <div className="border border-slate-200 rounded-3xl p-8 shadow-lg sticky top-24">
              <div className="flex flex-col items-center text-center">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-slate-100 mb-6">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300"><User size={64}/></div>
                  )}
                </div>
                <h1 className="text-3xl font-black mb-2">{profile?.full_name || '이름 없음'}</h1>
                <div className="flex items-center gap-1 text-sm font-bold mb-6">
                  <CheckCircle2 size={16} className="text-black"/> 본인 인증 완료
                </div>
                
                <div className="w-full border-t border-slate-100 py-6 text-left space-y-4">
                  <h3 className="font-bold text-lg">{profile?.full_name} 님 확인 정보</h3>
                  <div className="flex items-center gap-2 text-slate-600">
                    <CheckCircle2 size={18}/> <span>신분증</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <CheckCircle2 size={18}/> <span>이메일 주소</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <CheckCircle2 size={18}/> <span>전화번호</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 오른쪽: 상세 소개 및 체험 목록 */}
          <div className="md:w-2/3 space-y-12">
            
            {/* 소개글 */}
            <section>
              <h2 className="text-2xl font-bold mb-6">호스트 소개</h2>
              <div className="prose prose-slate max-w-none">
                <p className="text-lg leading-relaxed text-slate-700">
                  {profile?.introduction || "아직 자기소개가 없습니다."}
                </p>
                {/* 여기에 아까 만든 HostProfileCard의 상세 정보(직업, 취미 등)를 다시 보여줄 수도 있습니다. */}
              </div>
            </section>

            {/* 운영 중인 체험 */}
            {hostExperiences.length > 0 && (
              <section className="pt-12 border-t border-slate-100">
                <h2 className="text-2xl font-bold mb-6">{profile?.full_name}님의 체험</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {hostExperiences.map(exp => (
                    <ExperienceCard key={exp.id} data={exp} />
                  ))}
                </div>
              </section>
            )}

            {/* 후기 (추후 구현) */}
            <section className="pt-12 border-t border-slate-100">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Star className="fill-black" size={24}/> 후기
              </h2>
              <div className="p-8 bg-slate-50 rounded-2xl text-center text-slate-500">
                아직 작성된 후기가 없습니다.
              </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}