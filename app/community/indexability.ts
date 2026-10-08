import { inferCommunityBoardFromLegacyHub } from './boardMeta';

export type CommunityIndexabilityFields = {
  category?: string | null;
  board_country?: string | null;
  destination_hub?: string | null;
  is_anonymous?: boolean | null;
};

// Board navigation may use query parameters. Search eligibility only uses persisted data.
export function getCommunityPostBoard(post: CommunityIndexabilityFields) {
  if (post.board_country === 'japan' || post.board_country === 'korea') return post.board_country;
  if (post.board_country != null) return null;
  return inferCommunityBoardFromLegacyHub(post.destination_hub);
}

export function isCommunityPostIndexable(post: CommunityIndexabilityFields): boolean {
  if (post.is_anonymous === true) return false;
  // This category is published through the existing admin-only, nonanonymous writer.
  if (post.category === 'locally_content') return true;
  // Missing legacy anonymity data is unknown, never proof of consent to indexing.
  return post.category === 'qna' && post.is_anonymous === false && getCommunityPostBoard(post) !== null;
}

export function shouldHideCommunityPostAuthor(post: CommunityIndexabilityFields): boolean {
  if (post.is_anonymous === true) return true;
  // The legacy writer can drop a requested anonymous flag when its column is absent.
  // Ordinary legacy rows therefore cannot prove permission to publish author identity.
  // Admin-only locally_content is explicitly nonanonymous under the existing writer.
  return post.is_anonymous !== false && post.category !== 'locally_content';
}

export function normalizeCommunityPost<T extends CommunityIndexabilityFields>(post: T) {
  return {
    ...post,
    destination_hub: post.destination_hub ?? null,
    // Keep invalid persisted values invalid; converting them to null would infer a hub
    // on the next policy evaluation and accidentally grant board eligibility.
    board_country: post.board_country ?? getCommunityPostBoard(post),
    is_anonymous: typeof post.is_anonymous === 'boolean' ? post.is_anonymous : null,
  };
}

export type CommunityCompatibilityColumn = 'board_country' | 'destination_hub' | 'is_anonymous';

// Retry only an explicitly missing optional column, not permissions or arbitrary failures.
export function getMissingCommunityCompatibilityColumn(error: unknown): CommunityCompatibilityColumn | null {
  if (!error || typeof error !== 'object' || !('code' in error) || !('message' in error)) return null;
  if (error.code !== '42703' && error.code !== 'PGRST204') return null;
  if (typeof error.message !== 'string') return null;
  for (const column of ['board_country', 'destination_hub', 'is_anonymous'] as const) {
    if (new RegExp(`\\b${column}\\b`, 'i').test(error.message)) return column;
  }
  return null;
}
