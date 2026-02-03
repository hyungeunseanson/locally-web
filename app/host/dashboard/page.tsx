'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { List, MessageSquare, Plus, Calendar, Edit, Send, User } from 'lucide-react';
import SiteHeader from '@/app/components/SiteHeader';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function HostDashboard() {
  const supabase = createClient();
  const router = useRouter();
  const [experiences, setExperiences] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('experiences');
  const [user, setUser] = useState<any>(null);

  // 채팅 상태
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }
      setUser(user);

      // 1. 내 체험
      const { data: expData } = await supabase.from('experiences').select('*, bookings(count)').eq('host_id', user.id).order('created_at', { ascending: false });
      if (expData) setExperiences(expData);

      // 2. 문의 내역 (JOIN 문법을 안전하게 수정)
      // sender 정보를 가져오되, 없어도 에러 안나게 처리
      const { data: inqData, error } = await supabase
        .from('inquiries')
        .select(`
          *,
          experiences (title),
          sender:user_id (email)
        `)
        .eq('host_id', user.id)
        .order('created_at', { ascending: false });
      
      if (inqData) setInquiries(inqData);
    };
    fetchData();
  }, []);

  const loadChat = async (inq: any) => {
    setSelectedInquiry(inq);
    const { data } = await supabase.from('inquiry_messages').select('*').eq('inquiry_id', inq.id).order('created_at', { ascending: true });
    setChatMessages(data || []);
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    const { error } = await supabase.from('inquiry_messages').insert([{
      inquiry_id: selectedInquiry.id, sender_id: user.id, content: replyText
    }]);
    if (!error) { setReplyText(''); loadChat(selectedInquiry); }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
        
        {/* 사이드바 */}
        <aside className="w-64 hidden md:block shrink-0">
           <div className="sticky top-24 space-y-2">
              <button onClick={() => setActiveTab('experiences')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab==='experiences' ? 'bg-slate-100 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}>
                 <List size={20}/> 내 체험 관리
              </button>
              <button onClick={() => setActiveTab('inquiries')} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab==='inquiries' ? 'bg-slate-100 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}>
                 <MessageSquare size={20}/> 문의함 ({inquiries.length})
              </button>
           </div>
        </aside>

        {/* 메인 */}
        <main className="flex-1">
          <div className="flex justify-between items-end mb-8">
            <h1 className="text-3xl font-black">{activeTab === 'experiences' ? '내 체험 관리' : '문의 메시지'}</h1>
            {activeTab === 'experiences' && (
              <Link href="/host/create">
                <button className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-transform"><Plus size={18} /> 새 체험 등록</button>
              </Link>
            )}
          </div>

          {activeTab === 'experiences' ? (
            <div className="grid gap-6">
              {experiences.length === 0 && <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">등록된 체험이 없습니다.</div>}
              {experiences.map((exp) => (
                <div key={exp.id} className="bg-white border rounded-2xl p-6 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex gap-4 items-center">
                    {exp.image_url ? <img src={exp.image_url} className="w-16 h-16 rounded-lg object-cover bg-slate-100" /> : <div className="w-16 h-16 bg-slate-200 rounded-lg"/>}
                    <div>
                      <h2 className="font-bold text-lg">{exp.title}</h2>
                      <p className="text-sm text-slate-500">₩{Number(exp.price).toLocaleString()} · 예약 {exp.bookings?.[0]?.count || 0}건</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/host/experiences/${exp.id}/dates`}><button className="px-4 py-2 border rounded-lg text-sm font-bold hover:bg-slate-50 flex items-center gap-2"><Calendar size={16}/> 일정</button></Link>
                    <Link href={`/host/experiences/${exp.id}/edit`}><button className="px-4 py-2 border rounded-lg text-sm font-bold hover:bg-slate-50 flex items-center gap-2"><Edit size={16}/> 수정</button></Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-6 h-[600px]">
              {/* 목록 */}
              <div className="w-1/3 border-r border-slate-200 pr-4 overflow-y-auto">
                {inquiries.map((inq) => (
                  <div key={inq.id} onClick={() => loadChat(inq)} className={`p-4 rounded-xl cursor-pointer mb-2 ${selectedInquiry?.id === inq.id ? 'bg-slate-100 border-black' : 'hover:bg-slate-50'} border border-transparent`}>
                    <div className="text-xs font-bold text-slate-500 mb-1">{inq.experiences?.title || '삭제된 체험'}</div>
                    <div className="font-bold text-sm truncate">{inq.content}</div>
                    <div className="text-xs text-slate-400 mt-2 flex justify-between">
                       <span>{inq.sender?.email || 'Guest'}</span>
                       <span>{new Date(inq.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* 채팅 */}
              <div className="flex-1 flex flex-col bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                {selectedInquiry ? (
                  <>
                    <div className="p-4 border-b border-slate-200 bg-white font-bold">{selectedInquiry.experiences?.title}</div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {/* 첫 메시지 */}
                      <div className="flex justify-start">
                         <div className="w-8 h-8 bg-slate-200 rounded-full mr-2 flex items-center justify-center flex-shrink-0"><User size={16}/></div>
                         <div className="bg-white border border-slate-200 p-3 rounded-xl rounded-tl-none max-w-[80%] text-sm shadow-sm">
                            {selectedInquiry.content}
                         </div>
                      </div>
                      {/* 대화 내용 */}
                      {chatMessages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                          {msg.sender_id !== user.id && <div className="w-8 h-8 bg-slate-200 rounded-full mr-2 flex items-center justify-center flex-shrink-0"><User size={16}/></div>}
                          <div className={`p-3 rounded-xl max-w-[80%] text-sm shadow-sm ${msg.sender_id === user.id ? 'bg-black text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none'}`}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 bg-white border-t border-slate-200 flex gap-2">
                      <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="답장 입력..." className="flex-1 border border-slate-300 rounded-xl px-4 py-2 focus:outline-none focus:border-black" onKeyDown={(e)=>e.key==='Enter'&&handleSendReply()}/>
                      <button onClick={handleSendReply} className="bg-black text-white p-2.5 rounded-xl"><Send size={18}/></button>
                    </div>
                  </>
                ) : <div className="flex-1 flex items-center justify-center text-slate-400">대화를 선택하세요.</div>}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}