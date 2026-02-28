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
  MAJOR_CITIES,
  CATEGORIES,
  SUPPORTED_LANGUAGES,
  MAX_EXPERIENCE_PHOTOS,
  FIXED_REFUND_POLICY,
} from '../config';
import { type LanguageLevel, type LanguageLevelEntry } from '@/app/utils/languageLevels';

type ItineraryItem = {
  title: string;
  description: string;
  type: 'meet' | 'spot' | 'end';
  image_url?: string;
};

interface ExperienceFormData {
  country: string;
  city: string;
  category: string;
  languages: string[];
  language_levels: LanguageLevelEntry[];
  title: string;
  photos: string[];
  location: string;
  itinerary: ItineraryItem[];
  description: string;
  inclusions: string[];
  exclusions: string[];
  supplies: string;
  price: number;
  duration: number;
  maxGuests: number;
  meeting_point?: string;
  is_private_enabled?: boolean;
  private_price?: number;
  rules: {
    age_limit: string;
    activity_level: string;
    refund_policy: string;
  };
}

interface ExperienceFormStepsProps {
  step: number;
  formData: ExperienceFormData;
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

  return (
    <div className="space-y-4">
      {SUPPORTED_LANGUAGES.map((language) => {
        const current = entries.find((entry) => entry.language === language);
        const selected = Boolean(current);

        return (
          <div key={language} className={`rounded-2xl border p-4 ${selected ? 'border-black bg-slate-50' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={() => toggleLanguage(language)} className="text-left font-bold text-sm md:text-base">
                {language}
              </button>
              <button
                type="button"
                onClick={() => toggleLanguage(language)}
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
                  onClick={() => updateLevel(language, level)}
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
}: ExperienceFormStepsProps) {
  const categoryIconMap: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
    '맛집 탐방': Utensils,
    '카페/디저트': Coffee,
    '산책/힐링': TreePine,
    '쇼핑': ShoppingBag,
    '문화 체험': Landmark,
    '액티비티': Dumbbell,
    '나이트라이프': MoonStar,
    '건축': Building2,
    '공연/경기': Ticket,
    '랜드마크': Flag,
    '원데이 클래스': Palette,
  };

  if (step === 1) {
    return (
      <div className="w-full space-y-6 md:space-y-8">
        <div className="space-y-2">
          <h1 className="text-[22px] md:text-[30px] font-black text-slate-900 leading-tight">어떤 체험을 준비하셨나요?</h1>
          <p className="text-[13px] md:text-base text-slate-500">지역과 카테고리를 먼저 선택해주세요.</p>
        </div>

        <div className="space-y-5 md:space-y-6">
          <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
            {['Korea', 'Japan'].map((country) => (
              <button
                key={country}
                type="button"
                onClick={() => updateData('country', country)}
                className={`px-4 md:px-6 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${formData.country === country ? 'bg-white shadow-sm text-black' : 'text-slate-400'}`}
              >
                {country === 'Korea' ? '🇰🇷 한국' : '🇯🇵 일본'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 md:gap-3">
            {MAJOR_CITIES[formData.country as 'Korea' | 'Japan'].map((city: string) => (
              <button
                key={city}
                type="button"
                onClick={() => {
                  setIsCustomCity(city === '기타');
                  updateData('city', city === '기타' ? '' : city);
                }}
                className={`h-12 md:h-14 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold border transition-all ${(!isCustomCity && formData.city === city) || (isCustomCity && city === '기타') ? 'border-black bg-black text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}
              >
                {city}
              </button>
            ))}
          </div>

          {isCustomCity && (
            <input
              type="text"
              placeholder="도시 이름 입력 (예: 가마쿠라)"
              value={formData.city}
              onChange={(e) => updateData('city', e.target.value)}
              className="w-full p-3.5 md:p-4 text-base md:text-lg font-bold border-b-2 border-slate-200 focus:border-black outline-none bg-transparent"
            />
          )}

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 block">카테고리</label>
            <div className="flex flex-wrap gap-2.5 md:gap-3">
              {CATEGORIES.map((category: string) => {
                const Icon = categoryIconMap[category] || MapPin;
                const isSelected = formData.category === category;

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => updateData('category', category)}
                    className={`h-10 md:h-11 px-3.5 md:px-4 rounded-full border flex items-center gap-1.5 md:gap-2 text-[12px] md:text-sm font-semibold transition-all ${isSelected ? 'border-[#222] bg-[#F8F8F8] text-[#222]' : 'border-[#D8D8D8] text-[#454545] hover:border-[#222]'}`}
                  >
                    <Icon size={14} strokeWidth={1.9} />
                    <span>{category}</span>
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
          <h1 className="text-[22px] md:text-[30px] font-black text-slate-900 leading-tight">진행 가능한 언어</h1>
          <p className="text-[13px] md:text-base text-slate-500">이 체험을 어떤 언어로 진행할 수 있나요?</p>
        </div>
        <LanguageLevelSelector entries={formData.language_levels || []} updateData={updateData} />
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="w-full space-y-6 md:space-y-8">
        <div className="space-y-2">
          <h1 className="text-[22px] md:text-[30px] font-black text-slate-900 leading-tight">체험의 첫인상</h1>
          <p className="text-[13px] md:text-base text-slate-500">체험의 대표사진을 올려주세요. (최대 {MAX_EXPERIENCE_PHOTOS}장)</p>
        </div>

        <div className="space-y-6 md:space-y-8">
          <input
            type="text"
            placeholder="체험 제목을 입력하세요"
            value={formData.title}
            onChange={(e) => updateData('title', e.target.value)}
            className="w-full py-3 md:py-3.5 text-xl md:text-2xl font-black border-b-2 border-slate-200 focus:border-black outline-none bg-transparent placeholder:text-slate-300"
          />

          <p className="text-[12px] md:text-sm text-slate-500 leading-relaxed">
            첫 번째 대표사진이 체험 상세 페이지 상단에서 가장 먼저 보여집니다.
          </p>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {formData.photos.length < MAX_EXPERIENCE_PHOTOS && (
              <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-black hover:bg-slate-50 transition-all">
                <Camera size={24} className="text-slate-400 mb-2" />
                <span className="text-xs font-bold text-slate-500">대표사진 추가</span>
                <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
            )}

            {formData.photos.map((url: string, idx: number) => (
              <div key={idx} className="aspect-square rounded-2xl overflow-hidden relative shadow-sm group border border-slate-100">
                <img src={url} className="w-full h-full object-cover" alt={`preview ${idx}`} />
                {idx === 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-1 text-[10px] font-bold text-white">
                    메인
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (handleRemoveImage) handleRemoveImage(idx);
                  }}
                  className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500 hover:scale-110"
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
          <h1 className="text-[22px] md:text-[30px] font-black text-slate-900 leading-tight">어디서 만날까요?</h1>
          <p className="text-[13px] md:text-base text-slate-500">게스트가 바로 이해할 수 있게 만나는 장소와 체험 흐름을 적어주세요.</p>
        </div>

        <div className="bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-200 space-y-4">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <MapPin size={12} /> 만나는 장소
          </label>
          <input
            type="text"
            placeholder="예) 스타벅스 홍대역점"
            value={formData.meeting_point || ''}
            onChange={(e) => updateData('meeting_point', e.target.value)}
            className="w-full p-3.5 md:p-4 bg-white rounded-xl border border-slate-200 focus:border-black outline-none font-bold text-sm md:text-base"
          />
          <input
            type="text"
            placeholder="예) 서울특별시 마포구 양화로 165"
            value={formData.location || ''}
            onChange={(e) => updateData('location', e.target.value)}
            className="w-full p-3.5 md:p-4 bg-white rounded-xl border border-slate-200 focus:border-black outline-none font-medium text-sm md:text-base"
          />
          <p className="text-xs text-slate-400">* 구글맵에서 검색 가능한 정확한 주소를 입력해주세요.</p>
        </div>

        <div className="space-y-4">
          <h3 className="text-base md:text-lg font-bold">체험 상세 내용</h3>
          <div className="relative border-l-2 border-slate-100 ml-3 md:ml-4 pl-6 md:pl-8 space-y-5 md:space-y-8 py-2">
            {formData.itinerary.map((item: ItineraryItem, idx: number) => (
              <div key={idx} className="relative group animate-in slide-in-from-left-4 fade-in duration-300">
                <div className={`absolute -left-[41px] top-4 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 ${idx === 0 ? 'bg-black' : idx === formData.itinerary.length - 1 ? 'bg-slate-900' : 'bg-slate-300'}`}>
                  {idx === 0 && <MapPin size={10} className="text-white" />}
                </div>
                <div className="bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-200 group-hover:border-slate-300 transition-colors relative">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {idx === 0 ? 'START' : idx === formData.itinerary.length - 1 ? 'END' : `STOP ${idx}`}
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
                      placeholder="장소 이름"
                      value={item.title}
                      onChange={(e) => updateItineraryItem(idx, 'title', e.target.value)}
                      className="w-full bg-transparent text-base md:text-lg font-bold outline-none"
                    />
                    <textarea
                      placeholder="간단한 설명 (선택)"
                      value={item.description}
                      onChange={(e) => updateItineraryItem(idx, 'description', e.target.value)}
                      className="w-full bg-transparent text-xs md:text-sm text-slate-600 outline-none resize-none h-12"
                    />

                    <div className="pt-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">장소 사진</label>
                      {item.image_url ? (
                        <div className="relative w-full h-36 md:h-44 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                          <img src={item.image_url} alt={`${item.title || 'itinerary'} preview`} className="w-full h-full object-cover" />
                          <div className="absolute top-2 right-2 flex gap-2">
                            <label className="bg-white/90 text-slate-700 px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer">
                              교체
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
                          장소 사진 추가
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
              경유지 추가하기
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
          <h1 className="text-[22px] md:text-[30px] font-black">상세 소개 및 포함 사항</h1>
          <p className="text-[13px] md:text-base text-slate-500">체험을 더 설득력 있게 설명하고, 게스트가 받는 혜택을 정리해주세요.</p>
        </div>

        <div className="space-y-6">
          <textarea
            placeholder="상세 소개글을 입력하세요. (최소 50자 이상)"
            value={formData.description}
            onChange={(e) => updateData('description', e.target.value)}
            className="w-full p-4 md:p-5 h-40 md:h-48 bg-slate-50 rounded-2xl outline-none resize-none text-sm md:text-base border border-slate-200 focus:border-black"
          />

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">포함 사항</label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="예) 음료"
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
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">불포함 사항</label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="예) 개인 교통비"
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
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">준비물 (선택)</label>
            <textarea
              placeholder="예) 편한 운동화, 생수"
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
          <h1 className="text-[22px] md:text-[30px] font-black">기본 규칙 설정</h1>
          <p className="text-[13px] md:text-base text-slate-500">소요 시간과 참여 기준을 정리해주세요.</p>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-50 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">소요 시간</label>
                <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200">
                  <button type="button" onClick={() => handleCounter('duration', 'dec')} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <Minus size={14} />
                  </button>
                  <span className="font-black flex-1 text-center">{formData.duration}시간</span>
                  <button type="button" onClick={() => handleCounter('duration', 'inc')} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">최대 인원</label>
                <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200">
                  <button type="button" onClick={() => handleCounter('maxGuests', 'dec')} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <Minus size={14} />
                  </button>
                  <span className="font-black flex-1 text-center">{formData.maxGuests}명</span>
                  <button type="button" onClick={() => handleCounter('maxGuests', 'inc')} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">참가 연령</label>
                <input
                  type="text"
                  placeholder="예) 만 7세 이상"
                  value={formData.rules.age_limit}
                  onChange={(e) => updateData('rules', { ...formData.rules, age_limit: e.target.value })}
                  className="w-full p-3 bg-white rounded-xl text-sm border border-slate-200 focus:border-black outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">활동 강도</label>
                <select
                  value={formData.rules.activity_level}
                  onChange={(e) => updateData('rules', { ...formData.rules, activity_level: e.target.value })}
                  className="w-full p-3 bg-white rounded-xl text-sm border border-slate-200 focus:border-black outline-none"
                >
                  <option value="가벼움">🍃 가벼움</option>
                  <option value="보통">🚶 보통</option>
                  <option value="높음">🔥 높음</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 md:px-5 md:py-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">환불 정책</p>
            <p className="text-sm md:text-base font-semibold text-slate-800">{FIXED_REFUND_POLICY}</p>
            <p className="text-xs text-slate-500 mt-2">환불 정책은 고정으로 자동 적용됩니다.</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 7) {
    return (
      <div className="w-full space-y-6 md:space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-[22px] md:text-[30px] font-black">요금 설정</h1>
          <p className="text-[13px] md:text-base text-slate-500">가격을 설정하세요.</p>
        </div>

        <div className="flex flex-col items-center w-full max-w-md mx-auto space-y-6">
          <div className="w-full">
            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block text-center">기본 1인당 가격</label>
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
                <span className="font-bold text-slate-900">단독 투어 옵션</span>
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
                    placeholder="단독 투어 고정 가격"
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
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">체험 등록 완료! 🎉</h1>
          <p className="text-slate-500 text-sm md:text-lg leading-relaxed max-w-md mx-auto">
            관리자 검토 후 공개됩니다.
            <br />
            이제 일정을 열어 예약을 받아보세요.
          </p>
        </div>
        <div className="pt-8">
          <Link href="/host/dashboard?tab=experiences">
            <button className="bg-black text-white px-12 py-5 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl hover:shadow-2xl">
              내 체험 보러가기
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
