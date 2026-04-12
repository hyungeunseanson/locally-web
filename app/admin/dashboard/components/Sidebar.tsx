'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { normalizeAdminDashboardTab } from '../tabRouting';
import {
  Users, CheckCircle2, MessageSquare,
  BarChart2, CreditCard, LayoutDashboard,
  Briefcase, Menu, X, ClipboardList, Bell
} from 'lucide-react';

type NavButtonProps = {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
};

type SidebarUser = {
  id?: string;
  email?: string | null;
} | null;

const NavButton = ({ active, onClick, icon, label }: NavButtonProps) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${active
      ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
  >
    <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
      <div className="shrink-0">{icon}</div>
      <span className="text-[11px] md:text-sm font-medium truncate">{label}</span>
    </div>
  </button>
);

export default function Sidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const rawUrlTab = searchParams.get('tab');
  const urlTab = normalizeAdminDashboardTab(rawUrlTab);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [savedTab] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    return localStorage.getItem('admin_active_tab');
  });
  const [currentUser, setCurrentUser] = useState<SidebarUser>(null);

  const activeTab = urlTab || normalizeAdminDashboardTab(savedTab) || 'APPS';

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setCurrentUser(user);
      } catch (e) {
        console.log('Error fetching user:', e);
      }
    };

    void fetchCurrentUser();
  }, [supabase]);

  const handleTabChange = (tab: string) => {
    router.push(`/admin/dashboard?tab=${tab}`);
    setIsMobileOpen(false); // 🟢 모바일에서 탭 전환 시 사이드바 닫기
  };

  // 🟢 사이드바 내부 콘텐츠 (데스크탑 / 모바일 오버레이 공용)
  const sidebarContent = (
    <>
      <Link
        href="/"
        onClick={() => setIsMobileOpen(false)}
        className="mb-10 px-2 mt-4 inline-flex items-center gap-3 group select-none self-start focus:outline-none focus-visible:outline-none"
      >
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shadow-sm overflow-hidden">
          <Image
            src="/images/logo-new-white.png"
            alt="Locally Logo"
            width={32}
            height={32}
            unoptimized
            className="w-8 h-8 object-contain group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        <div className="flex flex-col">
          <h1 className="text-[19px] font-bold text-white tracking-tight leading-none mb-0.5">Locally</h1>
          <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Admin console</p>
        </div>
      </Link>

      <div className="space-y-8 flex-1 overflow-y-auto scrollbar-hide">
        <div>
          <h2 className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 md:mb-3 px-2">Management</h2>
          <div className="space-y-0.5 md:space-y-1">
            <NavButton
              active={activeTab === 'APPROVALS' || activeTab === 'APPS' || activeTab === 'EXPS'}
              onClick={() => handleTabChange('APPROVALS')}
              icon={<CheckCircle2 size={16} className="md:w-[18px] md:h-[18px]" />}
              label="Approvals"
            />
            <NavButton active={activeTab === 'USERS'} onClick={() => handleTabChange('USERS')} icon={<Users size={16} className="md:w-[18px] md:h-[18px]" />} label="User Management" />
          </div>
        </div>

        <div>
          <h2 className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 md:mb-3 px-2">Operation</h2>
          <div className="space-y-0.5 md:space-y-1">
            <NavButton active={activeTab === 'ALERTS'} onClick={() => handleTabChange('ALERTS')} icon={<Bell size={16} className="md:w-[18px] md:h-[18px]" />} label="Admin Alerts" />
            <NavButton active={activeTab === 'CHATS'} onClick={() => handleTabChange('CHATS')} icon={<MessageSquare size={16} className="md:w-[18px] md:h-[18px]" />} label="Message Monitoring" />
            <NavButton
              active={activeTab === 'TEAM'}
              onClick={() => handleTabChange('TEAM')}
              icon={<Briefcase size={16} className="md:w-[18px] md:h-[18px]" />}
              label="Team Workspace"
            />
          </div>
        </div>

        <div>
          <h2 className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 md:mb-3 px-2">Finance</h2>
          <div className="space-y-0.5 md:space-y-1">
            <NavButton active={activeTab === 'LEDGER'} onClick={() => handleTabChange('LEDGER')} icon={<LayoutDashboard size={16} className="md:w-[18px] md:h-[18px]" />} label="Master Ledger" />
            <NavButton active={activeTab === 'SERVICE_REQUESTS'} onClick={() => handleTabChange('SERVICE_REQUESTS')} icon={<ClipboardList size={16} className="md:w-[18px] md:h-[18px]" />} label="Service Requests" />
            <NavButton active={activeTab === 'SALES'} onClick={() => handleTabChange('SALES')} icon={<CreditCard size={16} className="md:w-[18px] md:h-[18px]" />} label="Billing & Revenue" />
            <NavButton active={activeTab === 'ANALYTICS'} onClick={() => handleTabChange('ANALYTICS')} icon={<BarChart2 size={16} className="md:w-[18px] md:h-[18px]" />} label="Data Analytics" />
          </div>
        </div>
      </div>

      <div className="mt-auto md:pt-6 md:pb-6 border-t border-slate-900 px-2 min-h-[140px] md:min-h-0 flex flex-col justify-end">
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Admin Console
          </span>
        </div>
        <div className="flex items-center gap-2.5 md:gap-3">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] md:text-xs font-bold text-white shrink-0">
            {currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : 'AD'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] md:text-sm font-medium text-white truncate">Master Admin</p>
            <p className="text-[9px] md:text-xs text-slate-400 truncate">{currentUser?.email || 'Loading...'}</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ✅ 데스크탑: 기존 고정 사이드바 (변경 없음) */}
      <aside className="hidden md:flex w-64 bg-black text-white flex-col p-4 shadow-xl h-screen sticky top-0 border-r border-slate-900">
        {sidebarContent}
      </aside>

      {/* 🟢 모바일 전용: 상단 헤더 (햄버거 메뉴) */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-[60] bg-black text-white h-14 flex items-center justify-between px-4 shadow-lg">
        <div className="flex items-center gap-2">
          <Image
            src="/images/logo-new-white.png"
            alt="Logo"
            width={28}
            height={28}
            unoptimized
            className="w-7 h-7 object-contain"
          />
          <span className="text-[15px] font-bold tracking-tight">Locally</span>
          <span className="text-[9px] text-slate-400 font-medium tracking-wider uppercase ml-1">Admin</span>
        </div>
        <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
          {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* 🟢 모바일 전용: 슬라이드-인 오버레이 사이드바 */}
      {isMobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/60 z-[70] animate-in fade-in duration-200" onClick={() => setIsMobileOpen(false)} />
          <aside className="md:hidden fixed top-0 left-0 bottom-0 w-60 bg-black text-white flex flex-col p-3 z-[80] shadow-2xl animate-in slide-in-from-left duration-300">
            {/* 닫기 버튼 */}
            <button onClick={() => setIsMobileOpen(false)} className="absolute top-3 right-3 p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}

      {/* 🟢 모바일: 상단 헤더 높이 보정 (콘텐츠가 헤더 아래로 밀리도록 스페이서) */}
      <div className="md:hidden h-14 shrink-0" />
    </>
  );
}
