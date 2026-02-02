import { redirect } from 'next/navigation';
import Link from 'next/link';
import { User, DollarSign, Clock, LayoutDashboard, Calendar, List, MessageSquare, BarChart3, Plus } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';
import { createClient } from '@/app/utils/supabase/server';

// 캐싱 방지
export const dynamic = 'force-dynamic';

export default async function HostDashboard() {
  const supabase = await createClient();

  // 🚨 [수정됨] 로그인 체크 잠시 해제 (에러 나도 일단 페이지 보여줌)
  const { data: { user } } = await supabase.auth.getUser();
  
  // if (!user) {
  //   redirect('/');
  // }

  // 유저가 없으면 빈 배열 반환 (에러 방지)
  const myExperiences = user ? (await supabase
    .from('experiences')
    .select(`
      id, title, price, image_url,
      bookings ( id, user_id, amount, status, created_at )
    `)
    .eq('host_id', user.id)
    .order('created_at', { ascending: false })).data : [];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
        {/* ... 사이드바와 메인 컨텐츠 ... */}
        {/* 로그인 안 된 상태면 경고 메시지 표시 */}
        {!user && (
           <div className="w-full bg-red-100 text-red-600 p-4 rounded-xl mb-4 text-center font-bold">
             ⚠️ 현재 서버에서 로그인이 인식되지 않고 있습니다. (쿠키 문제 확인 중)
           </div>
        )}

        <main className="flex-1">
          <div className="flex justify-between items-end mb-8">
             {/* ... 기존 코드 그대로 유지 ... */}
             <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900">호스트 대시보드</h1>
              <p className="text-slate-500 mt-2 text-sm md:text-base">등록한 체험과 예약 현황을 한눈에 관리하세요.</p>
            </div>
            <Link href="/host/create">
              <button className="bg-slate-900 text-white px-5 py-2.5 md:px-6 md:py-3 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg flex items-center gap-2 text-sm md:text-base">
                <Plus size={18} /> <span className="hidden md:inline">새 체험 등록</span><span className="md:hidden">등록</span>
              </button>
            </Link>
          </div>
          {/* ... 리스트 영역 ... */}
           <div className="grid gap-6">
            {(!myExperiences || myExperiences.length === 0) ? (
              <div className="text-center py-24 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-slate-500 mb-6">아직 등록한 체험이 없습니다.</p>
                <Link href="/host/create">
                  <button className="text-slate-900 font-bold underline underline-offset-4 hover:text-blue-600">
                    첫 번째 체험을 등록해보세요!
                  </button>
                </Link>
              </div>
            ) : (
                // ... 기존 매핑 로직 ...
                myExperiences.map((exp) => (
                    <div key={exp.id}>{exp.title}</div> // 임시 표시
                ))
            )}
           </div>
        </main>
      </div>
    </div>
  );
}