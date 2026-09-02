import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const migration = readFileSync('docs/migrations/v3_40_39_admin_manual_final_payout.sql', 'utf8');
const normalizedMigration = migration.replace(/\s+/g, ' ').trim();
const hardeningMigration = readFileSync(
  'docs/migrations/v3_40_40_admin_manual_payout_privilege_hardening.sql',
  'utf8'
).replace(/\s+/g, ' ').trim();
const zeroCancellationMigration = readFileSync(
  'docs/migrations/v3_40_41_admin_manual_payout_zero_cancellation.sql',
  'utf8'
).replace(/\s+/g, ' ').trim();
const completeRoute = readFileSync('app/api/admin/manual-payouts/complete/route.ts', 'utf8');
const previewRoute = readFileSync('app/api/admin/manual-payouts/preview/route.ts', 'utf8');
const payoutQueueRoute = readFileSync('app/api/admin/payout-queue/route.ts', 'utf8');
const salesTab = readFileSync('app/admin/dashboard/components/SalesTab.tsx', 'utf8');
const dialog = readFileSync('app/admin/dashboard/components/ManualFinalPayoutDialog.tsx', 'utf8');
const hostEarningsRoute = readFileSync('app/api/host/earnings/summary/route.ts', 'utf8');
const manualPayoutPreview = readFileSync('app/utils/adminManualPayouts.ts', 'utf8');
const contractsConfig = readFileSync('playwright.contracts.config.ts', 'utf8');
const globalSetup = readFileSync('tests/e2e/global.setup.ts', 'utf8');

test.describe('admin manual final payout contract', () => {
  test('keeps booking transition and financial record in one database transaction', () => {
    expect(normalizedMigration).toMatch(/\bBEGIN;/);
    expect(normalizedMigration.endsWith('COMMIT;')).toBe(true);
    expect(normalizedMigration).toContain('CREATE TABLE IF NOT EXISTS public.admin_manual_payouts');
    expect(normalizedMigration).toContain('CREATE OR REPLACE FUNCTION public.complete_admin_manual_experience_payout_atomic');
    expect(normalizedMigration).toContain('FOR UPDATE OF b');
    expect(normalizedMigration).toContain("SET payout_status = 'paid', payout_paid_at = v_paid_at");
    expect(normalizedMigration).toContain('GET DIAGNOSTICS v_updated_count = ROW_COUNT');
    expect(normalizedMigration).toContain('IF v_updated_count <> v_booking_count THEN');
    expect(normalizedMigration).toContain('INSERT INTO public.admin_manual_payouts');
    expect(normalizedMigration).not.toContain('COMMIT; UPDATE public.bookings');
  });

  test('serializes concurrent attempts and rejects changed payload reuse', () => {
    expect(normalizedMigration).toContain('pg_advisory_xact_lock(hashtextextended(p_host_id::text, 0))');
    expect(normalizedMigration).toContain('request_key uuid NOT NULL UNIQUE');
    expect(normalizedMigration).toContain('WHERE admin_manual_payouts.request_key = p_request_key');
    expect(normalizedMigration).toContain('같은 request key가 다른 정산 내용으로 재사용되었습니다.');
    for (const payloadField of [
      'host_id',
      'settlement_type',
      'current_booking_amount',
      'legacy_amount',
      'reason',
      'legacy_source_reference',
      'transfer_reference',
    ]) {
      expect(normalizedMigration).toContain(`v_existing.${payloadField}`);
    }
  });

  test('is service-role only and both HTTP routes re-check admin access', () => {
    expect(normalizedMigration).toContain(
      'REVOKE ALL ON TABLE public.admin_manual_payouts FROM PUBLIC, anon, authenticated;'
    );
    expect(normalizedMigration).toContain(
      'GRANT SELECT, INSERT ON TABLE public.admin_manual_payouts TO service_role;'
    );
    expect(normalizedMigration).toContain('FROM PUBLIC, anon, authenticated; GRANT EXECUTE');
    expect(normalizedMigration).toContain('TO service_role;');
    expect(hardeningMigration).toContain(
      'REVOKE ALL ON TABLE public.admin_manual_payouts FROM service_role;'
    );
    expect(hardeningMigration).toContain(
      'GRANT SELECT, INSERT ON TABLE public.admin_manual_payouts TO service_role;'
    );
    for (const source of [completeRoute, previewRoute]) {
      expect(source).toContain('auth.getUser()');
      expect(source).toContain('resolveAdminAccess');
      expect(source).toContain("error: 'Forbidden'");
    }
  });

  test('keeps manual payout below threshold and blocks unsafe host-exit state', () => {
    expect(normalizedMigration).toContain('IF v_current_amount >= 100000 THEN');
    expect(normalizedMigration).toContain("p_settlement_type = 'legacy_carryover'");
    expect(normalizedMigration).toContain('COALESCE(p_legacy_amount, 0) <= 0');
    expect(normalizedMigration).toContain("b.solo_guarantee_refund_status IN ('processing', 'pending_manual', 'failed')");
    expect(normalizedMigration).toContain("b.status IN ('PAID', 'confirmed')");
    expect(normalizedMigration).toContain("sb.status IN ('PAID', 'confirmed')");
    expect(normalizedMigration).toContain("sb.status = 'completed' AND sb.payout_status IS DISTINCT FROM 'paid'");
    expect(manualPayoutPreview).toContain(
      'status.in.(PAID,confirmed),and(status.eq.completed,payout_status.neq.paid),and(status.eq.completed,payout_status.is.null)'
    );
  });

  test('ignores only resolved zero-payout cancellations and preserves every other blocker', () => {
    expect(manualPayoutPreview).toContain('isIgnorableZeroPayoutCancellation');
    expect(manualPayoutPreview).toContain("String(row.status || '').toLowerCase() === 'cancelled'");
    expect(manualPayoutPreview).toContain('row.host_payout_amount === 0');
    expect(manualPayoutPreview).toContain('!isSoloGuaranteeRefundUnresolvedStatus');
    expect(manualPayoutPreview).toContain('settlementRows');
    expect(zeroCancellationMigration).toContain('b.host_payout_amount = 0');
    expect(zeroCancellationMigration).toContain("b.solo_guarantee_refund_status IN ('processing', 'pending_manual', 'failed')");
    expect(zeroCancellationMigration).toContain('b.host_payout_amount IS NULL');
    expect(zeroCancellationMigration).toContain("b.status NOT IN ('cancelled', 'CANCELLED')");
    expect(zeroCancellationMigration).toContain('FROM PUBLIC, anon, authenticated');
    expect(zeroCancellationMigration).toContain('TO service_role');
  });

  test('explains missing manual payout inputs and invalidates stale transfer confirmation', () => {
    expect(dialog).toContain('manual-payout-missing-requirements');
    expect(dialog).toContain('Legacy 이월액 입력 후 총 지급액이 계산됩니다.');
    expect(dialog).toContain('changeSettlementType');
    expect(dialog).toContain('changeLegacyAmount');
    expect(dialog.match(/setConfirmedTransfer\(false\)/g)).toHaveLength(2);
    expect(dialog).toContain('disabled={!hasCalculatedTotal}');
    expect(dialog).toContain('border border-slate-300 px-3 py-2');
  });

  test('separates all-time pending from paid-at history and fails closed on truncation', () => {
    expect(payoutQueueRoute).toContain("view === 'pending'");
    expect(payoutQueueRoute).toContain("view === 'history' ? 'payout_paid_at' : 'created_at'");
    expect(payoutQueueRoute).toContain('.range(offset, offset + PAYOUT_PAGE_SIZE - 1)');
    expect(payoutQueueRoute.match(/\.order\('id', \{ ascending: false \}\)/g)).toHaveLength(3);
    expect(payoutQueueRoute).toContain('PAYOUT_MAX_ROWS');
    expect(payoutQueueRoute).toContain('안전 조회 한도를 초과했습니다');
    expect(salesTab).toContain("fetch('/api/admin/payout-queue?view=pending')");
    expect(salesTab).toContain("new URLSearchParams({ view: 'history' })");
    expect(salesTab).toContain('실제 지급 완료일 기준');
    expect(salesTab).toContain('historyLoading');
    expect(salesTab).toContain('historyError');
    expect(payoutQueueRoute).toContain('manualPayoutsAvailable = false');
    expect(salesTab).toContain('manualPayoutsAvailable &&');
    expect(previewRoute).toContain('getAdminManualPayoutPreview');
  });

  test('keeps contract tests and cleanup away from Production mutations', () => {
    expect(contractsConfig).toContain('globalSetup: undefined');
    expect(globalSetup).toContain("const PRODUCTION_SUPABASE_PROJECT_REF = 'uhinvcydgzqlpnvieyal'");
    expect(globalSetup).toContain('Refusing to mutate the Production Supabase project.');
    expect(globalSetup).toContain("env[ADMIN_WHITELIST_CLEANUP_OPT_IN] !== 'true'");
  });

  test('does not double-count current booking payout and preserves CSV semantics', () => {
    expect(payoutQueueRoute).toContain('actual_disbursed_amount: paid_amount + legacy_paid_amount');
    expect(payoutQueueRoute).not.toContain('paid_amount + record.total_paid_amount');
    expect(salesTab).toContain('row.actual_disbursed_amount');
    expect(salesTab).toContain(".filter((record) => record.legacy_amount > 0)");
    expect(salesTab).toContain("escapeCSV('이전 사이트 이월 정산')");
    expect(salesTab).toContain('record.legacy_amount');
    expect(salesTab).toContain('record.booking_ids.includes(entry.id)');
  });

  test('keeps legacy out of bookings and host earnings', () => {
    const updateSegment = normalizedMigration.match(/UPDATE public\.bookings AS b([\s\S]+?)GET DIAGNOSTICS/)?.[1];
    expect(updateSegment).toBeTruthy();
    expect(updateSegment).not.toContain('host_payout_amount');
    expect(updateSegment).not.toContain('amount =');
    expect(hostEarningsRoute).not.toContain('admin_manual_payouts');
    expect(completeRoute).toContain("target_type: 'admin_manual_payouts'");
  });

  test('exposes only the two approved manual actions in the existing pending UI', () => {
    expect(dialog).toContain("'host_exit_final'");
    expect(dialog).toContain("'legacy_carryover'");
    expect(dialog).toContain('expectedCurrentBookingAmount');
    expect(dialog).toContain('requestKey');
    expect(salesTab).toContain('전체');
    expect(salesTab).toContain('정산 가능');
    expect(salesTab).toContain('10만원 미만');
    expect(salesTab).toContain('환불 확인');
    expect(salesTab).toContain('수동 최종 정산');
    expect(salesTab).not.toContain('수동 정산 (Manual)');
  });
});
