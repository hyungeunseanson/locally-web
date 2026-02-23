const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    'https://uhinvcydgzqlpnvieyal.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoaW52Y3lkZ3pxbHBudmlleWFsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTk1NjUzNiwiZXhwIjoyMDg1NTMyNTM2fQ.FUrbaVSvGeQJx-rM4b5vQ_FA2gxR6yooZd2Odm_NgDs'
);

async function run() {
    try {
        const { data: profiles, error: profileErr } = await supabase.from('profiles').select('id').limit(1);
        if (!profiles || profiles.length === 0) {
            console.log('No profiles found', profileErr);
            return;
        }
        const authorId = profiles[0].id;
        console.log('Found profile:', authorId);

        const { data, error } = await supabase
            .from('admin_tasks')
            .upsert([
                {
                    id: '00000000-0000-0000-0000-000000000000',
                    type: 'MEMO',
                    content: '[SYSTEM] Team Mini Chat Room (Do not delete)',
                    author_id: authorId,
                    author_name: 'System',
                    is_completed: false
                }
            ]);
        console.log('Upsert result:', data, 'Error:', error);
    } catch (err) {
        console.error('Fatal error:', err);
    }
}

run();
