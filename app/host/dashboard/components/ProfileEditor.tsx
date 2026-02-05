'use client';

import React, { useState } from 'react';
import { User, Briefcase, Globe, Music, MessageCircle, Save } from 'lucide-react';
import { createClient } from '@/app/utils/supabase/client';

export default function ProfileEditor({ profile, onUpdate }: any) {
  const [formData, setFormData] = useState({
    job: profile?.job || '',
    dream_destination: profile?.dream_destination || '',
    favorite_song: profile?.favorite_song || '',
    languages: profile?.languages ? profile.languages.join(', ') : '',
    introduction: profile?.introduction || '',
  });
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const updates = {
        id: user.id,
        job: formData.job,
        dream_destination: formData.dream_destination,
        favorite_song: formData.favorite_song,
        languages: formData.languages.split(',').map((s:string) => s.trim()).filter((s:string) => s),
        introduction: formData.introduction,
        updated_at: new Date().toISOString(),
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mb-8 border-b border-slate-100 pb-6">
        <h2 className="text-2xl font-bold mb-2">호스트 프로필 설정</h2>
        <p className="text-slate-500 text-sm">게스트에게 보여질 나의 정보를 매력적으로 꾸며보세요.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <InputGroup label="직업 / 직장" name="job" value={formData.job} onChange={handleChange} icon={<Briefcase size={16}/>} placeholder="예: 패션 디자이너" />
        <InputGroup label="꿈의 여행지" name="dream_destination" value={formData.dream_destination} onChange={handleChange} icon={<Globe size={16}/>} placeholder="예: 아이슬란드 오로라 여행" />
        <InputGroup label="학창시절 최애 노래" name="favorite_song" value={formData.favorite_song} onChange={handleChange} icon={<Music size={16}/>} placeholder="예: Bohemian Rhapsody - Queen" />
        <InputGroup label="구사 언어 (쉼표로 구분)" name="languages" value={formData.languages} onChange={handleChange} icon={<MessageCircle size={16}/>} placeholder="예: 한국어, 영어, 일본어" />
      </div>

      <div className="mb-8">
        <label className="block text-sm font-bold text-slate-700 mb-2">자기소개</label>
        <textarea 
          name="introduction"
          value={formData.introduction}
          onChange={handleChange}
          className="w-full h-40 p-4 border border-slate-200 rounded-xl resize-none focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all text-sm leading-relaxed"
          placeholder="게스트에게 나를 소개해 주세요. (여행 스타일, 호스팅 이유 등)"
        />
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-100">
        <button 
          onClick={handleSave} 
          disabled={loading}
          className="bg-black text-white px-8 py-4 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg active:scale-95"
        >
          <Save size={18}/> {loading ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  );
}

function InputGroup({ label, name, value, onChange, icon, placeholder }: any) {
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
        className="w-full p-3.5 border border-slate-200 rounded-xl focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-medium text-sm"
        placeholder={placeholder}
      />
    </div>
  );
}