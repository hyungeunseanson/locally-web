'use client';

import React, { useEffect, useState } from 'react';
import { User, Send } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';

export default function InquiryChat() {
  const supabase = createClient();
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data } = await supabase.from('inquiries').select(`*, experiences (title)`).eq('host_id', user.id).order('created_at', { ascending: false });
      if (data) setInquiries(data);
    };
    fetchData();
  }, []);

  const loadChat = async (inq: any) => {
    setSelectedInquiry(inq);
    const { data } = await supabase.from('inquiry_messages').select('*').eq('inquiry_id', inq.id).order('created_at', { ascending: true });
    setChatMessages(data || []);
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedInquiry) return;
    const { error } = await supabase.from('inquiry_messages').insert([{
      inquiry_id: selectedInquiry.id, sender_id: currentUserId, content: replyText
    }]);
    if (!error) { setReplyText(''); loadChat(selectedInquiry); }
  };

  return (
    <div className="flex gap-6 h-[600px]">
      <div className="w-1/3 border-r border-slate-200 pr-4 overflow-y-auto">
        {inquiries.map((inq) => (
          <div key={inq.id} onClick={() => loadChat(inq)} className={`p-4 rounded-xl cursor-pointer mb-2 ${selectedInquiry?.id === inq.id ? 'bg-slate-100 border-black' : 'hover:bg-slate-50'} border border-transparent`}>
            <div className="text-xs font-bold text-slate-500 mb-1">{inq.experiences?.title || '삭제된 체험'}</div>
            <div className="font-bold text-sm truncate">{inq.content}</div>
            <div className="text-xs text-slate-400 mt-2 flex justify-between"><span>Guest</span><span>{new Date(inq.created_at).toLocaleDateString()}</span></div>
          </div>
        ))}
      </div>
      <div className="flex-1 flex flex-col bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
        {selectedInquiry ? (
          <>
            <div className="p-4 border-b border-slate-200 bg-white font-bold">{selectedInquiry.experiences?.title}</div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex justify-start">
                 <div className="w-8 h-8 bg-slate-200 rounded-full mr-2 flex items-center justify-center flex-shrink-0"><User size={16}/></div>
                 <div className="bg-white border border-slate-200 p-3 rounded-xl rounded-tl-none max-w-[80%] text-sm shadow-sm">{selectedInquiry.content}</div>
              </div>
              {chatMessages.map((msg) => {
                const isMe = msg.sender_id === currentUserId;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {!isMe && <div className="w-8 h-8 bg-slate-200 rounded-full mr-2 flex items-center justify-center flex-shrink-0"><User size={16}/></div>}
                    <div className={`p-3 rounded-xl max-w-[80%] text-sm shadow-sm ${isMe ? 'bg-black text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none'}`}>
                      {msg.content}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="p-4 bg-white border-t border-slate-200 flex gap-2">
              <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="답장 입력..." className="flex-1 border border-slate-300 rounded-xl px-4 py-2 focus:outline-none focus:border-black" onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSendReply()}/>
              <button onClick={handleSendReply} className="bg-black text-white p-2.5 rounded-xl"><Send size={18}/></button>
            </div>
          </>
        ) : <div className="flex-1 flex items-center justify-center text-slate-400">대화를 선택하세요.</div>}
      </div>
    </div>
  );
}