'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { compressImage, sanitizeFileName, validateImage, isHeicValidationResult } from '@/app/utils/image';
import DatePicker from '@/app/components/DatePicker';
import { ArrowLeft, CalendarDays, ChevronRight, ImagePlus, Loader2, MapPin, X } from 'lucide-react';
import type { CommunityCategory } from '@/app/types/community';

const WRITABLE_CATEGORIES: CommunityCategory[] = ['qna', 'companion', 'info', 'locally_content'];

const CATEGORY_OPTIONS: { id: CommunityCategory; label: string }[] = [
    { id: 'qna', label: 'Q&A' },
    { id: 'companion', label: '동행 구하기' },
    { id: 'info', label: '꿀팁' },
    { id: 'locally_content', label: '로컬리 콘텐츠' },
];

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

export default function PostEditor() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();
    const { showToast, showHeicUnsupportedToast } = useToast();
    const initialCategory = searchParams.get('category');
    const defaultCategory = WRITABLE_CATEGORIES.includes(initialCategory as CommunityCategory)
        ? (initialCategory as CommunityCategory)
        : 'qna';

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [category, setCategory] = useState<CommunityCategory>(defaultCategory);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [companionDate, setCompanionDate] = useState('');
    const [companionCity, setCompanionCity] = useState('');
    const [isDateModalOpen, setIsDateModalOpen] = useState(false);
    const [draftCompanionDate, setDraftCompanionDate] = useState<Date | null>(parseStoredDate(companionDate));

    const selectedDateRange = useMemo(
        () => ({ start: draftCompanionDate, end: null }),
        [draftCompanionDate],
    );

    const isCompanion = category === 'companion';
    const canSubmit = title.trim().length > 0 && content.trim().length > 0 && (!isCompanion || (companionDate && companionCity.trim()));

    const openDateModal = () => {
        setDraftCompanionDate(parseStoredDate(companionDate));
        setIsDateModalOpen(true);
    };

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files) return;
        const files = Array.from(event.target.files);

        if (imageFiles.length + files.length > 3) {
            showToast('사진은 최대 3장까지만 업로드 가능합니다.', 'error');
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

    const uploadImages = async (): Promise<string[]> => {
        const uploadedPaths: string[] = [];

        for (const file of imageFiles) {
            const compressed = await compressImage(file);
            const fileName = sanitizeFileName(compressed.name);
            const filePath = `community/${Date.now()}-${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(filePath, compressed, { cacheControl: '3600', upsert: false });

            if (uploadError) {
                console.error('Image upload failed:', uploadError);
                throw new Error('이미지 업로드에 실패했습니다.');
            }

            const { data } = supabase.storage.from('images').getPublicUrl(filePath);
            uploadedPaths.push(data.publicUrl);
        }

        return uploadedPaths;
    };

    const handleSubmit = async (event?: React.FormEvent) => {
        event?.preventDefault();

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
            const finalImageUrls = await uploadImages();

            const response = await fetch('/api/community/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category,
                    title,
                    content,
                    images: finalImageUrls,
                    companion_date: companionDate || undefined,
                    companion_city: companionCity.trim() || undefined,
                    linked_exp_id: null,
                }),
            });

            if (!response.ok) throw new Error('글 등록에 실패했습니다.');

            const { id } = await response.json();
            window.location.href = `/community/${id}`;
        } catch (error: any) {
            console.error(error);
            alert(error.message || '글 등록 중 오류가 발생했습니다.');
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
                        aria-label="뒤로가기"
                    >
                        <ArrowLeft size={20} />
                    </button>

                    <div className="text-center">
                        <h1 className="text-[18px] font-semibold text-slate-900 md:text-[22px]">커뮤니티 글쓰기</h1>
                        <p className="mt-1 hidden text-[13px] text-slate-500 md:block">깔끔하게 정리해서 올리면 더 읽기 좋습니다.</p>
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
                        <div className="flex flex-wrap gap-2">
                            {CATEGORY_OPTIONS.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setCategory(item.id)}
                                    className={`rounded-full border px-4 py-2 text-[12px] font-semibold transition-colors md:text-[13px] ${
                                        category === item.id
                                            ? 'border-slate-900 bg-slate-900 text-white'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6 px-5 py-5 md:px-8 md:py-8">
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
                                        placeholder="도시를 입력하세요"
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
                                placeholder="제목을 입력하세요"
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                className="w-full bg-transparent text-[24px] font-semibold text-slate-900 placeholder:text-slate-300 outline-none md:text-[30px]"
                            />
                        </div>

                        <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 md:px-6 md:py-5">
                            <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">본문</div>
                            <textarea
                                placeholder="내용을 정리해서 작성해보세요."
                                value={content}
                                onChange={(event) => setContent(event.target.value)}
                                className="h-[280px] w-full resize-none bg-transparent text-[15px] leading-7 text-slate-800 placeholder:text-slate-300 outline-none md:h-[340px] md:text-[16px]"
                            />
                        </div>

                        <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 md:px-6 md:py-5">
                            <div className="mb-3 flex items-center justify-between">
                                <div>
                                    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">이미지</div>
                                    <p className="mt-1 text-[13px] text-slate-500">최대 3장까지 업로드할 수 있습니다.</p>
                                </div>
                                <span className="text-[12px] font-semibold text-slate-400">{imageFiles.length}/3</span>
                            </div>

                            <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
                                {imageUrls.map((url, index) => (
                                    <div
                                        key={index}
                                        className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
                                    >
                                        <img src={url} alt={`preview ${index + 1}`} className="h-full w-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(index)}
                                            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}

                                {imageFiles.length < 3 && (
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
