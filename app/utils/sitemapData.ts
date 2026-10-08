import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingCommunityBoardColumnError } from '../community/anonymousColumn';

const PAGE_SIZE = 500;
type SitemapSource = 'experiences' | 'community_posts' | 'public_host_applications';
type IdentifiedRow = { id: string | number };
type PageResult<T> = { data: T[] | null; error: unknown; count: number | null };

export type SitemapExperience = IdentifiedRow & {
  host_id: string | null;
  status: string | null;
  is_active: boolean | null;
};
export type SitemapCommunityPost = IdentifiedRow & {
  category: string | null;
  board_country: string | null;
  destination_hub: string | null;
  created_at: string | null;
  updated_at: string | null;
};
export type SitemapHost = IdentifiedRow & {
  user_id: string | null;
  status: string | null;
  created_at: string | null;
};

// Keep database messages, hints, credentials and row contents out of route errors/logs.
export class SitemapDataError extends Error {
  constructor(
    readonly source: SitemapSource,
    readonly code: string,
    readonly missingBoardColumn = false,
  ) {
    super(`Sitemap data unavailable: ${source} (${code})`);
    this.name = 'SitemapDataError';
  }
}

function queryFailure(source: SitemapSource, error: unknown): SitemapDataError {
  const rawCode = error && typeof error === 'object' && 'code' in error ? error.code : null;
  const code = typeof rawCode === 'string' && /^[A-Z0-9_]{1,32}$/.test(rawCode)
    ? rawCode : 'QUERY_FAILED';
  return new SitemapDataError(source, code,
    source === 'community_posts' && isMissingCommunityBoardColumnError(error));
}

async function readAllRows<T extends IdentifiedRow>(
  source: SitemapSource,
  readPage: (offset: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  let expectedCount: number | undefined;

  for (;;) {
    let result: PageResult<T>;
    try {
      result = await readPage(rows.length);
    } catch {
      throw new SitemapDataError(source, 'QUERY_FAILED');
    }
    if (result.error) throw queryFailure(source, result.error);
    if (!Array.isArray(result.data) || !Number.isSafeInteger(result.count) || result.count! < 0) {
      throw new SitemapDataError(source, 'INCOMPLETE_RESPONSE');
    }
    const count = result.count!;
    if (expectedCount !== undefined && count !== expectedCount) {
      throw new SitemapDataError(source, 'COUNT_CHANGED');
    }
    expectedCount = count;
    if (rows.length + result.data.length > count || (!result.data.length && rows.length < count)) {
      throw new SitemapDataError(source, 'INCOMPLETE_PAGE');
    }
    for (const row of result.data) {
      const key = row?.id == null ? '' : String(row.id);
      if (!key || seen.has(key)) throw new SitemapDataError(source, 'INVALID_PAGE');
      seen.add(key);
      rows.push(row);
    }
    if (rows.length === count) return rows;
    // Advance by the actual number returned: a server cap may be lower than PAGE_SIZE.
    // Exact counts and unique ordering prevent a short page silently ending the sitemap.
  }
}

async function readCommunityPosts(supabase: SupabaseClient): Promise<SitemapCommunityPost[]> {
  try {
    return await readAllRows<SitemapCommunityPost>('community_posts', (offset) => supabase
      .from('community_posts')
      .select('id, category, board_country, destination_hub, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
      .returns<SitemapCommunityPost[]>());
  } catch (error) {
    if (!(error instanceof SitemapDataError) || !error.missingBoardColumn) throw error;
    // Preserve the existing legacy-board fallback; this does not change indexability policy.
    const legacy = await readAllRows<Omit<SitemapCommunityPost, 'board_country'>>('community_posts', (offset) => supabase
      .from('community_posts')
      .select('id, category, destination_hub, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
      .returns<Omit<SitemapCommunityPost, 'board_country'>[]>());
    return legacy.map((post) => ({ ...post, board_country: null }));
  }
}

export async function readSitemapData(supabase: SupabaseClient) {
  const [experiences, communityPosts, publicHosts] = await Promise.all([
    readAllRows<SitemapExperience>('experiences', (offset) => supabase
      .from('experiences')
      // Production has no experiences.updated_at; creation time is not modification time.
      .select('id, host_id, status, is_active', { count: 'exact' })
      .eq('status', 'active')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
      .returns<SitemapExperience[]>()),
    readCommunityPosts(supabase),
    // Read all applications before selecting the latest, including newer nonpublic statuses.
    readAllRows<SitemapHost>('public_host_applications', (offset) => supabase
      .from('public_host_applications')
      .select('id, user_id, status, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
      .returns<SitemapHost[]>()),
  ]);
  return { experiences, communityPosts, publicHosts };
}
