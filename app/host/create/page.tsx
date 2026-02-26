'use client';

import React, { useState } from 'react';
import { X, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/context/ToastContext'; // 🟢 알림 기능 사용
import { TOTAL_STEPS, INITIAL_FORM_DATA } from './config';
import ExperienceFormSteps from './components/ExperienceFormSteps';
import { validateImage, sanitizeFileName, compressImage } from '@/app/utils/image';

export default function CreateExperiencePage() {
  const supabase = createClient();
  const router = useRouter();
  const { showToast } = useToast(); // 🟢 토스트 훅 가져오기

  // --- 상태 관리 ---
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    ...INITIAL_FORM_DATA,
    meeting_point: '', // 추가
    is_private_enabled: false,
    private_price: 0,
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

  const handleRemoveImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    const newPhotos = formData.photos.filter((_, i) => i !== index);
    updateData('photos', newPhotos);
  };

  // 📸 사진 업로드 핸들러 수정
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);

      // 최대 장수 제한 (10장으로 상향)
      if (formData.photos.length + files.length > 10) {
        showToast('사진은 최대 10장까지 업로드 가능합니다.', 'error');
        return;
      }

      const newUrls: string[] = [];
      const newFiles: File[] = [];

      for (const file of files) {
        const validation = validateImage(file);
        if (!validation.valid) {
          showToast(validation.message || '이미지 형식이 올바르지 않습니다.', 'error');
          continue;
        }

        try {
          // ✅ 이미지 압축 및 리사이징 적용 (최대 1MB, 1280px)
          const compressedFile = await compressImage(file);
          const url = URL.createObjectURL(compressedFile);
          newUrls.push(url);
          newFiles.push(compressedFile);
        } catch (err) {
          console.error('Compression error:', err);
          showToast('이미지 처리 중 오류가 발생했습니다.', 'error');
        }
      }

      if (newUrls.length > 0) {
        updateData('photos', [...formData.photos, ...newUrls]);
        setImageFiles(prev => [...prev, ...newFiles]);
      }
    }
  };
  // 🚀 최종 제출 함수 수정 (파일명 최적화 및 버킷 명칭 확인)
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      const photoUrls = [];
      for (const file of imageFiles) {
        // ✅ [추가] 파일명 최적화 (유저ID_타임스탬프_안전한파일명)
        const safeName = sanitizeFileName(file.name);
        const fileName = `experience/${user.id}/${Date.now()}_${safeName}`;

        // SQL에서 설정한 버킷 이름 'experiences' 또는 'images' 중 실제 사용하시는 것으로 맞춰주세요.
        const { error: uploadError } = await supabase.storage.from('experiences').upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          showToast('사진 업로드에 실패했어요. 용량·형식을 확인해주세요.', 'error');
          continue;
        }

        const { data } = supabase.storage.from('experiences').getPublicUrl(fileName);
        photoUrls.push(data.publicUrl);
      }

      const { error } = await supabase.from('experiences').insert([
        {
          host_id: user.id,
          country: formData.country,
          city: formData.city,
          title: formData.title,
          category: formData.category,
          languages: formData.languages,
          duration: formData.duration,
          max_guests: formData.maxGuests,
          description: formData.description,
          itinerary: formData.itinerary,
          spots: formData.itinerary.map(i => i.title).join(' -> '),
          meeting_point: formData.meeting_point || formData.itinerary[0]?.title || '',
          photos: photoUrls,
          price: formData.price,
          inclusions: formData.inclusions,
          exclusions: formData.exclusions,
          supplies: formData.supplies,
          rules: formData.rules,
          status: 'pending',
          is_private_enabled: formData.is_private_enabled,
          private_price: formData.private_price
        }
      ]);

      if (error) throw error;

      // 🟢 [수정됨] 등록 성공 시 알림 띄우고 대시보드로 이동
      showToast('체험이 성공적으로 등록되었습니다! 🎉', 'success');
      router.push('/host/dashboard?tab=experiences'); // 내 체험 관리 탭으로 이동

    } catch (error: any) {
      console.error(error);
      showToast('등록 실패: ' + error.message, 'error'); // 🟢 에러도 토스트로 표시
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col">
      {/* 헤더 */}
      {step < TOTAL_STEPS && (
        <header className="fixed top-0 left-0 right-0 h-14 md:h-20 bg-white/80 backdrop-blur-md z-50 px-4 md:px-6 flex items-center justify-between pt-[env(safe-area-inset-top,0px)]">
          <Link href="/host/dashboard?tab=experiences" className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} className="text-slate-900" /></Link>
          <div className="w-1/3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-black transition-all duration-500 ease-out" style={{ width: `${(step / (TOTAL_STEPS - 1)) * 100}%` }} />
          </div>
          <div className="w-10"></div>
        </header>
      )}

      {/* 메인 컨텐츠 */}
      <main className="flex-1 flex flex-col items-center pt-[calc(env(safe-area-inset-top,0px)+4.75rem)] md:pt-32 pb-28 md:pb-40 px-4 md:px-6 w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <ExperienceFormSteps
          step={step}
          formData={formData}
          updateData={updateData}
          handleCounter={handleCounter}
          handlePhotoUpload={handlePhotoUpload}
          addItem={addItem}
          removeItem={removeItem}
          handleRemoveImage={handleRemoveImage}
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

      {/* 푸터 */}
      {step < TOTAL_STEPS && (
        <footer
          className="fixed bottom-0 left-0 right-0 h-[88px] md:h-24 bg-white/90 backdrop-blur-md border-t border-slate-100 flex items-center justify-between px-4 md:px-6 z-50"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
        >
          <button onClick={prevStep} disabled={step === 1} className={`px-4 md:px-6 py-2.5 md:py-3 rounded-full font-bold text-xs md:text-sm transition-all ${step === 1 ? 'text-slate-300' : 'text-slate-600 hover:bg-slate-100 underline decoration-2'}`}>이전</button>
          {step === TOTAL_STEPS - 1 ? (
            <button onClick={handleSubmit} disabled={loading} className="bg-black text-white px-6 md:px-10 py-3 md:py-4 rounded-full font-bold text-sm md:text-base hover:scale-105 transition-transform shadow-xl shadow-slate-300 disabled:opacity-50 flex items-center gap-2">
              {loading ? '등록 중...' : '체험 등록하기'}
            </button>
          ) : (
            <button onClick={nextStep} className="bg-black text-white px-6 md:px-10 py-3 md:py-4 rounded-full font-bold text-sm md:text-base hover:scale-105 transition-transform flex items-center gap-2 shadow-xl shadow-slate-300">다음 <ChevronRight size={16} className="md:w-[18px] md:h-[18px]" /></button>
          )}
        </footer>
      )}
    </div>
  );
}
