'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart2, Star, Calendar, Plus, Wallet, ChevronRight, 
  Clock, AlertCircle, XCircle, MessageSquare 
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import ReservationManager from './components/ReservationManager'; // ✅ 새로 만든 컴포넌트

export default function HostDashboard() {
  const [hostStatus, setHostStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    checkHostStatus();
  }, []);

  const checkHostStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('host_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!error) {
        setHostStatus(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-black"></div>
      </div>
    );
  }

  // 1. 신청 내역 없음 (비로그인/미신청)
  if (!hostStatus) {
    return (
      <div className="min-h-screen bg-white font-sans">
        <SiteHeader />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <h1 className="text-3xl font-black mb-4">아직 호스트가 아니시군요!</h1>
          <p className="text-slate-500 mb-8">나만의 특별한 투어를 만들고 수익을 창출해보세요.</p>
          <Link href="/host/register">
            <button className="bg-black text-white px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg">호스트 지원하기</button>
          </Link>
        </div>
      </div>
    );
  }

  const status = hostStatus.status?.toLowerCase().trim();

  // ✅ 2. 보완 요청 (Revision) - 기존 디자인 유지
  if (status === 'revision') {
    return (
      <div className="min-h-screen bg-white font-sans">
        <SiteHeader />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center space-y-6">
          <div className="w-24 h-24 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle size={48} />
          </div>
          <div>
            <h1 className="text-3xl font-black mb-2">보완이 필요합니다</h1>
            <p className="text-slate-500 mb-6">
              아래 관리자 코멘트를 확인하고,<br/>
              내용을 보완하여 다시 제출해 주세요.
            </p>
            
            <div className="bg-orange-50 border border-orange-100 p-6 rounded-2xl text-left mb-8 shadow-sm">
              <h4 className="font-bold text-orange-800 mb-2 flex items-center gap-2">
                <MessageSquare size={16}/> 관리자 코멘트
              </h4>
              <p className="text-orange-700 text-sm whitespace-pre-wrap leading-relaxed">
                {hostStatus.admin_comment || "관리자가 남긴 상세 코멘트가 없습니다."}
              </p>
            </div>

            <Link href="/host/register">
              <button className="bg-black text-white px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg">
                신청서 수정하기
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ✅ 3. 거절됨 (Rejected) - 기존 디자인 유지
  if (status === 'rejected') {
    return (
      <div className="min-h-screen bg-white font-sans">
        <SiteHeader />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center space-y-6">
          <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <XCircle size={48} />
          </div>
          <div>
            <h1 className="text-3xl font-black mb-2">승인이 거절되었습니다</h1>
            <p className="text-slate-500 mb-6">
              아쉽게도 이번에는 모시지 못하게 되었습니다.<br/>
              사유를 확인해 주시기 바랍니다.
            </p>

            <div className="bg-red-50 border border-red-100 p-6 rounded-2xl text-left mb-8 shadow-sm">
              <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                <MessageSquare size={16}/> 거절 사유
              </h4>
              <p className="text-red-700 text-sm whitespace-pre-wrap leading-relaxed">
                {hostStatus.admin_comment || "별도의 사유가 기재되지 않았습니다."}
              </p>
            </div>

            <Link href="/">
              <button className="text-slate-400 underline hover:text-slate-600 text-sm">홈으로 돌아가기</button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ✅ 4. 심사 대기 중 (Pending) - 기존 디자인 유지
  if (status === 'pending') {
    return (
      <div className="min-h-screen bg-white font-sans">
        <SiteHeader />
        <div className="max-w-2xl mx-auto px-6 py-20 text-center space-y-6">
          <div className="w-24 h-24 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto">
            <Clock size={48} />
          </div>
          <div>
            <h1 className="text-3xl font-black mb-2">심사가 진행 중입니다</h1>
            <p className="text-slate-500">
              제출해주신 신청서를 꼼꼼히 확인하고 있습니다.<br/>
              결과가 나올 때까지 조금만 기다려 주세요!
            </p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl inline-block text-xs text-slate-400">
            신청일: {new Date(hostStatus.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
    );
  }

  // 🚀 5. 승인됨 (Approved/Active) - 여기가 진짜 대시보드!
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      
      {/* 상단 헤더 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-black text-xl tracking-tighter">Locally <span className="text-slate-400 font-medium text-xs">Host</span></Link>
          <div className="flex gap-4 items-center">
            <Link href="/host/create" className="text-sm font-bold bg-black text-white px-4 py-2 rounded-full hover:bg-slate-800 transition-colors flex items-center gap-2">
              <Plus size={14}/> 체험 등록하기
            </Link>
            <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* 왼쪽: 메인 (예약 관리) - 가장 중요! */}
          <div className="flex-1 w-full space-y-8">
            
            {/* 요약 스탯 카드 */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="이번 달 수입" value="₩1,250,000" icon={<Wallet size={16} className="text-green-600"/>} />
              <StatCard label="평점" value="4.9" sub="(후기 12개)" icon={<Star size={16} className="text-yellow-500"/>} />
              <StatCard label="예약 조회" value="345회" icon={<BarChart2 size={16} className="text-blue-500"/>} />
            </div>

            {/* 예약 관리 센터 */}
            <div className="h-[600px]">
              <ReservationManager />
            </div>
          </div>

          {/* 오른쪽: 사이드 (내 체험 관리 & 팁) */}
          <div className="w-full lg:w-80 space-y-6">
            
            {/* 내 체험 목록 바로가기 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-slate-800">내 체험 관리</h4>
                <Link href="#" className="text-xs text-slate-400 hover:text-black flex items-center">전체 <ChevronRight size={10}/></Link>
              </div>
              <div className="space-y-3">
                <MiniExperienceCard title="서울의 숨겨진 골목 투어" status="active" />
                <MiniExperienceCard title="K-Food 쿠킹 클래스" status="pending" />
              </div>
            </div>

            {/* 호스팅 팁 */}
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
              <h4 className="font-bold text-blue-900 mb-2 text-sm">💡 슈퍼호스트가 되는 법</h4>
              <p className="text-xs text-blue-700 leading-relaxed mb-3">
                게스트에게 24시간 이내에 응답하면 노출 확률이 2배 올라갑니다. 알림 설정을 켜두세요!
              </p>
              <button className="text-xs font-bold text-blue-600 underline">자세히 보기</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// 🟡 내부용 작은 컴포넌트들
function StatCard({ label, value, sub, icon }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-28">
      <div className="flex justify-between items-start">
        <span className="text-xs font-bold text-slate-400">{label}</span>
        {icon}
      </div>
      <div>
        <div className="text-xl font-black text-slate-900">{value}</div>
        {sub && <div className="text-[10px] text-slate-400 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

function MiniExperienceCard({ title, status }: any) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group">
      <div className="w-10 h-10 rounded-lg bg-slate-200 shrink-0"></div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-xs truncate group-hover:text-black text-slate-700">{title}</div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
          <span className="text-[10px] text-slate-400 capitalize">{status}</span>
        </div>
      </div>
    </div>
  );
}