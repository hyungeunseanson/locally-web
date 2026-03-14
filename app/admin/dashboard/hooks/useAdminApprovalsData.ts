'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { updateAdminStatus } from '@/app/actions/admin';

const HOST_APPLICATION_SUMMARY_SELECT = 'id,user_id,created_at,name,status,host_nationality,profile_photo,languages,language_levels,target_language';
type ApprovalListItem = Record<string, unknown>;

export function useAdminApprovalsData() {
  const supabase = createClient();
  const { showToast } = useToast();

  const [apps, setApps] = useState<ApprovalListItem[]>([]);
  const [exps, setExps] = useState<ApprovalListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchApprovals = useCallback(async () => {
    setIsLoading(true);
    try {
      const [appsResult, expsResult] = await Promise.all([
        fetch(`/api/admin/host-applications?select=${encodeURIComponent(HOST_APPLICATION_SUMMARY_SELECT)}`).then((response) =>
          response.ok ? response.json() : { data: [] }
        ),
        fetch(`/api/admin/experiences`).then((response) =>
          response.ok ? response.json() : { data: [] }
        ),
      ]);

      const appsArray = Array.isArray(appsResult)
        ? appsResult
        : Array.isArray(appsResult?.data)
          ? appsResult.data
          : [];

      setApps(appsArray);
      setExps(expsResult.data || []);

      if (expsResult.error) {
        throw expsResult.error;
      }
    } catch (error) {
      console.error('[useAdminApprovalsData] fetch error:', error);
      showToast('승인 데이터를 불러오지 못했습니다.', 'error');
      setApps([]);
      setExps([]);
    } finally {
      setIsLoading(false);
    }
  }, [showToast, supabase]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const updateStatus = useCallback(async (
    table: 'host_applications' | 'experiences',
    id: string,
    status: string,
    comment: string = ''
  ) => {
    let nextStatus = status;

    if (status === 'approved' && table === 'experiences') {
      nextStatus = 'active';
    }

    try {
      await updateAdminStatus(table, id, nextStatus, comment);
      showToast(`성공적으로 업데이트되었습니다. (${nextStatus})`, 'success');
      await fetchApprovals();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '업데이트 실패';
      showToast(`업데이트 실패: ${message}`, 'error');
      return false;
    }
  }, [fetchApprovals, showToast]);

  const deleteItem = useCallback(async (table: string, id: string) => {

    try {
      const response = await fetch('/api/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, id }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || '삭제 요청 실패');
      }

      showToast('삭제되었습니다.', 'success');
      await fetchApprovals();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '삭제 실패';
      showToast(`삭제 실패: ${message}`, 'error');
      return false;
    }
  }, [fetchApprovals, showToast]);

  return {
    apps,
    exps,
    isLoading,
    updateStatus,
    deleteItem,
    refresh: fetchApprovals,
  };
}
