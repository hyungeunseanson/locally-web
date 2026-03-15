'use client';

import React from 'react';
import {
  Camera,
  MapPin,
  CheckCircle2,
  Plus,
  Minus,
  Trash2,
  X,
  Lock,
  Check,
  Utensils,
  Coffee,
  TreePine,
  ShoppingBag,
  Landmark,
  Dumbbell,
  MoonStar,
  Building2,
  Ticket,
  Flag,
  Palette,
} from 'lucide-react';
import Link from 'next/link';
import {
  ACTIVITY_LEVEL_OPTIONS,
  CATEGORY_OPTIONS,
  CITY_OPTIONS,
  COUNTRY_OPTIONS,
  EXPERIENCE_LANGUAGE_OPTIONS,
  MAX_EXPERIENCE_PHOTOS,
  FIXED_REFUND_POLICY_LABELS,
  getExperienceFormCopy,
  getItineraryStepLabel,
  getLocalizedText,
} from '../config';
import { type LanguageLevel, type LanguageLevelEntry } from '@/app/utils/languageLevels';
import { useLanguage } from '@/app/context/LanguageContext';
import { getManualFieldValue, setManualFieldValue, type ExperienceFormState, type ItineraryItem } from '../experienceFormState';
import { getManualLocalesFromLanguageLevels } from '@/app/utils/experienceTranslation';

interface ExperienceFormStepsProps {
  step: number;
  formData: ExperienceFormState;
  updateData: (key: string, value: unknown) => void;
  handleCounter: (key: 'duration' | 'maxGuests', type: 'inc' | 'dec') => void;
  handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleItineraryImageUpload: (index: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveItineraryImage: (index: number) => void;
  addItem: (field: 'inclusions' | 'exclusions', value: string, setter: React.Dispatch<React.SetStateAction<string>>) => void;
  removeItem: (field: 'inclusions' | 'exclusions', index: number) => void;
  addItineraryItem: () => void;
  removeItineraryItem: (index: number) => void;
  updateItineraryItem: (index: number, key: 'title' | 'description' | 'type', value: string) => void;
  isCustomCity: boolean;
  setIsCustomCity: React.Dispatch<React.SetStateAction<boolean>>;
  tempInclusion: string;
  setTempInclusion: React.Dispatch<React.SetStateAction<string>>;
  tempExclusion: string;
  setTempExclusion: React.Dispatch<React.SetStateAction<string>>;
  handleRemoveImage?: (index: number) => void;
  onPhotoTap?: (index: number) => void;
}

const LEVELS: LanguageLevel[] = [1, 2, 3, 4, 5];

function LanguageLevelSelector({
  entries,
  updateData,
}: {
  entries: LanguageLevelEntry[];
  updateData: (key: string, value: unknown) => void;
}) {
  const toggleLanguage = (language: string) => {
    const exists = entries.some((entry) => entry.language === language);
    const nextEntries = exists
      ? entries.filter((entry) => entry.language !== language)
      : [...entries, { language, level: 3 }];
    updateData('language_levels', nextEntries);
  };

  const updateLevel = (language: string, level: LanguageLevel) => {
    updateData(
      'language_levels',
      entries.map((entry) => (entry.language === language ? { ...entry, level } : entry))
    );
  };

  const { lang } = useLanguage();

  return (
    <div className="space-y-4">
      {EXPERIENCE_LANGUAGE_OPTIONS.map((languageOption) => {
        const current = entries.find((entry) => entry.language === languageOption.value);
        const selected = Boolean(current);

        return (
          <div key={languageOption.value} className={`rounded-2xl border p-4 ${selected ? 'border-black bg-slate-50' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={() => toggleLanguage(languageOption.value)} className="text-left font-bold text-sm md:text-base">
                {getLocalizedText(languageOption.labels, lang)}
              </button>
              <button
                type="button"
                onClick={() => toggleLanguage(languageOption.value)}
                className={`w-7 h-7 rounded-full border flex items-center justify-center ${selected ? 'bg-black border-black text-white' : 'border-slate-300 text-transparent'}`}
              >
                <Check size={14} strokeWidth={3} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-1.5">
              {LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  disabled={!selected}
                  onClick={() => updateLevel(languageOption.value, level)}
                  className={`h-10 rounded-xl border text-[11px] font-bold ${
                    !selected
                      ? 'border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed'
                      : current?.level === level
                        ? 'border-black bg-black text-white'
                        : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  Lv.{level}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ExperienceFormSteps({
  step,
  formData,
  updateData,
  handleCounter,
  handlePhotoUpload,
  handleItineraryImageUpload,
  handleRemoveItineraryImage,
  addItem,
  removeItem,
  addItineraryItem,
  removeItineraryItem,
  updateItineraryItem,
  isCustomCity,
  setIsCustomCity,
  tempInclusion,
  setTempInclusion,
  tempExclusion,
  setTempExclusion,
  handleRemoveImage,
  onPhotoTap,
}: ExperienceFormStepsProps) {
  const { lang } = useLanguage();
  const copy = getExperienceFormCopy(lang);
  const manualLocales = getManualLocalesFromLanguageLevels(formData.language_levels || []);
  const selectedLanguageOptions = EXPERIENCE_LANGUAGE_OPTIONS.filter((option) => manualLocales.includes(option.code));
  const categoryIconMap: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
    utensils: Utensils,
    coffee: Coffee,
    treePine: TreePine,
    shoppingBag: ShoppingBag,
    landmark: Landmark,
    dumbbell: Dumbbell,
    moonStar: MoonStar,
    building2: Building2,
    ticket: Ticket,
    flag: Flag,
    palette: Palette,
  };

  if (step === 1) {
    return (
      <div className="w-full space-y-6 md:space-y-8">
        <div className="space-y-2">
          <h1 className="text-[22px] md:text-[30px] font-black text-slate-900 leading-tight">{copy.step1Title}</h1>
          <p className="text-[13px] md:text-base text-slate-500">{copy.step1Desc}</p>
        </div>

        <div className="space-y-5 md:space-y-6">
          <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
            {COUNTRY_OPTIONS.map((countryOption) => (
              <button
                key={countryOption.value}
                type="button"
                onClick={() => updateData('country', countryOption.value)}
                className={`px-4 md:px-6 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${formData.country === countryOption.value ? 'bg-white shadow-sm text-black' : 'text-slate-400'}`}
              >
                {getLocalizedText(countryOption.labels, lang)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 md:gap-3">
            {CITY_OPTIONS[formData.country as 'Korea' | 'Japan'].map((cityOption) => (
              <button
                key={cityOption.value}
                type="button"
                onClick={() => {
                  setIsCustomCity(cityOption.value === '기타');
                  updateData('city', cityOption.value === '기타' ? '' : cityOption.value);
                }}
                className={`h-12 md:h-14 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold border transition-all ${(!isCustomCity && formData.city === cityOption.value) || (isCustomCity && cityOption.value === '기타') ? 'border-black bg-black text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}
              >
                {getLocalizedText(cityOption.labels, lang)}
              </button>
            ))}
          </div>

          {isCustomCity && (
            <input
              type="text"
              placeholder={copy.customCityPlaceholder}
              value={formData.city}
              onChange={(e) => updateData('city', e.target.value)}
              className="w-full p-3.5 md:p-4 text-base md:text-lg font-bold border-b-2 border-slate-200 focus:border-black outline-none bg-transparent"
            />
          )}

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 block">{copy.categoryLabel}</label>
            <div className="flex flex-wrap gap-2.5 md:gap-3">
              {CATEGORY_OPTIONS.map((categoryOption) => {
                const Icon = categoryIconMap[categoryOption.icon] || MapPin;
                const isSelected = formData.category === categoryOption.value;

                return (
                  <button
                    key={categoryOption.value}
                    type="button"
                    onClick={() => updateData('category', categoryOption.value)}
                    className={`h-10 md:h-11 px-3.5 md:px-4 rounded-full border flex items-center gap-1.5 md:gap-2 text-[12px] md:text-sm font-semibold transition-all ${isSelected ? 'border-[#222] bg-[#F8F8F8] text-[#222]' : 'border-[#D8D8D8] text-[#454545] hover:border-[#222]'}`}
                  >
                    <Icon size={14} strokeWidth={1.9} />
                    <span>{getLocalizedText(categoryOption.labels, lang)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="w-full space-y-6 md:space-y-8">
        <div className="space-y-2">
          <h1 className="text-[22px] md:text-[30px] font-black text-slate-900 leading-tight">{copy.step2Title}</h1>
          <p className="text-[13px] md:text-base text-slate-500">{copy.step2Desc}</p>
        </div>
        <LanguageLevelSelector entries={formData.language_levels || []} updateData={updateData} />
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{copy.sourceLocaleLabel}</label>
            <p className="text-sm text-slate-500">{copy.sourceLocaleHelp}</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {selectedLanguageOptions.map((option) => {
              const selected = formData.source_locale === option.code;
              return (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => updateData('source_locale', option.code)}
                  className={`rounded-full border px-4 py-2 text-sm font-bold transition-all ${selected ? 'border-black bg-black text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-black'}`}
                >
                  {option.flag} {getLocalizedText(option.labels, lang)}
                </button>
              );
            })}
            {selectedLanguageOptions.length === 0 && (
              <p className="text-sm text-slate-400">{copy.validationLanguages}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="w-full space-y-6 md:space-y-8">
        <div className="space-y-2">
          <h1 className="text-[22px] md:text-[30px] font-black text-slate-900 leading-tight">{copy.step3Title}</h1>
          <p className="text-[13px] md:text-base text-slate-500">{copy.step3Desc(MAX_EXPERIENCE_PHOTOS)}</p>
        </div>

        <div className="space-y-6 md:space-y-8">
          <div className="space-y-4">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{copy.titleSectionLabel}</label>
            <div className="space-y-4">
              {selectedLanguageOptions.map((option) => {
                const isSourceLocale = formData.source_locale === option.code;
                const inputValue = getManualFieldValue(formData.manual_content, option.code, 'title');

                return (
                  <div key={option.code} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
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
                      type="text"
                      placeholder={copy.titlePlaceholder}
                      value={inputValue}
                      onChange={(e) => updateData('manual_content', setManualFieldValue(formData.manual_content, option.code, 'title', e.target.value))}
                      className="w-full py-2 text-lg md:text-xl font-black border-b-2 border-slate-200 focus:border-black outline-none bg-transparent placeholder:text-slate-300"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[12px] md:text-sm text-slate-500 leading-relaxed">
            {copy.firstPhotoNotice}
          </p>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {formData.photos.length < MAX_EXPERIENCE_PHOTOS && (
              <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-black hover:bg-slate-50 transition-all">
                <Camera size={24} className="text-slate-400 mb-2" />
                <span className="text-xs font-bold text-slate-500">{copy.addHeroPhoto}</span>
                <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
            )}

            {formData.photos.map((url: string, idx: number) => (
              <div
                key={idx}
                className="aspect-square rounded-2xl overflow-hidden relative shadow-sm group border border-slate-100 cursor-pointer"
                onClick={() => onPhotoTap?.(idx)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if ((event.key === 'Enter' || event.key === ' ') && onPhotoTap) {
                    event.preventDefault();
                    onPhotoTap(idx);
                  }
                }}
              >
                <img src={url} className="w-full h-full object-cover" alt={`preview ${idx}`} />
                {idx === 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-1 text-[10px] font-bold text-white">
                    {copy.mainPhotoBadge}
                  </span>
                )}
                <button
                  type="button"
                  className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full opacity-0 md:group-hover:opacity-100 transition-all hover:bg-rose-500 hover:scale-110"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (handleRemoveImage) handleRemoveImage(idx);
                  }}
                >
                  <X size={14} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="w-full space-y-6 md:space-y-8">
        <div className="space-y-2">
          <h1 className="text-[22px] md:text-[30px] font-black text-slate-900 leading-tight">{copy.step4Title}</h1>
          <p className="text-[13px] md:text-base text-slate-500">{copy.step4Desc}</p>
        </div>

        <div className="bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-200 space-y-4">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <MapPin size={12} /> {copy.meetingPointLabel}
          </label>
          <input
            type="text"
            placeholder={copy.meetingPointPlaceholder}
            value={formData.meeting_point || ''}
            onChange={(e) => updateData('meeting_point', e.target.value)}
            className="w-full p-3.5 md:p-4 bg-white rounded-xl border border-slate-200 focus:border-black outline-none font-bold text-sm md:text-base"
          />
          <input
            type="text"
            placeholder={copy.addressPlaceholder}
            value={formData.location || ''}
            onChange={(e) => updateData('location', e.target.value)}
            className="w-full p-3.5 md:p-4 bg-white rounded-xl border border-slate-200 focus:border-black outline-none font-medium text-sm md:text-base"
          />
          <p className="text-xs text-slate-400">{copy.addressHelp}</p>
        </div>

        <div className="space-y-4">
          <h3 className="text-base md:text-lg font-bold">{copy.itinerarySectionTitle}</h3>
          <div className="relative border-l-2 border-slate-100 ml-3 md:ml-4 pl-6 md:pl-8 space-y-5 md:space-y-8 py-2">
            {formData.itinerary.map((item: ItineraryItem, idx: number) => (
              <div key={idx} className="relative group animate-in slide-in-from-left-4 fade-in duration-300">
                <div className={`absolute -left-[41px] top-4 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 ${idx === 0 ? 'bg-black' : idx === formData.itinerary.length - 1 ? 'bg-slate-900' : 'bg-slate-300'}`}>
                  {idx === 0 && <MapPin size={10} className="text-white" />}
                </div>
                <div className="bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-200 group-hover:border-slate-300 transition-colors relative">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {getItineraryStepLabel(lang, idx, formData.itinerary.length)}
                    </span>
                    {formData.itinerary.length > 1 && (
                      <button type="button" onClick={() => removeItineraryItem(idx)} className="text-slate-300 hover:text-rose-500">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder={copy.itineraryTitlePlaceholder}
                      value={item.title}
                      onChange={(e) => updateItineraryItem(idx, 'title', e.target.value)}
                      className="w-full bg-transparent text-base md:text-lg font-bold outline-none"
                    />
                    <textarea
                      placeholder={copy.itineraryDescPlaceholder}
                      value={item.description}
                      onChange={(e) => updateItineraryItem(idx, 'description', e.target.value)}
                      className="w-full bg-transparent text-xs md:text-sm text-slate-600 outline-none resize-none h-12"
                    />

                    <div className="pt-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">{copy.itineraryPhotoLabel}</label>
                      {item.image_url ? (
                        <div className="relative w-full h-36 md:h-44 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                          <img src={item.image_url} alt={`${item.title || 'itinerary'} preview`} className="w-full h-full object-cover" />
                          <div className="absolute top-2 right-2 flex gap-2">
                            <label className="bg-white/90 text-slate-700 px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer">
                              {copy.itineraryReplace}
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleItineraryImageUpload(idx, e)} />
                            </label>
                            <button type="button" onClick={() => handleRemoveItineraryImage(idx)} className="bg-black/70 text-white p-1.5 rounded-full hover:bg-rose-500 transition-colors">
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 h-20 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 text-xs font-bold cursor-pointer hover:border-black hover:text-black transition-colors">
                          <Camera size={16} />
                          {copy.itineraryAddPhoto}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleItineraryImageUpload(idx, e)} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button type="button" onClick={addItineraryItem} className="flex items-center gap-3 text-slate-500 hover:text-black font-bold text-sm pl-1">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                <Plus size={16} />
              </div>
              {copy.addStop}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="w-full space-y-6 md:space-y-8">
        <div className="space-y-2">
          <h1 className="text-[22px] md:text-[30px] font-black">{copy.step5Title}</h1>
          <p className="text-[13px] md:text-base text-slate-500">{copy.step5Desc}</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{copy.descriptionSectionLabel}</label>
            {selectedLanguageOptions.map((option) => {
              const isSourceLocale = formData.source_locale === option.code;
              const inputValue = getManualFieldValue(formData.manual_content, option.code, 'description');

              return (
                <div key={option.code} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
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
                    placeholder={copy.descriptionPlaceholder}
                    value={inputValue}
                    onChange={(e) => updateData('manual_content', setManualFieldValue(formData.manual_content, option.code, 'description', e.target.value))}
                    className="w-full p-4 h-32 md:h-36 bg-slate-50 rounded-2xl outline-none resize-none text-sm md:text-base border border-slate-200 focus:border-black"
                  />
                </div>
              );
            })}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">{copy.inclusionsLabel}</label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder={copy.inclusionsPlaceholder}
                value={tempInclusion}
                onChange={(e) => setTempInclusion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem('inclusions', tempInclusion, setTempInclusion);
                  }
                }}
                className="flex-1 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none border border-slate-200"
              />
              <button type="button" onClick={() => addItem('inclusions', tempInclusion, setTempInclusion)} className="bg-black text-white p-3 rounded-xl">
                <Plus size={20} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.inclusions.map((item: string, i: number) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-bold border border-green-100">
                  {item}
                  <button type="button" onClick={() => removeItem('inclusions', i)}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">{copy.exclusionsLabel}</label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder={copy.exclusionsPlaceholder}
                value={tempExclusion}
                onChange={(e) => setTempExclusion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem('exclusions', tempExclusion, setTempExclusion);
                  }
                }}
                className="flex-1 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none border border-slate-200"
              />
              <button type="button" onClick={() => addItem('exclusions', tempExclusion, setTempExclusion)} className="bg-black text-white p-3 rounded-xl">
                <Plus size={20} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.exclusions.map((item: string, i: number) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                  {item}
                  <button type="button" onClick={() => removeItem('exclusions', i)}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">{copy.suppliesLabel}</label>
            <textarea
              placeholder={copy.suppliesPlaceholder}
              value={formData.supplies}
              onChange={(e) => updateData('supplies', e.target.value)}
              className="w-full p-4 h-24 bg-slate-50 rounded-2xl outline-none resize-none text-sm border border-slate-200 focus:border-black"
            />
          </div>
        </div>
      </div>
    );
  }

  if (step === 6) {
    return (
      <div className="w-full space-y-6 md:space-y-8">
        <div className="space-y-2">
          <h1 className="text-[22px] md:text-[30px] font-black">{copy.step6Title}</h1>
          <p className="text-[13px] md:text-base text-slate-500">{copy.step6Desc}</p>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-50 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">{copy.durationLabel}</label>
                <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200">
                  <button type="button" onClick={() => handleCounter('duration', 'dec')} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <Minus size={14} />
                  </button>
                  <span className="font-black flex-1 text-center">{formData.duration}{copy.durationUnit}</span>
                  <button type="button" onClick={() => handleCounter('duration', 'inc')} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">{copy.maxGuestsLabel}</label>
                <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200">
                  <button type="button" onClick={() => handleCounter('maxGuests', 'dec')} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <Minus size={14} />
                  </button>
                  <span className="font-black flex-1 text-center">{formData.maxGuests}{copy.maxGuestsUnit}</span>
                  <button type="button" onClick={() => handleCounter('maxGuests', 'inc')} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">{copy.ageLimitLabel}</label>
                <input
                  type="text"
                  placeholder={copy.ageLimitPlaceholder}
                  value={formData.rules.age_limit}
                  onChange={(e) => updateData('rules', { ...formData.rules, age_limit: e.target.value })}
                  className="w-full p-3 bg-white rounded-xl text-sm border border-slate-200 focus:border-black outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">{copy.activityLevelLabel}</label>
                <select
                  value={formData.rules.activity_level}
                  onChange={(e) => updateData('rules', { ...formData.rules, activity_level: e.target.value })}
                  className="w-full p-3 bg-white rounded-xl text-sm border border-slate-200 focus:border-black outline-none"
                >
                  {ACTIVITY_LEVEL_OPTIONS.map((levelOption) => (
                    <option key={levelOption.value} value={levelOption.value}>
                      {levelOption.emoji} {getLocalizedText(levelOption.labels, lang)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 md:px-5 md:py-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{copy.refundPolicyLabel}</p>
            <p className="text-sm md:text-base font-semibold text-slate-800">{getLocalizedText(FIXED_REFUND_POLICY_LABELS, lang)}</p>
            <p className="text-xs text-slate-500 mt-2">{copy.refundPolicyHelp}</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 7) {
    return (
      <div className="w-full space-y-6 md:space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-[22px] md:text-[30px] font-black">{copy.step7Title}</h1>
          <p className="text-[13px] md:text-base text-slate-500">{copy.step7Desc}</p>
        </div>

        <div className="flex flex-col items-center w-full max-w-md mx-auto space-y-6">
          <div className="w-full">
            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block text-center">{copy.priceLabel}</label>
            <div className="relative w-full max-w-xs mx-auto">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl md:text-4xl font-bold text-slate-300">₩</span>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => updateData('price', Number(e.target.value))}
                className="w-full pl-12 pr-4 py-3 md:py-4 text-3xl md:text-5xl font-black text-center border-b-2 border-slate-200 focus:border-black outline-none bg-transparent"
                placeholder="0"
              />
            </div>
          </div>

          <div className="w-full bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Lock size={18} className="text-slate-900" />
                <span className="font-bold text-slate-900">{copy.privateOptionLabel}</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={formData.is_private_enabled || false}
                  onChange={(e) => updateData('is_private_enabled', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
              </label>
            </div>

            {formData.is_private_enabled && (
              <div className="animate-in fade-in slide-in-from-top-2 pt-2 border-t border-slate-200 mt-2">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">₩</span>
                  <input
                    type="number"
                    value={formData.private_price || 0}
                    onChange={(e) => updateData('private_price', Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 text-xl font-bold bg-white border border-slate-300 rounded-xl focus:border-black outline-none"
                    placeholder={copy.privatePricePlaceholder}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === 8) {
    return (
      <div className="w-full text-center space-y-8 animate-in zoom-in-95 duration-500 py-10">
        <div className="w-32 h-32 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-200">
          <CheckCircle2 size={64} strokeWidth={3} />
        </div>
        <div className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">{copy.step8Title}</h1>
          <p className="text-slate-500 text-sm md:text-lg leading-relaxed max-w-md mx-auto">
            {copy.step8DescLine1}
            <br />
            {copy.step8DescLine2}
          </p>
        </div>
        <div className="pt-8">
          <Link href="/host/dashboard?tab=experiences">
            <button className="bg-black text-white px-12 py-5 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl hover:shadow-2xl">
              {copy.step8Button}
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
