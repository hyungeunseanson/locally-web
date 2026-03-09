'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';

const WISHLIST_SYNC_EVENT = 'wishlist:sync';

type WishlistSyncDetail = {
  experienceId: string;
  isSaved: boolean;
};

export function useWishlist(experienceId: string) {
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();

  const syncWishlistState = (nextState: boolean) => {
    setIsSaved(nextState);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent<WishlistSyncDetail>(WISHLIST_SYNC_EVENT, {
          detail: { experienceId, isSaved: nextState },
        })
      );
    }
  };

  // 1. 초기 로딩 시 내가 찜한 건지 확인
  useEffect(() => {
    const checkStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsSaved(false);
        return;
      }

      const { data } = await supabase
        .from('wishlists')
        .select('id')
        .eq('user_id', user.id)
        .eq('experience_id', experienceId)
        .maybeSingle();

      setIsSaved(Boolean(data));
    };

    const handleWishlistSync = (event: Event) => {
      const customEvent = event as CustomEvent<WishlistSyncDetail>;
      if (customEvent.detail?.experienceId === experienceId) {
        setIsSaved(customEvent.detail.isSaved);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(WISHLIST_SYNC_EVENT, handleWishlistSync as EventListener);
    }

    checkStatus();

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(WISHLIST_SYNC_EVENT, handleWishlistSync as EventListener);
      }
    };
  }, [experienceId, supabase]);

  // 2. 찜하기 토글 함수
  const toggleWishlist = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (isLoading) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast('로그인이 필요한 서비스입니다.', 'error');
      return;
    }

    // 낙관적 업데이트 (화면 먼저 바꿈)
    const previousState = isSaved;
    syncWishlistState(!previousState);
    setIsLoading(true);

    try {
      if (previousState) {
        // 이미 저장됨 -> 삭제
        const { error } = await supabase
          .from('wishlists')
          .delete()
          .eq('user_id', user.id)
          .eq('experience_id', experienceId);
        if (error) throw error;
        syncWishlistState(false);
        showToast('위시리스트에서 삭제되었습니다.', 'success');
      } else {
        // 저장 안 됨 -> 추가
        const { error } = await supabase
          .from('wishlists')
          .upsert([{ user_id: user.id, experience_id: experienceId }], {
            onConflict: 'user_id,experience_id',
            ignoreDuplicates: true,
          });
        if (error) throw error;
        syncWishlistState(true);
        showToast('위시리스트에 저장되었습니다!', 'success');
      }
    } catch (error: unknown) {
      // 실패 시 원래대로 복구
      syncWishlistState(previousState);
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      showToast('오류가 발생했습니다: ' + message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return { isSaved, toggleWishlist, isLoading };
}
