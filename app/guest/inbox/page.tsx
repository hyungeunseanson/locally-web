'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, MoreVertical, ChevronLeft, Phone } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/app/lib/supabase'; // ✅ 만능 열쇠 가져오기

// 메시지 타입 정의
interface Message {
  id: number;
  text: string;
  sender: string;
  created_at: string;
}

export default function GuestInboxPage() {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ✅ 1. 메시지 불러오기 (Real Data)
  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true }); // 과거순 정렬

    if (data) setMessages(data);
    if (error) console.error('에러:', error);
  };

  // 화면이 켜지면 메시지 가져오기
  useEffect(() => {
    fetchMessages();
    
    // (선택사항) 실시간 구독 기능은 다음 단계에서 추가 가능
    // 지금은 메시지 보내면 수동으로 목록을 다시 불러옵니다.
  }, []);

  // 스크롤 아래로
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ✅ 2. 메시지 보내기 (Real Data)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const textToSend = inputText;
    setInputText(''); // 입력창 비우기

    // 내 메시지 Supabase에 저장
    const { error } = await supabase
      .from('messages')
      .insert([
        { text: textToSend, sender: 'me' }
      ]);

    if (error) {
      alert('메시지 전송 실패!');
      console.error(error);
    } else {
      await fetchMessages(); // 목록 다시 불러오기
      
      // 🤖 호스트 자동 답장 (시뮬레이션)
      setTimeout(async () => {
        await supabase.from('messages').insert([
          { text: "확인했습니다! 잠시만 기다려주세요.", sender: 'host' }
        ]);
        fetchMessages();
      }, 1000);
    }
  };

  // 시간 포맷팅 함수 (오전 10:00)
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      
      {/* Header */}
      <header className="h-16 border-b border-slate-100 flex items-center justify-between px-4 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-3">
          <Link href="/guest/trips" className="p-2 hover:bg-slate-50 rounded-full">
            <ChevronLeft size={24} />
          </Link>
          <div className="relative">
             <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
               <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e" className="w-full h-full object-cover"/>
             </div>
             <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
          </div>
          <div>
            <h1 className="font-bold text-sm">Kenji (호스트)</h1>
            <p className="text-xs text-slate-500">보통 1시간 이내 응답</p>
          </div>
        </div>
        <div className="flex gap-2 text-slate-400">
          <button className="p-2 hover:bg-slate-50 rounded-full"><Phone size={20}/></button>
          <button className="p-2 hover:bg-slate-50 rounded-full"><MoreVertical size={20}/></button>
        </div>
      </header>

      {/* Message Area */}
      <main className="flex-1 overflow-y-auto p-4 bg-slate-50">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="text-center text-xs text-slate-400 my-4">대화 시작</div>
          
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[70%] rounded-2xl px-5 py-3 shadow-sm text-sm relative group ${
                msg.sender === 'me' 
                  ? 'bg-black text-white rounded-tr-none' 
                  : 'bg-white text-slate-900 border border-slate-200 rounded-tl-none'
              }`}>
                {msg.text}
                <span className={`text-[10px] absolute bottom-1 min-w-[50px] ${msg.sender === 'me' ? 'left-[-60px] text-right text-slate-400' : 'right-[-60px] text-left text-slate-400'}`}>
                  {formatTime(msg.created_at)}
                </span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-white border-t border-slate-100">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSendMessage} className="relative flex items-center gap-2">
            <button type="button" className="p-3 text-slate-400 hover:bg-slate-50 rounded-full transition-colors">
              <Paperclip size={20} />
            </button>
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="메시지를 입력하세요..." 
              className="flex-1 bg-slate-100 border-transparent focus:bg-white focus:border-black border rounded-full px-6 py-3 text-sm focus:outline-none transition-all"
            />
            <button 
              type="submit" 
              disabled={!inputText.trim()}
              className="p-3 bg-black text-white rounded-full hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}