import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';

export async function GET() {
    try {
        const supabaseServer = await createServerClient();
        const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

        if (authError || !user) {
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

        const [
            appsRes,
            expsRes,
            bookingsRes,
            svcRes,
            inquiriesRes,
            adminAlertsRes,
        ] = await Promise.all([
            supabaseAdmin.from('host_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            supabaseAdmin.from('experiences').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            supabaseAdmin.from('bookings').select('id').eq('status', 'PENDING'),
            supabaseAdmin.from('service_bookings').select('id', { count: 'exact', head: true }).eq('status', 'PENDING').eq('payment_method', 'bank'),
            supabaseAdmin.from('inquiries').select('id').or('type.eq.admin_support,type.eq.admin'),
            supabaseAdmin
                .from('notifications')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('is_read', false)
                .eq('type', 'admin_alert'),
        ]);

        let csUnreadCount = 0;
        const csIds = (inquiriesRes.data || []).map((i: { id: string }) => i.id);
        if (csIds.length > 0) {
            const { count } = await supabaseAdmin
                .from('inquiry_messages')
                .select('*', { count: 'exact', head: true })
                .in('inquiry_id', csIds)
                .neq('sender_id', user.id)
                .eq('is_read', false);
            csUnreadCount = count || 0;
        }

        return NextResponse.json({
            success: true,
            data: {
                appsCount: appsRes.count || 0,
                expsCount: expsRes.count || 0,
                pendingBookingIds: (bookingsRes.data || []).map(b => b.id),
                svcBankPendingCount: svcRes.count || 0,
                csUnreadCount,
                adminAlertsUnread: adminAlertsRes.count || 0,
            }
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        console.error('[ADMIN] /api/admin/sidebar-counts error:', error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
