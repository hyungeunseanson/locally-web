// ... (기존 imports 유지)

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({ users: 0, experiences: 0, bookings: 0 });
  // ... (기존 로직)

  useEffect(() => {
    // 통계 가져오기
    const fetchStats = async () => {
      const { count: users } = await supabase.from('host_applications').select('*', { count: 'exact', head: true });
      const { count: exps } = await supabase.from('experiences').select('*', { count: 'exact', head: true });
      const { count: books } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
      setStats({ users: users || 0, experiences: exps || 0, bookings: books || 0 });
    };
    fetchStats();
    // ... (기존 fetchApplications 호출)
  }, []);

  return (
    // ... (기존 레이아웃)
    <main className="flex-1 ml-20 md:ml-64 p-8">
       {/* 통계 카드 추가 */}
       <div className="grid grid-cols-3 gap-6 mb-8">
         <div className="bg-white p-6 rounded-xl border shadow-sm">
           <p className="text-sm text-slate-500">총 호스트 신청</p>
           <h2 className="text-3xl font-black">{stats.users}</h2>
         </div>
         <div className="bg-white p-6 rounded-xl border shadow-sm">
           <p className="text-sm text-slate-500">등록된 체험</p>
           <h2 className="text-3xl font-black">{stats.experiences}</h2>
         </div>
         <div className="bg-white p-6 rounded-xl border shadow-sm">
           <p className="text-sm text-slate-500">총 예약 건수</p>
           <h2 className="text-3xl font-black">{stats.bookings}</h2>
         </div>
       </div>
       
       {/* ... (기존 지원서 목록 리스트) ... */}
    </main>
  );
}