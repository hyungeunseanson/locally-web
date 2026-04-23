import { expect, test } from '@playwright/test';

import {
  getVisiblePublicHostIdSet,
  isLatestPublicHostApplication,
  isPublicExperienceVisible,
  isPublicHostApplicationStatus,
  pickLatestPublicHostApplication,
} from '@/app/utils/hostVisibility';

test.describe('Public host visibility helpers', () => {
  test('selects the latest host application by created_at and id tie-breaker', () => {
    const latest = pickLatestPublicHostApplication([
      {
        id: '00000000-0000-0000-0000-000000000001',
        user_id: 'host-a',
        created_at: '2026-04-23T09:00:00.000Z',
        status: 'approved',
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        user_id: 'host-a',
        created_at: '2026-04-23T10:00:00.000Z',
        status: 'revision',
      },
      {
        id: '00000000-0000-0000-0000-000000000004',
        user_id: 'host-a',
        created_at: '2026-04-23T10:00:00.000Z',
        status: 'pending',
      },
    ]);

    expect(latest?.id).toBe('00000000-0000-0000-0000-000000000004');
    expect(isLatestPublicHostApplication({ id: latest?.id }, latest)).toBe(true);
    expect(isLatestPublicHostApplication({ id: null }, { id: null })).toBe(false);
  });

  test('treats only approved or active latest host applications as public', () => {
    expect(isPublicHostApplicationStatus('approved')).toBe(true);
    expect(isPublicHostApplicationStatus('active')).toBe(true);
    expect(isPublicHostApplicationStatus('revision')).toBe(false);
    expect(isPublicHostApplicationStatus('pending')).toBe(false);

    const visibleHostIds = getVisiblePublicHostIdSet([
      {
        id: 'host-a-old',
        user_id: 'host-a',
        created_at: '2026-04-23T09:00:00.000Z',
        status: 'approved',
      },
      {
        id: 'host-a-new',
        user_id: 'host-a',
        created_at: '2026-04-23T10:00:00.000Z',
        status: 'revision',
      },
      {
        id: 'host-b-new',
        user_id: 'host-b',
        created_at: '2026-04-23T10:00:00.000Z',
        status: 'approved',
      },
    ]);

    expect(visibleHostIds.has('host-a')).toBe(false);
    expect(visibleHostIds.has('host-b')).toBe(true);
  });

  test('treats only active and not explicitly inactive experiences as public', () => {
    expect(isPublicExperienceVisible({ status: 'active', is_active: true })).toBe(true);
    expect(isPublicExperienceVisible({ status: 'active', is_active: null })).toBe(true);
    expect(isPublicExperienceVisible({ status: 'active', is_active: false })).toBe(false);
    expect(isPublicExperienceVisible({ status: 'revision', is_active: true })).toBe(false);
    expect(isPublicExperienceVisible(null)).toBe(false);
  });
});
