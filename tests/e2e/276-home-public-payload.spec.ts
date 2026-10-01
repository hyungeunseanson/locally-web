import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, test } from '@playwright/test';
import * as visibility from '../../app/utils/hostVisibility';
import { getExperienceCardImageUrl } from '../../app/utils/experienceImages';
import { isPublicExperienceR2Eligible } from '../../app/utils/publicExperienceMediaKeys';
import { PUBLIC_EXPERIENCE_CARD_SELECT_FIELDS } from '../../app/search/searchContract';
import { HOME_SEARCH_DATE_ENABLED } from '../../app/home/homeSearchConfig';
import type { PublicHomeExperience } from '../../app/home/homeExperienceTypes';

const imageFallback = 'https://images.unsplash.com/photo-1542051841857-5f90071e7989';
const experience = {
  id: 1, host_id: 'visible', status: 'active', is_active: true,
  title: 'Seoul', title_ko: '서울', title_en: 'Seoul tour', title_ja: 'ソウル', title_zh: '首尔',
  category: '문화 체험', category_en: 'Culture', category_ja: '文化', category_zh: '文化',
  city: '서울', country: 'South Korea', location: 'Seoul', languages: ['Korean', 'English'],
  photos: ['primary.jpg', 'secondary.jpg'], image_url: 'legacy.jpg',
  price: 12000, duration: 2, rating: 4.8, review_count: 4, created_at: '2026-09-01',
};

// Evaluate the actual loader with injected read-only clients. This tests both
// sides of the build-time flag without toggling application files or a database.
function loader(dateEnabled: boolean, overrides: Record<string, unknown> = {}, failure?: string, production = false) {
  const reads: Array<{ source: string; select?: string; gte?: [string, string] }> = [];
  const sources: Record<string, unknown[]> = {
    public_host_applications: [
      { id: 1, user_id: 'visible', status: 'approved', created_at: '2026-09-01' },
      { id: 2, user_id: 'private', status: 'approved', created_at: '2026-08-01' },
      { id: 3, user_id: 'private', status: 'rejected', created_at: '2026-09-01' },
    ],
    experiences: [
      { ...experience, ...overrides },
      { ...experience, id: 2, is_active: false },
      { ...experience, id: 3, host_id: 'private' },
    ],
    experience_availability: [
      { experience_id: 1, date: '2099-10-01' },
      { experience_id: 3, date: '2099-10-02' },
    ],
    experience_popularity_snapshot: [{ experience_id: 1, wishlist_count: 7 }],
  };
  let cacheOptions: { revalidate: number } | undefined;
  let cacheKeys: string[] | undefined;
  const evaluated = { exports: {} as { getPublicHomeExperiences: () => Promise<{ data: PublicHomeExperience[] }> } };
  const code = ts.transpileModule(readFileSync('app/home/homeExperienceData.server.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, {
    module: evaluated, exports: evaluated.exports, console: { warn() {} },
    process: { env: { NODE_ENV: production ? 'production' : 'test', NEXT_PUBLIC_SUPABASE_URL: 'http://fixture.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon' } },
    require(name: string) {
      if (name === 'server-only') return {};
      if (name === './homeSearchConfig') return { HOME_SEARCH_DATE_ENABLED: dateEnabled };
      if (name.endsWith('/hostVisibility')) return visibility;
      if (name.endsWith('/searchContract')) return { PUBLIC_EXPERIENCE_CARD_SELECT_FIELDS };
      if (name.endsWith('/publicExperienceMediaKeys')) return { isPublicExperienceR2Eligible };
      if (name.endsWith('/experienceImages')) return { getExperienceCardImageUrl };
      if (name === 'next/cache') return {
        unstable_cache(fn: () => Promise<unknown>, keys: string[], options: { revalidate: number }) {
          cacheKeys = keys; cacheOptions = options;
          let cached: unknown;
          return async () => { if (cached === undefined) cached = await fn(); return cached; };
        },
      };
      if (name === '@supabase/supabase-js') return {
        createClient(url: string, key: string) {
          expect(url).toBe('http://fixture.invalid'); expect(key).toBe('fixture-anon');
          return { from(source: string) {
            const read = { source } as typeof reads[number];
            const query = {
              select(value: string) { read.select = value; return query; },
              eq() { return query; }, order() { return query; }, limit() { return query; },
              gte(field: string, value: string) { read.gte = [field, value]; return query; },
              then(resolve: (value: unknown) => unknown) {
                reads.push(read);
                return Promise.resolve({ data: source === failure ? null : sources[source], error: source === failure ? new Error('fixture unavailable') : null }).then(resolve);
              },
            };
            return query;
          } };
        },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { get: evaluated.exports.getPublicHomeExperiences, reads, cache: () => ({ keys: cacheKeys, options: cacheOptions }) };
}

test('date OFF reads three sources and omits server-only fields while preserving public content', async () => {
  expect(HOME_SEARCH_DATE_ENABLED).toBe(false);
  const app = loader(false);
  const { data } = await app.get();
  expect(app.reads.map(({ source }) => source).sort()).toEqual(['experiences', 'experience_popularity_snapshot', 'public_host_applications'].sort());
  expect(app.reads.find(({ source }) => source === 'public_host_applications')?.select).not.toContain('is_superhost');
  expect(data).toHaveLength(1);
  for (const field of ['host_id', 'status', 'is_active', 'is_superhost', 'photos', 'image_url', 'available_dates']) expect(data[0]).not.toHaveProperty(field);
  for (const [field, value] of Object.entries(experience)) {
    if (!['host_id', 'status', 'is_active', 'photos', 'image_url'].includes(field)) expect(data[0]).toHaveProperty(field, value);
  }
  expect(data[0]).toMatchObject({ card_image_url: 'primary.jpg', wishlist_count: 7, public_image_r2_eligible: true });
});

test('date ON queries availability and restores the dates field in a separate 300s cache entry', async () => {
  const app = loader(true, {}, undefined, true);
  const { data } = await app.get();
  expect(app.reads).toHaveLength(4);
  expect(app.reads.find(({ source }) => source === 'experience_availability')?.gte).toEqual(['date', new Date().toISOString().slice(0, 10)]);
  expect(data[0].available_dates).toEqual(['2099-10-01']);
  expect(app.cache()).toEqual({ keys: ['public-home-experiences-v1', 'date-on'], options: { revalidate: 300 } });
  await app.get(); expect(app.reads).toHaveLength(4);
  const off = loader(false, {}, undefined, true);
  await off.get(); await off.get();
  expect(off.reads).toHaveLength(3);
  expect(off.cache()).toEqual({ keys: ['public-home-experiences-v1', 'date-off'], options: { revalidate: 300 } });
});

for (const [name, overrides, expected] of [
  ['primary photo', { photos: ['primary.jpg', 'second.jpg'], image_url: 'legacy.jpg' }, 'primary.jpg'],
  ['image URL only', { photos: [], image_url: 'legacy.jpg' }, 'legacy.jpg'],
  ['blank photo', { photos: ['  '], image_url: ' legacy.jpg ' }, 'legacy.jpg'],
  ['trimmed photo', { photos: [' primary.jpg '], image_url: 'legacy.jpg' }, 'primary.jpg'],
  ['missing image', { photos: [], image_url: null }, imageFallback],
] as const) {
  test(`slim Home preserves the ${name} image`, async () => {
    const { data } = await loader(false, overrides).get();
    expect(data[0].card_image_url).toBe(expected);
    expect(getExperienceCardImageUrl(data[0])).toBe(expected);
  });
}

test('availability failures are irrelevant OFF and fail closed ON', async () => {
  expect((await loader(false, {}, 'experience_availability').get()).data).toHaveLength(1);
  await expect(loader(true, {}, 'experience_availability').get()).rejects.toThrow('fixture unavailable');
});

test('popularity failure keeps zero-count cards without caching the degraded snapshot', async () => {
  const app = loader(false, {}, 'experience_popularity_snapshot', true);
  expect((await app.get()).data[0].wishlist_count).toBe(0);
  await app.get(); expect(app.reads).toHaveLength(6);
});

test('Home filter imports the same date flag and keeps optional date filtering', () => {
  const source = readFileSync('app/hooks/useExperienceFilter.ts', 'utf8');
  expect(source).toContain("import { HOME_SEARCH_DATE_ENABLED } from '@/app/home/homeSearchConfig'");
  expect(source).not.toContain('const HOME_SEARCH_DATE_ENABLED');
  expect(source).toContain('HOME_SEARCH_DATE_ENABLED && dateRange.start');
  expect(source).toContain('item.available_dates?.some');
});
