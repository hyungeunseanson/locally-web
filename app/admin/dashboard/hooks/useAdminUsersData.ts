'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/app/context/ToastContext';
import type { AdminUserDashboardRow, OnlineUser } from '@/app/types/admin';

const ONLINE_ACTIVITY_WINDOW_MS = 10 * 60 * 1000;

function buildOnlineUsers(rows: AdminUserDashboardRow[]): OnlineUser[] {
  const now = Date.now();

  return rows
    .filter((user) => {
      if (!user.last_active_at) return false;
      const parsed = new Date(user.last_active_at).getTime();
      if (Number.isNaN(parsed)) return false;
      return now - parsed <= ONLINE_ACTIVITY_WINDOW_MS;
    })
    .map((user) => ({
      user_id: user.id,
      is_anonymous: false,
      avatar_url: user.avatar_url ?? null,
      full_name: user.full_name ?? null,
      email: user.email ?? null,
    }));
}

export function useAdminUsersData() {
  const { showToast } = useToast();

  const [users, setUsers] = useState<AdminUserDashboardRow[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/users-summary');
      const result = await response.json();

      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || '회원 로딩 실패');
      }

      const nextUsers = Array.isArray(result?.data) ? result.data as AdminUserDashboardRow[] : [];
      setUsers(nextUsers);
      setOnlineUsers(buildOnlineUsers(nextUsers));
    } catch (error) {
      console.error('[useAdminUsersData] fetch error:', error);
      showToast('회원 데이터를 불러오지 못했습니다.', 'error');
      setUsers([]);
      setOnlineUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

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
      await fetchUsers();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '삭제 실패';
      showToast(`삭제 실패: ${message}`, 'error');
      return false;
    }
  }, [fetchUsers, showToast]);

  return {
    users,
    onlineUsers,
    isLoading,
    deleteItem,
    refresh: fetchUsers,
  };
}
