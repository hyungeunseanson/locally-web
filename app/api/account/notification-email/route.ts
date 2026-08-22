import { NextRequest, NextResponse } from 'next/server';

import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type NotificationEmailUpdateBody = {
  email?: unknown;
};

type SupabaseErrorLike = {
  code?: string;
};

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUniqueViolation(error: unknown) {
  return (error as SupabaseErrorLike | null)?.code === '23505';
}

export async function POST(request: NextRequest) {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as NotificationEmailUpdateBody;
    const normalizedEmail = normalizeEmail(body.email);

    if (!normalizedEmail) {
      return NextResponse.json(
        { success: false, error: 'Notification email is required.' },
        { status: 400 }
      );
    }

    if (normalizedEmail.length > 254 || !isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        { success: false, error: 'Invalid notification email.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: duplicateProfile, error: duplicateProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('email', normalizedEmail)
      .neq('id', user.id)
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (duplicateProfileError) {
      throw duplicateProfileError;
    }

    if (duplicateProfile?.id) {
      return NextResponse.json(
        { success: false, error: 'Notification email is already in use.' },
        { status: 409 }
      );
    }

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        email: normalizedEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('email')
      .maybeSingle<{ email: string | null }>();

    if (updateError) {
      if (isUniqueViolation(updateError)) {
        return NextResponse.json(
          { success: false, error: 'Notification email is already in use.' },
          { status: 409 }
        );
      }
      throw updateError;
    }

    if (!updatedProfile) {
      return NextResponse.json({ success: false, error: 'Profile not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      notificationEmail: updatedProfile.email || normalizedEmail,
    });
  } catch (error) {
    console.error('Account notification email route error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save notification email.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
