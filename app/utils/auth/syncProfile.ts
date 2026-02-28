import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';

type SyncProfileResult = { success: true } | { success: false; error: string };

function buildProfilePayload(user: User) {
  const meta = user.user_metadata || {};

  return {
    id: user.id,
    email: user.email,
    full_name: meta.full_name || 'User',
    avatar_url: meta.avatar_url || meta.picture || null,
    phone: meta.phone || null,
    birth_date: meta.birth_date || null,
    gender: meta.gender || null,
  };
}

async function syncProfileRecord(
  supabase: SupabaseClient,
  user: User
): Promise<SyncProfileResult> {
  const { data: existingProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, avatar_url, phone, birth_date, gender')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  const profilePayload = buildProfilePayload(user);

  if (!existingProfile) {
    const { error: insertError } = await supabase.from('profiles').insert(profilePayload);

    if (insertError) {
      return { success: false, error: insertError.message };
    }

    console.log(`[AUTH] Synced new profile for ${user.email}`);
    return { success: true };
  }

  const updates: Record<string, string | null> = {};

  if (!existingProfile.avatar_url && profilePayload.avatar_url) {
    updates.avatar_url = profilePayload.avatar_url;
  }
  if (!existingProfile.phone && profilePayload.phone) {
    updates.phone = profilePayload.phone;
  }
  if (!existingProfile.birth_date && profilePayload.birth_date) {
    updates.birth_date = profilePayload.birth_date;
  }
  if (!existingProfile.gender && profilePayload.gender) {
    updates.gender = profilePayload.gender;
  }

  if (Object.keys(updates).length === 0) {
    return { success: true };
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  console.log(`[AUTH] Updated profile for ${user.email}`);
  return { success: true };
}

export async function syncProfileWithSupabaseClient(
  supabase: SupabaseClient
): Promise<SyncProfileResult> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return { success: false, error: error.message };
  }

  if (!user) {
    return { success: false, error: 'Auth session missing' };
  }

  return syncProfileRecord(supabase, user);
}

export async function syncProfileWithAccessToken(
  accessToken: string
): Promise<SyncProfileResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { success: false, error: 'Missing Supabase environment variables' };
  }

  const supabase = createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error) {
    return { success: false, error: error.message };
  }

  if (!user) {
    return { success: false, error: 'Auth session missing' };
  }

  return syncProfileRecord(supabase, user);
}
