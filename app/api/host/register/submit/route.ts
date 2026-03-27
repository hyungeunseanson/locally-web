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

function hasMinLength(value: unknown, minLength: number): boolean {
  return typeof value === 'string' && value.trim().length >= minLength;
}

function hasLanguageValues(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => String(item).trim().length > 0);
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isLikelyDob(value: string): boolean {
  return /^\d{4}[-./]\d{2}[-./]\d{2}$/.test(value);
}

function isLikelyPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

function normalizeAccountNumber(value: string): string {
  return value.replace(/\D/g, '');
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

    // [Guard] 이미 승인된 호스트가 재제출 시 승인 데이터 덮어쓰기 방지
    if (latestApplication?.status === 'approved') {
      return NextResponse.json({ success: true, applicationId: latestApplication.id, status: 'approved', notifyAdmin: false });
    }

    const languageLevels = normalizeLanguageLevels(body.languageLevels, [], 3);
    const trimmedHostNationality = asTrimmedString(body.hostNationality);
    const trimmedName = asTrimmedString(body.name);
    const trimmedDob = asTrimmedString(body.dob);
    const trimmedPhone = asTrimmedString(body.phone);
    const trimmedEmail = asTrimmedString(body.email);
    const trimmedSelfIntro = asTrimmedString(body.selfIntro);
    const trimmedIdCardFile = asTrimmedString(body.idCardFile);
    const trimmedBankName = asTrimmedString(body.bankName);
    const trimmedAccountNumber = normalizeAccountNumber(asTrimmedString(body.accountNumber));
    const trimmedAccountHolder = asTrimmedString(body.accountHolder);
    const trimmedMotivation = asTrimmedString(body.motivation);

    if (!trimmedHostNationality) {
      return NextResponse.json({ success: false, error: 'Nationality is required.' }, { status: 400 });
    }

    if (languageLevels.length < 1) {
      return NextResponse.json({ success: false, error: 'At least one language is required.' }, { status: 400 });
    }

    if (!trimmedName) {
      return NextResponse.json({ success: false, error: 'Name is required.' }, { status: 400 });
    }

    if (trimmedName.length < 2) {
      return NextResponse.json({ success: false, error: 'Name must be at least 2 characters.' }, { status: 400 });
    }

    if (!trimmedDob) {
      return NextResponse.json({ success: false, error: 'Date of birth is required.' }, { status: 400 });
    }

    if (!isLikelyDob(trimmedDob)) {
      return NextResponse.json({ success: false, error: 'Date of birth must use YYYY.MM.DD format.' }, { status: 400 });
    }

    if (!trimmedPhone) {
      return NextResponse.json({ success: false, error: 'Phone number is required.' }, { status: 400 });
    }

    if (!isLikelyPhone(trimmedPhone)) {
      return NextResponse.json({ success: false, error: 'Phone number format is invalid.' }, { status: 400 });
    }

    if (!trimmedEmail) {
      return NextResponse.json({ success: false, error: 'Email is required.' }, { status: 400 });
    }

    if (!isLikelyEmail(trimmedEmail)) {
      return NextResponse.json({ success: false, error: 'Email format is invalid.' }, { status: 400 });
    }

    if (!hasMinLength(body.selfIntro, 50)) {
      return NextResponse.json({ success: false, error: 'Self introduction must be at least 50 characters.' }, { status: 400 });
    }

    if (!trimmedIdCardFile) {
      return NextResponse.json({ success: false, error: 'ID card image is required.' }, { status: 400 });
    }

    if (!trimmedBankName) {
      return NextResponse.json({ success: false, error: 'Bank name is required.' }, { status: 400 });
    }

    if (trimmedBankName.length < 2) {
      return NextResponse.json({ success: false, error: 'Bank name must be at least 2 characters.' }, { status: 400 });
    }

    if (!trimmedAccountNumber) {
      return NextResponse.json({ success: false, error: 'Account number is required.' }, { status: 400 });
    }

    if (trimmedAccountNumber.length < 8) {
      return NextResponse.json({ success: false, error: 'Account number format is invalid.' }, { status: 400 });
    }

    if (!trimmedAccountHolder) {
      return NextResponse.json({ success: false, error: 'Account holder is required.' }, { status: 400 });
    }

    if (trimmedAccountHolder.length < 2) {
      return NextResponse.json({ success: false, error: 'Account holder name must be at least 2 characters.' }, { status: 400 });
    }

    if (!trimmedMotivation) {
      return NextResponse.json({ success: false, error: 'Motivation is required.' }, { status: 400 });
    }

    if (trimmedMotivation.length < 20) {
      return NextResponse.json({ success: false, error: 'Motivation must be at least 20 characters.' }, { status: 400 });
    }

    const languageNames = getLanguageNames(languageLevels);
    const nextStatus = 'pending';

    const payload = {
      user_id: user.id,
      host_nationality: trimmedHostNationality,
      languages: languageNames,
      language_levels: languageLevels satisfies LanguageLevelEntry[],
      name: trimmedName,
      phone: trimmedPhone,
      dob: trimmedDob,
      email: trimmedEmail,
      instagram: asTrimmedString(body.instagram),
      source: asTrimmedString(body.source),
      language_cert: asTrimmedString(body.languageCert),
      profile_photo: asNullableTrimmedString(body.profilePhoto),
      self_intro: trimmedSelfIntro,
      id_card_file: trimmedIdCardFile,
      bank_name: trimmedBankName,
      account_number: trimmedAccountNumber,
      account_holder: trimmedAccountHolder,
      motivation: trimmedMotivation,
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
        .maybeSingle();

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
