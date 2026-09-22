import type { SupabaseClient } from '@supabase/supabase-js';

export type ExperiencePaymentProvider = 'nicepay' | 'portone' | 'paypal';

type RpcError = {
  code?: string | null;
  message?: string | null;
};

type ClaimRow = {
  outcome: 'claimed' | 'already_claimed' | 'claim_in_progress' | 'reconciliation_required';
  provider: ExperiencePaymentProvider;
  provider_reference: string | null;
  claim_expires_at: string | null;
  claim_token: string | null;
};

type AttachRow = {
  outcome: 'attached' | 'already_attached';
  provider_reference: string;
};

type CaptureRow = {
  outcome: 'capture_started' | 'already_processing' | 'already_completed';
  provider_reference: string;
  claim_expires_at: string | null;
};

type ConfirmationRow = {
  outcome: 'confirmed_now' | 'already_processed';
};

export class ExperiencePaymentContractError extends Error {
  readonly status: 400 | 403 | 404 | 409 | 500;
  readonly diagnosticCode: string;

  constructor(status: 400 | 403 | 404 | 409 | 500, diagnosticCode: string) {
    super('결제 상태를 안전하게 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.');
    this.name = 'ExperiencePaymentContractError';
    this.status = status;
    this.diagnosticCode = diagnosticCode;
  }
}

function asContractError(error: RpcError, fallbackCode: string) {
  const message = String(error.message || '');
  const diagnosticCode = message.match(/[A-Z][A-Z0-9_]+/)?.[0] || fallbackCode;
  const status = error.code === '42501'
    ? 403
    : error.code === 'P0002'
      ? 404
      : error.code === '22023'
        ? 400
        : error.code === 'P0001'
          ? 409
          : 500;
  return new ExperiencePaymentContractError(status, diagnosticCode);
}

export async function claimExperiencePaymentAtomic(params: {
  supabaseAdmin: SupabaseClient;
  bookingId: string;
  userId: string;
  provider: ExperiencePaymentProvider;
  providerReference?: string | null;
}) {
  const { data, error } = await params.supabaseAdmin
    .rpc('claim_experience_payment_atomic', {
      p_booking_id: params.bookingId,
      p_user_id: params.userId,
      p_provider: params.provider,
      p_provider_reference: params.providerReference || null,
    })
    .maybeSingle<ClaimRow>();

  if (error || !data) {
    throw asContractError(error || {}, 'PAYMENT_CLAIM_EMPTY_RESULT');
  }

  return {
    outcome: data.outcome,
    provider: data.provider,
    providerReference: data.provider_reference,
    claimExpiresAt: data.claim_expires_at,
    claimToken: data.claim_token,
  };
}

export async function attachExperiencePaymentProviderReferenceAtomic(params: {
  supabaseAdmin: SupabaseClient;
  bookingId: string;
  userId: string;
  providerReference: string;
  claimToken: string;
}) {
  const { data, error } = await params.supabaseAdmin
    .rpc('attach_experience_payment_provider_reference_atomic', {
      p_booking_id: params.bookingId,
      p_user_id: params.userId,
      p_provider_reference: params.providerReference,
      p_claim_token: params.claimToken,
    })
    .maybeSingle<AttachRow>();

  if (error || !data) {
    throw asContractError(error || {}, 'PAYMENT_REFERENCE_EMPTY_RESULT');
  }

  return {
    outcome: data.outcome,
    providerReference: data.provider_reference,
  };
}

export async function beginExperiencePaymentCaptureAtomic(params: {
  supabaseAdmin: SupabaseClient;
  bookingId: string;
  userId: string;
  providerReference: string;
}) {
  const { data, error } = await params.supabaseAdmin
    .rpc('begin_experience_payment_capture_atomic', {
      p_booking_id: params.bookingId,
      p_user_id: params.userId,
      p_provider_reference: params.providerReference,
    })
    .maybeSingle<CaptureRow>();

  if (error || !data) {
    throw asContractError(error || {}, 'PAYMENT_CAPTURE_EMPTY_RESULT');
  }

  return {
    outcome: data.outcome,
    providerReference: data.provider_reference,
    claimExpiresAt: data.claim_expires_at,
  };
}

export async function confirmExperiencePaymentAtomic(params: {
  supabaseAdmin: SupabaseClient;
  bookingId: string;
  provider: ExperiencePaymentProvider;
  providerReference: string;
  providerTransactionId: string;
  verifiedAmount: number;
}) {
  const { data, error } = await params.supabaseAdmin
    .rpc('confirm_experience_payment_atomic', {
      p_booking_id: params.bookingId,
      p_provider: params.provider,
      p_provider_reference: params.providerReference,
      p_provider_transaction_id: params.providerTransactionId,
      p_verified_amount: params.verifiedAmount,
    })
    .maybeSingle<ConfirmationRow>();

  if (error || !data) {
    throw asContractError(error || {}, 'PAYMENT_CONFIRM_EMPTY_RESULT');
  }

  return data.outcome;
}

export async function confirmExperienceBankPaymentAtomic(params: {
  supabaseAdmin: SupabaseClient;
  bookingId: string;
}) {
  const { data, error } = await params.supabaseAdmin
    .rpc('confirm_experience_bank_payment_atomic', {
      p_booking_id: params.bookingId,
    })
    .maybeSingle<ConfirmationRow>();

  if (error || !data) {
    throw asContractError(error || {}, 'BANK_CONFIRM_EMPTY_RESULT');
  }

  return data.outcome;
}
