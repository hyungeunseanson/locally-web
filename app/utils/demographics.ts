export const DEMOGRAPHIC_GENDERS = ['Male', 'Female', 'Other'] as const;

export type DemographicGender = (typeof DEMOGRAPHIC_GENDERS)[number];

export type Demographics = {
  birth_date: string | null;
  gender: DemographicGender | null;
};

export function isDemographicGender(value: unknown): value is DemographicGender {
  return typeof value === 'string' && DEMOGRAPHIC_GENDERS.includes(value as DemographicGender);
}

export function isValidBirthDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime())
    && date.toISOString().slice(0, 10) === value
    && value <= new Date().toISOString().slice(0, 10);
}

export function compactBirthDateToIso(value: string): string | null {
  if (!/^\d{8}$/.test(value)) return null;
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  return isValidBirthDate(iso) ? iso : null;
}

export function getMissingDemographics(value: Partial<Demographics> | null | undefined) {
  const missing: Array<keyof Demographics> = [];
  if (!value?.birth_date) missing.push('birth_date');
  if (!value?.gender) missing.push('gender');
  return missing;
}

export function isDemographicsComplete(value: Partial<Demographics> | null | undefined) {
  return getMissingDemographics(value).length === 0;
}

export function formatAgeBand(ageBand: string | null | undefined, locale: string): string | null {
  if (!ageBand) return null;
  if (ageBand === 'under_10') {
    if (locale === 'ko') return '10세 미만';
    if (locale === 'ja') return '10歳未満';
    if (locale === 'zh') return '10岁以下';
    return 'Under 10';
  }
  if (ageBand === '80_plus') {
    if (locale === 'ko') return '80대 이상';
    if (locale === 'ja') return '80代以上';
    if (locale === 'zh') return '80岁以上';
    return '80+';
  }
  const decade = ageBand.match(/^(\d{2})s$/)?.[1];
  if (!decade) return null;
  if (locale === 'ko') return `${decade}대`;
  if (locale === 'ja') return `${decade}代`;
  if (locale === 'zh') return `${decade}多岁`;
  return `${decade}s`;
}

export function formatDemographicGender(
  gender: DemographicGender | null | undefined,
  locale: string
): string | null {
  if (!gender) return null;
  const labels: Record<DemographicGender, Record<string, string>> = {
    Male: { ko: '남성', en: 'Male', ja: '男性', zh: '男性' },
    Female: { ko: '여성', en: 'Female', ja: '女性', zh: '女性' },
    Other: { ko: '기타', en: 'Other', ja: 'その他', zh: '其他' },
  };
  return labels[gender][locale] || labels[gender].en;
}
