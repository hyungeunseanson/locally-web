'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { 
  Users, MapPin, CheckCircle2, MessageSquare, 
  Calendar, BarChart2, CreditCard, LayoutDashboard
} from 'lucide-react';

// NavButton 컴포넌트 내부 정의 (별도 파일 의존성 제거)
const NavButton = ({ active, onClick, icon, label, count }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${
      active 
        ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    <div className="flex items-center gap-3">
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </div>
    {count !== undefined && count !== 0 && (
      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
        active ? 'bg-white/20 text-white' : 'bg-rose-500 text-white'
      }`}>
        {count}
      </span>
    )}
  </button>
);

export default function Sidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const activeTab = searchParams.get('tab')?.toUpperCase() || 'APPS';

  const [counts, setCounts] = useState({
    apps: 0,
    exps: 0,
    online: 0,
    pendingBookings: 0, // 🟢 추가
  });

  useEffect(() => {
    const fetchCounts = async () => {
      // 호스트 지원서 대기 (pending)
      const { count: appsCount } = await supabase
        .from('host_applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

// 체험 승인 대기
const { count: expsCount } = await supabase
.from('experiences')
.select('*', { count: 'exact', head: true })
.eq('status', 'pending');

// 🟢 [추가] 입금 대기 예약 (PENDING)
const { count: bookingCount } = await supabase
.from('bookings')
.select('*', { count: 'exact', head: true })
.eq('status', 'PENDING');

setCounts(prev => ({
...prev,
apps: appsCount || 0,
exps: expsCount || 0,
pendingBookings: bookingCount || 0, // 🟢 추가
}));
    };

    fetchCounts();

    // 실시간 접속자 수 체크
    const channel = supabase.channel('online_users_sidebar')
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
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

  const handleTabChange = (tab: string) => {
    router.push(`/admin/dashboard?tab=${tab}`);
  };

  return (
    <aside className="w-64 bg-[#111827] text-white flex flex-col p-4 shadow-xl h-screen sticky top-0 border-r border-slate-800">
      {/* 로고 */}
      <div className="mb-10 px-2 mt-4 flex items-center gap-2">
        <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center">
          <LayoutDashboard size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight leading-none">LOCALLY</h1>
          <p className="text-[10px] text-slate-500 font-medium tracking-widest">ADMIN CONSOLE</p>
        </div>
      </div>

      <div className="space-y-8 flex-1 overflow-y-auto scrollbar-hide">
        <div>
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 px-2">Management</h2>
          <div className="space-y-1">
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
              label="체험 승인 관리" 
              count={counts.exps} 
            />
            <NavButton 
              active={activeTab === 'USERS'} 
              onClick={() => handleTabChange('USERS')} 
              icon={<CheckCircle2 size={18}/>} 
              label="회원 관리" 
              count={counts.online > 0 ? `${counts.online} 접속` : undefined} 
            />
          </div>
        </div>
        
        <div>
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 px-2">Operation</h2>
          <div className="space-y-1">
          <NavButton 
              active={activeTab === 'BOOKINGS'} 
              onClick={() => handleTabChange('BOOKINGS')} 
              icon={<Calendar size={18}/>} 
              label="예약 현황" 
              count={counts.pendingBookings} // 🟢 뱃지 표시
            />
            <NavButton 
              active={activeTab === 'CHATS'} 
              onClick={() => handleTabChange('CHATS')} 
              icon={<MessageSquare size={18}/>} 
              label="메시지 모니터링" 
            />
          </div>
        </div>

        <div>
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 px-2">Finance</h2>
          <div className="space-y-1">
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
              label="데이터 통계" 
            />
          </div>
        </div>
      </div>
      
      {/* 하단 프로필 (선택사항) */}
      <div className="mt-auto pt-6 border-t border-slate-800 px-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">AD</div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">Master Admin</p>
            <p className="text-xs text-slate-500 truncate">admin@locally.com</p>
          </div>
        </div>
      </div>
    </aside>
  );
}