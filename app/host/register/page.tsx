'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import SiteHeader from '@/app/components/SiteHeader';
import { createClient } from '@/app/utils/supabase/client';
import { ChevronLeft, Camera, CheckCircle2, MapPin, User, Calendar } from 'lucide-react';
import Link from 'next/link';

export default function HostRegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  // 보내주신 양식 항목 완벽 반영
  const [formData, setFormData] = useState({
    name: '', phone: '', birthdate: '', email: '', instagram: '', mbti: '',
    motivation: '', koreanLevel: '초급', koreanCert: '', selfIntro: '',
    tourLocation: '도쿄', tour1Places: '', tour1Price: '', tour1Intro: '', tour1MeetingPoint: '',
    availableDates: '', photoSelf: '', photoId: ''
  });

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('로그인이 필요합니다.');

    const { error } = await supabase.from('host_applications').insert([{
      user_id: user.id,
      name: formData.name,
      phone: formData.phone,
      birthdate: formData.birthdate,
      email: formData.email,
      instagram: formData.instagram,
      mbti: formData.mbti,
      motivation: formData.motivation,
      korean_level: formData.koreanLevel,
      korean_cert: formData.koreanCert,
      self_intro: formData.selfIntro,
      tour_location: formData.tourLocation,
      tour_1_places: formData.tour1Places,
      tour_1_price: formData.tour1Price,
      tour_1_intro: formData.tour1Intro,
      tour_1_meeting_point: formData.tour1MeetingPoint,
      available_dates: formData.availableDates,
      status: 'pending'
    }]);

    if (error) {
      console.error(error);
      alert('제출 실패. 다시 시도해주세요.');
    } else {
      alert('🎉 지원서가 제출되었습니다! 관리자 검토 후 연락드리겠습니다.');
      router.push('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* 상단 네비게이션 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-400 mb-2">
            <span className={step >= 1 ? "text-black" : ""}>1.기본정보</span>
            <span>&gt;</span>
            <span className={step >= 2 ? "text-black" : ""}>2.언어&소개</span>
            <span>&gt;</span>
            <span className={step >= 3 ? "text-black" : ""}>3.투어기획</span>
            <span>&gt;</span>
            <span className={step >= 4 ? "text-black" : ""}>4.일정</span>
          </div>
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-black transition-all duration-500" style={{ width: `${step * 25}%` }}></div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
          
          {/* STEP 1: 기본 정보 */}
          {step === 1 && (
            <section className="space-y-6">
              <h1 className="text-3xl font-black">어떤 분인지 알려주세요 👋</h1>
              <p className="text-slate-500">파트너님에 대한 기본적인 정보가 필요합니다.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="1. 성함 (氏名)" name="name" val={formData.name} onChange={handleChange} ph="홍길동" />
                <Input label="2. 전화번호" name="phone" val={formData.phone} onChange={handleChange} ph="010-0000-0000" />
                <Input label="3. 생년월일" name="birthdate" type="date" val={formData.birthdate} onChange={handleChange} />
                <Input label="4. 이메일" name="email" type="email" val={formData.email} onChange={handleChange} />
              </div>
              <Input label="6. 인스타그램 계정 (@ID)" name="instagram" val={formData.instagram} onChange={handleChange} ph="@locally_trip" />
              <Input label="10. MBTI" name="mbti" val={formData.mbti} onChange={handleChange} ph="ENFP" />
              
              <button type="button" onClick={() => setStep(2)} className="w-full bg-black text-white py-4 rounded-xl font-bold mt-4">다음 단계로</button>
            </section>
          )}

          {/* STEP 2: 언어 및 소개 */}
          {step === 2 && (
            <section className="space-y-6">
              <h1 className="text-3xl font-black">언어 능력과 매력 어필 🗣️</h1>
              
              <div>
                <label className="block text-sm font-bold mb-2">7. 한국어 레벨</label>
                <select name="koreanLevel" className="w-full border p-3 rounded-xl bg-white" onChange={handleChange} value={formData.koreanLevel}>
                  <option value="초급">초급 (번역기 필수)</option>
                  <option value="중급">중급 (간단한 대화 가능)</option>
                  <option value="상급">상급 (일상 회화 가능)</option>
                  <option value="네이티브">네이티브 (문화적 표현 이해)</option>
                </select>
              </div>
              <Input label="8. 한국어 자격증 (선택)" name="koreanCert" val={formData.koreanCert} onChange={handleChange} ph="TOPIK 6급 등" />
              
              <div className="space-y-2">
                <label className="block text-sm font-bold">5. 지원 동기 (Locally를 알게 된 계기)</label>
                <textarea name="motivation" className="w-full border p-3 rounded-xl h-24 resize-none" onChange={handleChange} value={formData.motivation} placeholder="인스타그램 광고를 보고..." />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold">9. 자기소개 (강점)</label>
                <textarea name="selfIntro" className="w-full border p-3 rounded-xl h-32 resize-none" onChange={handleChange} value={formData.selfIntro} placeholder="저는 도쿄 맛집 탐방이 취미인..." />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="flex-1 bg-slate-100 py-4 rounded-xl font-bold">이전</button>
                <button type="button" onClick={() => setStep(3)} className="flex-1 bg-black text-white py-4 rounded-xl font-bold">다음</button>
              </div>
            </section>
          )}

          {/* STEP 3: 투어 기획 */}
          {step === 3 && (
            <section className="space-y-6">
              <h1 className="text-3xl font-black">나만의 투어 만들기 🗺️</h1>
              <p className="text-slate-500">가장 자신 있는 투어 코스를 하나 제안해주세요.</p>

              <div>
                <label className="block text-sm font-bold mb-2">11. 투어 개최 지역</label>
                <select name="tourLocation" className="w-full border p-3 rounded-xl bg-white" onChange={handleChange} value={formData.tourLocation}>
                  <option value="도쿄">도쿄 및 근교</option>
                  <option value="오사카">오사카 및 근교</option>
                  <option value="후쿠오카">후쿠오카</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              <div className="space-y-4">
                <Input label="12. 방문 장소 (구체적으로)" name="tour1Places" val={formData.tour1Places} onChange={handleChange} ph="아자부주반 상점가 -> 도쿄타워 산책" />
                <Input label="13. 희망 참가 비용 (엔화)" name="tour1Price" type="number" val={formData.tour1Price} onChange={handleChange} ph="3500" />
                <div className="space-y-2">
                   <label className="block text-sm font-bold">14. 투어 소개글</label>
                   <textarea name="tour1Intro" className="w-full border p-3 rounded-xl h-32 resize-none" onChange={handleChange} value={formData.tour1Intro} placeholder="현지인만 아는 골목길을 걸으며..." />
                </div>
                <Input label="15. 집합 장소" name="tour1MeetingPoint" val={formData.tour1MeetingPoint} onChange={handleChange} ph="신주쿠역 동쪽 출구 앞" />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="flex-1 bg-slate-100 py-4 rounded-xl font-bold">이전</button>
                <button type="button" onClick={() => setStep(4)} className="flex-1 bg-black text-white py-4 rounded-xl font-bold">다음</button>
              </div>
            </section>
          )}

          {/* STEP 4: 일정 및 마무리 */}
          {step === 4 && (
            <section className="space-y-6">
              <h1 className="text-3xl font-black">마지막입니다! 📅</h1>
              
              <Input label="20. 활동 가능 날짜 (1~2월)" name="availableDates" val={formData.availableDates} onChange={handleChange} ph="주말 가능, 혹은 1월 15, 16일..." />
              
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                <h3 className="font-bold mb-2 flex items-center gap-2"><Camera size={18}/> 사진 등록 (필수)</h3>
                <p className="text-sm text-slate-500 mb-4">본인 확인 및 파트너 소개를 위해 사진이 필요합니다.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border-2 border-dashed border-slate-300 rounded-xl h-32 flex flex-col items-center justify-center text-slate-400">본인 사진</div>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl h-32 flex flex-col items-center justify-center text-slate-400">신분증</div>
                </div>
                <p className="text-xs text-slate-400 mt-2 text-center">* 현재 파일 업로드는 준비 중입니다. 제출 시 담당자가 별도로 요청드립니다.</p>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(3)} className="flex-1 bg-slate-100 py-4 rounded-xl font-bold">이전</button>
                <button type="submit" disabled={loading} className="flex-[2] bg-slate-900 text-white py-4 rounded-xl font-bold shadow-xl">
                  {loading ? '제출 중...' : '지원서 제출하기'}
                </button>
              </div>
            </section>
          )}

        </form>
      </main>
    </div>
  );
}

// 간단한 인풋 컴포넌트
function Input({ label, name, val, onChange, ph, type = "text" }: any) {
  return (
    <div>
      <label className="block text-sm font-bold mb-2">{label}</label>
      <input type={type} name={name} value={val} onChange={onChange} placeholder={ph} required
        className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:border-black focus:outline-none transition-colors" />
    </div>
  )
}