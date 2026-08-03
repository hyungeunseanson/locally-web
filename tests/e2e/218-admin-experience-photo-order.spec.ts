import fs from 'node:fs';

import { expect, test } from '@playwright/test';

import { getAdminExperienceReturnPath } from '@/app/utils/adminExperienceEditReturn';
import { getExperienceCardImageUrl } from '@/app/utils/experienceImages';
import {
  toPostgresTextArrayLiteral,
  validateExperiencePhotoReorder,
} from '@/app/utils/experiencePhotoOrder';

test.describe('Admin experience photo order contracts', () => {
  test('accepts only an exact reorder of the loaded photo set', () => {
    expect(validateExperiencePhotoReorder({
      currentPhotos: ['a.jpg', 'b.jpg', 'c.jpg'],
      expectedPhotos: ['a.jpg', 'b.jpg', 'c.jpg'],
      nextPhotos: ['c.jpg', 'a.jpg', 'b.jpg'],
      maxPhotos: 10,
    })).toMatchObject({ ok: true, nextPhotos: ['c.jpg', 'a.jpg', 'b.jpg'] });

    expect(validateExperiencePhotoReorder({
      currentPhotos: ['a.jpg', 'b.jpg'],
      expectedPhotos: ['a.jpg', 'b.jpg'],
      nextPhotos: ['a.jpg', 'new.jpg'],
      maxPhotos: 10,
    })).toMatchObject({ ok: false, status: 400 });

    expect(validateExperiencePhotoReorder({
      currentPhotos: ['a.jpg', 'b.jpg'],
      expectedPhotos: ['a.jpg', 'b.jpg'],
      nextPhotos: ['a.jpg', 'a.jpg'],
      maxPhotos: 10,
    })).toMatchObject({ ok: false, status: 400 });
  });

  test('blocks stale saves and safely serializes the Postgres array condition', () => {
    expect(validateExperiencePhotoReorder({
      currentPhotos: ['b.jpg', 'a.jpg'],
      expectedPhotos: ['a.jpg', 'b.jpg'],
      nextPhotos: ['b.jpg', 'a.jpg'],
      maxPhotos: 10,
    })).toMatchObject({ ok: false, status: 409 });

    expect(toPostgresTextArrayLiteral(['a.jpg', 'folder/with"quote.jpg', 'folder\\photo.jpg']))
      .toBe('{"a.jpg","folder/with\\"quote.jpg","folder\\\\photo.jpg"}');
  });

  test('keeps admin return navigation internal and experience-specific', () => {
    const expected = '/admin/dashboard?tab=EXPS&experienceId=42';
    expect(getAdminExperienceReturnPath(expected, '42')).toBe(expected);
    expect(getAdminExperienceReturnPath('https://evil.example/admin/dashboard?tab=EXPS', '42')).toBe(expected);
    expect(getAdminExperienceReturnPath('/host/dashboard?tab=experiences', '42')).toBe(expected);
    expect(getAdminExperienceReturnPath('/admin/dashboard?tab=USERS', '42')).toBe(expected);
    expect(getAdminExperienceReturnPath('/admin/dashboard?tab=EXPS&experienceId=99', '42')).toBe(expected);
  });

  test('uses photos[0] before the legacy image fallback', () => {
    expect(getExperienceCardImageUrl({
      photos: ['new-main.jpg', 'second.jpg'],
      card_image_url: 'cached-legacy.jpg',
      image_url: 'legacy.jpg',
    })).toBe('new-main.jpg');
    expect(getExperienceCardImageUrl({ photos: [], image_url: 'legacy.jpg' })).toBe('legacy.jpg');
  });

  test('keeps the API permission-only and the UI save explicit', () => {
    const routeSource = fs.readFileSync('app/api/admin/experiences/[id]/photos/route.ts', 'utf8');
    const detailsSource = fs.readFileSync('app/admin/dashboard/components/DetailsPanel.tsx', 'utf8');
    const editSource = fs.readFileSync('app/host/experiences/[id]/edit/page.tsx', 'utf8');
    const homeSource = fs.readFileSync('app/api/home/experiences/route.ts', 'utf8');

    expect(routeSource).toContain('resolveAdminAccess');
    expect(routeSource).toContain(".filter('photos', 'eq', currentPhotosLiteral)");
    expect(routeSource).toContain('UPDATE_EXPERIENCE_PHOTO_ORDER');
    expect(routeSource).not.toContain('image_url:');
    expect(routeSource).not.toContain("storage.from(");

    expect(detailsSource).toContain('admin-experience-photo-order-save');
    expect(detailsSource).toContain('expectedPhotos: photoBaseline');
    expect(detailsSource).toContain('대표로 설정');
    expect(detailsSource).not.toContain('draggable');

    expect(editSource).toContain("isAdminEditor ? '관리자 화면으로 돌아가기'");
    expect(editSource).toContain('{!isAdminEditor && <SiteHeader />}');
    expect(homeSource).toContain('experience.photos?.[0] ?? experience.image_url ?? null');
  });
});
