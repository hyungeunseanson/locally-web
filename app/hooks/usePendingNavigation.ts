'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface NavigateOptions {
  onBeforeNavigate?: () => void;
  replace?: boolean;
}

export function usePendingNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [sourceHref, setSourceHref] = useState('/');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = searchParams?.toString() ?? '';
  const currentHref = useMemo(() => {
    const basePath = pathname || '/';
    return search ? `${basePath}?${search}` : basePath;
  }, [pathname, search]);
  const activePendingHref = pendingHref && currentHref === sourceHref ? pendingHref : null;

  const clearPending = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setPendingHref(null);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const navigate = useCallback((href: string, options?: NavigateOptions) => {
    if (!href || activePendingHref || href === currentHref) {
      return;
    }

    options?.onBeforeNavigate?.();
    setSourceHref(currentHref);
    setPendingHref(href);
    router.prefetch(href);

    timeoutRef.current = setTimeout(() => {
      clearPending();
    }, 3500);

    if (options?.replace) {
      router.replace(href);
      return;
    }

    router.push(href);
  }, [activePendingHref, clearPending, currentHref, router]);

  return {
    pendingHref: activePendingHref,
    isNavigating: activePendingHref !== null,
    navigate,
  };
}
