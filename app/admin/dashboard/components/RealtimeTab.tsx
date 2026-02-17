'use client';

import React from 'react';
import { Wifi, Smartphone, Monitor, Globe } from 'lucide-react';

export default function RealtimeTab({ onlineUsers }: { onlineUsers: any[] }) {
  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-8 overflow-y-auto animate-in fade-in zoom-in-95 duration-300 h-full">
      {/* 헤더 섹션 */}
      <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-75"></div>
              <Wifi size={28} className="text-green-600 relative z-10"/>
            </div>
            실시간 접속 리포트
          </h2>
          <p className="text-slate-500 text-sm mt-1 ml-10">현재 우리 서비스에 접속해 있는 유저들의 활동을 모니터링합니다.</p>
        </div>
        <div className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-base shadow-lg flex items-center gap-3">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
          Live Users: <span className="text-green-400 font-mono text-xl">{onlineUsers.length}</span>
        </div>
      </div>

      {/* 유저 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {onlineUsers.map((u: any, idx) => (
          <div key={idx} className="p-5 border border-slate-200 rounded-2xl bg-white hover:shadow-lg hover:-translate-y-1 transition-all group relative overflow-hidden">
            {/* 배경 데코레이션 */}
            <div className="absolute top-0 right-0 w-20 h-20 bg-slate-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>

            <div className="flex items-start gap-4 relative z-10">
              <div className="relative shrink-0">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-inner ${u.is_anonymous ? 'bg-slate-300' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
                  {u.email ? u.email[0].toUpperCase() : 'G'}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full animate-bounce"></div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${u.is_anonymous ? 'bg-slate-100 text-slate-500' : 'bg-indigo-50 text-indigo-600'}`}>
                    {u.is_anonymous ? 'Guest' : 'Member'}
                  </span>
                  {/* 디바이스 아이콘 (추후 데이터 연동 시 조건부 렌더링) */}
                  <Monitor size={12} className="text-slate-300"/> 
                </div>
                
                <div className="font-bold text-slate-900 truncate text-sm" title={u.email}>
                  {u.email || '익명 방문자'}
                </div>
                
                <div className="text-xs text-slate-400 mt-1.5 flex items-center gap-1 font-mono">
                  <Globe size={10}/> 
                  <span className="truncate">{u.current_page || '/ (메인)'}</span>
                </div>
                
                <div className="text-[10px] text-slate-300 mt-2 text-right">
                  {new Date(u.connected_at).toLocaleTimeString()} 접속
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {onlineUsers.length === 0 && (
          <div className="col-span-full py-40 text-center flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Wifi size={40} className="text-slate-300"/>
            </div>
            <h3 className="text-lg font-bold text-slate-400">현재 접속 중인 유저가 없습니다.</h3>
            <p className="text-sm text-slate-400 mt-2">홍보를 통해 더 많은 유저를 모아보세요!</p>
          </div>
        )}
      </div>
    </div>
  );
}