'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const FALLBACK_CLEAR_DELAY_MS = 1600;

function normalizeHref(href: string) {
    if (!href) return '';
    try {
        const parsed = new URL(href, 'https://locally.local');
        return `${parsed.pathname}${parsed.search}`;
    } catch {
        return href;
    }
}

export function usePendingNavigation() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [pendingHref, setPendingHref] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const clearTimerRef = useRef<number | null>(null);
    const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const activePendingHref = pendingHref === currentUrl ? null : pendingHref;

    useEffect(() => {
        return () => {
            if (clearTimerRef.current) {
                window.clearTimeout(clearTimerRef.current);
            }
        };
    }, []);

    const navigate = useCallback((href: string) => {
        const normalizedHref = normalizeHref(href);
        if (!normalizedHref || normalizedHref === currentUrl || activePendingHref === normalizedHref) {
            return;
        }

        setPendingHref(normalizedHref);
        if (clearTimerRef.current) {
            window.clearTimeout(clearTimerRef.current);
        }
        clearTimerRef.current = window.setTimeout(() => {
            setPendingHref(null);
            clearTimerRef.current = null;
        }, FALLBACK_CLEAR_DELAY_MS);

        startTransition(() => {
            router.push(normalizedHref);
        });
    }, [activePendingHref, currentUrl, router]);

    return {
        navigate,
        pendingHref: activePendingHref,
        isPending,
        isNavigating: isPending || activePendingHref !== null,
    };
}
