'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronRight, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { useToast } from '@/app/context/ToastContext'; // 🟢 알림 기능 사용
import { useAuth } from '@/app/context/AuthContext';
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
import { buildExperienceWritePayload, syncManualContentWithLocales, type ExperienceFormState, type ItineraryItem } from './experienceFormState';
import { getManualLocalesFromLanguageLevels, isExperienceLocale } from '@/app/utils/experienceTranslation';
import HostPhotoActionSheet from '@/app/host/components/HostPhotoActionSheet';
import {
  normalizeExperienceListItem,
  prepareExperienceListDrafts,
  validateExperienceForm,
  validateExperienceStep,
  type ExperienceFormIssue,
  type ExperienceFormIssueCode,
} from './experienceFormValidation';
import ExperienceDraftRestoreDialog from './components/ExperienceDraftRestoreDialog';
import { useExperienceDraft } from './useExperienceDraft';
import type { LoadedExperienceDraft } from './experienceDraftStorage';

type ProcessedImageFile = File & {
  readonly __processedImage: true;
};

const asProcessedImageFile = (file: File): ProcessedImageFile => file as ProcessedImageFile;

type ExperienceFormCopy = ReturnType<typeof getExperienceFormCopy>;
type ResolvedExperienceFormIssue = ExperienceFormIssue & { message: string };

function getExperienceIssueMessage(code: ExperienceFormIssueCode, copy: ExperienceFormCopy) {
  const messages: Record<ExperienceFormIssueCode, string> = {
    city_required: copy.validationCity,
    category_required: copy.validationCategory,
    languages_required: copy.validationLanguages,
    language_level_invalid: copy.validationLanguageLevels,
    source_locale_invalid: copy.validationSourceLocale,
    title_too_short: copy.validationTitle,
    photos_required: copy.validationPhotos,
    photos_too_many: copy.validationPhotoLimit(MAX_EXPERIENCE_PHOTOS),
    meeting_point_required: copy.validationMeetingPoint,
    location_required: copy.validationLocation,
    itinerary_title_required: copy.validationItineraryTitles,
    description_too_short: copy.validationDescription,
    inclusions_required: copy.validationInclusions,
    inclusion_too_short: copy.validationInclusionItemQuality,
    inclusion_duplicate: copy.validationDuplicateListItem,
    exclusion_too_short: copy.validationExclusionItemQuality,
    exclusion_duplicate: copy.validationDuplicateListItem,
    supplies_too_short: copy.validationSuppliesQuality,
    duration_invalid: copy.validationDuration,
    max_guests_invalid: copy.validationMaxGuests,
    age_limit_required: copy.validationAgeLimit,
    price_invalid: copy.validationPrice,
    solo_guarantee_price_invalid: copy.validationSoloGuaranteePrice,
    private_price_required: copy.validationPrivatePrice,
  };

  return messages[code];
}

export default function CreateExperiencePage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const copy = getExperienceFormCopy(lang);
  const { user, isLoading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const { showToast, showHeicUnsupportedToast } = useToast(); // 🟢 토스트 훅 가져오기

  // --- 상태 관리 ---
  const [step, setStep] = useState(1);
  const [createdExperienceId, setCreatedExperienceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ExperienceFormState>({
    ...INITIAL_FORM_DATA,
    is_private_enabled: false,
    private_price: 0,
  });

  // UI용 임시 상태
  const [isCustomCity, setIsCustomCity] = useState(false);
  const [imageFiles, setImageFiles] = useState<ProcessedImageFile[]>([]);
  const [itineraryImageFiles, setItineraryImageFiles] = useState<(ProcessedImageFile | null)[]>(
    INITIAL_FORM_DATA.itinerary.map(() => null)
  );
  const [tempInclusion, setTempInclusion] = useState('');
  const [tempExclusion, setTempExclusion] = useState('');
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [validatedSteps, setValidatedSteps] = useState<number[]>([]);
  const [focusRequest, setFocusRequest] = useState<{ field: string; requestId: number } | null>(null);
  const replacePhotoInputRef = useRef<HTMLInputElement>(null);

  const draftData = useMemo(() => ({
    step,
    formData,
    isCustomCity,
    tempInclusion,
    tempExclusion,
  }), [formData, isCustomCity, step, tempExclusion, tempInclusion]);
  const draftMedia = useMemo(() => ({
    heroFiles: imageFiles as File[],
    itineraryFiles: itineraryImageFiles as (File | null)[],
  }), [imageFiles, itineraryImageFiles]);

  const restoreDraft = useCallback((
    draft: LoadedExperienceDraft,
    previewUrls: { hero: string[]; itinerary: (string | null)[] }
  ) => {
    const restoredPhotos = draft.data.formData.photos.length > 0
      ? draft.data.formData.photos
        .map((photo, index) => photo || previewUrls.hero[index] || '')
        .filter(Boolean)
      : previewUrls.hero;
    const restoredItinerary = draft.data.formData.itinerary.map((item, index) => ({
      ...item,
      image_url: item.image_url || previewUrls.itinerary[index] || '',
    }));

    setStep(Math.min(Math.max(draft.data.step, 1), TOTAL_STEPS - 1));
    setFormData({
      ...draft.data.formData,
      photos: restoredPhotos,
      itinerary: restoredItinerary,
    });
    setIsCustomCity(draft.data.isCustomCity);
    setTempInclusion(draft.data.tempInclusion);
    setTempExclusion(draft.data.tempExclusion);
    setImageFiles(draft.media.heroFiles.map(asProcessedImageFile));
    setItineraryImageFiles(
      draft.media.itineraryFiles.map((file) => (file ? asProcessedImageFile(file) : null))
    );
    setValidatedSteps([]);
    setFocusRequest(null);
  }, []);

  const {
    status: draftStatus,
    savedAt: draftSavedAt,
    pendingDraft,
    ready: draftReady,
    saveNow: saveDraftNow,
    saveBeforeExit,
    continueDraft,
    startNew: startNewDraft,
    clearDraft,
    releaseDraftObjectUrl,
  } = useExperienceDraft({
    data: draftData,
    media: draftMedia,
    enabled: step < TOTAL_STEPS,
    ownerId: user?.id ?? null,
    authResolved: !authLoading,
    onRestore: restoreDraft,
  });

  const savedTime = draftSavedAt
    ? new Intl.DateTimeFormat(
      lang === 'ja' ? 'ja-JP' : lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en-US' : 'ko-KR',
      { hour: 'numeric', minute: '2-digit' }
    ).format(draftSavedAt)
    : null;

  const draftStatusLabel = (() => {
    if (draftStatus === 'saving') return copy.draftSaving;
    if (draftStatus === 'saved' && savedTime) return copy.draftSavedAt(savedTime);
    if (draftStatus === 'text-only') return copy.draftTextOnlySaved;
    if (draftStatus === 'error') return copy.draftSaveFailed;
    if (draftStatus === 'conflict') return copy.draftConflict;
    if (draftStatus === 'unavailable') return copy.draftUnavailable;
    return null;
  })();

  const resolveIssues = (issues: ExperienceFormIssue[]): ResolvedExperienceFormIssue[] =>
    issues.map((issue) => ({ ...issue, message: getExperienceIssueMessage(issue.code, copy) }));

  const currentIssues = (() => {
    if (!validatedSteps.includes(step)) return [];

    if (step === 5) {
      const draftResult = prepareExperienceListDrafts(formData, tempInclusion, tempExclusion);
      const validationData = draftResult.issues.length === 0 ? draftResult.formData : formData;
      return resolveIssues([...draftResult.issues, ...validateExperienceStep(validationData, step)]);
    }

    return resolveIssues(validateExperienceStep(formData, step));
  })();

  const revealIssues = (issues: ExperienceFormIssue[], targetStep: number) => {
    if (issues.length === 0) return;

    const firstIssue = issues[0];
    setValidatedSteps((prev) => Array.from(new Set([...prev, ...issues.map((issue) => issue.step)])));
    setStep(targetStep);
    setFocusRequest({ field: firstIssue.field, requestId: Date.now() });
    showToast(getExperienceIssueMessage(firstIssue.code, copy), 'error');
  };

  useEffect(() => {
    if (!focusRequest) return;

    const frame = window.requestAnimationFrame(() => {
      const field = document.querySelector<HTMLElement>(`[data-validation-field="${focusRequest.field}"]`);
      if (!field) return;

      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusTarget = field.matches('input, textarea, select, button')
        ? field
        : field.querySelector<HTMLElement>('input:not([type="hidden"]):not(.hidden), textarea, select, button, [tabindex]:not([tabindex="-1"])');

      if (focusTarget) {
        focusTarget.focus({ preventScroll: true });
      } else {
        field.setAttribute('tabindex', '-1');
        field.focus({ preventScroll: true });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusRequest, step]);

  // --- 네비게이션 함수 ---
  const nextStep = () => {
    if (step >= TOTAL_STEPS) return;

    if (step === 5) {
      const draftResult = prepareExperienceListDrafts(formData, tempInclusion, tempExclusion);
      if (draftResult.issues.length > 0) {
        revealIssues(draftResult.issues, step);
        return;
      }

      if (draftResult.formData !== formData) {
        setFormData(draftResult.formData);
        setTempInclusion(draftResult.tempInclusion);
        setTempExclusion(draftResult.tempExclusion);
      }

      const issues = validateExperienceStep(draftResult.formData, step);
      if (issues.length > 0) {
        revealIssues(issues, step);
        return;
      }
    } else {
      const issues = validateExperienceStep(formData, step);
      if (issues.length > 0) {
        revealIssues(issues, step);
        return;
      }
    }

    setValidatedSteps((prev) => prev.filter((validatedStep) => validatedStep !== step));
    setStep(step + 1);
  };
  const prevStep = () => { if (step > 1) setStep(step - 1); };

  // --- 데이터 업데이트 함수들 ---
  const updateData = (key: string, value: unknown) => {
    setFormData((prev) => {
      if (key === 'language_levels') {
        const nextLanguageLevels = Array.isArray(value) ? value as typeof prev.language_levels : [];
        const manualLocales = getManualLocalesFromLanguageLevels(nextLanguageLevels);
        const nextSourceLocale = manualLocales.includes(prev.source_locale)
          ? prev.source_locale
          : manualLocales[0] || 'ko';

        return {
          ...prev,
          language_levels: nextLanguageLevels,
          languages: getLanguageNames(nextLanguageLevels),
          source_locale: nextSourceLocale,
          manual_content: syncManualContentWithLocales(prev.manual_content, manualLocales, nextSourceLocale),
        };
      }

      if (key === 'source_locale') {
        const manualLocales = getManualLocalesFromLanguageLevels(prev.language_levels || []);
        const requestedLocale = isExperienceLocale(value) ? value : prev.source_locale;
        const nextSourceLocale = manualLocales.includes(requestedLocale)
          ? requestedLocale
          : manualLocales[0] || prev.source_locale;

        return {
          ...prev,
          source_locale: nextSourceLocale,
          manual_content: syncManualContentWithLocales(prev.manual_content, manualLocales, nextSourceLocale),
        };
      }

      return { ...prev, [key]: value };
    });
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
    const normalizedValue = normalizeExperienceListItem(value);
    if (!normalizedValue) return;

    if (normalizedValue.length < 2) {
      showToast(field === 'inclusions' ? copy.validationInclusionItemQuality : copy.validationExclusionItemQuality, 'error');
      return;
    }

    const existingItems = (formData[field] || []).map((item) => normalizeExperienceListItem(item).toLocaleLowerCase());
    if (existingItems.includes(normalizedValue.toLocaleLowerCase())) {
      showToast(copy.validationDuplicateListItem, 'error');
      return;
    }

    updateData(field, [...formData[field], normalizedValue]);
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
    releaseDraftObjectUrl(formData.photos[index]);
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    const newPhotos = formData.photos.filter((_, i) => i !== index);
    updateData('photos', newPhotos);
  };

  const handleReplaceImage = async (index: number, file: File) => {
    const { previewUrls, processedFiles } = await buildPreviewFiles([file]);

    if (previewUrls.length === 0 || processedFiles.length === 0) {
      return;
    }

    releaseDraftObjectUrl(formData.photos[index]);

    updateData(
      'photos',
      formData.photos.map((photo, photoIndex) => (photoIndex === index ? previewUrls[0] : photo))
    );
    setImageFiles((prev) => prev.map((imageFile, imageIndex) => (imageIndex === index ? processedFiles[0] : imageFile)));
  };

  const buildPreviewFiles = async (files: File[]) => {
    const previewUrls: string[] = [];
    const processedFiles: ProcessedImageFile[] = [];

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
        processedFiles.push(asProcessedImageFile(compressedFile));
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

  const handleReplacePhotoInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file && activePhotoIndex !== null) {
      await handleReplaceImage(activePhotoIndex, file);
    }

    setActivePhotoIndex(null);
    e.target.value = '';
  };

  const handleRemoveItineraryImage = (index: number) => {
    releaseDraftObjectUrl(formData.itinerary[index]?.image_url);
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

  const uploadImageToStorage = async (userId: string, file: ProcessedImageFile, folder: 'hero' | 'itinerary') => {
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
    const issues = validateExperienceForm(formData);
    if (issues.length > 0) {
      revealIssues(issues, issues[0].step);
      return;
    }

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

      const cleanedInclusions = (formData.inclusions || []).map((item: string) => normalizeExperienceListItem(item)).filter(Boolean);
      const cleanedExclusions = (formData.exclusions || []).map((item: string) => normalizeExperienceListItem(item)).filter(Boolean);
      const cleanedSupplies = (formData.supplies || '').trim();
      const payload = buildExperienceWritePayload({
        ...formData,
        photos: photoUrls,
        inclusions: cleanedInclusions,
        exclusions: cleanedExclusions,
        supplies: cleanedSupplies,
        itinerary: itineraryWithPhotos,
        meeting_point: formData.meeting_point || itineraryWithPhotos[0]?.title || '',
        rules: {
          ...formData.rules,
          refund_policy: FIXED_REFUND_POLICY,
        },
      });

      const response = await fetch('/api/host/experiences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || copy.unknownError);
      }

      try {
        await clearDraft();
      } catch (draftError) {
        console.error('Experience draft cleanup failed:', draftError);
      }

      // 🟢 [수정됨] 등록 성공 시 알림 띄우고 완료 화면(Step 8) 표시
      showToast(copy.submitSuccess, 'success');
      setCreatedExperienceId(result.id);
      setStep(TOTAL_STEPS);

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
      {pendingDraft && (
        <ExperienceDraftRestoreDialog
          title={copy.draftRestoreTitle}
          description={copy.draftRestoreDescription}
          continueLabel={copy.draftContinue}
          startNewLabel={copy.draftStartNew}
          onContinue={continueDraft}
          onStartNew={() => void startNewDraft()}
        />
      )}
      <HostPhotoActionSheet
        isOpen={activePhotoIndex !== null}
        photoLabel={
          activePhotoIndex !== null
            ? `${copy.mainPhotoBadge} ${activePhotoIndex + 1}`
            : undefined
        }
        onClose={() => setActivePhotoIndex(null)}
        onChange={() => replacePhotoInputRef.current?.click()}
        onDelete={() => {
          if (activePhotoIndex !== null) {
            handleRemoveImage(activePhotoIndex);
          }
          setActivePhotoIndex(null);
        }}
      />
      <input
        ref={replacePhotoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="create-replace-photo-input"
        onChange={handleReplacePhotoInput}
      />

      {/* 헤더 */}
      {step < TOTAL_STEPS && (
        <header className="fixed left-0 right-0 top-0 z-50 bg-white/90 px-3 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md md:px-6">
          <div className="grid h-14 grid-cols-[auto_minmax(72px,1fr)_auto] items-center gap-3 md:h-16 md:gap-6">
            <button
              type="button"
              aria-label="Close"
              onClick={async () => {
                const saved = await saveBeforeExit();
                if (saved) {
                  router.push('/host/dashboard?tab=experiences');
                } else {
                  showToast(draftStatus === 'conflict' ? copy.draftConflict : copy.draftSaveFailed, 'error');
                }
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-slate-100"
            >
              <X size={24} className="text-slate-900" />
            </button>
            <div className="mx-auto h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-black transition-all duration-500 ease-out" style={{ width: `${(step / (TOTAL_STEPS - 1)) * 100}%` }} />
            </div>
            <button
              type="button"
              onClick={() => void saveDraftNow()}
              disabled={!draftReady || draftStatus === 'saving' || draftStatus === 'conflict' || draftStatus === 'unavailable'}
              className="flex h-9 min-w-12 items-center justify-center gap-1 rounded-md px-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 md:min-w-16 md:text-sm"
            >
              <Save size={15} aria-hidden="true" />
              {copy.draftSaveButton}
            </button>
          </div>
          <div
            aria-live="polite"
            className={`flex min-h-7 flex-wrap items-center justify-center gap-x-1 px-2 pb-2 text-center text-[10px] leading-4 md:text-xs ${draftStatus === 'error' || draftStatus === 'conflict' || draftStatus === 'text-only' ? 'text-rose-600' : 'text-slate-500'}`}
          >
            {draftStatusLabel && <span>{draftStatusLabel}</span>}
            {draftStatus !== 'unavailable' && draftStatus !== 'conflict' && (
              <span>{draftStatusLabel ? '· ' : ''}{copy.draftRetention}</span>
            )}
          </div>
        </header>
      )}

      {/* 메인 컨텐츠 */}
      <main className="flex-1 flex flex-col items-center pt-[calc(env(safe-area-inset-top,0px)+6.25rem)] md:pt-32 pb-28 md:pb-36 px-4 md:px-6 w-full max-w-2xl lg:max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <ExperienceFormSteps
          step={step}
          formData={formData}
          updateData={updateData}
          handleCounter={handleCounter}
          handlePhotoUpload={handlePhotoUpload}
          addItem={addItem}
          removeItem={removeItem}
          handleRemoveImage={handleRemoveImage}
          onPhotoTap={setActivePhotoIndex}
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
          createdExperienceId={createdExperienceId}
          issues={currentIssues}
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
