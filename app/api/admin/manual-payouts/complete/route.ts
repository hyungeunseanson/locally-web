import { NextResponse } from 'next/server';

import type { AdminManualPayoutType } from '@/app/types/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { recordAuditLog, createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type CompleteBody = {
  requestKey?: string;
  hostId?: string;
  settlementType?: AdminManualPayoutType;
  expectedCurrentBookingAmount?: number;
  legacyAmount?: number;
  reason?: string;
  legacySourceReference?: string;
  transferReference?: string;
};

type CompleteResult = {
  manual_payout_id: string;
  request_key: string;
  host_id: string;
  booking_count: number;
  current_booking_amount: number;
  legacy_amount: number;
  total_paid_amount: number;
  paid_at: string;
};

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
    if (authError || !user || !user.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
      userId: user.id,
      email: user.email,
    });
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as CompleteBody;
    const settlementType = body.settlementType;
    const expectedAmount = Number(body.expectedCurrentBookingAmount);
    const legacyAmount = Number(body.legacyAmount ?? 0);
    const reason = body.reason?.trim() || '';
    const transferReference = body.transferReference?.trim() || '';
    const legacySourceReference = body.legacySourceReference?.trim() || null;

    if (!body.requestKey || !body.hostId) {
      return NextResponse.json({ success: false, error: '필수 식별값이 누락되었습니다.' }, { status: 400 });
    }
    if (settlementType !== 'host_exit_final' && settlementType !== 'legacy_carryover') {
      return NextResponse.json({ success: false, error: '수동 정산 유형이 올바르지 않습니다.' }, { status: 400 });
    }
    if (!Number.isInteger(expectedAmount) || expectedAmount <= 0 || !Number.isInteger(legacyAmount) || legacyAmount < 0) {
      return NextResponse.json({ success: false, error: '정산 금액이 올바르지 않습니다.' }, { status: 400 });
    }
    if (!reason || !transferReference) {
      return NextResponse.json({ success: false, error: '정산 사유와 이체 참조값은 필수입니다.' }, { status: 400 });
    }
    if (reason.length > 1000 || transferReference.length > 500 || (legacySourceReference?.length ?? 0) > 500) {
      return NextResponse.json({ success: false, error: '정산 사유 또는 참조값이 너무 깁니다.' }, { status: 400 });
    }
    if (settlementType === 'host_exit_final' && legacyAmount !== 0) {
      return NextResponse.json({ success: false, error: '활동 종료 정산에는 legacy 금액을 입력할 수 없습니다.' }, { status: 400 });
    }
    if (settlementType === 'legacy_carryover' && (legacyAmount <= 0 || !legacySourceReference)) {
      return NextResponse.json({ success: false, error: 'legacy 이월액과 출처가 필요합니다.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc('complete_admin_manual_experience_payout_atomic', {
      p_request_key: body.requestKey,
      p_host_id: body.hostId,
      p_settlement_type: settlementType,
      p_expected_current_booking_amount: expectedAmount,
      p_legacy_amount: legacyAmount,
      p_reason: reason,
      p_legacy_source_reference: legacySourceReference,
      p_transfer_reference: transferReference,
      p_paid_by_admin_id: user.id,
      p_paid_by_admin_email: user.email,
    });

    if (error) {
      const isConflict =
        error.code === 'P0001' ||
        /변경|동시|재사용|기존 일반 정산|미정산액이 없습니다/.test(error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: isConflict ? 409 : 400 }
      );
    }

    const result = ((data || [])[0] || null) as CompleteResult | null;
    if (!result) {
      throw new Error('수동 정산 결과를 확인하지 못했습니다.');
    }

    await recordAuditLog({
      admin_id: user.id,
      admin_email: user.email,
      action_type: 'ADMIN_MANUAL_FINAL_PAYOUT',
      target_type: 'admin_manual_payouts',
      target_id: result.manual_payout_id,
      details: {
        request_key: result.request_key,
        host_id: result.host_id,
        settlement_type: settlementType,
        booking_count: result.booking_count,
        current_booking_amount: result.current_booking_amount,
        legacy_amount: result.legacy_amount,
        total_paid_amount: result.total_paid_amount,
        transfer_reference: transferReference,
      },
    });

    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    console.error('[ADMIN] manual payout completion error:', error);
    const message = error instanceof Error ? error.message : '수동 정산 처리 중 오류가 발생했습니다.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
