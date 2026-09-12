// Temporary OFF until the private R2 attachment implementation is reviewed.
// Code-only policy: deployment environment variables must not re-enable uploads.
export const CHAT_IMAGE_ATTACHMENTS_ENABLED = false;
export const CHAT_IMAGE_ATTACHMENTS_UNAVAILABLE_MESSAGE = '사진 첨부 기능은 현재 준비 중입니다.';

// Accept legacy text clients sending imageUrl: null, but never silently ignore
// attachment payloads (including aliases submitted directly to the API).
export function isChatImageAttachmentRequest(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const request = body as Record<string, unknown>;
  if (typeof request.type === 'string' && request.type.trim().toLowerCase() === 'image') return true;
  return [
    'imageUrl', 'image_url',
    'imageAttachmentId', 'image_attachment_id',
    'attachmentId', 'attachment_id',
    'attachment', 'attachments', 'image', 'images', 'file', 'files',
  ].some((key) => request[key] != null);
}
