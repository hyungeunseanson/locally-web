'use client';

import React, { useEffect, useState } from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { MessageSquare, Send, User } from 'lucide-react';

export default function GuestInboxPage() {
  const supabase = createClient();
  const router = useRouter();
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const fetchInquiries = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }
      setUser(user);

      // ✅ 수정: 호스트 이메일 join 제거 (에러 방지) -> 체험 정보만 가져옴
      const { data } = await supabase
        .from('inquiries')
        .select(`
          *,
          experiences (title, image_url)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (data) setInquiries(data);
    };
    fetchInquiries();
  }, []);

  const loadMessages = async (inq: any) => {
    setSelectedInquiry(inq);
    const { data } = await supabase
      .from('inquiry_messages')
      .select('*')
      .eq('inquiry_id', inq.id)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const { error } = await supabase.from('inquiry_messages').insert([{
      inquiry_id: selectedInquiry.id, sender_id: user.id, content: inputText
    }]);
    if (!error) { setInputText(''); loadMessages(selectedInquiry); }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-6 py-8 h-[calc(100vh-80px)] flex flex-col">
        <h1 className="text-3xl font-black mb-6">메시지함</h1>
        <div className="flex-1 flex gap-8 border border-slate-200 rounded-2xl overflow-hidden shadow-lg bg-white">
          <div className="w-1/3 border-r border-slate-200 overflow-y-auto bg-slate-50">
            {inquiries.length === 0 && <div className="p-8 text-center text-slate-400">보낸 메시지가 없습니다.</div>}
            {inquiries.map((inq) => (
              <div key={inq.id} onClick={() => loadMessages(inq)} className={`p-5 cursor-pointer border-b border-slate-100 hover:bg-white transition-colors ${selectedInquiry?.id === inq.id ? 'bg-white border-l-4 border-l-black' : ''}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                    {inq.experiences?.image_url && <img src={inq.experiences.image_url} className="w-full h-full object-cover"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{inq.experiences?.title || '체험 정보 없음'}</div>
                    <div className="text-xs text-slate-500">문의 날짜: {new Date(inq.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <p className="text-sm text-slate-600 line-clamp-1">"{inq.content}"</p>
              </div>
            ))}
          </div>
          <div className="flex-1 flex flex-col bg-white">
            {selectedInquiry ? (
              <>
                <div className="p-4 border-b border-slate-100 font-bold text-lg">{selectedInquiry.experiences?.title}</div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
                  <div className="flex justify-end">
                    <div className="bg-black text-white p-3 rounded-2xl rounded-tr-none max-w-[70%] text-sm shadow-sm">{selectedInquiry.content}</div>
                  </div>
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                      {msg.sender_id !== user.id && <div className="w-8 h-8 bg-slate-200 rounded-full mr-2 flex items-center justify-center flex-shrink-0"><User size={16}/></div>}
                      <div className={`p-3 rounded-2xl max-w-[70%] text-sm shadow-sm ${msg.sender_id === user.id ? 'bg-black text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none'}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-slate-100 flex gap-3 bg-white">
                  <input className="flex-1 bg-slate-100 rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-black" placeholder="메시지 입력..." value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&handleSend()}/>
                  <button onClick={handleSend} className="bg-black text-white p-3 rounded-xl"><Send size={20}/></button>
                </div>
              </>
            ) : <div className="flex-1 flex flex-col items-center justify-center text-slate-300"><MessageSquare size={48} className="mb-4 opacity-20"/><p>대화를 선택하세요.</p></div>}
          </div>
        </div>
      </main>
    </div>
  );
}