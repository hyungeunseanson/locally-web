import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import {
  isDemographicGender,
  isValidBirthDate,
  type Demographics,
} from '@/app/utils/demographics';
import { readPrivateDemographics } from '@/app/utils/demographicsServer';

async function getAuthenticatedUser() {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return error ? null : user;
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();
  let demographics: Demographics;
  try {
    demographics = await readPrivateDemographics(supabaseAdmin, user.id);
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load demographics' }, { status: 500 });
  }

  return NextResponse.json({ success: true, demographics });
}

export async function PUT(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Partial<Demographics> | null;
  const birthDate = typeof body?.birth_date === 'string' ? body.birth_date.trim() : '';
  const gender = body?.gender;

  if (!birthDate || !isValidBirthDate(birthDate) || !isDemographicGender(gender)) {
    return NextResponse.json({ success: false, error: 'Invalid demographics' }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from('profile_private_demographics')
    .upsert({
      user_id: user.id,
      birth_date: birthDate,
      gender,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) {
    return NextResponse.json({ success: false, error: 'Failed to save demographics' }, { status: 500 });
  }

  const { error: notificationError } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('type', 'profile_demographics_required')
    .eq('is_read', false);

  if (notificationError) {
    console.warn('[account/demographics] reminder resolution failed');
  }

  return NextResponse.json({
    success: true,
    demographics: { birth_date: birthDate, gender },
  });
}
