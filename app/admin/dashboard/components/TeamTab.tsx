'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useLanguage } from '@/app/context/LanguageContext';
import {
  ClipboardList, CheckSquare, FileText, Plus, Trash2,
  Clock, CheckCircle2, Circle, X, NotebookPen, MessageCircle, Send, Settings
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { AdminTask, AdminComment } from '@/app/types/admin';
import { useToast } from '@/app/context/ToastContext';

export default function TeamTab() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [whitelist, setWhitelist] = useState<any[]>([]);
  const [newWhitemail, setNewWhitemail] = useState('');
  const [showWhitelist, setShowWhitelist] = useState(false);
  const [newLog, setNewLog] = useState({ task: '', note: '' });
  const [newTodo, setNewTodo] = useState('');
  const [newMemo, setNewMemo] = useState('');
  const [showMemos, setShowMemos] = useState(false);
  const [expandedTodo, setExpandedTodo] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);
  const [lastViewed, setLastViewed] = useState<string>(new Date(0).toISOString());
  const [expandedMemos, setExpandedMemos] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const threadRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const toggleMemoExpand = (id: string) => {
    const newSet = new Set(expandedMemos);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedMemos(newSet);
  };

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
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

  const fetchWhitelist = async () => {
    const { data } = await supabase.from('admin_whitelist').select('*').order('created_at', { ascending: false });
    if (data) setWhitelist(data);
  };

  useEffect(() => {
    setIsClient(true);
    const viewed = localStorage.getItem('last_viewed_team') || new Date(0).toISOString();
    setLastViewed(viewed);
    localStorage.setItem('last_viewed_team', new Date().toISOString());

    const initData = async () => {
      setIsLoading(true);
      await Promise.all([fetchTasks(), fetchComments(), fetchWhitelist(), getCurrentUser()]);
      setIsLoading(false);
    };
    initData();

    const channel = supabase.channel('team_workspace_realtime_final')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_tasks' }, () => { fetchTasks(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_task_comments' }, () => { fetchComments(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_whitelist' }, () => { fetchWhitelist(); })
      .subscribe();

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

  const addWhitelistEmail = async () => {
    if (!newWhitemail.trim()) return;
    const email = newWhitemail.trim().toLowerCase();
    if (whitelist.some(item => item.email === email)) {
      alert('이미 등록된 이메일입니다.');
      return;
    }
    try {
      const { error } = await supabase.from('admin_whitelist').insert({ email });
      if (error) {
        if (error.code === '23505') showToast('이미 화이트리스트에 존재하는 이메일입니다.', 'error');
        else throw error;
      } else {
        setNewWhitemail('');
        showToast('화이트리스트 추가 완료', 'success');
      }
    } catch (error: any) {
      showToast('오류 발생: ' + error.message, 'error');
    }
  };

  const addDailyLog = async () => {
    if (!newLog.task.trim() || !currentUser) return;
    try {
      const { error } = await supabase.from('admin_tasks').insert({
        type: 'DAILY_LOG',
        content: newLog.task,
        author_id: currentUser.id,
        author_name: currentUser.name,
        is_completed: false,
        metadata: { note: newLog.note, status_text: 'Progress' }
      });
      if (error) throw error;
      setNewLog({ task: '', note: '' });
      showToast('Daily Log 기록 성공', 'success');
    } catch (error: any) {
      showToast('저장 중 오류가 발생했습니다: ' + error.message, 'error');
    }
  };

  const addComment = async (taskId: string) => {
    if (!newComment.trim() || !currentUser) return;
    try {
      const { error } = await supabase.from('admin_task_comments').insert({
        task_id: taskId,
        content: newComment,
        author_id: currentUser.id,
        author_name: currentUser.name
      });
      if (error) throw error;
      setNewComment('');
    } catch (error: any) {
      showToast('댓글 작성 실패: ' + error.message, 'error');
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const nextStatus = !currentStatus;
      const { error } = await supabase.from('admin_tasks').update({
        is_completed: nextStatus,
        metadata: { status_text: nextStatus ? 'Done' : 'Progress' }
      }).eq('id', id);
      if (error) throw error;
    } catch (error: any) {
      showToast('상태 업데이트 실패: ' + error.message, 'error');
    }
  };

  const deleteTask = async (table: string, id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      showToast('삭제 완료', 'success');
    } catch (error: any) {
      showToast('삭제 실패: ' + error.message, 'error');
    }
  };

  const addTodo = async () => {
    if (!newTodo.trim() || !currentUser) return;
    try {
      const { error } = await supabase.from('admin_tasks').insert({ type: 'TODO', content: newTodo, author_id: currentUser.id, author_name: currentUser.name, is_completed: false });
      if (error) throw error;
      setNewTodo('');
      showToast('할 일이 추가되었습니다.', 'success');
    } catch (error: any) {
      showToast('오류: ' + error.message, 'error');
    }
  };

  const addMemo = async () => {
    if (!newMemo.trim() || !currentUser) return;
    try {
      const { error } = await supabase.from('admin_tasks').insert({ type: 'MEMO', content: newMemo, author_id: currentUser.id, author_name: currentUser.name });
      if (error) throw error;
      setNewMemo('');
      showToast('메모가 저장되었습니다.', 'success');
    } catch (error: any) {
      showToast('오류: ' + error.message, 'error');
    }
  };

  if (!isClient) return null;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full gap-6 animate-pulse">
        <div className="h-10 bg-slate-100 rounded-xl w-1/3"></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
          <div className="bg-slate-50 rounded-2xl h-full p-4 space-y-4">
            <div className="h-8 bg-slate-200 rounded w-1/4"></div>
            <div className="h-12 bg-slate-200 rounded"></div>
            <div className="h-64 bg-slate-200 rounded"></div>
          </div>
          <div className="bg-slate-50 rounded-2xl h-full p-4 space-y-4">
            <div className="h-8 bg-slate-200 rounded w-1/4"></div>
            <div className="h-12 bg-slate-200 rounded"></div>
            <div className="h-64 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const dailyLogs = tasks.filter(t => t.type === 'DAILY_LOG');
  const todos = tasks.filter(t => t.type === 'TODO');
  const memos = tasks.filter(t => t.type === 'MEMO');

  const isNew = (createdAt: string) => new Date(createdAt) > new Date(lastViewed);

  return (
    <div className="flex flex-col h-full gap-6 relative">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ClipboardList className="text-rose-500" /> {t('team_board_title')}
        </h2>
        <button onClick={() => setShowMemos(!showMemos)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${showMemos ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          <NotebookPen size={18} /> {t('team_memo_board')} {memos.length > 0 && `(${memos.length})`}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">
        {/* Left: Daily Logs */}
        <div className="flex-[2.5] flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Clock size={18} className="text-blue-500" /> {t('team_daily_log')}</h3>
          </div>

          <div className="p-3 bg-blue-50/30 border-b border-slate-100 flex items-center gap-2">
            <div className="flex-[4]">
              <input type="text" placeholder={t('team_input_task')} value={newLog.task} onChange={e => setNewLog({ ...newLog, task: e.target.value })} className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500/20 outline-none" />
            </div>
            <div className="flex-[3]">
              <input type="text" placeholder={t('team_input_note')} value={newLog.note} onChange={e => setNewLog({ ...newLog, note: e.target.value })} onKeyDown={e => e.key === 'Enter' && addDailyLog()} className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500/20 outline-none" />
            </div>
            <button onClick={addDailyLog} className="px-5 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors">{t('team_btn_record')}</button>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-4 py-3 w-28">Date</th>
                  <th className="px-4 py-3 w-20">Name</th>
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3 w-24 text-center">Status</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dailyLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50 group">
                    <td className="px-4 py-3 text-[11px] text-slate-500 font-medium whitespace-nowrap flex items-center gap-2">
                      {isNew(log.created_at) && <span className="w-4 h-4 bg-rose-500 text-[8px] font-bold text-white rounded-full flex items-center justify-center shrink-0">N</span>}
                      {format(new Date(log.created_at), 'yyyy-MM-dd')}
                    </td>
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

        {/* Right: Todo List */}
        <div className="flex-1 flex flex-col bg-slate-50/50 rounded-2xl border border-slate-200 p-4 overflow-hidden shadow-sm" ref={threadRef}>
          <div className="flex items-center gap-2 mb-4"><CheckSquare size={18} className="text-green-500" /><h3 className="font-bold text-slate-800">{t('team_todo_list')}</h3></div>
          <div className="flex gap-2 mb-4">
            <input type="text" value={newTodo} onChange={e => setNewTodo(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTodo()} placeholder="할 일 추가..." className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none" />
            <button onClick={addTodo} className="bg-slate-900 text-white p-2 rounded-lg"><Plus size={18} /></button>
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

      {/* Floating Memo Panel */}
      {showMemos && (
        <>
          <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px] z-20" onClick={() => setShowMemos(false)} />
          <div className="absolute top-0 right-0 w-[500px] h-full bg-white border-l border-slate-200 shadow-2xl z-30 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{t('team_memo_board')}</h3>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Team Shared Knowledge</p>
                </div>
              </div>
              <button onClick={() => setShowMemos(false)} className="text-slate-400 hover:text-slate-900 hover:bg-slate-100 p-2 rounded-lg transition-all"><X size={24} /></button>
            </div>

            <div className="p-6 border-b border-slate-50 bg-white">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 focus-within:border-amber-300 focus-within:ring-4 focus-within:ring-amber-500/5 transition-all">
                <textarea
                  placeholder={t('team_memo_placeholder')}
                  value={newMemo}
                  onChange={e => setNewMemo(e.target.value)}
                  className="w-full text-sm p-0 bg-transparent outline-none min-h-[120px] resize-none text-slate-700 placeholder:text-slate-400 leading-relaxed"
                />
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-[11px] text-slate-400 font-medium italic">Shift + Enter for new line</span>
                  <button
                    onClick={addMemo}
                    className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2"
                  >
                    <Plus size={18} /> {t('team_btn_add_memo')}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 scrollbar-thin">
              {memos.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
                  <NotebookPen size={48} className="opacity-20 mb-4" />
                  <p className="text-sm">저장된 메모가 없습니다.</p>
                </div>
              ) : (
                memos.map(memo => {
                  const isExpanded = expandedMemos.has(memo.id);
                  const lineCount = memo.content.split('\n').length;
                  const isLong = lineCount > 15 || memo.content.length > 800;

                  return (
                    <div key={memo.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group hover:shadow-md transition-all relative">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200">
                            {memo.author_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{memo.author_name}</p>
                            <p className="text-[10px] text-slate-400 font-medium">
                              {format(new Date(memo.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}
                            </p>
                          </div>
                        </div>
                        {memo.author_id === currentUser?.id && (
                          <button
                            onClick={() => deleteTask('admin_tasks', memo.id)}
                            className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>

                      <div className={`relative ${!isExpanded && isLong ? 'max-h-[350px] overflow-hidden' : ''}`}>
                        <div className="text-[14px] text-slate-700 whitespace-pre-wrap leading-relaxed tracking-tight">
                          {memo.content}
                        </div>

                        {!isExpanded && isLong && (
                          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-white via-white/80 to-transparent flex items-end justify-center pb-2">
                            <button
                              onClick={() => toggleMemoExpand(memo.id)}
                              className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg hover:bg-slate-800 transition-all mb-2"
                            >
                              전체 내용 보기 (더보기)
                            </button>
                          </div>
                        )}
                      </div>

                      {isExpanded && isLong && (
                        <div className="mt-6 flex justify-center border-t border-slate-50 pt-4">
                          <button
                            onClick={() => toggleMemoExpand(memo.id)}
                            className="text-slate-400 hover:text-slate-900 text-xs font-bold flex items-center gap-1"
                          >
                            내용 접기 <X size={12} />
                          </button>
                        </div>
                      )}

                      <div className={`absolute top-0 left-0 w-1 h-full transition-all rounded-l-2xl ${isLong ? 'bg-amber-400/50' : 'bg-amber-400/0 group-hover:bg-amber-400'}`} />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* Discrete Admin Whitelist Manager */}
      <div className="mt-auto pt-10 pb-2 flex flex-col items-center">
        {!showWhitelist ? (
          <button
            onClick={() => setShowWhitelist(true)}
            className="text-[10px] text-slate-300 hover:text-slate-500 transition-colors flex items-center gap-1"
          >
            <Settings size={10} /> Admin Whitelist
          </button>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xl animate-in fade-in zoom-in duration-200 max-w-sm w-full">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-bold text-slate-800">Admin Whitelist</h4>
              <button onClick={() => setShowWhitelist(false)} className="text-slate-400 hover:text-slate-900"><X size={14} /></button>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                type="email"
                placeholder="New admin email"
                value={newWhitemail}
                onChange={e => setNewWhitemail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addWhitelistEmail()}
                className="flex-1 text-[11px] px-2 py-1 rounded border border-slate-200 outline-none focus:ring-1 focus:ring-blue-500/20"
              />
              <button onClick={addWhitelistEmail} className="bg-slate-900 text-white px-3 py-1 rounded text-[10px] font-bold hover:bg-slate-800 transition-colors">Add</button>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
              {whitelist.length === 0 ? (
                <p className="text-[9px] text-slate-400 text-center py-2">No extra admins whitelisted.</p>
              ) : (
                whitelist.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-[10px] bg-slate-50 px-2 py-1 rounded group">
                    <span className="text-slate-600 truncate mr-2 font-medium">{item.email}</span>
                    <button onClick={() => deleteTask('admin_whitelist', item.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
