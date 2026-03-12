'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import SiteHeader from '@/app/components/SiteHeader';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, Save, MapPin, Plus, Trash2, X, Camera, Check, Globe, Loader2, Type, FileText, Lock } from 'lucide-react';
import {
  ACTIVITY_LEVEL_OPTIONS,
  CATEGORY_OPTIONS,
  EXPERIENCE_LANGUAGE_OPTIONS,
  MAX_EXPERIENCE_PHOTOS,
  FIXED_REFUND_POLICY,
  FIXED_REFUND_POLICY_LABELS,
  getExperienceFormCopy,
  getLocalizedText,
} from '@/app/host/create/config';
import { useToast } from '@/app/context/ToastContext'; // 🟢 Toast로 UX 개선
import { useLanguage } from '@/app/context/LanguageContext'; // 🟢 1. Import
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { compressImage, sanitizeFileName, validateImage, isHeicValidationResult } from '@/app/utils/image';
import { getLanguageNames, normalizeLanguageLevels } from '@/app/utils/languageLevels';
import { buildExperienceWritePayload, getManualFieldValue, setManualFieldValue, syncManualContentWithLocales } from '@/app/host/create/experienceFormState';
import {
  buildManualContentFromExperience,
  getManualLocalesFromLanguageLevels,
  getManualLocalesFromManualContent,
  isExperienceLocale,
  mergeExperienceLocales,
  normalizeExperienceLocaleArray,
} from '@/app/utils/experienceTranslation';

export default function EditExperiencePage() {
  const { t, lang } = useLanguage(); // 🟢 2. Hook
  const copy = getExperienceFormCopy(lang);
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const { showToast, showHeicUnsupportedToast } = useToast();

  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingItineraryIndex, setUploadingItineraryIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'detail' | 'course'>('basic');

  // 데이터 불러오기
  useEffect(() => {
    const fetchExp = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          showToast(t('msg_load_fail'), 'error');
          router.push('/login');
          return;
        }

        // 🟢 어드민 계정 여부 확인
        const { isAdmin } = await resolveAdminAccess(supabase, {
          userId: user.id,
          email: user.email,
        });

        let query = supabase.from('experiences').select('*').eq('id', params.id);
        if (!isAdmin) {
          query = query.eq('host_id', user.id);
        }

        const { data, error } = await query.maybeSingle();

        if (error || !data) {
          showToast(t('msg_load_fail'), 'error');
          router.push('/host/dashboard?tab=experiences');
          return;
        }

        const normalizedLanguageLevels = normalizeLanguageLevels(data.language_levels, data.languages || [], 3);
        const manualLocales = mergeExperienceLocales(
          normalizeExperienceLocaleArray(data.manual_locales),
          getManualLocalesFromLanguageLevels(normalizedLanguageLevels)
        );
        const sourceLocale = isExperienceLocale(data.source_locale)
          ? data.source_locale
          : (manualLocales[0] || 'ko');
        const manualContent = buildManualContentFromExperience(data, manualLocales, sourceLocale);

        setFormData({
          ...data,
          // ✅ 기존 데이터 초기화 (Null 방지)
          photos: data.photos || [],
          languages: getLanguageNames(normalizedLanguageLevels),
          language_levels: normalizedLanguageLevels,
          source_locale: sourceLocale,
          manual_content: manualContent,
          inclusions: data.inclusions || [],
          exclusions: data.exclusions || [],
          location: data.location || '',
          itinerary: (data.itinerary || []).map((item: any) => ({
            ...item,
            image_url: item?.image_url || '',
          })),
          rules: {
            ...(data.rules || {}),
            age_limit: data.rules?.age_limit || '',
            activity_level: data.rules?.activity_level || '보통',
            refund_policy: FIXED_REFUND_POLICY,
          },
        });
      } finally {
        setLoading(false);
      }
    };
    fetchExp();
  }, [params.id, router, showToast, supabase, t]);

  const uploadImageFile = async (file: File, folder: 'hero' | 'itinerary') => {
    const validation = validateImage(file);
    if (!validation.valid) {
      throw new Error(validation.message || copy.imageValidationFallback);
    }

    const compressedFile = await compressImage(file);
    const fileName = `experience/${formData.host_id}/${folder}/${Date.now()}_${sanitizeFileName(compressedFile.name)}`;
    const { error } = await supabase.storage.from('experiences').upload(fileName, compressedFile);

    if (error) {
      throw error;
    }

    const { data } = supabase.storage.from('experiences').getPublicUrl(fileName);
    return data.publicUrl;
  };

  // 저장하기
  const handleUpdate = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('login_required'));

      if (formData.is_private_enabled && (!Number(formData.private_price) || Number(formData.private_price) <= 0)) {
        throw new Error(copy.validationPrivatePrice);
      }

      const cleanedInclusions = (formData.inclusions || []).map((item: string) => item.trim()).filter(Boolean);
      const cleanedExclusions = (formData.exclusions || []).map((item: string) => item.trim()).filter(Boolean);
      const normalizedLanguageLevels = normalizeLanguageLevels(formData.language_levels, formData.languages || [], 3);
      const payload = buildExperienceWritePayload({
        ...formData,
        language_levels: normalizedLanguageLevels,
        languages: getLanguageNames(normalizedLanguageLevels),
        inclusions: cleanedInclusions,
        exclusions: cleanedExclusions,
        meeting_point: formData.meeting_point || formData.itinerary?.[0]?.title || '',
        maxGuests: Number(formData.max_guests || formData.maxGuests || 0),
        rules: {
          ...formData.rules,
          refund_policy: FIXED_REFUND_POLICY,
        },
      });

      const response = await fetch(`/api/host/experiences/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || t('msg_edit_permission_fail'));
      }

      showToast(t('msg_save_success'), 'success'); // 🟢 번역
      router.refresh();
    } catch (e: any) {
      showToast(t('msg_save_fail') + e.message, 'error'); // 🟢 번역
    } finally {
      setSaving(false);
    }
  };

  // 📸 대표 사진 업로드
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    if (formData.photos.length >= MAX_EXPERIENCE_PHOTOS) {
      showToast(copy.validationPhotoLimit(MAX_EXPERIENCE_PHOTOS), 'error');
      e.target.value = '';
      return;
    }

    setUploading(true);

    try {
      const file = e.target.files[0];
      const validation = validateImage(file);
      if (!validation.valid) {
        if (isHeicValidationResult(validation)) {
          showHeicUnsupportedToast(validation.message);
        } else {
          showToast(validation.message || copy.imageValidationFallback, 'error');
        }
        return;
      }

      const publicUrl = await uploadImageFile(file, 'hero');
      setFormData((prev: any) => ({ ...prev, photos: [...prev.photos, publicUrl] }));

    } catch (err: any) {
      showToast(t('msg_photo_fail') + err.message, 'error'); // 🟢 번역
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // 🗑️ 사진 삭제 핸들러 (기존 로직 유지)
  const removePhoto = (indexToRemove: number) => {
    setFormData((prev: any) => ({
      ...prev,
      photos: prev.photos.filter((_: string, idx: number) => idx !== indexToRemove)
    }));
    showToast(t('msg_photo_delete_success'), 'success');
  };

  const handleItineraryPhotoUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploadingItineraryIndex(index);

    try {
      const file = e.target.files[0];
      const validation = validateImage(file);
      if (!validation.valid) {
        if (isHeicValidationResult(validation)) {
          showHeicUnsupportedToast(validation.message);
        } else {
          showToast(validation.message || copy.imageValidationFallback, 'error');
        }
        return;
      }

      const publicUrl = await uploadImageFile(file, 'itinerary');
      const newItinerary = [...formData.itinerary];
      newItinerary[index] = {
        ...newItinerary[index],
        image_url: publicUrl,
      };
      setFormData({ ...formData, itinerary: newItinerary });
      showToast(copy.itineraryPhotoUploadSuccess, 'success');
    } catch (err: any) {
      showToast(copy.itineraryPhotoUploadFailPrefix + err.message, 'error');
    } finally {
      setUploadingItineraryIndex(null);
      e.target.value = '';
    }
  };

  const removeItineraryPhoto = (index: number) => {
    const newItinerary = [...formData.itinerary];
    newItinerary[index] = {
      ...newItinerary[index],
      image_url: '',
    };
    setFormData({ ...formData, itinerary: newItinerary });
    showToast(copy.itineraryPhotoDeleteSuccess, 'success');
  };

  // 진행 언어 토글/레벨 편집
  const toggleLanguage = (lang: string) => {
    const current = Array.isArray(formData.language_levels) ? formData.language_levels : [];
    const nextLevels = current.some((entry: any) => entry.language === lang)
      ? current.filter((entry: any) => entry.language !== lang)
      : [...current, { language: lang, level: 3 }];
    const nextManualLocales = mergeExperienceLocales(
      getManualLocalesFromManualContent(formData.manual_content || {}),
      getManualLocalesFromLanguageLevels(nextLevels)
    );
    const nextSourceLocale = nextManualLocales.includes(formData.source_locale)
      ? formData.source_locale
      : (nextManualLocales[0] || 'ko');

    setFormData({
      ...formData,
      language_levels: nextLevels,
      languages: getLanguageNames(nextLevels),
      source_locale: nextSourceLocale,
      manual_content: syncManualContentWithLocales(formData.manual_content || {}, nextManualLocales, nextSourceLocale),
    });
  };
  const updateLanguageLevel = (lang: string, level: number) => {
    const current = Array.isArray(formData.language_levels) ? formData.language_levels : [];
    const nextLevels = current.map((entry: any) => (entry.language === lang ? { ...entry, level } : entry));
    setFormData({ ...formData, language_levels: nextLevels, languages: getLanguageNames(nextLevels) });
  };

  // 배열 항목 수정 (포함/불포함)
  const handleArrayChange = (field: string, idx: number, value: string) => {
    const newArr = [...formData[field]];
    newArr[idx] = value;
    setFormData({ ...formData, [field]: newArr });
  };
  const addArrayItem = (field: string) => setFormData({ ...formData, [field]: [...formData[field], ''] });
  const removeArrayItem = (field: string, idx: number) => setFormData({ ...formData, [field]: formData[field].filter((_: any, i: number) => i !== idx) });

  // 동선(Itinerary) 수정
  const updateItinerary = (idx: number, key: string, value: string) => {
    const newItinerary = [...formData.itinerary];
    newItinerary[idx] = { ...newItinerary[idx], [key]: value };
    setFormData({ ...formData, itinerary: newItinerary });
  };
  const addItineraryItem = () => setFormData({ ...formData, itinerary: [...formData.itinerary, { title: '', description: '', type: 'spot', image_url: '' }] });
  const removeItineraryItem = (idx: number) => setFormData({ ...formData, itinerary: formData.itinerary.filter((_: any, i: number) => i !== idx) });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-slate-300" /></div>;
  if (!formData) return <div className="p-10 text-center">{t('msg_load_fail')}</div>; // 🟢 번역

  const manualLocales = mergeExperienceLocales(
    getManualLocalesFromManualContent(formData.manual_content || {}),
    getManualLocalesFromLanguageLevels(formData.language_levels || [])
  );
  const selectedLanguageOptions = EXPERIENCE_LANGUAGE_OPTIONS.filter((option) => manualLocales.includes(option.code));
  const sourceTitle = getManualFieldValue(formData.manual_content || {}, formData.source_locale || 'ko', 'title') || formData.title;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-20 md:pb-0">
      <SiteHeader />

      <main className="max-w-4xl mx-auto px-3 md:px-6 py-5 md:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">
          <button
            onClick={() => router.replace('/host/dashboard?tab=experiences')}
            className="flex items-center gap-2 text-slate-500 hover:text-black font-bold text-sm"
            type="button"
          >
            <ChevronLeft size={16} /> {t('nav_dashboard')}
          </button>
          <button onClick={handleUpdate} disabled={saving} className="px-4 md:px-6 py-2 bg-black text-white rounded-full font-bold text-xs md:text-sm hover:scale-105 transition-transform flex items-center gap-1.5 md:gap-2 shadow-lg disabled:opacity-50">
            {saving ? <><Loader2 className="animate-spin" size={16} /> {t('btn_save_loading')}</> : <><Save size={16} /> {t('btn_save')}</>} {/* 🟢 번역 */}
          </button>
        </div>

        <h1 className="text-lg md:text-2xl font-black text-slate-900 leading-tight mb-4 md:mb-6 line-clamp-2">{sourceTitle}</h1>

        {/* 탭 메뉴 */}
        <div className="flex gap-1.5 md:gap-2 mb-4 md:mb-8 bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto">
          {[
            { id: 'basic', label: t('tab_basic') }, // 🟢 번역
            { id: 'detail', label: t('tab_detail') },
            { id: 'course', label: t('tab_course') }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-black shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 1. 기본 정보 & 사진 탭 */}
        {activeTab === 'basic' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* 📸 대표 사진 관리 */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between gap-3 mb-4">
                <label className="block text-sm font-bold text-slate-900">{copy.editPhotoManagerLabel(formData.photos.length, MAX_EXPERIENCE_PHOTOS)}</label>
                <span className="text-[11px] text-slate-500">{copy.editPhotoManagerDesc}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
                {formData.photos.length < MAX_EXPERIENCE_PHOTOS && (
                  <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-black hover:bg-white transition-all bg-white">
                    {uploading ? <Loader2 className="animate-spin text-slate-400 mb-2" /> : <Camera size={24} className="text-slate-400 mb-2" />}
                    <span className="text-xs font-bold text-slate-500">{uploading ? t('btn_photo_uploading') : copy.editAddPhoto}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                  </label>
                )}
                {/* 사진 목록 */}
                {formData.photos.map((url: string, idx: number) => (
                  <div key={idx} className="aspect-square rounded-2xl overflow-hidden relative group shadow-sm border border-slate-200">
                    <img src={url} className="w-full h-full object-cover" alt={`experience-${idx}`} />
                    {idx === 0 && (
                      <span className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-1 text-[10px] font-bold text-white">
                        {copy.mainPhotoBadge}
                      </span>
                    )}
                    <button onClick={() => removePhoto(idx)} className="absolute top-2 right-2 bg-black/70 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 제목 / 원문 언어 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Type size={16} /> {copy.titleSectionLabel}</h3>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500">{copy.sourceLocaleLabel}</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedLanguageOptions.map((option) => {
                      const selected = formData.source_locale === option.code;

                      return (
                        <button
                          key={option.code}
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            source_locale: option.code,
                            manual_content: syncManualContentWithLocales(formData.manual_content || {}, manualLocales, option.code),
                          })}
                          className={`rounded-full border px-4 py-2 text-sm font-bold transition-all ${selected ? 'border-black bg-black text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-black'}`}
                        >
                          {option.flag} {getLocalizedText(option.labels, lang)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {selectedLanguageOptions.map((option) => {
                    const isSourceLocale = formData.source_locale === option.code;

                    return (
                      <div key={option.code} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {option.flag} {getLocalizedText(option.labels, lang)}
                          </span>
                          {isSourceLocale && (
                            <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-bold text-white">
                              {copy.sourceLocaleBadge}
                            </span>
                          )}
                        </div>
                        <input
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:border-black outline-none"
                          value={getManualFieldValue(formData.manual_content || {}, option.code, 'title')}
                          onChange={(e) => setFormData({
                            ...formData,
                            manual_content: setManualFieldValue(formData.manual_content || {}, option.code, 'title', e.target.value),
                          })}
                          placeholder={copy.titlePlaceholder}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">{t('label_country')}</label>
                <select className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold focus:border-black outline-none appearance-none" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })}>
                  <option value="Korea">{t('select_country_kr')}</option> {/* 🟢 번역 */}
                  <option value="Japan">{t('select_country_jp')}</option> {/* 🟢 번역 */}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">{t('label_city')}</label> {/* 🟢 번역 */}
                <input className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold focus:border-black outline-none" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
              </div>
            </div>

            {/* 진행 언어 선택 */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-3">{t('label_languages')}</label>
              <div className="space-y-3">
                {EXPERIENCE_LANGUAGE_OPTIONS.map((languageOption) => {
                  const current = (formData.language_levels || []).find((entry: any) => entry.language === languageOption.value);
                  const selected = Boolean(current);

                  return (
                    <div key={languageOption.value} className={`rounded-2xl border p-4 ${selected ? 'border-black bg-slate-50' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <button type="button" onClick={() => toggleLanguage(languageOption.value)} className="font-bold text-sm text-slate-900">
                          {getLocalizedText(languageOption.labels, lang)}
                        </button>
                        <button type="button" onClick={() => toggleLanguage(languageOption.value)} className={`w-7 h-7 rounded-full border flex items-center justify-center ${selected ? 'bg-black border-black text-white' : 'border-slate-300 text-transparent'}`}>
                          <Check size={14} strokeWidth={3} />
                        </button>
                      </div>
                      <div className="mt-3 grid grid-cols-5 gap-1.5">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <button
                            key={level}
                            type="button"
                            disabled={!selected}
                            onClick={() => updateLanguageLevel(languageOption.value, level)}
                            className={`h-9 rounded-xl border text-[11px] font-bold ${!selected ? 'border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed' : current?.level === level ? 'border-black bg-black text-white' : 'border-slate-200 bg-white text-slate-600'}`}
                          >
                            Lv.{level}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 카테고리 */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-3">{t('label_category')}</label>
              <div className="flex flex-wrap gap-2 mb-4">
                {CATEGORY_OPTIONS.map((categoryOption) => (
                  <button key={categoryOption.value} onClick={() => setFormData({ ...formData, category: categoryOption.value })} className={`px-4 py-2 rounded-full text-sm font-bold border transition-all ${formData.category === categoryOption.value ? 'bg-black text-white border-black' : 'bg-white border-slate-200 text-slate-600 hover:border-black'}`}>
                    {getLocalizedText(categoryOption.labels, lang)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">{t('label_price')}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₩</span>
                  <input type="number" className="w-full p-4 pl-10 bg-white border border-slate-200 rounded-xl font-bold focus:border-black outline-none" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">{t('label_max_guests')}</label>
                <input type="number" className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold focus:border-black outline-none" value={formData.max_guests} onChange={(e) => setFormData({ ...formData, max_guests: e.target.value })} />
              </div>
            </div>
            <div className="w-full bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Lock size={18} className="text-slate-900" />
                  <span className="font-bold text-slate-900">{copy.privateOptionLabel}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={Boolean(formData.is_private_enabled)}
                    onChange={(e) => setFormData({ ...formData, is_private_enabled: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                </label>
              </div>
              {formData.is_private_enabled && (
                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-bold text-slate-500 mb-2">{copy.editPrivatePriceLabel}</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₩</span>
                    <input
                      type="number"
                      className="w-full p-4 pl-10 bg-white border border-slate-200 rounded-xl font-bold focus:border-black outline-none"
                      value={formData.private_price || 0}
                      onChange={(e) => setFormData({ ...formData, private_price: Number(e.target.value) })}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">{copy.editMeetingPointLabel}</label>
                <div className="flex items-center gap-2 bg-white border border-slate-200 p-4 rounded-xl focus-within:border-black">
                  <MapPin size={18} className="text-slate-400" />
                  <input
                    className="bg-transparent w-full outline-none font-medium"
                    value={formData.meeting_point || ''}
                    onChange={(e) => setFormData({ ...formData, meeting_point: e.target.value })}
                    placeholder={copy.meetingPointPlaceholder}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">{copy.editAddressLabel}</label>
                <div className="flex items-center gap-2 bg-white border border-slate-200 p-4 rounded-xl focus-within:border-black">
                  <Globe size={18} className="text-slate-400" />
                  <input
                    className="bg-transparent w-full outline-none font-medium"
                    value={formData.location || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder={copy.addressPlaceholder}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. 상세 설명 탭 */}
        {activeTab === 'detail' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* 설명 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><FileText size={16} /> {copy.descriptionSectionLabel}</h3>
              <div className="space-y-6">
                {selectedLanguageOptions.map((option) => {
                  const isSourceLocale = formData.source_locale === option.code;

                  return (
                    <div key={option.code} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {option.flag} {getLocalizedText(option.labels, lang)}
                        </span>
                        {isSourceLocale && (
                          <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-bold text-white">
                            {copy.sourceLocaleBadge}
                          </span>
                        )}
                      </div>
                      <textarea
                        className="w-full p-4 h-40 bg-white border border-slate-200 rounded-xl leading-relaxed focus:border-black outline-none resize-none"
                        value={getManualFieldValue(formData.manual_content || {}, option.code, 'description')}
                        onChange={(e) => setFormData({
                          ...formData,
                          manual_content: setManualFieldValue(formData.manual_content || {}, option.code, 'description', e.target.value),
                        })}
                        placeholder={copy.descriptionPlaceholder}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">{t('label_inclusions')}</label>
              <div className="space-y-2">
                {formData.inclusions.map((item: string, i: number) => (
                  <div key={i} className="flex gap-2">
                    <input className="flex-1 p-2 bg-white border rounded-lg text-sm" value={item} onChange={(e) => handleArrayChange('inclusions', i, e.target.value)} />
                    <button onClick={() => removeArrayItem('inclusions', i)} className="text-slate-400 hover:text-red-500"><X size={16} /></button>
                  </div>
                ))}
                <button onClick={() => addArrayItem('inclusions')} className="text-xs font-bold text-blue-600 flex items-center gap-1 mt-2 hover:underline"><Plus size={12} /> {t('btn_add_item')}</button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">{copy.exclusionsLabel}</label>
              <div className="space-y-2">
                {formData.exclusions.map((item: string, i: number) => (
                  <div key={i} className="flex gap-2">
                    <input className="flex-1 p-2 bg-white border rounded-lg text-sm" value={item} onChange={(e) => handleArrayChange('exclusions', i, e.target.value)} />
                    <button onClick={() => removeArrayItem('exclusions', i)} className="text-slate-400 hover:text-red-500"><X size={16} /></button>
                  </div>
                ))}
                <button onClick={() => addArrayItem('exclusions')} className="text-xs font-bold text-blue-600 flex items-center gap-1 mt-2 hover:underline"><Plus size={12} /> {t('btn_add_item')}</button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">{t('label_supplies')}</label>
              <textarea className="w-full p-4 h-24 bg-white border border-slate-200 rounded-xl text-sm focus:border-black outline-none" value={formData.supplies} onChange={(e) => setFormData({ ...formData, supplies: e.target.value })} />
            </div>
          </div>
        )}

        {/* 3. 코스 및 규칙 탭 (기존 기능 복구) */}
        {activeTab === 'course' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-4">{t('label_itinerary')}</label>
              <div className="space-y-4 border-l-2 border-slate-200 ml-3 pl-6">
                {formData.itinerary?.map((item: any, i: number) => (
                  <div key={i} className="relative group">
                    <div className="absolute -left-[31px] top-3 w-4 h-4 rounded-full border-2 border-white shadow-sm bg-slate-900 z-10"></div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 group-hover:border-slate-300 transition-colors shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Step {i + 1}</span>
                        <button onClick={() => removeItineraryItem(i)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                      <input className="w-full bg-transparent font-bold mb-2 outline-none placeholder:text-slate-300" placeholder={t('ph_spot_name')} value={item.title} onChange={(e) => updateItinerary(i, 'title', e.target.value)} />
                      <textarea className="w-full bg-transparent text-sm text-slate-600 outline-none resize-none h-16 placeholder:text-slate-300" placeholder={t('ph_activity_desc')} value={item.description} onChange={(e) => updateItinerary(i, 'description', e.target.value)} />
                      <div className="mt-3">
                        <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase">{copy.itineraryPhotoLabel}</label>
                        {item.image_url ? (
                          <div className="relative h-32 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                            <img src={item.image_url} className="w-full h-full object-cover" alt={`itinerary-${i}`} />
                            <div className="absolute top-2 right-2 flex gap-2">
                              <label className="bg-white/90 px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-700 cursor-pointer">
                                {uploadingItineraryIndex === i ? copy.itineraryPhotoUploading : copy.itineraryReplace}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handleItineraryPhotoUpload(i, e)}
                                  disabled={uploadingItineraryIndex === i}
                                />
                              </label>
                              <button onClick={() => removeItineraryPhoto(i)} className="bg-black/70 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors">
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label className="flex h-20 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-xs font-bold text-slate-500 cursor-pointer hover:border-black hover:text-black transition-colors">
                            {uploadingItineraryIndex === i ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                            {copy.itineraryAddPhoto}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleItineraryPhotoUpload(i, e)}
                              disabled={uploadingItineraryIndex === i}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addItineraryItem} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-black mt-4 ml-1">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center border"><Plus size={14} /></div>
                  {t('btn_add_spot')}</button>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <h3 className="font-bold text-sm mb-4">{t('label_rules')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">{t('label_age_limit')}</label>
                  <input className="w-full p-2 border rounded-lg text-sm" value={formData.rules?.age_limit} onChange={(e) => setFormData({ ...formData, rules: { ...formData.rules, age_limit: e.target.value } })} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">{t('label_activity_level')}</label>
                  <select className="w-full p-2 border rounded-lg text-sm" value={formData.rules?.activity_level} onChange={(e) => setFormData({ ...formData, rules: { ...formData.rules, activity_level: e.target.value } })}>
                    {ACTIVITY_LEVEL_OPTIONS.map((levelOption) => (
                      <option key={levelOption.value} value={levelOption.value}>
                        {getLocalizedText(levelOption.labels, lang)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{copy.refundPolicyLabel}</p>
                <p className="text-sm font-semibold text-slate-800">{getLocalizedText(FIXED_REFUND_POLICY_LABELS, lang)}</p>
                <p className="text-[11px] text-slate-500 mt-1">{copy.refundPolicyHelp}</p>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
