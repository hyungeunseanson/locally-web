import { readFileSync } from 'fs';
import { join } from 'path';
import { expect, test, type Page } from '@playwright/test';
import { INITIAL_FORM_DATA } from '../../app/host/create/config';
import {
  ExperienceImageUploadError,
  isOwnedExperienceImagePath,
  materializeExperienceImage,
} from '../../app/host/create/experienceImageUpload';

const USER_ID = '00000000-0000-4000-8000-000000000226';

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
  const user = {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'image-guard@example.com',
    email_confirmed_at: new Date().toISOString(),
    user_metadata: { full_name: 'Image Guard Host' },
    app_metadata: { provider: 'email', providers: ['email'] },
    created_at: new Date().toISOString(),
  };
  const session = {
    access_token: 'mock-image-guard-token',
    refresh_token: 'mock-image-guard-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user,
  };
  const encodedSession = Buffer.from(JSON.stringify(session)).toString('base64url');

  await page.addInitScript(({ storageKey, cookieValue }) => {
    document.cookie = `${storageKey}=${cookieValue}; path=/; SameSite=Lax`;
    localStorage.setItem('app_lang', 'ja');
    document.cookie = 'app_lang=ja; path=/; SameSite=Lax';
  }, {
    storageKey: `sb-${projectRef}-auth-token`,
    cookieValue: `base64-${encodedSession}`,
  });

  await page.route(`${supabaseUrl}/auth/v1/user**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) })
  );
  await page.route(`${supabaseUrl}/rest/v1/profiles**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: USER_ID }) })
  );
  await page.route(`${supabaseUrl}/rest/v1/host_applications**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );

  return supabaseUrl;
}

function createValidDraftForm() {
  return {
    ...INITIAL_FORM_DATA,
    city: '東京',
    category: 'グルメ巡り',
    languages: ['일본어'],
    language_levels: [{ language: '일본어', level: 5 }],
    source_locale: 'ja',
    manual_content: {
      ja: {
        title: '東京のローカルフード体験',
        description: '東京の街を歩きながら、地域の食文化とおすすめのお店を詳しく紹介する体験です。',
      },
    },
    photos: [],
    meeting_point: '東京駅丸の内口',
    location: '東京都千代田区丸の内一丁目',
    itinerary: [{ title: '集合', description: '', type: 'meet' as const, image_url: '' }],
    inclusions: ['ウェルカムドリンク'],
    exclusions: [],
    supplies: '',
    duration: 3,
    maxGuests: 4,
    rules: { ...INITIAL_FORM_DATA.rules, age_limit: '10歳以上' },
    price: 50000,
    solo_guarantee_price: 30000,
    is_private_enabled: false,
    private_price: 0,
  };
}

test('materializes a normal image without changing its bytes or content type', async () => {
  const source = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x01, 0x02, 0x03]);
  const file = new File([source], 'photo.jpg', { type: 'image/jpeg' });

  const result = await materializeExperienceImage(file);

  expect(result.contentType).toBe('image/jpeg');
  expect(Array.from(new Uint8Array(result.bytes))).toEqual(Array.from(source));
});

test('rejects an empty WebKit-style file before any storage request', async () => {
  const file = new File([], 'empty.jpeg', { type: 'image/jpeg' });

  await expect(materializeExperienceImage(file)).rejects.toMatchObject({
    name: 'ExperienceImageUploadError',
    code: 'empty_image',
  } satisfies Partial<ExperienceImageUploadError>);
});

test('turns an unreadable file stream into a safe domain error', async () => {
  const file = new File(['image'], 'unreadable.jpeg', { type: 'image/jpeg' });
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => {
      throw new Error('WebKit file provider stream closed');
    },
  });

  await expect(materializeExperienceImage(file)).rejects.toMatchObject({
    name: 'ExperienceImageUploadError',
    code: 'unreadable_image',
  } satisfies Partial<ExperienceImageUploadError>);
});

test('only accepts image paths owned by the authenticated host', () => {
  expect(isOwnedExperienceImagePath(`experience/${USER_ID}/hero/photo.jpg`, USER_ID)).toBe(true);
  expect(isOwnedExperienceImagePath(`experience/${USER_ID}/itinerary/stop.png`, USER_ID)).toBe(true);
  expect(isOwnedExperienceImagePath(`experience/another-user/hero/photo.jpg`, USER_ID)).toBe(false);
  expect(isOwnedExperienceImagePath(`experience/${USER_ID}/hero/../private.jpg`, USER_ID)).toBe(false);
  expect(isOwnedExperienceImagePath(`experience/${USER_ID}/avatar/photo.jpg`, USER_ID)).toBe(false);
});

test('uploads materialized bytes and cleans only pre-create partial uploads', () => {
  const pageSource = readFileSync(join(process.cwd(), 'app/host/create/page.tsx'), 'utf8');
  const cleanupSource = readFileSync(
    join(process.cwd(), 'app/api/host/experience-images/cleanup/route.ts'),
    'utf8'
  );

  expect(pageSource).toContain('materializeExperienceImage(file)');
  expect(pageSource).toContain("upload(fileName, bytes, {");
  expect(pageSource).toContain("contentType,");
  expect(pageSource).toContain("creationRequestStarted = true");
  expect(pageSource).toContain("if (!creationRequestStarted && uploadedPaths.length > 0)");
  expect(pageSource).toContain('await Promise.allSettled(');
  expect(pageSource).not.toContain('throw uploadError');

  expect(cleanupSource).toContain(".eq('host_id', actor.id)");
  expect(cleanupSource).toContain('!referencedContent.includes(path)');
  expect(cleanupSource).toContain('.remove(unreferencedPaths)');
});

test('WebKit-style partial upload rejects the empty file and requests cleanup for the successful file', async ({ page }) => {
  const supabaseUrl = await installMockHostSession(page);
  const storageUploads: string[] = [];
  const cleanupBodies: Array<{ paths?: string[] }> = [];
  const createRequests: string[] = [];

  await page.route(`${supabaseUrl}/storage/v1/object/experiences/**`, async (route) => {
    storageUploads.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Id: 'mock-object-id', Key: 'mock-object-key' }),
    });
  });
  await page.route('**/api/host/experience-images/cleanup', async (route) => {
    cleanupBodies.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"removed":1}' });
  });
  page.on('request', (request) => {
    if (request.url().includes('/api/host/experiences')) createRequests.push(request.url());
  });

  await page.goto('/host/create', { waitUntil: 'networkidle' });
  await page.evaluate(async ({ userId, formData }) => {
    const request = indexedDB.open('locally-host-experience-drafts', 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('drafts', 'readwrite');
    const now = Date.now();
    transaction.objectStore('drafts').put({
      userId,
      schemaVersion: 1,
      revision: 1,
      updatedAt: now,
      expiresAt: now + 30 * 24 * 60 * 60 * 1000,
      step: 7,
      formData,
      isCustomCity: true,
      tempInclusion: '',
      tempExclusion: '',
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, { userId: USER_ID, formData: createValidDraftForm() });

  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /続きから作成|Continue writing/ }).click();

  for (let step = 0; step < 4; step += 1) {
    await page
      .locator('footer')
      .getByRole('button', { name: /戻る|Back|이전|上一步/ })
      .evaluate((button) => (button as HTMLButtonElement).click());
  }

  const imageBuffer = readFileSync(join(process.cwd(), 'tests/e2e/test-image.png'));
  await page.locator('main input[type="file"][multiple]').setInputFiles([
    { name: 'valid.jpg', mimeType: 'image/jpeg', buffer: imageBuffer },
    { name: 'empty.jpg', mimeType: 'image/jpeg', buffer: imageBuffer },
  ]);
  await expect(page.locator('img[alt*="preview"]')).toHaveCount(2, { timeout: 15000 });

  await page.evaluate(() => {
    const originalArrayBuffer = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = function arrayBuffer() {
      if (this.name === 'empty.jpg') return Promise.resolve(new ArrayBuffer(0));
      return originalArrayBuffer.call(this);
    };
  });

  for (let step = 0; step < 4; step += 1) {
    await page
      .locator('footer')
      .getByRole('button', { name: /次へ|Next|다음|下一步/ })
      .evaluate((button) => (button as HTMLButtonElement).click());
  }

  await page
    .locator('footer')
    .getByRole('button', { name: /体験を登録する|Submit experience|체험 등록하기|提交体验/ })
    .evaluate((button) => (button as HTMLButtonElement).click());

  await expect(page.getByText(/写真データを読み取れませんでした/)).toBeVisible();
  await expect.poll(() => cleanupBodies.length).toBe(1);
  expect(storageUploads).toHaveLength(1);
  expect(cleanupBodies[0].paths).toHaveLength(1);
  expect(cleanupBodies[0].paths?.[0]).toContain(`experience/${USER_ID}/hero/`);
  expect(createRequests).toEqual([]);
});
