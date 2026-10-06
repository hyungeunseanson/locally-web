import { isManagedCommunityUrl } from './communityMediaContract.mjs';
export type CommunityUploadedImage = { publicUrl: string; path?: string; assetId?: string };
/** The server selection is the sole authority; R2 errors never invoke the legacy callback. */
export async function uploadCommunityImage(file: File, authority: 'r2' | 'supabase', legacy: (file: File) => Promise<CommunityUploadedImage>, fetcher: typeof fetch = fetch): Promise<CommunityUploadedImage> {
  if (authority === 'supabase') return legacy(file);
  if (authority !== 'r2') throw new Error('이미지 업로드를 준비하지 못했습니다.');
  const form = new FormData(); form.set('file', file);
  const response = await fetcher('/api/community/images', { method: 'POST', body: form, credentials: 'same-origin' });
  const result = await response.json();
  if (!response.ok || result.authority !== 'r2' || !isManagedCommunityUrl(result.publicUrl) || typeof result.assetId !== 'string' || !result.publicUrl.endsWith('/' + result.assetId + '/image')) throw new Error('이미지 업로드에 실패했습니다. 다시 시도해 주세요.');
  return { publicUrl: result.publicUrl, assetId: result.assetId };
}
