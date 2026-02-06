'use client';

import React, { useState, useEffect } from 'react';
import { Users, MapPin, CheckCircle2, MessageSquare, DollarSign } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { NavButton } from './components/SharedComponents';
import ManagementTab from './components/ManagementTab';
import AnalyticsTab from './components/AnalyticsTab';
import { Users, MapPin, CheckCircle2, MessageSquare, DollarSign, Wifi } from 'lucide-react'; // ✅ Wifi 추가

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'APPS' | 'EXPS' | 'USERS' | 'CHATS' | 'FINANCE' | 'REALTIME'>('APPS');
  const [filter, setFilter] = useState('ALL'); 
  
  const [apps, setApps] = useState<any[]>([]);
  const [exps, setExps] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  // ✅ 실시간 접속자 목록 상태 추가
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => { fetchData(); }, []);

// ✅ Supabase Presence: 실시간 접속자 구독 로직 추가
const channel = supabase.channel('online_users')
.on('presence', { event: 'sync' }, () => {
  const newState = channel.presenceState();
  const users = Object.values(newState).flat(); 
  
  // 중복 접속 제거 (user_id 기준)
  const uniqueUsers = Array.from(new Map(users.map((u: any) => [u.user_id, u])).values());
  setOnlineUsers(uniqueUsers);
})
.subscribe();

return () => { supabase.removeChannel(channel); };
}, []);

  // ✅ 수정된 fetchData 함수 (디버깅 로그 포함)
  const fetchData = async () => {
    console.log("🔄 데이터 불러오는 중..."); // 디버깅 시작 알림

    // 1. 호스트 지원서
    const { data: appData, error: appError } = await supabase.from('host_applications').select('*').order('created_at', { ascending: false });
    if (appError) console.error("❌ 지원서 로딩 실패:", appError);
    if (appData) setApps(appData);

    // 2. 체험
    const { data: expData, error: expError } = await supabase.from('experiences').select('*').order('created_at', { ascending: false });
    if (expError) console.error("❌ 체험 로딩 실패:", expError);
    if (expData) setExps(expData);

    // 3. 유저 (Profiles) - 여기가 핵심입니다!
    const { data: userData, error: userError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }); 
    
    if (userError) {
      console.error("❌ 유저 데이터 로딩 실패 (RLS 정책 확인 필요):", userError);
    } else {
      console.log(`✅ 유저 데이터 로딩 성공: ${userData?.length}명 가져옴`);
    }
    
    if (userData) setUsers(userData);

    // 4. 예약/매출
    const { data: bookingData } = await supabase.from('bookings').select('*, experiences(title, price)').order('created_at', { ascending: false });
    if (bookingData) setBookings(bookingData);

    // 5. 메시지
    const { data: msgData } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(50);
    if (msgData) setMessages(msgData);
  };

  const updateStatus = async (table: 'host_applications' | 'experiences', id: string, status: string) => {
    let comment = '';
    if (status === 'rejected' || status === 'revision') {
      const input = prompt(`[${status === 'revision' ? '보완요청' : '거절'}] 사유를 입력해주세요:`);
      if (input === null) return;
      comment = input;
    } else {
      if (!confirm('승인하시겠습니까?')) return;
      status = table === 'host_applications' ? 'approved' : 'active';
    }
    await supabase.from(table).update({ status, admin_comment: comment }).eq('id', id);
    if (table === 'host_applications' && (status === 'rejected' || status === 'revision')) {
      const { data: hostApp } = await supabase.from('host_applications').select('user_id').eq('id', id).single();
      if (hostApp) {
        await supabase.from('experiences').update({ status: status, admin_comment: `호스트 자격 ${status}` }).eq('host_id', hostApp.user_id);
      }
    }
    alert('처리되었습니다.');
    fetchData();
    setSelectedItem(null);
  };

  const deleteItem = async (table: string, id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) alert('삭제 실패: ' + error.message);
    else { alert('삭제되었습니다.'); fetchData(); setSelectedItem(null); }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <SiteHeader />
      <div className="flex h-[calc(100vh-80px)]">
        <aside className="w-64 bg-slate-900 text-white flex flex-col p-4 shadow-xl z-10">
          <div className="mb-6 px-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase mb-2">Management</h2>
            <nav className="space-y-1">
              <NavButton active={activeTab==='APPS'} onClick={()=>setActiveTab('APPS')} icon={<Users size={18}/>} label="호스트 지원서" count={apps.filter(a=>a.status==='pending').length} />
              <NavButton active={activeTab==='EXPS'} onClick={()=>setActiveTab('EXPS')} icon={<MapPin size={18}/>} label="체험 관리" count={exps.filter(e=>e.status==='pending').length} />
              <NavButton active={activeTab==='USERS'} onClick={()=>setActiveTab('USERS')} icon={<CheckCircle2 size={18}/>} label="고객(유저) 관리" />
            </nav>
          </div>
          <div className="mb-6 px-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase mb-2">Monitoring</h2>
            <nav className="space-y-1">
              {/* ✅ [신규] 실시간 접속자 메뉴 버튼 추가 */}
              <NavButton 
                active={activeTab==='REALTIME'} 
                onClick={()=>setActiveTab('REALTIME')} 
                icon={<Wifi size={18} className={onlineUsers.length > 0 ? "text-green-400 animate-pulse" : ""}/>} 
                label="실시간 접속자" 
                count={onlineUsers.length} 
              />
              <NavButton active={activeTab==='CHATS'} onClick={()=>setActiveTab('CHATS')} icon={<MessageSquare size={18}/>} label="메시지 모니터링" />
              <NavButton active={activeTab==='FINANCE'} onClick={()=>setActiveTab('FINANCE')} icon={<DollarSign size={18}/>} label="매출 및 통계" />
            </nav>
          </div>
        </aside>

        <main className="flex-1 p-6 overflow-hidden flex gap-6">
{/* ✅ [신규] 실시간 접속자 화면 (REALTIME) */}
{activeTab === 'REALTIME' ? (
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-8 overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                    <Wifi size={32} className="text-green-500"/> 실시간 접속 현황
                  </h2>
                  <p className="text-slate-500 mt-2">현재 사이트를 이용 중인 유저들을 실시간으로 모니터링합니다.</p>
                </div>
                <div className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-lg shadow-lg flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  Total: <span className="text-green-400">{onlineUsers.length}</span>명
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {onlineUsers.map((u: any, idx) => (
                  <div key={idx} className="p-5 border border-slate-200 rounded-2xl bg-white hover:shadow-lg transition-all hover:border-black group relative overflow-hidden">
                    <div className="flex items-start gap-4">
                      <div className="relative">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm ${u.is_anonymous ? 'bg-slate-300' : 'bg-gradient-to-br from-blue-500 to-purple-600'}`}>
                          {u.email ? u.email[0].toUpperCase() : 'G'}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 truncate mb-1">{u.email || '비회원 (Guest)'}</div>
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${u.is_anonymous ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-600'}`}>
                          {u.is_anonymous ? 'Guest' : 'Member'}
                        </span>
                        <div className="text-xs text-slate-400 mt-2 font-mono">
                          {new Date(u.connected_at).toLocaleTimeString()} 입장
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {onlineUsers.length === 0 && (
                  <div className="col-span-full py-32 text-center text-slate-300 flex flex-col items-center">
                    <Wifi size={64} className="mb-4 opacity-20"/>
                    <p className="text-lg">현재 접속 중인 유저가 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'FINANCE' ? (
            <AnalyticsTab bookings={bookings} users={users} exps={exps} apps={apps} />
          ) : (
            <ManagementTab 
              activeTab={activeTab} filter={filter} setFilter={setFilter}
              apps={apps} exps={exps} users={users} messages={messages}
              selectedItem={selectedItem} setSelectedItem={setSelectedItem}
              updateStatus={updateStatus} deleteItem={deleteItem}
            />
          )}
        </main>
      </div>
    </div>
  );
}