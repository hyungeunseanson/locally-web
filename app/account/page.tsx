'use client';

import React, { useEffect, useState, useRef } from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { createClient } from '@/app/utils/supabase/client';
import { User, ShieldCheck, Star, Save, Smile, Camera, Loader2, Mail, Phone, Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'; // 🟢 아이콘 추가
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/context/ToastContext';
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 추가 (import 맨 아래)

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
    avatar_url: '' 
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

// 더미 후기
const reviews = [
  { id: 1, host: 'Akiho', date: '2026.01', content: '정말 매너 좋고 시간 약속도 잘 지키시는 게스트였습니다! 대화도 즐거웠어요.' }, // 🟢 숫자 형식
  { id: 2, host: 'Minjun', date: '2025.12', content: '깔끔하게 이용해주셔서 감사합니다. 추천합니다!' } // 🟢 숫자 형식
];

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }
      setUser(user);

      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      
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
          avatar_url: data.avatar_url || user.user_metadata?.avatar_url || ''
        });
      } else {
        setProfile(prev => ({ 
          ...prev, 
          email: user.email || '', 
          full_name: user.user_metadata?.full_name || '',
          avatar_url: user.user_metadata?.avatar_url || ''
        }));
      }
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
      
      <main className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-black mb-2">{t('account_title')}</h1> {/* 🟢 번역 */}
      <p className="text-slate-500 mb-10">{t('account_desc')}</p> {/* 🟢 번역 */}

        <div className="flex flex-col lg:flex-row gap-16">
          
          {/* 왼쪽: 프로필 카드 */}
          <div className="w-full lg:w-[360px] flex-shrink-0">
            <div className="border border-slate-200 rounded-3xl p-8 shadow-sm text-center sticky top-28 bg-white">
              
              {/* 📸 프로필 사진 */}
              <div className="relative w-32 h-32 mx-auto mb-4 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-32 h-32 bg-slate-200 rounded-full overflow-hidden border border-slate-100 shadow-inner relative">
                   {profile.avatar_url ? (
                     <img src={profile.avatar_url} className="w-full h-full object-cover"/>
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={48}/></div>
                   )}
                   <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <Camera size={24} className="text-white"/>
                   </div>
                   {uploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10"><Loader2 size={24} className="text-white animate-spin"/></div>}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden"/>
              </div>

              <h2 className="text-2xl font-black mb-1">{profile.full_name || t('label_no_name')}</h2> {/* 🟢 번역 */}
              <p className="text-slate-500 text-sm mb-4">
                {countries.find(c => c.code === profile.nationality)?.name || profile.nationality || t('label_no_nationality')} {/* 🟢 번역 */}
              </p>
              
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600">
                <ShieldCheck size={14}/> {t('identity_verified')} {/* 🟢 번역 */}
                </div>
                {/* 🌈 성별 이모지 표시 */}
                {profile.gender && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold border border-blue-100">
{profile.gender === 'Male' ? `🙋‍♂️ ${t('gender_male')}` : profile.gender === 'Female' ? `🙋‍♀️ ${t('gender_female')}` : `🙋 ${t('gender_other')}`} {/* 🟢 번역 */}
                  </div>
                )}
                {profile.mbti && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-xs font-bold border border-rose-100">
                    <Smile size={14}/> {profile.mbti}
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
              <h3 className="font-bold text-lg flex items-center gap-2"><Star size={18} fill="black"/> {t('review_from_host')} ({reviews.length})</h3> {/* 🟢 번역 */}
              {reviews.map(review => (
                  <div key={review.id} className="bg-slate-50 p-4 rounded-xl text-sm border border-slate-100">
                    <div className="flex justify-between mb-1.5">
                      <span className="font-bold text-slate-900">{review.host}{t('host_honorific')}</span> {/* 🟢 번역 */}
                      <span className="text-slate-400 text-xs">{review.date}</span>
                    </div>
                    <p className="text-slate-600 leading-snug">"{review.content}"</p>
                  </div>
                ))}
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
                    onChange={e => setProfile({...profile, full_name: e.target.value})}
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
                  
                  {/* 🟢 기존 input 대신 예쁜 버튼형 input 사용 */}
                  <div 
                    onClick={() => {
                      // 이미 값이 있으면 그 날짜를 기준으로 달력을 켬
                      if(profile.birth_date) setViewDate(new Date(profile.birth_date));
                      else setViewDate(new Date(1990, 0, 1)); // 기본값 1990년
                      setIsCalendarOpen(true);
                    }}
                    className="w-full p-3 border border-slate-300 rounded-xl flex items-center justify-between cursor-pointer hover:border-black transition-colors bg-white group"
                  >
                    <span className={profile.birth_date ? "text-slate-900" : "text-transparent"}>
                      {profile.birth_date || "YYYY-MM-DD"}
                    </span>
                    <Calendar size={18} className="text-slate-400 group-hover:text-black"/>
                  </div>

                  {/* 🟢 커스텀 달력 모달 (팝업) */}
                  {isCalendarOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsCalendarOpen(false)}></div>
                      <div className="absolute top-full left-0 mt-2 w-[320px] bg-white rounded-2xl shadow-xl border border-slate-100 z-50 p-4 animate-in fade-in zoom-in-95">
                        
                        {/* 헤더: 연도/월 이동 */}
                        <div className="flex justify-between items-center mb-4">
                          <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))} className="p-1 hover:bg-slate-100 rounded-full"><ChevronLeft size={20}/></button>
                          <div className="flex items-center gap-2 font-bold text-slate-800">
                             {/* 연도 선택 (간편하게 셀렉트 박스) */}
                             <select 
                                value={viewDate.getFullYear()} 
                                onChange={(e) => setViewDate(new Date(viewDate.setFullYear(Number(e.target.value))))}
                                className="bg-transparent text-sm focus:outline-none cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                             >
                               {Array.from({length: 100}, (_, i) => new Date().getFullYear() - i).map(year => (
                                 <option key={year} value={year}>{year}</option>
                               ))}
                             </select>
                             <span>{t(`month_${viewDate.getMonth() + 1}`)}</span>
                          </div>
                          <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))} className="p-1 hover:bg-slate-100 rounded-full"><ChevronRight size={20}/></button>
                        </div>

                        {/* 요일 헤더 */}
                        <div className="grid grid-cols-7 text-center mb-2">
                          {t('weekdays_short')?.map((day: string) => (
                            <div key={day} className="text-xs text-slate-400 font-medium">{day}</div>
                          ))}
                        </div>

                        {/* 날짜 그리드 */}
                        <div className="grid grid-cols-7 gap-1">
                          {generateCalendar(viewDate.getFullYear(), viewDate.getMonth()).map((date, idx) => {
                            if (!date) return <div key={idx}></div>;
                            
                            // 날짜 비교용 문자열 (YYYY-MM-DD)
                            const dateStr = date.toLocaleDateString('en-CA'); 
                            const isSelected = profile.birth_date === dateStr;
                            const isToday = new Date().toDateString() === date.toDateString();

                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  setProfile({...profile, birth_date: dateStr});
                                  setIsCalendarOpen(false);
                                }}
                                className={`
                                  h-9 w-9 rounded-full text-sm flex items-center justify-center transition-all
                                  ${isSelected ? 'bg-black text-white font-bold' : 'hover:bg-slate-100 text-slate-700'}
                                  ${isToday && !isSelected ? 'ring-1 ring-black text-black font-bold' : ''}
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
                    onChange={e => setProfile({...profile, gender: e.target.value})}
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
                    onChange={e => setProfile({...profile, kakao_id: e.target.value})}
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
                    onChange={e => setProfile({...profile, mbti: e.target.value.toUpperCase()})}
                    placeholder={t('ph_mbti')}
                    maxLength={4}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:border-black outline-none transition-colors uppercase"
                  />
                </div>
                <div>
                <label className="block text-sm font-bold mb-2">{t('label_email')}</label> {/* 🟢 번역 */}
                  <input 
                    type="email" 
                    value={profile.email}
                    onChange={e => setProfile({...profile, email: e.target.value})}
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
                  onChange={e => setProfile({...profile, bio: e.target.value})}
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
<Save size={18}/> {saving ? t('saving') : t('btn_save_changes')} {/* 🟢 번역 */}
                </button>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}