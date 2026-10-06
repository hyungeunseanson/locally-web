import { createClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { loadCommunityRuntime } from '@/app/utils/communityMedia.server';
import { createCommunityUploadHandlers } from '@/app/utils/communityUploadHandler';
const handlers = createCommunityUploadHandlers({ createClient, createAdminClient, loadRuntime: loadCommunityRuntime });
export const GET = handlers.GET;
export const POST = handlers.POST;
