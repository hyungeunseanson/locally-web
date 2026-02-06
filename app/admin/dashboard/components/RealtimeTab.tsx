'use client';

import React from 'react';
import { Wifi } from 'lucide-react';

export default function RealtimeTab({ onlineUsers }: { onlineUsers: any[] }) {
  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-8 overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Wifi size={32} className="text-green-500"/> 실시간 접속 현황
          </h2>
          <p className="text-slate-500 mt-2">현재 사이트를 이용 중인 유저들을 실시간으로 모니터링합니다.</p>
        </div>
        <div className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-lg shadow-lg flex items-center gap-3">
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          Total: <span className="text-green-400">{onlineUsers.length}</span>명
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {onlineUsers.map((u: any, idx) => (
          <div key={idx} className="p-5 border border-slate-200 rounded-2xl bg-white hover:shadow-lg transition-all hover:border-black group relative overflow-hidden">
            <div className="flex items-start gap-4">
              <div className="relative">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm ${u.is_anonymous ? 'bg-slate-300' : 'bg-gradient-to-br from-blue-500 to-purple-600'}`}>
                  {u.email ? u.email[0].toUpperCase() : 'G'}
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 truncate mb-1">{u.email || '비회원 (Guest)'}</div>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${u.is_anonymous ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-600'}`}>
                  {u.is_anonymous ? 'Guest' : 'Member'}
                </span>
                <div className="text-xs text-slate-400 mt-2 font-mono">
                  {new Date(u.connected_at).toLocaleTimeString()} 입장
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {onlineUsers.length === 0 && (
          <div className="col-span-full py-32 text-center text-slate-300 flex flex-col items-center">
            <Wifi size={64} className="mb-4 opacity-20"/>
            <p className="text-lg">현재 접속 중인 유저가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}