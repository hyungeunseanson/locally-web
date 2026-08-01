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

test('keeps validation guidance while removing only the red field outlines', () => {
  const source = readFileSync(join(process.cwd(), 'app/host/create/components/ExperienceFormSteps.tsx'), 'utf8');

  expect(source).not.toContain('invalidBorder');
  expect(source).not.toContain('border-rose-500');
  expect(source).not.toContain('ring-rose-200');
  expect(source).toContain("'aria-invalid': message ? true : undefined");
  expect(source).toContain("'aria-describedby': message ? `host-create-error-${field}` : undefined");
  expect(source).toContain('data-validation-field');
  expect(source).toContain('<ValidationMessage');
});

test('keeps the original compact pricing layout at desktop widths', () => {
  const source = readFileSync(join(process.cwd(), 'app/host/create/components/ExperienceFormSteps.tsx'), 'utf8');
  const pageSource = readFileSync(join(process.cwd(), 'app/host/create/page.tsx'), 'utf8');

  expect(source).toContain('max-w-md flex-col items-center space-y-6');
  expect(source).not.toContain('lg:max-w-[720px]');
  expect(source).toContain('flex flex-col gap-4 md:flex-row md:items-start md:justify-between');
  expect(source).toContain('host-create-solo-guarantee-price-panel');
  expect(source).toContain('w-full md:w-56 shrink-0 rounded-2xl border border-emerald-200 bg-white p-4');
  expect(source).not.toContain('lg:grid-cols-[minmax(360px,1fr)_240px]');
  expect(source).not.toContain('lg:w-60');
  expect(pageSource).toContain('w-full max-w-2xl lg:max-w-3xl mx-auto');
  expect(pageSource).not.toContain("step === TOTAL_STEPS - 1 ? '' : 'max-w-2xl lg:max-w-3xl'");
  expect(pageSource).not.toContain('style={step === TOTAL_STEPS - 1 ? { maxWidth: 768 } : undefined}');
});

test('keeps mobile pricing stacked and restores the compact desktop pricing layout', async ({ page }) => {
  const nextButtonName = /다음|Next|次へ|下一步/;
  const clickNext = async () => {
    await page.locator('footer').getByRole('button', { name: nextButtonName }).evaluate((button) => {
      (button as HTMLButtonElement).click();
    });
  };

  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/host/create', { waitUntil: 'networkidle' });

  await clickNext();
  const cityValidationGroup = page.locator('[data-validation-field="city"]');
  await expect(page.locator('#host-create-error-city')).toBeVisible();
  await expect(cityValidationGroup).toHaveAttribute('aria-invalid', 'true');
  const validationVisuals = await cityValidationGroup.evaluate((element) => ({
    className: element.className,
    boxShadow: getComputedStyle(element).boxShadow,
  }));
  expect(validationVisuals.className).not.toContain('border-rose-500');
  expect(validationVisuals.className).not.toContain('ring-rose-200');
  expect(validationVisuals.boxShadow).toBe('none');

  const completeToPricing = async () => {
    await page.getByRole('button', { name: /^(서울|Seoul|ソウル|首尔)$/ }).click();
    await page.getByRole('button', { name: /^(맛집 탐방|Food Tour|グルメ巡り|美食探索)$/ }).click();
    await clickNext();

    await page.getByRole('button', { name: /^(한국어|Korean|韓国語|韩语)$/ }).click();
    await page.locator('button:not([disabled])').filter({ hasText: /^Lv\.?5$/ }).click();
    await clickNext();

    await page
      .locator(
        'input[placeholder="체험 제목을 입력하세요"], input[placeholder="Enter experience title"], input[placeholder="体験タイトルを入力してください"], input[placeholder="请输入体验标题"]'
      )
      .fill('Host pricing layout check');
    await page.locator('main input[type="file"][multiple]').setInputFiles('tests/e2e/test-image.png');
    await expect(page.locator('img[alt="preview 0"]')).toBeVisible({ timeout: 15000 });
    await clickNext();

    await page
      .locator(
        'input[placeholder="예) 스타벅스 홍대역점"], input[placeholder="e.g. Starbucks Hongdae Station"], input[placeholder="例）スターバックス弘大駅店"], input[placeholder="例如：弘大站星巴克"]'
      )
      .fill('Locally meeting point');
    await page
      .locator(
        'input[placeholder="예) 서울특별시 마포구 양화로 165"], input[placeholder="e.g. 165 Yanghwa-ro, Mapo-gu, Seoul"], input[placeholder="例）ソウル特別市 麻浦区 楊花路 165"], input[placeholder="例如：首尔特别市麻浦区杨花路165"]'
      )
      .fill('165 Yanghwa-ro, Mapo-gu, Seoul');
    await page
      .locator(
        'input[placeholder="장소 이름"], input[placeholder="Place name"], input[placeholder="Location name"], input[placeholder="場所名"], input[placeholder="地点名称"]'
      )
      .fill('Local neighborhood walk');
    await clickNext();

    await page
      .locator(
        'textarea[placeholder="상세 소개글을 입력하세요. (최소 30자, 50자 이상 권장)"], textarea[placeholder="Enter a detailed description. (30 minimum, 50+ recommended)"], textarea[placeholder="詳細紹介文を入力してください。（最低30文字、50文字以上推奨）"], textarea[placeholder="请输入详细介绍。（至少30字，建议50字以上）"]'
      )
      .fill('This description is long enough to verify the responsive host pricing layout without submitting any operational data.');
    await page
      .locator(
        'input[placeholder="예) 음료"], input[placeholder="e.g. Drink"], input[placeholder="例）ドリンク"], input[placeholder="例如：饮品"]'
      )
      .fill('Welcome drink');
    await clickNext();

    await page
      .locator(
        'input[placeholder="예) 만 7세 이상"], input[placeholder="e.g. Ages 7 and up"], input[placeholder="例）満7歳以上"], input[placeholder="例如：满7岁以上"]'
      )
      .fill('Ages 10 and up');
    await clickNext();
  };

  await completeToPricing();

  const pricingContent = page.getByTestId('host-create-step-7-content');
  const soloLayout = page.getByTestId('host-create-solo-guarantee-layout');
  const pricePanel = page.getByTestId('host-create-solo-guarantee-price-panel');
  await expect(pricingContent).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileLayout = await soloLayout.evaluate((element) => {
    const panel = element.querySelector<HTMLElement>('[data-testid="host-create-solo-guarantee-price-panel"]')!;
    const copy = element.firstElementChild as HTMLElement;
    const elementRect = element.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const copyRect = copy.getBoundingClientRect();
    return {
      elementWidth: elementRect.width,
      panelWidth: panelRect.width,
      panelTop: panelRect.top,
      copyBottom: copyRect.bottom,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  expect(mobileLayout.panelTop).toBeGreaterThanOrEqual(mobileLayout.copyBottom);
  expect(mobileLayout.panelWidth).toBeCloseTo(mobileLayout.elementWidth, 0);
  expect(mobileLayout.scrollWidth).toBeLessThanOrEqual(mobileLayout.viewportWidth);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: '/tmp/locally-host-create-pricing-mobile-2026-08-01.png', fullPage: true });

  await page.setViewportSize({ width: 1536, height: 1000 });
  await page.goto('/host/create', { waitUntil: 'networkidle' });
  await completeToPricing();
  await expect(pricingContent).toBeVisible();

  const desktopLayout = await soloLayout.evaluate((element) => {
    const panel = element.querySelector<HTMLElement>('[data-testid="host-create-solo-guarantee-price-panel"]')!;
    const copy = element.firstElementChild as HTMLElement;
    const content = element.closest<HTMLElement>('[data-testid="host-create-step-7-content"]')!;
    const card = element.closest<HTMLElement>('[data-testid="host-create-solo-guarantee-card"]')!;
    const main = content.closest<HTMLElement>('main')!;
    return {
      contentWidth: content.getBoundingClientRect().width,
      cardWidth: card.getBoundingClientRect().width,
      cardRight: card.getBoundingClientRect().right,
      layoutWidth: element.getBoundingClientRect().width,
      mainWidth: main.getBoundingClientRect().width,
      copyWidth: copy.getBoundingClientRect().width,
      panelWidth: panel.getBoundingClientRect().width,
      panelLeft: panel.getBoundingClientRect().left,
      copyRight: copy.getBoundingClientRect().right,
      panelRight: panel.getBoundingClientRect().right,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  await page.screenshot({ path: '/tmp/locally-host-create-pricing-desktop-2026-08-01.png', fullPage: true });
  expect(desktopLayout.mainWidth).toBeGreaterThanOrEqual(760);
  expect(desktopLayout.contentWidth).toBeGreaterThanOrEqual(440);
  expect(desktopLayout.contentWidth).toBeLessThanOrEqual(448);
  expect(desktopLayout.layoutWidth).toBeLessThanOrEqual(400);
  expect(desktopLayout.copyWidth).toBeGreaterThan(0);
  expect(desktopLayout.panelWidth).toBeCloseTo(224, 0);
  expect(desktopLayout.panelLeft).toBeGreaterThanOrEqual(desktopLayout.copyRight);
  expect(desktopLayout.panelRight).toBeLessThanOrEqual(desktopLayout.cardRight);
  expect(desktopLayout.scrollWidth).toBeLessThanOrEqual(desktopLayout.viewportWidth);
  await expect(pricePanel).toBeVisible();
});
