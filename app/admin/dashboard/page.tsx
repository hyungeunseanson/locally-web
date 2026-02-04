'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, MapPin, Trash2, Search, CheckCircle2, BarChart3, ChevronRight, 
  XCircle, AlertCircle, MessageSquare, DollarSign, Ban
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';

export default function AdminDashboardPage() {
  // 탭 구성: 지원서 | 체험 | 유저(고객) | 메시지 | 정산/통계
  const [activeTab, setActiveTab] = useState<'APPS' | 'EXPS' | 'USERS' | 'CHATS' | 'FINANCE'>('APPS');
  const [filter, setFilter] = useState('ALL'); 
  
  const [apps, setApps] = useState<any[]>([]);
  const [exps, setExps] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  
  const [selectedItem, setSelectedItem] = useState<any>(null); // 상세 보기용
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // 1. 지원서
    const { data: appData } = await supabase.from('host_applications').select('*').order('created_at', { ascending: false });
    if (appData) setApps(appData);

    // 2. 체험
    const { data: expData } = await supabase.from('experiences').select('*').order('created_at', { ascending: false });
    if (expData) setExps(expData);

    // 3. 유저 (임시로 호스트 지원자들을 유저 목록으로 사용 - 실제로는 profiles 테이블 필요)
    const { data: userData } = await supabase.from('host_applications').select('id, name, email, phone, created_at, user_id'); 
    if (userData) setUsers(userData); 

    // 4. 예약/매출
    const { data: bookingData } = await supabase.from('bookings').select('*, experiences(title, price)').order('created_at', { ascending: false });
    if (bookingData) setBookings(bookingData);

    // 5. 메시지 (messages 테이블이 있다고 가정)
    const { data: msgData } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(50);
    if (msgData) setMessages(msgData);
  };

  // --- 액션 핸들러 ---

  // 호스트/체험 상태 변경
  const updateStatus = async (table: 'host_applications' | 'experiences', id: string, status: string) => {
    let comment = '';
    if (status === 'rejected' || status === 'revision') {
      const input = prompt(`[${status}] 사유를 입력해주세요:`);
      if (input === null) return;
      comment = input;
    } else {
      if (!confirm('승인하시겠습니까?')) return;
      status = table === 'host_applications' ? 'approved' : 'active';
    }

    await supabase.from(table).update({ status, admin_comment: comment }).eq('id', id);
    alert('처리되었습니다.');
    fetchData();
    setSelectedItem(null);
  };

  // 삭제 기능 (호스트/체험/유저)
  const deleteItem = async (table: string, id: string) => {
    if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) alert('삭제 실패: ' + error.message);
    else {
      alert('삭제되었습니다.');
      fetchData();
      setSelectedItem(null);
    }
  };

  // --- 통계 계산 ---
  const totalSales = bookings.reduce((acc, b) => acc + (b.total_price || 0), 0);
  const platformRevenue = totalSales * 0.2; // 수수료 20%
  const hostPayout = totalSales * 0.8;      // 정산금 80%

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <SiteHeader />
      
      <div className="flex h-[calc(100vh-80px)]">
        {/* 사이드바 */}
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
              <NavButton active={activeTab==='CHATS'} onClick={()=>setActiveTab('CHATS')} icon={<MessageSquare size={18}/>} label="메시지 모니터링" />
              <NavButton active={activeTab==='FINANCE'} onClick={()=>setActiveTab('FINANCE')} icon={<DollarSign size={18}/>} label="매출 및 정산" />
            </nav>
          </div>
        </aside>

        {/* 메인 영역 */}
        <main className="flex-1 p-6 overflow-hidden flex gap-6">
          
          {/* 1. 리스트 영역 (왼쪽) */}
          <div className={`flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col ${activeTab === 'FINANCE' ? 'hidden' : ''}`}>
            {/* 필터 헤더 */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-lg">
                {activeTab === 'APPS' && '호스트 지원서'}
                {activeTab === 'EXPS' && '등록된 체험'}
                {activeTab === 'USERS' && '가입된 고객'}
                {activeTab === 'CHATS' && '최근 메시지'}
              </h3>
              {activeTab !== 'CHATS' && activeTab !== 'USERS' && (
                <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                  {['ALL', 'PENDING', 'APPROVED'].map(f => (
                    <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1 text-xs font-bold rounded ${filter===f ? 'bg-black text-white' : 'text-slate-500'}`}>{f}</button>
                  ))}
                </div>
              )}
            </div>

            {/* 리스트 아이템 */}
            <div className="overflow-y-auto flex-1 p-2 space-y-2">
              {/* 호스트 지원서 리스트 */}
              {activeTab === 'APPS' && apps
                .filter(item => filter === 'ALL' ? true : filter === 'PENDING' ? item.status === 'pending' : item.status !== 'pending')
                .map(app => (
                <ListItem key={app.id} selected={selectedItem?.id === app.id} onClick={()=>setSelectedItem(app)} 
                  title={app.name} subtitle={`${app.host_nationality} / ${app.target_language}`} status={app.status} date={app.created_at} 
                />
              ))}

              {/* 체험 리스트 */}
              {activeTab === 'EXPS' && exps
                .filter(item => filter === 'ALL' ? true : filter === 'PENDING' ? item.status === 'pending' : item.status === 'active')
                .map(exp => (
                <ListItem key={exp.id} selected={selectedItem?.id === exp.id} onClick={()=>setSelectedItem(exp)} 
                  img={exp.photos?.[0]} title={exp.title} subtitle={`₩${exp.price.toLocaleString()}`} status={exp.status} date={exp.created_at} 
                />
              ))}

              {/* 유저 리스트 */}
              {activeTab === 'USERS' && users.map(user => (
                <div key={user.id} className="p-4 border rounded-xl flex justify-between items-center hover:bg-slate-50">
                  <div>
                    <div className="font-bold">{user.name}</div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                  </div>
                  <button onClick={()=>deleteItem('host_applications', user.id)} className="text-red-500 text-xs border border-red-200 px-3 py-1.5 rounded hover:bg-red-50">삭제</button>
                </div>
              ))}

              {/* 메시지 리스트 */}
              {activeTab === 'CHATS' && messages.map(msg => (
                <div key={msg.id} className="p-4 border-b last:border-0 hover:bg-slate-50 cursor-pointer">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-xs">{msg.sender_name || 'User'} ➔ {msg.receiver_name || 'Host'}</span>
                    <span className="text-[10px] text-slate-400">{new Date(msg.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-slate-700 bg-slate-100 p-2 rounded-lg">{msg.content}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2. 상세 보기 영역 (오른쪽) */}
          {(activeTab === 'APPS' || activeTab === 'EXPS') && (
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col p-6 overflow-y-auto">
              {selectedItem ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  {/* 상세 헤더 */}
                  <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-2xl font-black">{selectedItem.title || selectedItem.name}</h2>
                      <p className="text-sm text-slate-500 mt-1">{selectedItem.id}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${selectedItem.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{selectedItem.status}</span>
                  </div>

                  {/* 내용 */}
                  <div className="space-y-4">
                    {activeTab === 'APPS' && (
                      <>
                        <InfoRow label="연락처" value={`${selectedItem.phone} / ${selectedItem.email}`} />
                        <InfoRow label="언어" value={selectedItem.target_language} />
                        <div className="bg-slate-50 p-4 rounded-xl text-sm whitespace-pre-wrap">{selectedItem.self_intro}</div>
                      </>
                    )}
                    {activeTab === 'EXPS' && (
                      <>
                        {selectedItem.photos && <img src={selectedItem.photos[0]} className="w-full h-48 object-cover rounded-xl"/>}
                        <InfoRow label="가격" value={`₩${selectedItem.price}`} />
                        <div className="bg-slate-50 p-4 rounded-xl text-sm whitespace-pre-wrap">{selectedItem.description}</div>
                      </>
                    )}
                  </div>

                  {/* 관리자 액션 버튼 */}
                  <div className="pt-6 border-t border-slate-100 grid grid-cols-2 gap-3">
                    <button onClick={()=>updateStatus(activeTab==='APPS'?'host_applications':'experiences', selectedItem.id, 'revision')} className="bg-orange-50 text-orange-600 font-bold py-3 rounded-xl border border-orange-200 hover:bg-orange-100">보완 요청</button>
                    <button onClick={()=>updateStatus(activeTab==='APPS'?'host_applications':'experiences', selectedItem.id, 'rejected')} className="bg-red-50 text-red-600 font-bold py-3 rounded-xl border border-red-200 hover:bg-red-100">거절</button>
                    <button onClick={()=>updateStatus(activeTab==='APPS'?'host_applications':'experiences', selectedItem.id, 'approved')} className="col-span-2 bg-black text-white font-bold py-4 rounded-xl hover:bg-slate-800 shadow-lg">승인 하기</button>
                    <button onClick={()=>deleteItem(activeTab==='APPS'?'host_applications':'experiences', selectedItem.id)} className="col-span-2 text-slate-400 text-xs py-2 hover:text-red-500">영구 삭제</button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                  <Search size={48} className="mb-4 opacity-20"/>
                  <p>항목을 선택하세요.</p>
                </div>
              )}
            </div>
          )}

          {/* 3. 매출/통계 전체 화면 탭 */}
          {activeTab === 'FINANCE' && (
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-8 overflow-y-auto">
              <h2 className="text-2xl font-black mb-8">매출 및 정산 현황</h2>
              
              <div className="grid grid-cols-3 gap-6 mb-10">
                <StatCard label="총 거래액 (GMV)" value={`₩${totalSales.toLocaleString()}`} color="bg-slate-900 text-white" />
                <StatCard label="플랫폼 수익 (20%)" value={`₩${platformRevenue.toLocaleString()}`} color="bg-rose-500 text-white" />
                <StatCard label="호스트 정산 예정 (80%)" value={`₩${hostPayout.toLocaleString()}`} color="bg-green-500 text-white" />
              </div>

              <h3 className="font-bold text-lg mb-4">최근 예약 내역</h3>
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold">
                  <tr>
                    <th className="p-4">예약일</th>
                    <th className="p-4">게스트</th>
                    <th className="p-4">체험명</th>
                    <th className="p-4">결제 금액</th>
                    <th className="p-4">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookings.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="p-4">{new Date(b.created_at).toLocaleDateString()}</td>
                      <td className="p-4">{b.user_id}</td>
                      <td className="p-4 font-bold">{b.experiences?.title || 'Unknown'}</td>
                      <td className="p-4">₩{b.total_price.toLocaleString()}</td>
                      <td className="p-4"><span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">결제완료</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

// --- 하위 컴포넌트 ---

function NavButton({ active, onClick, icon, label, count }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors text-sm ${active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
      {icon} <span>{label}</span>
      {count > 0 && <span className="ml-auto bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{count}</span>}
    </button>
  );
}

function ListItem({ selected, onClick, img, title, subtitle, status, date }: any) {
  return (
    <div onClick={onClick} className={`p-4 rounded-xl border cursor-pointer hover:shadow-md transition-all flex gap-3 ${selected ? 'border-black bg-slate-50 ring-1 ring-black' : 'border-slate-100'}`}>
      {img && <img src={img} className="w-12 h-12 rounded-lg object-cover bg-slate-200"/>}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between mb-1">
          <div className="font-bold text-sm truncate">{title}</div>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${status==='pending'?'bg-yellow-100 text-yellow-700':status==='approved' || status==='active'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{status}</span>
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>{subtitle}</span>
          <span>{new Date(date).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: any) {
  return (
    <div className="flex justify-between border-b border-slate-100 pb-2">
      <span className="text-xs font-bold text-slate-400">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

function StatCard({ label, value, color }: any) {
  return (
    <div className={`p-6 rounded-2xl shadow-lg ${color}`}>
      <div className="text-xs font-bold opacity-70 mb-1">{label}</div>
      <div className="text-3xl font-black">{value}</div>
    </div>
  );
}