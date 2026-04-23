import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { createClient } from '@/app/utils/supabase/server';
import { getCurrentLocale } from '@/app/utils/locale';
import PostEditor from './PostEditor';
import { resolveCommunityBoard } from '../boardMeta';

export const metadata: Metadata = {
  title: '커뮤니티 글쓰기 | Locally',
  description: '여행 커뮤니티 게시판에 새로운 글을 작성합니다.',
  robots: { index: false, follow: false },
};

export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const board = resolveCommunityBoard(params?.board as string);
  const locale = await getCurrentLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?returnUrl=${encodeURIComponent(`/community/write?board=${board}`)}`);
  }

  return <PostEditor initialBoard={board} initialLocale={locale} />;
}
