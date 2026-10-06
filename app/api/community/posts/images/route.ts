import { createClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createCommunityImageSetHandler } from '@/app/utils/communityImageSetHandler';
import { revalidatePath, revalidateTag } from 'next/cache';
const handler = createCommunityImageSetHandler({ createClient, createAdminClient });
export async function PATCH(request: Request) {
  const response = await handler(request);
  if (response.ok) {
    const { id } = await response.clone().json();
    revalidatePath('/community');
    revalidatePath(`/community/${id}`);
    revalidateTag('community-board-feed', 'max');
  }
  return response;
}
