'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
    ArrowLeft, Camera, Loader2, User, BriefcaseBusiness,
    GraduationCap, Globe, ShieldCheck, Star,
    Calendar, Phone, Mail, MessageCircle
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { BOOKING_CONFIRMED_STATUSES } from '@/app/constants/bookingStatus';
import { PROFILE_LANGUAGE_OPTIONS } from '@/app/constants/profile';
import { getProfileCompletion, PROFILE_COMPLETION_FIELD_LABELS } from '@/app/utils/profile';

type GuestReview = {
    id: string | number;
    content: string;
    created_at: string;
    host?: {
        full_name?: string | null;
        avatar_url?: string | null;
    } | null;
};

type MobileProfileData = {
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

interface MobileProfileViewProps {
    profile: MobileProfileData;
    userId: string;
    guestReviews: GuestReview[];
    onBack: () => void;
    onProfileUpdate: (updatedProfile: MobileProfileData) => void;
}

export default function MobileProfileView({
    profile,
    userId,
    guestReviews,
    onBack,
    onProfileUpdate,
}: MobileProfileViewProps) {
    const countries = [
        { code: 'KR', name: '대한민국 (South Korea)' },
        { code: 'JP', name: '일본 (Japan)' },
        { code: 'CN', name: '중국 (China)' },
        { code: 'TW', name: '대만 (Taiwan)' },
        { code: 'HK', name: '홍콩 (Hong Kong)' },
        { code: 'SG', name: '싱가포르 (Singapore)' },
        { code: 'MY', name: '말레이시아 (Malaysia)' },
        { code: 'PH', name: '필리핀 (Philippines)' },
        { code: 'IN', name: '인도 (India)' },
        { code: 'TH', name: '태국 (Thailand)' },
        { code: 'VN', name: '베트남 (Vietnam)' },
        { code: 'US', name: '미국 (USA)' },
        { code: 'CA', name: '캐나다 (Canada)' },
        { code: 'FR', name: '프랑스 (France)' },
        { code: 'GB', name: '영국 (UK)' },
        { code: 'ES', name: '스페인 (Spain)' },
        { code: 'DE', name: '독일 (Germany)' },
        { code: 'CH', name: '스위스 (Switzerland)' },
        { code: 'IT', name: '이탈리아 (Italy)' },
        { code: 'AU', name: '호주 (Australia)' }
    ];
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ ...profile });
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [stats, setStats] = useState({ tripCount: 0, reviewCount: 0, joinYears: 1 });
    const supabase = useMemo(() => createClient(), []);
    const { showToast } = useToast();
    const completion = getProfileCompletion(isEditing ? editData : profile, 'guest');
    const missingLabels = completion.missingFields
        .slice(0, 4)
        .map((field) => PROFILE_COMPLETION_FIELD_LABELS[field]);

    // 통계 데이터 fetch
    useEffect(() => {
        if (!userId) return;
        const fetchStats = async () => {
            const [{ count: tripCount }, { count: reviewCount }] = await Promise.all([
                supabase
                    .from('bookings')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .in('status', [...BOOKING_CONFIRMED_STATUSES]),
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
    }, [guestReviews.length, supabase, userId]);

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
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '알 수 없는 오류';
            showToast('사진 업로드 실패: ' + message, 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        const updates = {
            id: userId,
            full_name: editData.full_name,
            nationality: editData.nationality,
            birth_date: editData.birth_date || null,
            gender: editData.gender,
            phone: editData.phone,
            kakao_id: editData.kakao_id,
            email: editData.email,
            bio: editData.bio,
            mbti: editData.mbti,
            languages: editData.languages,
            job: editData.job,
            school: editData.school,
            updated_at: new Date().toISOString(),
        };
        const { data: existingProfile, error: loadError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (loadError) {
            showToast('저장 실패: 프로필을 불러오지 못했습니다.', 'error');
            setSaving(false);
            return;
        }

        let error: { message: string } | null = null;

        if (!existingProfile) {
            const seedRes = await supabase.from('profiles').upsert({
                id: userId,
                updated_at: updates.updated_at,
            });

            if (seedRes.error) {
                error = seedRes.error;
            } else {
                const { data: seededProfile, error: seedLoadError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .maybeSingle();

                if (seedLoadError || !seededProfile) {
                    error = { message: seedLoadError?.message || '프로필 시드 생성 후 조회에 실패했습니다.' };
                } else {
                    const allowedColumns = new Set(Object.keys(seededProfile));
                    const filteredUpdates = Object.fromEntries(
                        Object.entries(updates).filter(([key, value]) => allowedColumns.has(key) && value !== undefined)
                    );

                    const updateRes = await supabase
                        .from('profiles')
                        .update(filteredUpdates)
                        .eq('id', userId);
                    error = updateRes.error;
                }
            }
        } else {
            const allowedColumns = new Set(Object.keys(existingProfile));
            const filteredUpdates = Object.fromEntries(
                Object.entries(updates).filter(([key, value]) => allowedColumns.has(key) && value !== undefined)
            );

            const updateRes = await supabase
                .from('profiles')
                .update(filteredUpdates)
                .eq('id', userId);
            error = updateRes.error;
        }

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
            <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-2.5 border-b border-gray-100 sticky top-0 bg-white z-10">
                <button
                    onClick={onBack}
                    className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                    <ArrowLeft className="w-[18px] h-[18px] md:w-5 md:h-5" strokeWidth={2} />
                </button>
                <button
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                    disabled={saving}
                    className="text-[12px] font-semibold text-gray-800 px-3.5 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                    {saving ? '저장 중...' : isEditing ? '완료' : '수정하기'}
                </button>
            </div>

            {/* ── 프로필 카드 (이미지 4 스타일) ── */}
            <div className="mx-4 mt-4 bg-white border border-gray-100 rounded-xl md:rounded-2xl shadow-sm p-4 flex items-end gap-4">
                {/* 좌측: 아바타 + 인증 배지 + 사진 편집 + 이름/거주지 */}
                <div className="flex flex-col items-center shrink-0">
                    <div className="relative mb-2">
                        <div className="w-[68px] h-[68px] rounded-full overflow-hidden bg-gray-200 border-2 border-white shadow-md">
                            {displayProfile.avatar_url ? (
                                <img src={displayProfile.avatar_url} className="w-full h-full object-cover" alt="avatar" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    <User className="w-7 h-7" />
                                </div>
                            )}
                            {uploading && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                                </div>
                            )}
                        </div>
                        {/* 인증 배지 */}
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#FF385C] flex items-center justify-center border-2 border-white">
                            <ShieldCheck className="w-[10px] h-[10px] text-white" strokeWidth={2.5} />
                        </div>
                        {/* 사진 편집 (편집 모드) */}
                        {isEditing && (
                            <label className="absolute inset-0 flex items-center justify-center cursor-pointer rounded-full">
                                <div className="bg-black/40 rounded-full w-full h-full flex items-center justify-center">
                                    <Camera className="w-4 h-4 text-white" />
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
                            className="text-[13px] font-bold text-gray-900 text-center bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 w-[100px] outline-none focus:border-gray-400"
                        />
                    ) : (
                        <p className="text-[14px] font-bold text-gray-900 text-center leading-snug">{displayProfile.full_name || '이름 없음'}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5">로컬리 회원</p>
                </div>

                {/* 구분선 */}
                <div className="w-px self-stretch bg-gray-100" />

                {/* 우측: 통계 3개 */}
                <div className="flex-1 flex flex-col gap-2.5 pb-0.5">
                    <div>
                        <p className="text-[10px] text-gray-400 leading-none">Locally를 통한 여행</p>
                        <p className="text-[17px] font-extrabold text-gray-900 leading-tight">{stats.tripCount} <span className="text-[11px] font-semibold">회</span></p>
                    </div>
                    <div className="border-t border-gray-100" />
                    <div>
                        <p className="text-[10px] text-gray-400 leading-none">후기</p>
                        <p className="text-[17px] font-extrabold text-gray-900 leading-tight">{stats.reviewCount} <span className="text-[11px] font-semibold">개</span></p>
                    </div>
                    <div className="border-t border-gray-100" />
                    <div>
                        <p className="text-[10px] text-gray-400 leading-none">Locally 가입 기간</p>
                        <p className="text-[17px] font-extrabold text-gray-900 leading-tight">{stats.joinYears} <span className="text-[11px] font-semibold">년</span></p>
                    </div>
                </div>
            </div>

            <div className="mx-4 mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">프로필 완성도</p>
                            <p className="mt-1 text-[20px] font-black text-slate-900">{completion.percent}%</p>
                        </div>
                        {missingLabels.length > 0 && (
                            <div className="flex flex-wrap justify-end gap-1.5">
                                {missingLabels.map((label) => (
                                    <span
                                        key={label}
                                        className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700"
                                    >
                                        {label}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-600">
                        {completion.missingFields.length === 0
                            ? '공개 프로필이 모두 채워졌습니다.'
                            : `${completion.missingFields.length}개 항목이 비어 있습니다. 호스트가 예약 전 먼저 보는 정보입니다.`}
                    </p>
                </div>
            </div>

            {/* 상세 정보 */}
            <div className="mx-4 mt-3 space-y-0">
                {/* 국적 */}
                <div className="flex items-center gap-2.5 py-3 border-b border-slate-100">
                    <Globe className="w-4 h-4 text-slate-500 shrink-0" />
                    {isEditing ? (
                        <select
                            value={editData.nationality || ''}
                            onChange={e => setEditData(prev => ({ ...prev, nationality: e.target.value }))}
                            className="flex-1 text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-slate-400"
                        >
                            <option value="">국적 선택</option>
                            {countries.map(country => (
                                <option key={country.code} value={country.code}>{country.name}</option>
                            ))}
                        </select>
                    ) : (
                        <span className="text-[12px] text-slate-700">
                            국적: <span className="font-medium">
                                {displayProfile.nationality
                                    ? countries.find(c => c.code === displayProfile.nationality)?.name?.split(' (')[0] || displayProfile.nationality
                                    : '미입력'}
                            </span>
                        </span>
                    )}
                </div>

                {/* 생년월일 */}
                <div className="flex items-center gap-2.5 py-3 border-b border-slate-100">
                    <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                    {isEditing ? (
                        <input
                            type="date"
                            value={editData.birth_date || ''}
                            onChange={e => setEditData(prev => ({ ...prev, birth_date: e.target.value }))}
                            className="flex-1 text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-slate-400"
                        />
                    ) : (
                        <span className="text-[12px] text-slate-700">
                            생년월일: <span className="font-medium">{displayProfile.birth_date || '미입력'}</span>
                        </span>
                    )}
                </div>

                {/* 성별 */}
                <div className="flex items-center gap-2.5 py-3 border-b border-slate-100">
                    <User className="w-4 h-4 text-slate-500 shrink-0" />
                    {isEditing ? (
                        <select
                            value={editData.gender || ''}
                            onChange={e => setEditData(prev => ({ ...prev, gender: e.target.value }))}
                            className="flex-1 text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-slate-400"
                        >
                            <option value="">성별 선택</option>
                            <option value="Male">남성</option>
                            <option value="Female">여성</option>
                            <option value="Other">기타</option>
                        </select>
                    ) : (
                        <span className="text-[12px] text-slate-700">
                            성별: <span className="font-medium">{displayProfile.gender || '미입력'}</span>
                        </span>
                    )}
                </div>

                {/* 연락처 */}
                <div className="flex items-center gap-2.5 py-3 border-b border-slate-100">
                    <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                    {isEditing ? (
                        <input
                            value={editData.phone || ''}
                            onChange={e => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="전화번호 입력"
                            className="flex-1 text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-slate-400"
                        />
                    ) : (
                        <span className="text-[12px] text-slate-700">
                            전화번호: <span className="font-medium">{displayProfile.phone || '미입력'}</span>
                        </span>
                    )}
                </div>

                {/* 이메일 */}
                <div className="flex items-center gap-2.5 py-3 border-b border-slate-100">
                    <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                    {isEditing ? (
                        <input
                            type="email"
                            value={editData.email || ''}
                            onChange={e => setEditData(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="이메일 입력"
                            className="flex-1 text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-slate-400"
                        />
                    ) : (
                        <span className="text-[12px] text-slate-700">
                            이메일: <span className="font-medium">{displayProfile.email || '미입력'}</span>
                        </span>
                    )}
                </div>

                {/* 카카오 ID */}
                <div className="flex items-center gap-2.5 py-3 border-b border-slate-100">
                    <MessageCircle className="w-4 h-4 text-slate-500 shrink-0" />
                    {isEditing ? (
                        <input
                            value={editData.kakao_id || ''}
                            onChange={e => setEditData(prev => ({ ...prev, kakao_id: e.target.value }))}
                            placeholder="카카오 ID 입력"
                            className="flex-1 text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-slate-400"
                        />
                    ) : (
                        <span className="text-[12px] text-slate-700">
                            카카오 ID: <span className="font-medium">{displayProfile.kakao_id || '미입력'}</span>
                        </span>
                    )}
                </div>

                {/* MBTI */}
                <div className="flex items-center gap-2.5 py-3 border-b border-slate-100">
                    <Star className="w-4 h-4 text-slate-500 shrink-0" />
                    {isEditing ? (
                        <div className="flex-1">
                            <input
                                value={editData.mbti || ''}
                                onChange={e => setEditData(prev => ({ ...prev, mbti: e.target.value.toUpperCase() }))}
                                placeholder="MBTI 입력"
                                maxLength={4}
                                className="w-full text-[12px] uppercase text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-slate-400"
                            />
                            <p className="mt-1 text-[10px] text-slate-400">성향을 빠르게 보여주는 보조 정보</p>
                        </div>
                    ) : (
                        <span className="text-[12px] text-slate-700">
                            MBTI: <span className="font-medium">{displayProfile.mbti || '미입력'}</span>
                        </span>
                    )}
                </div>
                {/* 직업 */}
                <div className="flex items-center gap-2.5 py-3 border-b border-slate-100">
                    <BriefcaseBusiness className="w-4 h-4 text-slate-500 shrink-0" />
                    {isEditing ? (
                        <div className="flex-1">
                            <input
                                value={editData.job || ''}
                                onChange={e => setEditData(prev => ({ ...prev, job: e.target.value }))}
                                placeholder="직업/직장 입력"
                                className="w-full text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-slate-400"
                            />
                            <p className="mt-1 text-[10px] text-slate-400">대화 연결 포인트를 만드는 정보</p>
                        </div>
                    ) : (
                        <span className="text-[12px] text-slate-700">
                            직업/직장: <span className="font-medium">{displayProfile.job || '미입력'}</span>
                        </span>
                    )}
                </div>

                {/* 출신 학교 */}
                <div className="flex items-center gap-2.5 py-3 border-b border-slate-100">
                    <GraduationCap className="w-4 h-4 text-slate-500 shrink-0" />
                    {isEditing ? (
                        <div className="flex-1">
                            <input
                                value={editData.school || ''}
                                onChange={e => setEditData(prev => ({ ...prev, school: e.target.value }))}
                                placeholder="출신 학교 입력"
                                className="w-full text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-slate-400"
                            />
                            <p className="mt-1 text-[10px] text-slate-400">학생/학교 정보가 있다면 신뢰 형성에 도움</p>
                        </div>
                    ) : (
                        <span className="text-[12px] text-slate-700">
                            출신 학교: <span className="font-medium">{displayProfile.school || '미입력'}</span>
                        </span>
                    )}
                </div>

                {/* 구사 언어 */}
                <div className="flex items-start gap-2.5 py-3 border-b border-slate-100">
                    <Globe className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        {isEditing ? (
                            <div className="flex flex-wrap gap-1.5">
                                {PROFILE_LANGUAGE_OPTIONS.map(lang => (
                                    <button
                                        key={lang}
                                        type="button"
                                        onClick={() => {
                                            const current = editData.languages || [];
                                            setEditData(prev => ({
                                                ...prev,
                                                languages: current.includes(lang)
                                                    ? current.filter(l => l !== lang)
                                                    : [...current, lang]
                                            }));
                                        }}
                                        className={`px-2 py-1 rounded-full text-[10px] font-semibold border transition-all ${(editData.languages || []).includes(lang)
                                            ? 'bg-slate-900 text-white border-slate-900'
                                            : 'bg-white text-slate-500 border-slate-200'
                                            }`}
                                    >
                                        {lang}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <span className="text-[12px] text-slate-700">
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
                <div className="flex items-center gap-2.5 py-3 border-b border-slate-100">
                    <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-[12px] text-pink-600 font-semibold underline underline-offset-2">
                        본인 인증 완료
                    </span>
                </div>

                {/* 자기소개 */}
                {isEditing ? (
                    <div className="py-3.5">
                        <p className="text-[10px] text-slate-400 font-semibold mb-1.5">자기소개</p>
                        <textarea
                            value={editData.bio || ''}
                            onChange={e => setEditData(prev => ({ ...prev, bio: e.target.value }))}
                            rows={3}
                            placeholder="자기소개를 입력하세요"
                            className="w-full text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-2.5 py-2 outline-none focus:border-slate-400 resize-none"
                        />
                        <p className="mt-1 text-[10px] text-slate-400">호스트가 예약 전에 가장 먼저 읽는 핵심 소개입니다.</p>
                    </div>
                ) : (
                    <div className="py-3.5">
                        <p className="text-[10px] text-slate-400 font-semibold mb-1.5">자기소개</p>
                        <div className="w-full text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-2.5 py-2">
                            {displayProfile.bio || '미입력'}
                        </div>
                    </div>
                )}
            </div>

            {/* 후기 섹션 */}
            {!isEditing && (
                <div className="mx-4 mt-5 pb-7">
                    <h3 className="text-[13px] font-bold text-slate-900 mb-3.5">후기</h3>
                    {guestReviews.length === 0 ? (
                        <p className="text-[11px] text-slate-400 text-center py-5">아직 후기가 없습니다.</p>
                    ) : (
                        <div className="space-y-3">
                            {guestReviews.slice(0, 5).map((review) => (
                                <div key={review.id} className="flex gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-slate-200 overflow-hidden shrink-0">
                                        {review.host?.avatar_url
                                            ? <img src={review.host.avatar_url} className="w-full h-full object-cover" alt="host" />
                                            : <User className="w-[12px] h-[12px] text-slate-400 m-auto mt-[8px]" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-bold text-slate-800">{review.host?.full_name || 'Host'}</p>
                                        <p className="text-[10px] text-slate-400 mb-1">
                                            {new Date(review.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
                                        </p>
                                        <p className="text-[11px] text-slate-600 leading-relaxed">{review.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {guestReviews.length > 0 && (
                        <button className="w-full mt-4 py-2.5 border border-slate-200 rounded-lg md:rounded-xl text-[12px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                            후기 표시하기
                        </button>
                    )}

                    <p className="text-center text-[10px] text-slate-400 mt-3.5">
                        일부 정보는 자동 번역되었습니다. <span className="underline">원문 보기</span>
                    </p>
                </div>
            )}
        </div>
    );
}
