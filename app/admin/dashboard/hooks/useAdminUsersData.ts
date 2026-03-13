'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import type { Profile } from '@/app/types';

type OnlineUser = {
  user_id: string;
  [key: string]: unknown;
};

function isOnlineUser(value: unknown): value is OnlineUser {
  return typeof value === 'object' && value !== null && 'user_id' in value;
}

export function useAdminUsersData() {
  const supabase = createClient();
  const { showToast } = useToast();

  const [users, setUsers] = useState<Profile[]>([]);
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

      setUsers(Array.isArray(result?.data) ? result.data : []);
    } catch (error) {
      console.error('[useAdminUsersData] fetch error:', error);
      showToast('회원 데이터를 불러오지 못했습니다.', 'error');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchUsers();

    const presenceChannel = supabase
      .channel('online_users')
      .on('presence', { event: 'sync' }, () => {
        const presenceState = presenceChannel.presenceState();
        const syncedUsers = (Object.values(presenceState).flat() as unknown[]).filter(isOnlineUser);
        const uniqueUsers = Array.from(
          new Map(syncedUsers.map((user) => [user.user_id, user])).values()
        );
        setOnlineUsers(uniqueUsers);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [fetchUsers, supabase]);

  const deleteItem = useCallback(async (table: string, id: string) => {
    if (!confirm('정말 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return false;
    }

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
