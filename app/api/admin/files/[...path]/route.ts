import { NextResponse } from 'next/server';

import { resolveAdminAccess } from '@/app/utils/adminAccess';
import { isSafeInlineRasterImageType } from '@/app/utils/privateStorageDelivery';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

function normalizePath(segments: string[]) {
  if (
    segments.length === 0 ||
    segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('\\'))
  ) {
    return null;
  }
  return segments.join('/');
}

type AdminFileDeliveryDependencies = {
  createServerClient: typeof createServerClient;
  createAdminClient: typeof createAdminClient;
  resolveAdminAccess: typeof resolveAdminAccess;
};

const DEFAULT_DEPENDENCIES: AdminFileDeliveryDependencies = {
  createServerClient,
  createAdminClient,
  resolveAdminAccess,
};

export async function serveAdminFile(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
  dependencies: AdminFileDeliveryDependencies = DEFAULT_DEPENDENCIES
) {
  const supabase = await dependencies.createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = dependencies.createAdminClient();
  const { isAdmin } = await dependencies.resolveAdminAccess(supabaseAdmin, {
    userId: user.id,
    email: user.email,
  });
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { path: segments } = await context.params;
  const objectPath = normalizePath(segments);
  if (
    !objectPath ||
    (!objectPath.startsWith('markdown_images/') && !objectPath.startsWith('chat_images/'))
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin.storage.from('admin_files').download(objectPath);
  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!isSafeInlineRasterImageType(data.type)) {
    return NextResponse.json({ error: 'Unsupported media type' }, { status: 415 });
  }

  return new NextResponse(data, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline',
      'Content-Type': data.type,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const GET = serveAdminFile;
