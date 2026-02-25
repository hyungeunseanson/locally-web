'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import SiteHeader from '@/app/components/SiteHeader';
import { createClient } from '@/app/utils/supabase/client';
import { User, ShieldCheck, Star, Save, Smile, Camera, Loader2, Mail, Phone, Calendar, ChevronLeft, ChevronRight, X, ChevronDown, Settings, HelpCircle, Bell, FileText, Shield, BookOpen, Users, Gift, Globe, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext';
import MobileProfileView from '@/app/components/mobile/MobileProfileView';
import HostModeTransition from '@/app/components/mobile/HostModeTransition';

export default function AccountPage() {
  const { t } = useLanguage(); // 🟢 2. t 함수 추가
  const supabase = createClient();
  // 🟢 [추가] 커스텀 달력 상태
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date()); // 달력에서 보고 있는 날짜

  // 달력 생성 헬퍼 함수
  const generateCalendar = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const days = [];
    // 빈 칸 채우기
    for (let i = 0; i < firstDay; i++) days.push(null);
    // 날짜 채우기
    for (let i = 1; i <= lastDate; i++) days.push(new Date(year, month, i));
    return days;
  };
  const router = useRouter();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showProfileView, setShowProfileView] = useState(false);
  const [showHostTransition, setShowHostTransition] = useState(false);
  // 프로필 카드용 통계
  const [stats, setStats] = useState({ tripCount: 0, reviewCount: 0, joinYears: 0 });

  // 프로필 상태
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    nationality: '',
    birth_date: '',
    gender: '',
    bio: '',
    phone: '',
    mbti: '',
    kakao_id: '',
    avatar_url: '',
    languages: [] as string[] // 🟢 [추가] 언어 배열 초기화
  });

  // 국가 리스트 & 국가번호 매핑
  const countries = [
    { code: 'KR', name: '대한민국 (South Korea)', phone: '+82' },
    { code: 'JP', name: '일본 (Japan)', phone: '+81' },
    { code: 'CN', name: '중국 (China)', phone: '+86' },
    { code: 'TW', name: '대만 (Taiwan)', phone: '+886' },
    { code: 'HK', name: '홍콩 (Hong Kong)', phone: '+852' },
    { code: 'SG', name: '싱가포르 (Singapore)', phone: '+65' },
    { code: 'MY', name: '말레이시아 (Malaysia)', phone: '+60' },
    { code: 'PH', name: '필리핀 (Philippines)', phone: '+63' },
    { code: 'IN', name: '인도 (India)', phone: '+91' },
    { code: 'TH', name: '태국 (Thailand)', phone: '+66' },
    { code: 'VN', name: '베트남 (Vietnam)', phone: '+84' },
    { code: 'US', name: '미국 (USA)', phone: '+1' },
    { code: 'CA', name: '캐나다 (Canada)', phone: '+1' },
    { code: 'FR', name: '프랑스 (France)', phone: '+33' },
    { code: 'GB', name: '영국 (UK)', phone: '+44' },
    { code: 'ES', name: '스페인 (Spain)', phone: '+34' },
    { code: 'DE', name: '독일 (Germany)', phone: '+49' },
    { code: 'CH', name: '스위스 (Switzerland)', phone: '+41' },
    { code: 'IT', name: '이탈리아 (Italy)', phone: '+39' },
    { code: 'AU', name: '호주 (Australia)', phone: '+61' }
  ];

  // 🟢 [수정] 진짜 리뷰 데이터 및 모달 상태
  const [guestReviews, setGuestReviews] = useState<any[]>([]);
  const [selectedReview, setSelectedReview] = useState<any>(null); // 모달용 선택된 리뷰

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }
      setUser(user);

      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

      if (data) {
        setProfile({
          full_name: data.full_name || '',
          email: data.email || user.email || '', // DB 값 우선, 없으면 Auth 값
          nationality: data.nationality || '',
          birth_date: data.birth_date || '',
          gender: data.gender || '',
          bio: data.bio || '',
          phone: data.phone || '',
          mbti: data.mbti || '',
          kakao_id: data.kakao_id || '',
          avatar_url: data.avatar_url || user.user_metadata?.avatar_url || '',
          languages: data.languages || [] // 🟢 [추가] DB에서 언어 가져오기
        });
      } else {
        setProfile(prev => ({
          ...prev,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || '',
          avatar_url: user.user_metadata?.avatar_url || ''
        }));
      }

      // 🟢 [추가] 게스트 리뷰 불러오기
      const { data: reviewData } = await supabase
        .from('guest_reviews')
        .select(`
          *,
          host:profiles!guest_reviews_host_id_fkey ( full_name, avatar_url )
        `)
        .eq('guest_id', user.id)
        .order('created_at', { ascending: false });

      if (reviewData) setGuestReviews(reviewData);

      // 📊 통계: 여행 횟수, 후기 수, 가입 기간
      const { count: tripCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'confirmed');

      const { count: reviewCount } = await supabase
        .from('guest_reviews')
        .select('*', { count: 'exact', head: true })
        .eq('guest_id', user.id);

      const createdAt = new Date(user.created_at);
      const joinYears = Math.max(1, new Date().getFullYear() - createdAt.getFullYear());

      setStats({
        tripCount: tripCount || 0,
        reviewCount: reviewCount || (reviewData?.length || 0),
        joinYears,
      });

      setLoading(false);
    };
    getProfile();
  }, []);

  // 📞 전화번호 자동 포맷팅 함수
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^0-9]/g, ''); // 숫자만 남김
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  // 📞 전화번호 입력 핸들러
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 사용자가 입력한 값에서 국가코드 제외한 나머지 부분 포맷팅
    // (여기서는 간단하게 전체 텍스트에 대해 하이픈 처리를 합니다)
    // 실제로는 국가코드가 앞에 있으면 분리해서 처리하는 것이 좋으나, 
    // UX상 사용자가 직접 수정 가능하게 두는 것이 유연합니다.
    setProfile({ ...profile, phone: e.target.value });
  };

  // 🌏 국적 변경 시 국가번호 자동 입력
  const handleNationalityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    const country = countries.find(c => c.code === code);
    let newPhone = profile.phone;

    // 기존 번호가 없거나 국가번호가 없으면 자동 추가
    if (country && (!profile.phone || !profile.phone.startsWith('+'))) {
      newPhone = `${country.phone} `;
    }
    setProfile({ ...profile, nationality: code, phone: newPhone });
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    setUploading(true);
    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      alert(t('profile_photo_change_done')); // 🟢 번역
    } catch (error: any) {
      alert(t('profile_photo_fail') + ' ' + error.message); // 🟢 번역
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const updates = {
      id: user.id,
      full_name: profile.full_name,
      nationality: profile.nationality,
      birth_date: profile.birth_date || null,
      gender: profile.gender,
      bio: profile.bio,
      phone: profile.phone,
      mbti: profile.mbti,
      kakao_id: profile.kakao_id,
      email: profile.email, // 수정된 이메일 저장
      avatar_url: profile.avatar_url,
      languages: profile.languages, // 🟢 [추가] 저장 시 포함
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase.from('profiles').upsert(updates);

    if (error) {
      console.error('Save error:', error);
      showToast(t('profile_save_fail'), 'error'); // 🟢 번역
    } else {
      showToast(t('profile_save_success'), 'success'); // 🟢 번역
      router.refresh();
    }
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />

      {/* 📱 모바일 전용 (이미지 3 기준) */}

      {/* 프로필 상세 보기/수정 전체화면 */}
      {showProfileView && (
        <MobileProfileView
          profile={profile}
          userId={user?.id || ''}
          guestReviews={guestReviews}
          onBack={() => setShowProfileView(false)}
          onProfileUpdate={(updated) => {
            setProfile(prev => ({ ...prev, ...updated }));
            setShowProfileView(false);
          }}
        />
      )}

      {/* 호스트 전환 애니메이션 */}
      {showHostTransition && (
        <HostModeTransition targetMode="host" onComplete={() => setShowHostTransition(false)} />
      )}

      <div className="md:hidden pb-28">
        {/* ── 헤더: "프로필" 타이틀 + 알림 벨 ── */}
        <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top,0px)+14px)] pb-3">
          <h1 className="text-[22px] font-extrabold tracking-tight text-gray-900">프로필</h1>
          <a href="/notifications" className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
            <Bell size={17} className="text-gray-600" />
          </a>
        </div>

        {/* ── 프로필 카드 (이미지 3) ── */}
        <button
          onClick={() => setShowProfileView(true)}
          className="mx-5 mb-5 w-[calc(100%-40px)] bg-white border border-gray-100 rounded-2xl shadow-sm p-5 flex items-end gap-5 text-left active:scale-[0.98] transition-transform"
        >
          {/* 좌측: 아바타 + 인증 배지 + 이름/도시 */}
          <div className="flex flex-col items-center shrink-0">
            <div className="relative mb-2">
              <div className="w-[72px] h-[72px] rounded-full overflow-hidden bg-gray-200 border-2 border-white shadow-md">
                {profile.avatar_url
                  ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="avatar" />
                  : <div className="w-full h-full flex items-center justify-center">
                    <User size={28} className="text-gray-400" />
                  </div>
                }
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#FF385C] flex items-center justify-center border-2 border-white">
                <ShieldCheck size={11} className="text-white" strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-[15px] font-bold text-gray-900 text-center leading-snug">{profile.full_name || '이름 없음'}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {profile.nationality
                ? countries.find(c => c.code === profile.nationality)?.name?.split(' (')[0] || profile.nationality
                : '로컬리 회원'}
            </p>
          </div>

          {/* 구분선 */}
          <div className="w-px self-stretch bg-gray-100 mx-1" />

          {/* 우측: 통계 3개 */}
          <div className="flex-1 flex flex-col gap-3">
            <div>
              <p className="text-[11px] text-gray-400 leading-none">Locally를 통한 여행</p>
              <p className="text-[18px] font-extrabold text-gray-900 leading-tight">{stats.tripCount} <span className="text-[14px] font-semibold">회</span></p>
            </div>
            <div className="border-t border-gray-100" />
            <div>
              <p className="text-[11px] text-gray-400 leading-none">후기</p>
              <p className="text-[18px] font-extrabold text-gray-900 leading-tight">{stats.reviewCount} <span className="text-[14px] font-semibold">개</span></p>
            </div>
            <div className="border-t border-gray-100" />
            <div>
              <p className="text-[11px] text-gray-400 leading-none">Locally 가입 기간</p>
              <p className="text-[18px] font-extrabold text-gray-900 leading-tight">{stats.joinYears} <span className="text-[14px] font-semibold">년</span></p>
            </div>
          </div>
        </button>

        {/* ── 메뉴 그룹 1: 기본 메뉴 ── */}
        <div className="px-5">
          <MobileMenuItem icon={<MessageSquare size={17} />} label="메시지" href="/guest/inbox" />
          <MobileMenuItem icon={<Smile size={17} />} label="나의 여행" href="/guest/trips" />
          <MobileMenuItem icon={<Star size={17} />} label="위시리스트" href="/guest/wishlists" />
        </div>

        <div className="my-4 mx-5 border-t border-gray-100" />

        {/* ── 메뉴 그룹 2: 설정 ── */}
        <div className="px-5">
          <MobileMenuItem icon={<Settings size={17} />} label="계정 관리" href="#" onClick={(e) => { e.preventDefault(); setShowProfileView(true); }} />
          <MobileMenuItem icon={<Users size={17} />} label="호스트 되기" href="/become-a-host" />
          <MobileMenuItem icon={<HelpCircle size={17} />} label="도움말 센터" href="/help" />
        </div>

        <div className="my-4 mx-5 border-t border-gray-100" />

        {/* ── 메뉴 그룹 3: Locally & 커뮤니티 ── */}
        <div className="px-5">
          <MobileMenuItem icon={<FileText size={17} />} label="로컬리 소개" href="/about" />
          <MobileMenuItem icon={<Bell size={17} />} label="공지사항" href="/company/notices" />
          <MobileMenuItem icon={<Users size={17} />} label="커뮤니티" href="/company/community" />
          <MobileMenuItem icon={<BookOpen size={17} />} label="뉴스" href="/company/news" />
          <MobileMenuItem icon={<Globe size={17} />} label="소셜 미디어" href="/company/partnership" />
        </div>

        <div className="my-4 mx-5 border-t border-gray-100" />

        {/* ── 로그아웃 ── */}
        <div className="px-5 pb-4">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/');
            }}
            className="text-[13px] font-semibold text-gray-500 py-1"
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 호스트 모드 전환 플로팅 버튼 (모바일 전용) */}
      <div className="md:hidden fixed bottom-[80px] left-0 right-0 flex justify-center z-50 pointer-events-none">
        <button
          onClick={() => setShowHostTransition(true)}
          className="pointer-events-auto flex items-center gap-2 bg-gray-900 text-white px-5 py-3 rounded-full shadow-lg text-[13px] font-semibold active:scale-95 transition-transform"
        >
          <img src="/images/logo.png" alt="" className="w-4 h-4 object-contain grayscale brightness-[10]" style={{ transform: 'scale(1.3)' }} />
          호스트 모드로 전환
        </button>
      </div>

      {/* 🖥️ 데스크탑 전용: 기존 프로필 편집 레이아웃 */}
      <main className="hidden md:block max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-[32px] tracking-tight md:text-3xl font-black mb-2 md:mb-2 mt-4 md:mt-0 leading-tight">{t('account_title')}</h1>
        <p className="text-slate-500 mb-8 md:mb-10 text-sm md:text-base">{t('account_desc')}</p>

        <div className="flex flex-col lg:flex-row gap-16">

          {/* 왼쪽: 프로필 카드 */}
          <div className="w-full lg:w-[360px] flex-shrink-0">
            <div className="md:border border-slate-200 md:rounded-3xl py-4 md:p-8 md:shadow-sm text-center sticky top-28 bg-white border-b md:border-b-0">

              {/* 📸 프로필 사진 */}
              <div className="relative w-32 h-32 mx-auto mb-4 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-32 h-32 bg-slate-200 rounded-full overflow-hidden border border-slate-100 shadow-inner relative">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={48} /></div>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={24} className="text-white" />
                  </div>
                  {uploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10"><Loader2 size={24} className="text-white animate-spin" /></div>}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
              </div>

              <h2 className="text-2xl font-black mb-1">{profile.full_name || t('label_no_name')}</h2> {/* 🟢 번역 */}
              <p className="text-slate-500 text-sm mb-4">
                {countries.find(c => c.code === profile.nationality)?.name || profile.nationality || t('label_no_nationality')} {/* 🟢 번역 */}
              </p>

              <div className="flex flex-wrap justify-center gap-2 mb-6">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600">
                  <ShieldCheck size={14} /> {t('identity_verified')} {/* 🟢 번역 */}
                </div>
                {/* 🌈 성별 이모지 표시 */}
                {profile.gender && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold border border-blue-100">
                    {profile.gender === 'Male' ? `🙋‍♂️ ${t('gender_male')}` : profile.gender === 'Female' ? `🙋‍♀️ ${t('gender_female')}` : `🙋 ${t('gender_other')}`} {/* 🟢 번역 */}
                  </div>
                )}
                {profile.mbti && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-xs font-bold border border-rose-100">
                    <Smile size={14} /> {profile.mbti}
                  </div>
                )}
              </div>

              {profile.bio && (
                <div className="text-sm text-slate-600 leading-relaxed mb-6 bg-slate-50 p-4 rounded-xl text-left">
                  "{profile.bio}"
                </div>
              )}

              {/* 카카오톡 ID 제거됨 (여기서는 안 보이게) */}

              <div className="text-left space-y-4 pt-6 border-t border-slate-100">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Star size={18} fill="black" /> {t('review_from_host')} ({guestReviews.length})
                </h3>

                {guestReviews.length === 0 ? (
                  <p className="text-slate-400 text-sm py-4 text-center">아직 받은 후기가 없습니다.</p>
                ) : (
                  guestReviews.map(review => (
                    <div
                      key={review.id}
                      onClick={() => setSelectedReview(review)} // 🟢 클릭 시 모달 열기
                      className="bg-slate-50 p-4 rounded-xl text-sm border border-slate-100 cursor-pointer hover:bg-slate-100 hover:border-slate-300 transition-all group"
                    >
                      <div className="flex justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {/* 호스트 아바타 (있으면 표시) */}
                          <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden relative">
                            {review.host?.avatar_url ? (
                              <img src={review.host.avatar_url} className="w-full h-full object-cover" />
                            ) : <User size={14} className="text-slate-400 m-auto mt-1" />}
                          </div>
                          <span className="font-bold text-slate-900 group-hover:underline">
                            {review.host?.full_name || 'Host'}{t('host_honorific')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star size={12} className="text-amber-400" fill="currentColor" />
                          <span className="font-bold">{review.rating}</span>
                        </div>
                      </div>
                      <p className="text-slate-600 leading-snug line-clamp-2">"{review.content}"</p>
                      <p className="text-slate-400 text-xs mt-2 text-right">
                        {new Date(review.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 오른쪽: 정보 수정 폼 */}
          <div className="flex-1 max-w-2xl">
            <div className="space-y-8 bg-white">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold mb-2">{t('label_name')}</label> {/* 🟢 번역 */}
                  <input
                    type="text"
                    value={profile.full_name}
                    onChange={e => setProfile({ ...profile, full_name: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:border-black outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">{t('label_nationality')}</label> {/* 🟢 번역 */}
                  <select
                    value={profile.nationality}
                    onChange={handleNationalityChange}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:border-black outline-none transition-colors bg-white"
                  >
                    <option value="">{t('select_nationality')}</option> {/* 🟢 번역 */}
                    {countries.map(country => (
                      <option key={country.code} value={country.code}>{country.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative">
                  <label className="block text-sm font-bold mb-2">{t('label_birth')}</label>

                  {/* 🟢 입력창 (Placeholder 추가) */}
                  <div
                    onClick={() => {
                      // 🟢 [수정] 기본값 2000년으로 변경
                      if (profile.birth_date) setViewDate(new Date(profile.birth_date));
                      else setViewDate(new Date(2000, 0, 1));
                      setIsCalendarOpen(true);
                    }}
                    className="w-full p-3 border border-slate-300 rounded-xl flex items-center justify-between cursor-pointer hover:border-black transition-colors bg-white group"
                  >
                    <span className={profile.birth_date ? "text-slate-900 font-medium" : "text-slate-400"}>
                      {/* 🟢 값이 없으면 YYYY. MM. DD 표시 */}
                      {profile.birth_date ? profile.birth_date.replace(/-/g, '. ') : "YYYY. MM. DD"}
                    </span>
                    <Calendar size={18} className="text-slate-400 group-hover:text-black" />
                  </div>

                  {/* 🟢 커스텀 달력 모달 */}
                  {isCalendarOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsCalendarOpen(false)}></div>
                      <div className="absolute top-full left-0 mt-2 w-[320px] bg-white rounded-2xl shadow-xl border border-slate-100 z-50 p-5 animate-in fade-in zoom-in-95">

                        {/* 🟢 [수정] 헤더: 연도 선택 강조 디자인 */}
                        <div className="flex justify-between items-center mb-4 px-1">
                          {/* 이전 달 버튼 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)));
                            }}
                            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-colors"
                          >
                            <ChevronLeft size={20} />
                          </button>

                          <div className="flex items-center gap-2">
                            {/* 🟢 연도 선택 (버튼처럼 보이게 수정) */}
                            <div className="relative flex items-center gap-1 cursor-pointer hover:bg-slate-100 px-2 py-1 rounded-lg transition-colors group">
                              <span className="text-lg font-bold text-slate-900">{viewDate.getFullYear()}</span>
                              <ChevronDown size={14} className="text-slate-400 group-hover:text-black mt-0.5" />

                              {/* 투명 select 박스로 기능 유지 */}
                              <select
                                value={viewDate.getFullYear()}
                                onChange={(e) => setViewDate(new Date(viewDate.setFullYear(Number(e.target.value))))}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i + 5).map(year => (
                                  <option key={year} value={year}>{year}</option>
                                ))}
                              </select>
                            </div>

                            {/* 월 표시 (점 찍어서 구분) */}
                            <span className="text-lg font-bold text-slate-900">  {viewDate.getMonth() + 1}</span>
                          </div>

                          {/* 다음 달 버튼 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)));
                            }}
                            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-colors"
                          >
                            <ChevronRight size={20} />
                          </button>
                        </div>

                        {/* 요일 헤더 */}
                        <div className="grid grid-cols-7 text-center mb-3">
                          {[0, 1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="text-xs text-slate-400 font-bold uppercase tracking-wide">{t(`day_${i}`)}</div>
                          ))}
                        </div>

                        {/* 날짜 그리드 */}
                        <div className="grid grid-cols-7 gap-1 place-items-center">
                          {generateCalendar(viewDate.getFullYear(), viewDate.getMonth()).map((date, idx) => {
                            if (!date) return <div key={idx} className="w-9 h-9"></div>;

                            // 날짜 비교용 문자열 (YYYY-MM-DD)
                            const dateStr = date.toLocaleDateString('en-CA');
                            const isSelected = profile.birth_date === dateStr;
                            const isToday = new Date().toDateString() === date.toDateString();

                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  setProfile({ ...profile, birth_date: dateStr });
                                  setIsCalendarOpen(false);
                                }}
                                className={`
                                  w-9 h-9 rounded-full text-sm font-medium flex items-center justify-center transition-all
                                  ${isSelected ? 'bg-black text-white shadow-md scale-105' : 'hover:bg-slate-100 text-slate-700 hover:text-black'}
                                  ${isToday && !isSelected ? 'text-blue-600 font-bold bg-blue-50' : ''}
                                `}
                              >
                                {date.getDate()}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>



                <div>
                  <label className="block text-sm font-bold mb-2">{t('label_gender')}</label> {/* 🟢 번역 */}
                  <select
                    value={profile.gender}
                    onChange={e => setProfile({ ...profile, gender: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:border-black outline-none transition-colors bg-white"
                  >
                    <option value="">{t('gender_select')}</option> {/* 🟢 번역 */}
                    <option value="Male">🙋‍♂️ {t('gender_male')} (Male)</option>
                    <option value="Female">🙋‍♀️ {t('gender_female')} (Female)</option>
                    <option value="Other">🙋 {t('gender_other')} (Other)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold mb-2">{t('label_phone')}</label> {/* 🟢 번역 */}
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={handlePhoneChange}
                    placeholder={t('ph_phone')}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:border-black outline-none transition-colors"
                  />
                  <p className="text-xs text-slate-400 mt-1">{t('help_phone')}</p> {/* 🟢 번역 */}
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">{t('label_kakao')}</label> {/* 🟢 번역 */}
                  <input
                    type="text"
                    value={profile.kakao_id}
                    onChange={e => setProfile({ ...profile, kakao_id: e.target.value })}
                    placeholder={t('ph_kakao')}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:border-black outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold mb-2">{t('label_mbti')}</label> {/* 🟢 번역 */}
                  <input
                    type="text"
                    value={profile.mbti}
                    onChange={e => setProfile({ ...profile, mbti: e.target.value.toUpperCase() })}
                    placeholder={t('ph_mbti')}
                    maxLength={4}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:border-black outline-none transition-colors uppercase"
                  />
                </div>

                {/* 🟢 [추가] 구사 가능한 언어 선택 */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-bold mb-2">{t('label_languages_spoken')}</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {['English', 'Korean', 'Japanese', 'Chinese', 'Spanish', 'French'].map(lang => (
                      <button
                        key={lang}
                        onClick={() => {
                          const current = profile.languages || [];
                          const newLangs = current.includes(lang)
                            ? current.filter(l => l !== lang)
                            : [...current, lang];
                          setProfile({ ...profile, languages: newLangs });
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${profile.languages?.includes(lang)
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                          }`}
                      >
                        {t(`lang_${lang}`) || lang}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">호스트에게 내가 할 수 있는 언어를 알려주세요.</p>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">{t('label_email')}</label> {/* 🟢 번역 */}
                  <input
                    type="email"
                    value={profile.email}
                    onChange={e => setProfile({ ...profile, email: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:border-black outline-none transition-colors"
                  />
                  <p className="text-xs text-slate-400 mt-1">{t('help_email')}</p> {/* 🟢 번역 */}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">{t('label_bio')}</label> {/* 🟢 번역 */}
                <textarea
                  rows={5}
                  value={profile.bio}
                  onChange={e => setProfile({ ...profile, bio: e.target.value })}
                  placeholder={t('ph_bio')}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:border-black outline-none transition-colors resize-none"
                />
              </div>

              <div className="pt-6 border-t border-slate-100 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:scale-105 transition-transform flex items-center gap-2 disabled:opacity-50"
                >
                  <Save size={18} /> {saving ? t('saving') : t('btn_save_changes')} {/* 🟢 번역 */}
                </button>
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* 🟢 [추가] 리뷰 상세 모달 */}
      {selectedReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedReview(null)}>
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden border border-slate-200 relative">
                  {selectedReview.host?.avatar_url ? (
                    <img src={selectedReview.host.avatar_url} className="w-full h-full object-cover" />
                  ) : <User size={24} className="text-slate-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">
                    {selectedReview.host?.full_name || 'Host'}
                    <span className="text-sm font-normal text-slate-500 ml-1">{t('host_honorific')}</span>
                  </h3>
                  <p className="text-xs text-slate-400">{new Date(selectedReview.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <button onClick={() => setSelectedReview(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={20} className={i < selectedReview.rating ? "text-amber-400 fill-amber-400" : "text-slate-200"} />
              ))}
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                {selectedReview.content}
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// 모바일 메뉴 아이템 헬퍼 컴포넌트
function MobileMenuItem({
  icon,
  label,
  href,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
}) {
  const inner = (
    <>
      <span className="text-gray-500 shrink-0">{icon}</span>
      <span className="flex-1 text-[13px] font-medium text-gray-800">{label}</span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3.5 py-3.5 border-b border-gray-100 text-left"
      >
        {inner}
      </button>
    );
  }

  return (
    <Link href={href} className="flex items-center gap-3.5 py-3.5 border-b border-gray-100">
      {inner}
    </Link>
  );
}