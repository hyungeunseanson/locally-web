import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bold, Italic, Code, Quote, Image as ImageIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';

interface MarkdownMemoEditorProps {
    initialValue?: string;
    onSave: (content: string) => void;
    onCancel: () => void;
    isSaving: boolean;
}

export default function MarkdownMemoEditor({ initialValue = '', onSave, onCancel, isSaving }: MarkdownMemoEditorProps) {
    const [content, setContent] = useState(initialValue);
    const [isPreview, setIsPreview] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [content, isPreview]);

    const insertSyntax = (prefix: string, suffix: string = '') => {
        if (!textareaRef.current) return;
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const selectedText = content.substring(start, end);
        const newText = content.substring(0, start) + prefix + selectedText + suffix + content.substring(end);
        setContent(newText);
        textareaRef.current.focus();
        // Use timeout to allow React to update the state before setting the selection
        setTimeout(() => {
            textareaRef.current!.selectionStart = start + prefix.length;
            textareaRef.current!.selectionEnd = start + prefix.length + selectedText.length;
        }, 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
            e.preventDefault();
            insertSyntax('**', '**');
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
            e.preventDefault();
            insertSyntax('*', '*');
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Optional: add a placeholder
        const placeholder = `![Uploading ${file.name}...]()`;
        insertSyntax(placeholder);
        setIsUploading(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `markdown_images/${fileName}`;

            const { data, error } = await supabase.storage
                .from('admin_files')
                .upload(filePath, file);

            if (error) throw error;

            const { data: publicUrlData } = supabase.storage
                .from('admin_files')
                .getPublicUrl(filePath);

            // Replace placeholder with actual image markdown
            setContent(prev => prev.replace(placeholder, `![${file.name}](${publicUrlData.publicUrl})`));
        } catch (error) {
            console.error('Image upload failed:', error);
            setContent(prev => prev.replace(placeholder, `*Failed to upload image: ${file.name}*`));
            alert('이미지 업로드에 실패했습니다. 관리자 권한을 확인해주세요.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full animate-in fade-in zoom-in-95 duration-200">

            {/* 툴바 */}
            <div className="border-b border-slate-100 bg-slate-50/80 p-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                    <button type="button" onClick={() => insertSyntax('**', '**')} className="p-2 hover:bg-slate-200 rounded text-slate-600 transition-colors" title="굵게"><Bold size={16} /></button>
                    <button type="button" onClick={() => insertSyntax('*', '*')} className="p-2 hover:bg-slate-200 rounded text-slate-600 transition-colors" title="기울임"><Italic size={16} /></button>
                    <div className="w-px h-4 bg-slate-300 mx-1"></div>
                    <button type="button" onClick={() => insertSyntax('`', '`')} className="p-2 hover:bg-slate-200 rounded text-slate-600 transition-colors" title="코드"><Code size={16} /></button>
                    <button type="button" onClick={() => insertSyntax('\n> ', '')} className="p-2 hover:bg-slate-200 rounded text-slate-600 transition-colors" title="인용구"><Quote size={16} /></button>
                    <div className="w-px h-4 bg-slate-300 mx-1"></div>
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="p-2 hover:bg-slate-200 rounded text-slate-600 transition-colors disabled:opacity-50" title="이미지 첨부">
                        <ImageIcon size={16} />
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

                    {isUploading && <span className="text-[10px] text-blue-500 animate-pulse ml-2 font-bold">Uploading...</span>}
                </div>

                <div className="flex items-center bg-slate-200/50 p-1 rounded-lg">
                    <button onClick={() => setIsPreview(false)} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${!isPreview ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Edit</button>
                    <button onClick={() => setIsPreview(true)} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${isPreview ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Preview</button>
                </div>
            </div>

            {/* 에디터 / 뷰어 영역 */}
            <div className="flex-1 overflow-y-auto bg-slate-50 relative p-6">
                {!isPreview ? (
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="마크다운(Markdown) 포맷으로 자유롭게 메모를 작성하세요..."
                        className="w-full min-h-[300px] h-full resize-none outline-none bg-transparent text-sm leading-loose text-slate-800 placeholder:text-slate-500 font-mono"
                    />
                ) : (
                    <div className="prose prose-sm md:prose-base max-w-none prose-slate text-slate-800 prose-p:text-slate-800 prose-strong:text-slate-900 prose-li:text-slate-800 prose-img:rounded-xl prose-img:shadow-sm prose-headings:font-bold prose-headings:text-slate-900 prose-a:text-blue-600">
                        {content ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                        ) : (
                            <p className="text-slate-500 italic">내용이 없습니다.</p>
                        )}
                    </div>
                )}
            </div>

            {/* 하단 액션 */}
            <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
                <button onClick={onCancel} className="px-5 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors">취소</button>
                <button onClick={() => onSave(content)} disabled={isSaving || !content.trim()} className="px-5 py-2 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm disabled:opacity-50 transition-colors flex items-center gap-2">
                    {isSaving ? '저장 중...' : <><CheckCircle2 size={16} /> 작성 완료</>}
                </button>
            </div>
        </div>
    );
}
