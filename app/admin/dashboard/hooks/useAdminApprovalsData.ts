'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/app/context/ToastContext';
import { updateAdminStatus } from '@/app/actions/admin';

import { AdminApprovalTable, AdminItemId, HostApplication, ExperienceApprovalItem } from '@/app/types/admin';

type AdminApiPayload<T> = {
  data?: T;
  error?: string;
};

async function fetchAdminPayload<T>(url: string): Promise<AdminApiPayload<T>> {
  const response = await fetch(url);

  let payload: AdminApiPayload<T> = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    return {
      data: payload.data,
      error: payload.error || `Request failed (${response.status})`,
    };
  }

  return payload;
}

export function useAdminApprovalsData() {
  const { showToast } = useToast();

  const [apps, setApps] = useState<HostApplication[]>([]);
  const [exps, setExps] = useState<ExperienceApprovalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const fetchApprovals = useCallback(async () => {
    if (!hasLoadedOnce) {
      setIsLoading(true);
    }
    try {
      const [appsResult, expsResult] = await Promise.all([
        fetchAdminPayload<HostApplication[]>(`/api/admin/host-applications`),
        fetchAdminPayload<ExperienceApprovalItem[]>(`/api/admin/experiences`),
      ]);

      const appsArray = Array.isArray(appsResult.data) ? appsResult.data : [];
      const expsArray = Array.isArray(expsResult.data) ? expsResult.data : [];

      if (appsResult.error) {
        throw new Error(appsResult.error);
      }

      if (expsResult.error) {
        throw new Error(expsResult.error);
      }

      setApps(appsArray);
      setExps(expsArray);
      setHasLoadedOnce(true);
    } catch (error) {
      console.error('[useAdminApprovalsData] fetch error:', error);
      showToast('승인 데이터를 불러오지 못했습니다.', 'error');
      setApps([]);
      setExps([]);
      setHasLoadedOnce(true);
    } finally {
      setIsLoading(false);
    }
  }, [hasLoadedOnce, showToast]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const updateStatus = useCallback(async (
    table: AdminApprovalTable,
    id: AdminItemId,
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

  const deleteItem = useCallback(async (table: string, id: AdminItemId) => {

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

  const updateExperiencePhotos = useCallback((id: AdminItemId, photos: string[]) => {
    setExps((current) => current.map((experience) => (
      String(experience.id) === String(id) ? { ...experience, photos } : experience
    )));
  }, []);

  return {
    apps,
    exps,
    isLoading,
    updateStatus,
    deleteItem,
    updateExperiencePhotos,
    refresh: fetchApprovals,
  };
}
