'use client';

import React, { useState } from 'react';
import { X, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/context/ToastContext'; // 🟢 알림 기능 사용
import {
  TOTAL_STEPS,
  INITIAL_FORM_DATA,
  MAX_EXPERIENCE_PHOTOS,
  FIXED_REFUND_POLICY,
  getExperienceFormCopy,
} from './config';
import ExperienceFormSteps from './components/ExperienceFormSteps';
import { validateImage, sanitizeFileName, compressImage, isHeicValidationResult } from '@/app/utils/image';
import { getLanguageNames } from '@/app/utils/languageLevels';
import { useLanguage } from '@/app/context/LanguageContext';

type ItineraryItem = {
  title: string;
  description: string;
  type: 'meet' | 'spot' | 'end';
  image_url?: string;
};

export default function CreateExperiencePage() {
  const { lang } = useLanguage();
  const copy = getExperienceFormCopy(lang);
  const supabase = createClient();
  const router = useRouter();
  const { showToast, showHeicUnsupportedToast } = useToast(); // 🟢 토스트 훅 가져오기

  // --- 상태 관리 ---
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    ...INITIAL_FORM_DATA,
    is_private_enabled: false,
    private_price: 0,
  });

  // UI용 임시 상태
  const [isCustomCity, setIsCustomCity] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [itineraryImageFiles, setItineraryImageFiles] = useState<(File | null)[]>(
    INITIAL_FORM_DATA.itinerary.map(() => null)
  );
  const [tempInclusion, setTempInclusion] = useState('');
  const [tempExclusion, setTempExclusion] = useState('');

  const validateCurrentStep = (targetStep: number) => {
    if (targetStep === 1) {
      if (!formData.city?.trim()) {
        showToast(copy.validationCity, 'error');
        return false;
      }
      if (!formData.category?.trim()) {
        showToast(copy.validationCategory, 'error');
        return false;
      }
      return true;
    }

    if (targetStep === 2) {
      if (!formData.language_levels || formData.language_levels.length === 0) {
        showToast(copy.validationLanguages, 'error');
        return false;
      }
      if (formData.language_levels.some((entry: { level?: number }) => !entry?.level || entry.level < 1 || entry.level > 5)) {
        showToast(copy.validationLanguageLevels, 'error');
        return false;
      }
      return true;
    }

    if (targetStep === 3) {
      if (!formData.title?.trim() || formData.title.trim().length < 6) {
        showToast(copy.validationTitle, 'error');
        return false;
      }
      if (!formData.photos || formData.photos.length < 1) {
        showToast(copy.validationPhotos, 'error');
        return false;
      }
      if (formData.photos.length > MAX_EXPERIENCE_PHOTOS) {
        showToast(copy.validationPhotoLimit(MAX_EXPERIENCE_PHOTOS), 'error');
        return false;
      }
      return true;
    }

    if (targetStep === 4) {
      if (!formData.meeting_point?.trim()) {
        showToast(copy.validationMeetingPoint, 'error');
        return false;
      }
      if (!formData.location?.trim()) {
        showToast(copy.validationLocation, 'error');
        return false;
      }
      const hasEmptyItinerary = (formData.itinerary || []).some((item: { title?: string }) => !item.title?.trim());
      if (hasEmptyItinerary) {
        showToast(copy.validationItineraryTitles, 'error');
        return false;
      }
      return true;
    }

    if (targetStep === 5) {
      if (!formData.description?.trim() || formData.description.trim().length < 30) {
        showToast(copy.validationDescription, 'error');
        return false;
      }
      if (!formData.inclusions || formData.inclusions.length === 0) {
        showToast(copy.validationInclusions, 'error');
        return false;
      }
      return true;
    }

    if (targetStep === 6) {
      if (!formData.rules?.age_limit?.trim()) {
        showToast(copy.validationAgeLimit, 'error');
        return false;
      }
      return true;
    }

    if (targetStep === 7) {
      if (!Number(formData.price) || Number(formData.price) <= 0) {
        showToast(copy.validationPrice, 'error');
        return false;
      }
      if (formData.is_private_enabled && (!Number(formData.private_price) || Number(formData.private_price) <= 0)) {
        showToast(copy.validationPrivatePrice, 'error');
        return false;
      }
      return true;
    }

    return true;
  };

  // --- 네비게이션 함수 ---
  const nextStep = () => {
    if (step >= TOTAL_STEPS) return;
    if (!validateCurrentStep(step)) return;
    setStep(step + 1);
  };
  const prevStep = () => { if (step > 1) setStep(step - 1); };

  // --- 데이터 업데이트 함수들 ---
  const updateData = (key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleCounter = (key: string, type: 'inc' | 'dec') => {
    const currentVal = formData[key as keyof typeof formData] as number;
    if (type === 'dec' && currentVal <= 1) return;
    updateData(key, type === 'inc' ? currentVal + 1 : currentVal - 1);
  };

  const addItem = (
    field: 'inclusions' | 'exclusions',
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (!value.trim()) return;
    updateData(field, [...formData[field], value]);
    setter('');
  };

  const removeItem = (field: 'inclusions' | 'exclusions', index: number) => {
    updateData(field, formData[field].filter((_, i) => i !== index));
  };

  // 📍 동선(루트) 관리
  const addItineraryItem = () => {
    updateData('itinerary', [
      ...formData.itinerary,
      { title: '', description: '', type: 'spot', image_url: '' },
    ]);
    setItineraryImageFiles((prev) => [...prev, null]);
  };

  const removeItineraryItem = (index: number) => {
    if (formData.itinerary.length <= 1) return;
    updateData('itinerary', formData.itinerary.filter((_, i) => i !== index));
    setItineraryImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItineraryItem = (index: number, key: string, value: string) => {
    const newItinerary = [...(formData.itinerary as ItineraryItem[])];
    newItinerary[index] = { ...newItinerary[index], [key]: value };
    updateData('itinerary', newItinerary);
  };

  const handleRemoveImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    const newPhotos = formData.photos.filter((_, i) => i !== index);
    updateData('photos', newPhotos);
  };

  const buildPreviewFiles = async (files: File[]) => {
    const previewUrls: string[] = [];
    const processedFiles: File[] = [];

    for (const file of files) {
      const validation = validateImage(file);
      if (!validation.valid) {
        if (isHeicValidationResult(validation)) {
          showHeicUnsupportedToast(validation.message);
        } else {
          showToast(validation.message || copy.imageValidationFallback, 'error');
        }
        continue;
      }

      try {
        const compressedFile = await compressImage(file);
        previewUrls.push(URL.createObjectURL(compressedFile));
        processedFiles.push(compressedFile);
      } catch (err) {
        console.error('Compression error:', err);
        showToast(copy.imageProcessingError, 'error');
      }
    }

    return { previewUrls, processedFiles };
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const files = Array.from(e.target.files);

    if (formData.photos.length + files.length > MAX_EXPERIENCE_PHOTOS) {
      showToast(copy.validationPhotoLimit(MAX_EXPERIENCE_PHOTOS), 'error');
      e.target.value = '';
      return;
    }

    const { previewUrls, processedFiles } = await buildPreviewFiles(files);

    if (previewUrls.length > 0) {
      updateData('photos', [...formData.photos, ...previewUrls]);
      setImageFiles((prev) => [...prev, ...processedFiles]);
    }

    e.target.value = '';
  };

  const handleItineraryImageUpload = async (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const { previewUrls, processedFiles } = await buildPreviewFiles([e.target.files[0]]);
    if (previewUrls.length === 0 || processedFiles.length === 0) {
      e.target.value = '';
      return;
    }

    const newItinerary = [...(formData.itinerary as ItineraryItem[])];
    newItinerary[index] = {
      ...newItinerary[index],
      image_url: previewUrls[0],
    };
    updateData('itinerary', newItinerary);

    setItineraryImageFiles((prev) => {
      const next = [...prev];
      next[index] = processedFiles[0];
      return next;
    });

    e.target.value = '';
  };

  const handleRemoveItineraryImage = (index: number) => {
    const newItinerary = [...(formData.itinerary as ItineraryItem[])];
    newItinerary[index] = {
      ...newItinerary[index],
      image_url: '',
    };
    updateData('itinerary', newItinerary);

    setItineraryImageFiles((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  };

  const uploadImageToStorage = async (userId: string, file: File, folder: 'hero' | 'itinerary') => {
    const safeName = sanitizeFileName(file.name);
    const fileName = `experience/${userId}/${folder}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage.from('experiences').upload(fileName, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from('experiences').getPublicUrl(fileName);
    return data.publicUrl;
  };

  // 🚀 최종 제출 함수 수정 (파일명 최적화 및 버킷 명칭 확인)
  const handleSubmit = async () => {
    if (!validateCurrentStep(TOTAL_STEPS - 1)) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(copy.loginRequired);

      const photoUrls: string[] = [];
      for (const file of imageFiles) {
        const publicUrl = await uploadImageToStorage(user.id, file, 'hero');
        photoUrls.push(publicUrl);
      }

      const itineraryWithPhotos = await Promise.all(
        (formData.itinerary as ItineraryItem[]).map(async (item, index) => {
          const itineraryFile = itineraryImageFiles[index];
          let imageUrl = '';

          if (itineraryFile) {
            imageUrl = await uploadImageToStorage(user.id, itineraryFile, 'itinerary');
          } else if (item.image_url && !item.image_url.startsWith('blob:')) {
            imageUrl = item.image_url;
          }

          return {
            ...item,
            image_url: imageUrl,
          };
        })
      );

      const languageNames = getLanguageNames(formData.language_levels || []);
      const cleanedExclusions = (formData.exclusions || []).map((item: string) => item.trim()).filter(Boolean);

      const { error } = await supabase.from('experiences').insert([
        {
          host_id: user.id,
          country: formData.country,
          city: formData.city,
          title: formData.title,
          category: formData.category,
          languages: languageNames,
          language_levels: formData.language_levels,
          duration: formData.duration,
          max_guests: formData.maxGuests,
          description: formData.description,
          itinerary: itineraryWithPhotos,
          spots: itineraryWithPhotos.map((i) => i.title).join(' -> '),
          meeting_point: formData.meeting_point || itineraryWithPhotos[0]?.title || '',
          location: formData.location,
          photos: photoUrls,
          price: formData.price,
          inclusions: formData.inclusions,
          exclusions: cleanedExclusions,
          supplies: formData.supplies,
          rules: {
            ...formData.rules,
            refund_policy: FIXED_REFUND_POLICY,
          },
          status: 'pending',
          is_private_enabled: formData.is_private_enabled,
          private_price: formData.private_price
        }
      ]);

      if (error) throw error;

      // 🟢 [수정됨] 등록 성공 시 알림 띄우고 대시보드로 이동
      showToast(copy.submitSuccess, 'success');
      router.push('/host/dashboard?tab=experiences'); // 내 체험 관리 탭으로 이동

    } catch (error) {
      const message = error instanceof Error ? error.message : copy.unknownError;
      console.error(error);
      showToast(copy.submitFailPrefix + message, 'error'); // 🟢 에러도 토스트로 표시
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
      <main className="flex-1 flex flex-col items-center pt-[calc(env(safe-area-inset-top,0px)+4.75rem)] md:pt-24 pb-28 md:pb-36 px-4 md:px-6 w-full max-w-2xl lg:max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
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
          handleItineraryImageUpload={handleItineraryImageUpload}
          handleRemoveItineraryImage={handleRemoveItineraryImage}
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
          <button onClick={prevStep} disabled={step === 1} className={`px-4 md:px-6 py-2.5 md:py-3 rounded-full font-bold text-xs md:text-sm transition-all ${step === 1 ? 'text-slate-300' : 'text-slate-600 hover:bg-slate-100 underline decoration-2'}`}>{copy.prevButton}</button>
          {step === TOTAL_STEPS - 1 ? (
            <button onClick={handleSubmit} disabled={loading} className="bg-black text-white px-6 md:px-10 py-3 md:py-4 rounded-full font-bold text-sm md:text-base hover:scale-105 transition-transform shadow-xl shadow-slate-300 disabled:opacity-50 flex items-center gap-2">
              {loading ? copy.submittingButton : copy.submitButton}
            </button>
          ) : (
            <button onClick={nextStep} className="bg-black text-white px-6 md:px-10 py-3 md:py-4 rounded-full font-bold text-sm md:text-base hover:scale-105 transition-transform flex items-center gap-2 shadow-xl shadow-slate-300">{copy.nextButton} <ChevronRight size={16} className="md:w-[18px] md:h-[18px]" /></button>
          )}
        </footer>
      )}
    </div>
  );
}
