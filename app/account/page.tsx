'use client';

import React, { useEffect, useState, useRef } from 'react';
import SiteHeader from '@/app/components/SiteHeader';
import { createClient } from '@/app/utils/supabase/client';
import { User, ShieldCheck, Star, Save, MessageCircle, Smile, Camera, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AccountPage() {
  const supabase = createClient();
  const router = useRouter();
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
    avatar_url: '' // 프로필 사진 URL 추가
  });

  // 국가 리스트
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

  // 더미 후기 데이터
  const reviews = [
    { id: 1, host: 'Akiho', date: '2026년 1월', content: '정말 매너 좋고 시간 약속도 잘 지키시는 게스트였습니다! 대화도 즐거웠어요.' },
    { id: 2, host: 'Minjun', date: '2025년 12월', content: '깔끔하게 이용해주셔서 감사합니다. 추천합니다!' }
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
          email: user.email || '',
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

  // 📸 프로필 사진 업로드 핸들러
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    setUploading(true);
    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    try {
      // 1. Storage에 업로드
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. 공개 URL 가져오기
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 3. 상태 업데이트 및 DB 즉시 저장
      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      
      alert('프로필 사진이 변경되었습니다.');
    } catch (error: any) {
      alert('사진 업로드 실패: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // 💾 전체 정보 저장 핸들러
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
      email: user.email, 
      avatar_url: profile.avatar_url, // 사진 URL도 함께 저장
      updated_at: new Date().toISOString(), 
    };

    let { error } = await supabase.from('profiles').upsert(updates);

    if (error) {
      console.error('Save error:', error);
      alert(`저장에 실패했습니다. (${error.message})`);
    } else {
      alert('✅ 프로필이 성공적으로 업데이트되었습니다.');
      router.refresh(); 
    }
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      
      <main className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black mb-2">계정 및 프로필</h1>
        <p className="text-slate-500 mb-10">본인 정보를 관리하고 호스트에게 보여질 프로필을 설정하세요.</p>

        <div className="flex flex-col lg:flex-row gap-16">
          
          {/* 왼쪽: 프로필 카드 */}
          <div className="w-full lg:w-[360px] flex-shrink-0">
            <div className="border border-slate-200 rounded-3xl p-8 shadow-sm text-center sticky top-28 bg-white">
              
              {/* 📸 프로필 사진 영역 (클릭 시 파일 선택) */}
              <div className="relative w-32 h-32 mx-auto mb-4 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-32 h-32 bg-slate-200 rounded-full overflow-hidden border border-slate-100 shadow-inner relative">
                   {profile.avatar_url ? (
                     <img src={profile.avatar_url} className="w-full h-full object-cover"/>
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={48}/></div>
                   )}
                   
                   {/* 호버 시 오버레이 */}
                   <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <Camera size={24} className="text-white"/>
                   </div>
                   
                   {/* 로딩 표시 */}
                   {uploading && (
                     <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                       <Loader2 size={24} className="text-white animate-spin"/>
                     </div>
                   )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleAvatarUpload} 
                  accept="image/*" 
                  className="hidden"
                />
              </div>

              <h2 className="text-2xl font-black mb-1">{profile.full_name || '이름 없음'}</h2>
              <p className="text-slate-500 text-sm mb-4">
                {countries.find(c => c.code === profile.nationality)?.name || profile.nationality || '국적 미설정'}
              </p>
              
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600">
                  <ShieldCheck size={14}/> 신원 인증됨
                </div>
                {profile.gender && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold border border-blue-100">
                    {profile.gender === 'Male' ? '남성' : profile.gender === 'Female' ? '여성' : '기타'}
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

              {profile.kakao_id && (
                <div className="flex items-center justify-center gap-2 text-sm font-medium text-yellow-900 bg-yellow-400/20 py-2 rounded-lg mb-6">
                  <MessageCircle size={16}/> Kakao: {profile.kakao_id}
                </div>
              )}
              
              <div className="text-left space-y-4 pt-6 border-t border-slate-100">
                <h3 className="font-bold text-lg flex items-center gap-2"><Star size={18} fill="black"/> 호스트에게 받은 후기 ({reviews.length})</h3>
                {reviews.map(review => (
                  <div key={review.id} className="bg-slate-50 p-4 rounded-xl text-sm border border-slate-100">
                    <div className="flex justify-between mb-1.5">
                      <span className="font-bold text-slate-900">{review.host} 호스트님</span>
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
                  <label className="block text-sm font-bold mb-2">이름 (실명)</label>
                  <input 
                    type="text" 
                    value={profile.full_name}
                    onChange={e => setProfile({...profile, full_name: e.target.value})}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:border-black outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">국적</label>
                  <select 
                    value={profile.nationality}
                    onChange={e => setProfile({...profile, nationality: e.target.value})}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:border-black outline-none transition-colors bg-white"
                  >
                    <option value="">국적을 선택하세요</option>
                    {countries.map(country => (
                      <option key={country.code} value={country.code}>{country.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold mb-2">생년월일</label>
                  <input 
                    type="date" 
                    value={profile.birth_date}
                    onChange={e => setProfile({...profile, birth_date: e.target.value})}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:border-black outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">성별</label>
                  <select 
                    value={profile.gender}
                    onChange={e => setProfile({...profile, gender: e.target.value})}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:border-black outline-none transition-colors bg-white"
                  >
                    <option value="">선택하세요</option>
                    <option value="Male">남성 (Male)</option>
                    <option value="Female">여성 (Female)</option>
                    <option value="Other">기타 (Other)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold mb-2">전화번호</label>
                  <input 
                    type="tel" 
                    value={profile.phone}
                    onChange={e => setProfile({...profile, phone: e.target.value})}
                    placeholder="국가번호 포함 (ex. +82 10-1234-5678)"
                    className="w-full p-3 border border-slate-300 rounded-xl focus:border-black outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">카카오톡 ID</label>
                  <input 
                    type="text" 
                    value={profile.kakao_id}
                    onChange={e => setProfile({...profile, kakao_id: e.target.value})}
                    placeholder="연락용 카카오톡 ID"
                    className="w-full p-3 border border-slate-300 rounded-xl focus:border-black outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold mb-2">MBTI</label>
                  <input 
                    type="text" 
                    value={profile.mbti}
                    onChange={e => setProfile({...profile, mbti: e.target.value.toUpperCase()})}
                    placeholder="ex. ENFP"
                    maxLength={4}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:border-black outline-none transition-colors uppercase"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">이메일 주소</label>
                  <input 
                    type="email" 
                    value={profile.email}
                    disabled
                    className="w-full p-3 border border-slate-200 bg-slate-50 rounded-xl text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">자기소개</label>
                <textarea 
                  rows={5}
                  value={profile.bio}
                  onChange={e => setProfile({...profile, bio: e.target.value})}
                  placeholder="호스트에게 자신을 간단히 소개해주세요. (취미, 여행 스타일 등)"
                  className="w-full p-3 border border-slate-300 rounded-xl focus:border-black outline-none transition-colors resize-none"
                />
              </div>

              <div className="pt-6 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:scale-105 transition-transform flex items-center gap-2 disabled:opacity-50"
                >
                  <Save size={18}/> {saving ? '저장 중...' : '변경사항 저장'}
                </button>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}