'use client';

import React, { useState, useEffect } from 'react'; // ✅ useEffect 확인
import { User, Briefcase, Globe, Music, MessageCircle, Save, Camera, Lock, CreditCard, FileText } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';


export default function ProfileEditor({ profile, onUpdate }: any) {
  // ✅ 탭 상태 추가
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');

  // ✅ formData에 비공개 정보 필드들 추가
  const [formData, setFormData] = useState({
    // 기존 정보
    job: '', dream_destination: '', favorite_song: '', languages: '', introduction: '', name: '',
    // 신규 추가 (비공개 정보)
    phone: '', dob: '', host_nationality: '',
    bank_name: '', account_number: '', account_holder: '',
    motivation: ''
  });
  
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null);

  useEffect(() => {
    if (profile) {
      setFormData({
        // 공개 정보
        name: profile.name || '',
        job: profile.job || '',
        dream_destination: profile.dream_destination || '',
        favorite_song: profile.favorite_song || '',
        languages: Array.isArray(profile.languages) ? profile.languages.join(', ') : (profile.languages || ''),
        introduction: profile.introduction || profile.bio || '',
        
        // ✅ 비공개 정보 연결 (추가됨)
        phone: profile.phone || '',
        dob: profile.dob || '',
        host_nationality: profile.host_nationality || '',
        bank_name: profile.bank_name || '',
        account_number: profile.account_number || '',
        account_holder: profile.account_holder || '',
        motivation: profile.motivation || ''
      });
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

// 👇 handleChange 함수 아래에 추가
const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  if (!e.target.files || e.target.files.length === 0) return;
  setUploading(true);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const file = e.target.files[0];
    const fileName = `profile/${user.id}_${Date.now()}`;
    const { error } = await supabase.storage.from('images').upload(fileName, file);
    
    if (error) throw error;
    
    const { data } = supabase.storage.from('images').getPublicUrl(fileName);
    setAvatarUrl(data.publicUrl); // ✅ 미리보기 URL 업데이트
  } catch (err: any) {
    alert('사진 업로드 실패: ' + err.message);
  } finally {
    setUploading(false);
  }
};

  const handleSave = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const updates = {
        id: user.id,
        updated_at: new Date().toISOString(),
        
        // 기존 공개 데이터
        name: formData.name, // 이름 추가
        job: formData.job,
        dream_destination: formData.dream_destination,
        favorite_song: formData.favorite_song,
        languages: formData.languages.split(',').map((s:string) => s.trim()).filter((s:string) => s),
        introduction: formData.introduction,
        bio: formData.introduction,
        avatar_url: avatarUrl,

        // ✅ 비공개 데이터 추가 저장
        phone: formData.phone,
        dob: formData.dob,
        host_nationality: formData.host_nationality,
        bank_name: formData.bank_name,
        account_number: formData.account_number,
        account_holder: formData.account_holder,
        motivation: formData.motivation
      };

      const { error } = await supabase.from('profiles').upsert(updates);
      if (!error) {
        alert('프로필이 저장되었습니다!');
        if(onUpdate) onUpdate();
      } else {
        alert('저장 중 오류가 발생했습니다.');
        console.error(error);
      }
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* ✅ 1. 상단 탭 메뉴 (신규 추가) */}
      <div className="flex border-b border-slate-100 bg-slate-50/50">
        <button 
          onClick={() => setActiveTab('public')}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'public' ? 'bg-white text-black border-b-2 border-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <User size={16}/> 공개 프로필 (게스트용)
        </button>
        <button 
          onClick={() => setActiveTab('private')}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'private' ? 'bg-white text-black border-b-2 border-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Lock size={16}/> 비공개 정보 (관리용)
        </button>
      </div>

      <div className="p-8">
        
        {/* ✅ 2. 공개 프로필 탭 내용 (기존 내용 + 사진 업로드) */}
        {activeTab === 'public' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="flex flex-col items-center mb-8">
                <label className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg cursor-pointer group hover:border-slate-200 transition-all">
                   {avatarUrl ? (
                     <img src={avatarUrl} className="w-full h-full object-cover"/>
                   ) : (
                     <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300"><User size={48}/></div>
                   )}
                   <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <Camera className="text-white"/>
                   </div>
                   <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading}/>
                </label>
                <span className="text-xs text-slate-400 mt-2">{uploading ? '업로드 중...' : '사진 변경'}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup label="이름 (닉네임)" name="name" value={formData.name} onChange={handleChange} icon={<User size={16}/>} />
                <InputGroup label="직업 / 직장" name="job" value={formData.job} onChange={handleChange} icon={<Briefcase size={16}/>} placeholder="예: 패션 디자이너" />
                <InputGroup label="꿈의 여행지" name="dream_destination" value={formData.dream_destination} onChange={handleChange} icon={<Globe size={16}/>} placeholder="예: 아이슬란드 오로라 여행" />
                <InputGroup label="최애 노래" name="favorite_song" value={formData.favorite_song} onChange={handleChange} icon={<Music size={16}/>} placeholder="예: Bohemian Rhapsody" />
                <div className="col-span-2">
                    <InputGroup label="구사 언어 (쉼표로 구분)" name="languages" value={formData.languages} onChange={handleChange} icon={<MessageCircle size={16}/>} placeholder="예: 한국어, 영어" />
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">자기소개</label>
                <textarea 
                  name="introduction"
                  value={formData.introduction}
                  onChange={handleChange}
                  className="w-full h-40 p-4 border border-slate-200 rounded-xl resize-none focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all text-sm leading-relaxed"
                  placeholder="게스트에게 나를 소개해 주세요."
                />
            </div>
          </div>
        )}

{/* 🔴 비공개 정보 탭 (수정 불가 / 관리자 문의) */}
{activeTab === 'private' && (
          <div className="space-y-8 animate-in fade-in">
            
            {/* 🔒 수정 불가 안내 메시지 */}
            <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-xl flex gap-3 text-yellow-800 text-sm">
               <Lock className="flex-shrink-0 mt-0.5" size={18}/>
               <div>
                 <p className="font-bold mb-1">개인 정보 및 정산 정보는 수정할 수 없습니다.</p>
                 <p className="opacity-80">정보 변경이 필요한 경우, 관리자에게 문의해 주세요. (보안 및 정산 오류 방지)</p>
               </div>
            </div>

            {/* 1. 개인 신상 (잠김) */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 opacity-80">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><User size={18}/> 개인 신상 정보</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup label="연락처" name="phone" value={formData.phone} disabled={true} />
                <InputGroup label="생년월일" name="dob" value={formData.dob} disabled={true} />
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">국적</label>
                  <input value={formData.host_nationality} disabled className="w-full p-3.5 border border-slate-200 rounded-xl bg-slate-100 text-slate-500 text-sm cursor-not-allowed"/>
                </div>
              </div>
            </div>

            {/* 2. 정산 계좌 (잠김) */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 opacity-80">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><CreditCard size={18}/> 정산 계좌 정보</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InputGroup label="은행명" name="bank_name" value={formData.bank_name} disabled={true} />
                <InputGroup label="계좌번호" name="account_number" value={formData.account_number} disabled={true} />
                <InputGroup label="예금주" name="account_holder" value={formData.account_holder} disabled={true} />
              </div>
            </div>

            {/* 3. 지원 동기 (잠김) */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase flex items-center gap-1.5"><FileText size={14}/> 지원 동기 (가입 시 작성)</label>
              <textarea 
                value={formData.motivation} 
                disabled 
                className="w-full h-32 p-4 border border-slate-200 rounded-xl resize-none text-sm bg-slate-100 text-slate-500 cursor-not-allowed" 
              />
            </div>
          </div>
        )}

{/* 저장 버튼 (공개 탭일 때만 노출) */}
{activeTab === 'public' && (
          <div className="flex justify-end pt-8 mt-4 border-t border-slate-100">
            <button onClick={handleSave} disabled={loading} className="bg-black text-white px-8 py-4 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg active:scale-95 disabled:opacity-50">
              <Save size={18}/> {loading ? '저장 중...' : '변경사항 저장하기'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InputGroup({ label, name, value, onChange, icon, placeholder, disabled }: any) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-2 uppercase flex items-center gap-1.5">
        {icon} {label}
      </label>
      <input 
        type="text" 
        name={name}
        value={value} 
        onChange={onChange}
        disabled={disabled} // ✅ 비활성화 속성 연결
        className="w-full p-3.5 border border-slate-200 rounded-xl focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-medium text-sm"
        placeholder={placeholder}
      />
    </div>
  );
}