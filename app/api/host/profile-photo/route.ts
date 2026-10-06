import { createClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { loadHostProfileRuntime } from '@/app/utils/hostProfileMedia.server';
import { createHostProfileUploadHandler } from '@/app/utils/hostProfileUploadHandler';
export const POST = createHostProfileUploadHandler({createClient,createAdminClient,loadRuntime:loadHostProfileRuntime});
