'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Search, Calendar, User, Info, 
  ChevronDown, ChevronUp, AlertCircle, Clock, ArrowRight, MessageSquare
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';

export default function AuditLogTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const supabase = createClient();

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching audit logs:', error);
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
    const channel = supabase.channel('realtime_audit_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_audit_logs' }, (payload) => {
        setLogs(prev => [payload.new, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const getActionInfo = (log: any) => {
    const type = log.action_type;
    const map: Record<string, { label: string, color: string, description: string }> = {
      'DELETE_USER_FULL': { 
        label: '유저 영구 삭제', 
        color: 'bg-red-50 text-red-700 border-red-100',
        description: '계정 및 모든 활동 데이터를 연쇄 삭제함'
      },
      'DELETE_ITEM': { 
        label: '데이터 삭제', 
        color: 'bg-orange-50 text-orange-700 border-orange-100',
        description: '개별 데이터 항목을 삭제함'
      },
      'UPDATE_HOST_APPLICATIONS_STATUS': { 
        label: '호스트 심사', 
        color: 'bg-blue-50 text-blue-700 border-blue-100',
        description: '호스트 지원서 승인 상태 변경'
      },
      'UPDATE_EXPERIENCES_STATUS': { 
        label: '체험 심사', 
        color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        description: '체험 상품 승인 상태 변경'
      },
      'CONFIRM_PAYMENT': { 
        label: '입금 확인', 
        color: 'bg-indigo-50 text-indigo-700 border-indigo-100',
        description: '관리자 권한으로 무통장 입금 확정 처리'
      },
    };
    return map[type] || { label: type, color: 'bg-slate-50 text-slate-700 border-slate-100', description: '기타 관리 작업' };
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      'approved': '승인 완료',
      'active': '활성화',
      'rejected': '거절',
      'revision': '보완 요청',
      'pending': '대기중'
    };
    return map[status] || status;
  };

  const filteredLogs = logs.filter(log => 
    log.admin_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details?.target_info?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center px-2">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
            <ShieldCheck className="text-rose-500" size={26}/> 활동 로그
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">관리자 작업 내역을 실시간으로 모니터링합니다.</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
          <input 
            type="text" 
            placeholder="관리자, 대상 이름, 액션 검색" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 ring-rose-500/10 focus:border-rose-300 transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="overflow-y-auto flex-1 scrollbar-hide">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase sticky top-0 z-10 border-b border-slate-100 backdrop-blur-md">
              <tr>
                <th className="px-6 py-4 w-40">작업 일시</th>
                <th className="px-6 py-4">관리자</th>
                <th className="px-6 py-4">수행 작업</th>
                <th className="px-6 py-4">대상 정보</th>
                <th className="px-6 py-4 text-right">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="py-32 text-center text-slate-400 font-medium">로그 데이터를 불러오는 중...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={5} className="py-32 text-center text-slate-400 font-medium">검색 결과와 일치하는 로그가 없습니다.</td></tr>
              ) : (
                filteredLogs.map((log) => {
                  const action = getActionInfo(log);
                  const isExpanded = expandedId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr 
                        className={`group hover:bg-slate-50/80 transition-all cursor-pointer ${isExpanded ? 'bg-slate-50' : ''}`} 
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      >
                        <td className="px-6 py-5 text-slate-500 font-mono text-[11px]">
                          {new Date(log.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                              {log.admin_email?.[0].toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-700 text-xs">{log.admin_email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${action.color}`}>
                            {action.label}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 text-xs line-clamp-1">{log.details?.target_info || log.target_id}</span>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase">{log.target_type} ID: {log.target_id.slice(0,8)}...</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className={`inline-flex p-1.5 rounded-full transition-all ${isExpanded ? 'bg-slate-200 text-slate-900' : 'text-slate-300 group-hover:text-slate-600'}`}>
                            {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/30">
                          <td colSpan={5} className="px-8 pb-6 pt-2">
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-in slide-in-from-top-2 duration-300">
                              <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                      <Info size={12} className="text-blue-500"/> 작업 요약
                                    </h4>
                                    <p className="text-sm font-bold text-slate-800 leading-relaxed">
                                      {action.description}
                                    </p>
                                  </div>
                                  
                                  {log.details?.new_status && (
                                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 inline-flex items-center gap-3">
                                      <span className="text-xs text-slate-400 line-through decoration-slate-300">이전 상태</span>
                                      <ArrowRight size={12} className="text-slate-300"/>
                                      <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                                        {getStatusLabel(log.details.new_status)}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="space-y-4 border-l border-slate-100 pl-8">
                                  {log.details?.comment && (
                                    <div>
                                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <MessageSquare size={12} className="text-amber-500"/> 관리자 코멘트
                                      </h4>
                                      <div className="bg-amber-50/50 text-amber-900 p-3 rounded-xl text-sm font-medium border border-amber-100 italic">
                                        "{log.details.comment}"
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                      <Clock size={12}/> 시스템 데이터
                                    </h4>
                                    <div className="font-mono text-[9px] text-slate-400 bg-slate-50 p-2 rounded border border-slate-100">
                                      ID: {log.id} | TYPE: {log.action_type}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-center">
           <p className="text-[10px] font-bold text-slate-400">활동 로그는 보안을 위해 수정 및 삭제가 불가능합니다.</p>
        </div>
      </div>
    </div>
  );
}
