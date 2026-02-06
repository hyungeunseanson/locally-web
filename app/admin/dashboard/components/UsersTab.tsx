'use client';

import React, { useState } from 'react';
import { Wifi, Search, User, Mail, Calendar, MoreHorizontal } from 'lucide-react';

export default function UsersTab({ users, onlineUsers, deleteItem }: any) {
  const [searchTerm, setSearchTerm] = useState('');

  // 검색 필터링
  const filteredUsers = users.filter((u: any) => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 space-y-6 overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
      
      {/* 1. 실시간 접속자 섹션 (상단 배치) */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Wifi size={20} className="text-green-500 animate-pulse"/> 실시간 접속 유저 ({onlineUsers.length}명)
        </h3>
        {onlineUsers.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {onlineUsers.map((u: any, idx: number) => (
              <div key={idx} className="flex-shrink-0 w-48 p-4 bg-slate-50 border border-green-100 rounded-xl flex items-center gap-3 relative overflow-hidden">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${u.is_anonymous ? 'bg-slate-300' : 'bg-blue-500'}`}>
                  {u.email ? u.email[0].toUpperCase() : 'G'}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate text-slate-900">{u.email || '비회원'}</div>
                  <div className="text-[10px] text-green-600 font-medium">지금 활동 중</div>
                </div>
                <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-400 py-4">현재 접속 중인 유저가 없습니다.</div>
        )}
      </section>

      {/* 2. 전체 유저 목록 섹션 */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-lg">전체 회원 목록 ({users.length}명)</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
            <input 
              type="text" 
              placeholder="이름 또는 이메일 검색" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3">유저 정보</th>
                <th className="px-6 py-3">역할</th>
                <th className="px-6 py-3">가입일</th>
                <th className="px-6 py-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user: any) => (
                <tr key={user.id} className="hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500"><User size={14}/></div>
                    <div>
                      <div className="font-bold text-slate-900">{user.name || '이름 없음'}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${user.role === 'host' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-600'}`}>
                      {user.role === 'host' ? 'Host' : 'User'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    <div className="flex items-center gap-1"><Calendar size={12}/> {new Date(user.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => deleteItem('profiles', user.id)} className="text-slate-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg">
                      <MoreHorizontal size={16}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}