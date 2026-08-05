import { readFileSync } from 'fs';
import { join } from 'path';
import { expect, test, type Page } from '@playwright/test';

import { INITIAL_FORM_DATA, getExperienceFormCopy } from '../../app/host/create/config';
import {
  EXPERIENCE_DRAFT_RETENTION_MS,
  isMeaningfulExperienceDraft,
  sanitizeExperienceDraftFormData,
  type ExperienceDraftData,
} from '../../app/host/create/experienceDraftStorage';

function createDraftData(): ExperienceDraftData {
  return {
    step: 1,
    formData: {
      ...INITIAL_FORM_DATA,
      rules: { ...INITIAL_FORM_DATA.rules },
      itinerary: INITIAL_FORM_DATA.itinerary.map((item) => ({ ...item })),
      is_private_enabled: false,
      private_price: 0,
    },
    isCustomCity: false,
    tempInclusion: '',
    tempExclusion: '',
  };
}

async function installMockHostSession(page: Page) {
  const env = readFileSync('.env.local', 'utf8')
    .split(/\n/)
    .reduce<Record<string, string>>((acc, line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) acc[match[1]] = match[2];
      return acc;
    }, {});
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const userId = '00000000-0000-4000-8000-000000000220';
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const user = {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'draft-test@example.com',
    email_confirmed_at: new Date().toISOString(),
    user_metadata: { full_name: 'Draft Test Host' },
    app_metadata: { provider: 'email', providers: ['email'] },
    created_at: new Date().toISOString(),
  };

  const session = {
    access_token: 'mock-draft-access-token',
    refresh_token: 'mock-draft-refresh-token',
    expires_in: 3600,
    expires_at: expiresAt,
    token_type: 'bearer',
    user,
  };
  const encodedSession = Buffer.from(JSON.stringify(session)).toString('base64url');

  await page.addInitScript(({ storageKey, cookieValue }) => {
    document.cookie = `${storageKey}=${cookieValue}; path=/; SameSite=Lax`;
  }, {
    storageKey: `sb-${projectRef}-auth-token`,
    cookieValue: `base64-${encodedSession}`,
  });

  await page.route(`${supabaseUrl}/auth/v1/user**`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
  });
  await page.route(`${supabaseUrl}/rest/v1/profiles**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: userId, avatar_url: null }),
    });
  });
  await page.route(`${supabaseUrl}/rest/v1/host_applications**`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test('keeps drafts for 30 days and removes ephemeral blob URLs before storage', () => {
  expect(EXPERIENCE_DRAFT_RETENTION_MS).toBe(30 * 24 * 60 * 60 * 1000);

  const formData = {
    ...createDraftData().formData,
    photos: ['blob:https://www.locally-travel.com/hero', 'https://cdn.example.com/legacy.jpg'],
    itinerary: [
      { ...INITIAL_FORM_DATA.itinerary[0], image_url: 'blob:https://www.locally-travel.com/route' },
    ],
  };
  const sanitized = sanitizeExperienceDraftFormData(formData);

  expect(sanitized.photos).toEqual(['', 'https://cdn.example.com/legacy.jpg']);
  expect(sanitized.itinerary[0].image_url).toBe('');
  expect(formData.photos[0]).toContain('blob:');
});

test('does not create an empty draft and recognizes meaningful partial progress', () => {
  const empty = createDraftData();
  expect(isMeaningfulExperienceDraft(empty, { heroFiles: [], itineraryFiles: [null] })).toBe(false);

  expect(isMeaningfulExperienceDraft(
    { ...empty, tempInclusion: 'Welcome drink' },
    { heroFiles: [], itineraryFiles: [null] }
  )).toBe(true);
  expect(isMeaningfulExperienceDraft(
    empty,
    { heroFiles: [new File(['photo'], 'hero.jpg', { type: 'image/jpeg' })], itineraryFiles: [null] }
  )).toBe(true);
});

test('keeps draft persistence local and clears it only after successful submission', () => {
  const storageSource = readFileSync(
    join(process.cwd(), 'app/host/create/experienceDraftStorage.ts'),
    'utf8'
  );
  const hookSource = readFileSync(
    join(process.cwd(), 'app/host/create/useExperienceDraft.ts'),
    'utf8'
  );
  const pageSource = readFileSync(join(process.cwd(), 'app/host/create/page.tsx'), 'utf8');

  expect(storageSource).toContain("window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)");
  expect(storageSource).not.toContain('fetch(');
  expect(storageSource).not.toContain('supabase');
  expect(storageSource).toContain('isStoredExperienceDraft');
  expect(hookSource).toContain('mediaDirtyRef.current');
  expect(hookSource).toContain('ExperienceDraftConflictError');
  expect(hookSource).toContain("window.setTimeout(() => void saveNow(), 1500)");
  expect(hookSource).toContain('await saveChainRef.current.catch(() => undefined)');

  const responseGuard = pageSource.indexOf("if (!response.ok || !result?.success)");
  const clearDraft = pageSource.indexOf('await clearDraft()', responseGuard);
  const successStep = pageSource.indexOf('setStep(TOTAL_STEPS)', responseGuard);
  expect(responseGuard).toBeGreaterThan(-1);
  expect(clearDraft).toBeGreaterThan(responseGuard);
  expect(successStep).toBeGreaterThan(clearDraft);
});

test('provides complete draft controls and retention copy in all four languages', () => {
  for (const locale of ['ko', 'en', 'ja', 'zh']) {
    const copy = getExperienceFormCopy(locale);
    expect(copy.draftSaveButton.length).toBeGreaterThan(0);
    expect(copy.draftSaving.length).toBeGreaterThan(0);
    expect(copy.draftSavedAt('3:20').length).toBeGreaterThan(0);
    expect(copy.draftRetention).toMatch(/30/);
    expect(copy.draftRestoreTitle.length).toBeGreaterThan(0);
    expect(copy.draftContinue.length).toBeGreaterThan(0);
    expect(copy.draftStartNew.length).toBeGreaterThan(0);
    expect(copy.draftConflict.length).toBeGreaterThan(0);
  }
});

test('keeps the compact save UI and accessible restore dialog contract', () => {
  const pageSource = readFileSync(join(process.cwd(), 'app/host/create/page.tsx'), 'utf8');
  const dialogSource = readFileSync(
    join(process.cwd(), 'app/host/create/components/ExperienceDraftRestoreDialog.tsx'),
    'utf8'
  );

  expect(pageSource).toContain('grid-cols-[auto_minmax(72px,1fr)_auto]');
  expect(pageSource).toContain('aria-live="polite"');
  expect(dialogSource).toContain('role="dialog"');
  expect(dialogSource).toContain('aria-modal="true"');
  expect(dialogSource).toContain("event.key !== 'Tab'");
});

test('autosaves to IndexedDB and restores the same host draft after reload without server writes', async ({ page }) => {
  await installMockHostSession(page);
  const createRequests: string[] = [];
  const storageWrites: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/host/experiences')) createRequests.push(request.url());
    if (request.url().includes('/storage/v1/object') && request.method() !== 'GET') {
      storageWrites.push(request.url());
    }
  });

  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/host/create', { waitUntil: 'networkidle' });
  const saveButton = page.getByRole('button', { name: /^(저장|Save|保存)$/ });
  await expect(saveButton).toBeEnabled();
  const clickNext = async () => {
    await page.locator('footer').getByRole('button', { name: /다음|Next|次へ|下一步/ }).evaluate((button) => {
      (button as HTMLButtonElement).click();
    });
  };
  await page.getByRole('button', { name: /^(서울|Seoul|ソウル|首尔)$/ }).click();
  await page.getByRole('button', { name: /^(맛집 탐방|Food Tour|グルメ巡り|美食探索)$/ }).click();
  await clickNext();
  await page.getByRole('button', { name: /^(한국어|Korean|韓国語|韩语)$/ }).click();
  await page.locator('button:not([disabled])').filter({ hasText: /^Lv\.?5$/ }).click();
  await clickNext();
  const titleInput = page.locator('main input[type="text"]').first();
  await titleInput.fill('Saved local food experience');
  await page.locator('main input[type="file"][multiple]').setInputFiles('tests/e2e/test-image.png');
  await expect(page.locator('img[alt="preview 0"]')).toBeVisible({ timeout: 15000 });
  await saveButton.click();
  await expect(page.getByText(/저장됨|Saved|保存済み|已保存/)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/30/)).toBeVisible();

  const storedRevision = await page.evaluate(async () => {
    const request = indexedDB.open('locally-host-experience-drafts', 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('drafts', 'readonly');
    const getRequest = transaction.objectStore('drafts').get('00000000-0000-4000-8000-000000000220');
    const draft = await new Promise<{ revision?: number } | undefined>((resolve, reject) => {
      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => reject(getRequest.error);
    });
    database.close();
    return draft?.revision ?? 0;
  });
  expect(storedRevision).toBeGreaterThan(0);

  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /이어서 작성|Continue writing|続きから作成|继续编辑/ }).click();
  await expect(page.locator('main input[type="text"]').first()).toHaveValue('Saved local food experience');
  await expect(page.locator('img[alt="preview 0"]')).toBeVisible();
  expect(createRequests).toEqual([]);
  expect(storageWrites).toEqual([]);
});
