import { NextResponse } from 'next/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { getAgeBandFromBirthDate } from '@/app/utils/demographics';
import { readPrivateDemographics } from '@/app/utils/demographicsServer';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  if (!UUID_PATTERN.test(userId)) {
    return NextResponse.json({ success: false, error: 'Invalid user' }, { status: 400 });
  }

  try {
    const demographics = await readPrivateDemographics(createAdminClient(), userId);
    return NextResponse.json({
      success: true,
      demographics: {
        age_band: getAgeBandFromBirthDate(demographics.birth_date),
        gender: demographics.gender,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to load public profile demographics' },
      { status: 500 }
    );
  }
}
