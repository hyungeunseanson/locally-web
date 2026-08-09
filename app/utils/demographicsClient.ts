import type { Demographics } from '@/app/utils/demographics';

type DemographicsResponse = {
  success?: boolean;
  demographics?: Demographics;
  error?: string;
};

async function readResponse(response: Response) {
  return response.json().catch(() => null) as Promise<DemographicsResponse | null>;
}

export async function fetchOwnDemographics(): Promise<Demographics> {
  const response = await fetch('/api/account/demographics', { cache: 'no-store' });
  const payload = await readResponse(response);
  if (!response.ok || !payload?.success || !payload.demographics) {
    throw new Error(payload?.error || 'Failed to load demographics');
  }
  return payload.demographics;
}

export async function saveOwnDemographics(demographics: Demographics): Promise<Demographics> {
  const response = await fetch('/api/account/demographics', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(demographics),
  });
  const payload = await readResponse(response);
  if (!response.ok || !payload?.success || !payload.demographics) {
    throw new Error(payload?.error || 'Failed to save demographics');
  }
  return payload.demographics;
}
