'use client';

import React, { useState } from 'react';
import { Wifi, Search, User, Mail, Calendar, MoreHorizontal, X, Phone, Shield, Clock } from 'lucide-react';

export default function UsersTab({ users, onlineUsers, deleteItem }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null); // ✅ 상세 보기용 상태

  // 검색 필터링
  const filteredUsers = users.filter((u: any) => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 h-full flex overflow-hidden relative">
      
      {/* 🟢 메인 콘텐츠 (리스트 영역) */}
      <div className={`flex-1 flex flex-col space-y-6 overflow-y-auto p-1 animate-in fade-in zoom-in-95 duration-300 ${selectedUser ? 'w-2/3 pr-4' : 'w-full'}`}>
        
        {/* 1. 실시간 접속자 섹션 */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm shrink-0">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Wifi size={20} className="text-green-500 animate-pulse"/> 실시간 접속 유저 ({onlineUsers.length}명)
          </h3>
          {onlineUsers.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
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
            <div className="text-sm text-slate-400 py-2">현재 접속 중인 유저가 없습니다.</div>
          )}
        </section>

        {/* 2. 전체 유저 목록 섹션 */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-0">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-lg">전체 회원 ({users.length})</h3>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
              <input 
                type="text" 
                placeholder="이름/이메일 검색" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors"
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3">유저 정보</th>
                  <th className="px-6 py-3">연락처</th>
                  <th className="px-6 py-3">구분</th>
                  <th className="px-6 py-3 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUsers.map((user: any) => (
                  <tr 
                    key={user.id} 
                    onClick={() => setSelectedUser(user)} // ✅ 클릭 시 상세 보기 열기
                    className={`cursor-pointer transition-colors ${selectedUser?.id === user.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 overflow-hidden border border-slate-100">
                        {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover"/> : <User size={16}/>}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{user.name || '이름 없음'}</div>
                        <div className="text-xs text-slate-400">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {user.phone || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${user.role === 'host' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-600'}`}>
                        {user.role || 'USER'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteItem('profiles', user.id); }} 
                        className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <MoreHorizontal size={16}/>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-slate-400">검색 결과가 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* 🟢 [신규] 유저 상세 정보 패널 (우측 슬라이드) */}
      {selectedUser && (
        <div className="w-[400px] border-l border-slate-200 bg-white h-full shadow-xl flex flex-col animate-in slide-in-from-right duration-300 absolute right-0 top-0 z-20">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-lg">상세 프로필</h3>
            <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-900 p-1 rounded-full hover:bg-slate-200 transition-colors">
              <X size={20}/>
            </button>
          </div>

          <div className="p-8 flex flex-col items-center border-b border-slate-100">
            <div className="w-24 h-24 rounded-full bg-slate-100 mb-4 overflow-hidden border-4 border-white shadow-lg">
              {selectedUser.avatar_url ? <img src={selectedUser.avatar_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={40}/></div>}
            </div>
            <h2 className="text-xl font-bold text-slate-900">{selectedUser.name || '이름 없음'}</h2>
            <p className="text-sm text-slate-500 mb-4">{selectedUser.email}</p>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${selectedUser.role === 'host' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-600'}`}>
              {selectedUser.role === 'host' ? 'HOST (호스트)' : 'GENERAL USER (일반)'}
            </span>
          </div>

          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Contact Info</h4>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 text-slate-700">
                  <Mail size={16} className="text-slate-400"/> {selectedUser.email}
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <Phone size={16} className="text-slate-400"/> {selectedUser.phone || '전화번호 미등록'}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Account Info</h4>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 text-slate-700">
                  <Calendar size={16} className="text-slate-400"/> 가입일: {new Date(selectedUser.created_at).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <Shield size={16} className="text-slate-400"/> 계정 상태: <span className="text-green-600 font-bold">정상</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <Clock size={16} className="text-slate-400"/> 최근 접속: {new Date().toLocaleDateString()} (추정)
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-slate-100 bg-slate-50">
            <button 
              onClick={() => { if(confirm('정말 강제 탈퇴 처리하시겠습니까?')) deleteItem('profiles', selectedUser.id); }}
              className="w-full bg-white border border-red-200 text-red-500 font-bold py-3 rounded-xl hover:bg-red-50 transition-colors shadow-sm"
            >
              회원 강제 탈퇴
            </button>
          </div>
        </div>
      )}
    </div>
  );
}