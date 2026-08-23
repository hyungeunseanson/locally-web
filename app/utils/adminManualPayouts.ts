import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { AdminManualPayoutPreview } from '@/app/types/admin';
import { EXPERIENCE_PAYOUT_THRESHOLD_KRW } from '@/app/utils/payoutQueue';
import { isSoloGuaranteeRefundUnresolvedStatus } from '@/app/utils/soloGuaranteeRefundStatus';

type ExperienceBookingRow = {
  id: string;
  payout_status: string | null;
  host_payout_amount: number | null;
  solo_guarantee_refund_status: string | null;
};

export async function getAdminManualPayoutPreview(
  supabaseAdmin: SupabaseClient,
  hostId: string
): Promise<AdminManualPayoutPreview> {
  const [{ data: profile, error: profileError }] = await Promise.all([
    supabaseAdmin.from('profiles').select('full_name').eq('id', hostId).maybeSingle(),
  ]);
  if (profileError) throw profileError;

  const experienceIds: number[] = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const { data, error } = await supabaseAdmin
      .from('experiences')
      .select('id')
      .eq('host_id', hostId)
      .order('id')
      .range(offset, offset + 499);
    if (error) throw error;
    const page = (data || []).map((row) => Number(row.id));
    experienceIds.push(...page);
    if (page.length < 500) break;
    if (offset + 500 >= 10000) throw new Error('호스트 체험 데이터가 안전 조회 한도를 초과했습니다.');
  }

  const emptyBookingResult = Promise.resolve({ data: [], error: null });

  const pendingRowsPromise = (async () => {
    if (experienceIds.length === 0) return { data: [] as ExperienceBookingRow[], error: null };
    const rows: ExperienceBookingRow[] = [];
    for (let offset = 0; offset < 10000; offset += 500) {
      const { data, error } = await supabaseAdmin
        .from('bookings')
        .select('id, payout_status, host_payout_amount, solo_guarantee_refund_status')
        .in('experience_id', experienceIds)
        .or('payout_status.eq.pending,payout_status.is.null')
        .in('status', ['completed', 'COMPLETED', 'cancelled', 'CANCELLED'])
        .order('id')
        .range(offset, offset + 499);
      if (error) return { data: rows, error };
      const page = ((data || []) as unknown) as ExperienceBookingRow[];
      rows.push(...page);
      if (page.length < 500) return { data: rows, error: null };
      if (offset + 500 >= 10000) throw new Error('호스트 미정산 데이터가 안전 조회 한도를 초과했습니다.');
    }
    return { data: rows, error: null };
  })();

  const [pendingResult, activeExperienceResult, serviceResult, applicationResult, availabilityResult] = await Promise.all([
    pendingRowsPromise,
    experienceIds.length > 0
      ? supabaseAdmin
          .from('bookings')
          .select('id')
          .in('experience_id', experienceIds)
          .in('status', ['PAID', 'confirmed'])
          .limit(1)
      : emptyBookingResult,
    supabaseAdmin
      .from('service_bookings')
      .select('id, status, payout_status')
      .eq('host_id', hostId)
      .in('status', ['PAID', 'confirmed', 'completed'])
      .limit(1),
    supabaseAdmin
      .from('host_applications')
      .select('name, bank_name, account_number, account_holder')
      .eq('user_id', hostId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin.from('admin_manual_payouts').select('id', { count: 'exact', head: true }),
  ]);

  if (pendingResult.error) throw pendingResult.error;
  if (activeExperienceResult.error) throw activeExperienceResult.error;
  if (serviceResult.error) throw serviceResult.error;
  if (applicationResult.error) throw applicationResult.error;
  if (availabilityResult.error) throw new Error('수동 정산 DB migration이 아직 적용되지 않았습니다.');

  const pendingRows = (pendingResult.data || []) as ExperienceBookingRow[];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const hostExitBlockers: string[] = [];

  const invalidPayoutStatusCount = pendingRows.filter((row) => row.payout_status !== 'pending').length;
  if (invalidPayoutStatusCount > 0) {
    blockers.push(`정산 상태를 pending으로 확인해야 하는 예약이 ${invalidPayoutStatusCount}건 있습니다.`);
  }

  const missingSnapshotCount = pendingRows.filter(
    (row) => row.host_payout_amount == null || row.host_payout_amount <= 0
  ).length;
  if (missingSnapshotCount > 0) {
    blockers.push(`지급액 스냅샷 확인이 필요한 예약이 ${missingSnapshotCount}건 있습니다.`);
  }

  const unresolvedRefundCount = pendingRows.filter((row) =>
    isSoloGuaranteeRefundUnresolvedStatus(row.solo_guarantee_refund_status)
  ).length;
  if (unresolvedRefundCount > 0) {
    blockers.push(`환불 확인이 끝나지 않은 예약이 ${unresolvedRefundCount}건 있습니다.`);
  }

  const currentBookingAmount = pendingRows.reduce(
    (sum, row) => sum + Math.max(0, row.host_payout_amount ?? 0),
    0
  );

  if (currentBookingAmount <= 0) {
    blockers.push('정산할 신규 사이트 체험 미정산액이 없습니다.');
  } else if (currentBookingAmount >= EXPERIENCE_PAYOUT_THRESHOLD_KRW) {
    blockers.push('10만원 이상 금액은 기존 일반 정산을 이용해야 합니다.');
  }

  const application = applicationResult.data;
  const hasBankAccount = Boolean(
    application?.bank_name && application?.account_number && application?.account_holder
  );
  if (!hasBankAccount) {
    blockers.push('호스트 지급 계좌가 등록되어 있지 않습니다.');
  }

  if ((activeExperienceResult.data || []).length > 0) {
    hostExitBlockers.push('미래 또는 진행 중 체험 예약이 있습니다.');
  }

  const unsettledServices = (serviceResult.data || []).filter(
    (row) =>
      row.status === 'PAID' ||
      row.status === 'confirmed' ||
      (row.status === 'completed' && row.payout_status !== 'paid')
  );
  if (unsettledServices.length > 0) {
    hostExitBlockers.push('진행 중이거나 미정산인 서비스가 있습니다.');
  }

  if (hostExitBlockers.length === 0) {
    warnings.push('활동 종료 상태는 별도 호스트 상태값으로 확인되지 않으므로 운영자가 최종 확인해야 합니다.');
  }

  return {
    host_id: hostId,
    host_name: application?.name || profile?.full_name || '알 수 없는 호스트',
    current_booking_amount: currentBookingAmount,
    booking_count: pendingRows.length,
    booking_ids: pendingRows.map((row) => row.id),
    bank_name: application?.bank_name || '',
    account_number: application?.account_number || '',
    account_holder: application?.account_holder || '',
    has_bank_account: hasBankAccount,
    blockers,
    warnings,
    host_exit_blockers: hostExitBlockers,
  };
}
