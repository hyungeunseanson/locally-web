'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { 
  Plus, Calendar, Clock, ChevronRight, Star, 
  Wallet, TrendingUp, AlertCircle, MessageSquare 
} from 'lucide-react';

export default function HostDashboard() {
  const [hostStatus, setHostStatus] = useState<any>(null);
  const [experiences, setExperiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      // 호스트 상태 확인
      const { data: hostData } = await supabase
        .from('host_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      setHostStatus(hostData);

      // 내 체험 목록 가져오기 (승인된 경우만)
      if (hostData?.status === 'approved' || hostData?.status === 'active') {
        const { data: exps } = await supabase
          .from('experiences')
          .select('*')
          .eq('host_id', user.id)
          .order('created_at', { ascending: false });
        
        if (exps) setExperiences(exps);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-black"></div></div>;

  // 1. 호스트 신청 전
  if (!hostStatus) {
    return (
      <div className="min-h-screen bg-white font-sans">
        <SiteHeader />
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <h1 className="text-4xl font-black mb-6 tracking-tight">호스트가 되어보세요</h1>
          <p className="text-lg text-slate-500 mb-10 max-w-xl mx-auto">당신의 열정을 공유하고, 전 세계 사람들을 만나며 수익을 창출하세요.</p>
          <Link href="/host/register" className="bg-[#FF385C] hover:bg-[#D9324E] text-white px-8 py-4 rounded-xl font-bold text-lg transition-colors shadow-lg">호스트 시작하기</Link>
        </div>
      </div>
    );
  }

  // 2. 심사 중 / 보완 요청 / 거절 (심플한 카드 UI)
  if (['pending', 'revision', 'rejected'].includes(hostStatus.status)) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans">
        <SiteHeader />
        <div className="max-w-2xl mx-auto px-6 py-20">
          <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100 text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${hostStatus.status === 'pending' ? 'bg-yellow-100 text-yellow-600' : hostStatus.status === 'revision' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'}`}>
              {hostStatus.status === 'pending' ? <Clock size={40}/> : <AlertCircle size={40}/>}
            </div>
            <h2 className="text-2xl font-bold mb-3">
              {hostStatus.status === 'pending' ? '꼼꼼히 검토하고 있어요' : hostStatus.status === 'revision' ? '조금만 더 보완해주세요!' : '아쉽게도 승인되지 않았습니다'}
            </h2>
            <p className="text-slate-500 mb-8 leading-relaxed">
              {hostStatus.status === 'pending' ? '제출해주신 신청서를 확인 중입니다. 결과는 2-3일 내로 알려드릴게요.' : hostStatus.admin_comment || '상세 사유를 확인해 주세요.'}
            </p>
            {hostStatus.status === 'revision' && (
              <Link href="/host/register" className="inline-block bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors">신청서 수정하기</Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 🚀 3. 승인된 호스트 대시보드 (에어비앤비 스타일)
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 pb-20">
      <SiteHeader />
      
      <main className="max-w-7xl mx-auto px-6 py-10">
        
        {/* 상단: 환영 메시지 & 등록 버튼 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-black mb-1">반가워요, 호스트님! 👋</h1>
            <p className="text-slate-500 text-sm">오늘의 예약 현황과 할 일을 확인하세요.</p>
          </div>
          <Link href="/host/create" className="flex items-center gap-2 bg-black text-white px-5 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-sm active:scale-95">
            <Plus size={18}/> 체험 등록하기
          </Link>
        </div>

        {/* 1. 오늘의 할 일 (To-Do) */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4">오늘의 할 일</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AlertCard title="승인 대기 예약" count={3} type="urgent" />
            <AlertCard title="읽지 않은 메시지" count={5} type="info" />
            <AlertCard title="다가오는 일정" count={1} type="upcoming" />
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* 왼쪽: 내 체험 목록 (메인) */}
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">운영 중인 체험</h2>
              <Link href="#" className="text-sm font-semibold text-slate-500 hover:text-black underline">전체 보기</Link>
            </div>

            {experiences.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-2xl p-10 text-center bg-slate-50/50">
                <p className="text-slate-500 font-medium mb-4">아직 등록된 체험이 없습니다.</p>
                <Link href="/host/create" className="text-black font-bold underline">첫 체험을 만들어보세요!</Link>
              </div>
            ) : (
              <div className="space-y-4">
                {experiences.map(exp => (
                  <ExperienceListCard key={exp.id} exp={exp} />
                ))}
              </div>
            )}
          </div>

          {/* 오른쪽: 성과 요약 & 팁 */}
          <div className="space-y-8">
            
            {/* 성과 요약 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><TrendingUp size={20}/> 성과 요약</h3>
              <div className="space-y-6">
                <div>
                  <div className="text-xs text-slate-500 font-bold mb-1">이번 달 수입</div>
                  <div className="text-3xl font-black">₩1,250,000</div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-100">
                  <div>
                    <div className="text-xs text-slate-500 font-bold mb-1">평점</div>
                    <div className="text-lg font-bold flex items-center gap-1"><Star size={16} fill="black"/> 4.9</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-bold mb-1">조회수</div>
                    <div className="text-lg font-bold">345회</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 슈퍼호스트 팁 */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <h4 className="font-bold text-sm mb-2">💡 슈퍼호스트가 되는 꿀팁</h4>
              <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4">
                <li>게스트 메시지에 1시간 내로 답장하세요.</li>
                <li>프로필 사진을 선명한 인물 사진으로 바꾸세요.</li>
                <li>예약 캘린더를 최신 상태로 유지하세요.</li>
              </ul>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

// 🟡 컴포넌트: 할 일 카드
function AlertCard({ title, count, type }: any) {
  const colors = {
    urgent: 'bg-rose-50 border-rose-100 text-rose-700',
    info: 'bg-slate-50 border-slate-200 text-slate-700',
    upcoming: 'bg-blue-50 border-blue-100 text-blue-700'
  };
  
  return (
    <div className={`p-5 rounded-2xl border flex items-center justify-between cursor-pointer transition-transform hover:-translate-y-1 ${colors[type as keyof typeof colors]}`}>
      <span className="font-bold text-sm">{title}</span>
      <span className="text-2xl font-black">{count}</span>
    </div>
  );
}

// 🟡 컴포넌트: 체험 리스트 카드 (가로형)
function ExperienceListCard({ exp }: any) {
  return (
    <div className="flex gap-4 p-4 border border-slate-200 rounded-2xl hover:shadow-md transition-shadow cursor-pointer bg-white group">
      {/* 썸네일 */}
      <div className="w-24 h-24 rounded-xl bg-slate-200 overflow-hidden shrink-0 relative">
        {exp.photos?.[0] && <img src={exp.photos[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform"/>}
        <div className="absolute top-1 left-1 bg-white/90 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase backdrop-blur-sm">
          {exp.status}
        </div>
      </div>
      
      {/* 정보 */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h4 className="font-bold text-base text-slate-900 truncate mb-1">{exp.title}</h4>
        <div className="text-sm text-slate-500 mb-3 flex items-center gap-2">
          <span>{exp.city}</span> · <span>₩{exp.price?.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
          <span className="flex items-center gap-1 hover:text-black transition-colors"><Calendar size={12}/> 일정 관리</span>
          <span className="flex items-center gap-1 hover:text-black transition-colors"><MessageSquare size={12}/> 후기 보기</span>
        </div>
      </div>

      {/* 화살표 */}
      <div className="flex items-center justify-center px-2 text-slate-300 group-hover:text-black transition-colors">
        <ChevronRight size={20}/>
      </div>
    </div>
  );
}