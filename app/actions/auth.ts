'use server';

import { createClient } from '@/app/utils/supabase/server';

export async function syncProfile() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return { success: false, error: 'Auth session missing' };

        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        const meta = user.user_metadata || {};

        if (!existingProfile) {
            await supabase.from('profiles').insert({
                id: user.id,
                email: user.email,
                full_name: meta.full_name || 'User',
                avatar_url: meta.avatar_url || meta.picture || null,
                phone: meta.phone,
                birth_date: meta.birth_date,
                gender: meta.gender
            });
            console.log(`[AUTH] Synced new profile for ${user.email}`);
        } else {
            const updates: any = {};
            if (!existingProfile.avatar_url && (meta.avatar_url || meta.picture)) {
                updates.avatar_url = meta.avatar_url || meta.picture;
            }
            if (!existingProfile.gender && meta.gender) updates.gender = meta.gender;
            if (!existingProfile.birth_date && meta.birth_date) updates.birth_date = meta.birth_date;
            if (!existingProfile.phone && meta.phone) updates.phone = meta.phone;

            if (Object.keys(updates).length > 0) {
                await supabase.from('profiles').update(updates).eq('id', user.id);
                console.log(`[AUTH] Updated profile for ${user.email}`);
            }
        }

        return { success: true };
    } catch (error: any) {
        console.error('[AUTH] Sync Profile Error:', error);
        return { success: false, error: error.message };
    }
}
