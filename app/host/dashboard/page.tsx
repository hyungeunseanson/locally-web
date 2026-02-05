'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { 
  Plus, Calendar, Clock, ChevronRight, Star, 
  Wallet, TrendingUp, AlertCircle, MessageSquare, UserCog, LayoutDashboard 
} from 'lucide-react';

// ✅ 새로 만든 컴포넌트 임포트
import ReservationManager from './components/ReservationManager'; 
import ProfileEditor from './components/ProfileEditor'; 

export default function HostDashboard() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profile'>('dashboard');
  const [hostStatus, setHostStatus] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [experiences, setExperiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    // 1. 호스트 상태
    const { data: hostData } = await supabase
      .from('host_applications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    setHostStatus(hostData);

    // 2. 프로필 정보 (재미있는 사실 등)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    setProfile(profileData);

    // 3. 체험 목록
    if (hostData?.status === 'approved' || hostData?.status === 'active') {
      const { data: exps } = await supabase
        .from('experiences')
        .select('*')
        .eq('host_id', user.id)
        .order('created_at', { ascending: false });
      if (exps) setExperiences(exps);
    }
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-black"></div></div>;

  // ... (신청 전/심사 중 화면은 기존 코드 유지) ...
  // (생략: 위에서 드린 코드와 동일)

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      <SiteHeader />
      
      {/* 2차 네비게이션 (대시보드 / 프로필 설정) */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-6">
        <div className="max-w-7xl mx-auto flex gap-8">
           <button 
             onClick={() => setActiveTab('dashboard')}
             className={`py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'dashboard' ? 'border-black text-black' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
           >
             <LayoutDashboard size={18}/> 대시보드
           </button>
           <button 
             onClick={() => setActiveTab('profile')}
             className={`py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'profile' ? 'border-black text-black' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
           >
             <UserCog size={18}/> 프로필 설정
           </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-10">
        
        {/* 1. 대시보드 탭 */}
        {activeTab === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="flex justify-between items-center mb-10">
                <h1 className="text-3xl font-bold tracking-tight">오늘의 할 일</h1>
                <Link href="/host/create" className="flex items-center gap-2 bg-black text-white px-5 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-sm active:scale-95">
                  <Plus size={18}/> 체험 등록하기
                </Link>
             </div>
             
             <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className="flex-1 w-full space-y-8">
                   <div className="h-[500px]">
                      <ReservationManager />
                   </div>
                   {/* 체험 목록 */}
                   <div>
                      <h2 className="text-xl font-bold mb-4">운영 중인 체험</h2>
                      <div className="space-y-4">
                        {experiences.map((exp:any) => (
                           <ExperienceListCard key={exp.id} exp={exp}/>
                        ))}
                      </div>
                   </div>
                </div>
                
                <div className="w-full lg:w-80 space-y-6">
                   <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><TrendingUp size={20}/> 성과</h3>
                      <div className="text-3xl font-black mb-1">₩1,250,000</div>
                      <div className="text-xs text-slate-500">이번 달 예상 수입</div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* 2. 프로필 설정 탭 */}
        {activeTab === 'profile' && (
           <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">호스트 프로필</h1>
                <p className="text-slate-500">게스트에게 보여질 나의 정보를 매력적으로 꾸며보세요.</p>
              </div>
              <ProfileEditor profile={profile} onUpdate={fetchData} />
           </div>
        )}

      </main>
    </div>
  );
}

function ExperienceListCard({ exp }: any) {
  return (
    <div className="flex gap-4 p-4 border border-slate-200 rounded-2xl hover:shadow-md transition-shadow cursor-pointer bg-white group">
      <div className="w-24 h-24 rounded-xl bg-slate-200 overflow-hidden shrink-0 relative">
        {exp.photos?.[0] && <img src={exp.photos[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform"/>}
        <div className="absolute top-1 left-1 bg-white/90 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase backdrop-blur-sm">
          {exp.status}
        </div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h4 className="font-bold text-base text-slate-900 truncate mb-1">{exp.title}</h4>
        <div className="text-sm text-slate-500 mb-3 flex items-center gap-2">
          <span>{exp.city}</span> · <span>₩{exp.price?.toLocaleString()}</span>
        </div>
      </div>
      <div className="flex items-center justify-center px-2 text-slate-300 group-hover:text-black transition-colors">
        <ChevronRight size={20}/>
      </div>
    </div>
  );
}