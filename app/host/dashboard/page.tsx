'use client';

import React, { useState } from 'react';
import { 
  LayoutDashboard, Calendar, List, MessageSquare, BarChart3, 
  Bell, Plus, AlertCircle, Clock, Star, SlidersHorizontal 
} from 'lucide-react';
import Link from 'next/link';

export default function HostDashboardPage() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* 1. Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 fixed h-full z-10 hidden md:flex flex-col">
        <div className="p-6 h-20 flex items-center border-b border-slate-100">
          <Link href="/">
             <h1 className="text-xl font-black tracking-tight cursor-pointer hover:text-slate-600">Locally Host</h1>
          </Link>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <NavItem active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<LayoutDashboard size={20}/>} label="홈" />
          <NavItem active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} icon={<Calendar size={20}/>} label="달력" />
          <NavItem active={activeTab === 'listings'} onClick={() => setActiveTab('listings')} icon={<List size={20}/>} label="내 체험 관리" />
          <NavItem active={activeTab === 'inbox'} onClick={() => setActiveTab('inbox')} icon={<MessageSquare size={20}/>} label="메시지함" badge={2} />
          <NavItem active={activeTab === 'insights'} onClick={() => setActiveTab('insights')} icon={<BarChart3 size={20}/>} label="정산 및 통계" />
        </nav>

        <div className="p-4 border-t border-slate-100">
           {/* 등록 마법사 연결 */}
           <Link href="/host/create">
             <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg cursor-pointer hover:bg-slate-800 transition-colors flex items-center justify-between group">
                <span className="text-sm font-bold">새 체험 등록하기</span>
                <Plus size={18} className="group-hover:scale-110 transition-transform"/>
             </div>
           </Link>
        </div>
      </aside>

      {/* 2. Main Content */}
      <main className="flex-1 md:ml-64 p-8 max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-2xl font-bold mb-1">반가워요, Kenji님 👋</h2>
            <p className="text-slate-500 text-sm">오늘의 주요 일정을 확인하세요.</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors">
              <Bell size={20} className="text-slate-600" />
              <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden border border-slate-200">
              <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200" alt="Host Profile" />
            </div>
          </div>
        </header>

        {activeTab === 'home' && <HomeView />}
        {activeTab === 'listings' && <ListingsView />}
      </main>
    </div>
  );
}

// --- Sub Views ---

function HomeView() {
  return (
    <div className="space-y-8">
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <AlertCircle size={20} className="text-amber-500" />
          확인이 필요한 알림 (1)
        </h3>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
          <div className="mt-1 bg-amber-100 p-1.5 rounded-full text-amber-600">
            <MessageSquare size={16} />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-sm text-amber-900 mb-1">['오사카 먹방 투어'] 체험 보완 요청</h4>
            <p className="text-sm text-amber-800 leading-relaxed mb-3">
              관리자로부터 보완 요청이 도착했습니다: "체험 일정 부분에 포함된 식사 메뉴를 좀 더 구체적으로 적어주세요."
            </p>
            <button className="text-xs font-bold bg-white border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors">
              수정하러 가기
            </button>
          </div>
          <span className="text-xs text-amber-500 font-medium">1시간 전</span>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="이번 달 예상 수입" value="₩ 850,000" sub="지난달 대비 +12%" />
        <StatCard title="다가오는 예약" value="4 건" sub="다음 예약: 내일 14:00" highlight />
        <StatCard title="30일 조회수" value="1,240 회" sub="지난달 대비 -5%" />
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">다가오는 예약 (4)</h3>
          <button className="text-sm font-semibold text-slate-500 hover:text-black hover:underline">모두 보기</button>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <ReservationItem 
            date="내일, 10월 24일" time="14:00 - 17:00"
            guest="지민 님 외 2명" title="현지인과 함께하는 시부야 이자카야..."
            status="CONFIRMED"
          />
          <ReservationItem 
            date="10월 26일 (토)" time="10:00 - 13:00"
            guest="Mike Johnson" title="현지인과 함께하는 시부야 이자카야..."
            status="CONFIRMED"
          />
        </div>
      </section>
    </div>
  );
}

function ListingsView() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">내 체험 목록</h3>
      </div>
      
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-start hover:border-slate-300 transition-colors">
        <div className="w-full md:w-48 aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden relative">
           <img src="https://images.unsplash.com/photo-1542051841857-5f90071e7989" className="w-full h-full object-cover" />
           <div className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">운영중</div>
        </div>
        <div className="flex-1 w-full">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-bold text-lg">현지인과 함께하는 시부야 이자카야 탐방</h4>
            <button className="text-slate-400 hover:text-black"><SlidersHorizontal size={18}/></button>
          </div>
          <p className="text-sm text-slate-500 mb-4 line-clamp-2">도쿄의 숨겨진 맛집을 찾아다니는 미식 투어입니다. 관광객이 모르는 찐 로컬 스팟만 골라갑니다.</p>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
             <span className="flex items-center gap-1"><Star size={14} className="text-black"/> 4.98 (124)</span>
             <span>₩ 85,000 / 인</span>
          </div>
        </div>
        <div className="flex md:flex-col gap-2 w-full md:w-auto mt-2 md:mt-0">
          <button className="flex-1 bg-black text-white text-sm font-bold px-4 py-3 rounded-lg hover:bg-slate-800">날짜 관리</button>
          <button className="flex-1 border border-slate-200 text-sm font-bold px-4 py-3 rounded-lg hover:bg-slate-50">수정하기</button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-start opacity-80">
        <div className="w-full md:w-48 aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden relative">
           <img src="https://images.unsplash.com/photo-1536098561742-ca998e48cbcc" className="w-full h-full object-cover grayscale" />
           <div className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
             <Clock size={10} /> 승인 대기중
           </div>
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-lg text-slate-700">오사카 먹방 투어: 타코야키부터...</h4>
          <p className="text-sm text-slate-400 mb-4">관리자 승인 대기 중입니다. (예상 소요시간: 24시간)</p>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-600">
             <span className="font-bold text-black block mb-1">📢 보완 요청 사항</span>
             "체험 일정 부분에 포함된 식사 메뉴를 좀 더 구체적으로 적어주세요."
          </div>
        </div>
        <div className="flex md:flex-col gap-2 w-full md:w-auto">
          <button className="flex-1 border border-black text-black text-sm font-bold px-4 py-3 rounded-lg hover:bg-slate-50">보완하여 제출</button>
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, badge }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-all ${
        active ? 'bg-slate-100 text-black' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
      </div>
      {badge && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>}
    </button>
  );
}

function StatCard({ title, value, sub, highlight }: any) {
  return (
    <div className={`p-6 rounded-2xl border ${highlight ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200'}`}>
      <h4 className={`text-sm font-medium mb-2 ${highlight ? 'text-slate-400' : 'text-slate-500'}`}>{title}</h4>
      <div className="text-3xl font-bold mb-2">{value}</div>
      <div className={`text-xs ${highlight ? 'text-slate-400' : 'text-slate-400'}`}>{sub}</div>
    </div>
  );
}

function ReservationItem({ date, time, guest, title, status }: any) {
  return (
    <div className="flex items-center justify-between p-5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex flex-col items-center justify-center text-xs font-bold border border-slate-200 text-slate-500">
           <span>OCT</span>
           <span className="text-lg text-black">24</span>
        </div>
        <div>
          <h4 className="font-bold text-sm text-slate-900">{guest}</h4>
          <p className="text-xs text-slate-500">{time} · {title}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
         <button className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-200 hover:border-black text-slate-400 hover:text-black transition-all">
            <MessageSquare size={14} />
         </button>
         <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded">확정됨</span>
      </div>
    </div>
  );
}