/** Compression stays with the caller; this never commits an application or account avatar. */
export async function uploadHostProfilePhoto(file: File): Promise<string> {
  const form = new FormData();form.set('file',file);
  const response = await fetch('/api/host/profile-photo',{method:'POST',body:form,credentials:'same-origin'});
  const result = await response.json();
  if(!response.ok||typeof result.publicUrl!=='string')throw new Error('프로필 사진을 업로드하지 못했습니다. 다시 시도해 주세요.');
  return result.publicUrl;
}
