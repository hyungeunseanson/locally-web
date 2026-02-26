'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/app/utils/supabase/client';
import MarkdownMemoEditor from './MarkdownMemoEditor';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ClipboardList, CheckSquare, FileText, Plus, Trash2,
  Clock, CheckCircle2, Circle, X, NotebookPen, MessageCircle, Send, Settings, Edit2
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { AdminTask, AdminComment } from '@/app/types/admin';
import { useToast } from '@/app/context/ToastContext';

export default function TeamTab() {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [whitelist, setWhitelist] = useState<any[]>([]);
  const [newWhitemail, setNewWhitemail] = useState('');
  const [showWhitelist, setShowWhitelist] = useState(false);
  const [newLog, setNewLog] = useState({ task: '', note: '' });
  const [newTodo, setNewTodo] = useState('');
  const [innerTab, setInnerTab] = useState<'todo' | 'memo'>('todo'); // 🟢 새로운 서브 탭
  const [isComposingMemo, setIsComposingMemo] = useState(false);
  const [editingMemo, setEditingMemo] = useState<any>(null); // ⭐ 수정 모드용 상태
  const [memoCommentInputs, setMemoCommentInputs] = useState<Record<string, string>>({}); // ⭐ 메모별 댓글 입력 상태
  const [expandedTodo, setExpandedTodo] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);
  const [lastViewed, setLastViewed] = useState<string>(new Date(0).toISOString());
  const [expandedMemos, setExpandedMemos] = useState<Set<string>>(new Set());
  const [zoomImage, setZoomImage] = useState<string | null>(null);
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
    // 🟢 과부하 방지: 최대 100개 제한
    const { data } = await supabase.from('admin_tasks').select('*').order('created_at', { ascending: false }).limit(100);
    if (data) setTasks(data);
  };

  const fetchComments = async () => {
    // 🟢 과부하 방지: 최대 100개 제한
    const { data } = await supabase.from('admin_task_comments').select('*').order('created_at', { ascending: true }).limit(100);
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

      // 알림 발송 (비동기 처리)
      fetch('/api/admin/notify-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `할 일에 새로운 댓글이 등록되었습니다.`,
          message: `${currentUser.name}: ${newComment}`,
          link: '/admin/dashboard?tab=TEAM'
        })
      }).catch(e => console.error('Notify error:', e));

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

      fetch('/api/admin/notify-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `새로운 할 일이 등록되었습니다.`,
          message: `${currentUser.name}님이 할 일을 추가했습니다:\n${newTodo}`,
          link: '/admin/dashboard?tab=TEAM'
        })
      }).catch(e => console.error('Notify error:', e));

      setNewTodo('');
      showToast('할 일이 추가되었습니다.', 'success');
    } catch (error: any) {
      showToast('오류: ' + error.message, 'error');
    }
  };

  const addMemoComment = async (taskId: string) => {
    const text = memoCommentInputs[taskId];
    if (!text?.trim() || !currentUser) return;
    try {
      const { error } = await supabase.from('admin_task_comments').insert({
        task_id: taskId, content: text, author_id: currentUser.id, author_name: currentUser.name
      });
      if (error) throw error;

      fetch('/api/admin/notify-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `메모에 새로운 답글이 등록되었습니다.`,
          message: `${currentUser.name}: ${text}`,
          link: '/admin/dashboard?tab=TEAM'
        })
      }).catch(e => console.error('Notify error:', e));

      setMemoCommentInputs(prev => ({ ...prev, [taskId]: '' }));
      showToast('답글을 남겼습니다.', 'success');
    } catch (error: any) {
      showToast('오류: ' + error.message, 'error');
    }
  };

  const saveMemo = async (markdownContent: string) => {
    if (!currentUser) return;
    try {
      if (editingMemo) {
        const { error } = await supabase.from('admin_tasks').update({ content: markdownContent }).eq('id', editingMemo.id);
        if (error) throw error;
        showToast('마크다운 메모가 수정되었습니다.', 'success');
      } else {
        const { error } = await supabase.from('admin_tasks').insert({
          type: 'MEMO',
          content: markdownContent,
          author_id: currentUser.id,
          author_name: currentUser.name
        });
        if (error) throw error;

        fetch('/api/admin/notify-team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `새로운 팀 메모가 등록되었습니다.`,
            message: `${currentUser.name}님이 메모를 작성했습니다.\n대시보드에서 내용을 확인해보세요.`,
            link: '/admin/dashboard?tab=TEAM'
          })
        }).catch(e => console.error('Notify error:', e));

        showToast('마크다운 메모가 저장되었습니다.', 'success');
      }
      setIsComposingMemo(false);
      setEditingMemo(null);
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
  const memos = tasks.filter(t => t.type === 'MEMO' && t.id !== '00000000-0000-0000-0000-000000000000');

  const isNew = (createdAt: string) => new Date(createdAt) > new Date(lastViewed);

  return (
    <div className="flex flex-col h-full gap-3 md:gap-6 relative pt-2 md:pt-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-2.5 md:pb-4 gap-2">
        <h2 className="text-[10px] md:text-xl font-bold text-slate-900 flex items-center gap-1.5">
          <ClipboardList size={12} className="text-rose-500" /> Team Sync HQ
        </h2>

        {/* 🟢 구조 개편: Inner Tab Navigation */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg w-full md:w-auto">
          <button
            onClick={() => setInnerTab('todo')}
            className={`flex-1 md:flex-initial px-2.5 md:px-6 py-1 rounded-md text-[9px] md:text-sm font-bold transition-all flex items-center justify-center gap-1 ${innerTab === 'todo' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Daily Log & Tasks
            {/* 🟢 이슈2: 탭 N 뱃지 — 새 할일/일지/댓글 있을 때 */}
            {innerTab !== 'todo' && (todos.some(t => isNew(t.created_at)) || dailyLogs.some(l => isNew(l.created_at)) || comments.filter(c => todos.some(t => t.id === c.task_id)).some(c => isNew(c.created_at))) && (
              <span className="w-4 h-4 bg-rose-500 text-[8px] font-bold text-white rounded-full flex items-center justify-center shrink-0">N</span>
            )}
          </button>
          <button
            onClick={() => setInnerTab('memo')}
            className={`flex-1 md:flex-initial px-2.5 md:px-6 py-1 rounded-md text-[9px] md:text-sm font-bold transition-all flex items-center justify-center gap-1 flex-nowrap whitespace-nowrap ${innerTab === 'memo' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <NotebookPen size={11} /> 팀 메모장
            {/* 🟢 이슈2: 탭 N 뱃지 — 새 메모/메모 댓글 있을 때 */}
            {innerTab !== 'memo' && (memos.some(m => isNew(m.created_at)) || comments.filter(c => memos.some(m => m.id === c.task_id)).some(c => isNew(c.created_at))) && (
              <span className="w-4 h-4 bg-rose-500 text-[8px] font-bold text-white rounded-full flex items-center justify-center shrink-0">N</span>
            )}
          </button>
        </div>
      </div>

      {/* 탭 내용 — 위 여백 살짝 */}
      <div className="flex flex-col lg:flex-row gap-3 md:gap-6 flex-1 md:overflow-hidden pt-1 md:pt-0">
        {innerTab === 'todo' ? (
          <>
            {/* Left: Daily Logs */}
            <div className="flex-[2.5] flex flex-col bg-white rounded-xl md:rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-in fade-in duration-300">
              <div className="p-2 md:p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="text-[8px] md:text-base font-bold text-slate-800 flex items-center gap-1"><Clock size={11} className="text-blue-500" /> 업무 일지</h3>
              </div>

              {/* 입력 영역 */}
              <div className="p-1.5 md:p-3 bg-blue-50/30 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center gap-1.5 md:gap-2">
                <div className="flex-[4]">
                  <input type="text" placeholder="오늘의 주요 업무" value={newLog.task} onChange={e => setNewLog({ ...newLog, task: e.target.value })} className="w-full text-[10px] md:text-sm px-2 py-1.5 md:py-2 rounded-md border border-slate-200 focus:ring-2 focus:ring-blue-500/20 outline-none placeholder:text-slate-400" />
                </div>
                <div className="flex-[3]">
                  <input type="text" placeholder="비고" value={newLog.note} onChange={e => setNewLog({ ...newLog, note: e.target.value })} onKeyDown={e => e.key === 'Enter' && addDailyLog()} className="w-full text-[10px] md:text-sm px-2 py-1.5 md:py-2 rounded-md border border-slate-200 focus:ring-2 focus:ring-blue-500/20 outline-none placeholder:text-slate-400" />
                </div>
                <button onClick={addDailyLog} className="w-full md:w-auto px-3 py-1.5 md:py-2 bg-blue-600 text-white rounded-md font-bold text-[10px] md:text-sm hover:bg-blue-700 transition-colors">기록</button>
              </div>

              <div className="flex-1 overflow-auto">
                {/* 🟢 데스크탑: 기존 테이블 뷰 */}
                <table className="hidden md:table w-full text-left border-collapse">
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
                          {isNew(log.created_at) && <span className="w-4 h-4 bg-rose-500 text-[9px] font-bold text-white rounded-full flex items-center justify-center shrink-0">N</span>}
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

                {/* 모바일: 카드형 리스트 */}
                <div className="md:hidden divide-y divide-slate-100">
                  {dailyLogs.map(log => (
                    <div key={log.id} className="px-2 py-1.5 group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          {isNew(log.created_at) && <span className="w-3 h-3 bg-rose-500 text-[7px] font-bold text-white rounded-full flex items-center justify-center shrink-0">N</span>}
                          <span className="text-[8px] font-bold text-rose-500">{log.author_name}</span>
                          {/* 날짜: 10%만 축소 → text-[9px] */}
                          <span className="text-[9px] text-slate-400">{format(new Date(log.created_at), 'MM.dd')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={(e) => { e.stopPropagation(); toggleStatus(log.id, log.is_completed); }} className={`text-[7px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap transition-colors ${log.is_completed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{log.is_completed ? 'Done' : 'Progress'}</button>
                          {log.author_id === currentUser?.id && (
                            <button onClick={(e) => { e.stopPropagation(); deleteTask('admin_tasks', log.id); }} className="text-slate-300 hover:text-rose-500"><Trash2 size={10} /></button>
                          )}
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-700 font-medium">{log.content}</p>
                      {log.metadata?.note && <p className="text-[8px] text-slate-400 italic mt-0.5">{log.metadata.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Todo List */}
            <div className="flex-1 flex flex-col bg-slate-50/50 rounded-xl md:rounded-2xl border border-slate-200 p-2 md:p-4 overflow-hidden shadow-sm" ref={threadRef}>
              <div className="flex items-center gap-1 mb-2"><CheckSquare size={11} className="text-green-500" /><h3 className="text-[8px] md:text-base font-bold text-slate-800">팀 할 일</h3></div>
              <div className="flex flex-col md:flex-row gap-1.5 mb-2.5">
                <input type="text" value={newTodo} onChange={e => setNewTodo(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTodo()} placeholder="할 일 추가..." className="flex-1 text-[10px] md:text-sm border border-slate-200 rounded-md px-2 py-2 md:py-1.5 outline-none placeholder:text-slate-400" />
                <button onClick={addTodo} className="bg-slate-900 text-white p-2 md:p-1.5 text-[10px] md:text-sm flex justify-center items-center rounded-md font-bold hover:bg-slate-800 transition-colors"><Plus size={14} className="md:hidden" /><span className="hidden md:inline">추가</span></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {todos.map(todo => {
                  const taskComments = comments.filter(c => c.task_id === todo.id);
                  const hasNewComment = taskComments.some(c => isNew(c.created_at));
                  const isTodoNew = isNew(todo.created_at);

                  return (
                    <div key={todo.id} className="flex flex-col gap-1.5">
                      <div
                        onClick={() => setExpandedTodo(expandedTodo === todo.id ? null : todo.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border group transition-all cursor-pointer ${expandedTodo === todo.id ? 'border-blue-300 ring-1 ring-blue-500/10' : ''} ${todo.is_completed ? 'bg-slate-100/50 border-slate-100' : 'bg-white border-slate-200 shadow-sm hover:border-slate-300'}`}
                      >
                        <button onClick={(e) => { e.stopPropagation(); toggleStatus(todo.id, todo.is_completed); }} className={todo.is_completed ? 'text-green-500' : 'text-slate-300'}>{todo.is_completed ? <CheckCircle2 size={14} /> : <Circle size={14} />}</button>
                        <div className="flex-1 relative">
                          <p className={`text-[9px] md:text-sm ${todo.is_completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{todo.content}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {/* author_name — 수정 불필요 (유지) */}
                            <span className="text-[10px] text-slate-400 font-medium">{todo.author_name}</span>
                            {(isTodoNew || hasNewComment) && <span className="w-3 h-3 bg-rose-500 text-[7px] font-bold text-white rounded-full flex items-center justify-center shrink-0">N</span>}
                            <div className="flex items-center gap-0.5 text-[8px] text-blue-500 font-bold">
                              <MessageCircle size={9} /> {taskComments.length}
                            </div>
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); deleteTask('admin_tasks', todo.id); }} className="text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100"><Trash2 size={11} /></button>
                      </div>

                      {expandedTodo === todo.id && (
                        <div className="ml-5 p-2 bg-white rounded-lg border border-slate-100 shadow-inner space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                          <div className="space-y-1.5 max-h-40 md:max-h-48 overflow-y-auto pr-1">
                            {taskComments.length === 0 ? (
                              <p className="text-[10px] text-slate-400 text-center py-1">댓글이 없습니다.</p>
                            ) : (
                              taskComments.map(comment => (
                                <div key={comment.id} className="text-[10px] md:text-sm bg-slate-50 p-1.5 md:p-2.5 rounded-md">
                                  <div className="flex justify-between items-center mb-0.5 md:mb-1">
                                    <span className="font-bold text-slate-700 text-[11px] md:text-sm">{comment.author_name}</span>
                                    <span className="text-[9px] md:text-xs text-slate-400">{format(new Date(comment.created_at), 'HH:mm')}</span>
                                  </div>
                                  <p className="text-[10px] md:text-sm text-slate-600">{comment.content}</p>
                                </div>
                              ))
                            )}
                          </div>
                          <div className="flex gap-1.5 pt-1.5 border-t border-slate-50 mt-1" onClick={e => e.stopPropagation()}>
                            <input type="text" placeholder="Reply..." value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment(todo.id)} className="flex-1 text-[10px] md:text-[12px] px-2.5 py-1.5 md:py-1 rounded-md border border-slate-200 outline-none focus:ring-1 focus:ring-blue-500/20 placeholder:text-slate-400" />
                            <button onClick={() => addComment(todo.id)} className="bg-blue-500 hover:bg-blue-600 text-white px-2.5 rounded-md flex justify-center items-center transition-colors"><Send size={10} /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </>
        ) : (
          /* 팀 메모장 탭 */
          <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300">
            {isComposingMemo ? (
              <MarkdownMemoEditor
                initialValue={editingMemo?.content || ''}
                onSave={saveMemo}
                onCancel={() => { setIsComposingMemo(false); setEditingMemo(null); }}
                isSaving={false}
              />
            ) : (
              <div className="flex-1 flex flex-col bg-slate-50/50 rounded-xl md:rounded-2xl border border-slate-200 p-3 md:p-6 overflow-hidden shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 md:mb-6 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 md:w-10 md:h-10 bg-amber-100 rounded-lg md:rounded-xl flex items-center justify-center text-amber-600 shrink-0">
                      <FileText size={15} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-[13px] md:text-lg">Team Knowledge Docs</h3>
                      <p className="text-[10px] text-slate-500 font-medium tracking-wider hidden md:block">아이디어부터 정책까지, 자유롭게 쌓아가는 우리 팀의 아카이브</p>
                    </div>
                  </div>
                  <button onClick={() => { setEditingMemo(null); setIsComposingMemo(true); }} className="flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 md:px-5 py-1.5 md:py-2.5 text-[12px] md:text-sm rounded-lg md:rounded-xl shadow-lg shadow-amber-500/20 transition-all w-full md:w-auto">
                    <Plus size={14} /> 새 메모 작성
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 pr-2 scrollbar-thin">
                  {memos.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 py-20">
                      <NotebookPen size={48} className="opacity-20 mb-4" />
                      <p className="text-sm border bg-white px-4 py-2 rounded-full shadow-sm">등록된 메모가 없습니다. 노션처럼 마크다운으로 작성해보세요!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 pb-6">
                      {memos.map(memo => {
                        const memoComments = comments.filter(c => c.task_id === memo.id);
                        return (
                          <div key={memo.id} className="bg-white p-3 md:p-6 rounded-2xl border border-slate-200 shadow-sm group hover:shadow-md transition-all relative flex flex-col h-auto max-h-[70vh] md:h-[500px] md:max-h-none">
                            <div className="flex justify-between items-start mb-2 md:mb-4 pb-2 md:pb-4 border-b border-slate-100 shrink-0">
                              <div className="flex items-center gap-2 md:gap-3">
                                {/* 🟢 이슈4-B: 메모 저자 아바타 모바일 축소 */}
                                <div className="w-7 h-7 md:w-10 md:h-10 rounded-full bg-slate-100 flex flex-col items-center justify-center text-[9px] md:text-[11px] font-bold text-slate-600 border border-slate-200 uppercase shrink-0">
                                  {memo.author_name.slice(0, 2)}
                                </div>
                                <div>
                                  {/* 🟢 이슈4-B: 저자명 모바일 축소 */}
                                  <p className="text-[11px] md:text-sm font-bold text-slate-900 flex items-center gap-1 md:gap-2">
                                    {memo.author_name}
                                    {isNew(memo.created_at) && <span className="w-4 h-4 bg-rose-500 text-[9px] font-bold text-white rounded-full flex items-center justify-center shrink-0">N</span>}
                                  </p>
                                  {/* 🟢 이슈4-B: 날짜 모바일 축소 */}
                                  <p className="text-[9px] md:text-[11px] text-slate-500 font-medium">
                                    {format(new Date(memo.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}
                                  </p>
                                </div>
                              </div>
                              {memo.author_id === currentUser?.id && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                  <button
                                    onClick={() => { setEditingMemo(memo); setIsComposingMemo(true); }}
                                    className="text-slate-400 hover:text-blue-500 bg-white p-2 rounded-full hover:bg-blue-50 shadow-sm border border-transparent hover:border-blue-100"
                                    title="메모 수정"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    onClick={() => deleteTask('admin_tasks', memo.id)}
                                    className="text-slate-400 hover:text-rose-500 bg-white p-2 rounded-full hover:bg-rose-50 shadow-sm border border-transparent hover:border-rose-100"
                                    title="메모 삭제"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* 리치 텍스트 렌더러 기반 뷰어 */}
                            <div className="flex-1 overflow-y-auto prose prose-slate max-w-none text-[11px] md:text-[13px] [&_p]:text-[11px] md:[&_p]:text-[13px] [&_p]:text-slate-700 [&_p]:leading-relaxed [&_li]:text-[11px] md:[&_li]:text-[13px] [&_li]:text-slate-700 [&_img]:max-w-[50%] [&_img]:h-auto [&_img]:object-contain [&_img]:rounded-xl [&_img]:shadow-sm [&_img]:cursor-pointer hover:[&_img]:opacity-90 [&_img]:transition-opacity [&_img]:my-2 [&_a]:text-blue-600 prose-headings:font-bold prose-headings:text-slate-800 prose-blockquote:border-l-4 prose-blockquote:border-amber-400 prose-blockquote:bg-amber-50 prose-blockquote:py-1 prose-blockquote:px-3 pr-2 scrollbar-thin">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  img: ({ node, ...props }) => (
                                    <img
                                      {...props}
                                      onClick={() => {
                                        if (props.src) setZoomImage(props.src as string);
                                      }}
                                      alt={props.alt || "markdown image"}
                                    />
                                  )
                                }}
                              >
                                {memo.content}
                              </ReactMarkdown>
                            </div>

                            {/* 댓글 구역 */}
                            <div className="mt-4 pt-5 border-t-2 border-slate-100 shrink-0 space-y-3 bg-slate-50/80 -mx-4 md:-mx-6 -mb-4 md:-mb-6 p-4 md:p-5 rounded-b-2xl shadow-inner">
                              <div className="max-h-32 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                                {memoComments.length === 0 ? (
                                  <p className="text-[10px] md:text-[11px] text-slate-400/80 text-center py-2 font-medium">작성된 답글이 없습니다.</p>
                                ) : (
                                  memoComments.map(c => (
                                    <div key={c.id} className="text-[10px] md:text-[12px] bg-white p-2.5 md:p-3 rounded-xl border border-slate-200 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.05)]">
                                      <div className="flex justify-between items-center mb-1.5">
                                        <span className="font-bold text-slate-800">{c.author_name}</span>
                                        <span className="text-[9px] md:text-[10px] text-slate-400 font-medium">{format(new Date(c.created_at), 'MM.dd HH:mm')}</span>
                                      </div>
                                      <p className="text-slate-600 leading-relaxed">{c.content}</p>
                                    </div>
                                  ))
                                )}
                              </div>
                              <div className="flex gap-2 pt-2 border-t border-slate-200/50 mt-1">
                                <input
                                  type="text"
                                  placeholder="진행 상황이나 의견을 남겨주세요..."
                                  value={memoCommentInputs[memo.id] || ''}
                                  onChange={e => setMemoCommentInputs(prev => ({ ...prev, [memo.id]: e.target.value }))}
                                  onKeyDown={e => e.key === 'Enter' && addMemoComment(memo.id)}
                                  className="flex-1 text-[10px] md:text-xs px-2.5 py-2 md:px-3 md:py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white placeholder:text-slate-400 shadow-sm transition-all"
                                />
                                <button onClick={() => addMemoComment(memo.id)} className="bg-slate-900 text-white px-3 md:px-3.5 rounded-xl hover:bg-slate-800 transition-colors shadow-sm flex items-center justify-center">
                                  <Send size={14} className="md:w-4 md:h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Discrete Admin Whitelist Manager — 🟢 이슈3: 우측 정렬 */}
      <div className="mt-auto pt-10 pb-2 flex flex-col items-end">
        {!showWhitelist ? (
          <button
            onClick={() => setShowWhitelist(true)}
            className="text-[10px] text-slate-300 hover:text-slate-500 transition-colors flex items-center gap-1 mr-2"
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
            <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
              {whitelist.length === 0 ? (
                <p className="text-[9px] text-slate-400 text-center py-2">No extra admins whitelisted.</p>
              ) : (
                whitelist.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-[10px] bg-slate-50 px-2 py-1.5 rounded group">
                    <span className="text-slate-600 truncate mr-2 font-medium">{item.email}</span>
                    {/* 🟢 이슈3: 모바일에서도 삭제버튼 항상 표시 */}
                    <button onClick={() => deleteTask('admin_whitelist', item.id)} className="text-slate-400 hover:text-rose-500 md:opacity-0 group-hover:opacity-100 transition-all shrink-0">
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {
        zoomImage && createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setZoomImage(null)}
          >
            <button
              onClick={() => setZoomImage(null)}
              className="absolute top-6 right-6 text-white bg-black/50 hover:bg-black/70 p-2 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
            <img
              src={zoomImage}
              alt="Zoomed"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
          </div>,
          document.body
        )
      }
    </div >
  );
}
