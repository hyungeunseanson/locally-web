'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { compressImage, sanitizeFileName, validateImage } from '@/app/utils/image';
import { ImagePlus, X, Loader2, ArrowLeft, ChevronDown } from 'lucide-react';

export default function PostEditor() {
    const router = useRouter();
    const supabase = createClient();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [category, setCategory] = useState<'qna' | 'companion' | 'info'>('qna');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imageUrls, setImageUrls] = useState<string[]>([]); // For preview

    // Companion specific
    const [companionDate, setCompanionDate] = useState('');
    const [companionCity, setCompanionCity] = useState('');

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const files = Array.from(e.target.files);

        // Prevent strictly more than 3 images
        if (imageFiles.length + files.length > 3) {
            alert('사진은 최대 3장까지만 업로드 가능합니다.');
            return;
        }

        const validFiles = files.filter(file => validateImage(file).valid);

        setImageFiles(prev => [...prev, ...validFiles]);

        // Create preivews
        const newPreviewUrls = validFiles.map(file => URL.createObjectURL(file));
        setImageUrls(prev => [...prev, ...newPreviewUrls]);
    };

    const removeImage = (index: number) => {
        setImageFiles(prev => prev.filter((_, i) => i !== index));
        setImageUrls(prev => {
            const newUrls = [...prev];
            URL.revokeObjectURL(newUrls[index]); // Free memory
            newUrls.splice(index, 1);
            return newUrls;
        });
    };

    const uploadImages = async (): Promise<string[]> => {
        const uploadedPaths: string[] = [];
        for (const file of imageFiles) {
            // 🛡️ OOM Protection: Force compress large images before upload
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) {
            alert('제목과 내용을 입력해주세요.');
            return;
        }
        if (category === 'companion' && (!companionDate || !companionCity)) {
            alert('동행 날짜와 지역을 입력해주세요.');
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Upload Images
            const finalImageUrls = await uploadImages();

            // 2. Save Post
            const response = await fetch('/api/community/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category,
                    title,
                    content,
                    images: finalImageUrls,
                    companion_date: companionDate || undefined,
                    companion_city: companionCity || undefined,
                    linked_exp_id: null // TODO: Implement Modal Selector in next PR
                })
            });

            if (!response.ok) throw new Error('글 등록에 실패했습니다.');

            const { id } = await response.json();

            // 하드 네비게이션으로 이동 (router.refresh + push 레이스 컨디션으로 인한 404 방지)
            window.location.href = `/community/${id}`;

        } catch (error: any) {
            console.error(error);
            alert(error.message || '글 등록 중 오류가 발생했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-[768px] mx-auto min-h-screen bg-white md:border-x md:border-slate-100 pb-32">
            <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 px-5 py-4 flex items-center justify-between">
                <button onClick={() => router.back()} className="text-slate-600 hover:text-slate-900 transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-[17px] font-bold text-slate-900">글쓰기</h1>
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !title || !content}
                    className="text-[15px] font-bold text-[#FF385C] disabled:text-slate-300 transition-colors"
                >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : '등록'}
                </button>
            </div>

            <main className="p-5">
                {/* Category Selector */}
                <div className="mb-6 relative">
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as any)}
                        className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-[15px] font-bold rounded-xl px-4 py-3.5 outline-none focus:border-slate-400 transition-colors"
                    >
                        <option value="qna">💡 질문&답변 (궁금해요)</option>
                        <option value="companion">🤝 동행 구하기 (일정이 맞아요)</option>
                        <option value="info">🗺️ 현지 꿀팁 (후기/정보글)</option>
                    </select>
                    <ChevronDown size={20} className="absolute right-4 top-[15px] text-slate-400 pointer-events-none" />
                </div>

                {/* Companion Fields */}
                {category === 'companion' && (
                    <div className="flex gap-3 mb-6">
                        <input
                            type="date"
                            value={companionDate}
                            onChange={(e) => setCompanionDate(e.target.value)}
                            className="flex-1 bg-slate-50 border border-slate-200 text-slate-900 text-[15px] font-medium rounded-xl px-4 py-3 outline-none focus:border-slate-400"
                        />
                        <input
                            type="text"
                            placeholder="도시 (예: 도쿄, 오사카)"
                            value={companionCity}
                            onChange={(e) => setCompanionCity(e.target.value)}
                            className="flex-1 bg-slate-50 border border-slate-200 text-slate-900 text-[15px] font-medium rounded-xl px-4 py-3 outline-none focus:border-slate-400"
                        />
                    </div>
                )}

                {/* Title */}
                <input
                    type="text"
                    placeholder="제목을 입력하세요."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-[22px] font-bold text-slate-900 placeholder:text-slate-300 outline-none mb-6 mt-2"
                />

                {/* Content */}
                <textarea
                    placeholder="내용을 자세히 작성해주세요. 현지 호스트와 여행자들이 답변을 달아줄 거예요!"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full h-[300px] text-[16px] text-slate-800 placeholder:text-slate-300 leading-relaxed outline-none resize-none mb-6"
                />

                {/* Image Upload Area */}
                <div>
                    <div className="flex items-center gap-3 overflow-x-auto pb-4 no-scrollbar">
                        {imageUrls.map((url, index) => (
                            <div key={index} className="relative w-24 h-24 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
                                <img src={url} alt={`preview ${index}`} className="w-full h-full object-cover" />
                                <button
                                    onClick={() => removeImage(index)}
                                    className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 backdrop-blur-sm"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}

                        {imageFiles.length < 3 && (
                            <label className="w-24 h-24 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-100 transition-colors flex-shrink-0">
                                <ImagePlus size={24} className="mb-1" />
                                <span className="text-[11px] font-semibold">{imageFiles.length}/3</span>
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

            </main>
        </div>
    );
}
