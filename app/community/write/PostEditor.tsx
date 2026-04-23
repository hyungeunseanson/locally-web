/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, GripVertical, ImagePlus, Loader2, X } from 'lucide-react';

import { createClient } from '@/app/utils/supabase/client';
import { useLanguage } from '@/app/context/LanguageContext';
import { useToast } from '@/app/context/ToastContext';
import { compressImage, isHeicValidationResult, sanitizeFileName, validateImage } from '@/app/utils/image';
import type { CommunityBoard, CommunitySourceLocale } from '@/app/types/community';
import { buildCommunityBoardDetailHref, buildCommunityBoardListHref } from '../queryParams';

const MAX_IMAGES = 3;

type UploadedImage = {
  path: string;
  publicUrl: string;
};

type ProcessedImageFile = File & {
  readonly __processedImage: true;
};

const asProcessedImageFile = (file: File): ProcessedImageFile => file as ProcessedImageFile;

interface PostEditorProps {
  initialBoard: CommunityBoard;
  initialLocale: CommunitySourceLocale;
}

export default function PostEditor({ initialBoard, initialLocale }: PostEditorProps) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();
  const { showToast, showHeicUnsupportedToast } = useToast();
  const [board, setBoard] = useState<CommunityBoard>(initialBoard);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dragSrcIdx = useRef<number | null>(null);
  const canSubmit = title.trim().length > 0 && content.trim().length > 0;
  const boardOptions = useMemo(
    () => [
      { id: 'japan' as const, label: t('community_board_japan') },
      { id: 'korea' as const, label: t('community_board_korea') },
    ],
    [t]
  );

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const files = Array.from(event.target.files);

    if (imageFiles.length + files.length > MAX_IMAGES) {
      showToast(`사진은 최대 ${MAX_IMAGES}장까지만 업로드 가능합니다.`, 'error');
      event.target.value = '';
      return;
    }

    const validFiles = files.filter((file) => {
      const validation = validateImage(file);
      if (validation.valid) return true;

      if (isHeicValidationResult(validation)) {
        showHeicUnsupportedToast(validation.message);
      } else {
        showToast(validation.message || '이미지 파일만 업로드 가능합니다.', 'error');
      }
      return false;
    });

    setImageFiles((prev) => [...prev, ...validFiles]);
    setImageUrls((prev) => [...prev, ...validFiles.map((file) => URL.createObjectURL(file))]);
    event.target.value = '';
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
    setImageUrls((prev) => {
      const nextUrls = [...prev];
      URL.revokeObjectURL(nextUrls[index]);
      nextUrls.splice(index, 1);
      return nextUrls;
    });
  };

  const handleDragStart = (idx: number) => {
    dragSrcIdx.current = idx;
  };

  const handleDrop = (toIdx: number) => {
    const fromIdx = dragSrcIdx.current;
    if (fromIdx === null || fromIdx === toIdx) {
      setDragOverIdx(null);
      return;
    }

    setImageFiles((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return next;
    });
    setImageUrls((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return next;
    });
    dragSrcIdx.current = null;
    setDragOverIdx(null);
  };

  const uploadImages = async (): Promise<UploadedImage[]> => {
    const uploadedImages: UploadedImage[] = [];

    for (const file of imageFiles) {
      const compressed = asProcessedImageFile(await compressImage(file));
      const fileName = sanitizeFileName(compressed.name);
      const filePath = `community/${Date.now()}-${fileName}`;
      const { error } = await supabase.storage
        .from('images')
        .upload(filePath, compressed, { cacheControl: '3600', upsert: false });

      if (error) {
        console.error('Community image upload failed:', error);
        throw new Error('이미지 업로드에 실패했습니다.');
      }

      const { data } = supabase.storage.from('images').getPublicUrl(filePath);
      uploadedImages.push({
        path: filePath,
        publicUrl: data.publicUrl,
      });
    }

    return uploadedImages;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const uploadedImages = await uploadImages();
      const response = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board_country: board,
          source_locale: initialLocale,
          title,
          content,
          images: uploadedImages.map((image) => image.publicUrl),
          image_paths: uploadedImages.map((image) => image.path),
          is_anonymous: isAnonymous,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || '글 등록에 실패했습니다.');
      }

      const { id } = await response.json();
      window.location.href = buildCommunityBoardDetailHref(id, { board });
    } catch (error) {
      const message = error instanceof Error ? error.message : '글 등록에 실패했습니다.';
      showToast(message, 'error');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F9]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <button
          type="button"
          onClick={() => router.push(buildCommunityBoardListHref({ board }))}
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          목록으로
        </button>

        <form onSubmit={handleSubmit} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Write</p>
            <h1 className="mt-2 text-[24px] font-black text-slate-900">커뮤니티 글쓰기</h1>
            <p className="mt-2 text-[14px] leading-6 text-slate-500">
              제목과 본문만 간단히 적어도 바로 게시할 수 있어요.
            </p>
          </div>

          <div className="mb-6 flex items-center gap-2">
            {boardOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                data-testid={`community-write-board-${option.id}`}
                onClick={() => setBoard(option.id)}
                className={`rounded-2xl border px-4 py-2 text-[13px] font-semibold transition-all ${
                  board === option.id
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-[13px] font-semibold text-slate-700">제목</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="게시글 제목을 입력해 주세요"
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-[15px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-semibold text-slate-700">본문</label>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="질문, 추천, 후기 등 자유롭게 남겨주세요."
                rows={10}
                className="w-full rounded-[24px] border border-slate-200 px-4 py-4 text-[15px] leading-7 text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-900"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-[13px] font-semibold text-slate-700">이미지</label>
                <span className="text-[12px] font-medium text-slate-400">{imageFiles.length}/{MAX_IMAGES}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {imageUrls.map((url, index) => (
                  <div
                    key={url}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverIdx(index);
                    }}
                    onDragLeave={() => setDragOverIdx((prev) => (prev === index ? null : prev))}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleDrop(index);
                    }}
                    onDragEnd={() => setDragOverIdx(null)}
                    className={`relative aspect-square overflow-hidden rounded-2xl border bg-slate-50 ${
                      dragOverIdx === index ? 'border-slate-900' : 'border-slate-200'
                    }`}
                  >
                    <img src={url} alt={`업로드 이미지 ${index + 1}`} className="h-full w-full object-cover" />
                    <div className="absolute left-2 top-2 rounded-full bg-black/70 p-1 text-white">
                      <GripVertical size={12} />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-slate-700 shadow-sm"
                      aria-label={`이미지 ${index + 1} 삭제`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

                {imageFiles.length < MAX_IMAGES && (
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700">
                    <ImagePlus size={18} />
                    <span className="mt-2 text-[12px] font-semibold">사진 추가</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </label>
                )}
              </div>
              <p className="mt-2 text-[12px] text-slate-400">최대 3장 · 드래그해서 순서를 바꿀 수 있어요.</p>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(event) => setIsAnonymous(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <div>
                <p className="text-[13px] font-semibold text-slate-700">익명으로 게시하기</p>
                <p className="text-[12px] text-slate-400">댓글 기능은 그대로 사용할 수 있어요.</p>
              </div>
            </label>
          </div>

          <div className="mt-7 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push(buildCommunityBoardListHref({ board }))}
              className="rounded-full border border-slate-200 px-5 py-3 text-[13px] font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="inline-flex min-w-[124px] items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-[13px] font-semibold text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting && <Loader2 size={15} className="animate-spin" />}
              게시하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
