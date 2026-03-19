import { NextResponse } from 'next/server';

import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

export async function GET() {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const access = await resolveAdminAccess(supabaseAdmin, {
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json({
      success: true,
      ...access,
    });
  } catch (error) {
    console.error('[admin/access] GET failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to resolve admin access' }, { status: 500 });
  }
}
