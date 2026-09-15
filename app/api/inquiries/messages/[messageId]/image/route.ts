import { NextResponse } from 'next/server';

import {
  extractStorageObjectPath,
  isSafeInlineRasterImageType,
} from '@/app/utils/privateStorageDelivery';
import { createAdminClient } from '@/app/utils/supabase/admin';
import { createClient as createServerClient } from '@/app/utils/supabase/server';

type ChatImageMessage = {
  image_url?: string | null;
  type?: string | null;
};

type ChatImageDeliveryDependencies = {
  createServerClient: typeof createServerClient;
  createAdminClient: typeof createAdminClient;
};

const DEFAULT_DEPENDENCIES: ChatImageDeliveryDependencies = {
  createServerClient,
  createAdminClient,
};

export async function serveInquiryMessageImage(
  _request: Request,
  context: { params: Promise<{ messageId: string }> },
  dependencies: ChatImageDeliveryDependencies = DEFAULT_DEPENDENCIES
) {
  const supabase = await dependencies.createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { messageId } = await context.params;
  if (!/^\d+$/.test(messageId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const { data: message, error: messageError } = await supabase
    .from('inquiry_messages')
    .select('image_url, type')
    .eq('id', messageId)
    .maybeSingle<ChatImageMessage>();

  if (messageError) {
    return NextResponse.json({ error: 'Unable to verify attachment access' }, { status: 500 });
  }
  if (!message || message.type !== 'image' || !message.image_url) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const objectPath = extractStorageObjectPath(message.image_url, 'chat-images');
  if (!objectPath) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data, error } = await dependencies.createAdminClient().storage.from('chat-images').download(objectPath);
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

export const GET = serveInquiryMessageImage;
