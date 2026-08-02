export type InquiryType = 'general' | 'admin' | 'admin_support';

export const SOFT_DELETED_INQUIRY_MESSAGE_TYPE = 'deleted';
export const SOFT_DELETED_INQUIRY_MESSAGE_PLACEHOLDER = '[운영 정책에 의해 삭제된 메시지입니다.]';

export function isAdminSupportInquiry(type?: InquiryType | string | null): boolean {
  return type === 'admin' || type === 'admin_support';
}

export function isOfficialInquirySupportMessage(params: {
  inquiryType?: InquiryType | string | null;
  senderId?: string | number | null;
  guestId?: string | number | null;
  hostId?: string | number | null;
}): boolean {
  const { inquiryType, senderId, guestId, hostId } = params;

  if (senderId == null || guestId == null) return false;
  if (String(senderId) === String(guestId)) return false;
  if (isAdminSupportInquiry(inquiryType)) return true;
  if (hostId != null && String(senderId) === String(hostId)) return false;

  return true;
}

export function isDeletedInquiryMessage(type?: string | null): boolean {
  return type === SOFT_DELETED_INQUIRY_MESSAGE_TYPE;
}

export function getInquiryMessageDisplayContent(params: {
  type?: string | null;
  content?: string | null;
}) {
  if (isDeletedInquiryMessage(params.type)) {
    return SOFT_DELETED_INQUIRY_MESSAGE_PLACEHOLDER;
  }

  const content = typeof params.content === 'string' ? params.content : '';
  if (content) return content;

  return params.type === 'image' ? '📷 사진을 보냈습니다.' : '';
}
