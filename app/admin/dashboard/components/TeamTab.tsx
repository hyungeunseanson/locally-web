'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { 
  ClipboardList, CheckSquare, FileText, Plus, Trash2, 
  Clock, CheckCircle2, Circle, X, NotebookPen, ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Task {
  id: string;
  created_at: string;
  type: 'DAILY_LOG' | 'TODO' | 'MEMO';
  content: string;
  is_completed: boolean;
  author_id: string;
  author_name: string;
  metadata: {
    note?: string;
    status_text?: 'Done' | 'Progress';
  };
}

export default function TeamTab() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newLog, setNewLog] = useState({ task: '', note: '', status: 'Done' as 'Done' | 'Progress' });
  const [newTodo, setNewTodo] = useState('');
  const [newMemo, setNewMemo] = useState('');
  const [showMemos, setShowMemos] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    setIsClient(true);
    fetchTasks();
    getCurrentUser();

    // 실시간 구독 설정
    const channel = supabase
      .channel('admin_tasks_realtime_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_tasks' }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setCurrentUser({ id: user.id, name: profile?.name || profile?.full_name || user.email?.split('@')[0] });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTasks = async () => {
    const { data } = await supabase.from('admin_tasks').select('*').order('created_at', { ascending: false });
    if (data) setTasks(data);
  };

  const addDailyLog = async () => {
    if (!newLog.task.trim() || !currentUser) return;
    await supabase.from('admin_tasks').insert({
      type: 'DAILY_LOG',
      content: newLog.task,
      author_id: currentUser.id,
      author_name: currentUser.name,
      is_completed: newLog.status === 'Done',
      metadata: { note: newLog.note, status_text: newLog.status }
    });
    setNewLog({ task: '', note: '', status: 'Done' });
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    await supabase.from('admin_tasks').update({ 
      is_completed: nextStatus,
      metadata: { status_text: nextStatus ? 'Done' : 'Progress' }
    }).eq('id', id);
  };

  const addTodo = async () => {
    if (!newTodo.trim() || !currentUser) return;
    await supabase.from('admin_tasks').insert({
      type: 'TODO', content: newTodo, author_id: currentUser.id, author_name: currentUser.name, is_completed: false
    });
    setNewTodo('');
  };

  const addMemo = async () => {
    if (!newMemo.trim() || !currentUser) return;
    await supabase.from('admin_tasks').insert({
      type: 'MEMO', content: newMemo, author_id: currentUser.id, author_name: currentUser.name
    });
    setNewMemo('');
  };

  const deleteTask = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await supabase.from('admin_tasks').delete().eq('id', id);
  };

  // 클라이언트 사이드 렌더링 보장 (Hydration 500 에러 방지)
  if (!isClient) return null;

  const dailyLogs = tasks.filter(t => t.type === 'DAILY_LOG');
  const todos = tasks.filter(t => t.type === 'TODO');
  const memos = tasks.filter(t => t.type === 'MEMO');

  return (
    <div className="flex flex-col h-full gap-6 relative">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ClipboardList className="text-rose-500" /> 팀 협업 보드
        </h2>
        <button onClick={() => setShowMemos(!showMemos)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${showMemos ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          <NotebookPen size={18} /> 공유 메모장 {memos.length > 0 && `(${memos.length})`}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">
        {/* Left: Daily Logs Table */}
        <div className="flex-[2.5] flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Clock size={18} className="text-blue-500" /> Daily Logs</h3>
          </div>

          {/* Log Input Row */}
          <div className="p-3 bg-blue-50/30 border-b border-slate-100 flex items-center gap-2">
            <div className="flex-[3]">
              <input type="text" placeholder="Current Task" value={newLog.task} onChange={e => setNewLog({...newLog, task: e.target.value})} className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500/20 outline-none" />
            </div>
            <div className="flex-[1] min-w-[100px]">
              <select value={newLog.status} onChange={e => setNewLog({...newLog, status: e.target.value as any})} className="w-full text-sm px-2 py-2 rounded-lg border border-slate-200 outline-none bg-white">
                <option value="Done">Done</option>
                <option value="Progress">Progress</option>
              </select>
            </div>
            <div className="flex-[3]">
              <input type="text" placeholder="Issue / Note" value={newLog.note} onChange={e => setNewLog({...newLog, note: e.target.value})} onKeyDown={e => e.key === 'Enter' && addDailyLog()} className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500/20 outline-none" />
            </div>
            <button onClick={addDailyLog} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors whitespace-nowrap">기록</button>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-4 py-3 w-28">Date</th>
                  <th className="px-4 py-3 w-20">Name</th>
                  <th className="px-4 py-3">Current Task</th>
                  <th className="px-4 py-3 w-24 text-center">Status</th>
                  <th className="px-4 py-3">Issue / Note</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dailyLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50 group">
                    <td className="px-4 py-3 text-[11px] text-slate-500 font-medium whitespace-nowrap">{format(new Date(log.created_at), 'yyyy-MM-dd')}</td>
                    <td className="px-4 py-3"><span className="text-xs font-bold text-rose-500 whitespace-nowrap">{log.author_name}</span></td>
                    <td className="px-4 py-3"><p className="text-sm text-slate-700 font-medium">{log.content}</p></td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        onClick={() => toggleStatus(log.id, log.is_completed)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap min-w-[65px] transition-colors ${
                          log.is_completed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {log.is_completed ? 'Done' : 'Progress'}
                      </button>
                    </td>
                    <td className="px-4 py-3"><p className="text-xs text-slate-500 italic">{log.metadata?.note || '-'}</p></td>
                    <td className="px-4 py-3 text-right">
                      {log.author_id === currentUser?.id && (
                        <button onClick={() => deleteTask(log.id)} className="text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Todo List */}
        <div className="flex-1 flex flex-col bg-slate-50/50 rounded-2xl border border-slate-200 p-4 overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 mb-4"><CheckSquare size={18} className="text-green-500" /><h3 className="font-bold text-slate-800">To-do List</h3></div>
          <div className="flex gap-2 mb-4">
            <input type="text" value={newTodo} onChange={e => setNewTodo(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTodo()} placeholder="할 일 추가..." className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none" />
            <button onClick={addTodo} className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-800"><Plus size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {todos.map(todo => (
              <div key={todo.id} className={`flex items-center gap-3 p-3 rounded-xl border group transition-all ${todo.is_completed ? 'bg-slate-100/50 border-slate-100' : 'bg-white border-slate-200 shadow-sm'}`}>
                <button onClick={() => toggleStatus(todo.id, todo.is_completed)} className={todo.is_completed ? 'text-green-500' : 'text-slate-300'}>{todo.is_completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}</button>
                <div className="flex-1"><p className={`text-sm ${todo.is_completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{todo.content}</p><span className="text-[10px] text-slate-400 font-medium">{todo.author_name}</span></div>
                <button onClick={() => deleteTask(todo.id)} className="text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Memo Panel */}
      {showMemos && (
        <div className="absolute top-0 right-0 w-80 h-full bg-amber-50 border-l border-amber-200 shadow-2xl z-20 flex flex-col animate-in slide-in-from-right duration-300">
          <div className="p-4 border-b border-amber-200 flex items-center justify-between bg-amber-100/50">
            <h3 className="font-bold text-amber-900 flex items-center gap-2"><FileText size={18} /> 공유 메모장</h3>
            <button onClick={() => setShowMemos(false)} className="text-amber-700 hover:bg-amber-200 p-1 rounded-md"><X size={20} /></button>
          </div>
          <div className="p-4 bg-amber-100/30">
            <textarea placeholder="메모 입력..." value={newMemo} onChange={e => setNewMemo(e.target.value)} className="w-full text-sm p-3 rounded-lg border border-amber-200 outline-none min-h-[80px] resize-none" />
            <button onClick={addMemo} className="w-full mt-2 bg-amber-600 text-white py-2 rounded-lg font-bold text-xs hover:bg-amber-700">추가</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {memos.map(memo => (
              <div key={memo.id} className="bg-white p-3 rounded-xl border border-amber-100 shadow-sm group">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{memo.content}</p>
                <div className="mt-2 pt-2 border-t border-slate-50 flex justify-between items-center"><span className="text-[10px] font-bold text-amber-700 uppercase">{memo.author_name}</span><button onClick={() => deleteTask(memo.id)} className="text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
