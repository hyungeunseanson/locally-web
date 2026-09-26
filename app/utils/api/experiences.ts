import type { PublicHomeExperience } from '@/app/home/homeExperienceTypes';

export const fetchActiveExperiences = async (): Promise<PublicHomeExperience[]> => {
  const response = await fetch('/api/home/experiences', {
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error('체험 데이터를 불러오는 데 실패했습니다.');
  }

  const payload = (await response.json()) as { data?: PublicHomeExperience[] };
  return payload.data ?? [];
};
