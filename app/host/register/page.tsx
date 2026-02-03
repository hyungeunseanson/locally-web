'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import SiteHeader from '@/app/components/SiteHeader';
import { createClient } from '@/app/utils/supabase/client';
import { CheckCircle2 } from 'lucide-react';

export default function HostRegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    name: '', phone: '', birthdate: '', email: '', instagram: '', mbti: '',
    motivation: '', koreanLevel: '초급', koreanCert: '', selfIntro: '',
    tourLocation: '도쿄', tourConcept: '', tourCourse: '', tourPrice: '', tourMeeting: '', availableDates: ''
  });

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('로그인 필요');

    const { error } = await supabase.from('host_applications').insert([{
      user_id: user.id,
      name: formData.name, phone: formData.phone, birthdate: formData.birthdate, email: formData.email,
      instagram: formData.instagram, mbti: formData.mbti,
      motivation: formData.motivation, korean_level: formData.koreanLevel, korean_cert: formData.koreanCert, self_intro: formData.selfIntro,
      tour_location: formData.tourLocation, tour_concept: formData.tourConcept, tour_course: formData.tourCourse,
      tour_price: formData.tourPrice, tour_meeting: formData.tourMeeting, available_dates: formData.availableDates,
      status: 'pending'
    }]);

    if (error) alert('오류가 발생했습니다.');
    else {
      alert('🎉 신청이 완료되었습니다! 관리자 승인을 기다려주세요.');
      router.push('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black mb-2">Locally 파트너 지원 (STEP {step}/3)</h1>
        <p className="text-slate-500 mb-8">당신만의 로컬 이야기를 들려주세요.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2"><CheckCircle2/> 기본 정보</h2>
              <input name="name" placeholder="성함 (실명)" onChange={handleChange} className="w-full border p-3 rounded-xl" required/>
              <input name="phone" placeholder="전화번호" onChange={handleChange} className="w-full border p-3 rounded-xl" required/>
              <input name="email" type="email" placeholder="이메일" onChange={handleChange} className="w-full border p-3 rounded-xl" required/>
              <input name="instagram" placeholder="인스타그램 ID (@id)" onChange={handleChange} className="w-full border p-3 rounded-xl" required/>
              <button type="button" onClick={() => setStep(2)} className="w-full bg-black text-white py-4 rounded-xl font-bold">다음</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2"><CheckCircle2/> 전문성 어필</h2>
              <select name="koreanLevel" onChange={handleChange} className="w-full border p-3 rounded-xl bg-white"><option>초급</option><option>중급</option><option>상급</option><option>네이티브</option></select>
              <textarea name="motivation" placeholder="지원 동기 (Locally를 알게 된 계기)" onChange={handleChange} className="w-full border p-3 rounded-xl h-24 resize-none" required/>
              <textarea name="selfIntro" placeholder="자기소개 & 강점 (나를 뽑아야 하는 이유)" onChange={handleChange} className="w-full border p-3 rounded-xl h-32 resize-none" required/>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(1)} className="flex-1 bg-slate-100 py-4 rounded-xl font-bold">이전</button>
                <button type="button" onClick={() => setStep(3)} className="flex-1 bg-black text-white py-4 rounded-xl font-bold">다음</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2"><CheckCircle2/> 투어 기획안</h2>
              <select name="tourLocation" onChange={handleChange} className="w-full border p-3 rounded-xl bg-white"><option>도쿄</option><option>오사카</option><option>후쿠오카</option></select>
              <input name="tourConcept" placeholder="투어 컨셉/제목" onChange={handleChange} className="w-full border p-3 rounded-xl" required/>
              <textarea name="tourCourse" placeholder="방문 장소 및 코스 설명" onChange={handleChange} className="w-full border p-3 rounded-xl h-32 resize-none" required/>
              <input name="tourPrice" placeholder="희망 가격 (엔)" onChange={handleChange} className="w-full border p-3 rounded-xl" required/>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(2)} className="flex-1 bg-slate-100 py-4 rounded-xl font-bold">이전</button>
                <button type="submit" disabled={loading} className="flex-[2] bg-slate-900 text-white py-4 rounded-xl font-bold">{loading ? '제출 중...' : '제출하기'}</button>
              </div>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}