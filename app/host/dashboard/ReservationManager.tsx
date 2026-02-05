'use client';

import React, { useState } from 'react';
import { 
  Calendar, Clock, User, CheckCircle2, XCircle, MessageSquare, MoreHorizontal, AlertCircle 
} from 'lucide-react';

export default function ReservationManager() {
  const [activeTab, setActiveTab] = useState<'pending' | 'upcoming' | 'completed'>('pending');

  // 더미 데이터 (실제 DB 연결 시 교체)
  const reservations = [
    {
      id: 1,
      guestName: "홍길동",
      guestAvatar: null,
      experienceTitle: "서울의 숨겨진 골목 투어",
      date: "2026. 10. 25 (토)",
      time: "14:00 - 17:00",
      guests: 2,
      price: 50000,
      status: 'pending', // pending, confirmed, completed, cancelled
      message: "혹시 주차 가능한가요? 아이랑 같이 갑니다."
    },
    {
      id: 2,
      guestName: "Sarah Kim",
      guestAvatar: "https://i.pravatar.cc/150?u=sarah",
      experienceTitle: "K-Food 쿠킹 클래스",
      date: "2026. 10. 26 (일)",
      time: "10:00 - 13:00",
      guests: 1,
      price: 80000,
      status: 'confirmed',
      dDay: 'D-1'
    }
  ];

  const filteredList = reservations.filter(r => 
    activeTab === 'pending' ? r.status === 'pending' : 
    activeTab === 'upcoming' ? r.status === 'confirmed' : 
    r.status === 'completed'
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      {/* 헤더 & 탭 */}
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          📅 예약 관리
          {reservations.filter(r => r.status === 'pending').length > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">
              NEW
            </span>
          )}
        </h3>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'pending', label: '승인 대기' },
            { id: 'upcoming', label: '다가오는 일정' },
            { id: 'completed', label: '완료됨' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === tab.id 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 리스트 영역 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {filteredList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Calendar size={48} className="mb-3 opacity-20"/>
            <p className="text-sm">해당하는 예약 내역이 없습니다.</p>
          </div>
        ) : (
          filteredList.map(res => (
            <div key={res.id} className="border border-slate-100 rounded-xl p-5 hover:border-slate-300 transition-colors bg-white group">
              
              {/* 상단: 게스트 정보 & 상태 */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                    {res.guestAvatar ? <img src={res.guestAvatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={18}/></div>}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{res.guestName}</span>
                      {res.status === 'confirmed' && <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">{res.dDay}</span>}
                    </div>
                    <span className="text-xs text-slate-500">{res.guests}명 · ₩{res.price.toLocaleString()}</span>
                  </div>
                </div>
                
                {/* 퀵 액션 메뉴 */}
                <button className="text-slate-300 hover:text-slate-600"><MoreHorizontal size={18}/></button>
              </div>

              {/* 중간: 체험 정보 */}
              <div className="bg-slate-50 p-4 rounded-lg mb-4">
                <div className="font-bold text-sm text-slate-800 mb-1">{res.experienceTitle}</div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Calendar size={12}/> {res.date}</span>
                  <span className="flex items-center gap-1"><Clock size={12}/> {res.time}</span>
                </div>
                {res.message && (
                  <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600 flex gap-2">
                    <MessageSquare size={12} className="mt-0.5 shrink-0"/> "{res.message}"
                  </div>
                )}
              </div>

              {/* 하단: 액션 버튼 (상태별 분기) */}
              <div className="flex gap-2">
                {res.status === 'pending' ? (
                  <>
                    <button className="flex-1 bg-black text-white py-3 rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                      <CheckCircle2 size={16}/> 예약 승인
                    </button>
                    <button className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-lg text-sm font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors flex items-center justify-center gap-2">
                      <XCircle size={16}/> 거절
                    </button>
                  </>
                ) : (
                  <button className="w-full bg-white border border-slate-200 text-slate-700 py-3 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                    <MessageSquare size={16}/> 게스트에게 메시지 보내기
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}