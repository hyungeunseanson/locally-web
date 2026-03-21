import { NextRequest, NextResponse } from 'next/server';

import { resolveAdminAccess } from '@/app/utils/adminAccess';
import {
  getInquiryMessageDisplayContent,
  isAdminSupportInquiry,
  isDeletedInquiryMessage,
  SOFT_DELETED_INQUIRY_MESSAGE_PLACEHOLDER,
  SOFT_DELETED_INQUIRY_MESSAGE_TYPE,
} from '@/app/utils/inquiry';
import { createAdminClient, recordAuditLog } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type InquiryMessageRow = {
  id: number | string;
  inquiry_id: number | string;
  sender_id: string;
  type?: string | null;
  content?: string | null;
  image_url?: string | null;
  is_read?: boolean | null;
  read_at?: string | null;
};

type InquiryRow = {
  id: number | string;
  type?: string | null;
  content?: string | null;
  updated_at?: string | null;
};

async function getLatestInquiryPreview(inquiryId: number | string) {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from('inquiry_messages')
    .select('type, content')
    .eq('inquiry_id', inquiryId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ type?: string | null; content?: string | null }>();

  if (error) throw error;

  if (!data) {
    return SOFT_DELETED_INQUIRY_MESSAGE_PLACEHOLDER;
  }

  return getInquiryMessageDisplayContent({
    type: data.type,
    content: data.content,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

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

    const { messageId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === 'string' ? body.action : '';
    const reason = typeof body?.reason === 'string' && body.reason.trim()
      ? body.reason.trim()
      : 'policy_violation';

    if (action !== 'soft_delete') {
      return NextResponse.json({ success: false, error: '유효하지 않은 액션입니다.' }, { status: 400 });
    }

    const { data: message, error: messageError } = await supabaseAdmin
      .from('inquiry_messages')
      .select('id, inquiry_id, sender_id, type, content, image_url, is_read, read_at')
      .eq('id', messageId)
      .maybeSingle<InquiryMessageRow>();

    if (messageError) {
      console.error('[admin/inquiries/messages/[messageId]] fetch message error:', messageError);
      return NextResponse.json({ success: false, error: '메시지를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!message) {
      return NextResponse.json({ success: false, error: '메시지를 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data: inquiry, error: inquiryError } = await supabaseAdmin
      .from('inquiries')
      .select('id, type, content, updated_at')
      .eq('id', message.inquiry_id)
      .maybeSingle<InquiryRow>();

    if (inquiryError) {
      console.error('[admin/inquiries/messages/[messageId]] fetch inquiry error:', inquiryError);
      return NextResponse.json({ success: false, error: '문의방을 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!inquiry) {
      return NextResponse.json({ success: false, error: '문의방을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (isAdminSupportInquiry(inquiry.type)) {
      return NextResponse.json(
        { success: false, error: '관리자 1:1 문의 메시지는 여기서 삭제할 수 없습니다.' },
        { status: 409 }
      );
    }

    if (isDeletedInquiryMessage(message.type)) {
      return NextResponse.json({
        success: true,
        data: {
          messageId: message.id,
          inquiryId: message.inquiry_id,
          alreadyDeleted: true,
        },
      });
    }

    const readAt = message.read_at || new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('inquiry_messages')
      .update({
        type: SOFT_DELETED_INQUIRY_MESSAGE_TYPE,
        content: SOFT_DELETED_INQUIRY_MESSAGE_PLACEHOLDER,
        image_url: null,
        is_read: true,
        read_at: readAt,
      })
      .eq('id', message.id);

    if (updateError) {
      console.error('[admin/inquiries/messages/[messageId]] soft delete error:', updateError);
      return NextResponse.json({ success: false, error: '메시지 삭제에 실패했습니다.' }, { status: 500 });
    }

    const latestPreview = await getLatestInquiryPreview(message.inquiry_id);
    if (latestPreview !== (inquiry.content || '')) {
      const { error: inquiryUpdateError } = await supabaseAdmin
        .from('inquiries')
        .update({ content: latestPreview })
        .eq('id', inquiry.id);

      if (inquiryUpdateError) {
        console.error('[admin/inquiries/messages/[messageId]] inquiry preview sync error:', inquiryUpdateError);
        return NextResponse.json({ success: false, error: '문의방 미리보기 갱신에 실패했습니다.' }, { status: 500 });
      }
    }

    await recordAuditLog({
      admin_id: user.id,
      admin_email: user.email,
      action_type: 'ADMIN_INQUIRY_MESSAGE_SOFT_DELETE',
      target_type: 'inquiry_messages',
      target_id: String(message.id),
      details: {
        inquiry_id: String(message.inquiry_id),
        sender_id: message.sender_id,
        inquiry_type: inquiry.type || null,
        previous_type: message.type || null,
        previous_content_length: typeof message.content === 'string' ? message.content.length : 0,
        reason,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        messageId: message.id,
        inquiryId: message.inquiry_id,
        type: SOFT_DELETED_INQUIRY_MESSAGE_TYPE,
        content: SOFT_DELETED_INQUIRY_MESSAGE_PLACEHOLDER,
        inquiryPreview: latestPreview,
      },
    });
  } catch (error) {
    console.error('[admin/inquiries/messages/[messageId]] unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
