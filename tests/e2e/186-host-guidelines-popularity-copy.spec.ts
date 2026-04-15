import { expect, test } from '@playwright/test';

import {
  createAuthUser,
  createTestUser,
  getTestAdminClient,
  login,
  type E2ETestUser,
} from './helpers/testSupabase';

const createdAuthUserIds: string[] = [];
const createdApplicationIds: number[] = [];

async function createApprovedHostApplication(userId: string, user: E2ETestUser) {
  const supabase = getTestAdminClient();
  const { data, error } = await supabase
    .from('host_applications')
    .insert({
      user_id: userId,
      host_nationality: '대한민국',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: user.fullName,
      phone: user.phone,
      dob: '1992-04-12',
      email: user.email,
      instagram: '@codex_host_guidelines',
      source: 'playwright',
      language_cert: '',
      profile_photo: '',
      self_intro: '호스트 가이드라인 인기 체험 안내 검증용 승인 호스트입니다.',
      id_card_file: '',
      bank_name: '국민은행',
      account_number: '12345678901234',
      account_holder: user.fullName,
      motivation: '가이드라인 인기 체험 안내 검증',
      status: 'approved',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to create approved host application.');
  }

  createdApplicationIds.push(Number(data.id));
}

test.afterAll(async () => {
  const supabase = getTestAdminClient();

  if (createdApplicationIds.length > 0) {
    await supabase.from('host_applications').delete().in('id', createdApplicationIds);
  }

  for (const userId of createdAuthUserIds) {
    await supabase.auth.admin.deleteUser(userId);
  }
});

test('host guidelines surfaces wishlist-based popular experience guidance', async ({ page }) => {
  const host = createTestUser('host.guidelines.popularity');
  const hostId = await createAuthUser(host);
  createdAuthUserIds.push(hostId);
  await createApprovedHostApplication(hostId, host);

  await login(page, host);
  await page.goto('/host/dashboard?tab=guidelines', { waitUntil: 'networkidle' });

  const popularityCard = page.getByTestId('host-guidelines-popularity-card');
  await expect(popularityCard).toBeVisible();
  await expect(
    popularityCard.getByText(
      /인기 체험 노출은 게스트의 위시리스트 저장 수를 바탕으로 집계됩니다\. 저장하고 싶은 체험이 되도록 사진, 소개, 후기 경험을 꾸준히 관리해보세요\.|Popular experience placement is based on how many times guests save your experience to their wishlist\. Keep improving your photos, description, and review experience so your experience becomes one guests want to save\.|人気体験の表示は、ゲストのウィッシュリスト保存数をもとに集計されます。保存したくなる体験になるよう、写真・紹介文・レビュー体験を継続的に整えてみてください。|热门体验展示会根据游客加入愿望清单的保存数量进行统计。请持续优化照片、介绍和评价体验，让你的体验成为游客愿意先收藏的内容。/
    )
  ).toBeVisible();
});
