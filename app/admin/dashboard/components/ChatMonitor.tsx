'use client';

import React, { useState } from 'react';
import { Search, MessageCircle, User, ChevronRight, Calendar } from 'lucide-react';

export default function ChatMonitor({ messages = [] }: { messages: any[] }) {
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const safeMessages = Array.isArray(messages) ? messages : [];
  const filteredMessages = safeMessages.filter(msg => 
    (msg.content || '').includes(searchTerm) || 
    (msg.sender_name || '').includes(searchTerm) || 
    (msg.receiver_name || '').includes(searchTerm)
  );

  return (
    <div className="flex h-full gap-6">
      <div className="w-1/3 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <MessageCircle size={18}/> 메시지함
            </h3>
            <span className="text-xs font-bold bg-slate-200 px-2 py-1 rounded-full text-slate-600">{filteredMessages.length}</span>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input 
              type="text" 
              placeholder="검색..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-black transition-all"
            />
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {filteredMessages.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">메시지가 없습니다.</div>
          ) : (
            filteredMessages.map((msg) => (
              <div 
                key={msg.id} 
                onClick={() => setSelectedChat(msg)}
                className={`p-4 border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50 ${selectedChat?.id === msg.id ? 'bg-slate-50 border-l-4 border-l-black' : 'border-l-4 border-l-transparent'}`}
              >
                <div className="flex justify-between mb-1">
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-700">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded">{msg.sender_name || 'User'}</span>
                    <ChevronRight size={10} className="text-slate-300"/>
                    <span className="bg-black text-white px-1.5 py-0.5 rounded">{msg.receiver_name || 'Host'}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{new Date(msg.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2">{msg.content}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
        {selectedChat ? (
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-lg">{selectedChat.sender_name}</span>
                  <span className="text-slate-300 text-xs">to</span>
                  <span className="font-bold text-lg">{selectedChat.receiver_name}</span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1"><Calendar size={12}/> {new Date(selectedChat.created_at).toLocaleString()}</div>
              </div>
            </div>
            <div className="flex-1 p-6 overflow-y-auto bg-slate-50 space-y-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0"><User size={20} className="text-slate-500"/></div>
                <div className="space-y-1">
                  <div className="text-xs text-slate-500 font-bold ml-1">{selectedChat.sender_name}</div>
                  <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm text-sm leading-relaxed max-w-lg">{selectedChat.content}</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <MessageCircle size={64} className="mb-4 opacity-20"/>
            <p className="font-medium">대화를 선택해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}