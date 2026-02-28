'use client';

import React, { useState, useEffect } from 'react';
import { User, Briefcase, Globe, Music, MessageCircle, Save, Camera, Lock, CreditCard, FileText, AlertTriangle } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext';

interface HostProfile {
  full_name?: string;
  job?: string;
  dream_destination?: string;
  favorite_song?: string;
  languages?: string[] | string;
  introduction?: string;
  bio?: string;
  phone?: string;
  dob?: string;
  host_nationality?: string;
  bank_name?: string;
  account_number?: string;
  account_holder?: string;
  motivation?: string;
  avatar_url?: string | null;
}

interface ProfileEditorProps {
  profile?: HostProfile | null;
  onUpdate?: () => void;
}

interface InputGroupProps {
  label: string;
  name: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
  icon?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
}

export default function ProfileEditor({ profile, onUpdate }: ProfileEditorProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');

  const [formData, setFormData] = useState({
    name: '',
    job: '',
    dream_destination: '',
    favorite_song: '',
    languages: '',
    introduction: '',
    phone: '',
    dob: '',
    host_nationality: '',
    bank_name: '',
    account_number: '',
    account_holder: '',
    motivation: ''
  });

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.full_name || '',
        job: profile.job || '',
        dream_destination: profile.dream_destination || '',
        favorite_song: profile.favorite_song || '',
        languages: Array.isArray(profile.languages) ? profile.languages.join(', ') : (profile.languages || ''),
        introduction: profile.introduction || profile.bio || '',
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

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
      setAvatarUrl(data.publicUrl);
      showToast('사진이 업로드되었습니다.', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류';
      showToast('사진 업로드 실패: ' + message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        full_name: formData.name,
        job: formData.job,
        dream_destination: formData.dream_destination,
        favorite_song: formData.favorite_song,
        languages: formData.languages.split(',').map((s: string) => s.trim()).filter(Boolean),
        introduction: formData.introduction,
        bio: formData.introduction,
        avatar_url: avatarUrl,
      };

      const { data: existingProfile, error: loadError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (loadError) {
        showToast('저장 중 오류가 발생했습니다.', 'error');
        console.error(loadError);
        setLoading(false);
        return;
      }

      let error: { message: string } | null = null;

      if (!existingProfile) {
        const insertRes = await supabase.from('profiles').upsert({
          id: user.id,
          ...updates,
        });
        error = insertRes.error;
      } else {
        const allowedColumns = new Set(Object.keys(existingProfile));
        const filteredUpdates = Object.fromEntries(
          Object.entries(updates).filter(([key, value]) => allowedColumns.has(key) && value !== undefined)
        );

        const updateRes = await supabase
          .from('profiles')
          .update(filteredUpdates)
          .eq('id', user.id);
        error = updateRes.error;
      }

      if (!error) {
        showToast('정보가 성공적으로 저장되었습니다!', 'success');
        if (onUpdate) onUpdate();
      } else {
        showToast('저장 중 오류가 발생했습니다.', 'error');
        console.error(error);
      }
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-0 animate-in fade-in slide-in-from-bottom-2 duration-300">

      {/* 상단 탭 메뉴 */}
      <div className="flex border-b border-slate-100 bg-slate-50/50">
        <button
          onClick={() => setActiveTab('public')}
          className={`flex-1 py-3 md:py-4 text-xs md:text-sm font-bold flex items-center justify-center gap-1.5 md:gap-2 transition-colors ${activeTab === 'public' ? 'bg-white text-black border-b-2 border-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <User size={14} className="md:w-4 md:h-4" /> 공개 프로필
        </button>
        <button
          onClick={() => setActiveTab('private')}
          className={`flex-1 py-3 md:py-4 text-xs md:text-sm font-bold flex items-center justify-center gap-1.5 md:gap-2 transition-colors ${activeTab === 'private' ? 'bg-white text-black border-b-2 border-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Lock size={14} className="md:w-4 md:h-4" /> 비공개 정보
        </button>
      </div>

      <div className="p-3.5 md:p-8">
        {activeTab === 'public' && (
          <div className="space-y-5 md:space-y-8 animate-in fade-in">
            <div className="flex flex-col items-center">
              <label className="relative w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-white shadow-lg cursor-pointer group hover:border-slate-200 transition-all">
                {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300"><User size={36} className="md:w-12 md:h-12" /></div>}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="text-white" /></div>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
              </label>
              <span className="text-[11px] md:text-xs text-slate-400 mt-2">프로필 사진 변경</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputGroup label="이름 (닉네임)" name="name" value={formData.name} onChange={handleChange} icon={<User size={16} />} />
              <InputGroup label="직업 / 직장" name="job" value={formData.job} onChange={handleChange} icon={<Briefcase size={16} />} placeholder="예: 패션 디자이너" />
              <InputGroup label="꿈의 여행지" name="dream_destination" value={formData.dream_destination} onChange={handleChange} icon={<Globe size={16} />} placeholder="예: 아이슬란드 오로라 여행" />
              <InputGroup label="최애 노래" name="favorite_song" value={formData.favorite_song} onChange={handleChange} icon={<Music size={16} />} placeholder="예: Bohemian Rhapsody" />
              <div className="md:col-span-2">
                <InputGroup label="구사 언어 (쉼표로 구분)" name="languages" value={formData.languages} onChange={handleChange} icon={<MessageCircle size={16} />} placeholder="예: 한국어, 영어" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] md:text-xs font-bold text-slate-500 mb-2 uppercase">자기소개</label>
              <textarea name="introduction" value={formData.introduction} onChange={handleChange} className="w-full h-32 p-3 md:p-4 border border-slate-200 rounded-xl resize-none focus:border-black text-[13px] md:text-sm" placeholder="게스트에게 나를 소개해 주세요." />
            </div>
          </div>
        )}

        {activeTab === 'private' && (
          <div className="space-y-5 md:space-y-8 animate-in fade-in">
            {/* ✅ [수정] 통합된 안내 문구 (요청하신 내용 반영) */}
            <div className="bg-yellow-50 border border-yellow-100 p-4 md:p-5 rounded-xl flex gap-2.5 md:gap-3 text-yellow-800 text-xs md:text-sm leading-relaxed">
              <AlertTriangle className="flex-shrink-0 mt-0.5" size={16} />
              <div>
                <p className="font-bold mb-1">개인 정보 및 정산 정보는 직접 수정할 수 없습니다.</p>
                <p className="opacity-90">
                  이 정보는 게스트에게 공개되지 않으며, 정산 및 본인 확인 용도로만 사용됩니다. 정확하게 입력해 주세요.<br />
                  정보 변경이 필요한 경우, <span className="font-bold underline cursor-pointer">보안 및 정산 오류 방지</span>를 위해 관리자에게 문의해 주세요.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 md:p-6 rounded-2xl border border-slate-100 opacity-90">
              <h3 className="font-bold text-sm md:text-base text-slate-900 mb-3 md:mb-4 flex items-center gap-2"><User size={16} className="md:w-[18px] md:h-[18px]" /> 개인 신상 정보</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                {/* ✅ [수정] 모든 필드 disabled 처리 */}
                <InputGroup label="연락처" name="phone" value={formData.phone} disabled={true} placeholder="미입력" />
                <InputGroup label="생년월일" name="dob" value={formData.dob} disabled={true} placeholder="미입력" />
                <div className="col-span-2">
                  {/* ✅ [수정] 국적 필드 InputGroup으로 원복 */}
                  <InputGroup label="국적" name="host_nationality" value={formData.host_nationality} disabled={true} placeholder="미입력" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 md:p-6 rounded-2xl border border-slate-100 opacity-90">
              <h3 className="font-bold text-sm md:text-base text-slate-900 mb-3 md:mb-4 flex items-center gap-2"><CreditCard size={16} className="md:w-[18px] md:h-[18px]" /> 정산 계좌 정보</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                <InputGroup label="은행명" name="bank_name" value={formData.bank_name} disabled={true} placeholder="미입력" />
                <InputGroup label="계좌번호" name="account_number" value={formData.account_number} disabled={true} placeholder="미입력" />
                <InputGroup label="예금주" name="account_holder" value={formData.account_holder} disabled={true} placeholder="미입력" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] md:text-xs font-bold text-slate-500 mb-2 uppercase flex items-center gap-1.5"><FileText size={14} /> 지원 동기 (가입 시 작성)</label>
              <textarea
                value={formData.motivation || '작성된 내용이 없습니다.'}
                disabled
                className="w-full h-32 p-3 md:p-4 border border-slate-200 rounded-xl resize-none text-[13px] md:text-sm bg-slate-100 text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>
        )}

        {/* ✅ [수정] 저장 버튼은 Public 탭에서만 노출 */}
        {activeTab === 'public' && (
          <div className="flex justify-end pt-6 md:pt-8 mt-4 border-t border-slate-100">
            <button onClick={handleSave} disabled={loading} className="bg-black text-white px-4 py-2.5 md:px-8 md:py-4 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg active:scale-95 disabled:opacity-50 text-xs md:text-base">
              <Save size={18} /> {loading ? '저장 중...' : '변경사항 저장하기'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InputGroup({ label, name, value, onChange, icon, placeholder, disabled }: InputGroupProps) {
  return (
    <div>
      <label className="block text-[11px] md:text-xs font-bold text-slate-500 mb-2 uppercase flex items-center gap-1.5">{icon} {label}</label>
      <input
        type="text"
        name={name}
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        className={`w-full p-3 md:p-3.5 border border-slate-200 rounded-xl focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-medium text-[13px] md:text-sm ${disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
          }`}
        placeholder={placeholder}
      />
    </div>
  );
}
