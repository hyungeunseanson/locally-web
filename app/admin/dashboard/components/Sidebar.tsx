'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { 
  Users, 
  MapPin, 
  CheckCircle2, 
  MessageSquare, 
  DollarSign, 
  Calendar, 
  BarChart2, 
  CreditCard 
} from 'lucide-react';
import { NavButton } from './SharedComponents'; // 기존 컴포넌트 재사용

export default function Sidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // 1. 현재 URL의 '?tab=' 값을 읽어서 활성 탭 결정 (없으면 기본값 APPS)
  const activeTab = searchParams.get('tab')?.toUpperCase() || 'APPS';

  // 2. 알림 숫자 상태 관리 (기존 props 대신 스스로 관리)
  const [counts, setCounts] = useState({
    apps: 0,
    exps: 0,
    online: 0,
  });

  // 3. 데이터 실시간 조회 (알림 배지 부활)
  useEffect(() => {
    const fetchCounts = async () => {
      // 호스트 지원서 대기 건수
      const { count: appsCount } = await supabase
        .from('host_applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // 체험 승인 대기 건수
      const { count: expsCount } = await supabase
        .from('experiences')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      setCounts(prev => ({
        ...prev,
        apps: appsCount || 0,
        exps: expsCount || 0,
      }));
    };

    fetchCounts();

    // 온라인 유저 수 (Presence)
    const channel = supabase.channel('online_users_sidebar')
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        // 중복 제거 후 카운트
        const uniqueUsers = new Set(
          Object.values(state).flat().map((u: any) => u.user_id)
        );
        setCounts(prev => ({ ...prev, online: uniqueUsers.size }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 4. 탭 변경 함수 (URL 이동)
  const handleTabChange = (tab: string) => {
    router.push(`/admin/dashboard?tab=${tab}`);
  };

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col p-4 shadow-xl z-10 overflow-y-auto h-screen sticky top-0">
      {/* 로고 영역 (선택사항 - 필요 없으면 삭제) */}
      <div className="mb-8 px-2 mt-2">
        <h1 className="text-xl font-bold text-white tracking-wider">LOCALLY <span className="text-rose-500">ADMIN</span></h1>
      </div>

      <div className="mb-6 px-2">
        <h2 className="text-xs font-bold text-slate-500 uppercase mb-2">Management</h2>
        <nav className="space-y-1">
          <NavButton 
            active={activeTab === 'APPS'} 
            onClick={() => handleTabChange('APPS')} 
            icon={<Users size={18}/>} 
            label="호스트 지원서" 
            count={counts.apps} 
          />
          <NavButton 
            active={activeTab === 'EXPS'} 
            onClick={() => handleTabChange('EXPS')} 
            icon={<MapPin size={18}/>} 
            label="체험 관리" 
            count={counts.exps} 
          />
          <NavButton 
            active={activeTab === 'USERS'} 
            onClick={() => handleTabChange('USERS')} 
            icon={<CheckCircle2 size={18}/>} 
            label="유저 통합 관리" 
            count={counts.online > 0 ? `${counts.online}명 접속중` : undefined} 
          />
        </nav>
      </div>
      
      <div className="mb-6 px-2">
        <h2 className="text-xs font-bold text-slate-500 uppercase mb-2">Operation</h2>
        <nav className="space-y-1">
          <NavButton 
            active={activeTab === 'BOOKINGS'} 
            onClick={() => handleTabChange('BOOKINGS')} 
            icon={<Calendar size={18}/>} 
            label="예약 현황" 
          />
          <NavButton 
            active={activeTab === 'CHATS'} 
            onClick={() => handleTabChange('CHATS')} 
            icon={<MessageSquare size={18}/>} 
            label="메시지 모니터링" 
          />
        </nav>
      </div>

      <div className="mb-6 px-2">
        <h2 className="text-xs font-bold text-slate-500 uppercase mb-2">Finance & Stats</h2>
        <nav className="space-y-1">
          <NavButton 
            active={activeTab === 'SALES'} 
            onClick={() => handleTabChange('SALES')} 
            icon={<CreditCard size={18}/>} 
            label="매출 및 정산" 
          />
          <NavButton 
            active={activeTab === 'ANALYTICS'} 
            onClick={() => handleTabChange('ANALYTICS')} 
            icon={<BarChart2 size={18}/>} 
            label="통계 및 분석" 
          />
        </nav>
      </div>
    </aside>
  );
}