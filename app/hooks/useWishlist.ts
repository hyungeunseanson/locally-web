'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { useToast } from '@/app/context/ToastContext';

const WISHLIST_SYNC_EVENT = 'wishlist:sync';
const WISHLIST_PENDING_EVENT = 'wishlist:pending';

type WishlistSyncDetail = {
  experienceId: string;
  isSaved: boolean;
};

type WishlistPendingDetail = {
  experienceId: string;
  isLoading: boolean;
};

export function useWishlist(experienceId: string) {
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user, isLoading: isAuthLoading } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const userId = user?.id ?? null;
  const statusRequestRef = useRef(0);
  const isPendingRef = useRef(false);

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

  const syncWishlistPending = (nextState: boolean) => {
    isPendingRef.current = nextState;
    setIsLoading(nextState);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent<WishlistPendingDetail>(WISHLIST_PENDING_EVENT, {
          detail: { experienceId, isLoading: nextState },
        })
      );
    }
  };

  // 1. 초기 로딩 시 내가 찜한 건지 확인
  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    let cancelled = false;
    const requestId = ++statusRequestRef.current;

    const handleWishlistSync = (event: Event) => {
      const customEvent = event as CustomEvent<WishlistSyncDetail>;
      if (customEvent.detail?.experienceId === experienceId) {
        setIsSaved(customEvent.detail.isSaved);
      }
    };

    const handleWishlistPending = (event: Event) => {
      const customEvent = event as CustomEvent<WishlistPendingDetail>;
      if (customEvent.detail?.experienceId === experienceId) {
        isPendingRef.current = customEvent.detail.isLoading;
        setIsLoading(customEvent.detail.isLoading);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(WISHLIST_SYNC_EVENT, handleWishlistSync as EventListener);
      window.addEventListener(WISHLIST_PENDING_EVENT, handleWishlistPending as EventListener);
    }

    if (!userId) {
      if (!isPendingRef.current) {
        setIsSaved(false);
        setIsLoading(false);
      }

      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener(WISHLIST_SYNC_EVENT, handleWishlistSync as EventListener);
          window.removeEventListener(WISHLIST_PENDING_EVENT, handleWishlistPending as EventListener);
        }
      };
    }

    const checkStatus = async () => {
      try {
        const response = await fetch(
          `/api/guest/wishlists?experienceId=${encodeURIComponent(experienceId)}`,
          { cache: 'no-store' }
        );

        if (cancelled || requestId !== statusRequestRef.current || isPendingRef.current) {
          return;
        }

        if (!response.ok) {
          console.error('Wishlist status check failed:', response.status);
          return;
        }

        const result = (await response.json()) as { isSaved?: boolean };
        setIsSaved(Boolean(result.isSaved));
      } catch (error) {
        if (cancelled || requestId !== statusRequestRef.current || isPendingRef.current) {
          return;
        }

        console.error('Wishlist status check failed:', error);
      }
    };

    void checkStatus();

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener(WISHLIST_SYNC_EVENT, handleWishlistSync as EventListener);
        window.removeEventListener(WISHLIST_PENDING_EVENT, handleWishlistPending as EventListener);
      }
    };
  }, [experienceId, isAuthLoading, userId]);

  // 2. 찜하기 토글 함수
  const toggleWishlist = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (isAuthLoading || isLoading) return;

    if (!userId) {
      showToast(t('login_required'), 'error');
      return;
    }

    // 낙관적 업데이트 (화면 먼저 바꿈)
    const previousState = isSaved;
    statusRequestRef.current += 1;
    syncWishlistState(!previousState);
    syncWishlistPending(true);

    try {
      if (previousState) {
        const response = await fetch('/api/guest/wishlists', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ experienceId }),
        });
        if (!response.ok) throw new Error('wishlist-delete-failed');
        syncWishlistState(false);
        showToast('위시리스트에서 삭제되었습니다.', 'success');
      } else {
        const response = await fetch('/api/guest/wishlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ experienceId }),
        });
        if (!response.ok) throw new Error('wishlist-save-failed');
        syncWishlistState(true);
        showToast('위시리스트에 저장되었습니다!', 'success');
      }
    } catch (error: unknown) {
      // 실패 시 원래대로 복구
      syncWishlistState(previousState);
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      showToast('오류가 발생했습니다: ' + message, 'error');
    } finally {
      syncWishlistPending(false);
    }
  };

  return { isSaved, toggleWishlist, isLoading };
}
