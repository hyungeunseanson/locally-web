'use client';

import React, { useState } from 'react';
import { X, ChevronRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { TOTAL_STEPS, INITIAL_FORM_DATA } from './config';
import ExperienceFormSteps from './components/ExperienceFormSteps'; // ✅ 분리된 파일 임포트

export default function CreateExperiencePage() {
  const supabase = createClient();
  const router = useRouter();

  // --- 상태 관리 (State) ---
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    ...INITIAL_FORM_DATA,
    is_private_enabled: false, // ✅ 프라이빗 옵션 추가
    private_price: 0,          // ✅ 프라이빗 가격 추가
  });

  // UI용 임시 상태
  const [isCustomCity, setIsCustomCity] = useState(false); 
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [tempInclusion, setTempInclusion] = useState('');
  const [tempExclusion, setTempExclusion] = useState('');

  // --- 네비게이션 함수 ---
  const nextStep = () => { if (step < TOTAL_STEPS) setStep(step + 1); };
  const prevStep = () => { if (step > 1) setStep(step - 1); };

  // --- 데이터 업데이트 함수들 ---
  const updateData = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleCounter = (key: string, type: 'inc' | 'dec') => {
    const currentVal = formData[key as keyof typeof formData] as number;
    if (type === 'dec' && currentVal <= 1) return;
    updateData(key, type === 'inc' ? currentVal + 1 : currentVal - 1);
  };

  const addItem = (field: 'inclusions' | 'exclusions', value: string, setter: any) => {
    if (!value.trim()) return;
    updateData(field, [...formData[field], value]);
    setter('');
  };

  const removeItem = (field: 'inclusions' | 'exclusions', index: number) => {
    updateData(field, formData[field].filter((_, i) => i !== index));
  };

  // 📍 동선(루트) 관리
  const addItineraryItem = () => {
    updateData('itinerary', [...formData.itinerary, { title: '', description: '', type: 'spot' }]);
  };
  
  const removeItineraryItem = (index: number) => {
    if (formData.itinerary.length <= 1) return; 
    updateData('itinerary', formData.itinerary.filter((_, i) => i !== index));
  };

  const updateItineraryItem = (index: number, key: string, value: string) => {
    const newItinerary = [...formData.itinerary];
    newItinerary[index] = { ...newItinerary[index], [key]: value };
    updateData('itinerary', newItinerary);
  };

  // 📸 사진 업로드 핸들러
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      updateData('photos', [...formData.photos, url]);
      setImageFiles(prev => [...prev, file]);
    }
  };

  // 🚀 최종 제출
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      const photoUrls = [];
      for (const file of imageFiles) {
        const fileName = `experience/${user.id}_${Date.now()}_${Math.random()}`;
        const { error } = await supabase.storage.from('images').upload(fileName, file);
        if (!error) {
          const { data } = supabase.storage.from('images').getPublicUrl(fileName);
          photoUrls.push(data.publicUrl);
        }
      }

      const { error } = await supabase.from('experiences').insert([
        {
          host_id: user.id,
          country: formData.country,
          city: formData.city,
          title: formData.title,
          category: formData.category,
          duration: formData.duration,
          max_guests: formData.maxGuests,
          description: formData.description,
          itinerary: formData.itinerary, 
          spots: formData.itinerary.map(i => i.title).join(' -> '), 
          meeting_point: formData.itinerary[0]?.description || '',
          photos: photoUrls,
          price: formData.price,
          inclusions: formData.inclusions,
          exclusions: formData.exclusions,
          supplies: formData.supplies,
          rules: formData.rules, 
          status: 'pending',
          // ✅ 프라이빗 정보 저장
          is_private_enabled: formData.is_private_enabled,
          private_price: formData.private_price
        }
      ]);

      if (error) throw error;
      setStep(step + 1); // 완료 화면으로 이동

    } catch (error: any) {
      console.error(error);
      alert('등록 실패: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col">
      {/* 헤더 (진행바) */}
      {step < TOTAL_STEPS && (
        <header className="fixed top-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-md z-50 px-6 flex items-center justify-between">
          <Link href="/host/dashboard" className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} className="text-slate-900"/></Link>
          <div className="w-1/3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-black transition-all duration-500 ease-out" style={{ width: `${(step / (TOTAL_STEPS - 1)) * 100}%` }}/>
          </div>
          <div className="w-10"></div>
        </header>
      )}

      {/* 메인 컨텐츠 (여기에 모든 스텝이 들어감) */}
      <main className="flex-1 flex flex-col items-center pt-32 pb-40 px-6 w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <ExperienceFormSteps 
          step={step}
          formData={formData}
          updateData={updateData}
          handleCounter={handleCounter}
          handlePhotoUpload={handlePhotoUpload}
          addItem={addItem}
          removeItem={removeItem}
          addItineraryItem={addItineraryItem}
          removeItineraryItem={removeItineraryItem}
          updateItineraryItem={updateItineraryItem}
          isCustomCity={isCustomCity}
          setIsCustomCity={setIsCustomCity}
          tempInclusion={tempInclusion}
          setTempInclusion={setTempInclusion}
          tempExclusion={tempExclusion}
          setTempExclusion={setTempExclusion}
        />
      </main>

      {/* 푸터 (네비게이션 버튼) */}
      {step < TOTAL_STEPS && (
        <footer className="fixed bottom-0 left-0 right-0 h-24 bg-white/90 backdrop-blur-md border-t border-slate-100 flex items-center justify-between px-6 z-50">
          <button onClick={prevStep} disabled={step === 1} className={`px-6 py-3 rounded-full font-bold text-sm transition-all ${step === 1 ? 'text-slate-300' : 'text-slate-600 hover:bg-slate-100 underline decoration-2'}`}>이전</button>
          {step === TOTAL_STEPS - 1 ? (
            <button onClick={handleSubmit} disabled={loading} className="bg-black text-white px-10 py-4 rounded-full font-bold text-base hover:scale-105 transition-transform shadow-xl shadow-slate-300 disabled:opacity-50">{loading ? '등록 중...' : '체험 등록하기'}</button>
          ) : (
            <button onClick={nextStep} className="bg-black text-white px-10 py-4 rounded-full font-bold text-base hover:scale-105 transition-transform flex items-center gap-2 shadow-xl shadow-slate-300">다음 <ChevronRight size={18}/></button>
          )}
        </footer>
      )}
    </div>
  );
}