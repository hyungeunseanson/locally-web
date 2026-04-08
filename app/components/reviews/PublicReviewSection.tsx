'use client';

import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { Star, User, X } from 'lucide-react';

import { useLanguage } from '@/app/context/LanguageContext';
import type { PublicReviewItem } from '@/app/utils/reviews/publicReview';

type ReviewSourceProps =
  | {
      experienceId: number | string;
      hostId?: never;
    }
  | {
      hostId: string;
      experienceId?: never;
    };

type ReviewSectionProps = ReviewSourceProps & {
  hostName: string;
  sectionId?: string;
  testId?: string;
};

type PublicReviewPayload = {
  success?: boolean;
  data?: PublicReviewItem[];
  error?: string;
};

function secureUrl(url: string | null) {
  if (!url) return null;
  if (url.startsWith('http://')) return url.replace('http://', 'https://');
  return url;
}

function formatDate(dateString: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}.`;
}

function ReviewAvatar({
  avatarUrl,
  alt,
  sizeClassName,
  imageSize,
}: {
  avatarUrl: string | null;
  alt: string;
  sizeClassName: string;
  imageSize: string;
}) {
  return (
    <div
      data-testid="public-reviewer-avatar"
      className={`relative shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 ${sizeClassName}`}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={alt}
          fill
          sizes={imageSize}
          unoptimized
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-400">
          <User size={14} />
        </div>
      )}
    </div>
  );
}

function ReviewMeta({
  rating,
  createdAt,
  starSize,
  textClassName,
}: {
  rating: number;
  createdAt: string;
  starSize: number;
  textClassName: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 text-slate-500 ${textClassName}`}>
      <div className="flex items-center gap-0.5 text-slate-800">
        {[...Array(5)].map((_, idx) => (
          <Star
            key={idx}
            size={starSize}
            fill={idx < rating ? 'currentColor' : 'none'}
            className={idx < rating ? '' : 'text-slate-300'}
          />
        ))}
      </div>
      <span className="text-slate-300">·</span>
      <span>{formatDate(createdAt)}</span>
    </div>
  );
}

function ReviewReply({
  label,
  reply,
  compact = false,
}: {
  label: string;
  reply: string | null;
  compact?: boolean;
}) {
  if (!reply) return null;

  return (
    <div className={`mt-3 border-l border-slate-200 pl-3 ${compact ? 'space-y-1' : 'space-y-1.5'}`}>
      <div className={`text-slate-700 ${compact ? 'text-[11px] font-medium' : 'text-[12px] font-medium'}`}>
        {label}
      </div>
      <p
        className={`whitespace-pre-wrap text-slate-600 ${
          compact ? 'line-clamp-2 text-[11px] leading-[1.45]' : 'text-[13px] leading-[1.6]'
        }`}
      >
        {reply}
      </p>
    </div>
  );
}

export default function PublicReviewSection(props: ReviewSectionProps) {
  const { t, lang } = useLanguage();
  const reviewHostId = 'hostId' in props ? props.hostId : null;
  const reviewExperienceId = 'experienceId' in props ? props.experienceId : null;
  const [reviews, setReviews] = useState<PublicReviewItem[]>([]);
  const [isReviewsExpanded, setIsReviewsExpanded] = useState(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const fetchReviews = async () => {
      try {
        setLoading(true);

        const endpoint = reviewHostId
          ? `/api/public/hosts/${encodeURIComponent(reviewHostId)}/reviews?lang=${encodeURIComponent(lang)}`
          : `/api/public/experiences/${encodeURIComponent(String(reviewExperienceId))}/reviews?lang=${encodeURIComponent(lang)}`;

        const response = await fetch(endpoint, { cache: 'no-store' });
        const result = (await response.json()) as PublicReviewPayload;

        if (!response.ok) {
          if (response.status === 404) {
            if (isActive) setReviews([]);
            return;
          }

          throw new Error(result.error || 'Failed to load public reviews.');
        }

        if (isActive) {
          setReviews(result.data || []);
        }
      } catch (error) {
        console.error('[PublicReviewSection] review lookup failed:', error);
        if (isActive) setReviews([]);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    void fetchReviews();

    return () => {
      isActive = false;
    };
  }, [lang, reviewExperienceId, reviewHostId]);

  const averageRating = reviews.length > 0
    ? (reviews.reduce((acc, cur) => acc + cur.rating, 0) / reviews.length).toFixed(1)
    : '0.0';
  const sortedReviews = [...reviews].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    return sortOrder === 'latest' ? timeB - timeA : timeA - timeB;
  });
  const previewReviews = [...reviews]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);

  if (loading) {
    return <div className="py-10 text-center text-slate-400">{t('exp_review_loading')}</div>;
  }

  return (
    <div id={props.sectionId} data-testid={props.testId} className="scroll-mt-24 pb-8">
      <h3 className="mb-4 flex items-center gap-1.5 text-[17px] font-semibold tracking-[-0.01em] md:mb-[18px] md:text-[22px]">
        <Star size={14} fill="black" className="md:h-4 md:w-4" /> {averageRating} · {t('exp_review_count', { count: reviews.length })}
      </h3>

      {reviews.length > 0 ? (
        <>
          <div className="-mx-1 overflow-x-auto pb-1 md:hidden">
            <div className="flex min-w-max gap-4 px-1" data-testid="public-review-preview-grid">
              {previewReviews.map((review) => {
                const avatarUrl = secureUrl(review.reviewer.avatar_url);

                return (
                  <article
                    key={review.id}
                    data-testid="public-review-card"
                    className="w-[216px] shrink-0"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <ReviewAvatar
                        avatarUrl={avatarUrl}
                        alt={review.reviewer.display_name}
                        sizeClassName="h-7 w-7"
                        imageSize="28px"
                      />
                      <div className="min-w-0">
                        <div data-testid="public-reviewer-name" className="truncate text-[12px] font-semibold text-slate-900">
                          {review.reviewer.display_name}
                        </div>
                        <ReviewMeta
                          rating={review.rating}
                          createdAt={review.created_at}
                          starSize={10}
                          textClassName="mt-1 text-[11px]"
                        />
                      </div>
                    </div>
                    <p className="line-clamp-2 text-[12px] leading-[1.45] text-slate-700">{review.content || ''}</p>
                    <ReviewReply label={t('hr_host_reply')} reply={review.reply} compact />
                  </article>
                );
              })}
            </div>
          </div>

          <div data-testid="public-review-preview-grid" className="hidden grid-cols-2 gap-x-8 gap-y-6 md:grid">
            {previewReviews.map((review) => {
              const avatarUrl = secureUrl(review.reviewer.avatar_url);

              return (
                <article
                  key={review.id}
                  data-testid="public-review-card"
                  className="min-w-0"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <ReviewAvatar
                      avatarUrl={avatarUrl}
                      alt={review.reviewer.display_name}
                      sizeClassName="h-8 w-8"
                      imageSize="32px"
                    />
                    <div className="min-w-0">
                      <div data-testid="public-reviewer-name" className="truncate text-[13px] font-semibold text-slate-900">
                        {review.reviewer.display_name}
                      </div>
                      <ReviewMeta
                        rating={review.rating}
                        createdAt={review.created_at}
                        starSize={11}
                        textClassName="mt-1 text-[12px]"
                      />
                    </div>
                  </div>
                  <p className="line-clamp-3 text-[13px] leading-[1.45] text-slate-700">{review.content || ''}</p>
                  <ReviewReply label={t('hr_host_reply')} reply={review.reply} compact />
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-5 text-center text-[12px] text-slate-400">
          {t('exp_review_empty_title')}
          <br />
          {t('exp_review_empty_body', { hostName: props.hostName })}
        </div>
      )}

      {reviews.length > 0 && (
        <div className="mt-4 flex justify-center md:justify-start">
          <button
            data-testid="public-review-cta"
            onClick={() => setIsReviewsExpanded(true)}
            className="h-11 w-full rounded-full border border-slate-300 bg-white px-5 text-[13px] font-medium text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50 md:w-auto md:min-w-[180px] md:px-6 md:text-[14px]"
          >
            {t('exp_review_view_all')}
          </button>
        </div>
      )}
      <button
        onClick={() => setIsPolicyOpen(true)}
        className="mt-3 block w-full text-center text-[11px] text-slate-400 underline underline-offset-2 md:w-fit md:text-left"
      >
        {t('exp_review_policy_link')}
      </button>

      {isReviewsExpanded && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsReviewsExpanded(false)}
        >
          <div
            data-testid="public-review-modal"
            className="flex h-[86dvh] w-full max-w-[380px] flex-col overflow-hidden rounded-[24px] bg-[#fcfcfc] shadow-2xl animate-in zoom-in-95 duration-200 md:h-[80vh] md:max-w-[680px] md:rounded-[28px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-start px-5 pb-2 pt-4">
              <button
                onClick={() => setIsReviewsExpanded(false)}
                className="rounded-full p-1.5 text-slate-600 transition-colors hover:bg-slate-100"
              >
                <X size={17} />
              </button>
            </div>

            <div className="px-5 pb-2">
              <h3 className="flex items-center gap-1.5 text-[18px] font-semibold tracking-[-0.02em] md:text-[20px]">
                <Star size={16} fill="black" className="mb-0.5" />
                {averageRating}
              </h3>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[13px] font-medium tracking-[-0.01em] md:text-[14px]">
                  {t('exp_review_count', { count: reviews.length })}
                </p>
                <div className="relative">
                  <select
                    value={sortOrder}
                    onChange={(event) => setSortOrder(event.target.value as 'latest' | 'oldest')}
                    className="appearance-none rounded-full border border-slate-300 bg-white py-1.5 pl-3.5 pr-7 text-[12px] font-normal text-slate-700"
                  >
                    <option value="latest">{t('exp_review_sort_latest')}</option>
                    <option value="oldest">{t('exp_review_sort_oldest')}</option>
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                    ⌄
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-6">
              <div className="space-y-0">
                {sortedReviews.map((review) => {
                  const avatarUrl = secureUrl(review.reviewer.avatar_url);

                  return (
                    <article key={review.id} data-testid="public-review-card" className="border-b border-slate-200 py-5">
                      <div className="flex gap-3">
                        <ReviewAvatar
                          avatarUrl={avatarUrl}
                          alt={review.reviewer.display_name}
                          sizeClassName="h-8 w-8"
                          imageSize="32px"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="text-slate-900">
                            <div data-testid="public-reviewer-name" className="text-[13px] font-semibold leading-none">
                              {review.reviewer.display_name}
                            </div>
                            <ReviewMeta
                              rating={review.rating}
                              createdAt={review.created_at}
                              starSize={11}
                              textClassName="mt-2 text-[12px]"
                            />
                            <p className="mt-3 whitespace-pre-wrap text-[13px] font-normal leading-[1.6] text-slate-700">
                              {review.content || ''}
                            </p>
                            <ReviewReply label={t('hr_host_reply')} reply={review.reply} />
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {isPolicyOpen && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onClick={() => setIsPolicyOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 className="mb-3 text-[15px] font-semibold">{t('exp_review_policy_title')}</h4>
            <div className="space-y-2 text-[12px] leading-relaxed text-slate-600">
              <p>{t('exp_review_policy_line_1')}</p>
              <p>{t('exp_review_policy_line_2')}</p>
              <p>{t('exp_review_policy_line_3')}</p>
              <p>{t('exp_review_policy_line_4')}</p>
            </div>
            <button
              onClick={() => setIsPolicyOpen(false)}
              className="mt-4 w-full rounded-xl bg-slate-100 py-2.5 text-[12px] font-medium text-slate-700 hover:bg-slate-200"
            >
              {t('common_close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
