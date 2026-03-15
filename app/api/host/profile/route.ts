import { NextRequest, NextResponse } from 'next/server';

import { normalizeLanguageList } from '@/app/utils/profile';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type HostProfileUpdateBody = {
  fullName?: unknown;
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

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asNullableTrimmedString(value: unknown) {
  const normalized = asTrimmedString(value);
  return normalized || null;
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

    const profileUpdates = {
      updated_at: new Date().toISOString(),
      full_name: asTrimmedString(body.fullName),
      job: asNullableTrimmedString(body.job),
      dream_destination: asNullableTrimmedString(body.dreamDestination),
      favorite_song: asNullableTrimmedString(body.favoriteSong),
      languages: normalizeLanguageList(body.languages),
      avatar_url: asNullableTrimmedString(body.avatarUrl),
    };

    const [profileUpdateRes, hostApplicationUpdateRes] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .update(profileUpdates)
        .eq('id', user.id),
      supabaseAdmin
        .from('host_applications')
        .update({ self_intro: asTrimmedString(body.introduction) })
        .eq('id', latestApplication.id),
    ]);

    if (profileUpdateRes.error) {
      throw profileUpdateRes.error;
    }

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
