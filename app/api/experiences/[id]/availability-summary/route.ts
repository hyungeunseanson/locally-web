import { NextResponse } from 'next/server';

import { createAdminClient } from '@/app/utils/supabase/admin';
import { fetchExperienceAvailabilitySummary } from '@/app/utils/experienceAvailability';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabaseAdmin = createAdminClient();

    const { data: experience, error: experienceError } = await supabaseAdmin
      .from('experiences')
      .select('id, max_guests')
      .eq('id', id)
      .maybeSingle();

    if (experienceError) {
      throw experienceError;
    }

    if (!experience) {
      return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
    }

    const summary = await fetchExperienceAvailabilitySummary(
      supabaseAdmin,
      id,
      Number(experience.max_guests || 10)
    );
    const response = NextResponse.json(summary);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to load experience availability.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
