import type { DemographicGender } from '@/app/utils/demographics';

export type PublicDemographics = {
  age_band: string | null;
  gender: DemographicGender | null;
};

export async function fetchPublicDemographics(userId: string): Promise<PublicDemographics | null> {
  try {
    const response = await fetch(`/api/public/profiles/${encodeURIComponent(userId)}/demographics`);
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success || !payload.demographics) return null;
    return payload.demographics as PublicDemographics;
  } catch {
    return null;
  }
}
