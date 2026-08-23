import { expect, test } from '@playwright/test';
import { hasRemoteMatch } from 'next/dist/shared/lib/match-remote-pattern';

import nextConfig from '../../next.config';

const remotePatterns = nextConfig.images?.remotePatterns ?? [];

test.describe('Kakao avatar image configuration', () => {
  test('allows both stored HTTP and HTTPS img1 Kakao profile URLs', () => {
    expect(
      hasRemoteMatch([], remotePatterns, new URL('http://img1.kakaocdn.net/example/avatar.jpg'))
    ).toBe(true);
    expect(
      hasRemoteMatch([], remotePatterns, new URL('https://img1.kakaocdn.net/example/avatar.jpg'))
    ).toBe(true);
  });

  test('preserves existing profile and storage image hosts', () => {
    const existingImageUrls = [
      'https://images.unsplash.com/photo.jpg',
      'https://lh3.googleusercontent.com/avatar.jpg',
      'http://k.kakaocdn.net/avatar.jpg',
      'https://k.kakaocdn.net/avatar.jpg',
      'http://t1.kakaocdn.net/avatar.jpg',
      'https://t1.kakaocdn.net/avatar.jpg',
      'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/images/avatar.jpg',
    ];

    for (const imageUrl of existingImageUrls) {
      expect(hasRemoteMatch([], remotePatterns, new URL(imageUrl))).toBe(true);
    }
  });

  test('continues to reject arbitrary remote image hosts', () => {
    expect(
      hasRemoteMatch([], remotePatterns, new URL('https://example.com/avatar.jpg'))
    ).toBe(false);
  });
});
