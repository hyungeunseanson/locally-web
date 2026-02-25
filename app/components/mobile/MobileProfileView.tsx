'use client';

import React, { useState, useEffect } from 'react';
import {
    ArrowLeft, Camera, Loader2, User, BriefcaseBusiness,
    GraduationCap, Globe, ShieldCheck, Star, ChevronRight
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';

interface MobileProfileViewProps {
    profile: {
        full_name: string;
        email: string;
        nationality: string;
        birth_date: string;
        gender: string;
        bio: string;
        phone: string;
        mbti: string;
        kakao_id: string;
        avatar_url: string;
        languages: string[];
        job?: string;
        school?: string;
    };
    userId: string;
    guestReviews: any[];
    onBack: () => void;
    onProfileUpdate: (updatedProfile: any) => void;
}

export default function MobileProfileView({
    profile,
    userId,
    guestReviews,
    onBack,
    onProfileUpdate,
}: MobileProfileViewProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ ...profile });
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [stats, setStats] = useState({ tripCount: 0, reviewCount: 0, joinYears: 1 });
    const supabase = createClient();
    const { showToast } = useToast();

    // 통계 데이터 fetch
    useEffect(() => {
        if (!userId) return;
        const fetchStats = async () => {
            const [{ count: tripCount }, { count: reviewCount }] = await Promise.all([
                supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'confirmed'),
                supabase.from('guest_reviews').select('*', { count: 'exact', head: true }).eq('guest_id', userId),
            ]);
            const { data: userData } = await supabase.auth.getUser();
            const createdAt = userData?.user?.created_at ? new Date(userData.user.created_at) : new Date();
            const joinYears = Math.max(1, new Date().getFullYear() - createdAt.getFullYear());
            setStats({
                tripCount: tripCount || 0,
                reviewCount: reviewCount || guestReviews.length,
                joinYears,
            });
        };
        fetchStats();
    }, [userId]);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setUploading(true);
        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const filePath = `${userId}-${Math.random()}.${fileExt}`;
        try {
            const { error } = await supabase.storage.from('avatars').upload(filePath, file);
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
            setEditData(prev => ({ ...prev, avatar_url: publicUrl }));
            await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
            showToast('프로필 사진이 변경되었습니다.', 'success');
        } catch (err: any) {
            showToast('사진 업로드 실패: ' + err.message, 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        const updates = {
            id: userId,
            full_name: editData.full_name,
            bio: editData.bio,
            languages: editData.languages,
            job: editData.job,
            school: editData.school,
            updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('profiles').upsert(updates);
        if (error) {
            showToast('저장 실패: ' + error.message, 'error');
        } else {
            showToast('프로필이 저장되었습니다.', 'success');
            onProfileUpdate({ ...profile, ...editData });
            setIsEditing(false);
        }
        setSaving(false);
    };

    const displayProfile = isEditing ? editData : profile;

    return (
        <div className="fixed inset-0 bg-white z-[200] flex flex-col overflow-y-auto">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top,0px)+14px)] pb-3 border-b border-gray-100 sticky top-0 bg-white z-10">
                <button
                    onClick={onBack}
                    className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                    <ArrowLeft size={20} strokeWidth={2} />
                </button>
                <button
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                    disabled={saving}
                    className="text-[13px] font-semibold text-gray-800 px-4 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                    {saving ? '저장 중...' : isEditing ? '완료' : '수정하기'}
                </button>
            </div>

            {/* ── 프로필 카드 (이미지 4 스타일) ── */}
            <div className="mx-5 mt-5 bg-white border border-gray-100 rounded-2xl shadow-sm p-5 flex items-end gap-5">
                {/* 좌측: 아바타 + 인증 배지 + 사진 편집 + 이름/거주지 */}
                <div className="flex flex-col items-center shrink-0">
                    <div className="relative mb-2">
                        <div className="w-[80px] h-[80px] rounded-full overflow-hidden bg-gray-200 border-2 border-white shadow-md">
                            {displayProfile.avatar_url ? (
                                <img src={displayProfile.avatar_url} className="w-full h-full object-cover" alt="avatar" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    <User size={32} />
                                </div>
                            )}
                            {uploading && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                                    <Loader2 size={18} className="text-white animate-spin" />
                                </div>
                            )}
                        </div>
                        {/* 인증 배지 */}
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#FF385C] flex items-center justify-center border-2 border-white">
                            <ShieldCheck size={11} className="text-white" strokeWidth={2.5} />
                        </div>
                        {/* 사진 편집 (편집 모드) */}
                        {isEditing && (
                            <label className="absolute inset-0 flex items-center justify-center cursor-pointer rounded-full">
                                <div className="bg-black/40 rounded-full w-full h-full flex items-center justify-center">
                                    <Camera size={18} className="text-white" />
                                </div>
                                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                            </label>
                        )}
                    </div>
                    {/* 이름 */}
                    {isEditing ? (
                        <input
                            value={editData.full_name}
                            onChange={e => setEditData(prev => ({ ...prev, full_name: e.target.value }))}
                            className="text-[14px] font-bold text-gray-900 text-center bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 w-[110px] outline-none focus:border-gray-400"
                        />
                    ) : (
                        <p className="text-[15px] font-bold text-gray-900 text-center leading-snug">{displayProfile.full_name || '이름 없음'}</p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-0.5">로컬리 회원</p>
                </div>

                {/* 구분선 */}
                <div className="w-px self-stretch bg-gray-100" />

                {/* 우측: 통계 3개 */}
                <div className="flex-1 flex flex-col gap-3 pb-0.5">
                    <div>
                        <p className="text-[11px] text-gray-400 leading-none">Locally를 통한 여행</p>
                        <p className="text-[20px] font-extrabold text-gray-900 leading-tight">{stats.tripCount} <span className="text-[13px] font-semibold">회</span></p>
                    </div>
                    <div className="border-t border-gray-100" />
                    <div>
                        <p className="text-[11px] text-gray-400 leading-none">후기</p>
                        <p className="text-[20px] font-extrabold text-gray-900 leading-tight">{stats.reviewCount} <span className="text-[13px] font-semibold">개</span></p>
                    </div>
                    <div className="border-t border-gray-100" />
                    <div>
                        <p className="text-[11px] text-gray-400 leading-none">Locally 가입 기간</p>
                        <p className="text-[20px] font-extrabold text-gray-900 leading-tight">{stats.joinYears} <span className="text-[13px] font-semibold">년</span></p>
                    </div>
                </div>
            </div>

            {/* 상세 정보 */}
            <div className="mx-5 mt-4 space-y-0">
                {/* 직업 */}
                <div className="flex items-center gap-3 py-3.5 border-b border-slate-100">
                    <BriefcaseBusiness size={18} className="text-slate-500 shrink-0" />
                    {isEditing ? (
                        <input
                            value={editData.job || ''}
                            onChange={e => setEditData(prev => ({ ...prev, job: e.target.value }))}
                            placeholder="직업/직장 입력"
                            className="flex-1 text-[13px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-slate-400"
                        />
                    ) : (
                        <span className="text-[13px] text-slate-700">
                            직업/직장: <span className="font-medium">{displayProfile.job || '미입력'}</span>
                        </span>
                    )}
                </div>

                {/* 출신 학교 */}
                <div className="flex items-center gap-3 py-3.5 border-b border-slate-100">
                    <GraduationCap size={18} className="text-slate-500 shrink-0" />
                    {isEditing ? (
                        <input
                            value={editData.school || ''}
                            onChange={e => setEditData(prev => ({ ...prev, school: e.target.value }))}
                            placeholder="출신 학교 입력"
                            className="flex-1 text-[13px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-slate-400"
                        />
                    ) : (
                        <span className="text-[13px] text-slate-700">
                            출신 학교: <span className="font-medium">{displayProfile.school || '미입력'}</span>
                        </span>
                    )}
                </div>

                {/* 구사 언어 */}
                <div className="flex items-start gap-3 py-3.5 border-b border-slate-100">
                    <Globe size={18} className="text-slate-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        {isEditing ? (
                            <div className="flex flex-wrap gap-1.5">
                                {['English', 'Korean', 'Japanese', 'Chinese', 'French', 'Spanish'].map(lang => (
                                    <button
                                        key={lang}
                                        onClick={() => {
                                            const current = editData.languages || [];
                                            setEditData(prev => ({
                                                ...prev,
                                                languages: current.includes(lang)
                                                    ? current.filter(l => l !== lang)
                                                    : [...current, lang]
                                            }));
                                        }}
                                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${(editData.languages || []).includes(lang)
                                            ? 'bg-slate-900 text-white border-slate-900'
                                            : 'bg-white text-slate-500 border-slate-200'
                                            }`}
                                    >
                                        {lang}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <span className="text-[13px] text-slate-700">
                                구사 언어: <span className="font-medium">
                                    {(displayProfile.languages || []).length > 0
                                        ? displayProfile.languages.join(', ')
                                        : '미입력'}
                                </span>
                            </span>
                        )}
                    </div>
                </div>

                {/* 본인 인증 */}
                <div className="flex items-center gap-3 py-3.5 border-b border-slate-100">
                    <ShieldCheck size={18} className="text-slate-500 shrink-0" />
                    <span className="text-[13px] text-pink-600 font-semibold underline underline-offset-2">
                        본인 인증 완료
                    </span>
                </div>

                {/* 자기소개 */}
                {isEditing && (
                    <div className="py-4">
                        <p className="text-[11px] text-slate-400 font-semibold mb-2">자기소개</p>
                        <textarea
                            value={editData.bio || ''}
                            onChange={e => setEditData(prev => ({ ...prev, bio: e.target.value }))}
                            rows={3}
                            placeholder="자기소개를 입력하세요"
                            className="w-full text-[13px] text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-slate-400 resize-none"
                        />
                    </div>
                )}
            </div>

            {/* 후기 섹션 */}
            {!isEditing && (
                <div className="mx-5 mt-6 pb-8">
                    <h3 className="text-[14px] font-bold text-slate-900 mb-4">후기</h3>
                    {guestReviews.length === 0 ? (
                        <p className="text-[12px] text-slate-400 text-center py-6">아직 후기가 없습니다.</p>
                    ) : (
                        <div className="space-y-4">
                            {guestReviews.slice(0, 5).map((review: any) => (
                                <div key={review.id} className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0">
                                        {review.host?.avatar_url
                                            ? <img src={review.host.avatar_url} className="w-full h-full object-cover" alt="host" />
                                            : <User size={14} className="text-slate-400 m-auto mt-2" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[12px] font-bold text-slate-800">{review.host?.full_name || 'Host'}</p>
                                        <p className="text-[11px] text-slate-400 mb-1">
                                            {new Date(review.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
                                        </p>
                                        <p className="text-[12px] text-slate-600 leading-relaxed">{review.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {guestReviews.length > 0 && (
                        <button className="w-full mt-5 py-3 border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                            후기 표시하기
                        </button>
                    )}

                    <p className="text-center text-[10px] text-slate-400 mt-4">
                        일부 정보는 자동 번역되었습니다. <span className="underline">원문 보기</span>
                    </p>
                </div>
            )}
        </div>
    );
}
