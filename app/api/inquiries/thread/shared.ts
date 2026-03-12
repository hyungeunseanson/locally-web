import nodemailer from 'nodemailer';

import { createAdminClient } from '@/app/utils/supabase/admin';
import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { sanitizeText } from '@/app/utils/sanitize';

type AuthActor = {
  id: string;
  email?: string | null;
};

export type InquiryThreadContextType =
  | 'experience_general'
  | 'host_experience'
  | 'admin_support'
  | 'admin_initiated_support'
  | 'service_request';

export type InquiryThreadRequestBody = {
  contextType?: InquiryThreadContextType;
  experienceId?: string | number;
  serviceRequestId?: string;
  hostId?: string;
  guestId?: string;
  message?: string;
  openOnly?: boolean;
};

export type InquiryThreadResponse = {
  success: true;
  inquiryId: number | string;
  inquiryType: 'general' | 'admin_support';
  hostId: string | null;
  guestId: string;
  experienceId: string | null;
  redirectUrl: string;
  createdThread: boolean;
  createdMessage: boolean;
};

export type InquiryMessageRequestBody = {
  inquiryId?: number | string;
  content?: string;
  imageUrl?: string | null;
  type?: 'text' | 'image';
};

export type InquiryMessageResponse = {
  success: true;
  inquiryId: number | string;
  messageId: number | string;
  displayContent: string;
  updatedAt: string;
};

type InquiryInsertRow = {
  id: number | string;
  user_id: string;
  host_id: string | null;
  experience_id?: string | number | null;
  service_request_id?: string | null;
  type?: string | null;
  content?: string | null;
};

type ServiceRequestRow = {
  id: string;
  user_id: string;
  selected_host_id: string | null;
};

type InquiryMessageAccessRow = {
  id: number | string;
  user_id: string;
  host_id: string | null;
  type?: string | null;
};

type InquiryMessageInsertRow = {
  id: number | string;
};

type ResolvedInquiryThread = {
  existing: InquiryInsertRow | null;
  guestId: string;
  hostId: string | null;
  experienceId: string | null;
  serviceRequestId: string | null;
  inquiryType: 'general' | 'admin_support';
  redirectUrl: string;
  emptyContent: string;
  allowReuse: boolean;
};

class InquiryThreadError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const buildGuestInboxLink = (inquiryId: number | string) => `/guest/inbox?inquiryId=${encodeURIComponent(String(inquiryId))}`;
const buildHostInquiryLink = (inquiryId: number | string) => `/host/dashboard?tab=inquiries&inquiryId=${encodeURIComponent(String(inquiryId))}`;
const buildAdminChatLink = (inquiryId: number | string) => `/admin/dashboard?tab=CHATS&inquiryId=${encodeURIComponent(String(inquiryId))}`;
async function hasServiceRequestInquiryKeyColumn() {
  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from('inquiries')
    .select('service_request_id')
    .limit(1);

  if (!error) return true;

  if (error.code === '42703' || error.message?.includes('service_request_id')) {
    return false;
  }

  console.warn('[inquiries/thread] service_request_id capability check failed, fallback to legacy lookup:', error);
  return false;
}

async function getActorDisplayName(actorId: string) {
  try {
    const supabaseAdmin = createAdminClient();
    const [profileRes, hostAppRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('full_name, email').eq('id', actorId).maybeSingle(),
      supabaseAdmin.from('host_applications').select('name').eq('user_id', actorId).maybeSingle(),
    ]);

    return (
      hostAppRes.data?.name ||
      profileRes.data?.full_name ||
      profileRes.data?.email?.split('@')[0] ||
      '상대방'
    );
  } catch (error) {
    console.warn('[inquiries/thread] actor name lookup failed:', error);
    return '상대방';
  }
}

async function findRecipientEmail(recipientId: string) {
  const supabaseAdmin = createAdminClient();
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('id', recipientId)
    .maybeSingle();

  if (profile?.email) return profile.email;

  const { data: authData } = await supabaseAdmin.auth.admin.getUserById(recipientId);
  return authData?.user?.email || '';
}

async function notifyRecipient(params: {
  recipientId: string;
  title: string;
  message: string;
  link: string;
}) {
  try {
    const supabaseAdmin = createAdminClient();
    const { recipientId, title, message, link } = params;

    await supabaseAdmin.from('notifications').insert({
      user_id: recipientId,
      type: 'new_message',
      title,
      message,
      link,
      is_read: false,
    });

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;

    const email = await findRecipientEmail(recipientId);
    if (!email) return;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    await transporter.sendMail({
      from: `"Locally Team" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `[Locally] ${title}`,
      html: `<p>${message}</p><br/><a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}${link}">확인하기</a>`,
    });
  } catch (error) {
    console.warn('[inquiries/thread] message notification email failed:', error);
  }
}

async function getAdminRecipientIds() {
  const supabaseAdmin = createAdminClient();

  const { data: whitelistEntries, error: whitelistError } = await supabaseAdmin
    .from('admin_whitelist')
    .select('email');

  if (whitelistError) throw new InquiryThreadError(500, '관리자 정보를 불러올 수 없습니다.');

  const adminEmails = (whitelistEntries || [])
    .map((entry) => entry.email)
    .filter(Boolean);

  if (adminEmails.length === 0) {
    throw new InquiryThreadError(400, '현재 상담 가능한 관리자가 없습니다.');
  }

  const { data: admins, error: adminError } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .in('email', adminEmails);

  if (adminError) throw new InquiryThreadError(500, '관리자 정보를 불러올 수 없습니다.');

  const adminIds = (admins || [])
    .map((admin) => admin.id)
    .filter(Boolean);

  if (adminIds.length === 0) {
    throw new InquiryThreadError(400, '현재 상담 가능한 관리자가 없습니다.');
  }

  return adminIds;
}

async function assertAdminActor(actor: AuthActor) {
  const supabaseAdmin = createAdminClient();
  const { isAdmin } = await resolveAdminAccess(supabaseAdmin, {
    userId: actor.id,
    email: actor.email,
  });
  if (!isAdmin) {
    throw new InquiryThreadError(403, 'Forbidden');
  }
}

async function resolveExperienceThread(params: {
  actor: AuthActor;
  body: InquiryThreadRequestBody;
}): Promise<ResolvedInquiryThread> {
  const { actor, body } = params;
  const supabaseAdmin = createAdminClient();
  const experienceId = body.experienceId != null ? String(body.experienceId) : '';

  if (!experienceId) {
    throw new InquiryThreadError(400, 'experienceId is required');
  }

  const { data: exp } = await supabaseAdmin
    .from('experiences')
    .select('id, host_id, title')
    .eq('id', experienceId)
    .maybeSingle();

  if (!exp?.host_id) {
    throw new InquiryThreadError(404, '체험 정보를 찾을 수 없습니다.');
  }

  if (body.contextType === 'host_experience' && String(exp.host_id) !== String(actor.id)) {
    throw new InquiryThreadError(403, 'Forbidden');
  }

  if (body.hostId && String(body.hostId) !== String(exp.host_id)) {
    throw new InquiryThreadError(403, 'Forbidden');
  }

  const guestId = body.contextType === 'host_experience' ? String(body.guestId || '') : actor.id;
  const hostId = String(exp.host_id);

  if (!guestId) {
    throw new InquiryThreadError(400, 'guestId is required');
  }

  const { data: existing } = await supabaseAdmin
    .from('inquiries')
    .select('id, user_id, host_id, experience_id, type, content')
    .eq('user_id', guestId)
    .eq('host_id', hostId)
    .eq('experience_id', experienceId)
    .eq('type', 'general')
    .maybeSingle();

  return {
    existing,
    guestId,
    hostId,
    experienceId,
    serviceRequestId: null,
    inquiryType: 'general' as const,
    redirectUrl: body.contextType === 'host_experience'
      ? buildHostInquiryLink(existing?.id || 'pending')
      : buildGuestInboxLink(existing?.id || 'pending'),
    emptyContent: '',
    allowReuse: true,
  };
}

async function resolveServiceRequestThread(params: {
  actor: AuthActor;
  body: InquiryThreadRequestBody;
}): Promise<ResolvedInquiryThread> {
  const { actor, body } = params;
  const supabaseAdmin = createAdminClient();

  if (!body.serviceRequestId) {
    throw new InquiryThreadError(400, 'serviceRequestId is required');
  }

  const { data: serviceRequest } = await supabaseAdmin
    .from('service_requests')
    .select('id, user_id, selected_host_id')
    .eq('id', body.serviceRequestId)
    .maybeSingle<ServiceRequestRow>();

  if (!serviceRequest) {
    throw new InquiryThreadError(404, '의뢰를 찾을 수 없습니다.');
  }

  if (!serviceRequest.selected_host_id) {
    throw new InquiryThreadError(400, '매칭된 호스트가 없습니다.');
  }

  const guestId = String(serviceRequest.user_id);
  const hostId = String(serviceRequest.selected_host_id);
  const isCustomer = actor.id === guestId;
  const isSelectedHost = actor.id === hostId;

  if (!isCustomer && !isSelectedHost) {
    throw new InquiryThreadError(403, 'Forbidden');
  }

  const supportsScopedServiceInquiry = await hasServiceRequestInquiryKeyColumn();
  const { data: existing } = supportsScopedServiceInquiry
    ? await supabaseAdmin
      .from('inquiries')
      .select('id, user_id, host_id, experience_id, service_request_id, type, content')
      .eq('user_id', guestId)
      .eq('host_id', hostId)
      .eq('service_request_id', serviceRequest.id)
      .eq('type', 'general')
      .maybeSingle<InquiryInsertRow>()
    : await supabaseAdmin
      .from('inquiries')
      .select('id, user_id, host_id, experience_id, type, content')
      .eq('user_id', guestId)
      .eq('host_id', hostId)
      .is('experience_id', null)
      .eq('type', 'general')
      .maybeSingle<InquiryInsertRow>();

  return {
    existing,
    guestId,
    hostId,
    experienceId: null,
    serviceRequestId: supportsScopedServiceInquiry ? serviceRequest.id : null,
    inquiryType: 'general' as const,
    redirectUrl: isCustomer
      ? buildGuestInboxLink(existing?.id || 'pending')
      : buildHostInquiryLink(existing?.id || 'pending'),
    emptyContent: '',
    allowReuse: true,
  };
}

async function resolveAdminSupportThread(params: {
  actor: AuthActor;
  body: InquiryThreadRequestBody;
}): Promise<ResolvedInquiryThread> {
  const { actor } = params;
  const adminIds = await getAdminRecipientIds();
  const randomAdminId = adminIds[Math.floor(Math.random() * adminIds.length)];

  return {
    existing: null,
    guestId: actor.id,
    hostId: randomAdminId,
    experienceId: null,
    serviceRequestId: null,
    inquiryType: 'admin_support' as const,
    redirectUrl: buildGuestInboxLink('pending'),
    emptyContent: '',
    allowReuse: false,
  };
}

async function resolveAdminInitiatedSupportThread(params: {
  actor: AuthActor;
  body: InquiryThreadRequestBody;
}): Promise<ResolvedInquiryThread> {
  const { actor, body } = params;
  const supabaseAdmin = createAdminClient();
  await assertAdminActor(actor);

  const guestId = String(body.guestId || '');
  if (!guestId) {
    throw new InquiryThreadError(400, 'guestId is required');
  }

  const { data: existing } = await supabaseAdmin
    .from('inquiries')
    .select('id, user_id, host_id, experience_id, type, content')
    .eq('user_id', guestId)
    .or('type.eq.admin_support,type.eq.admin')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    existing,
    guestId,
    hostId: actor.id,
    experienceId: null,
    serviceRequestId: null,
    inquiryType: 'admin_support' as const,
    redirectUrl: buildAdminChatLink(existing?.id || 'pending'),
    emptyContent: '관리자가 문의를 시작했습니다.',
    allowReuse: true,
  };
}

function isAdminSupportType(type?: string | null) {
  return type === 'admin' || type === 'admin_support';
}

async function resolveInquiryMessageAccess(params: {
  actor: AuthActor;
  inquiryId: number | string;
}) {
  const { actor, inquiryId } = params;
  const supabaseAdmin = createAdminClient();

  const { data: inquiry } = await supabaseAdmin
    .from('inquiries')
    .select('id, user_id, host_id, type')
    .eq('id', inquiryId)
    .maybeSingle<InquiryMessageAccessRow>();

  if (!inquiry) {
    throw new InquiryThreadError(404, '문의방을 찾을 수 없습니다.');
  }

  const isParticipant =
    String(inquiry.user_id) === String(actor.id) ||
    (inquiry.host_id != null && String(inquiry.host_id) === String(actor.id));

  let actorIsAdmin = false;
  if (!isParticipant) {
    await assertAdminActor(actor);
    actorIsAdmin = true;
  }

  return {
    inquiry,
    actorIsAdmin,
    isAdminSupport: isAdminSupportType(inquiry.type),
  };
}

export async function createInquiryMessage(params: {
  actor: AuthActor;
  body: InquiryMessageRequestBody;
}) {
  const { actor, body } = params;
  const supabaseAdmin = createAdminClient();
  const inquiryId = body.inquiryId != null ? String(body.inquiryId) : '';
  const cleanContent = sanitizeText(body.content || '').trim();
  const normalizedType = body.type === 'image' ? 'image' : 'text';
  const imageUrl = body.imageUrl || null;

  if (!inquiryId) {
    throw new InquiryThreadError(400, 'inquiryId is required');
  }

  if (!cleanContent && !imageUrl) {
    throw new InquiryThreadError(400, 'message is required');
  }

  const { inquiry, actorIsAdmin, isAdminSupport } = await resolveInquiryMessageAccess({
    actor,
    inquiryId,
  });

  const displayContent = cleanContent || (normalizedType === 'image' ? '📷 사진을 보냈습니다.' : '');
  const updatedAt = new Date().toISOString();

  const { data: insertedMessage, error: messageError } = await supabaseAdmin
    .from('inquiry_messages')
    .insert({
      inquiry_id: inquiry.id,
      sender_id: actor.id,
      content: cleanContent,
      image_url: imageUrl,
      type: normalizedType,
      is_read: false,
    })
    .select('id')
    .maybeSingle<InquiryMessageInsertRow>();

  if (messageError || !insertedMessage) {
    if (messageError?.code === '23503' && messageError.message?.includes('profiles')) {
      throw new InquiryThreadError(400, '프로필 동기화가 진행 중입니다. 잠시 후(5초 뒤) 다시 시도해주세요.');
    }
    throw new InquiryThreadError(500, '메시지 저장에 실패했습니다.');
  }

  const { error: updateError } = await supabaseAdmin
    .from('inquiries')
    .update({
      content: displayContent,
      updated_at: updatedAt,
    })
    .eq('id', inquiry.id);

  if (updateError) {
    throw new InquiryThreadError(500, '문의방 갱신에 실패했습니다.');
  }

  const actorDisplayName = await getActorDisplayName(actor.id);

  const recipientId = (() => {
    if (isAdminSupport) {
      if (String(actor.id) === String(inquiry.user_id)) return inquiry.host_id;
      return inquiry.user_id;
    }

    if (String(actor.id) === String(inquiry.host_id)) return inquiry.user_id;
    if (String(actor.id) === String(inquiry.user_id)) return inquiry.host_id;
    if (actorIsAdmin) return inquiry.host_id;
    return inquiry.host_id;
  })();

  const notificationLink = (() => {
    if (isAdminSupport) {
      return actorIsAdmin || String(actor.id) === String(inquiry.host_id)
        ? buildGuestInboxLink(inquiry.id)
        : buildAdminChatLink(inquiry.id);
    }

    return String(actor.id) === String(inquiry.host_id)
      ? buildGuestInboxLink(inquiry.id)
      : buildHostInquiryLink(inquiry.id);
  })();

  if (recipientId && String(recipientId) !== String(actor.id)) {
    await notifyRecipient({
      recipientId,
      title: `💬 ${actorDisplayName}님의 새 메시지`,
      message: displayContent,
      link: notificationLink,
    });
  }

  return {
    success: true,
    inquiryId: inquiry.id,
    messageId: insertedMessage.id,
    displayContent,
    updatedAt,
  } satisfies InquiryMessageResponse;
}

export async function upsertInquiryThread(params: {
  actor: AuthActor;
  body: InquiryThreadRequestBody;
}) {
  const { actor, body } = params;
  const supabaseAdmin = createAdminClient();
  const contextType = body.contextType;
  const cleanMessage = sanitizeText(body.message || '').trim();
  const openOnly = body.openOnly === true;

  if (!contextType) {
    throw new InquiryThreadError(400, 'contextType is required');
  }

  if (!cleanMessage && !openOnly) {
    throw new InquiryThreadError(400, 'message is required');
  }

  const resolved: ResolvedInquiryThread = await (async () => {
    switch (contextType) {
      case 'experience_general':
      case 'host_experience':
        return resolveExperienceThread({ actor, body });
      case 'service_request':
        return resolveServiceRequestThread({ actor, body });
      case 'admin_support':
        return resolveAdminSupportThread({ actor, body });
      case 'admin_initiated_support':
        return resolveAdminInitiatedSupportThread({ actor, body });
      default:
        throw new InquiryThreadError(400, 'Unsupported contextType');
    }
  })();

  let inquiry = resolved.existing as InquiryInsertRow | null;
  let createdThread = false;
  let createdMessage = false;

  if (!inquiry) {
    const initialContent = cleanMessage || resolved.emptyContent || '';
    const inquiryInsertPayload = {
      user_id: resolved.guestId,
      host_id: resolved.hostId,
      experience_id: resolved.experienceId,
      content: initialContent,
      type: resolved.inquiryType,
      ...(resolved.serviceRequestId ? { service_request_id: resolved.serviceRequestId } : {}),
    };

    const { data: newInquiry, error: insertError } = resolved.serviceRequestId
      ? await supabaseAdmin
        .from('inquiries')
        .insert(inquiryInsertPayload)
        .select('id, user_id, host_id, experience_id, service_request_id, type, content')
        .maybeSingle<InquiryInsertRow>()
      : await supabaseAdmin
        .from('inquiries')
        .insert(inquiryInsertPayload)
        .select('id, user_id, host_id, experience_id, type, content')
        .maybeSingle<InquiryInsertRow>();

    if (insertError?.code === '23505' && resolved.serviceRequestId) {
      const { data: duplicatedInquiry } = await supabaseAdmin
        .from('inquiries')
        .select('id, user_id, host_id, experience_id, service_request_id, type, content')
        .eq('user_id', resolved.guestId)
        .eq('host_id', resolved.hostId)
        .eq('service_request_id', resolved.serviceRequestId)
        .eq('type', resolved.inquiryType)
        .maybeSingle<InquiryInsertRow>();

      if (duplicatedInquiry) {
        inquiry = duplicatedInquiry;
      }
    }

    if (!inquiry && (insertError || !newInquiry)) {
      if (insertError?.code === '23503' && insertError.message?.includes('profiles')) {
        throw new InquiryThreadError(400, '프로필 동기화가 진행 중입니다. 잠시 후(5초 뒤) 다시 시도해주세요.');
      }
      throw new InquiryThreadError(500, '문의방 생성에 실패했습니다.');
    }

    if (!inquiry && newInquiry) {
      inquiry = newInquiry;
      createdThread = true;
    }
  }

  if (!inquiry?.id) {
    throw new InquiryThreadError(500, '문의방을 확인할 수 없습니다.');
  }

  if (cleanMessage) {
    const { error: messageError } = await supabaseAdmin
      .from('inquiry_messages')
      .insert({
        inquiry_id: inquiry.id,
        sender_id: actor.id,
        content: cleanMessage,
        type: 'text',
        is_read: false,
      });

    if (messageError) {
      if (messageError.code === '23503' && messageError.message?.includes('profiles')) {
        throw new InquiryThreadError(400, '프로필 동기화가 진행 중입니다. 잠시 후(5초 뒤) 다시 시도해주세요.');
      }
      throw new InquiryThreadError(500, '첫 메시지 저장에 실패했습니다.');
    }

    await supabaseAdmin
      .from('inquiries')
      .update({
        content: cleanMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inquiry.id);

    createdMessage = true;

    const actorDisplayName = await getActorDisplayName(actor.id);
    const recipientId = actor.id === resolved.hostId ? resolved.guestId : resolved.hostId;
    const notificationLink = actor.id === resolved.hostId
      ? buildGuestInboxLink(inquiry.id)
      : resolved.inquiryType === 'admin_support'
        ? buildAdminChatLink(inquiry.id)
        : buildHostInquiryLink(inquiry.id);

    if (recipientId && recipientId !== actor.id) {
      await notifyRecipient({
        recipientId,
        title: `💬 ${actorDisplayName}님의 새 메시지`,
        message: cleanMessage,
        link: notificationLink,
      });
    }

  }

  const redirectUrl = (() => {
    switch (contextType) {
      case 'host_experience':
        return buildHostInquiryLink(inquiry.id);
      case 'admin_initiated_support':
        return buildAdminChatLink(inquiry.id);
      case 'service_request':
        return actor.id === resolved.hostId ? buildHostInquiryLink(inquiry.id) : buildGuestInboxLink(inquiry.id);
      default:
        return buildGuestInboxLink(inquiry.id);
    }
  })();

  return {
    success: true,
    inquiryId: inquiry.id,
    inquiryType: resolved.inquiryType,
    hostId: resolved.hostId,
    guestId: resolved.guestId,
    experienceId: resolved.experienceId,
    redirectUrl,
    createdThread,
    createdMessage,
  } satisfies InquiryThreadResponse;
}

export function getInquiryThreadErrorResponse(error: unknown) {
  if (error instanceof InquiryThreadError) {
    return {
      status: error.status,
      body: { success: false, error: error.message },
    };
  }

  console.error('[inquiries/thread] unexpected error:', error);
  return {
    status: 500,
    body: { success: false, error: 'Server error' },
  };
}
