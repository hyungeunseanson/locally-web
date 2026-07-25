'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
    ArrowLeft, Camera, Loader2, User, BriefcaseBusiness,
    Globe, ShieldCheck, Star,
    Calendar, Phone, Mail, MessageCircle
} from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';
import { BOOKING_CONFIRMED_STATUSES } from '@/app/constants/bookingStatus';
import { PROFILE_LANGUAGE_OPTIONS } from '@/app/constants/profile';
import { getProfileCompletion } from '@/app/utils/profile';
import { useLanguage } from '@/app/context/LanguageContext';
import { compressImage, validateImage, isHeicValidationResult } from '@/app/utils/image';
import type { LocallyMembershipStatus } from '@/app/utils/memberStatus';
import LocallyMembershipBadgeTrigger from '@/app/components/LocallyMembershipBadgeTrigger';

type GuestReview = {
    id: string | number;
    rating: number;
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
};

interface MobileProfileViewProps {
    profile: MobileProfileData;
    userId: string;
    guestReviews: GuestReview[];
    membershipStatus: LocallyMembershipStatus;
    onBack: () => void;
    onProfileUpdate: (updatedProfile: MobileProfileData) => void;
}

export default function MobileProfileView({
    profile,
    userId,
    guestReviews,
    membershipStatus,
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
    const [showAllReviews, setShowAllReviews] = useState(false);
    const [stats, setStats] = useState({ tripCount: 0, reviewCount: 0, joinMonths: 1 });
    const supabase = useMemo(() => createClient(), []);
    const { showToast, showHeicUnsupportedToast } = useToast();
    const { t } = useLanguage();
    const memberTierDescription = t('membership_member_info_desc') as string;
    const circleTierDescription = t('membership_circle_info_desc') as string;
    const completion = getProfileCompletion(isEditing ? editData : profile, 'guest');
    const missingLabels = completion.missingFields
        .slice(0, 4)
        .map((field) => t(`field_label_${field}` as Parameters<typeof t>[0]));

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
            const now = new Date();
            const totalMonths =
                (now.getFullYear() - createdAt.getFullYear()) * 12 +
                (now.getMonth() - createdAt.getMonth());
            const joinMonths = Math.max(1, totalMonths);
            setStats({
                tripCount: tripCount || 0,
                reviewCount: reviewCount || guestReviews.length,
                joinMonths,
            });
        };
        fetchStats();
    }, [guestReviews.length, supabase, userId]);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const validation = validateImage(file);
        if (!validation.valid) {
            if (isHeicValidationResult(validation)) {
                showHeicUnsupportedToast(validation.message);
            } else {
                showToast(validation.message || '사진 업로드 실패', 'error');
            }
            e.target.value = '';
            return;
        }

        setUploading(true);
        const fileExt = file.name.split('.').pop();
        const filePath = `${userId}-${Math.random()}.${fileExt}`;
        try {
            const compressedFile = await compressImage(file);
            const { error } = await supabase.storage.from('avatars').upload(filePath, compressedFile);
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
            e.target.value = '';
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
            bio: editData.bio,
            mbti: editData.mbti,
            languages: editData.languages,
            job: editData.job,
            updated_at: new Date().toISOString(),
        };
        const { data: existingProfile, error: loadError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (loadError || !existingProfile) {
            showToast('저장 실패: 프로필을 불러오지 못했습니다.', 'error');
            setSaving(false);
            return;
        }

        let error: { message: string } | null = null;

        // Postgres DB Trigger가 이미 seed를 생성했으므로 update만 수행합니다.
        const allowedColumns = new Set(Object.keys(existingProfile));
        const filteredUpdates = Object.fromEntries(
            Object.entries(updates).filter(([key, value]) => allowedColumns.has(key) && value !== undefined)
        );

        const updateRes = await supabase
            .from('profiles')
            .update(filteredUpdates)
            .eq('id', userId);
        error = updateRes.error;

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
        <div className="fixed inset-0 z-[200] flex flex-col overflow-y-auto bg-white animate-in fade-in slide-in-from-right-4 duration-200">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-2.5 border-b border-gray-100 sticky top-0 bg-white z-10">
                <button
                    onClick={onBack}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-gray-100 active:scale-[0.96] md:h-9 md:w-9"
                >
                    <ArrowLeft className="w-[18px] h-[18px] md:w-5 md:h-5" strokeWidth={2} />
                </button>
                <button
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                    disabled={saving}
                    className="rounded-full border border-gray-200 px-3.5 py-1.5 text-[12px] font-semibold text-gray-800 transition-all hover:bg-gray-50 active:scale-[0.96] disabled:opacity-50"
                >
                    {saving ? t('saving') : isEditing ? t('btn_complete') : t('btn_edit_profile')}
                </button>
            </div>

            {/* ── 프로필 카드 (이미지 4 스타일) ── */}
            <div className="mx-4 mt-4 bg-white border border-gray-100 rounded-xl md:rounded-2xl shadow-sm p-4 flex items-end gap-4">
                {/* 좌측: 아바타 + 인증 배지 + 사진 편집 + 이름/거주지 */}
                <div className="flex flex-col items-center shrink-0">
                        <div className="relative mb-2">
                        <div className="w-[68px] h-[68px] rounded-full overflow-hidden bg-gray-200 border-2 border-white shadow-md">
                            {displayProfile.avatar_url ? (
                                <>
                                    {/* Mobile account avatars render remote user profile URLs and keep the current direct loading path. */}
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={displayProfile.avatar_url} className="w-full h-full object-cover" alt="avatar" />
                                </>
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
                        <p className="text-[14px] font-bold text-gray-900 text-center leading-snug">{displayProfile.full_name || t('label_no_name')}</p>
                    )}
                    {membershipStatus !== 'none' && (
                        <LocallyMembershipBadgeTrigger
                            status={membershipStatus}
                            memberDescription={memberTierDescription}
                            circleDescription={circleTierDescription}
                            ariaLabel={t('membership_info_aria') as string}
                            testIdPrefix="mobile-profile-membership-badge"
                            size="compact"
                            className="mt-2"
                        />
                    )}
                </div>

                {/* 구분선 */}
                <div className="w-px self-stretch bg-gray-100" />

                {/* 우측: 통계 3개 */}
                <div className="flex-1 flex flex-col gap-2.5 pb-0.5">
                    <div>
                        <p className="text-[10px] text-gray-400 leading-none">{t('trips_with_locally')}</p>
                        <p className="text-[17px] font-extrabold text-gray-900 leading-tight">{stats.tripCount} <span className="text-[11px] font-semibold">{t('unit_times')}</span></p>
                    </div>
                    <div className="border-t border-gray-100" />
                    <div>
                        <p className="text-[10px] text-gray-400 leading-none">{t('reviews_received')}</p>
                        <p className="text-[17px] font-extrabold text-gray-900 leading-tight">{stats.reviewCount} <span className="text-[11px] font-semibold">{t('unit_items')}</span></p>
                    </div>
                    <div className="border-t border-gray-100" />
                    <div>
                        <p className="text-[10px] text-gray-400 leading-none">{t('time_with_locally')}</p>
                        <p className="text-[17px] font-extrabold text-gray-900 leading-tight">
                            {(() => {
                                const y = Math.floor(stats.joinMonths / 12);
                                const m = stats.joinMonths % 12;
                                if (y === 0) return <>{stats.joinMonths} <span className="text-[11px] font-semibold">{t('unit_months')}</span></>;
                                if (m === 0) return <>{y} <span className="text-[11px] font-semibold">{t('unit_years')}</span></>;
                                return <>{y} <span className="text-[11px] font-semibold">{t('unit_years')}</span> {m} <span className="text-[11px] font-semibold">{t('unit_months')}</span></>;
                            })()}
                        </p>
                    </div>
                </div>
            </div>

            <div className="mx-4 mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{t('he_profile_completion')}</p>
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
                            ? t('he_profile_done')
                            : t('profile_missing_fields').replace('{count}', completion.missingFields.length.toString())}
                    </p>
                </div>
            </div>

            <div
                data-testid="mobile-account-withdrawal-notice"
                className="mx-4 mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3"
            >
                <p className="text-[12px] font-medium text-slate-600">
                    {t('account_withdrawal_notice_title')}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                    {t('account_withdrawal_notice_desc')}
                </p>
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
                            <option value="">{t('ph_select_nationality')}</option>
                            {countries.map(country => (
                                <option key={country.code} value={country.code}>{country.name}</option>
                            ))}
                        </select>
                    ) : (
                        <span className="text-[12px] text-slate-700">
                            {t('label_nationality')}: <span className="font-medium">
                                {displayProfile.nationality
                                    ? countries.find(c => c.code === displayProfile.nationality)?.name?.split(' (')[0] || displayProfile.nationality
                                    : t('not_entered')}
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
                            {t('label_birth')}: <span className="font-medium">{displayProfile.birth_date || t('not_entered')}</span>
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
                            <option value="">{t('ph_select_gender')}</option>
                            <option value="Male">{t('gender_male')}</option>
                            <option value="Female">{t('gender_female')}</option>
                            <option value="Other">{t('gender_other')}</option>
                        </select>
                    ) : (
                        <span className="text-[12px] text-slate-700">
                            {t('label_gender')}: <span className="font-medium">{displayProfile.gender || t('not_entered')}</span>
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
                            placeholder={t('ph_input_phone')}
                            className="flex-1 text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-slate-400"
                        />
                    ) : (
                        <span className="text-[12px] text-slate-700">
                            {t('label_phone')}: <span className="font-medium">{displayProfile.phone || t('not_entered')}</span>
                        </span>
                    )}
                </div>

                {/* 이메일 */}
                <div className="flex items-center gap-2.5 py-3 border-b border-slate-100">
                    <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-[12px] text-slate-700">
                        {t('label_email')}: <span className="font-medium">{displayProfile.email || t('not_entered')}</span>
                    </span>
                </div>

                {/* 카카오 ID */}
                <div className="flex items-center gap-2.5 py-3 border-b border-slate-100">
                    <MessageCircle className="w-4 h-4 text-slate-500 shrink-0" />
                    {isEditing ? (
                        <input
                            value={editData.kakao_id || ''}
                            onChange={e => setEditData(prev => ({ ...prev, kakao_id: e.target.value }))}
                            placeholder={t('ph_input_kakao')}
                            className="flex-1 text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-slate-400"
                        />
                    ) : (
                        <span className="text-[12px] text-slate-700">
                            {t('label_kakao').replace(' (선택)', '')}: <span className="font-medium">{displayProfile.kakao_id || t('not_entered')}</span>
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
                                placeholder={t('ph_input_mbti')}
                                maxLength={4}
                                className="w-full text-[12px] uppercase text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-slate-400"
                            />
                            <p className="mt-1 text-[10px] text-slate-400">{t('he_profile_desc_2')}</p>
                        </div>
                    ) : (
                        <span className="text-[12px] text-slate-700">
                            {t('label_mbti')}: <span className="font-medium">{displayProfile.mbti || t('not_entered')}</span>
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
                                placeholder={t('ph_input_job')}
                                className="w-full text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-slate-400"
                            />
                            <p className="mt-1 text-[10px] text-slate-400">{t('he_profile_desc_3')}</p>
                        </div>
                    ) : (
                        <span className="text-[12px] text-slate-700">
                            {t('profile_job')}: <span className="font-medium">{displayProfile.job || t('not_entered')}</span>
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
                                {t('profile_lang')}: <span className="font-medium">
                                    {(displayProfile.languages || []).length > 0
                                        ? displayProfile.languages.join(', ')
                                        : t('not_entered')}
                                </span>
                            </span>
                        )}
                    </div>
                </div>

                {/* 본인 인증 */}
                <div className="flex items-center gap-2.5 py-3 border-b border-slate-100">
                    <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-[12px] text-pink-600 font-semibold underline underline-offset-2">
                        {t('verified_identity')}
                    </span>
                </div>

                {/* 자기소개 */}
                {isEditing ? (
                    <div className="py-3.5">
                        <p className="text-[10px] text-slate-400 font-semibold mb-1.5">{t('label_bio')}</p>
                        <textarea
                            value={editData.bio || ''}
                            onChange={e => setEditData(prev => ({ ...prev, bio: e.target.value }))}
                            rows={3}
                            placeholder={t('ph_input_bio')}
                            className="w-full text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-2.5 py-2 outline-none focus:border-slate-400 resize-none"
                        />
                        <p className="mt-1 text-[10px] text-slate-400">{t('he_profile_desc_4')}</p>
                    </div>
                ) : (
                    <div className="py-3.5">
                        <p className="text-[10px] text-slate-400 font-semibold mb-1.5">{t('label_bio')}</p>
                        <div className="w-full text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-2.5 py-2">
                            {displayProfile.bio || t('not_entered')}
                        </div>
                    </div>
                )}
            </div>

            {/* 후기 섹션 */}
            {!isEditing && (
                <div className="mx-4 mt-5 pb-7">
                    <h3 className="text-[13px] font-bold text-slate-900 mb-3.5">{t('reviews_received')}</h3>
                    {guestReviews.length === 0 ? (
                        <p className="text-[11px] text-slate-400 text-center py-5">{t('no_reviews_yet')}</p>
                    ) : (
                        <div className="space-y-3">
                            {(showAllReviews ? guestReviews : guestReviews.slice(0, 5)).map((review) => (
                                <div key={review.id} className="flex gap-2.5" data-testid="mobile-guest-review">
                                    <div className="w-7 h-7 rounded-full bg-slate-200 overflow-hidden shrink-0">
                                        {review.host?.avatar_url
                                            ? (
                                                <>
                                                    {/* Review host avatars render remote profile URLs and keep the existing lightweight mobile rendering path. */}
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={review.host.avatar_url} className="w-full h-full object-cover" alt="host" />
                                                </>
                                            )
                                            : <User className="w-[12px] h-[12px] text-slate-400 m-auto mt-[8px]" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-bold text-slate-800">{review.host?.full_name || 'Host'}</p>
                                        <div
                                            className="flex items-center gap-0.5 text-amber-500"
                                            data-testid="mobile-guest-review-rating"
                                            aria-label={`${review.rating} / 5`}
                                        >
                                            {Array.from({ length: 5 }, (_, index) => (
                                                <Star
                                                    key={index}
                                                    className="w-3 h-3"
                                                    fill={index < review.rating ? 'currentColor' : 'none'}
                                                />
                                            ))}
                                            <span className="ml-1 text-[10px] font-semibold text-slate-600">
                                                {review.rating}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mb-1">
                                            {new Date(review.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
                                        </p>
                                        <p className="text-[11px] text-slate-600 leading-relaxed">{review.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {guestReviews.length > 5 && !showAllReviews && (
                        <button
                            type="button"
                            onClick={() => setShowAllReviews(true)}
                            data-testid="mobile-show-all-guest-reviews"
                            className="w-full mt-4 py-2.5 border border-slate-200 rounded-lg md:rounded-xl text-[12px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            {t('btn_show_reviews')}
                        </button>
                    )}

                    <p className="text-center text-[10px] text-slate-400 mt-3.5">
                        {t('auto_translated_info')} <span className="underline">{t('view_original_text')}</span>
                    </p>
                </div>
            )}
        </div>
    );
}
