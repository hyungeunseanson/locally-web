import { NextResponse } from 'next/server';

import { createClient } from '@/app/utils/supabase/server';

const WISHLIST_EXPERIENCE_SELECT = [
  'id',
  'title',
  'title_en',
  'title_ja',
  'title_zh',
  'city',
  'country',
  'location',
  'languages',
  'category',
  'category_en',
  'category_ja',
  'category_zh',
  'rating',
  'price',
  'image_url',
  'photos',
].join(', ');

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null };
  }

  return { supabase, user };
}

export async function GET(request: Request) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const experienceId = searchParams.get('experienceId');

    if (experienceId) {
      const { data, error } = await supabase
        .from('wishlists')
        .select('id')
        .eq('user_id', user.id)
        .eq('experience_id', experienceId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return NextResponse.json({ isSaved: Boolean(data) });
    }

    const { data, error } = await supabase
      .from('wishlists')
      .select(`
        id,
        created_at,
        experiences (
          ${WISHLIST_EXPERIENCE_SELECT}
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    console.error('[guest/wishlists] GET failed:', error);
    return NextResponse.json({ error: 'Failed to load wishlists.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { experienceId?: string | number | null };
    const experienceId = body.experienceId;

    if (typeof experienceId !== 'string' && typeof experienceId !== 'number') {
      return NextResponse.json({ error: 'experienceId is required.' }, { status: 400 });
    }

    const { error } = await supabase.from('wishlists').upsert(
      [{ user_id: user.id, experience_id: experienceId }],
      {
        onConflict: 'user_id,experience_id',
        ignoreDuplicates: true,
      }
    );

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[guest/wishlists] POST failed:', error);
    return NextResponse.json({ error: 'Failed to save wishlist.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      experienceId?: string | number | null;
      wishlistId?: string | number | null;
    };

    let query = supabase.from('wishlists').delete().eq('user_id', user.id);

    if (typeof body.wishlistId === 'string' || typeof body.wishlistId === 'number') {
      query = query.eq('id', body.wishlistId);
    } else if (typeof body.experienceId === 'string' || typeof body.experienceId === 'number') {
      query = query.eq('experience_id', body.experienceId);
    } else {
      return NextResponse.json({ error: 'experienceId or wishlistId is required.' }, { status: 400 });
    }

    const { error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[guest/wishlists] DELETE failed:', error);
    return NextResponse.json({ error: 'Failed to remove wishlist.' }, { status: 500 });
  }
}
