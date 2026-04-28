import { NextRequest, NextResponse } from 'next/server';

import { normalizeProfileLanguageList } from '@/app/utils/profile';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type HostProfileUpdateBody = {
  fullName?: unknown;
  email?: unknown;
  job?: unknown;
  dreamDestination?: unknown;
  favoriteSong?: unknown;
  languages?: unknown;
  introduction?: unknown;
  avatarUrl?: unknown;
};

type HostApplicationRef = {
  id: string;
};

type SupabaseErrorLike = {
  code?: string;
};

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asNullableTrimmedString(value: unknown) {
  const normalized = asTrimmedString(value);
  return normalized || null;
}

function hasOwn(object: object, key: string) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeEmail(value: unknown) {
  return asTrimmedString(value).toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUniqueViolation(error: unknown) {
  const maybeError = error as SupabaseErrorLike | null;
  return maybeError?.code === '23505';
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

    const body = (await request.json()) as HostProfileUpdateBody;
    const supabaseAdmin = createAdminClient();

    const { data: latestApplication, error: latestApplicationError } = await supabaseAdmin
      .from('host_applications')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<HostApplicationRef>();

    if (latestApplicationError) {
      throw latestApplicationError;
    }

    if (!latestApplication?.id) {
      return NextResponse.json({ success: false, error: 'Host application not found' }, { status: 404 });
    }

    const emailProvided = hasOwn(body, 'email');
    const normalizedEmail = emailProvided ? normalizeEmail(body.email) : '';
    const MAX = { name: 80, email: 254, job: 80, place: 120, song: 120, url: 500, intro: 2000 };

    if (emailProvided) {
      if (!normalizedEmail) {
        return NextResponse.json({ success: false, error: 'Notification email is required.' }, { status: 400 });
      }

      if (normalizedEmail.length > MAX.email || !isValidEmail(normalizedEmail)) {
        return NextResponse.json({ success: false, error: 'Invalid notification email.' }, { status: 400 });
      }

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
        return NextResponse.json({ success: false, error: 'Notification email is already in use.' }, { status: 409 });
      }
    }

    const profileUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      full_name: asTrimmedString(body.fullName).slice(0, MAX.name),
      job: asNullableTrimmedString(body.job)?.slice(0, MAX.job) ?? null,
      dream_destination: asNullableTrimmedString(body.dreamDestination)?.slice(0, MAX.place) ?? null,
      favorite_song: asNullableTrimmedString(body.favoriteSong)?.slice(0, MAX.song) ?? null,
      languages: normalizeProfileLanguageList(body.languages),
      avatar_url: asNullableTrimmedString(body.avatarUrl)?.slice(0, MAX.url) ?? null,
    };

    if (emailProvided) {
      profileUpdates.email = normalizedEmail;
    }

    const hostApplicationUpdates: Record<string, unknown> = {
      self_intro: asTrimmedString(body.introduction).slice(0, MAX.intro),
    };

    if (emailProvided) {
      hostApplicationUpdates.email = normalizedEmail;
    }

    const profileUpdateRes = await supabaseAdmin
      .from('profiles')
      .update(profileUpdates)
      .eq('id', user.id);

    if (profileUpdateRes.error) {
      if (isUniqueViolation(profileUpdateRes.error)) {
        return NextResponse.json({ success: false, error: 'Notification email is already in use.' }, { status: 409 });
      }
      throw profileUpdateRes.error;
    }

    const hostApplicationUpdateRes = await supabaseAdmin
      .from('host_applications')
      .update(hostApplicationUpdates)
      .eq('id', latestApplication.id);

    if (hostApplicationUpdateRes.error) {
      throw hostApplicationUpdateRes.error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Host profile route error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save host profile.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
