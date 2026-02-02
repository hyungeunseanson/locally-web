'use client';

import React, { useState } from 'react';
import { 
  LayoutGrid, Users, CheckCircle, XCircle, AlertCircle, 
  Search, Bell, ChevronRight, MessageSquare, Filter
} from 'lucide-react';

// --- 가상의 등록 대기 데이터 ---
const PENDING_ITEMS = [
  {
    id: 1,
    title: "오사카 먹방 투어: 타코야키부터 야키니쿠까지",
    host: "Hiro Tanaka",
    category: "음식/투어",
    price: 65000,
    submittedAt: "2026. 10. 24 14:30",
    image: "https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?auto=format&fit=crop&q=80&w=800",
    status: "PENDING", // PENDING, APPROVED, REJECTED
    issues: []
  },
  {
    id: 2,
    title: "후지산 아래에서 즐기는 프라이빗 캠핑",
    host: "Yumi Kim",
    category: "자연/야외",
    price: 150000,
    submittedAt: "2026. 10. 24 09:15",
    image: "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&q=80&w=800",
    status: "PENDING",
    issues: ["사진 해상도 부족", "위치 정보 불명확"]
  }
];

export default function AdminDashboardPage() {
  const [items, setItems] = useState(PENDING_ITEMS);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [feedbackMode, setFeedbackMode] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  // 승인 처리
  const handleApprove = (id: number) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, status: 'APPROVED' } : item
    ));
    setSelectedItem(null);
    alert("승인 완료! 호스트에게 알림 메일이 발송되었습니다.");
  };

  // 보완 요청 처리
  const handleRequestChanges = () => {
    if (!feedbackText) return alert("보완 요청 사유를 입력해주세요.");
    alert(`보완 요청 전송 완료: "${feedbackText}"`);
    setItems(items.map(item => 
      item.id === selectedItem.id ? { ...item, status: 'REJECTED' } : item
    ));
    setSelectedItem(null);
    setFeedbackMode(false);
    setFeedbackText("");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      
      {/* 1. Admin Sidebar */}
      <aside className="w-20 md:w-64 bg-slate-900 text-white flex flex-col fixed h-full z-10">
        <div className="h-20 flex items-center justify-center md:justify-start md:px-6 border-b border-slate-800">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-900 font-black mr-0 md:mr-3">L</div>
          <span className="font-bold text-lg hidden md:block">Admin</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon={<LayoutGrid size={20}/>} label="대시보드" active />
          <NavItem icon={<CheckCircle size={20}/>} label="체험 심사" badge={items.filter(i => i.status === 'PENDING').length} />
          <NavItem icon={<Users size={20}/>} label="호스트 관리" />
          <NavItem icon={<AlertCircle size={20}/>} label="신고 내역" />
        </nav>
      </aside>

      {/* 2. Main Content */}
      <main className="flex-1 ml-20 md:ml-64 p-8">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-2xl font-bold mb-1">체험 승인 대기열</h1>
            <p className="text-slate-500 text-sm">꼼꼼한 심사가 퀄리티 높은 플랫폼을 만듭니다.</p>
          </div>
          <div className="flex gap-3">
             <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                <input type="text" placeholder="호스트 또는 체험 검색" className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm w-64 focus:outline-none focus:border-black"/>
             </div>
             <button className="p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-100 relative">
               <Bell size={20}/>
               <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>
             </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left: List of Pending Items */}
          <div className="lg:col-span-2 space-y-4">
             <div className="flex items-center gap-2 mb-2">
               <Filter size={16} className="text-slate-500"/>
               <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending List</span>
             </div>
             
             {items.filter(i => i.status === 'PENDING').length === 0 ? (
               <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
                 <CheckCircle size={48} className="mx-auto text-slate-200 mb-4"/>
                 <h3 className="text-lg font-bold text-slate-400">심사 대기중인 항목이 없습니다.</h3>
               </div>
             ) : (
               items.filter(i => i.status === 'PENDING').map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => { setSelectedItem(item); setFeedbackMode(false); }}
                  className={`bg-white border rounded-xl p-4 flex gap-4 cursor-pointer transition-all hover:shadow-md ${selectedItem?.id === item.id ? 'border-black ring-1 ring-black' : 'border-slate-200'}`}
                >
                  <div className="w-24 h-24 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={item.image} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{item.category}</span>
                      <span className="text-xs text-slate-400">{item.submittedAt}</span>
                    </div>
                    <h3 className="font-bold text-lg mb-1">{item.title}</h3>
                    <p className="text-sm text-slate-500 mb-2">Host: {item.host}</p>
                    <div className="flex gap-2">
                       {item.issues.map((issue, idx) => (
                         <span key={idx} className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 flex items-center gap-1">
                           <AlertCircle size={10}/> {issue}
                         </span>
                       ))}
                    </div>
                  </div>
                  <div className="flex items-center text-slate-300">
                    <ChevronRight />
                  </div>
                </div>
               ))
             )}
          </div>

          {/* Right: Review Detail Panel (Sticky) */}
          <div className="lg:col-span-1">
            {selectedItem ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sticky top-8 shadow-lg">
                 <div className="aspect-video bg-slate-100 rounded-xl mb-6 overflow-hidden">
                   <img src={selectedItem.image} className="w-full h-full object-cover" />
                 </div>
                 
                 <div className="mb-6">
                   <h2 className="text-xl font-bold mb-2">{selectedItem.title}</h2>
                   <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                     <div className="w-6 h-6 rounded-full bg-slate-200"></div>
                     <span>{selectedItem.host}</span>
                   </div>
                   <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">가격</span>
                        <span className="font-bold">₩{selectedItem.price.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">제출일</span>
                        <span className="font-bold">{selectedItem.submittedAt}</span>
                      </div>
                   </div>
                 </div>

                 {/* Action Buttons */}
                 {!feedbackMode ? (
                   <div className="space-y-3">
                     <button 
                       onClick={() => handleApprove(selectedItem.id)}
                       className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                     >
                       <CheckCircle size={18} /> 승인하기 (Approve)
                     </button>
                     <button 
                       onClick={() => setFeedbackMode(true)}
                       className="w-full bg-white border-2 border-slate-200 hover:border-black text-slate-900 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                     >
                       <MessageSquare size={18} /> 보완 요청 (Reject)
                     </button>
                   </div>
                 ) : (
                   <div className="animate-in fade-in slide-in-from-bottom-2">
                     <label className="text-sm font-bold block mb-2">보완 요청 사유 작성</label>
                     <textarea 
                       className="w-full h-32 border border-slate-300 rounded-xl p-3 text-sm focus:border-black focus:outline-none resize-none mb-3"
                       placeholder="예) 사진이 너무 어두워서 체험의 분위기가 잘 살지 않습니다. 밝은 야외 사진으로 교체해주세요."
                       autoFocus
                       value={feedbackText}
                       onChange={(e) => setFeedbackText(e.target.value)}
                     />
                     <div className="flex gap-2">
                       <button 
                         onClick={() => setFeedbackMode(false)}
                         className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200"
                       >
                         취소
                       </button>
                       <button 
                         onClick={handleRequestChanges}
                         className="flex-1 bg-black text-white font-bold py-3 rounded-xl hover:bg-slate-800"
                       >
                         전송하기
                       </button>
                     </div>
                   </div>
                 )}

              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl p-8">
                <Search size={32} className="mb-2 opacity-50"/>
                <p className="text-sm">왼쪽 목록에서<br/>심사할 항목을 선택하세요.</p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, badge }: any) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
       <div className="flex items-center gap-3">
         {icon}
         <span className="hidden md:block text-sm font-medium">{label}</span>
       </div>
       {badge > 0 && (
         <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full hidden md:block">{badge}</span>
       )}
    </div>
  )
}