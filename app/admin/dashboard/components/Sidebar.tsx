'use client';

import React from 'react';
import { Users, MapPin, CheckCircle2, MessageSquare, DollarSign, Wifi } from 'lucide-react';
import { NavButton } from './SharedComponents';

export default function Sidebar({ activeTab, setActiveTab, appsCount, expsCount, onlineUsersCount }: any) {
  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col p-4 shadow-xl z-10">
      <div className="mb-6 px-2">
        <h2 className="text-xs font-bold text-slate-500 uppercase mb-2">Management</h2>
        <nav className="space-y-1">
          <NavButton active={activeTab==='APPS'} onClick={()=>setActiveTab('APPS')} icon={<Users size={18}/>} label="호스트 지원서" count={appsCount} />
          <NavButton active={activeTab==='EXPS'} onClick={()=>setActiveTab('EXPS')} icon={<MapPin size={18}/>} label="체험 관리" count={expsCount} />
          <NavButton active={activeTab==='USERS'} onClick={()=>setActiveTab('USERS')} icon={<CheckCircle2 size={18}/>} label="고객(유저) 관리" />
        </nav>
      </div>
      <div className="mb-6 px-2">
        <h2 className="text-xs font-bold text-slate-500 uppercase mb-2">Monitoring</h2>
        <nav className="space-y-1">
          <NavButton 
            active={activeTab==='REALTIME'} 
            onClick={()=>setActiveTab('REALTIME')} 
            icon={<Wifi size={18} className={onlineUsersCount > 0 ? "text-green-400 animate-pulse" : ""}/>} 
            label="실시간 접속자" 
            count={onlineUsersCount} 
          />
          <NavButton active={activeTab==='CHATS'} onClick={()=>setActiveTab('CHATS')} icon={<MessageSquare size={18}/>} label="메시지 모니터링" />
          <NavButton active={activeTab==='FINANCE'} onClick={()=>setActiveTab('FINANCE')} icon={<DollarSign size={18}/>} label="매출 및 통계" />
        </nav>
      </div>
    </aside>
  );
}