import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { User, DollarSign, Clock, LayoutDashboard, Calendar, List, MessageSquare, BarChart3, Plus } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';

export default async function HostDashboard() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return (
      <div className="min-h-screen bg-white text-slate-900">
        <SiteHeader />
        <div className="flex justify-center items-center h-[60vh]">
          <p className="text-slate-500">Vercel 환경 변수 설정이 필요합니다.</p>
        </div>
      </div>
    );
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data: myExperiences } = await supabase
    .from('experiences')
    .select(`
      id, title, price, image_url,
      bookings ( id, user_id, amount, status, created_at )
    `)
    .eq('host_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
        
        {/* 사이드바 메뉴 (PC에서만 보임) */}
        <aside className="w-64 hidden md:block shrink-0">
           <div className="sticky top-24 space-y-2">
              <div className="px-4 py-3 bg-slate-100 text-black font-bold rounded-xl flex items-center gap-3">
                 <LayoutDashboard size={20}/> 홈
              </div>
              <div className="px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-black rounded-xl flex items-center gap-3 cursor-pointer transition-colors">
                 <Calendar size={20}/> 달력
              </div>
              <div className="px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-black rounded-xl flex items-center gap-3 cursor-pointer transition-colors">
                 <List size={20}/> 내 체험 관리
              </div>
              <div className="px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-black rounded-xl flex items-center gap-3 cursor-pointer transition-colors">
                 <MessageSquare size={20}/> 메시지함
              </div>
              <div className="px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-black rounded-xl flex items-center gap-3 cursor-pointer transition-colors">
                 <BarChart3 size={20}/> 정산 및 통계
              </div>
           </div>
        </aside>

        {/* 메인 컨텐츠 영역 */}
        <main className="flex-1">
          <div className="flex justify-between items-end mb-8">
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
              myExperiences.map((exp) => (
                <div key={exp.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="font-bold text-lg flex items-center gap-2 text-slate-900 truncate">
                      🏷️ {exp.title}
                    </h2>
                    <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200 shrink-0">
                      예약 {exp.bookings.length}건
                    </span>
                  </div>
                  
                  <div className="p-0">
                    {exp.bookings.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 text-sm">
                        아직 들어온 예약이 없습니다.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {exp.bookings.map((booking: any) => (
                          <div key={booking.id} className="p-6 flex flex-col md:flex-row justify-between items-center hover:bg-slate-50 transition-colors">
                             <div className="flex gap-4 items-center w-full">
                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 shrink-0"><User size={18}/></div>
                                <div>
                                  <div className="font-bold text-slate-900 text-sm">게스트 ({booking.user_id.slice(0,4)}..)</div>
                                  <div className="text-xs text-slate-500 mt-1 flex gap-2 items-center">
                                    <span className="flex items-center gap-1"><Clock size={10}/> {new Date(booking.created_at).toLocaleDateString()}</span>
                                    <span className="font-bold flex items-center gap-1"><DollarSign size={10}/> ₩{booking.amount.toLocaleString()}</span>
                                  </div>
                                </div>
                             </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}