'use client';

import Link from 'next/link';
import { Edit3 } from 'lucide-react';
import { createPortal } from 'react-dom';

import { useAuth } from '@/app/context/AuthContext';
import { useHydrated } from '@/app/hooks/useHydrated';
import type { CommunityBoard } from '@/app/types/community';

type CommunityWriteCtaVariant = 'desktop' | 'mobile' | 'empty';

interface CommunityWriteCtaProps {
  board: CommunityBoard;
  variant: CommunityWriteCtaVariant;
}

export default function CommunityWriteCta({ board, variant }: CommunityWriteCtaProps) {
  const { user, isLoading } = useAuth();
  const hydrated = useHydrated();

  if (isLoading || !user) {
    return null;
  }

  const href = `/community/write?board=${board}`;

  if (variant === 'mobile') {
    if (!hydrated) return null;

    return createPortal(
      <Link
        href={href}
        data-testid="community-write-cta-mobile"
        className="fixed bottom-20 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#111111] text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)] transition-all hover:bg-black active:scale-95 md:hidden"
        aria-label="글쓰기"
      >
        <Edit3 size={20} strokeWidth={2.5} />
      </Link>,
      document.body
    );
  }

  if (variant === 'empty') {
    return (
      <Link
        href={href}
        data-testid="community-write-cta-empty"
        className="inline-flex rounded-full bg-[#111111] px-6 py-2.5 text-[14px] font-bold text-white shadow-[0_10px_22px_rgba(15,23,42,0.14)] transition-all hover:bg-black active:scale-95"
      >
        글 작성하기
      </Link>
    );
  }

  return (
    <Link
      href={href}
      data-testid="community-write-cta-desktop"
      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-[13px] font-semibold text-white transition-all hover:bg-black"
    >
      글쓰기
    </Link>
  );
}
