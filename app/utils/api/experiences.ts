import type { Experience } from '../../types';

type HomeExperiencesResponse = {
  data?: Experience[];
};

export const fetchActiveExperiences = async (): Promise<Experience[]> => {
  const response = await fetch('/api/home/experiences', {
    cache: 'no-store',
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error('체험 데이터를 불러오는 데 실패했습니다.');
  }

  const payload = (await response.json()) as HomeExperiencesResponse;
  return Array.isArray(payload.data) ? payload.data : [];
};
