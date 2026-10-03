import type { ExperienceLocale, ExperienceSourceTranslationContent } from './index';

export type IntegrityOutcome = 'VALID' | 'REVIEW_REQUIRED' | 'CLEAR_LANGUAGE_MISMATCH';
export type IntegrityIssue = {
  locale: ExperienceLocale;
  field: string;
  outcome: Exclude<IntegrityOutcome, 'VALID'>;
  risk: 'high' | 'medium';
  reason: 'foreign_instruction' | 'foreign_sentence' | 'mixed_business_text' | 'uncertain_script';
};
export type IntegrityContent = Partial<ExperienceSourceTranslationContent> & {
  title?: string;
  description?: string;
};

// No model, dictionary service, DB or public-render dependency. These are evidence
// signals, not a general language detector; Han-only place names are ambiguous.
const JP_ENDING = /(?:ください|下さい|しましょう|ましょう|します|しますので|できます|ございます|ません|ですよ|(?:です|ます)(?=[。！？!?\s]|$)|お願いします|ご持参|ご用意|ご集合|ご参加|お越し)/u;
const KO_ENDING = /(?:하세요|해요|합니다|드립니다|입니다|주세요|있습니다|없습니다|가능합니다|만나요|준비해|부탁드|추천드)/u;
const ZH_ENDING = /(?:请(?:您|携带|准备|穿|在|注意|提前)|我们(?:会|将|一起)|可以(?:在|选择|参加)|不包含|费用自理|恕不退款)/u;
const EN_SENTENCE = /\b(?:please (?:bring|wear|meet|arrive)|we (?:will|can|meet)|you (?:can|must|will)|the (?:tour|experience) (?:includes|starts|ends)|is (?:included|required))\b/i;
const JP_AGE = /(?:満\s*)?\d+\s*歳\s*(?:以上|以下|未満|から)/u;
const KO_AGE = /(?:만\s*)?\d+\s*세\s*(?:이상|이하|미만|부터)/u;
const ZH_AGE = /\d+\s*(?:周岁|周歲|岁|歲)\s*(?:以上|以下|及以上)/u;
const JP_BUSINESS = /(?:歩きやすい(?:靴|服装)|個人の(?:交通費|飲食代)|ツアー(?:料金|費用|参加費|代)|ホスト(?:案内|による案内)|写真(?:撮影|スポット紹介)|交通費|食事代|飲食費|食費|通訳料|大人同伴|年齢制限|相撲像の前)/u;
const KO_BUSINESS = /(?:걷기 편한 신발|개인 교통비|식비|식사비|통역료|투어 (?:요금|비용)|사진 촬영|성인 동반|연령 제한)/u;
const HAN_ONLY_BUSINESS = /^(?:交通費|食費|食事代|飲食費|通訳料|参加費)$/u;
const ACTIVITY_ENUMS = new Set(['보통', '가벼움', '높음']);

function risk(field: string, value: string): 'high' | 'medium' {
  if (/(?:age_limit|host_notice|meetingPoint|inclusions|exclusions)/.test(field)) return 'high';
  const itineraryInstruction = field.startsWith('itinerary[')
    && /(?:ください|ご持参|ご集合|お越し|주세요|하세요|부탁드|请|\bplease\b|\bmust\b)/iu.test(value);
  return itineraryInstruction ? 'high' : 'medium';
}

export function classifyExperienceText(locale: ExperienceLocale, field: string, value: string): IntegrityIssue | null {
  if (!value.trim()) return null;
  const fieldRisk = risk(field, value);
  const operational = fieldRisk === 'high' || field === 'supplies';
  const hangul = (value.match(/[가-힣]/gu) ?? []).length;
  const kana = (value.match(/[ぁ-ゖァ-ヺ]/gu) ?? []).length;
  const han = (value.match(/[一-龥]/gu) ?? []).length;
  const latin = (value.match(/[a-z]/gi) ?? []).length;
  const letters = hangul + kana + han + latin;
  const jpSentence = kana >= 3 && JP_ENDING.test(value);
  const koSentence = hangul >= 6 && KO_ENDING.test(value);
  const zhSentence = han >= 8 && ZH_ENDING.test(value);
  const enSentence = latin >= 20 && EN_SENTENCE.test(value);
  // A bare Han cost word is shared/ambiguous with Chinese: never reject ZH
  // merely for it. Age units + comparison, or kana + operational vocabulary,
  // provide independent high-confidence signals in the other targets.
  const jpInstruction = JP_AGE.test(value)
    || (operational && JP_BUSINESS.test(value) && (kana >= 1 || (locale !== 'zh' && HAN_ONLY_BUSINESS.test(value.trim()))));
  const koInstruction = KO_AGE.test(value) || (operational && hangul >= 3 && KO_BUSINESS.test(value));
  const zhInstruction = ZH_AGE.test(value) && locale !== 'ja';
  const foreignJP = locale !== 'ja' && (jpSentence || jpInstruction);
  const foreignKO = locale !== 'ko' && (koSentence || koInstruction);
  const foreignZH = locale !== 'zh' && zhSentence && !kana;
  const foreignEN = locale !== 'en' && enSentence && latin / Math.max(letters, 1) > 0.8;
  if (foreignJP || foreignKO || foreignZH || foreignEN || (locale !== 'zh' && zhInstruction)) {
    // A translated/quoted expression in descriptive prose can intentionally
    // contain a sentence in another language. Keep ambiguous glosses reviewable.
    if (!operational && /(?:라는 (?:말|표현)|일본어로|라는 뜻|\bmeans?\b|意思是)/iu.test(value)
      && (hangul > 0 || latin > 0 || locale === 'zh')) {
      return { locale, field, risk: fieldRisk, outcome: 'REVIEW_REQUIRED', reason: 'uncertain_script' };
    }
    // Business text in two languages is not silently deduplicated. Two strong
    // language signals, not the presence of an isolated foreign proper noun.
    const mixed = (jpSentence || jpInstruction) && (koSentence || koInstruction);
    return { locale, field, risk: fieldRisk, outcome: 'CLEAR_LANGUAGE_MISMATCH',
      reason: mixed ? 'mixed_business_text' : operational ? 'foreign_instruction' : 'foreign_sentence' };
  }
  const foreignDominant = (locale !== 'ko' && hangul >= 8 && hangul / Math.max(letters, 1) > 0.7)
    || (locale !== 'ja' && kana >= 12 && (kana + han) / Math.max(letters, 1) > 0.8);
  return foreignDominant ? { locale, field, risk: fieldRisk, outcome: 'REVIEW_REQUIRED', reason: 'uncertain_script' } : null;
}

// Retained manual body maps must be complete before receiving a fresh ready
// stamp. Check actual target leaves, never the public reader's source fallback.
export function findMissingExperienceBodyFields(
  source: ExperienceSourceTranslationContent,
  target: ExperienceSourceTranslationContent
): string[] {
  const missing: string[] = [];
  const check = (field: string, sourceValue: string, targetValue: string | undefined) => {
    if (sourceValue.trim() && !targetValue?.trim()) missing.push(field);
  };
  check('meetingPoint', source.meetingPoint, target.meetingPoint);
  check('supplies', source.supplies, target.supplies);
  for (const field of ['inclusions', 'exclusions'] as const) {
    if (source[field].length > 0 && source[field].length !== target[field].length) missing.push(field);
    source[field].forEach((value, index) => check(`${field}[${index}]`, value, target[field][index]));
  }
  if (source.itinerary.length > 0 && source.itinerary.length !== target.itinerary.length) missing.push('itinerary');
  source.itinerary.forEach((item, index) => {
    check(`itinerary[${index}].title`, item.title, target.itinerary[index]?.title);
    check(`itinerary[${index}].description`, item.description, target.itinerary[index]?.description);
  });
  for (const field of ['age_limit', 'activity_level', 'host_notice'] as const) {
    check(`rules.${field}`, source.rules[field], target.rules[field]);
  }
  if (source.rules.refund_policy_id) {
    if (target.rules.refund_policy_id !== source.rules.refund_policy_id) missing.push('rules.refund_policy_id');
  } else {
    check('rules.refund_policy', source.rules.refund_policy, target.rules.refund_policy);
  }
  return missing;
}

export function inspectExperienceLocale(locale: ExperienceLocale, content: IntegrityContent) {
  const issues: IntegrityIssue[] = [];
  const check = (field: string, value: string | undefined) => {
    const issue = classifyExperienceText(locale, field, value ?? '');
    if (issue) issues.push(issue);
  };
  check('title', content.title);
  check('description', content.description);
  check('meetingPoint', content.meetingPoint);
  check('supplies', content.supplies);
  for (const field of ['inclusions', 'exclusions'] as const) {
    const items = content[field] ?? [];
    items.forEach((value, index) => check(`${field}[${index}]`, value));
    if (items.some(value => /[가-힣]{2}/u.test(value)) && items.some(value => /[ァ-ヺ]{3}/u.test(value))) {
      issues.push({ locale, field, risk: 'high', outcome: 'REVIEW_REQUIRED', reason: 'mixed_business_text' });
    }
  }
  content.itinerary?.forEach((item, index) => {
    check(`itinerary[${index}].title`, item.title);
    check(`itinerary[${index}].description`, item.description);
    // Never inspect image URLs, image pixels, UGC or structural type keys.
  });
  if (content.rules) {
    check('rules.age_limit', content.rules.age_limit);
    check('rules.host_notice', content.rules.host_notice);
    if (!ACTIVITY_ENUMS.has(content.rules.activity_level)) check('rules.activity_level', content.rules.activity_level);
    if (!content.rules.refund_policy_id) check('rules.refund_policy', content.rules.refund_policy);
  }
  return { outcome: issues.some(i => i.outcome === 'CLEAR_LANGUAGE_MISMATCH')
    ? 'CLEAR_LANGUAGE_MISMATCH' as const : issues.length ? 'REVIEW_REQUIRED' as const : 'VALID' as const, issues };
}
