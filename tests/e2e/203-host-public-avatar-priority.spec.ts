import { expect, test } from '@playwright/test';

import { getHostPublicProfile } from '@/app/utils/profile';

test.describe('Host public avatar priority', () => {
  test('uses the host application photo before the account profile avatar', () => {
    const hostPublicProfile = getHostPublicProfile(
      {
        avatar_url: 'https://lh3.googleusercontent.com/a/default-google-avatar=s96-c',
        full_name: 'Account Name',
        introduction: 'Account introduction',
        languages: ['Korean'],
      },
      {
        name: 'Application Name',
        profile_photo: 'https://example.com/host-application-photo.png',
        self_intro: 'Application intro',
        languages: ['Japanese'],
      },
      'Host'
    );

    expect(hostPublicProfile).toMatchObject({
      name: 'Account Name',
      avatarUrl: 'https://example.com/host-application-photo.png',
      bio: 'Application intro',
      languages: ['Korean'],
    });
  });

  test('falls back to the account profile avatar when no host photo exists', () => {
    const hostPublicProfile = getHostPublicProfile(
      {
        avatar_url: 'https://example.com/account-avatar.png',
        full_name: 'Account Name',
      },
      {
        name: 'Application Name',
        profile_photo: null,
      },
      'Host'
    );

    expect(hostPublicProfile.avatarUrl).toBe('https://example.com/account-avatar.png');
  });
});
