import { NextRequest, NextResponse } from 'next/server';

import type { HostRegisterSubmitErrorCode } from '@/app/host/register/localization';
import { insertAdminAlerts } from '@/app/utils/adminAlertCenter';
import { normalizeDateOfBirth } from '@/app/utils/dateOfBirth';
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
  languages: string[] | null;
};

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
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

function isLikelyPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

function normalizeAccountNumber(value: string): string {
  return value.replace(/\D/g, '');
}

function normalizeAllowedProfilePhoto(value: unknown): string | null | 'invalid' {
  const normalized = asTrimmedString(value);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return normalized;
    }
  } catch {
    return 'invalid';
  }

  return 'invalid';
}

function shouldNotifyAdmin(existingApplicationStatus: string | null, hasExistingApplication: boolean) {
  return (
    (!hasExistingApplication || existingApplicationStatus === 'revision' || existingApplicationStatus === 'rejected') &&
    (hasExistingApplication ? existingApplicationStatus !== 'approved' : true)
  );
}

function createErrorResponse(status: number, errorCode: HostRegisterSubmitErrorCode, error: string) {
  return NextResponse.json({ success: false, errorCode, error }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return createErrorResponse(401, 'unauthorized', 'Unauthorized');
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
    const normalizedProfilePhoto = normalizeAllowedProfilePhoto(body.profilePhoto);
    const normalizedDob = normalizeDateOfBirth(trimmedDob);

    if (normalizedProfilePhoto === 'invalid') {
      return createErrorResponse(400, 'invalid_profile_photo_url', 'Profile photo URL is invalid.');
    }

    if (!trimmedHostNationality) {
      return createErrorResponse(400, 'nationality_required', 'Nationality is required.');
    }

    if (languageLevels.length < 1) {
      return createErrorResponse(400, 'languages_required', 'At least one language is required.');
    }

    if (!trimmedName) {
      return createErrorResponse(400, 'name_required', 'Name is required.');
    }

    if (trimmedName.length < 2) {
      return createErrorResponse(400, 'name_too_short', 'Name must be at least 2 characters.');
    }

    if (!trimmedDob) {
      return createErrorResponse(400, 'dob_required', 'Date of birth is required.');
    }

    if (!normalizedDob) {
      return createErrorResponse(400, 'dob_invalid', 'Date of birth is invalid.');
    }

    if (!trimmedPhone) {
      return createErrorResponse(400, 'phone_required', 'Phone number is required.');
    }

    if (!isLikelyPhone(trimmedPhone)) {
      return createErrorResponse(400, 'phone_invalid', 'Phone number format is invalid.');
    }

    if (!trimmedEmail) {
      return createErrorResponse(400, 'email_required', 'Email is required.');
    }

    if (!isLikelyEmail(trimmedEmail)) {
      return createErrorResponse(400, 'email_invalid', 'Email format is invalid.');
    }

    if (!hasMinLength(body.selfIntro, 50)) {
      return createErrorResponse(400, 'self_intro_too_short', 'Self introduction must be at least 50 characters.');
    }

    if (!trimmedIdCardFile) {
      return createErrorResponse(400, 'id_card_required', 'ID card image is required.');
    }

    if (!trimmedBankName) {
      return createErrorResponse(400, 'bank_name_required', 'Bank name is required.');
    }

    if (trimmedBankName.length < 2) {
      return createErrorResponse(400, 'bank_name_too_short', 'Bank name must be at least 2 characters.');
    }

    if (!trimmedAccountNumber) {
      return createErrorResponse(400, 'account_number_required', 'Account number is required.');
    }

    if (!trimmedAccountHolder) {
      return createErrorResponse(400, 'account_holder_required', 'Account holder is required.');
    }

    if (trimmedAccountHolder.length < 2) {
      return createErrorResponse(400, 'account_holder_too_short', 'Account holder name must be at least 2 characters.');
    }

    if (!trimmedMotivation) {
      return createErrorResponse(400, 'motivation_required', 'Motivation is required.');
    }

    if (trimmedMotivation.length < 20) {
      return createErrorResponse(400, 'motivation_too_short', 'Motivation must be at least 20 characters.');
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
      dob: normalizedDob,
      email: trimmedEmail,
      instagram: asTrimmedString(body.instagram),
      source: asTrimmedString(body.source),
      language_cert: asTrimmedString(body.languageCert),
      profile_photo: normalizedProfilePhoto,
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
      .select('full_name, languages')
      .eq('id', user.id)
      .maybeSingle<ProfileSeedRow>();

    if (profileLoadError) {
      throw profileLoadError;
    }

    const profileSeedUpdates: Record<string, unknown> = {};

    if (!hasTextValue(currentProfile?.full_name) && hasTextValue(body.name)) {
      profileSeedUpdates.full_name = asTrimmedString(body.name);
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
    return createErrorResponse(500, 'unexpected_error', 'Failed to submit host application.');
  }
}
