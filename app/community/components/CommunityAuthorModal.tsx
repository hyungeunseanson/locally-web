'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Globe, Languages, Loader2, PenSquare, Smile, User, X } from 'lucide-react';
import { formatGenderLabel } from '@/app/utils/profile';
import { getCommunityCategoryMeta } from '../categoryMeta';
import type { CommunityCategory } from '@/app/types/community';

type RecentPostRow = {
  id: string;
  title: string;
  category: CommunityCategory;
  created_at: string;
  is_anonymous: boolean;
};

type CommunityAuthorProfileState = {
  joinedAt: string | null;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  mbti: string | null;
  languages: string[];
  gender: string | null;
  role: 'host' | 'guest';
};

interface CommunityAuthorModalProps {
  userId: string;
  currentPostId?: string;
  isOpen: boolean;
  onClose: () => void;
}

function getTimeAgo(dateStr: string) {
  try {
    const rtf = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });
    const diff = (new Date(dateStr).getTime() - Date.now()) / 1000;
    if (Math.abs(diff) < 60) return '방금 전';
    if (Math.abs(diff) < 3600) return rtf.format(Math.floor(diff / 60), 'minute');
    if (Math.abs(diff) < 86400) return rtf.format(Math.floor(diff / 3600), 'hour');
    return rtf.format(Math.floor(diff / 86400), 'day');
  } catch {
    return dateStr;
  }
}

function formatJoinDate(dateString: string | null) {
  if (!dateString) return '가입일 정보 없음';
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
  });
}

function LoadingBody() {
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="rounded-2xl bg-slate-50 p-4">
            <div className="mb-2 h-3 w-20 animate-pulse rounded-full bg-slate-200" />
            <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200" />
          </div>
        ))}
      </div>

      <section className="mb-8">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">About</h3>
        <div className="rounded-3xl bg-slate-50 p-5">
          <div className="mb-3 h-4 w-full animate-pulse rounded-full bg-slate-200" />
          <div className="mb-3 h-4 w-5/6 animate-pulse rounded-full bg-slate-200" />
          <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-200" />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <PenSquare size={16} className="text-slate-500" />
          <h3 className="text-[16px] font-bold text-slate-900">이 사용자가 쓴 글</h3>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="rounded-3xl border border-slate-100 px-4 py-4">
              <div className="mb-3 h-4 w-16 animate-pulse rounded-full bg-slate-200" />
              <div className="mb-2 h-4 w-4/5 animate-pulse rounded-full bg-slate-200" />
              <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export default function CommunityAuthorModal({
  userId,
  currentPostId,
  isOpen,
  onClose,
}: CommunityAuthorModalProps) {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<CommunityAuthorProfileState | null>(null);
  const [recentPosts, setRecentPosts] = useState<RecentPostRow[]>([]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErrorMessage(null);
      setProfile(null);
      setRecentPosts([]);

      try {
        const params = new URLSearchParams();
        if (currentPostId) {
          params.set('exclude_post_id', currentPostId);
        }

        const queryString = params.toString();
        const response = await fetch(
          queryString
            ? `/api/community/authors/${userId}?${queryString}`
            : `/api/community/authors/${userId}`,
          { cache: 'no-store' }
        );
        const payload = await response.json().catch(() => null);

        if (cancelled) return;

        if (!response.ok) {
          setErrorMessage(
            typeof payload?.error === 'string' ? payload.error : '프로필 정보를 불러오지 못했습니다.'
          );
          return;
        }

        setProfile((payload?.profile ?? null) as CommunityAuthorProfileState | null);
        setRecentPosts((payload?.recentPosts ?? []) as RecentPostRow[]);
      } catch {
        if (!cancelled) {
          setErrorMessage('프로필 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [currentPostId, isOpen, userId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[180] flex items-end md:items-center justify-center bg-black/60 md:px-4 md:py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        data-testid="community-author-modal"
        className="flex max-h-[85vh] md:max-h-[88vh] w-full md:max-w-lg flex-col overflow-hidden rounded-t-[28px] md:rounded-[30px] bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.18)] md:shadow-[0_24px_80px_rgba(15,23,42,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* 모바일 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-1 md:hidden flex-shrink-0">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        <div className="relative border-b border-slate-100 bg-slate-50 px-5 pb-4 pt-3 md:px-6 md:pb-6 md:pt-8">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-3 md:top-4 inline-flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full bg-white/90 text-slate-500 transition-colors hover:text-slate-900"
          >
            <X size={17} />
          </button>

          {loading ? (
            <div className="flex min-h-24 md:min-h-36 items-center gap-3 md:gap-4">
              <div className="flex h-16 w-16 md:h-24 md:w-24 shrink-0 items-center justify-center rounded-full border-4 border-white bg-slate-200 text-slate-300 shadow-lg">
                <Loader2 size={22} className="animate-spin text-slate-300" />
              </div>
              <div className="flex-1">
                <div className="mb-2 h-3 w-24 animate-pulse rounded-full bg-slate-200" />
                <div className="mb-2 h-6 w-36 animate-pulse rounded-full bg-slate-200" />
                <p className="text-[13px] font-medium text-slate-400">불러오는 중...</p>
              </div>
            </div>
          ) : profile ? (
            <div className="flex items-center gap-3 md:items-end md:gap-4">
              <div className="flex h-16 w-16 md:h-24 md:w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-200 text-slate-300 shadow-lg">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.displayName} className="h-full w-full object-cover" />
                ) : (
                  <User size={24} className="md:hidden" />
                )}
                {!profile.avatarUrl && <User size={32} className="hidden md:block" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 md:mb-2 flex flex-wrap items-center gap-1.5 md:gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 md:px-2.5 md:py-1 text-[10px] md:text-[11px] font-bold ${
                      profile.role === 'host'
                        ? 'bg-neutral-900 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {profile.role === 'host' ? 'Host' : 'Guest'}
                  </span>
                  <span className="text-[11px] md:text-[12px] font-medium text-slate-400">
                    {formatJoinDate(profile.joinedAt)}
                  </span>
                </div>
                <h2 className="break-words text-[20px] md:text-[24px] font-black text-slate-900 [overflow-wrap:anywhere]">
                  {profile.displayName}
                </h2>
              </div>
            </div>
          ) : (
            <div className="flex h-36 items-center justify-center text-sm text-slate-400">
              {errorMessage || '프로필 정보를 불러오지 못했습니다.'}
            </div>
          )}
        </div>

        <div className="overflow-y-auto px-4 py-4 md:px-6 md:py-6">
          {loading ? (
            <LoadingBody />
          ) : profile ? (
            <>
              <div className="mb-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-slate-500">
                    <Globe size={14} />
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em]">Location</span>
                  </div>
                  <p className="break-words text-sm font-semibold text-slate-800 [overflow-wrap:anywhere]">
                    {profile.location || '미입력'}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-slate-500">
                    <Smile size={14} />
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em]">MBTI</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{profile.mbti || '비공개'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-slate-500">
                    <Languages size={14} />
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em]">Languages</span>
                  </div>
                  <p className="break-words text-sm font-semibold text-slate-800 [overflow-wrap:anywhere]">
                    {profile.languages.length > 0 ? profile.languages.join(', ') : '미입력'}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-slate-500">
                    <User size={14} />
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em]">Gender</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{formatGenderLabel(profile.gender)}</p>
                </div>
              </div>

              <section className="mb-8">
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">About</h3>
                <div className="rounded-3xl bg-slate-50 p-5 text-[15px] leading-7 text-slate-700">
                  <p className="break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {profile.bio || '아직 작성된 소개가 없습니다.'}
                  </p>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <PenSquare size={16} className="text-slate-500" />
                  <h3 className="text-[16px] font-bold text-slate-900">이 사용자가 쓴 글</h3>
                </div>

                {recentPosts.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-400">
                    공개된 최근 커뮤니티 글이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentPosts.map((post) => {
                      const meta = getCommunityCategoryMeta(post.category);
                      return (
                        <Link
                          key={post.id}
                          href={`/community/${post.id}?category=${post.category}`}
                          className="group flex items-start gap-3 rounded-3xl border border-slate-100 px-4 py-4 transition-colors hover:border-slate-200 hover:bg-slate-50"
                          data-testid="community-author-modal-post"
                        >
                          <span className={`mt-0.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${meta.badgeClassName}`}>
                            {meta.shortLabel}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 break-words text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">
                              {post.title}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-[12px] text-slate-400">
                              <span>{getTimeAgo(post.created_at)}</span>
                            </div>
                          </div>
                          <ChevronRight size={16} className="mt-0.5 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
