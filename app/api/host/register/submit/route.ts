import { NextRequest, NextResponse } from 'next/server';

import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { getLanguageNames, normalizeLanguageLevels, type LanguageLevelEntry } from '@/app/utils/languageLevels';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type HostRegisterSubmitBody = {
  languageLevels?: unknown;
  languageCert?: unknown;
  name?: unknown;
  phone?: unknown;
  dob?: unknown;
  email?: unknown;
  instagram?: unknown;
  source?: unknown;
  profilePhoto?: unknown;
  selfIntro?: unknown;
  idCardFile?: unknown;
  hostNationality?: unknown;
  bankName?: unknown;
  accountNumber?: unknown;
  accountHolder?: unknown;
  motivation?: unknown;
};

type HostApplicationRow = {
  id: string;
  status: string | null;
};

type ProfileSeedRow = {
  full_name: string | null;
  avatar_url: string | null;
  languages: string[] | null;
};

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asNullableTrimmedString(value: unknown) {
  const normalized = asTrimmedString(value);
  return normalized || null;
}

function hasTextValue(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasLanguageValues(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => String(item).trim().length > 0);
}

function shouldNotifyAdmin(existingApplicationStatus: string | null, hasExistingApplication: boolean) {
  return (
    (!hasExistingApplication || existingApplicationStatus === 'revision' || existingApplicationStatus === 'rejected') &&
    (hasExistingApplication ? existingApplicationStatus !== 'approved' : true)
  );
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

    const body = (await request.json()) as HostRegisterSubmitBody;
    const languageLevels = normalizeLanguageLevels(body.languageLevels, [], 3);

    if (languageLevels.length < 1) {
      return NextResponse.json({ success: false, error: 'At least one language is required.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    const { data: latestApplication, error: latestApplicationError } = await supabaseAdmin
      .from('host_applications')
      .select('id, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<HostApplicationRow>();

    if (latestApplicationError) {
      throw latestApplicationError;
    }

    const languageNames = getLanguageNames(languageLevels);
    const nextStatus =
      latestApplication && latestApplication.status === 'approved'
        ? 'approved'
        : 'pending';

    const payload = {
      user_id: user.id,
      host_nationality: asTrimmedString(body.hostNationality),
      languages: languageNames,
      language_levels: languageLevels satisfies LanguageLevelEntry[],
      name: asTrimmedString(body.name),
      phone: asTrimmedString(body.phone),
      dob: asTrimmedString(body.dob),
      email: asTrimmedString(body.email),
      instagram: asTrimmedString(body.instagram),
      source: asTrimmedString(body.source),
      language_cert: asTrimmedString(body.languageCert),
      profile_photo: asNullableTrimmedString(body.profilePhoto),
      self_intro: asTrimmedString(body.selfIntro),
      id_card_file: asNullableTrimmedString(body.idCardFile),
      bank_name: asTrimmedString(body.bankName),
      account_number: asTrimmedString(body.accountNumber),
      account_holder: asTrimmedString(body.accountHolder),
      motivation: asTrimmedString(body.motivation),
      status: nextStatus,
    };

    let applicationId: string | null = latestApplication?.id ?? null;

    if (latestApplication) {
      const { error: updateError } = await supabaseAdmin
        .from('host_applications')
        .update(payload)
        .eq('id', latestApplication.id);

      if (updateError) {
        throw updateError;
      }
    } else {
      const { data: insertedApplication, error: insertError } = await supabaseAdmin
        .from('host_applications')
        .insert(payload)
        .select('id')
        .single();

      if (insertError || !insertedApplication?.id) {
        throw insertError ?? new Error('Failed to create host application.');
      }

      applicationId = String(insertedApplication.id);
    }

    const { data: currentProfile, error: profileLoadError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, avatar_url, languages')
      .eq('id', user.id)
      .maybeSingle<ProfileSeedRow>();

    if (profileLoadError) {
      throw profileLoadError;
    }

    const profileSeedUpdates: Record<string, unknown> = {};

    if (!hasTextValue(currentProfile?.full_name) && hasTextValue(body.name)) {
      profileSeedUpdates.full_name = asTrimmedString(body.name);
    }

    if (!hasTextValue(currentProfile?.avatar_url) && hasTextValue(body.profilePhoto)) {
      profileSeedUpdates.avatar_url = asTrimmedString(body.profilePhoto);
    }

    if (!hasLanguageValues(currentProfile?.languages) && languageNames.length > 0) {
      profileSeedUpdates.languages = languageNames;
    }

    if (Object.keys(profileSeedUpdates).length > 0) {
      const { error: profileSeedError } = await supabaseAdmin
        .from('profiles')
        .update(profileSeedUpdates)
        .eq('id', user.id);

      if (profileSeedError) {
        throw profileSeedError;
      }
    }

    const notifyAdmin = shouldNotifyAdmin(latestApplication?.status ?? null, Boolean(latestApplication));

    if (notifyAdmin && nextStatus === 'pending') {
      try {
        const applicantName = payload.name || user.email || '새 호스트';
        await insertAdminAlerts({
          title: '새 호스트 신청이 접수되었습니다',
          message: `${applicantName}님의 호스트 신청이 접수되었습니다.`,
          link: '/admin/dashboard?tab=APPROVALS',
        });
      } catch (notifyError) {
        console.error('Host Register Admin Alert Error:', notifyError);
      }
    }

    return NextResponse.json({
      success: true,
      applicationId,
      status: nextStatus,
      notifyAdmin,
    });
  } catch (error) {
    console.error('Host register submit route error:', error);
    const message = error instanceof Error ? error.message : 'Failed to submit host application.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
