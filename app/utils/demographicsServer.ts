import 'server-only';

import { createAdminClient } from '@/app/utils/supabase/admin';
import { isDemographicGender, type Demographics } from '@/app/utils/demographics';

type AdminClient = ReturnType<typeof createAdminClient>;

function isMissingPrivateTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === '42P01'
    || error.code === 'PGRST205'
    || error.message?.includes('profile_private_demographics') === true;
}

export async function readPrivateDemographics(
  supabaseAdmin: AdminClient,
  userId: string
): Promise<Demographics> {
  const { data, error } = await supabaseAdmin
    .from('profile_private_demographics')
    .select('birth_date, gender')
    .eq('user_id', userId)
    .maybeSingle();

  if (!error) {
    return {
      birth_date: data?.birth_date || null,
      gender: isDemographicGender(data?.gender) ? data.gender : null,
    };
  }

  if (!isMissingPrivateTable(error)) throw error;

  // Transitional read only: remove after v3_40_31 is verified in every environment.
  const { data: legacyData, error: legacyError } = await supabaseAdmin
    .from('profiles')
    .select('birth_date, gender')
    .eq('id', userId)
    .maybeSingle();

  if (legacyError) throw legacyError;
  return {
    birth_date: legacyData?.birth_date || null,
    gender: isDemographicGender(legacyData?.gender) ? legacyData.gender : null,
  };
}

export async function readPrivateDemographicsBatch(
  supabaseAdmin: AdminClient,
  userIds: string[]
): Promise<Map<string, Demographics>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await supabaseAdmin
    .from('profile_private_demographics')
    .select('user_id, birth_date, gender')
    .in('user_id', userIds);

  if (!error) {
    return new Map((data || []).map((row) => [row.user_id, {
      birth_date: row.birth_date || null,
      gender: isDemographicGender(row.gender) ? row.gender : null,
    }]));
  }

  if (!isMissingPrivateTable(error)) throw error;

  // Transitional read only: remove after v3_40_31 is verified in every environment.
  const { data: legacyData, error: legacyError } = await supabaseAdmin
    .from('profiles')
    .select('id, birth_date, gender')
    .in('id', userIds);

  if (legacyError) throw legacyError;
  return new Map((legacyData || []).map((row) => [row.id, {
    birth_date: row.birth_date || null,
    gender: isDemographicGender(row.gender) ? row.gender : null,
  }]));
}
