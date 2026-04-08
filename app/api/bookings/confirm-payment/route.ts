import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import {
  confirmExperienceBankPayment,
  runExperienceBankConfirmSideEffects,
} from '@/app/utils/bookings/confirmExperienceBankPayment';

// LEGACY ROUTE
// Current admin-confirm path is `/api/admin/bookings/confirm-payment`.
// Keep this file only for compatibility until legacy callers are fully retired.


export async function POST(request: Request) {
  console.log('💰 [API] Confirm Payment Started');

  try {
    // 🚨 [보안 패치] 권한 검증 추가 (Phase 5 긴급 수정)
    const supabaseAuth = await createServerClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient(); // 🟢 검증 후 관리자 클라이언트 생성

    // 관리자 권한 확인 (Role or Whitelist)
    const { isAdmin } = await resolveAdminAccess(supabase, {
      userId: user.id,
      email: user.email,
    });

    if (!isAdmin) {
      console.error(`🚨 [Security Warning] Unauthorized Access Attempt by ${user.email}`);
      return NextResponse.json({ error: 'Forbidden: Admin Access Required' }, { status: 403 });
    }
    const { bookingId } = await request.json();
    const result = await confirmExperienceBankPayment(supabase, bookingId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    if (result.alreadyProcessed) {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    await runExperienceBankConfirmSideEffects(supabase, result);

    try {
      await recordAuditLog({
        admin_id: user.id,
        admin_email: user.email,
        action_type: 'CONFIRM_PAYMENT',
        target_type: 'bookings',
        target_id: result.booking.id,
        details: {
          target_info: `${result.experience?.title || 'Locally 체험'} (게스트: ${result.guestDisplayName})`,
          amount: result.booking.amount,
        },
      });
    } catch (logError) {
      console.error('Log Insert Failed (Ignored):', logError);
    }

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('🔥 [API Error]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
