'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { 
  ClipboardList, CheckSquare, FileText, Plus, Trash2, 
  User, Clock, CheckCircle2, Circle, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Task {
  id: string;
  created_at: string;
  type: 'DAILY_LOG' | 'TODO' | 'MEMO';
  content: string;
  is_completed: boolean;
  assignee: string | null;
  author_id: string;
  author_name: string;
}

export default function TeamTab() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newLog, setNewLog] = useState('');
  const [newTodo, setNewTodo] = useState('');
  const [newMemo, setNewMemo] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchTasks();
    getCurrentUser();

    const channel = supabase
      .channel('admin_tasks_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_tasks' }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();
      setCurrentUser({ ...user, name: profile?.name || user.email?.split('@')[0] });
    }
  };

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('admin_tasks')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setTasks(data);
    if (error) console.error('Error fetching tasks:', error);
  };

  const addTask = async (type: 'DAILY_LOG' | 'TODO' | 'MEMO', content: string) => {
    if (!content.trim() || !currentUser) return;

    const { error } = await supabase.from('admin_tasks').insert({
      type,
      content,
      author_id: currentUser.id,
      author_name: currentUser.name,
      is_completed: false
    });

    if (error) {
      alert('저장에 실패했습니다.');
    } else {
      if (type === 'DAILY_LOG') setNewLog('');
      if (type === 'TODO') setNewTodo('');
      if (type === 'MEMO') setNewMemo('');
    }
  };

  const toggleTodo = async (id: string, isCompleted: boolean) => {
    await supabase
      .from('admin_tasks')
      .update({ is_completed: !isCompleted })
      .eq('id', id);
  };

  const deleteTask = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await supabase.from('admin_tasks').delete().eq('id', id);
  };

  const dailyLogs = tasks.filter(t => t.type === 'DAILY_LOG');
  const todos = tasks.filter(t => t.type === 'TODO');
  const memos = tasks.filter(t => t.type === 'MEMO');

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="text-rose-500" />
            팀 협업 보드 (Team Workspace)
          </h2>
          <p className="text-sm text-slate-500 mt-1">팀원들과 업무 진행 상황을 공유하고 할 일을 관리하세요.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
        
        {/* Daily Logs Section */}
        <div className="flex flex-col bg-slate-50/50 rounded-2xl border border-slate-100 p-4 overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-blue-500" />
            <h3 className="font-bold text-slate-800">Daily Logs</h3>
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{dailyLogs.length}</span>
          </div>
          
          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={newLog}
              onChange={(e) => setNewLog(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask('DAILY_LOG', newLog)}
              placeholder="오늘의 업무 진행 상황..."
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
            <button 
              onClick={() => addTask('DAILY_LOG', newLog)}
              className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
            {dailyLogs.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">기록된 업무 일지가 없습니다.</div>
            ) : (
              dailyLogs.map(log => (
                <div key={log.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm group">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-tight">{log.author_name}</span>
                    <span className="text-[10px] text-slate-400">{format(new Date(log.created_at), 'HH:mm', { locale: ko })}</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{log.content}</p>
                  {log.author_id === currentUser?.id && (
                    <button 
                      onClick={() => deleteTask(log.id)}
                      className="mt-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Todo List Section */}
        <div className="flex flex-col bg-slate-50/50 rounded-2xl border border-slate-100 p-4 overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <CheckSquare size={18} className="text-green-500" />
            <h3 className="font-bold text-slate-800">To-do List</h3>
            <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">
              {todos.filter(t => !t.is_completed).length} remaining
            </span>
          </div>

          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask('TODO', newTodo)}
              placeholder="새로운 할 일 추가..."
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
            <button 
              onClick={() => addTask('TODO', newTodo)}
              className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
            {todos.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">등록된 할 일이 없습니다.</div>
            ) : (
              todos.map(todo => (
                <div 
                  key={todo.id} 
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    todo.is_completed ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-100 shadow-sm'
                  }`}
                >
                  <button 
                    onClick={() => toggleTodo(todo.id, todo.is_completed)}
                    className={todo.is_completed ? 'text-green-500' : 'text-slate-300 hover:text-slate-400'}
                  >
                    {todo.is_completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </button>
                  <div className="flex-1">
                    <p className={`text-sm ${todo.is_completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                      {todo.content}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-400 font-medium">{todo.author_name}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteTask(todo.id)}
                    className="text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Shared Memos Section */}
        <div className="flex flex-col bg-slate-50/50 rounded-2xl border border-slate-100 p-4 overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={18} className="text-amber-500" />
            <h3 className="font-bold text-slate-800">Shared Memos</h3>
          </div>

          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={newMemo}
              onChange={(e) => setNewMemo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask('MEMO', newMemo)}
              placeholder="공유가 필요한 중요한 메모..."
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
            <button 
              onClick={() => addTask('MEMO', newMemo)}
              className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
            {memos.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">저장된 메모가 없습니다.</div>
            ) : (
              memos.map(memo => (
                <div key={memo.id} className="bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-sm relative group">
                  <p className="text-sm text-amber-900 leading-relaxed mb-2">{memo.content}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-amber-700 font-bold uppercase">{memo.author_name}</span>
                    <button 
                      onClick={() => deleteTask(memo.id)}
                      className="text-amber-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
