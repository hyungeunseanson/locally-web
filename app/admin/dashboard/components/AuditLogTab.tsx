'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Search, Calendar, User, Info, 
  ChevronDown, ChevronUp, AlertCircle, Clock
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

    // 실시간 로그 업데이트 구독
    const channel = supabase.channel('realtime_audit_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_audit_logs' }, (payload) => {
        setLogs(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const getActionLabel = (type: string) => {
    const map: Record<string, { label: string, color: string }> = {
      'DELETE_USER_FULL': { label: '유저 영구 삭제', color: 'bg-red-100 text-red-700' },
      'DELETE_ITEM': { label: '데이터 삭제', color: 'bg-orange-100 text-orange-700' },
      'UPDATE_HOST_APPLICATIONS_STATUS': { label: '호스트 승인 상태 변경', color: 'bg-blue-100 text-blue-700' },
      'UPDATE_EXPERIENCES_STATUS': { label: '체험 상태 변경', color: 'bg-emerald-100 text-emerald-700' },
    };
    return map[type] || { label: type, color: 'bg-slate-100 text-slate-700' };
  };

  const filteredLogs = logs.filter(log => 
    log.admin_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.target_id?.includes(searchTerm)
  );

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck className="text-rose-500" size={24}/> 활동 로그 (Audit Logs)
          </h2>
          <p className="text-sm text-slate-500 mt-1">시스템 내 관리자의 모든 주요 활동을 기록합니다.</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
          <input 
            type="text" 
            placeholder="관리자, 액션, ID 검색" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 ring-rose-500/20 transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase sticky top-0 z-10 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 w-48">일시</th>
                <th className="px-6 py-4">관리자</th>
                <th className="px-6 py-4">액션</th>
                <th className="px-6 py-4">대상 (ID)</th>
                <th className="px-6 py-4 text-right">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="py-20 text-center text-slate-400">로그를 불러오는 중...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={5} className="py-20 text-center text-slate-400">기록된 활동이 없습니다.</td></tr>
              ) : (
                filteredLogs.map((log) => {
                  const action = getActionLabel(log.action_type);
                  const isExpanded = expandedId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50' : ''}`} onClick={() => setExpandedId(isExpanded ? null : log.id)}>
                        <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-700">
                          {log.admin_email}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${action.color}`}>
                            {action.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400 font-mono text-[10px]">
                          {log.target_type}: {log.target_id}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-300">
                          {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={5} className="px-8 py-4">
                            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-inner">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1">
                                <Info size={12}/> Raw Metadata (Details)
                              </h4>
                              <pre className="text-xs font-mono text-slate-600 overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
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
      </div>
    </div>
  );
}
