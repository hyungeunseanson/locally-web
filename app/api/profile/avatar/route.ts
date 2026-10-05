import { createClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { loadAvatarRuntime } from '@/app/utils/avatarMedia.server';
import { createAvatarUploadHandler } from '@/app/utils/avatarUploadHandler';

export const runtime = 'nodejs';
export const POST = createAvatarUploadHandler({ createClient, createAdminClient, loadAvatarRuntime });
