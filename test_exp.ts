import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkExperiences() {
    console.log("Using service_role key to bypass RLS...");
    
    const { data: allApps, error: appError } = await supabaseAdmin
        .from('host_applications')
        .select('user_id, status');

    console.log('All host applications (Admin):', allApps?.filter(a => a.status === 'approved').length);

    if (allApps) {
        const approvedIds = allApps.filter(a => a.status === 'approved').map(a => a.user_id);
        const { data: expData } = await supabaseAdmin
            .from('experiences')
            .select('id, title, status, host_id')
            .eq('status', 'active')
            .in('host_id', approvedIds);
            
        console.log('Active Experiences for approved hosts (Admin):', expData?.length);
    }
}

checkExperiences();
