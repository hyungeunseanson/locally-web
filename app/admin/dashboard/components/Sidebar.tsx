'use client';

import React from 'react';
import { Users, MapPin, CheckCircle2, MessageSquare, DollarSign, Wifi, Calendar, BarChart2, CreditCard } from 'lucide-react';
import { NavButton } from './SharedComponents';

export default function Sidebar({ activeTab, setActiveTab, appsCount, expsCount, onlineUsersCount }: any) {
  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col p-4 shadow-xl z-10 overflow-y-auto">
      <div className="mb-6 px-2">
        <h2 className="text-xs font-bold text-slate-500 uppercase mb-2">Management</h2>
        <nav className="space-y-1">
          <NavButton active={activeTab==='APPS'} onClick={()=>setActiveTab('APPS')} icon={<Users size={18}/>} label="호스트 지원서" count={appsCount} />
          <NavButton active={activeTab==='EXPS'} onClick={()=>setActiveTab('EXPS')} icon={<MapPin size={18}/>} label="체험 관리" count={expsCount} />
          {/* ✅ 유저 관리에 실시간 접속자 수 배지 표시 */}
          <NavButton 
            active={activeTab==='USERS'} 
            onClick={()=>setActiveTab('USERS')} 
            icon={<CheckCircle2 size={18}/>} 
            label="유저 통합 관리" 
            count={onlineUsersCount > 0 ? `${onlineUsersCount}명 접속중` : undefined} 
          />
        </nav>
      </div>
      
      <div className="mb-6 px-2">
        <h2 className="text-xs font-bold text-slate-500 uppercase mb-2">Operation</h2>
        <nav className="space-y-1">
          {/* ✅ 예약 통합 탭 */}
          <NavButton active={activeTab==='BOOKINGS'} onClick={()=>setActiveTab('BOOKINGS')} icon={<Calendar size={18}/>} label="예약 현황" />
          <NavButton active={activeTab==='CHATS'} onClick={()=>setActiveTab('CHATS')} icon={<MessageSquare size={18}/>} label="메시지 모니터링" />
        </nav>
      </div>

      <div className="mb-6 px-2">
        <h2 className="text-xs font-bold text-slate-500 uppercase mb-2">Finance & Stats</h2>
        <nav className="space-y-1">
          <NavButton active={activeTab==='SALES'} onClick={()=>setActiveTab('SALES')} icon={<CreditCard size={18}/>} label="매출 및 정산" />
          <NavButton active={activeTab==='ANALYTICS'} onClick={()=>setActiveTab('ANALYTICS')} icon={<BarChart2 size={18}/>} label="통계 및 분석" />
        </nav>
      </div>
    </aside>
  );
}