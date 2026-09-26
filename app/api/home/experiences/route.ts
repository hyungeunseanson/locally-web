import { NextResponse } from 'next/server';

import { getPublicHomeExperiences } from '@/app/home/homeExperienceData.server';

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
} as const;

export async function GET() {
  try {
    const { data } = await getPublicHomeExperiences();
    return NextResponse.json({ data }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error('[home/experiences] GET failed:', error);
    return NextResponse.json({ error: 'Failed to load home experiences.' }, { status: 500 });
  }
}
