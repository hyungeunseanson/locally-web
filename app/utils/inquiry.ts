export type InquiryType = 'general' | 'admin' | 'admin_support';

export const SOFT_DELETED_INQUIRY_MESSAGE_TYPE = 'deleted';
export const SOFT_DELETED_INQUIRY_MESSAGE_PLACEHOLDER = '[운영 정책에 의해 삭제된 메시지입니다.]';

export function isAdminSupportInquiry(type?: InquiryType | string | null): boolean {
  return type === 'admin' || type === 'admin_support';
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
