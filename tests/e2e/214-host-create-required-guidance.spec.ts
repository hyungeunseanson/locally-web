import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getExperienceFormCopy, INITIAL_FORM_DATA } from '../../app/host/create/config';
import type { ExperienceFormState } from '../../app/host/create/experienceFormState';
import {
  prepareExperienceListDrafts,
  validateExperienceForm,
  validateExperienceStep,
} from '../../app/host/create/experienceFormValidation';

function createValidForm(): ExperienceFormState {
  return {
    ...INITIAL_FORM_DATA,
    city: '서울',
    category: '맛집 탐방',
    languages: ['한국어'],
    language_levels: [{ language: '한국어', level: 5 }],
    source_locale: 'ko',
    manual_content: {
      ko: {
        title: '서울 로컬 골목 체험',
        description: '게스트와 함께 서울의 로컬 골목을 걷고 음식과 문화를 소개하는 상세한 체험입니다.',
      },
    },
    photos: ['blob:hero-photo'],
    meeting_point: '홍대입구역 8번 출구',
    location: '서울 마포구 양화로 165',
    itinerary: [{ title: '만남', description: '', type: 'meet', image_url: '' }],
    inclusions: ['로컬 음료'],
    exclusions: [],
    supplies: '',
    duration: 3,
    maxGuests: 4,
    rules: {
      ...INITIAL_FORM_DATA.rules,
      age_limit: '만 10세 이상',
    },
    price: 50000,
    solo_guarantee_price: 30000,
    is_private_enabled: false,
    private_price: 0,
  };
}

test('accepts the complete seven-step host experience form', () => {
  expect(validateExperienceForm(createValidForm())).toEqual([]);
});

test('returns ordered step and field identifiers for earlier-step omissions', () => {
  const valid = createValidForm();
  const issues = validateExperienceForm({
    ...valid,
    city: '',
    meeting_point: '',
    duration: 0,
    maxGuests: 0,
    rules: { ...valid.rules, age_limit: '' },
  });

  expect(issues.map(({ step, field }) => ({ step, field }))).toEqual([
    { step: 1, field: 'city' },
    { step: 4, field: 'meeting-point' },
    { step: 6, field: 'duration' },
    { step: 6, field: 'max-guests' },
    { step: 6, field: 'age-limit' },
  ]);
});

test('identifies each invalid localized title, description, and itinerary stop', () => {
  const valid = createValidForm();
  const form: ExperienceFormState = {
    ...valid,
    languages: ['한국어', '영어'],
    language_levels: [
      { language: '한국어', level: 5 },
      { language: '영어', level: 3 },
    ],
    manual_content: {
      ...valid.manual_content,
      en: { title: 'Short', description: 'Too short' },
    },
    itinerary: [
      ...valid.itinerary,
      { title: '', description: '', type: 'spot', image_url: '' },
    ],
  };

  expect(validateExperienceStep(form, 3)).toContainEqual({
    step: 3,
    field: 'title-en',
    code: 'title_too_short',
  });
  expect(validateExperienceStep(form, 4)).toContainEqual({
    step: 4,
    field: 'itinerary-1-title',
    code: 'itinerary_title_required',
  });
  expect(validateExperienceStep(form, 5)).toContainEqual({
    step: 5,
    field: 'description-en',
    code: 'description_too_short',
  });
});

test('preserves list quality rules and avoids cascading language errors', () => {
  const valid = createValidForm();
  const listIssues = validateExperienceStep({
    ...valid,
    inclusions: ['a', 'A'],
    exclusions: ['b'],
    supplies: 'abc',
  }, 5);

  expect(listIssues.map((issue) => issue.code)).toEqual([
    'inclusion_too_short',
    'inclusion_duplicate',
    'exclusion_too_short',
    'supplies_too_short',
  ]);

  const languageIssues = validateExperienceStep({
    ...valid,
    languages: [],
    language_levels: [],
    source_locale: 'ko',
  }, 2);
  expect(languageIssues).toEqual([
    { step: 2, field: 'languages', code: 'languages_required' },
  ]);
});

test('adds both valid drafts atomically and keeps both when either draft is invalid', () => {
  const valid = createValidForm();
  const added = prepareExperienceListDrafts(valid, '  호스트 가이드  ', '  개인 교통비  ');

  expect(added.issues).toEqual([]);
  expect(added.formData.inclusions).toEqual(['로컬 음료', '호스트 가이드']);
  expect(added.formData.exclusions).toEqual(['개인 교통비']);
  expect(added.tempInclusion).toBe('');
  expect(added.tempExclusion).toBe('');
  expect(valid.inclusions).toEqual(['로컬 음료']);

  const blocked = prepareExperienceListDrafts(valid, '호스트 가이드', 'a');
  expect(blocked.issues).toEqual([
    { step: 5, field: 'exclusion-draft', code: 'exclusion_too_short' },
  ]);
  expect(blocked.formData).toBe(valid);
  expect(blocked.tempInclusion).toBe('호스트 가이드');
  expect(blocked.tempExclusion).toBe('a');
});

test('blocks duplicate pending list items without changing the form', () => {
  const valid = createValidForm();
  const result = prepareExperienceListDrafts(valid, '  로컬   음료 ', '');

  expect(result.issues).toEqual([
    { step: 5, field: 'inclusion-draft', code: 'inclusion_duplicate' },
  ]);
  expect(result.formData).toBe(valid);
  expect(result.tempInclusion).toBe('  로컬   음료 ');
});

test('keeps required and description guidance localized in all supported languages', () => {
  const copies = ['ko', 'en', 'ja', 'zh'].map((locale) => getExperienceFormCopy(locale));

  for (const copy of copies) {
    expect(copy.requiredLabel.trim()).not.toBe('');
    expect(copy.descriptionCount(30)).toContain('30');
    expect(copy.descriptionCount(30)).toContain('50');
    expect(copy.validationMaxGuests.trim()).not.toBe('');
  }
});

test('runs the complete preflight before loading, storage uploads, or the create request', () => {
  const source = readFileSync(join(process.cwd(), 'app/host/create/page.tsx'), 'utf8');
  const submitStart = source.indexOf('const handleSubmit = async () =>');
  const preflight = source.indexOf('validateExperienceForm(formData)', submitStart);
  const loading = source.indexOf('setLoading(true)', submitStart);
  const upload = source.indexOf("uploadImageToStorage(user.id, file, 'hero')", submitStart);
  const request = source.indexOf("fetch('/api/host/experiences'", submitStart);

  expect(submitStart).toBeGreaterThan(-1);
  expect(preflight).toBeGreaterThan(submitStart);
  expect(preflight).toBeLessThan(loading);
  expect(loading).toBeLessThan(upload);
  expect(upload).toBeLessThan(request);
});
