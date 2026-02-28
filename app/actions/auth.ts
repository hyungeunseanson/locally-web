'use server';

import { createClient } from '@/app/utils/supabase/server';
import {
  syncProfileWithAccessToken,
  syncProfileWithSupabaseClient,
} from '@/app/utils/auth/syncProfile';

export async function syncProfile(accessToken?: string) {
  try {
    if (accessToken) {
      return await syncProfileWithAccessToken(accessToken);
    }

    const supabase = await createClient();
    return await syncProfileWithSupabaseClient(supabase);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AUTH] Sync Profile Error:', error);
    return { success: false, error: message };
  }
}
