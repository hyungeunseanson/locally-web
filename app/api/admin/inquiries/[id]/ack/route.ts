import { NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { clearAdminSupportUnreadBatch } from '@/app/utils/adminSupportUnreadAlerts';

// Explicit administrative acknowledgement. GET remains read-only; customer read
// receipts are never written here. A bounded snapshot cannot acknowledge a newer message.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return NextResponse.json({ success: false }, { status: 401 });
    const admin = createAdminClient();
    if (!(await resolveAdminAccess(admin, { userId: user.id, email: user.email })).isAdmin) {
      return NextResponse.json({ success: false }, { status: 403 });
    }
    const { id } = await context.params;
    const body = await request.json();
    const throughMessageId = String(body?.throughMessageId ?? '');
    if (!/^[1-9]\d*$/.test(id) || !/^[1-9]\d*$/.test(throughMessageId)) {
      return NextResponse.json({ success: false }, { status: 400 });
    }
    if (body.messageIds !== undefined) {
      const ids = body.messageIds;
      if (!Array.isArray(ids) || !ids.length || ids.length > 10000 || ids.some(id => !/^[1-9]\d*$/.test(String(id)))
        || !ids.some(id => String(id) === throughMessageId)) {
        return NextResponse.json({ success: false }, { status: 400 });
      }
      const { data, error: snapshotError } = await admin.rpc('ack_admin_inquiry_snapshot', {
        p_inquiry_id: id, p_message_ids: ids.map(String),
      });
      if (snapshotError || !Array.isArray(data) || !data[0]) return NextResponse.json({ success: false }, { status: 400 });
      await clearAdminSupportUnreadBatch({ supabaseAdmin: admin, inquiryId: id });
      return NextResponse.json({ success: true, admin_unread_count: Number(data[0].admin_unread_count), throughMessageId });
    }
    const { error: ackError } = await admin.rpc('ack_admin_inquiry_messages', {
      p_inquiry_id: id, p_through_message_id: throughMessageId,
    });
    if (ackError) return NextResponse.json({ success: false }, { status: 400 });
    await clearAdminSupportUnreadBatch({ supabaseAdmin: admin, inquiryId: id });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
