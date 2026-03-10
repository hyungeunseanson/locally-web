require('./loadEnv.cjs');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function checkColumns() {
    console.log('--- Checking host_applications columns ---');
    const res1 = await fetch(`${SUPABASE_URL}/rest/v1/host_applications?select=language_levels&limit=1`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });

    const text1 = await res1.text();
    console.log('host_applications result:', res1.status, text1);

    console.log('--- Checking experiences columns ---');
    const res2 = await fetch(`${SUPABASE_URL}/rest/v1/experiences?select=language_levels&limit=1`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });

    const text2 = await res2.text();
    console.log('experiences result:', res2.status, text2);
}

checkColumns();
