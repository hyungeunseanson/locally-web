import './helpers/serverOnlyTestShim';
import { expect, test } from '@playwright/test';
import { classifyExperienceText, inspectExperienceLocale } from '@/app/utils/experienceTranslation/integrity';
import { FIXED_EXPERIENCE_POLICY_ID, buildManualContentFromExperience, getLocalizedExperienceList, getLocalizedExperienceRules, getLocalizedExperienceItinerary, getLocalizedRefundPolicyLabel } from '@/app/utils/experienceTranslation';
import { FIXED_REFUND_POLICY } from '@/app/host/create/config';
import { buildExperienceWritePayload, type ExperienceFormState } from '@/app/host/create/experienceFormState';
import { getLanguageNames, normalizeLanguageLevels } from '@/app/utils/languageLevels';
import { getContent } from '@/app/utils/contentHelper';
import { createExperienceFromBody, updateExperienceFromBody, toApiErrorResponse, type ExperienceWriteDependencies } from '@/app/api/host/experiences/shared';

// Synthetic/minimal language patterns, no Production row or host data.
const actor = { id: 'fixture-host', email: null, isAdmin: true };
function body() {
  return { country: '일본', city: '도쿄', category: 'walking', source_locale: 'ko',
    manual_locales: ['ko'], language_levels: [{ language: 'ko', level: 5 }],
    manual_content: { ko: { title: '도쿄 골목 산책 체험', description: '현지 호스트와 함께 도쿄의 골목을 천천히 둘러보며 지역의 일상을 만나보세요.' } },
    photos: ['https://example.test/photo.jpg'], location: '東京都', meeting_point: '高円寺駅',
    itinerary: [{ title: '만남', description: '역에서 만나요.', type: 'meet', image_url: '' }],
    inclusions: ['현지 가이드'], exclusions: [], supplies: '', duration: 2, maxGuests: 4, price: 50000,
    rules: { age_limit: '만 20세 이상', activity_level: '보통', host_notice: '', refund_policy: 'client literal is ignored' } };
}
function harness(existing?: Record<string, unknown>, conflict = false) {
  const writes: Record<string, unknown>[] = [];
  const filters: Array<[string, unknown]> = [];
  let queries = 0, queues = 0;
  const query = {
    select() { return this; }, eq(column: string, value: unknown) { filters.push([column, value]); return this; },
    insert(value: Record<string, unknown>) { writes.push(value); return this; },
    update(value: Record<string, unknown>) { writes.push(value); return this; },
    async maybeSingle() { return { data: writes.length ? (conflict ? null : { id: 1, status: 'pending' }) : existing, error: null }; },
  };
  const dependencies = {
    createAdminClient: () => ({ from() { queries++; return query; } }),
    scheduleMediaProducer: () => ({ status: 'disabled' }), scheduleTranslationProducer: () => ({ status: 'disabled' }),
    enqueueTranslationJob: async () => { queues++; }, markTranslationQueueFailure: async () => undefined,
    insertAdminAlerts: async () => undefined, sendAdminAlertEmails: async () => undefined,
  } as unknown as ExperienceWriteDependencies;
  return { dependencies, writes, filters, get queries() { return queries; }, get queues() { return queues; } };
}

async function pendingManualBodyFixture() {
  const value = {
    ...body(),
    language_levels: [{ language: 'ko', level: 5 }, { language: 'en', level: 5 }, { language: 'ja', level: 5 }],
    manual_content: {
      ko: body().manual_content.ko,
      en: { title: 'Tokyo neighborhood walk', description: 'Walk through Tokyo neighborhoods with a local host and discover everyday places.' },
      ja: { title: '東京の街歩き体験', description: '地元のホストと一緒に東京の街を歩きながら、日常の風景を楽しみましょう。' },
    },
  };
  const created = harness();
  await createExperienceFromBody(value, actor, created.dependencies);
  const existing = { ...created.writes[0], id: 1, host_id: actor.id, status: 'pending', media_revision: 3 };
  const edited = { ...value, manual_content: { ...value.manual_content,
    ko: { ...value.manual_content.ko, title: '새로운 도쿄 골목 산책 체험' } } };
  return { value, existing, edited };
}

for (const [field, value] of [
  ['rules.age_limit', '20歳以上'], ['supplies', '歩きやすい靴をご持参ください。'],
  ['exclusions[0]', '個人の交通費'], ['rules.host_notice', '雨の場合は中止します。'],
] as const) test(`KO rejects strong operational mismatch: ${field}`, () => {
  expect(classifyExperienceText('ko', field, value)?.outcome).toBe('CLEAR_LANGUAGE_MISMATCH');
});
for (const [locale, field, value] of [
  ['ko', 'meetingPoint', '高円寺駅'], ['ko', 'description', 'PARCO에서 쇼핑하고 카페에서 쉬어가요.'],
  ['en', 'description', 'We meet outside アイスクリーム角屋 before our walk.'],
  ['ko', 'meetingPoint', '東京都渋谷区神南1丁目2-3'], ['ko', 'title', '鎌倉'],
  ['en', 'meetingPoint', '渋谷駅ハチ公前'], ['ko', 'title', 'JR PARCO Vespa'],
  ['ko', 'description', '숲 이름은 糺の森입니다.'], ['zh', 'inclusions[0]', '交通費'],
  ['ja', 'description', '高円寺で一緒に散歩しましょう。'],
] as const) test(`allows proper nouns and normal text: ${locale}/${value}`, () => {
  expect(classifyExperienceText(locale, field, value)?.outcome ?? 'VALID').not.toBe('CLEAR_LANGUAGE_MISMATCH');
});
test('ZH Japanese paragraph and KO bilingual business duplicates are detected', () => {
  expect(classifyExperienceText('zh', 'description', 'ソウルの街を一緒に巡ります。好きなカフェをご案内します。')?.outcome).toBe('CLEAR_LANGUAGE_MISMATCH');
  expect(classifyExperienceText('ko', 'rules.host_notice', '雨の場合は中止します。 비가 오면 취소합니다.')?.reason).toBe('mixed_business_text');
  expect(inspectExperienceLocale('ko', { inclusions: ['ドリンク', '드링크'] }).outcome).toBe('REVIEW_REQUIRED');
});
test('empty optional content and activity enum remain valid', () => {
  expect(inspectExperienceLocale('ja', { supplies: '', exclusions: [], rules: { age_limit: '20歳以上', activity_level: '보통', host_notice: '', refund_policy: '', refund_policy_id: FIXED_EXPERIENCE_POLICY_ID } }).outcome).toBe('VALID');
});
test('clear source mismatch is a field-addressable 400 before any DB or queue write', async () => {
  const h = harness(); const value = body(); value.rules.age_limit = '20歳以上';
  try { await createExperienceFromBody(value, actor, h.dependencies); throw Error('expected rejection'); }
  catch (error) { const response = toApiErrorResponse(error); expect(response.status).toBe(400); expect(await response.json()).toMatchObject({ code: 'EXPERIENCE_LOCALE_MISMATCH', issues: [{ field: 'rules.age_limit' }] }); }
  expect(h.queries).toBe(0); expect(h.queues).toBe(0); expect(h.writes).toEqual([]);
});
test('manual ZH Japanese description cannot become manual ready', async () => {
  const h = harness(); const value = { ...body(), manual_content: { ...body().manual_content, zh: { title: '首尔街头漫步旅行', description: 'ソウルは楽しい街です。現地のホストと一緒に歩きましょう。カフェをご案内します。' } }, manual_locales: ['ko', 'zh'] };
  await expect(createExperienceFromBody(value, actor, h.dependencies)).rejects.toThrow('zh');
  expect(h.queries).toBe(0);
});
test('normal create uses one existing experience insert; policy is a semantic ID, not client text', async () => {
  const h = harness(); await createExperienceFromBody(body(), actor, h.dependencies);
  expect(h.queries).toBe(1); expect(h.queues).toBe(1);
  expect(h.writes[0]).toMatchObject({ rules: { refund_policy: '', refund_policy_id: FIXED_EXPERIENCE_POLICY_ID }, rules_i18n: { ko: { refund_policy: '', refund_policy_id: FIXED_EXPERIENCE_POLICY_ID } } });
  expect(getLocalizedRefundPolicyLabel('ja')).toContain('返金');
});
test('uncertain mixed labels return review warnings without blocking or deleting manual source text', async () => {
  const h = harness(); const value = { ...body(), inclusions: ['ドリンク', '드링크'] };
  const result = await createExperienceFromBody(value, actor, h.dependencies);
  expect(result.localeIntegrityWarnings).toContainEqual(expect.objectContaining({ locale: 'ko', field: 'inclusions', outcome: 'REVIEW_REQUIRED' }));
  expect(h.writes[0]).toMatchObject({ inclusions: value.inclusions, translation_meta: { ko: { status: 'ready' } } });
});
test('legacy literal policy converts once on a host edit through the existing version and queue path', async () => {
  const created = harness(); await createExperienceFromBody(body(), actor, created.dependencies);
  const legacyRules = { age_limit: '만 20세 이상', activity_level: '보통', host_notice: '', refund_policy: '기존 고정 환불 정책' };
  const h = harness({ ...created.writes[0], id: 1, host_id: actor.id, rules: legacyRules, rules_i18n: { ko: legacyRules } });
  const result = await updateExperienceFromBody({ experienceId: 1, actor, body: { ...body(), price: 60000 } }, h.dependencies);
  expect(h.queries).toBe(2); expect(h.queues).toBe(1);
  expect(result.queuedLocales).toEqual(['en', 'ja', 'zh']);
  expect(h.writes[0]).toMatchObject({ translation_version: 2, rules_i18n: { ko: { refund_policy_id: FIXED_EXPERIENCE_POLICY_ID, refund_policy: '' } } });
});
test('update validates merged manual content before recertifying ready, with only the existing read', async () => {
  const created = harness(); await createExperienceFromBody(body(), actor, created.dependencies);
  const existing = { ...created.writes[0], id: 1, host_id: actor.id, translation_version: 3,
    manual_locales: ['ko', 'zh'], title_zh: '首尔街头漫步旅行', description_zh: 'ソウルの街を歩きましょう。楽しい場所をご案内します。' };
  const h = harness(existing); const value = body(); value.supplies = '편한 신발';
  await expect(updateExperienceFromBody({ experienceId: 1, actor, body: value }, h.dependencies)).rejects.toThrow('zh');
  expect(h.queries).toBe(1); expect(h.writes).toEqual([]); expect(h.queues).toBe(0);
});
test('valid update retains existing read/write count and rejects later wrong-language body', async () => {
  const created = harness(); await createExperienceFromBody(body(), actor, created.dependencies);
  const existing = { ...created.writes[0], id: 1, host_id: actor.id };
  const h = harness(existing); await updateExperienceFromBody({ experienceId: 1, actor, body: { ...body(), price: 60000 } }, h.dependencies);
  expect(h.queries).toBe(2); expect(h.queues).toBe(0);
  const bad = harness(existing); const value = body(); value.supplies = '歩きやすい靴をご持参ください。';
  await expect(updateExperienceFromBody({ experienceId: 1, actor, body: value }, bad.dependencies)).rejects.toThrow('supplies');
  expect(bad.writes).toHaveLength(0);
});
test('Phase 3 contract: failed/missing targets still fall back; partial rules merge, nonempty itinerary/list do not', () => {
  const row = { title: 'Source title', title_en: null, translation_meta: { en: { status: 'failed' } },
    inclusions: ['原文'], inclusions_i18n: {}, itinerary: [{ title: '原文', description: '説明' }], itinerary_i18n: {},
    rules: { age_limit: '20歳以上', host_notice: '原文' }, rules_i18n: { en: { host_notice: 'Translated notice' } } };
  expect(getContent(row, 'title', 'en')).toBe('Source title');
  expect(getLocalizedExperienceList(row, 'inclusions', 'en')).toEqual(['原文']);
  expect(getLocalizedExperienceItinerary(row, 'en')[0].title).toBe('原文');
  expect(getLocalizedExperienceRules(row, 'en')).toMatchObject({ age_limit: '20歳以上', host_notice: 'Translated notice' });
  expect(getLocalizedExperienceList({ ...row, inclusions_i18n: { en: ['Only translated item'] } }, 'inclusions', 'en')).toEqual(['Only translated item']);
  expect(getLocalizedExperienceItinerary({ ...row, itinerary_i18n: { en: [{ title: 'Translated', description: '' }] } }, 'en')[0].description).toBe('');
});

test('manual body retained on a text-only update is checked before a new ready stamp', async () => {
  const created = harness(); await createExperienceFromBody(body(), actor, created.dependencies);
  const existing = { ...created.writes[0], id: 1, host_id: actor.id, manual_locales: ['ko', 'ja'],
    title_ja: '東京の街歩き体験', description_ja: '東京の街を一緒に歩きましょう。', supplies_i18n: { ja: '편한 신발을 준비해 주세요.' } };
  const h = harness(existing); const value = body(); value.manual_content.ko.title = '변경된 도쿄 산책 체험';
  await expect(updateExperienceFromBody({ experienceId: 1, actor, body: value }, h.dependencies)).rejects.toThrow('ja');
  expect(h.queries).toBe(1); expect(h.writes).toHaveLength(0);
});
test('ambiguous descriptive glosses and a shop name are not hard-blocked', () => {
  expect(classifyExperienceText('ko', 'description', '일본어로 お待ちください라는 말은 기다려 달라는 뜻입니다.')?.outcome).toBe('REVIEW_REQUIRED');
  expect(classifyExperienceText('ko', 'meetingPoint', 'ます寿司のお店')).toBeNull();
});
test('itinerary instructions carry higher risk than descriptive prose', () => {
  expect(classifyExperienceText('ko', 'itinerary[0].description', 'ここは静かな公園です。')?.risk).toBe('medium');
  expect(classifyExperienceText('ko', 'itinerary[0].description', '駅の前でお待ちください。')?.risk).toBe('high');
});
test('missing retained manual body cannot receive a fresh ready stamp; complete body can', async () => {
  const created = harness(); await createExperienceFromBody(body(), actor, created.dependencies);
  const existing = { ...created.writes[0], id: 1, host_id: actor.id, manual_locales: ['ko', 'ja'],
    title_ja: '東京の街歩き体験', description_ja: '東京の街を一緒に歩きましょう。' };
  const value = body(); value.manual_content.ko.title = '변경된 도쿄 산책 체험';
  const missing = harness(existing);
  await expect(updateExperienceFromBody({ experienceId: 1, actor, body: value }, missing.dependencies)).rejects.toThrow('번역 본문이 누락');
  expect(missing.queries).toBe(1); expect(missing.writes).toHaveLength(0); expect(missing.queues).toBe(0);
  const complete = harness({ ...existing, meeting_point_i18n: { ja: '高円寺駅' }, inclusions_i18n: { ja: ['現地ガイド'] },
    itinerary_i18n: { ja: [{ title: '集合', description: '駅でお会いします。', type: 'meet', image_url: '' }] },
    rules_i18n: { ja: { age_limit: '20歳以上', activity_level: '普通', refund_policy: '', refund_policy_id: FIXED_EXPERIENCE_POLICY_ID, host_notice: '' } } });
  await updateExperienceFromBody({ experienceId: 1, actor, body: value }, complete.dependencies);
  expect(complete.queries).toBe(2);
  expect(complete.writes[0]).toMatchObject({ translation_meta: { ja: { mode: 'manual', status: 'ready' } } });
  expect(complete.writes[0]).not.toHaveProperty('itinerary_i18n');
});

test('pending admin Korean title edit preserves incomplete English and Japanese bodies without new ready states', async () => {
  const { existing, edited } = await pendingManualBodyFixture();
  const h = harness(existing);
  const result = await updateExperienceFromBody({ experienceId: 1, actor, body: edited }, h.dependencies);
  expect(result.incompleteManualLocales).toEqual(['en', 'ja']);
  expect(result.manualLocalesNeedingReview).toEqual([]);
  expect(result.queuedLocales).toEqual(['zh']);
  expect(h.writes).toHaveLength(1);
  expect(h.writes[0]).toEqual({
    title: edited.manual_content.ko.title,
    title_ko: edited.manual_content.ko.title,
    translation_version: 2,
    translation_meta: {
      ko: { mode: 'manual', status: 'ready', version: 2 },
      en: { mode: 'manual', status: 'failed', version: 2 },
      ja: { mode: 'manual', status: 'failed', version: 2 },
      zh: { mode: 'ai', status: 'queued', version: 2 },
    },
  });
  expect(h.filters).toContainEqual(['media_revision', 3]);
  expect(h.filters).toContainEqual(['status', 'pending']);
  expect(h.filters).toContainEqual(['translation_version', 1]);
  expect(h.queues).toBe(1);
});

test('anonymized 4839-shaped edit form PATCH reaches the title-only write path', async () => {
  const { existing } = await pendingManualBodyFixture();
  const base = existing as Record<string, unknown>;
  const levels = [
    { language: '한국어', level: 4 }, { language: '영어', level: 1 }, { language: '일본어', level: 5 },
  ];
  const itinerary = [
    { title: '만남 장소', description: '호스트와 만납니다.', type: 'meet', image_url: 'https://example.test/stop.jpg' },
    { title: '첫 장소', description: '동네를 둘러봅니다.', type: 'spot', image_url: '' },
    { title: '둘째 장소', description: '함께 산책합니다.', type: 'spot', image_url: '' },
  ];
  const stored = {
    ...existing,
    country: 'Japan', city: '오사카', category: '맛집 탐방',
    language_levels: levels, languages: getLanguageNames(normalizeLanguageLevels(levels, [], 3)),
    photos: ['https://example.test/one.jpg', 'https://example.test/two.jpg', 'https://example.test/three.jpg'],
    itinerary, itinerary_i18n: { ko: itinerary, zh: itinerary },
    meeting_point_i18n: { ko: base.meeting_point, zh: base.meeting_point },
    rules_i18n: { ko: base.rules, zh: base.rules },
    duration: 3, max_guests: 10, price: '50000', private_price: '120000',
    solo_guarantee_price: 30000, is_private_enabled: true, media_revision: 3,
  };
  const manualContent = buildManualContentFromExperience(stored, ['ko', 'en', 'ja'], 'ko');
  const form = {
    ...stored,
    subCity: '',
    manual_content: { ...manualContent, ko: { ...manualContent.ko, title: '수정한 오사카 골목 산책 체험' } },
    rules: { ...(base.rules as Record<string, unknown>), refund_policy: FIXED_REFUND_POLICY },
    language_levels: normalizeLanguageLevels(stored.language_levels, stored.languages, 3),
    itinerary: stored.itinerary.map(item => ({ ...item, image_url: item.image_url || '' })),
  } as unknown as ExperienceFormState;
  const patch = buildExperienceWritePayload({
    ...form,
    inclusions: form.inclusions.map(item => item.trim()).filter(Boolean),
    exclusions: form.exclusions.map(item => item.trim()).filter(Boolean),
    duration: Number(form.duration),
    maxGuests: Number(stored.max_guests),
    meeting_point: form.meeting_point || form.itinerary[0].title,
  });
  const h = harness(stored);
  const result = await updateExperienceFromBody({ experienceId: 1, actor, body: patch }, h.dependencies);
  expect(result.incompleteManualLocales).toEqual(['en', 'ja']);
  expect(result.manualLocalesNeedingReview).toEqual([]);
  expect(h.writes).toHaveLength(1);
  expect(Object.keys(h.writes[0]).sort()).toEqual(['title', 'title_ko', 'translation_meta', 'translation_version']);
  expect(h.writes[0].translation_version).toBe(2);
  expect(h.queues).toBe(1);
});

test('a complete retained manual translation is not certified against the new Korean title', async () => {
  const { existing, edited } = await pendingManualBodyFixture();
  const complete = {
    ...existing,
    meeting_point_i18n: { ko: (existing as Record<string, unknown>).meeting_point, en: 'Koenji Station', ja: '高円寺駅' },
    inclusions_i18n: { en: ['Local guide'], ja: ['現地ガイド'] },
    itinerary_i18n: {
      en: [{ title: 'Meet', description: 'Meet at the station.', type: 'meet', image_url: '' }],
      ja: [{ title: '集合', description: '駅でお会いします。', type: 'meet', image_url: '' }],
    },
    rules_i18n: {
      en: { age_limit: 'Ages 20 and over', activity_level: 'Moderate', refund_policy: '', refund_policy_id: FIXED_EXPERIENCE_POLICY_ID, host_notice: '' },
      ja: { age_limit: '20歳以上', activity_level: '普通', refund_policy: '', refund_policy_id: FIXED_EXPERIENCE_POLICY_ID, host_notice: '' },
    },
  };
  const h = harness(complete);
  const result = await updateExperienceFromBody({ experienceId: 1, actor, body: edited }, h.dependencies);
  expect(result.incompleteManualLocales).toEqual([]);
  expect(result.manualLocalesNeedingReview).toEqual(['en', 'ja']);
  expect(h.writes[0]).not.toHaveProperty('meeting_point_i18n');
  expect(h.writes[0]).not.toHaveProperty('title_en');
  expect((h.writes[0].translation_meta as Record<string, { status: string }>).en.status).toBe('failed');
  expect((h.writes[0].translation_meta as Record<string, { status: string }>).ja.status).toBe('failed');
});

test('title-only save separates complete translations needing review from missing bodies', async () => {
  const { existing, edited } = await pendingManualBodyFixture();
  const h = harness({
    ...existing,
    meeting_point_i18n: { en: 'Koenji Station' },
    inclusions_i18n: { en: ['Local guide'] },
    itinerary_i18n: { en: [{ title: 'Meet', description: 'Meet at the station.', type: 'meet', image_url: '' }] },
    rules_i18n: { en: { age_limit: 'Ages 20 and over', activity_level: 'Moderate', refund_policy: '', refund_policy_id: FIXED_EXPERIENCE_POLICY_ID, host_notice: '' } },
  });
  const result = await updateExperienceFromBody({ experienceId: 1, actor, body: edited }, h.dependencies);
  expect(result.incompleteManualLocales).toEqual(['ja']);
  expect(result.manualLocalesNeedingReview).toEqual(['en']);
  expect((h.writes[0].translation_meta as Record<string, { status: string }>).en.status).toBe('failed');
  expect((h.writes[0].translation_meta as Record<string, { status: string }>).ja.status).toBe('failed');
});

test('pending title exception does not cover price, body, locale, host, or published edits', async () => {
  const { existing, edited } = await pendingManualBodyFixture();
  for (const changed of [
    { ...edited, price: edited.price + 1000 },
    { ...edited, language_levels: edited.language_levels.slice(0, 2) },
  ]) {
    const h = harness(existing);
    await expect(updateExperienceFromBody({ experienceId: 1, actor, body: changed }, h.dependencies))
      .rejects.toThrow('번역 본문이 누락');
    expect(h.writes).toHaveLength(0);
  }
  const changedBody = { ...edited, rules: { ...edited.rules, age_limit: '만 19세 이상' } };
  const ordinaryPath = harness(existing);
  const ordinaryResult = await updateExperienceFromBody({ experienceId: 1, actor, body: changedBody }, ordinaryPath.dependencies);
  expect(ordinaryResult.incompleteManualLocales).toEqual([]);
  expect(ordinaryResult.queuedLocales).toEqual(['en', 'ja', 'zh']);
  expect(ordinaryPath.writes[0]).toHaveProperty('rules_i18n');
  for (const [changedActor, changedExisting] of [
    [{ ...actor, isAdmin: false }, existing],
    [actor, { ...existing, status: 'active' }],
  ] as const) {
    const h = harness(changedExisting);
    await expect(updateExperienceFromBody({ experienceId: 1, actor: changedActor, body: edited }, h.dependencies))
      .rejects.toThrow('번역 본문이 누락');
    expect(h.writes).toHaveLength(0);
  }
});

test('title-only queue failure keeps incomplete manual locales failed', async () => {
  const { existing, edited } = await pendingManualBodyFixture();
  const h = harness(existing);
  const dependencies = { ...h.dependencies,
    enqueueTranslationJob: async () => { throw new Error('queue unavailable'); },
  } as ExperienceWriteDependencies;
  await updateExperienceFromBody({ experienceId: 1, actor, body: edited }, dependencies);
  expect(h.writes).toHaveLength(2);
  expect((h.writes[1].translation_meta as Record<string, { status: string }>).en.status).toBe('failed');
  expect((h.writes[1].translation_meta as Record<string, { status: string }>).ja.status).toBe('failed');
  expect((h.writes[1].translation_meta as Record<string, { status: string }>).zh.status).toBe('failed');
});

test('a concurrent translation version change stops the title update before enqueue', async () => {
  const { existing, edited } = await pendingManualBodyFixture();
  const h = harness(existing, true);
  await expect(updateExperienceFromBody({ experienceId: 1, actor, body: edited }, h.dependencies))
    .rejects.toThrow('새로고침 후 다시 저장');
  expect(h.filters).toContainEqual(['translation_version', 1]);
  expect(h.queues).toBe(0);
});
for (const locale of ['ja', 'zh'] as const) test(`new ${locale} source stores no Korean fixed-policy literal`, async () => {
  const ja = locale === 'ja';
  const h = harness(); const value = { ...body(), source_locale: locale, manual_locales: [locale],
    language_levels: [{ language: locale, level: 5 }], manual_content: { [locale]: {
      title: ja ? '東京の街を巡る散歩体験' : '一起漫步东京街头体验当地生活',
      description: ja ? '東京の街を一緒にゆっくり歩きながら、おすすめのカフェや静かな路地をご案内します。' : '我们将一起漫步东京的街道，探索当地的咖啡馆和安静的小巷，感受这座城市的日常生活。' } },
    itinerary: [{ title: ja ? '集合' : '集合', description: '', type: 'meet', image_url: '' }],
    inclusions: [ja ? '案内' : '导览'], rules: { ...body().rules, age_limit: ja ? '20歳以上' : '20岁以上' } };
  await createExperienceFromBody(value, actor, h.dependencies);
  expect(h.writes[0]).toMatchObject({ rules_i18n: { [locale]: { refund_policy: '', refund_policy_id: FIXED_EXPERIENCE_POLICY_ID } } });
});
