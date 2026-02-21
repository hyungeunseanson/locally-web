'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { 
  ClipboardList, CheckSquare, FileText, Plus, Trash2, 
  Clock, CheckCircle2, Circle, X, NotebookPen, MessageCircle, Send
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { AdminTask, AdminComment } from '@/app/types/admin';

export default function TeamTab() {
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [newLog, setNewLog] = useState({ task: '', note: '' });
  const [newTodo, setNewTodo] = useState('');
  const [newMemo, setNewMemo] = useState('');
  const [showMemos, setShowMemos] = useState(false);
  const [expandedTodo, setExpandedTodo] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);
  const [lastViewed, setLastViewed] = useState<string>(new Date(0).toISOString());
  
  const threadRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    setIsClient(true);
    const viewed = localStorage.getItem('last_viewed_team') || new Date(0).toISOString();
    setLastViewed(viewed);
    
    // 방문 시간 업데이트
    localStorage.setItem('last_viewed_team', new Date().toISOString());

    fetchTasks();
    fetchComments();
    getCurrentUser();

    const channel = supabase.channel('team_workspace_realtime_final')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_tasks' }, () => { fetchTasks(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_task_comments' }, () => { fetchComments(); })
      .subscribe();

    // 외부 클릭 시 댓글 창 닫기
    const handleClickOutside = (event: MouseEvent) => {
      if (threadRef.current && !threadRef.current.contains(event.target as Node)) {
        setExpandedTodo(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => { 
      supabase.removeChannel(channel); 
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setCurrentUser({ id: user.id, name: profile?.name || profile?.full_name || user.email?.split('@')[0] });
    }
  };

  const fetchTasks = async () => {
    const { data } = await supabase.from('admin_tasks').select('*').order('created_at', { ascending: false });
    if (data) setTasks(data);
  };

  const fetchComments = async () => {
    const { data } = await supabase.from('admin_task_comments').select('*').order('created_at', { ascending: true });
    if (data) setComments(data);
  };

  const addDailyLog = async () => {
    if (!newLog.task.trim() || !currentUser) return;
    await supabase.from('admin_tasks').insert({
      type: 'DAILY_LOG',
      content: newLog.task,
      author_id: currentUser.id,
      author_name: currentUser.name,
      is_completed: false,
      metadata: { note: newLog.note, status_text: 'Progress' }
    });
    setNewLog({ task: '', note: '' });
  };

  const addComment = async (taskId: string) => {
    if (!newComment.trim() || !currentUser) return;
    await supabase.from('admin_task_comments').insert({
      task_id: taskId,
      content: newComment,
      author_id: currentUser.id,
      author_name: currentUser.name
    });
    setNewComment('');
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    await supabase.from('admin_tasks').update({ 
      is_completed: nextStatus,
      metadata: { status_text: nextStatus ? 'Done' : 'Progress' }
    }).eq('id', id);
  };

  const deleteTask = async (table: string, id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await supabase.from(table).delete().eq('id', id);
  };

  if (!isClient) return null;

  const dailyLogs = tasks.filter(t => t.type === 'DAILY_LOG');
  const todos = tasks.filter(t => t.type === 'TODO');
  const memos = tasks.filter(t => t.type === 'MEMO');

  const isNew = (createdAt: string) => new Date(createdAt) > new Date(lastViewed);

  return (
    <div className="flex flex-col h-full gap-6 relative">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ClipboardList className="text-rose-500" /> 팀 협업 보드
        </h2>
        <button onClick={() => setShowMemos(!showMemos)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${showMemos ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          <NotebookPen size={18} /> 공유 메모장 {memos.length > 0 && `(${memos.length})`}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">
        {/* Left: Daily Logs (N 제거됨) */}
        <div className="flex-[2.5] flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Clock size={18} className="text-blue-500" /> Daily Logs</h3>
          </div>

          <div className="p-3 bg-blue-50/30 border-b border-slate-100 flex items-center gap-2">
            <div className="flex-[4]">
              <input type="text" placeholder="Current Task" value={newLog.task} onChange={e => setNewLog({...newLog, task: e.target.value})} className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500/20 outline-none" />
            </div>
            <div className="flex-[3]">
              <input type="text" placeholder="Issue / Note" value={newLog.note} onChange={e => setNewLog({...newLog, note: e.target.value})} onKeyDown={e => e.key === 'Enter' && addDailyLog()} className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500/20 outline-none" />
            </div>
            <button onClick={addDailyLog} className="px-5 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors">기록</button>
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
                      <button onClick={(e) => { e.stopPropagation(); toggleStatus(log.id, log.is_completed); }} className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap min-w-[65px] transition-colors ${log.is_completed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{log.is_completed ? 'Done' : 'Progress'}</button>
                    </td>
                    <td className="px-4 py-3"><p className="text-xs text-slate-500 italic">{log.metadata?.note || '-'}</p></td>
                    <td className="px-4 py-3 text-right">
                      {log.author_id === currentUser?.id && (
                        <button onClick={(e) => { e.stopPropagation(); deleteTask('admin_tasks', log.id); }} className="text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Todo List (Container Click To Expand) */}
        <div className="flex-1 flex flex-col bg-slate-50/50 rounded-2xl border border-slate-200 p-4 overflow-hidden shadow-sm" ref={threadRef}>
          <div className="flex items-center gap-2 mb-4"><CheckSquare size={18} className="text-green-500" /><h3 className="font-bold text-slate-800">To-do List</h3></div>
          <div className="flex gap-2 mb-4">
            <input type="text" value={newTodo} onChange={e => setNewTodo(e.target.value)} onKeyDown={e => e.key === 'Enter' && (async () => {
              if (!newTodo.trim() || !currentUser) return;
              await supabase.from('admin_tasks').insert({ type: 'TODO', content: newTodo, author_id: currentUser.id, author_name: currentUser.name, is_completed: false });
              setNewTodo('');
            })()} placeholder="할 일 추가..." className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none" />
            <button onClick={async () => {
              if (!newTodo.trim() || !currentUser) return;
              await supabase.from('admin_tasks').insert({ type: 'TODO', content: newTodo, author_id: currentUser.id, author_name: currentUser.name, is_completed: false });
              setNewTodo('');
            }} className="bg-slate-900 text-white p-2 rounded-lg"><Plus size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {todos.map(todo => {
              const taskComments = comments.filter(c => c.task_id === todo.id);
              const hasNewComment = taskComments.some(c => isNew(c.created_at));
              const isTodoNew = isNew(todo.created_at);
              
              return (
                <div key={todo.id} className="flex flex-col gap-2">
                  <div 
                    onClick={() => setExpandedTodo(expandedTodo === todo.id ? null : todo.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border group transition-all cursor-pointer ${expandedTodo === todo.id ? 'border-blue-300 ring-2 ring-blue-500/10' : ''} ${todo.is_completed ? 'bg-slate-100/50 border-slate-100' : 'bg-white border-slate-200 shadow-sm hover:border-slate-300'}`}
                  >
                    <button onClick={(e) => { e.stopPropagation(); toggleStatus(todo.id, todo.is_completed); }} className={todo.is_completed ? 'text-green-500' : 'text-slate-300'}>{todo.is_completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}</button>
                    <div className="flex-1 relative">
                      <p className={`text-sm ${todo.is_completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{todo.content}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400 font-medium">{todo.author_name}</span>
                        {(isTodoNew || hasNewComment) && <span className="text-[9px] bg-rose-500 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse">N</span>}
                        <div className="flex items-center gap-1 text-[10px] text-blue-500 font-bold">
                          <MessageCircle size={12} /> {taskComments.length}
                        </div>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); deleteTask('admin_tasks', todo.id); }} className="text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                  </div>
                  
                  {expandedTodo === todo.id && (
                    <div className="ml-8 p-3 bg-white rounded-xl border border-slate-100 shadow-inner space-y-2 animate-in slide-in-from-top-2 duration-200">
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {taskComments.length === 0 ? (
                          <p className="text-[11px] text-slate-400 text-center py-2">댓글이 없습니다.</p>
                        ) : (
                          taskComments.map(comment => (
                            <div key={comment.id} className="text-[12px] bg-slate-50 p-2 rounded-lg">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-slate-700">{comment.author_name}</span>
                                <span className="text-[9px] text-slate-400">{format(new Date(comment.created_at), 'HH:mm')}</span>
                              </div>
                              <p className="text-slate-600">{comment.content}</p>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-slate-50" onClick={e => e.stopPropagation()}>
                        <input type="text" placeholder="Reply..." value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment(todo.id)} className="flex-1 text-[11px] px-2 py-1.5 rounded border border-slate-100 outline-none focus:ring-1 focus:ring-blue-500/20" />
                        <button onClick={() => addComment(todo.id)} className="text-blue-500 hover:text-blue-600"><Send size={16} /></button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
            <button onClick={async () => {
              if (!newMemo.trim() || !currentUser) return;
              await supabase.from('admin_tasks').insert({ type: 'MEMO', content: newMemo, author_id: currentUser.id, author_name: currentUser.name });
              setNewMemo('');
            }} className="w-full mt-2 bg-amber-600 text-white py-2 rounded-lg font-bold text-xs hover:bg-amber-700">추가</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {memos.map(memo => (
              <div key={memo.id} className="bg-white p-3 rounded-xl border border-amber-100 shadow-sm group">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{memo.content}</p>
                <div className="mt-2 pt-2 border-t border-slate-50 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-amber-700 uppercase">{memo.author_name}</span>
                  <button onClick={() => deleteTask('admin_tasks', memo.id)} className="text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
