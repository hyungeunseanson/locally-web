/** Both account surfaces use server authentication and server-selected authority. */
export async function uploadProfileAvatar(file: File): Promise<string> {
  const form = new FormData();
  form.set('file', file);
  const response = await fetch('/api/profile/avatar', { method: 'POST', body: form, credentials: 'same-origin' });
  const result = await response.json();
  if (!response.ok || typeof result.publicUrl !== 'string') {
    throw new Error(response.status === 409 ? '프로필 사진이 변경되었습니다. 새로고침 후 다시 시도해 주세요.' : '프로필 사진을 저장하지 못했습니다. 다시 시도해 주세요.');
  }
  return result.publicUrl;
}
