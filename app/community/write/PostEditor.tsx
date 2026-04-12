'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { useLanguage } from '@/app/context/LanguageContext';
import { useToast } from '@/app/context/ToastContext';
import { compressImage, sanitizeFileName, validateImage, isHeicValidationResult } from '@/app/utils/image';
import DatePicker from '@/app/components/DatePicker';
import { ArrowLeft, CalendarDays, ChevronRight, GripVertical, ImagePlus, Loader2, MapPin, Sparkles, X } from 'lucide-react';

import type { CommunityCategory, CommunityHub, CommunityPostFormat, CommunitySourceLocale } from '@/app/types/community';
import { getCommunityCategoryFromFormat, getCommunityFormatFromCategory, getCommunityFormatMeta } from '../categoryMeta';
import { COMMUNITY_HUB_OPTIONS, getCommunityHubMeta } from '../hubMeta';
import { buildCommunityDetailHref } from '../queryParams';

const MAX_IMAGES = 10;
const WRITABLE_FORMATS: CommunityPostFormat[] = ['question', 'companion', 'live_tip', 'locally_pick'];
const LOCALE_OPTIONS: Array<{ id: CommunitySourceLocale; label: string }> = [
    { id: 'ko', label: '한국어' },
    { id: 'ja', label: '日本語' },
    { id: 'en', label: 'English' },
    { id: 'zh', label: '中文' },
];

const TEMPLATE_BODIES: Record<CommunityPostFormat, string> = {
    question: '언제 가는지:\n누구와 가는지:\n예산:\n가장 고민되는 포인트:\n',
    companion: '인원:\n대략 일정:\n원하는 분위기:\n간단한 자기소개:\n',
    live_tip: '언제:\n어디:\n무슨 상황인지:\n참고하면 좋은 한 줄:\n',
    locally_pick: '핵심 포인트:\n추천 동선:\n꼭 체크할 것:\n현지 팁:\n',
};

const formatDateLabel = (dateString: string) => {
    if (!dateString) return '날짜 선택';
    const [year, month, day] = dateString.split('-').map(Number);
    if (!year || !month || !day) return dateString;
    return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
};

const formatDateForStorage = (date: Date | null) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseStoredDate = (dateString: string) => {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
};

type UploadedImage = {
    path: string;
    publicUrl: string;
};

type ProcessedImageFile = File & {
    readonly __processedImage: true;
};

const asProcessedImageFile = (file: File): ProcessedImageFile => file as ProcessedImageFile;

interface PostEditorProps {
    initialCategory: CommunityCategory;
    initialFormat: CommunityPostFormat;
    initialHub: CommunityHub | null;
    initialLocale: CommunitySourceLocale;
    canWriteLocallyContent: boolean;
}

export default function PostEditor({
    initialCategory,
    initialFormat,
    initialHub,
    initialLocale,
    canWriteLocallyContent,
}: PostEditorProps) {
    const router = useRouter();
    const { t } = useLanguage();
    const supabase = createClient();
    const { showToast, showHeicUnsupportedToast } = useToast();
    const availableFormats = useMemo(
        () => WRITABLE_FORMATS.filter((item) => canWriteLocallyContent || item !== 'locally_pick'),
        [canWriteLocallyContent],
    );

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [format, setFormat] = useState<CommunityPostFormat>(initialFormat || getCommunityFormatFromCategory(initialCategory));
    const [selectedHub, setSelectedHub] = useState<CommunityHub | null>(initialHub);
    const [sourceLocale, setSourceLocale] = useState<CommunitySourceLocale>(initialLocale);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const dragSrcIdx = useRef<number | null>(null);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [companionDate, setCompanionDate] = useState('');
    const [companionCity, setCompanionCity] = useState('');
    const [isDateModalOpen, setIsDateModalOpen] = useState(false);
    const [draftCompanionDate, setDraftCompanionDate] = useState<Date | null>(parseStoredDate(companionDate));

    const selectedDateRange = useMemo(
        () => ({ start: draftCompanionDate, end: null }),
        [draftCompanionDate],
    );

    const category = getCommunityCategoryFromFormat(format);
    const formatMeta = getCommunityFormatMeta(format);
    const isLocallyPick = format === 'locally_pick';
    const isCompanion = format === 'companion';
    const canWriteAnonymously = format !== 'locally_pick';
    const trimmedTitleLength = title.trim().length;
    const trimmedContentLength = content.trim().length;
    const canSubmit = Boolean(
        title.trim().length > 0
        && content.trim().length > 0
        && selectedHub
        && (!isCompanion || (companionDate && companionCity.trim()))
    );
    const editorTitle = isLocallyPick ? '로컬리 콘텐츠 작성' : '커뮤니티 글쓰기';
    const editorSubtitle = isLocallyPick
        ? '검색 유입용 공개 콘텐츠를 발행하기 전에 핵심 정보와 품질을 함께 점검합니다.'
        : '도시 허브와 포맷을 먼저 고르면 1분 안에 올릴 수 있습니다.';

    useEffect(() => {
        if (format === 'locally_pick' && isAnonymous) {
            setIsAnonymous(false);
        }
    }, [format, isAnonymous]);

    useEffect(() => {
        if (isCompanion && !companionCity.trim() && selectedHub) {
            setCompanionCity(getCommunityHubMeta(selectedHub).label);
        }
    }, [companionCity, isCompanion, selectedHub]);

    const openDateModal = () => {
        setDraftCompanionDate(parseStoredDate(companionDate));
        setIsDateModalOpen(true);
    };

    const applyTemplate = () => {
        setTitle((prev) => (prev.trim() ? prev : formatMeta.templateTitlePlaceholder));
        setContent((prev) => (prev.trim() ? prev : TEMPLATE_BODIES[format]));
    };

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

    const handleDragStart = (e: React.DragEvent, idx: number) => {
        dragSrcIdx.current = idx;
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverIdx !== idx) setDragOverIdx(idx);
    };

    const handleDrop = (e: React.DragEvent, toIdx: number) => {
        e.preventDefault();
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

    const handleDragEnd = () => {
        dragSrcIdx.current = null;
        setDragOverIdx(null);
    };

    const uploadProcessedImage = async (filePath: string, file: ProcessedImageFile) => {
        const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (uploadError) {
            console.error('Image upload failed:', uploadError);
            throw new Error('이미지 업로드에 실패했습니다.');
        }

        const { data } = supabase.storage.from('images').getPublicUrl(filePath);
        return data.publicUrl;
    };

    const uploadImages = async (): Promise<UploadedImage[]> => {
        const uploadedImages: UploadedImage[] = [];

        for (const file of imageFiles) {
            const compressed = asProcessedImageFile(await compressImage(file));
            const fileName = sanitizeFileName(compressed.name);
            const filePath = `community/${Date.now()}-${fileName}`;
            uploadedImages.push({
                path: filePath,
                publicUrl: await uploadProcessedImage(filePath, compressed),
            });
        }

        return uploadedImages;
    };

    const handleSubmit = async (event?: React.FormEvent) => {
        event?.preventDefault();

        if (!selectedHub) {
            alert('도시 허브를 선택해주세요.');
            return;
        }

        if (!title.trim() || !content.trim()) {
            alert('제목과 내용을 입력해주세요.');
            return;
        }

        if (isCompanion && (!companionDate || !companionCity.trim())) {
            alert('동행 날짜와 지역을 입력해주세요.');
            return;
        }

        setIsSubmitting(true);

        try {
            const uploadedImages = await uploadImages();
            const finalImageUrls = uploadedImages.map((image) => image.publicUrl);
            const finalImagePaths = uploadedImages.map((image) => image.path);

            const response = await fetch('/api/community/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category,
                    post_format: format,
                    destination_hub: selectedHub,
                    source_locale: sourceLocale,
                    title,
                    content,
                    images: finalImageUrls,
                    image_paths: finalImagePaths,
                    is_anonymous: canWriteAnonymously ? isAnonymous : false,
                    companion_date: isCompanion ? companionDate || undefined : undefined,
                    companion_city: isCompanion ? companionCity.trim() || undefined : undefined,
                    linked_exp_id: null,
                }),
            });

            if (!response.ok) throw new Error('글 등록에 실패했습니다.');

            const { id } = await response.json();
            window.location.href = buildCommunityDetailHref(id, {
                hub: selectedHub,
                format,
                category,
            });
        } catch (error) {
            console.error(error);
            const message = error instanceof Error ? error.message : '글 등록 중 오류가 발생했습니다.';
            alert(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F7F7F9]">
            <div className="mx-auto max-w-4xl px-4 py-5 md:px-6 md:py-10">
                <div className="mb-5 flex items-center justify-between md:mb-6">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50"
                        aria-label={t('button_back')}
                    >
                        <ArrowLeft size={20} />
                    </button>

                    <div className="text-center">
                        <h1 className="text-[18px] font-semibold text-slate-900 md:text-[22px]">{editorTitle}</h1>
                        <p className="mt-1 hidden text-[13px] text-slate-500 md:block">{editorSubtitle}</p>
                    </div>

                    <button
                        type="button"
                        onClick={() => handleSubmit()}
                        disabled={isSubmitting || !canSubmit}
                        className="inline-flex h-11 items-center justify-center rounded-full bg-[#FF385C] px-5 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(255,56,92,0.22)] transition-colors hover:bg-[#E31C5F] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                    >
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : '등록'}
                    </button>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.06)]"
                >
                    <div className="border-b border-slate-100 px-5 py-5 md:px-8 md:py-6">
                        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">포맷 선택</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {availableFormats.map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => setFormat(item)}
                                    className={`rounded-full border px-4 py-2 text-[12px] font-semibold transition-colors md:text-[13px] ${
                                        format === item
                                            ? 'border-slate-900 bg-slate-900 text-white'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                                    }`}
                                >
                                    {getCommunityFormatMeta(item).label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6 px-5 py-5 md:px-8 md:py-8">
                        <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 md:px-6">
                            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">도시 허브</div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                                {COMMUNITY_HUB_OPTIONS.map((hub) => {
                                    const hubMeta = getCommunityHubMeta(hub);
                                    const isActive = selectedHub === hub;
                                    return (
                                        <button
                                            key={hub}
                                            type="button"
                                            onClick={() => setSelectedHub(hub)}
                                            className={`rounded-[20px] border px-4 py-3 text-left transition-colors ${
                                                isActive
                                                    ? 'border-slate-900 bg-slate-900 text-white'
                                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className={`text-[10px] font-black uppercase tracking-[0.16em] ${isActive ? 'text-white/65' : 'text-slate-400'}`}>
                                                {hubMeta.eyebrow}
                                            </div>
                                            <div className="mt-1 text-[14px] font-semibold">{hubMeta.label}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 md:px-6">
                            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">원문 언어</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {LOCALE_OPTIONS.map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => setSourceLocale(option.id)}
                                        className={`rounded-full border px-4 py-2 text-[12px] font-semibold transition-colors ${
                                            sourceLocale === option.id
                                                ? 'border-[#FF385C] bg-[#FFF1F4] text-[#E31C5F]'
                                                : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-[#FFD7E0] bg-[#FFF7F9] px-5 py-4 md:px-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#FF385C]">
                                        <Sparkles size={14} />
                                        Quick Template
                                    </div>
                                    <h3 className="mt-2 text-[16px] font-semibold text-slate-900">{formatMeta.helperTitle}</h3>
                                    <p className="mt-1 text-[13px] leading-6 text-slate-500">{formatMeta.helperDescription}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={applyTemplate}
                                    className="rounded-full border border-[#FFCAD6] bg-white px-4 py-2 text-[12px] font-semibold text-[#E31C5F] transition-colors hover:bg-[#FFF1F4]"
                                >
                                    템플릿 넣기
                                </button>
                            </div>
                        </div>

                        {isLocallyPick && (
                            <div
                                data-testid="community-content-editorial-checklist"
                                className="rounded-[24px] border border-amber-200 bg-amber-50/80 px-5 py-4 md:px-6"
                            >
                                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-700">
                                    Editorial Checklist
                                </div>
                                <h3 className="mt-2 text-[16px] font-semibold text-slate-900">
                                    로컬리 콘텐츠 발행 전 체크
                                </h3>
                                <p className="mt-1 text-[13px] leading-6 text-slate-600">
                                    강제로 막지는 않지만, 검색 유입용 콘텐츠는 아래 기준을 맞추는 편이 가장 안전합니다.
                                </p>

                                <ul className="mt-4 space-y-2 text-[13px] text-slate-700">
                                    {[
                                        {
                                            label: '대표 이미지 1장 이상',
                                            met: imageFiles.length > 0,
                                            note: '검색 썸네일 품질을 위해 권장',
                                        },
                                        {
                                            label: '제목 8자 이상',
                                            met: trimmedTitleLength >= 8,
                                            note: `현재 ${trimmedTitleLength}자`,
                                        },
                                        {
                                            label: '본문 40자 이상',
                                            met: trimmedContentLength >= 40,
                                            note: `현재 ${trimmedContentLength}자`,
                                        },
                                    ].map((item) => (
                                        <li
                                            key={item.label}
                                            className="flex items-start justify-between gap-3 rounded-2xl border border-white/80 bg-white/70 px-4 py-3"
                                        >
                                            <div className="min-w-0">
                                                <div className="font-semibold text-slate-900">{item.label}</div>
                                                <div className="mt-1 text-[12px] text-slate-500">{item.note}</div>
                                            </div>
                                            <span
                                                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                                    item.met
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                }`}
                                            >
                                                {item.met ? '충족' : '권장'}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {canWriteAnonymously && (
                            <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 md:px-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">작성 옵션</div>
                                        <h3 className="mt-1 text-[16px] font-semibold text-slate-900">익명으로 작성</h3>
                                        <p className="mt-1 text-[13px] text-slate-500">
                                            게시글 목록과 상세에서 작성자 이름 대신 익명으로 표시됩니다.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={isAnonymous}
                                        onClick={() => setIsAnonymous((prev) => !prev)}
                                        className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${
                                            isAnonymous ? 'bg-slate-900' : 'bg-slate-200'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${
                                                isAnonymous ? 'translate-x-7' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                </div>
                            </div>
                        )}

                        {isCompanion && (
                            <div className="grid gap-3 md:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={openDateModal}
                                    className="flex h-[58px] items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-left transition-colors hover:border-slate-300"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                                            <CalendarDays size={18} />
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">날짜</div>
                                            <div className={`text-[14px] font-semibold ${companionDate ? 'text-slate-900' : 'text-slate-400'}`}>
                                                {formatDateLabel(companionDate)}
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-400" />
                                </button>

                                <div className="flex h-[58px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                                        <MapPin size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder={selectedHub ? getCommunityHubMeta(selectedHub).label : '도시를 입력하세요'}
                                        value={companionCity}
                                        onChange={(event) => setCompanionCity(event.target.value)}
                                        className="w-full bg-transparent text-[14px] font-medium text-slate-900 placeholder:text-slate-400 outline-none"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 md:px-6">
                            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">제목</div>
                            <input
                                type="text"
                                placeholder={formatMeta.templateTitlePlaceholder}
                                value={title}
                                maxLength={200}
                                onChange={(event) => setTitle(event.target.value)}
                                className="w-full bg-transparent text-[24px] font-semibold text-slate-900 placeholder:text-slate-300 outline-none md:text-[30px]"
                            />
                        </div>

                        <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 md:px-6 md:py-5">
                            <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">본문</div>
                            <textarea
                                placeholder={formatMeta.templateBodyPlaceholder}
                                value={content}
                                maxLength={10000}
                                onChange={(event) => setContent(event.target.value)}
                                className="h-[280px] w-full resize-none bg-transparent text-[15px] leading-7 text-slate-800 placeholder:text-slate-300 outline-none md:h-[340px] md:text-[16px]"
                            />
                        </div>

                        <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 md:px-6 md:py-5">
                            <div className="mb-3 flex items-center justify-between">
                                <div>
                                    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">이미지</div>
                                    <p className="mt-1 text-[13px] text-slate-500">최대 {MAX_IMAGES}장 · 드래그해서 순서 변경 가능</p>
                                </div>
                                <span className={`text-[12px] font-semibold ${imageFiles.length >= MAX_IMAGES ? 'text-rose-400' : 'text-slate-400'}`}>
                                    {imageFiles.length}/{MAX_IMAGES}
                                </span>
                            </div>

                            <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
                                {imageUrls.map((url, index) => (
                                    <div
                                        key={index}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDrop={(e) => handleDrop(e, index)}
                                        onDragEnd={handleDragEnd}
                                        className={`relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border bg-slate-100 cursor-grab active:cursor-grabbing transition-all ${
                                            dragOverIdx === index
                                                ? 'border-slate-900 ring-2 ring-slate-900 scale-105'
                                                : 'border-slate-200'
                                        }`}
                                    >
                                        <img src={url} alt={`preview ${index + 1}`} className="h-full w-full object-cover pointer-events-none" />
                                        <div className="absolute bottom-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white text-[10px] font-bold">
                                            {index + 1}
                                        </div>
                                        <div className="absolute top-1.5 left-1.5 text-white/80">
                                            <GripVertical size={14} />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeImage(index)}
                                            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}

                                {imageFiles.length < MAX_IMAGES && (
                                    <label className="flex h-24 w-24 flex-shrink-0 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100">
                                        <ImagePlus size={24} className="mb-1" />
                                        <span className="text-[11px] font-semibold">추가</span>
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
                        </div>
                    </div>
                </form>
            </div>

            {isDateModalOpen && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 px-4"
                    onClick={() => setIsDateModalOpen(false)}
                >
                    <div
                        className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] md:p-6"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-5 flex items-start justify-between">
                            <div>
                                <h2 className="text-[18px] font-semibold text-slate-900">동행 날짜 선택</h2>
                                <p className="mt-1 text-[13px] text-slate-500">체험 날짜 선택처럼 달력에서 하루를 고르세요.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsDateModalOpen(false)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <DatePicker
                            selectedRange={selectedDateRange}
                            onChange={(range) => setDraftCompanionDate(range.start ?? null)}
                            mode="single"
                        />

                        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                            <button
                                type="button"
                                onClick={() => setDraftCompanionDate(null)}
                                className="text-[13px] font-semibold text-slate-500 underline underline-offset-4"
                            >
                                지우기
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsDateModalOpen(false)}
                                    className="rounded-full border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                                >
                                    취소
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCompanionDate(formatDateForStorage(draftCompanionDate));
                                        setIsDateModalOpen(false);
                                    }}
                                    className="rounded-full bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-black"
                                >
                                    선택 완료
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
