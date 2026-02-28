export type InquiryType = 'general' | 'admin' | 'admin_support';

export function isAdminSupportInquiry(type?: InquiryType | string | null): boolean {
  return type === 'admin' || type === 'admin_support';
}
